const PDFDocument = require("pdfkit");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const r2 = require("./r2Storage");
const axios = require("./axiosConfig");

const PHOTO_FETCH_TIMEOUT_MS = 8000;
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
const LOGO_MAX_BYTES = 5 * 1024 * 1024;

const ACCESSORIES = ["Battery", "Back Door", "Sim Card", "Memory Card", "Head Set", "Charger", "Bluetooth", "Others"];

const DEFAULT_TERMS_AND_CONDITIONS = [
  "No guarantee for liquid / water damage.",
  "Collect your device within 30 days of completion.",
  "We are not responsible for any data loss.",
  "Advance payment required before ordering parts.",
];

const formatDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN") : "-");

const formatWarranty = (m) => {
  if (!m?.has_warranty) return "No Warranty";
  const months = m.warranty_months;
  const expiry = m.warranty_expiry_date ? formatDate(m.warranty_expiry_date) : null;
  return `${months ? `${months} Month${months === 1 ? "" : "s"}` : "Yes"}${expiry ? ` (till ${expiry})` : ""}`;
};

const getPaidAmount = (m) =>
  m.total_paid ||
  (Array.isArray(m.payments) && m.payments.length > 0
    ? m.payments.reduce((s, p) => s + (p.amount || 0), 0)
    : 0) ||
  m.paid_amount ||
  0;

// PDFKit only decodes JPEG and PNG; anything else (e.g. WEBP) falls back to an empty box.
const isRenderableImage = (buf) =>
  Buffer.isBuffer(buf) &&
  buf.length > 8 &&
  ((buf[0] === 0xff && buf[1] === 0xd8) ||
    (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47));

async function fetchR2Image(key) {
  if (!key || typeof key !== "string" || !r2.isConfigured()) return null;
  try {
    const res = await r2
      .getClient()
      .send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }), {
        abortSignal: AbortSignal.timeout(PHOTO_FETCH_TIMEOUT_MS),
      });
    if (res.ContentLength && res.ContentLength > PHOTO_MAX_BYTES) return null;
    const buf = Buffer.from(await res.Body.transformToByteArray());
    return isRenderableImage(buf) ? buf : null;
  } catch (err) {
    console.warn(`⚠️ Receipt PDF: could not load photo "${key}": ${err.message}`);
    return null;
  }
}

// Uses mobile.images[] ({ key, side: "front" | "back" }); the latest upload per side wins.
function loadMobilePhotos(mobiles) {
  return Promise.all(
    mobiles.map(async (m) => {
      const images = Array.isArray(m?.images) ? m.images : [];
      const latest = (side) => [...images].reverse().find((img) => img?.side === side)?.key;
      const [front, back] = await Promise.all([fetchR2Image(latest("front")), fetchR2Image(latest("back"))]);
      return { front, back };
    })
  );
}

// Logo image from the CommonDB profile: accepts only PNG/JPEG data URLs or CommonDB's own
// /uploads/profile_images/ files, so a user-set URL can't make the server fetch arbitrary hosts.
async function fetchLogo(imageUrl) {
  if (!imageUrl || typeof imageUrl !== "string") return null;
  const dataUrl = imageUrl.match(/^data:image\/(?:png|jpe?g);base64,(.+)$/i);
  if (dataUrl) {
    const buf = Buffer.from(dataUrl[1], "base64");
    return buf.length <= LOGO_MAX_BYTES && isRenderableImage(buf) ? buf : null;
  }
  let pathname;
  try {
    pathname = new URL(imageUrl, "http://placeholder").pathname;
  } catch (_) {
    return null;
  }
  if (!/^\/uploads\/profile_images\/[\w.-]+$/.test(pathname) || !process.env.AUTH_SERVER_URL) return null;
  const res = await axios.get(`${process.env.AUTH_SERVER_URL}${pathname}`, {
    responseType: "arraybuffer",
    timeout: PHOTO_FETCH_TIMEOUT_MS,
    maxContentLength: LOGO_MAX_BYTES,
  });
  const buf = Buffer.from(res.data);
  return isRenderableImage(buf) ? buf : null;
}

// Same source the web A4 Invoice uses for its header: the shop owner's CommonDB profile.
async function loadShopProfile(shop) {
  if (!shop?.mysql_user_id || !process.env.AUTH_SERVER_URL) return {};
  try {
    const { data } = await axios.post(
      `${process.env.AUTH_SERVER_URL}/get-mysql-user`,
      { userId: shop.mysql_user_id },
      { timeout: PHOTO_FETCH_TIMEOUT_MS }
    );
    let logo = null;
    try {
      logo = await fetchLogo(data?.imageUrl);
    } catch (err) {
      console.warn(`⚠️ Receipt PDF: could not load shop logo: ${err.message}`);
    }
    return { name: data?.name, phone: data?.phone, address: data?.address, email: data?.email, logo };
  } catch (err) {
    console.warn(`⚠️ Receipt PDF: could not load shop profile: ${err.message}`);
    return {};
  }
}

function drawPhotoBox(doc, x, y, w, h, buf, label) {
  doc.lineWidth(0.6).strokeColor("#999").rect(x, y, w, h).stroke();
  if (buf) {
    try {
      doc.image(buf, x + 2, y + 2, { fit: [w - 4, h - 4], align: "center", valign: "center" });
      return;
    } catch (err) {
      console.warn(`⚠️ Receipt PDF: invalid ${label} image: ${err.message}`);
    }
  }
  doc.font("Helvetica").fontSize(7).fillColor("#999");
  doc.text(label, x, y + h / 2 - 4, { width: w, align: "center", lineBreak: false });
}

const PAD = 3;

const cellFont = (header, style) => (header || style?.bold ? "Helvetica-Bold" : "Helvetica");

function measureTableRow(doc, columns, values, { header = false, height = 20, minHeight = 0, cellStyles = {} } = {}) {
  const heights = columns.map((col, idx) => {
    doc.font(cellFont(header, cellStyles[idx])).fontSize(header ? 8 : 7.5);
    return doc.heightOfString(String(values[idx] ?? ""), { width: col.width - PAD * 2, align: col.align || "left" });
  });
  return { heights, rowH: Math.max(height, minHeight, Math.max(...heights) + 8) };
}

// Draws a table row with fixed column widths, wrapping text within each cell.
function drawTableRow(doc, x, y, columns, values, opts = {}) {
  const { header = false, fill = null, cellStyles = {} } = opts;
  const totalW = columns.reduce((s, c) => s + c.width, 0);

  // measure wrapped text so the row grows instead of overflowing
  const { heights, rowH } = measureTableRow(doc, columns, values, opts);

  const bg = header ? "#f0f0f0" : fill;
  if (bg) doc.rect(x, y, totalW, rowH).fill(bg);

  let cx = x;
  columns.forEach((col, idx) => {
    const style = cellStyles[idx] || {};
    doc.lineWidth(0.5).strokeColor("#555").rect(cx, y, col.width, rowH).stroke();
    doc
      .font(cellFont(header, style))
      .fontSize(header ? 8 : 7.5)
      .fillColor(style.color || (header ? "#111" : "#222"))
      .text(String(values[idx] ?? ""), cx + PAD, y + (rowH - heights[idx]) / 2, {
        width: col.width - PAD * 2,
        align: col.align || "left",
      });
    cx += col.width;
  });
  return y + rowH;
}

function drawLogoBox(doc, x, y, size, logo) {
  doc.lineWidth(0.75).roundedRect(x, y, size, size, 4).fillAndStroke("#f7f7f7", "#ddd");
  if (logo) {
    doc.save();
    try {
      doc.roundedRect(x, y, size, size, 4).clip();
      doc.image(logo, x, y, { cover: [size, size], align: "center", valign: "center" });
      doc.restore();
      return;
    } catch (err) {
      doc.restore();
      console.warn(`⚠️ Receipt PDF: invalid shop logo: ${err.message}`);
    }
  }
  doc.font("Helvetica").fontSize(7).fillColor("#999");
  doc.text("LOGO", x, y + size / 2 - 3.5, { width: size, align: "center", lineBreak: false });
}

// "ACCESSORIES RECEIVED" checklist + "REMARKS / NOTES" lines, side by side (same as the web A4 Invoice).
function drawAccessoriesAndNotes(doc, x, y, width, height) {
  const GAP = 9;
  const boxW = (width - GAP) / 2;
  const IN = 6;

  doc.lineWidth(0.75).roundedRect(x, y, boxW, height, 2).stroke("#ccc");
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#111");
  doc.text("ACCESSORIES RECEIVED", x + IN, y + IN, { lineBreak: false });
  const colW = (boxW - IN * 2) / 4;
  doc.font("Helvetica").fontSize(7.5);
  ACCESSORIES.forEach((item, i) => {
    const ix = x + IN + (i % 4) * colW;
    const iy = y + 21 + Math.floor(i / 4) * 12;
    // Box centred on the mixed-case text centre (~3.25pt below the line top at 7.5pt Helvetica)
    doc.lineWidth(0.6).rect(ix, iy, 6.5, 6.5).stroke("#777");
    doc.fillColor("#111").text(item, ix + 10, iy, { width: colW - 10, lineBreak: false });
  });
  const flashY = y + 49;
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#111").text("Flashing:", x + IN, flashY, { lineBreak: false });
  const labelW = doc.widthOfString("Flashing: ");
  doc.font("Helvetica").fillColor("#777").text("Backup \u2014 Yes  /  No", x + IN + labelW, flashY, { lineBreak: false });

  const rx = x + boxW + GAP;
  doc.lineWidth(0.75).roundedRect(rx, y, boxW, height, 2).stroke("#ccc");
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#111");
  doc.text("REMARKS / NOTES", rx + IN, y + IN, { lineBreak: false });
  doc.lineWidth(0.6).dash(2, { space: 2 });
  [y + 26, y + 42, y + 58].forEach((ly) => {
    doc.moveTo(rx + IN, ly).lineTo(rx + boxW - IN, ly).stroke("#bbb");
  });
  doc.undash();
}

// Fixed-geometry grid: 3 equal columns, each cell = title band + image area.
const TERMS_GRID_COLS = 3;
const TERMS_TITLE_MIN_H = 22;
const TERMS_TITLE_PAD_Y = 5;
const TERMS_IMAGE_H = 125;
const TERMS_CELL_PAD = 5;

// Shop terms often start with their own "Terms & Conditions:" line, which duplicates the printed heading.
const stripTermsHeading = (text) =>
  (text || "").replace(/^\s*terms\s*(?:&|and)\s*conditions\s*:?[ \t]*(?:\r?\n)*/i, "");

const termsTitleOpts = (w) => ({ width: w - TERMS_CELL_PAD * 2, align: "center" });

// Title band height for a row = tallest wrapped title in it, so titles are never clipped
function measureTermsTitleRow(doc, cellW, rowItems) {
  doc.font("Helvetica-Bold").fontSize(8);
  const maxTextH = Math.max(0, ...rowItems.map((it) => (it ? doc.heightOfString(it.title || "", termsTitleOpts(cellW)) : 0)));
  return Math.max(TERMS_TITLE_MIN_H, Math.ceil(maxTextH) + TERMS_TITLE_PAD_Y * 2);
}

function drawTermsImageCell(doc, x, y, w, titleH, item) {
  doc.lineWidth(0.5);
  doc.rect(x, y, w, titleH).fillAndStroke("#f0f0f0", "#555");
  doc.rect(x, y + titleH, w, TERMS_IMAGE_H).stroke("#555");
  if (!item) return;

  const opts = termsTitleOpts(w);
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#111");
  const textH = doc.heightOfString(item.title || "", opts);
  doc.text(item.title || "", x + TERMS_CELL_PAD, y + (titleH - textH) / 2, opts);

  const ix = x + TERMS_CELL_PAD;
  const iy = y + titleH + TERMS_CELL_PAD;
  const iw = w - TERMS_CELL_PAD * 2;
  const ih = TERMS_IMAGE_H - TERMS_CELL_PAD * 2;
  if (item.buf) {
    try {
      doc.image(item.buf, ix, iy, { fit: [iw, ih], align: "center", valign: "center" });
      return;
    } catch (err) {
      console.warn(`⚠️ Receipt PDF: invalid terms image "${item.title}": ${err.message}`);
    }
  }
  doc.font("Helvetica").fontSize(7).fillColor("#999");
  doc.text("Image unavailable", ix, iy + ih / 2 - 4, { width: iw, align: "center", lineBreak: false });
}

// Draws "Receipt Terms & Conditions Images" from y, adding pages only when a whole row can't fit.
function drawTermsImagesSection(doc, left, width, startY, items) {
  const bottom = () => doc.page.height - doc.page.margins.bottom;
  const HEAD_H = 24;
  const cellW = width / TERMS_GRID_COLS;
  let y = startY;

  const rows = [];
  for (let i = 0; i < items.length; i += TERMS_GRID_COLS) {
    const rowItems = Array.from({ length: TERMS_GRID_COLS }, (_, c) => items[i + c]);
    rows.push({ rowItems, titleH: measureTermsTitleRow(doc, cellW, rowItems) });
  }

  // Keep the heading together with the first row
  if (rows.length > 0 && y + HEAD_H + rows[0].titleH + TERMS_IMAGE_H > bottom()) {
    doc.addPage();
    y = doc.page.margins.top;
  }
  doc.moveTo(left, y).lineTo(left + width, y).lineWidth(0.75).strokeColor("#ddd").stroke();
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#333");
  doc.text("Warranty Not Applicable", left, y + 7, { width, lineBreak: false });
  y += HEAD_H;

  for (const { rowItems, titleH } of rows) {
    if (y + titleH + TERMS_IMAGE_H > bottom()) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    rowItems.forEach((item, col) => drawTermsImageCell(doc, left + col * cellW, y, cellW, titleH, item));
    y += titleH + TERMS_IMAGE_H;
  }
}

// Generates the A4 service receipt PDF (page 1: receipt + photos, page 2: terms + terms images) as a Buffer.
async function generateReceiptPdfBuffer({ shop, client, mobiles, billNo, termsAndConditions }) {
  const termsImageRefs = Array.isArray(shop?.receipt_terms_images) ? shop.receipt_terms_images : [];
  const [photos, profile, termsImageBufs] = await Promise.all([
    loadMobilePhotos(mobiles),
    loadShopProfile(shop),
    Promise.all(termsImageRefs.map((img) => fetchR2Image(img?.key))),
  ]);
  const termsImages = termsImageRefs.map((img, i) => ({ title: img?.title || "", buf: termsImageBufs[i] }));

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 40 });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const left = doc.page.margins.left;
      const shopName = (profile.name || shop?.owner_name || shop?.shop_name || "MOBILE SERVICE CENTER").toUpperCase();
      const shopAddress = profile.address || shop?.address || "Address Not Provided";
      const shopPhone = profile.phone || shop?.phone || "N/A";
      const shopEmail = (profile.email || shop?.email || "").trim();

      // Header: logo box + centred shop details
      const LOGO = 54;
      const headerTop = doc.page.margins.top;
      drawLogoBox(doc, left, headerTop, LOGO, profile.logo);

      const textX = left + LOGO + 12;
      const textW = pageWidth - LOGO - 12;
      const contactLine = `Ph: ${shopPhone}${shopEmail && shopEmail !== "N/A" ? `  |  Email: ${shopEmail}` : ""}`;
      doc.font("Helvetica-Bold").fontSize(17);
      const nameH = doc.heightOfString(shopName, { width: textW, align: "center", characterSpacing: 0.75 });
      doc.font("Helvetica").fontSize(8.5);
      const addrH = doc.heightOfString(shopAddress, { width: textW, align: "center" });
      const contactH = doc.heightOfString(contactLine, { width: textW, align: "center" });
      const blockH = nameH + 2 + addrH + contactH;
      let ty = headerTop + Math.max(0, (LOGO - blockH) / 2);

      doc.font("Helvetica-Bold").fontSize(17).fillColor("#8B4513");
      doc.text(shopName, textX, ty, { width: textW, align: "center", characterSpacing: 0.75 });
      ty += nameH + 2;
      doc.font("Helvetica").fontSize(8.5).fillColor("#555");
      doc.text(shopAddress, textX, ty, { width: textW, align: "center" });
      ty += addrH;
      doc.text(contactLine, textX, ty, { width: textW, align: "center" });
      ty += contactH;

      const ruleY = Math.max(headerTop + LOGO, ty) + 9;
      doc.moveTo(left, ruleY).lineTo(left + pageWidth, ruleY).lineWidth(2.25).strokeColor("#222").stroke();

      // Title bar
      const titleY = ruleY + 9;
      const TITLE_H = 20;
      const titleGrad = doc.linearGradient(left, titleY, left + pageWidth, titleY + TITLE_H);
      titleGrad.stop(0, "#222").stop(1, "#3a3a3a");
      doc.roundedRect(left, titleY, pageWidth, TITLE_H, 2).fill(titleGrad);
      doc
        .fillColor("#fff")
        .font("Helvetica-Bold")
        .fontSize(10.5)
        .text("SERVICE RECEIPT / JOB CARD", left, titleY + 6, { width: pageWidth, align: "center", characterSpacing: 2.25, lineBreak: false });

      // Bill info row: customer box (left) + bill box (right)
      const infoY = titleY + TITLE_H + 9;
      const INFO_H = 36;
      const billLine = `Bill No: ${billNo || "N/A"}`;
      doc.font("Helvetica-Bold").fontSize(10);
      const billBoxW = Math.max(110, doc.widthOfString(billLine) + 22);
      const custBoxW = pageWidth - billBoxW - 15;

      doc.lineWidth(0.75).roundedRect(left, infoY, custBoxW, INFO_H, 3).fillAndStroke("#fcfcfc", "#e2e2e2");
      const drawLabelValue = (label, value, yy) => {
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#111").text(label, left + 8, yy, { lineBreak: false });
        const lw = doc.widthOfString(label);
        doc.font("Helvetica").text(value, left + 8 + lw, yy, { width: custBoxW - 16 - lw, lineBreak: false, ellipsis: true });
      };
      drawLabelValue("Customer Name :  ", client?.client_name || "", infoY + 7);
      drawLabelValue("Phone / Mobile :  ", client?.mobile_number || "", infoY + 20);

      const billX = left + pageWidth - billBoxW;
      doc.lineWidth(0.75).roundedRect(billX, infoY, billBoxW, INFO_H, 3).fillAndStroke("#f9f9f9", "#999");
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#8B4513");
      doc.text(billLine, billX, infoY + 7, { width: billBoxW - 10, align: "right", lineBreak: false });
      doc.font("Helvetica").fontSize(8.5).fillColor("#555");
      doc.text(`Date: ${formatDate(new Date())}`, billX, infoY + 21, { width: billBoxW - 10, align: "right", lineBreak: false });

      doc.y = infoY + INFO_H + 9;

      // Devices table
      // Devices table  (total width = 515 = A4 content width)
const columns = [
  { key: "#",         width: 20, align: "center" },
  { key: "Make",      width: 55 },   // was 58
  { key: "Model",     width: 40 },   // was 42
  { key: "IMEI",      width: 65 },   // was 70
  { key: "Issue",     width: 75 },   // was 80
  { key: "Added",     width: 58 },   // was 55
  { key: "Delivered", width: 58 },   // was 55
  { key: "Warranty",  width: 78 },
  { key: "Amount",    width: 66 },  // was 57
];

const headerLabels = [
  "#", "Mobile Make", "Model", "IMEI No.", "Complaint / Issue",
  "Date Added", "Delivery Date", "Warranty", "Amount (Rs.)",
];
const drawHeader = (yy) =>
  drawTableRow(doc, left, yy, columns, headerLabels, { header: true, minHeight: 26 });

let y = doc.y;
y = drawHeader(y);

// Page 1 must hold everything, so rows never trigger a page break.
const page1Bottom = doc.page.height - doc.page.margins.bottom;
const ACC_H = 66;
const TOTAL_ROW_SPACE = 22 + 10 + ACC_H + 10;
const OVERFLOW_ROW_H = 20;

let totalPaid = 0;
let hiddenRows = 0;
mobiles.forEach((m, idx) => {
  const paid = getPaidAmount(m);
  totalPaid += paid;

  const rowValues = [
    idx + 1,
    m.mobile_name || "-",
    m.model || "-",
    m.imei || "-",
    m.issue || "-",
    formatDate(m.added_date),
    formatDate(m.delivery_date),
    formatWarranty(m),
    `${paid}`,
  ];

  const rowOpts = {
    fill: idx % 2 === 1 ? "#fafafa" : null,
    cellStyles: { 7: m.has_warranty ? { bold: true, color: "#166534" } : { color: "#888" } },
  };
  const isLast = idx === mobiles.length - 1;
  const reserve = TOTAL_ROW_SPACE + (isLast ? 0 : OVERFLOW_ROW_H);
  if (hiddenRows > 0 || y + measureTableRow(doc, columns, rowValues, rowOpts).rowH + reserve > page1Bottom) {
    hiddenRows += 1;
    return;
  }

  y = drawTableRow(doc, left, y, columns, rowValues, rowOpts);
});

if (hiddenRows > 0) {
  const tableWidth = columns.reduce((s, c) => s + c.width, 0);
  doc.lineWidth(0.5).rect(left, y, tableWidth, OVERFLOW_ROW_H).stroke("#555");
  doc.fillColor("#555").font("Helvetica-Oblique").fontSize(8);
  doc.text(`+ ${hiddenRows} more device(s) on this bill (included in total)`, left + PAD, y + 6, {
    width: tableWidth - PAD * 2,
    lineBreak: false,
  });
  y += OVERFLOW_ROW_H;
}

// Total row (fillAndStroke keeps the border)
const lastW = columns[columns.length - 1].width;
const tableW = columns.reduce((s, c) => s + c.width, 0);   // new
const labelW = tableW - lastW;
//const labelW = pageWidth - lastW;
doc.lineWidth(0.6);
doc.rect(left, y, labelW, 22).fillAndStroke("#f0f0f0", "#555");
doc.rect(left + labelW, y, lastW, 22).fillAndStroke("#f0f0f0", "#555");
doc.moveTo(left, y).lineTo(left + tableW, y).lineWidth(1.5).strokeColor("#333").stroke();
doc.fillColor("#111").font("Helvetica-Bold").fontSize(9);
doc.text("Total Amount", left, y + 7, { width: labelW - 6, align: "right", lineBreak: false });
doc.text(`${totalPaid}`, left + labelW, y + 7, { width: lastW - 6, align: "right", lineBreak: false });
y += 22 + 10;

drawAccessoriesAndNotes(doc, left, y, pageWidth, ACC_H);
y += ACC_H + 10;
doc.y = y;

      // Mobile Photos (page 1) — layout is sized to the space left above the bottom margin
      const SECTION_HEAD_H = 22;
      const LABEL_H = 20; // mobile label line + Front/Back captions
      const BOX_GAP = 6;
      const CELL_GAP_X = 12;
      const CELL_GAP_Y = 8;
      const MAX_BOX_H = 170;
      const MIN_BOX_H = 40;
      const ASPECT = 3 / 4; // portrait phone photo, width / height

      const gridTop = y + SECTION_HEAD_H;
      const availH = page1Bottom - gridTop;
      const n = mobiles.length;

      if (n > 0 && availH >= LABEL_H + MIN_BOX_H) {
        doc.moveTo(left, y).lineTo(left + pageWidth, y).lineWidth(0.5).strokeColor("#ddd").stroke();
        doc.font("Helvetica-Bold").fontSize(11).fillColor("#333").text("Mobile Photos", left, y + 6, { lineBreak: false });

        const boxHFor = (cols) => {
          const rows = Math.ceil(n / cols);
          const cellW = (pageWidth - (cols - 1) * CELL_GAP_X) / cols;
          const byWidth = ((cellW - BOX_GAP) / 2) / ASPECT;
          const byHeight = (availH - rows * LABEL_H - (rows - 1) * CELL_GAP_Y) / rows;
          return Math.min(byWidth, byHeight, MAX_BOX_H);
        };

        let cols = 1;
        let boxH = boxHFor(1);
        for (let c = 2; c <= n; c++) {
          const h = boxHFor(c);
          if (h > boxH) { boxH = h; cols = c; }
        }

        // Too many devices to fit every photo: keep a readable size and show as many as fit
        let shown = n;
        if (boxH < MIN_BOX_H) {
          boxH = MIN_BOX_H;
          const boxW = boxH * ASPECT;
          cols = Math.max(1, Math.floor((pageWidth + CELL_GAP_X) / (boxW * 2 + BOX_GAP + CELL_GAP_X)));
          const reserveNote = 12;
          const rowsFit = Math.max(0, Math.floor((availH - reserveNote + CELL_GAP_Y) / (LABEL_H + boxH + CELL_GAP_Y)));
          shown = Math.min(n, cols * rowsFit);
        }

        const boxW = boxH * ASPECT;
        const cellW = (pageWidth - (cols - 1) * CELL_GAP_X) / cols;
        const pairW = boxW * 2 + BOX_GAP;

        for (let i = 0; i < shown; i++) {
          const m = mobiles[i];
          const col = i % cols;
          const row = Math.floor(i / cols);
          const cx = left + col * (cellW + CELL_GAP_X);
          const cy = gridTop + row * (LABEL_H + boxH + CELL_GAP_Y);
          const bx = cx + (cellW - pairW) / 2;

          const name = [m.mobile_name, m.model].filter(Boolean).join(" ");
          doc.font("Helvetica-Bold").fontSize(8).fillColor("#111");
          doc.text(`Mobile ${i + 1}${name ? `: ${name}` : ""}`, cx, cy, { width: cellW, lineBreak: false, ellipsis: true });
          doc.font("Helvetica").fontSize(6.5).fillColor("#666");
          doc.text("Front", bx, cy + 11, { width: boxW, align: "center", lineBreak: false });
          doc.text("Back", bx + boxW + BOX_GAP, cy + 11, { width: boxW, align: "center", lineBreak: false });

          drawPhotoBox(doc, bx, cy + LABEL_H, boxW, boxH, photos[i]?.front, "Front Photo");
          drawPhotoBox(doc, bx + boxW + BOX_GAP, cy + LABEL_H, boxW, boxH, photos[i]?.back, "Back Photo");
        }

        if (shown < n) {
          doc.font("Helvetica-Oblique").fontSize(8).fillColor("#555");
          doc.text(`+ photos for ${n - shown} more device(s) not shown (not enough space)`, left, page1Bottom - 10, {
            width: pageWidth,
            lineBreak: false,
          });
        }
      }

      // Terms & Conditions always start on page 2
      doc.addPage();
      const termsBottom = doc.page.height - doc.page.margins.bottom;
      const termsTop = doc.page.margins.top;
      doc.moveTo(left, termsTop).lineTo(left + pageWidth, termsTop).lineWidth(0.75).strokeColor("#ddd").stroke();
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#333").text("Terms & Conditions:", left, termsTop + 6);
      doc.font("Helvetica").fontSize(9).fillColor("#555");
      const customTerms = stripTermsHeading(termsAndConditions);
      const termsText =
        customTerms.trim() !== ""
          ? customTerms
          : DEFAULT_TERMS_AND_CONDITIONS.map((line, idx) => `${idx + 1}. ${line}`).join("   ");
      const termsY = doc.y + 2;
      // height + ellipsis stop very long terms from spilling onto a third page
      doc.text(termsText, left, termsY, { width: pageWidth, height: termsBottom - termsY, ellipsis: true, lineGap: 5 });

      if (termsImages.length > 0) {
        drawTermsImagesSection(doc, left, pageWidth, doc.y + 12, termsImages);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateReceiptPdfBuffer };

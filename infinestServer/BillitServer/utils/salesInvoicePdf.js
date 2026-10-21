const PDFDocument = require("pdfkit");
const { loadShopProfile, registerFonts, FONT, RUPEE } = require("./receiptPdf");

// A4 tax invoice for a branch-portal sale (SalesServer `sales` document). Sent as the WhatsApp document
// and opened by the POS "A4" button. Header details come from the branch, then the owner's profile/shop.

const PAGE = { w: 595.28, h: 841.89, m: 40 };
const INNER_W = PAGE.w - PAGE.m * 2;
const BOTTOM = PAGE.h - 70; // keep clear of the footer
const C = {
  accent: "#1e3a8a",
  accentSoft: "#eef2ff",
  text: "#111827",
  muted: "#6b7280",
  line: "#d1d5db",
  zebra: "#f9fafb",
};

const GST_STATES = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand",
  "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya",
  "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "26": "Dadra & Nagar Haveli and Daman & Diu", "27": "Maharashtra", "29": "Karnataka", "30": "Goa",
  "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman & Nicobar Islands",
  "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh", "97": "Other Territory",
};

const TERMS = [
  "Goods once sold will not be taken back or exchanged.",
  "Warranty, where applicable, is as per the manufacturer's terms.",
  "Please keep this invoice for warranty and service claims.",
];

const num = (n) => Number(n) || 0;
const money = (n) => num(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rs = (n) => `${RUPEE} ${money(n)}`;
const stateFromGstin = (gstin) => {
  const code = String(gstin || "").trim().slice(0, 2);
  return GST_STATES[code] ? `${code}-${GST_STATES[code]}` : "";
};
const isPlaceholderImei = (v) => !String(v || "").trim() || /^0+$/.test(String(v).trim());
const formatDate = (d) => {
  const dt = new Date(d || Date.now());
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
};
const formatTime = (d) =>
  new Date(d || Date.now()).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

// 1234567 -> "Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven"
function inWordsIndian(n) {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
    "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (x) => (x < 20 ? ones[x] : `${tens[Math.floor(x / 10)]}${x % 10 ? ` ${ones[x % 10]}` : ""}`);
  const three = (x) => {
    const h = Math.floor(x / 100);
    const r = x % 100;
    return [h ? `${ones[h]} Hundred` : "", r ? two(r) : ""].filter(Boolean).join(" ");
  };
  if (n === 0) return "Zero";
  const parts = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  if (crore) parts.push(`${inWordsIndian(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (rest) parts.push(three(rest));
  return parts.join(" ");
}
function amountInWords(amount) {
  const rupees = Math.floor(num(amount));
  const paise = Math.round((num(amount) - rupees) * 100);
  return `Rupees ${inWordsIndian(rupees)}${paise ? ` and ${inWordsIndian(paise)} Paise` : ""} Only`;
}

// Branch first (that's what is printed on the thermal receipt), then the owner's profile and shop
async function resolveSeller({ shop, branch }) {
  const profile = await loadShopProfile(shop);
  const location = /^location not set$/i.test(String(shop?.location || "").trim()) ? "" : shop?.location;
  const gstin = branch?.gstNo || "";
  return {
    name: branch?.name || profile.name || shop?.shop_name || "",
    address: branch?.address || profile.address || shop?.address || location || "",
    phone: branch?.phoneNumber || profile.phone || shop?.phone || "",
    email: shop?.email || profile.email || branch?.email || "",
    gstin,
    state: stateFromGstin(gstin),
    logo: profile.logo || null,
  };
}

function itemLines(item) {
  const imeis = (Array.isArray(item.imes) ? item.imes : []).filter((v) => !isPlaceholderImei(v));
  const lines = [];
  if (item.productNo) lines.push(`Code: ${item.productNo}`);
  if (imeis.length) lines.push(`IMEI: ${imeis.join(", ")}`);
  return lines;
}

function generateSalesInvoicePdfBuffer({ sale, shop, branch }) {
  return new Promise(async (resolve, reject) => {
    try {
      const seller = await resolveSeller({ shop, branch });
      const doc = new PDFDocument({ size: "A4", margin: PAGE.m, bufferPages: true, info: { Title: `Tax Invoice ${sale.invoiceNo || ""}`.trim() } });
      registerFonts(doc);
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const L = PAGE.m;
      const R = PAGE.w - PAGE.m;
      const invoiceNo = sale.invoiceNo ? String(sale.invoiceNo) : String(sale._id).slice(-6).toUpperCase();

      // ── Header band ───────────────────────────────────────────────
      doc.rect(0, 0, PAGE.w, 6).fill(C.accent);
      let y = 30;
      let textX = L;
      if (seller.logo) {
        try {
          doc.image(seller.logo, L, y, { fit: [60, 60], align: "center", valign: "center" });
          textX = L + 72;
        } catch (_) { /* unreadable logo: skip it */ }
      }
      const leftW = 300 - (textX - L);
      doc.font(FONT.bold).fontSize(17).fillColor(C.text).text(String(seller.name || "Tax Invoice").toUpperCase(), textX, y, { width: leftW });
      doc.font(FONT.regular).fontSize(8.5).fillColor(C.muted);
      const contact = [
        seller.address,
        [seller.phone && `Ph: ${seller.phone}`, seller.email].filter(Boolean).join("  |  "),
        [seller.gstin && `GSTIN: ${seller.gstin}`, seller.state && `State: ${seller.state}`].filter(Boolean).join("  |  "),
      ].filter(Boolean);
      contact.forEach((line) => doc.text(line, textX, doc.y + 2, { width: leftW }));
      const headerBottom = Math.max(doc.y, seller.logo ? y + 60 : 0);

      doc.font(FONT.bold).fontSize(22).fillColor(C.accent).text("TAX INVOICE", L + 300, y - 2, { width: INNER_W - 300, align: "right" });
      doc.font(FONT.regular).fontSize(9).fillColor(C.muted).text("Original for Recipient", L + 300, doc.y, { width: INNER_W - 300, align: "right" });
      doc.font(FONT.bold).fontSize(10).fillColor(C.text).text(`Invoice No. ${invoiceNo}`, L + 300, doc.y + 8, { width: INNER_W - 300, align: "right" });
      doc.font(FONT.regular).fontSize(9).fillColor(C.muted).text(`${formatDate(sale.createdAt)}, ${formatTime(sale.createdAt)}`, L + 300, doc.y + 2, { width: INNER_W - 300, align: "right" });

      y = Math.max(headerBottom, doc.y) + 14;
      doc.moveTo(L, y).lineTo(R, y).lineWidth(1).strokeColor(C.line).stroke();
      y += 12;

      // ── Bill to / invoice details ─────────────────────────────────
      const colW = (INNER_W - 12) / 2;
      const boxTop = y;
      const boxH = 74;
      [L, L + colW + 12].forEach((x) => doc.roundedRect(x, boxTop, colW, boxH, 6).fillAndStroke(C.accentSoft, C.accentSoft));
      const label = (t, x, yy) => doc.font(FONT.bold).fontSize(8).fillColor(C.accent).text(t, x, yy, { characterSpacing: 0.8 });
      label("BILL TO", L + 12, boxTop + 10);
      doc.font(FONT.bold).fontSize(11).fillColor(C.text).text(sale.customerName || "Walk-in Customer", L + 12, boxTop + 24, { width: colW - 24 });
      if (sale.customerNo) doc.font(FONT.regular).fontSize(9).fillColor(C.muted).text(`Phone: ${sale.customerNo}`, L + 12, doc.y + 3, { width: colW - 24 });

      const dx = L + colW + 24;
      label("INVOICE DETAILS", dx, boxTop + 10);
      const detail = (k, v, yy) => {
        doc.font(FONT.regular).fontSize(9).fillColor(C.muted).text(k, dx, yy, { width: 90 });
        doc.font(FONT.bold).fontSize(9).fillColor(C.text).text(v, dx + 92, yy, { width: colW - 116 });
      };
      detail("Invoice Date", formatDate(sale.createdAt), boxTop + 24);
      detail("Payment", sale.paymentMethod || "-", boxTop + 38);
      detail("Sales Executive", sale.employee_name ? `${sale.employee_name} (${sale.employee_code})` : "-", boxTop + 52);
      y = boxTop + boxH + 18;

      // ── Items table ───────────────────────────────────────────────
      const cols = [
        { key: "#", w: 26, align: "center" },
        { key: "Item", w: 225, align: "left" },
        { key: "HSN", w: 58, align: "center" },
        { key: "Qty", w: 40, align: "center" },
        { key: "Rate", w: 83, align: "right" },
        { key: "Amount", w: INNER_W - 26 - 225 - 58 - 40 - 83, align: "right" },
      ];
      const PAD = 7;
      const drawHead = () => {
        doc.rect(L, y, INNER_W, 22).fill(C.accent);
        let x = L;
        doc.font(FONT.bold).fontSize(8.5).fillColor("#fff");
        cols.forEach((c) => {
          doc.text(c.key.toUpperCase(), x + PAD, y + 7, { width: c.w - PAD * 2, align: c.align, lineBreak: false });
          x += c.w;
        });
        y += 22;
      };
      drawHead();

      const items = Array.isArray(sale.items) ? sale.items : [];
      items.forEach((it, idx) => {
        const qty = num(it.qty);
        const rate = num(it.sellingPrice);
        const amount = num(it.lineTotal) || qty * rate;
        const subs = itemLines(it);
        doc.font(FONT.bold).fontSize(9.5);
        const nameH = doc.heightOfString(it.productName || it.productNo || "Item", { width: cols[1].w - PAD * 2 });
        doc.font(FONT.regular).fontSize(8);
        const subH = subs.reduce((h, s) => h + doc.heightOfString(s, { width: cols[1].w - PAD * 2 }) + 1, 0);
        const rowH = Math.max(24, nameH + subH + 12);
        if (y + rowH > BOTTOM) {
          doc.addPage();
          y = PAGE.m;
          drawHead();
        }
        if (idx % 2 === 1) doc.rect(L, y, INNER_W, rowH).fill(C.zebra);
        let x = L;
        const cell = (text, c, opts = {}) => {
          doc.font(opts.bold ? FONT.bold : FONT.regular).fontSize(9).fillColor(C.text)
            .text(text, x + PAD, y + 7, { width: c.w - PAD * 2, align: c.align });
        };
        cell(String(idx + 1), cols[0]); x += cols[0].w;
        doc.font(FONT.bold).fontSize(9.5).fillColor(C.text).text(it.productName || it.productNo || "Item", x + PAD, y + 6, { width: cols[1].w - PAD * 2 });
        doc.font(FONT.regular).fontSize(8).fillColor(C.muted);
        subs.forEach((s) => doc.text(s, x + PAD, doc.y + 1, { width: cols[1].w - PAD * 2 }));
        x += cols[1].w;
        cell(it.hsn || "-", cols[2]); x += cols[2].w;
        cell(String(qty), cols[3]); x += cols[3].w;
        cell(money(rate), cols[4]); x += cols[4].w;
        cell(money(amount), cols[5], { bold: true });
        y += rowH;
        doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor(C.line).stroke();
      });

      // ── Totals and payment ────────────────────────────────────────
      const subTotal = num(sale.subTotal) || items.reduce((s, it) => s + num(it.qty) * num(it.sellingPrice), 0);
      const total = num(sale.totalAmount) || subTotal;
      const splits = Array.isArray(sale.paymentSplits) ? sale.paymentSplits.filter((p) => num(p.amount) > 0) : [];
      const received = splits.length ? splits.reduce((s, p) => s + num(p.amount), 0) : num(sale.amountPaid) || total;
      const balance = Math.max(0, total - received);
      const totalQty = items.reduce((s, it) => s + num(it.qty), 0);

      const rows = [["Sub Total", rs(subTotal)]];
      if (num(sale.discountAmount) > 0) rows.push([`Discount${num(sale.discount) ? ` (${num(sale.discount)}%)` : ""}`, `- ${rs(sale.discountAmount)}`]);
      if (num(sale.discountAmount) > 0 || num(sale.cgstAmount) + num(sale.sgstAmount) + num(sale.igstAmount) > 0) {
        rows.push(["Taxable Amount", rs(num(sale.taxableAmount) || subTotal - num(sale.discountAmount))]);
      }
      if (num(sale.cgstAmount) > 0) rows.push([`CGST @ ${num(sale.cgst)}%`, rs(sale.cgstAmount)]);
      if (num(sale.sgstAmount) > 0) rows.push([`SGST @ ${num(sale.sgst)}%`, rs(sale.sgstAmount)]);
      if (num(sale.igstAmount) > 0) rows.push([`IGST @ ${num(sale.igst)}%`, rs(sale.igstAmount)]);

      const blockH = 26 + rows.length * 18 + 30 + 40 + 60;
      if (y + blockH > BOTTOM) {
        doc.addPage();
        y = PAGE.m;
      }
      y += 14;
      const totW = 220;
      const totX = R - totW;
      const leftBlockW = INNER_W - totW - 20;
      const startY = y;

      // Left: quantity, amount in words, payment received
      doc.font(FONT.regular).fontSize(9).fillColor(C.muted).text(`Total items: ${items.length}   |   Total quantity: ${totalQty}`, L, y, { width: leftBlockW });
      label("AMOUNT IN WORDS", L, doc.y + 10);
      doc.font(FONT.bold).fontSize(9.5).fillColor(C.text).text(amountInWords(total), L, doc.y + 3, { width: leftBlockW });
      label("PAYMENT RECEIVED", L, doc.y + 12);
      const payLines = splits.length ? splits.map((p) => [p.method, rs(p.amount)]) : [[sale.paymentMethod || "Payment", rs(received)]];
      payLines.forEach(([m, v]) => {
        const py = doc.y + 4;
        doc.font(FONT.regular).fontSize(9).fillColor(C.text).text(m, L, py, { width: 110 });
        doc.font(FONT.bold).fontSize(9).text(v, L + 110, py, { width: 110, align: "right" });
      });
      const leftBottom = doc.y;

      // Right: totals
      rows.forEach(([k, v]) => {
        doc.font(FONT.regular).fontSize(9.5).fillColor(C.muted).text(k, totX, y, { width: totW * 0.55 });
        doc.font(FONT.regular).fontSize(9.5).fillColor(C.text).text(v, totX + totW * 0.45, y, { width: totW * 0.55, align: "right" });
        y += 18;
      });
      doc.roundedRect(totX, y, totW, 28, 5).fill(C.accent);
      doc.font(FONT.bold).fontSize(11).fillColor("#fff").text("Grand Total", totX + 10, y + 8, { width: totW * 0.5 });
      doc.text(rs(total), totX + totW * 0.4, y + 8, { width: totW * 0.6 - 10, align: "right" });
      y += 36;
      [["Received", rs(received)], ["Balance", rs(balance)]].forEach(([k, v]) => {
        doc.font(FONT.regular).fontSize(9.5).fillColor(C.muted).text(k, totX, y, { width: totW * 0.55 });
        doc.font(FONT.bold).fontSize(9.5).fillColor(k === "Balance" && balance > 0 ? "#b91c1c" : C.text)
          .text(v, totX + totW * 0.45, y, { width: totW * 0.55, align: "right" });
        y += 18;
      });

      // ── Terms and signature ───────────────────────────────────────
      y = Math.max(y, leftBottom) + 22;
      if (y + 90 > BOTTOM) {
        doc.addPage();
        y = PAGE.m;
      }
      doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor(C.line).stroke();
      y += 12;
      label("TERMS & CONDITIONS", L, y);
      doc.font(FONT.regular).fontSize(8.5).fillColor(C.muted);
      TERMS.forEach((t, i) => doc.text(`${i + 1}. ${t}`, L, doc.y + 3, { width: leftBlockW }));
      doc.font(FONT.regular).fontSize(9).fillColor(C.text).text(`For ${seller.name || "the seller"}`, totX, y, { width: totW, align: "right" });
      doc.moveTo(totX + 60, y + 52).lineTo(R, y + 52).lineWidth(0.7).strokeColor(C.text).stroke();
      doc.font(FONT.regular).fontSize(8.5).fillColor(C.muted).text("Authorised Signatory", totX, y + 56, { width: totW, align: "right" });

      // ── Footer on every page ──────────────────────────────────────
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.page.margins.bottom = 0; // footer sits in the bottom margin; don't let it spill onto a new page
        const fy = PAGE.h - 48;
        doc.moveTo(L, fy).lineTo(R, fy).lineWidth(0.5).strokeColor(C.line).stroke();
        doc.font(FONT.bold).fontSize(9).fillColor(C.accent).text("Thank you for doing business with us!", L, fy + 8, { width: INNER_W, align: "center", lineBreak: false });
        doc.font(FONT.regular).fontSize(7.5).fillColor(C.muted)
          .text(`This is a computer-generated invoice.   Page ${i - range.start + 1} of ${range.count}`, L, fy + 22, { width: INNER_W, align: "center", lineBreak: false });
        doc.rect(0, PAGE.h - 6, PAGE.w, 6).fill(C.accent);
      }
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateSalesInvoicePdfBuffer, amountInWords };

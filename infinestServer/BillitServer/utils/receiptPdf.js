const PDFDocument = require("pdfkit");

const DEFAULT_TERMS_AND_CONDITIONS = [
  "No guarantee for liquid / water damage.",
  "Collect your device within 30 days of completion.",
  "We are not responsible for any data loss.",
  "Advance payment required before ordering parts.",
];

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";

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

// Draws a table row with fixed column widths, wrapping text within each cell.
function drawTableRow(doc, x, y, columns, values, { header = false, height = 20 } = {}) {
  doc.lineWidth(0.5).strokeColor("#555");
  if (header) doc.rect(x, y, columns.reduce((s, c) => s + c.width, 0), height).fill("#f0f0f0");
  doc.fillColor(header ? "#111" : "#222").font(header ? "Helvetica-Bold" : "Helvetica").fontSize(header ? 8 : 7.5);

  let cx = x;
  columns.forEach((col, idx) => {
    doc.rect(cx, y, col.width, height).stroke();
    doc.text(String(values[idx] ?? ""), cx + 3, y + height / 2 - 4, {
      width: col.width - 6,
      align: col.align || "left",
      ellipsis: true,
    });
    cx += col.width;
  });
  return y + height;
}

// Generates the A4 service receipt/invoice PDF and resolves with a Buffer.
function generateReceiptPdfBuffer({ shop, client, mobiles, billNo, termsAndConditions }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 40 });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const left = doc.page.margins.left;
      const shopName = (shop?.shop_name || shop?.owner_name || "MOBILE SERVICE CENTER").toUpperCase();

      // Header
      doc.font("Helvetica-Bold").fontSize(20).fillColor("#8B4513").text(shopName, left, doc.y, {
        width: pageWidth,
        align: "center",
      });
      doc.font("Helvetica").fontSize(10).fillColor("#555");
      doc.text(shop?.address || "Address Not Provided", { width: pageWidth, align: "center" });
      const contactLine = `Ph: ${shop?.phone || "N/A"}${
        shop?.email && shop.email.trim() !== "" ? `  |  Email: ${shop.email}` : ""
      }`;
      doc.text(contactLine, { width: pageWidth, align: "center" });
      doc.moveDown(0.4);
      doc
        .moveTo(left, doc.y)
        .lineTo(left + pageWidth, doc.y)
        .lineWidth(2)
        .strokeColor("#222")
        .stroke();
      doc.moveDown(0.6);

      // Title bar
      const titleY = doc.y;
      doc.rect(left, titleY, pageWidth, 22).fill("#222");
      doc
        .fillColor("#fff")
        .font("Helvetica-Bold")
        .fontSize(12)
        .text("SERVICE RECEIPT / JOB CARD", left, titleY + 6, { width: pageWidth, align: "center" });
      doc.y = titleY + 22 + 10;

      // Bill info row
      const infoY = doc.y;
      doc.fillColor("#111").font("Helvetica").fontSize(10);
      doc.text(`Customer Name: ${client?.client_name || ""}`, left, infoY);
      doc.text(`Phone / Mobile: ${client?.mobile_number || ""}`, left, infoY + 14);

      doc.font("Helvetica-Bold").fontSize(11).fillColor("#8B4513");
      doc.text(`Bill No: ${billNo || "N/A"}`, left, infoY, { width: pageWidth, align: "right" });
      doc.font("Helvetica").fontSize(9).fillColor("#555");
      doc.text(`Date: ${formatDate(new Date())}`, left, infoY + 16, { width: pageWidth, align: "right" });

      doc.y = infoY + 36;
      doc.moveDown(0.4);

      // Devices table
      const columns = [
        { key: "#", width: 20, align: "center" },
        { key: "Make", width: 62 },
        { key: "Model", width: 55 },
        { key: "IMEI", width: 75 },
        { key: "Issue", width: 95 },
        { key: "Added", width: 50 },
        { key: "Delivered", width: 50 },
        { key: "Warranty", width: 68 },
        { key: "Amount", width: 40, align: "right" },
      ];

      let y = doc.y;
      y = drawTableRow(
        doc,
        left,
        y,
        columns,
        ["#", "Mobile Make", "Model", "IMEI No.", "Complaint", "Added", "Delivery", "Warranty", "Amt (\u20b9)"],
        { header: true }
      );

      let totalPaid = 0;
      mobiles.forEach((m, idx) => {
        const paid = getPaidAmount(m);
        totalPaid += paid;
        // Start a new page if we're near the bottom margin
        if (y > doc.page.height - doc.page.margins.bottom - 60) {
          doc.addPage();
          y = doc.page.margins.top;
        }
        y = drawTableRow(doc, left, y, columns, [
          idx + 1,
          m.mobile_name || "-",
          m.model || "-",
          m.imei || "-",
          m.issue || "-",
          formatDate(m.added_date),
          formatDate(m.delivery_date),
          formatWarranty(m),
          `\u20b9${paid}`,
        ]);
      });

      // Total row
      const totalRowWidth = columns.slice(0, -1).reduce((s, c) => s + c.width, 0);
      doc.rect(left, y, totalRowWidth, 20).fill("#f0f0f0").stroke();
      doc.rect(left + totalRowWidth, y, columns[columns.length - 1].width, 20).fill("#f0f0f0").stroke();
      doc
        .fillColor("#111")
        .font("Helvetica-Bold")
        .fontSize(9)
        .text("Total Amount", left, y + 6, { width: totalRowWidth - 6, align: "right" });
      doc.text(`\u20b9${totalPaid}`, left + totalRowWidth, y + 6, {
        width: columns[columns.length - 1].width - 6,
        align: "right",
      });
      y += 30;
      doc.y = y;

      // Terms & Conditions
      doc.moveDown(0.6);
      doc
        .moveTo(left, doc.y)
        .lineTo(left + pageWidth, doc.y)
        .lineWidth(0.5)
        .strokeColor("#ddd")
        .stroke();
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#333").text("Terms & Conditions:", left, doc.y);
      doc.font("Helvetica").fontSize(10).fillColor("#555");
      if (termsAndConditions && termsAndConditions.trim() !== "") {
        doc.text(termsAndConditions, left, doc.y + 2, { width: pageWidth });
      } else {
        doc.text(
          DEFAULT_TERMS_AND_CONDITIONS.map((line, idx) => `${idx + 1}. ${line}`).join("   "),
          left,
          doc.y + 2,
          { width: pageWidth }
        );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateReceiptPdfBuffer };

const crypto = require("crypto");

// Sales invoice PDFs are public (MSG91 downloads them for the WhatsApp document header), so each link
// carries an HMAC of the sale id. SalesServer signs the same way (utils/salesInvoiceLink.js there).
function salesInvoiceSig(saleId) {
  return crypto
    .createHmac("sha256", process.env.INTERNAL_API_KEY || "")
    .update(`sales-invoice:${saleId}`)
    .digest("hex")
    .slice(0, 32);
}

function isValidSalesInvoiceSig(saleId, sig) {
  const expected = Buffer.from(salesInvoiceSig(saleId));
  const given = Buffer.from(String(sig || ""));
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

function salesInvoiceUrl(saleId) {
  const base = String(process.env.BILLIT_BACKEND_URL || "").replace(/\/+$/, "");
  return base ? `${base}/api/sales-invoice/pdf/${saleId}?sig=${salesInvoiceSig(saleId)}` : "";
}

module.exports = { salesInvoiceSig, isValidSalesInvoiceSig, salesInvoiceUrl };

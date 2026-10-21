const crypto = require('crypto');

// Signed public link to the A4 sales invoice PDF rendered by BillitServer (GET /api/sales-invoice/pdf/:id).
// Same HMAC as BillitServer utils/salesInvoiceLink.js; both services share INTERNAL_API_KEY.
const billitBaseUrl = () => String(process.env.BILLIT_BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

function salesInvoiceSig(saleId) {
  return crypto.createHmac('sha256', process.env.INTERNAL_API_KEY || '').update(`sales-invoice:${saleId}`).digest('hex').slice(0, 32);
}

function salesInvoiceUrl(saleId) {
  return `${billitBaseUrl()}/api/sales-invoice/pdf/${saleId}?sig=${salesInvoiceSig(saleId)}`;
}

module.exports = { billitBaseUrl, salesInvoiceUrl };

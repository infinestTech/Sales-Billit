const axios = require('axios').create({ family: 4, timeout: 20000 });
const Sale = require('../models/sale');
const Shop = require('../models/shop');
const { billitBaseUrl, salesInvoiceUrl } = require('../utils/salesInvoiceLink');

// WhatsApp billing for branch-portal sales. The PDF and the MSG91 send live in BillitServer (shared with the
// Service app's receipts); the admin turns it on per shop (Shop.whatsapp.enabled + whatsapp.events.sales_bill).

async function findOwnSale(req) {
  const id = String(req.params.id || '');
  if (!/^[0-9a-fA-F]{24}$/.test(id)) return null;
  const q = { _id: id, shop_id: req.user.shop_id };
  if (req.user.isBranch && req.user.branch_id) q.branch_id = req.user.branch_id;
  return Sale.findOne(q).select('_id invoiceNo customerNo').lean();
}

// GET /api/sales/whatsapp-config -> { enabled } — whether the POS should send bills via WhatsApp (MSG91)
exports.getWhatsappConfig = async (req, res) => {
  try {
    const shop = await Shop.findById(req.user.shop_id).select('whatsapp').lean();
    const wa = (shop && shop.whatsapp) || {};
    return res.json({ success: true, enabled: !!wa.enabled && !!(wa.events && wa.events.sales_bill === true) });
  } catch (err) {
    console.error('whatsapp-config error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/sales/:id/invoice-link -> { url } — the A4 invoice PDF (POS "A4" button)
exports.getInvoiceLink = async (req, res) => {
  try {
    const sale = await findOwnSale(req);
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });
    // BillitServer signs the link with its public URL (SalesServer's BILLIT_BACKEND_URL may be an internal
    // address such as 127.0.0.1, which the browser can't open). Falls back to the local builder in dev.
    let url = '';
    try {
      const { data } = await axios.get(`${billitBaseUrl()}/api/internal/sales-invoice/link/${sale._id}`, {
        headers: { 'x-internal-key': process.env.INTERNAL_API_KEY || '' },
        timeout: 8000,
      });
      url = (data && data.url) || '';
    } catch (e) {
      console.error('invoice-link via BillitServer failed:', e.message || e);
    }
    return res.json({ success: true, url: url || salesInvoiceUrl(String(sale._id)) });
  } catch (err) {
    console.error('invoice-link error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/sales/:id/whatsapp — sends the invoice PDF to the sale's customer number
exports.sendSaleWhatsapp = async (req, res) => {
  try {
    const sale = await findOwnSale(req);
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });
    if (!sale.customerNo) return res.status(400).json({ success: false, message: 'This sale has no customer mobile number' });
    const { data } = await axios.post(
      `${billitBaseUrl()}/api/internal/sales-bill/whatsapp`,
      { saleId: String(sale._id), shopId: String(req.user.shop_id) },
      { headers: { 'x-internal-key': process.env.INTERNAL_API_KEY || '' } }
    );
    return res.json({ success: true, status: data.status || 'sent' });
  } catch (err) {
    const status = err.response ? err.response.status : 502;
    const message = (err.response && err.response.data && (err.response.data.error || err.response.data.message))
      || 'Could not reach the WhatsApp billing service. Please try again.';
    if (!err.response) console.error('sale whatsapp error:', err.message || err);
    return res.status(status).json({ success: false, message });
  }
};

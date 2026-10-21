const express = require('express');
const router = express.Router();
const requireUser = require('../middleware/requireUser');
const { createSale, listSales } = require('../controllers/saleController');
const { getWhatsappConfig, getInvoiceLink, sendSaleWhatsapp } = require('../controllers/saleWhatsappController');

router.get('/api/sales', requireUser, listSales);
router.post('/api/sales', requireUser, createSale);
// A4 invoice PDF + WhatsApp billing (MSG91 via BillitServer)
router.get('/api/sales/whatsapp-config', requireUser, getWhatsappConfig);
router.get('/api/sales/:id/invoice-link', requireUser, getInvoiceLink);
router.post('/api/sales/:id/whatsapp', requireUser, sendSaleWhatsapp);

module.exports = router;

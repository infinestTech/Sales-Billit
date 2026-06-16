const express = require('express');
const router = express.Router();
const requireUser = require('../middleware/requireUser');
const { createWhatsappSale, listWhatsappSales } = require('../controllers/whatsappSaleController');

router.post('/api/whatsapp-sales', requireUser, createWhatsappSale);
router.get('/api/whatsapp-sales', requireUser, listWhatsappSales);

module.exports = router;

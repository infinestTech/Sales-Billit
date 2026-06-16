const express = require('express');
const router = express.Router();
const requireUser = require('../middleware/requireUser');
const { createWhatsappStock, listWhatsappStock } = require('../controllers/whatsappStockController');

router.post('/api/whatsapp-stock', requireUser, createWhatsappStock);
router.get('/api/whatsapp-stock', requireUser, listWhatsappStock);

module.exports = router;

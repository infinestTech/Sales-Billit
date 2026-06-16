const express = require('express');
const router = express.Router();
const requireUser = require('../middleware/requireUser');
const { createSale, listSales } = require('../controllers/saleController');

router.get('/api/sales', requireUser, listSales);
router.post('/api/sales', requireUser, createSale);

module.exports = router;

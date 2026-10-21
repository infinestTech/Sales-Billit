const express = require('express');
const router = express.Router();
const requireUser = require('../middleware/requireUser');
const ctrl = require('../controllers/dealerLedgerController');

// Dealer credit book (branch portal "Dealer Credits"): balances, statement and day-by-day payments
router.get('/api/dealer-ledger', requireUser, ctrl.summary);
router.get('/api/dealer-ledger/:supplierId', requireUser, ctrl.ledger);
router.post('/api/dealer-ledger/:supplierId/pay', requireUser, ctrl.pay);

module.exports = router;

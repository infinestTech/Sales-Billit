const express = require('express');
const router = express.Router();
const requireUser = require('../middleware/requireUser');
const { listTransactions } = require('../controllers/bankTransactionController');

router.get('/api/bank-transactions', requireUser, listTransactions);

module.exports = router;

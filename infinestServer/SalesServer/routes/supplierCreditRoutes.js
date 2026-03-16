const express = require('express');
const router = express.Router();
const auth = require('../middleware/requireUser');
const ctrl = require('../controllers/supplierCreditController');

router.get('/api/supplier-credits', auth, ctrl.listCredits);
router.get('/api/supplier-credits/summary', auth, ctrl.creditSummary);
router.post('/api/supplier-credits/:id/pay', auth, ctrl.recordPayment);

module.exports = router;

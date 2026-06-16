const express = require('express');
const router = express.Router();
const requireUser = require('../middleware/requireUser');
const controller = require('../controllers/secondsSalesController');

router.post('/api/seconds-sales', requireUser, controller.create);
router.get('/api/seconds-sales', requireUser, controller.list);
router.post('/api/seconds-sales/:id/purchase', requireUser, controller.createPurchase);

module.exports = router;

const express = require('express');
const router = express.Router();
const requireUser = require('../middleware/requireUser');
const { createSupplier, listSuppliers } = require('../controllers/supplierController');

router.post('/api/suppliers', requireUser, createSupplier);
router.get('/api/suppliers', requireUser, listSuppliers);

module.exports = router;

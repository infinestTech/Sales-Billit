const { Router } = require('express');
const { createBank, listBanks } = require('../controllers/bankController');
const requireUser = require('../middleware/requireUser');

const router = Router();

router.post('/api/banks', requireUser, createBank);
router.get('/api/banks', requireUser, listBanks);

module.exports = router;

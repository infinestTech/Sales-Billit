const express = require('express');
const router = express.Router();
const requireUser = require('../middleware/requireUser');
const { createContact, listContacts } = require('../controllers/whatsappContactController');

router.post('/api/whatsapp-contacts', requireUser, createContact);
router.get('/api/whatsapp-contacts', requireUser, listContacts);

module.exports = router;

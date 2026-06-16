const express = require('express');
const router = express.Router();
const requireUser = require('../middleware/requireUser');
const { getMysqlUser } = require('../controllers/mysqlUserController');

router.post('/api/mysql-user', requireUser, getMysqlUser);

module.exports = router;

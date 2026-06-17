const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/attendance.controller');

// Punch (software portal or ESSL passthrough)
router.post('/punch',                 ctrl.punch);

// ESSL device bulk import
router.post('/essl/import',           ctrl.importEssl);

// Manual override (leave, holiday, etc.)
router.post('/manual',                ctrl.markManual);

// Queries
router.get('/daily',                  ctrl.getAttendanceByDate);    // ?date=&shopId=
router.get('/report',                 ctrl.getAttendanceReport);    // ?shopId=&month=&year=
router.get('/:employeeId/monthly',    ctrl.getEmployeeAttendance);  // ?month=&year=

module.exports = router;

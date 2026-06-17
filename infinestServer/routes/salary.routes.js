const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/salary.controller');

// Generation
router.post('/generate',              ctrl.generateSalary);       // single employee
router.post('/generate-bulk',         ctrl.generateBulkSalary);  // all employees in shop

// Reports
router.get('/report',                 ctrl.getSalaryReport);      // ?shopId=&month=&year=

// Per-employee record & lifecycle
router.get('/:employeeId',            ctrl.getSalaryRecord);      // ?month=&year=
router.patch('/:employeeId/finalize', ctrl.finalizeSalary);
router.patch('/:employeeId/mark-paid', ctrl.markSalaryPaid);

module.exports = router;

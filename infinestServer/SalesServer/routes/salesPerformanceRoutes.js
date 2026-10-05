const express = require('express');
const router = express.Router();
const requireUser = require('../middleware/requireUser');
const requireInternalKey = require('../middleware/requireInternalKey');
const employees = require('../controllers/employeeController');
const analytics = require('../controllers/salesAnalyticsController');

// Salesperson lookup for the POS and report filters (HR employees live in BillitServer)
router.get('/api/employees/lookup', requireUser, employees.lookupEmployee);
router.get('/api/employees/pos-config', requireUser, employees.posConfig);
router.get('/api/employees', requireUser, employees.listEmployees);

// Sales analytics: ?from=YYYY-MM-DD&to=YYYY-MM-DD[&branch_id=] (branch tokens see only their branch)
router.get('/api/sales-analytics/summary', requireUser, analytics.summary);
router.get('/api/sales-analytics/employees/:employeeId', requireUser, analytics.employeeDetail);

// Server-to-server (BillitServer)
router.get('/internal/sales-analytics/summary', requireInternalKey, analytics.internalSummary);
router.get('/internal/sales-analytics/employee', requireInternalKey, analytics.internalEmployeeDetail);

module.exports = router;

'use strict';
/**
 * HR Routes  — mounted at /api/shop-admin/hr
 * All routes require shopAdminAuth (enforced via the shopAdminRoutes middleware pattern).
 */

const express = require('express');
const router = express.Router();
const {
  listEmployees, createEmployee, updateEmployee, deactivateEmployee, reactivateEmployee,
  softwarePunch, manualMark, getDailyAttendance, getMonthlyAttendance, getAttendanceReport,
  generateSalary, generateBulkSalary, getSalaryReport, getSalaryRecord, finalizeSalary, markSalaryPaid,
} = require('../controllers/hrController');

// ── Employee CRUD ─────────────────────────────────────────────────────────────
router.get('/employees',                      listEmployees);
router.post('/employees',                     createEmployee);
router.put('/employees/:id',                  updateEmployee);
router.patch('/employees/:id/deactivate',     deactivateEmployee);
router.patch('/employees/:id/reactivate',     reactivateEmployee);

// ── Attendance ────────────────────────────────────────────────────────────────
router.get('/attendance/daily',               getDailyAttendance);
router.post('/attendance/punch',              softwarePunch);
router.get('/attendance/report',              getAttendanceReport);
router.post('/attendance/manual',             manualMark);
router.get('/attendance/:id/monthly',         getMonthlyAttendance);

// ── Salary ────────────────────────────────────────────────────────────────────
router.get('/salary/report',                  getSalaryReport);
router.post('/salary/generate',               generateSalary);
router.post('/salary/generate-bulk',          generateBulkSalary);
router.patch('/salary/:id/finalize',          finalizeSalary);
router.patch('/salary/:id/mark-paid',         markSalaryPaid);
router.get('/salary/:id',                     getSalaryRecord);

module.exports = router;

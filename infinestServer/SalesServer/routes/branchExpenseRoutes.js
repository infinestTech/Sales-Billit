const express = require('express');
const router = express.Router();
const requireUser = require('../middleware/requireUser');
const { createBranchExpense, listExpensesForShop } = require('../controllers/branchExpenseController');

// Create expense (branch or admin)
router.post('/api/branch-expenses', requireUser, createBranchExpense);

// List expenses (admin view) - optional query ?branch_id=
router.get('/api/branch-expenses', requireUser, listExpensesForShop);

// Summary endpoint: GET /api/branch-expense-summary?date=YYYY-MM-DD or ?start=&end=
const { summaryForDateRange } = require('../controllers/branchExpenseController');
router.get('/api/branch-expense-summary', requireUser, summaryForDateRange);

module.exports = router;

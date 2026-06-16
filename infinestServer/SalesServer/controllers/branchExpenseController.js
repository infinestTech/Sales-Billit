const mongoose = require('mongoose');

const BranchExpense = mongoose.model('BranchExpense', new mongoose.Schema({
  shop_id: { type: String, index: true },
  branch_id: { type: String, index: true },
  title: { type: String },
  amount: { type: Number, default: 0 },
  date: { type: Date, default: Date.now },
  createdBy: { type: String }
}, { timestamps: true }));

// Create a new branch expense
exports.createBranchExpense = async (req, res) => {
  try {
    const shop_id = req.user.shop_id;
    // Accept branch_id from body or from user's branch; if missing (admin user),
    // fall back to the admin user's id so admin can create expenses without selecting a branch.
    let branch_id = req.body.branch_id || req.user.branch_id || null;
    if (!branch_id) {
      branch_id = req.user.userId || null;
    }
    const title = (req.body.title || '').toString();
    const amount = Number(req.body.amount) || 0;
    const date = req.body.date ? new Date(req.body.date) : new Date();

    if (!branch_id) return res.status(400).json({ success: false, message: 'branch_id required' });
    if (!title) return res.status(400).json({ success: false, message: 'title required' });
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'amount must be > 0' });

    // Create expense
    const createdBy = req.user.userId || req.user.branch_id || '';
    const exp = await BranchExpense.create({ shop_id, branch_id, title, amount, date, createdBy });
    return res.json({ success: true, expense: exp });
  } catch (err) {
    console.error('createBranchExpense error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// List expenses for shop (admin) or branch-specific when query param branch_id present
exports.listExpensesForShop = async (req, res) => {
  try {
    const shop_id = req.user.shop_id;
    let branch_id = null;

    // If this is a branch user, force filter to their branch only
    if (req.user.isBranch && req.user.branch_id) {
      branch_id = req.user.branch_id;
    } else {
      // admin users: if a branch_id was provided in query use it; otherwise
      // default to admin's own userId so admin sees only admin-created expenses by default
      branch_id = req.query.branch_id || req.user.userId || null;
    }

    const q = { shop_id };
    if (branch_id) q.branch_id = branch_id;
    const expenses = await BranchExpense.find(q).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, expenses });
  } catch (err) {
    console.error('listExpensesForShop error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Compute summary for given date or date range (defaults to today)
exports.summaryForDateRange = async (req, res) => {
  try {
    const shop_id = req.user.shop_id;
    let branch_id = null;

    // If this is a branch user, force filter to their branch only
    if (req.user.isBranch && req.user.branch_id) {
      branch_id = req.user.branch_id;
    } else {
      // admin: use requested branch_id if provided, otherwise default to admin's own id
      branch_id = req.query.branch_id || req.user.userId || null;
    }

    // Accept either a single date (YYYY-MM-DD) or start/end ISO strings
    const dateStr = req.query.date || null;
    const startStr = req.query.start || null;
    const endStr = req.query.end || null;

    let start, end;
    if (startStr && endStr) {
      start = new Date(startStr);
      end = new Date(endStr);
    } else if (dateStr) {
      // treat date as local day
      const parts = String(dateStr).split('-').map(Number);
      if (parts.length === 3) {
        start = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
        end = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
      } else {
        start = new Date(dateStr);
        end = new Date(start);
      }
    } else {
      // default to today (server local)
      start = new Date(); start.setHours(0,0,0,0);
      end = new Date(); end.setHours(23,59,59,999);
    }

    // Build query for sales
    const Sale = require('../models/sale');
    const saleQuery = { shop_id, createdAt: { $gte: start, $lte: end } };
    if (branch_id) saleQuery.branch_id = branch_id;

    const sales = await Sale.find(saleQuery).lean();

    // Sales revenue = sum totalAmount
    let salesRevenue = 0;
    let stockRevenue = 0;
    (sales || []).forEach(s => {
      salesRevenue += Number(s.totalAmount || 0);
      const items = Array.isArray(s.items) ? s.items : [];
      items.forEach(it => {
        const qty = Number(it.qty || it.sellingQty || 0) || 0;
        const totalCost = Number(it.totalCostPrice || 0) || ((Number(it.costPrice || it.cost || 0) || 0) * qty);
        stockRevenue += totalCost;
      });
    });

    // Total expense: sum from BranchExpense model
    const q = { shop_id, date: { $gte: start, $lte: end } };
    if (branch_id) q.branch_id = branch_id;
    const expenses = await exports._getExpenseModel ? exports._getExpenseModel().find(q).lean() : null;
    let totalExpense = 0;
    if (Array.isArray(expenses)) totalExpense = expenses.reduce((s, r) => s + (Number(r.amount) || 0), 0);

    const totalRevenue = Number(salesRevenue) - Number(stockRevenue);
    const netRevenue = Number(totalRevenue) - Number(totalExpense);

    return res.json({ success: true, summary: { salesRevenue, stockRevenue, totalRevenue, totalExpense, netRevenue }, counts: { sales: (sales||[]).length, expenses: (expenses||[]).length } });
  } catch (err) {
    console.error('summaryForDateRange error:', err && err.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Helper to access local BranchExpense model defined above when needed
exports._getExpenseModel = function() {
  // BranchExpense is defined in this module's top scope
  // find model from mongoose models
  const mongoose = require('mongoose');
  return mongoose.models.BranchExpense || mongoose.model('BranchExpense');
};

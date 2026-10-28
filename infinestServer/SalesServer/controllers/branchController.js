const crypto = require('crypto');
const Branch = require('../models/branch');

const PLAN_LIMITS = {
  'sales-basic': 0,
  'sales-gold': 3,
  'sales-premium': 5
};

// Helper function to get branch limit
async function getBranchLimit(userId, mongoPlanId, jwtLimit) {
  try {
    const { Feature } = require('../models/feature');
    const feature = await Feature.findOne({ 
      plan_id: 'sales-premium',
      feature_key: 'branch_limit' 
    });
    
    if (feature?.config?.maxBranches) {
      return feature.config.maxBranches;
    }
    return 5; // Fallback
  } catch (err) {
    console.error('Error fetching branch limit:', err.message);
    return 5;
  }
}

// POST /api/branches
const createBranch = async (req, res) => {
  try {
    const { name, address, gstNo, phoneNumber, email: rawEmail, password } = req.body || {}; // Added gstNo field
    // normalize email first to avoid using 'email' before initialization
    const email = (rawEmail || '').toLowerCase().trim();
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'name, email and password are required' });
    }

    // Get trial-aware branch limit
    const jwtLimit = Number.isFinite(Number(req.user?.branchLimit)) ? Number(req.user.branchLimit) : null;
    const planId = req.user?.mongoPlanId || 'sales-basic';
    const limit = await getBranchLimit(req.user.userId, planId, jwtLimit);

    console.log(`🏢 Branch creation check: limit=${limit} for user ${req.user.userId}`);

    if (limit <= 0) {
      return res.status(403).json({ success: false, message: 'Your plan does not allow branch creation' });
    }

    const count = await Branch.countDocuments({ shop_id: req.user.shop_id });
    console.log(`🏢 Current branches: ${count}/${limit}`);
    
    if (count >= limit) {
      return res.status(403).json({ success: false, message: `Branch limit reached. Your plan allows ${limit} branches.` });
    }

  const exists = await Branch.findOne({ shop_id: req.user.shop_id, email });
    if (exists) {
      return res.status(400).json({ success: false, message: 'A branch with this email already exists' });
    }

    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    const isAdmin = count === 0; // first branch is admin

    const doc = await Branch.create({
      mysql_user_id: req.user.userId,
      shop_id: req.user.shop_id,
      name,
      address: address || '',
      phoneNumber: phoneNumber || '',
      email,
      passwordHash,
      isAdmin,
      gstNo: gstNo || '', // Store GST No in the database
      createdBy: req.user.userId,
      updatedBy: req.user.userId,
    });

    res.status(201).json({ success: true, branch: doc });
  } catch (err) {
    console.error('Create branch error:', err.message);
    
    // Handle MongoDB duplicate key error
    if (err.code === 11000 || err.name === 'MongoServerError') {
      return res.status(400).json({ 
        success: false, 
        message: 'A branch with this email already exists in your shop' 
      });
    }
    
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/branches
const listBranches = async (req, res) => {
  try {
    const list = await Branch.find({ shop_id: req.user.shop_id }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, branches: list });
  } catch (err) {
    console.error('List branches error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/branches/:id/toggle-admin
const toggleBranchAdmin = async (req, res) => {
  try {
    const branchId = req.params.id;
    if (!branchId) return res.status(400).json({ success: false, message: 'Branch id required' });

    // Only allow shop-level admin (req.user.isAdmin) to toggle branch admin flag
    if (!req.user || !req.user.isAdmin) return res.status(403).json({ success: false, message: 'Not allowed' });

    const doc = await Branch.findOne({ _id: branchId, shop_id: req.user.shop_id });
    if (!doc) return res.status(404).json({ success: false, message: 'Branch not found' });

    doc.isAdmin = !doc.isAdmin;
    doc.updatedBy = req.user.userId || req.user.branch_id || '';
    await doc.save();
    return res.json({ success: true, branch: doc });
  } catch (err) {
    console.error('toggleBranchAdmin error:', err && err.message ? err.message : err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Only the shop owner (shop-admin / owner Sales token) may edit or delete branches, never a branch login
const isOwner = (req) => !!(req.user && req.user.shop_id && !req.user.branch_id);
const validId = (id) => require('mongoose').isValidObjectId(id);

// PUT /api/branches/:id — name, address, phone, email, GST No; password only when a new one is given
const updateBranch = async (req, res) => {
  try {
    if (!isOwner(req)) return res.status(403).json({ success: false, message: 'Only the shop owner can edit branches' });
    if (!validId(req.params.id)) return res.status(404).json({ success: false, message: 'Branch not found' });
    const doc = await Branch.findOne({ _id: req.params.id, shop_id: req.user.shop_id });
    if (!doc) return res.status(404).json({ success: false, message: 'Branch not found' });

    const body = req.body || {};
    const name = String(body.name || '').trim();
    const email = String(body.email || '').toLowerCase().trim();
    if (!name || !email) return res.status(400).json({ success: false, message: 'name and email are required' });
    if (email !== doc.email) {
      const taken = await Branch.findOne({ shop_id: req.user.shop_id, email, _id: { $ne: doc._id } }).select('_id').lean();
      if (taken) return res.status(400).json({ success: false, message: 'A branch with this email already exists' });
    }

    doc.name = name;
    doc.email = email;
    doc.address = String(body.address || '').trim();
    doc.phoneNumber = String(body.phoneNumber || '').trim();
    doc.gstNo = String(body.gstNo || '').trim();
    if (body.password) doc.passwordHash = crypto.createHash('sha256').update(String(body.password)).digest('hex');
    doc.updatedBy = req.user.userId || '';
    await doc.save();
    return res.json({ success: true, branch: doc });
  } catch (err) {
    console.error('Update branch error:', err.message);
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'A branch with this email already exists in your shop' });
    return res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/branches/:id — refused while the branch still holds stock, so no inventory disappears.
// Sales, supplies and expenses stay on record for reports; the branch login stops working.
const deleteBranch = async (req, res) => {
  try {
    if (!isOwner(req)) return res.status(403).json({ success: false, message: 'Only the shop owner can delete branches' });
    if (!validId(req.params.id)) return res.status(404).json({ success: false, message: 'Branch not found' });
    const doc = await Branch.findOne({ _id: req.params.id, shop_id: req.user.shop_id });
    if (!doc) return res.status(404).json({ success: false, message: 'Branch not found' });

    const BranchStock = require('../models/branchStock');
    const filter = { shop_id: String(req.user.shop_id), branch_id: String(doc._id) };
    const held = await BranchStock.aggregate([
      { $match: { ...filter, qty: { $gt: 0 } } },
      { $group: { _id: null, products: { $sum: 1 }, units: { $sum: '$qty' } } },
    ]);
    if (held.length && held[0].units > 0) {
      return res.status(409).json({
        success: false,
        message: `${doc.name} still holds ${held[0].units} unit(s) of ${held[0].products} product(s). Sell or move that stock before deleting the branch.`,
      });
    }

    await BranchStock.deleteMany(filter);
    await Branch.deleteOne({ _id: doc._id });
    // Keep one admin branch: the oldest remaining one takes over
    if (doc.isAdmin) {
      const next = await Branch.findOne({ shop_id: req.user.shop_id }).sort({ createdAt: 1 });
      if (next && !next.isAdmin) { next.isAdmin = true; await next.save(); }
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('Delete branch error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createBranch, listBranches, toggleBranchAdmin, updateBranch, deleteBranch };

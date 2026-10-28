const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { createBranch, listBranches, toggleBranchAdmin, updateBranch, deleteBranch } = require('../controllers/branchController');

const auth = (req, res, next) => {
  try {
    const auth = req.headers.authorization || '';
    const raw = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!raw) return res.status(401).json({ message: 'Missing token' });
    const decoded = jwt.verify(raw, process.env.JWT_SECRET || 'dev-sales-secret');
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

router.get('/api/branches', auth, listBranches);
router.post('/api/branches', auth, createBranch);
router.patch('/api/branches/:id/toggle-admin', auth, toggleBranchAdmin);
router.put('/api/branches/:id', auth, updateBranch);
router.delete('/api/branches/:id', auth, deleteBranch);

module.exports = router;

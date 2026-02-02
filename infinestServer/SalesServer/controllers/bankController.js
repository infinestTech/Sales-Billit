
const Bank = require('../models/bank');
const { Feature } = require('../models/feature');
const axios = require('axios').create({ family: 4, timeout: 10000 });

// Helper to get bank account limit
async function getBankAccountLimit(userId, planId) {
  try {
    const feature = await Feature.findOne({ 
      plan_id: 'sales-premium',
      feature_key: 'bank_account_limit' 
    });
    
    if (feature?.config?.maxBankAccounts) {
      return feature.config.maxBankAccounts;
    }
    return 5; // Fallback
  } catch (err) {
    console.error('Error fetching bank account limit:', err.message);
    return 5;
  }
  
  return maxBankAccounts;
}

// POST /api/banks
const createBank = async (req, res) => {
  try {
    const { bankName, accountNumber, holderName, address, phoneNumber, accountBalance } = req.body || {};
    const userId = req.user.userId || req.user.branch_id || '';
    const planId = req.user.mongoPlanId;
    
    // 1. Get bank account limit for this user's plan (considering trial)
    const maxBankAccounts = await getBankAccountLimit(userId, planId);
    
    // 2. Count existing banks for this user/shop/branch
    let filter = {};
    if (req.user.isBranch) {
      filter = { branch_id: req.user.branch_id };
    } else {
      filter = { $or: [ { mysql_user_id: userId }, { shop_id: req.user.shop_id } ] };
    }
    
    const currentCount = await Bank.countDocuments(filter);
    
    console.log(`🏦 Bank creation check: ${currentCount}/${maxBankAccounts} (Plan: ${planId})`);
    
    if (maxBankAccounts > 0 && currentCount >= maxBankAccounts) {
      return res.status(400).json({ 
        success: false, 
        message: `Bank account limit reached (${currentCount}/${maxBankAccounts}). Upgrade to Premium for more accounts.` 
      });
    }
    // 3. Proceed to create bank
    const payload = {
      mysql_user_id: userId,
      shop_id: req.user.shop_id || null,
      branch_id: req.user.isBranch ? req.user.branch_id : undefined,
      branchName: req.user.isBranch ? req.user.branchName || '' : undefined,
      bankName: bankName || '',
      accountNumber: accountNumber || '',
      holderName: holderName || '',
      address: address || '',
      phoneNumber: phoneNumber || '',
      accountBalance: accountBalance === '' || accountBalance === undefined || accountBalance === null ? undefined : Number(accountBalance),
      createdBy: userId,
      updatedBy: userId,
    };
    const doc = await Bank.create(payload);
    res.status(201).json({ success: true, bank: doc });
  } catch (err) {
    console.error('Create bank error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/banks
const listBanks = async (req, res) => {
  try {
    let filter = {};
    if (req.user.isBranch) {
      // Branch users see only banks created by their branch
      filter = { branch_id: req.user.branch_id };
    } else {
      // Admin/sales user should see banks they created (mysql_user_id)
      // plus any banks created for their shop (branch-created banks where shop_id matches)
      filter = { $or: [ { mysql_user_id: req.user.userId }, { shop_id: req.user.shop_id } ] };
    }
    const list = await Bank.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ success: true, banks: list });
  } catch (err) {
    console.error('List banks error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createBank, listBanks };

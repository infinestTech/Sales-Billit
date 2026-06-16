const BankTransaction = require('../models/bankTransaction');

// GET /api/bank-transactions?bank_id=... (optional)
exports.listTransactions = async (req, res) => {
  try {
    const { shop_id } = req.user || {};
    const { bank_id } = req.query || {};
    if (!shop_id) return res.status(400).json({ success: false, message: 'Shop missing' });

    const filter = { shop_id };
    // If branch user, restrict to banks owned by that branch
    if (req.user.isBranch) {
      const Bank = require('../models/bank');
      const banks = await Bank.find({ branch_id: req.user.branch_id }).select('_id').lean();
      const bankIds = banks.map(b => String(b._id));
      // If a specific bank_id was requested, ensure it belongs to this branch
      if (bank_id) {
        if (!bankIds.includes(String(bank_id))) return res.status(403).json({ success: false, message: 'Access denied' });
        filter.bank_id = bank_id;
      } else {
        filter.bank_id = { $in: bankIds.length ? bankIds : ['__none__'] };
      }
    } else {
      if (bank_id) filter.bank_id = bank_id;
    }

    const txns = await BankTransaction.find(filter)
      .sort({ createdAt: -1 })
      .populate('bank_id', 'bankName')
      .populate('supplier_id', 'supplierName')
      .lean();

    return res.json({ success: true, transactions: txns });
  } catch (err) {
    console.error('listTransactions error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

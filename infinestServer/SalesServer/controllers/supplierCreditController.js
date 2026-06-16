const SupplierCredit = require('../models/supplierCredit');

// List all credits for a shop, optionally filtered by supplier
exports.listCredits = async (req, res) => {
  try {
    const { shop_id } = req.user || {};
    if (!shop_id) return res.status(400).json({ success: false, message: 'Shop missing' });

    // Only admin can view credits
    if (req.user.isBranch) return res.status(403).json({ success: false, message: 'Only admin can view supplier credits' });

    const filter = { shop_id };
    if (req.query.supplier_id) filter.supplier_id = req.query.supplier_id;
    if (req.query.status) filter.status = req.query.status;

    const credits = await SupplierCredit.find(filter)
      .sort({ createdAt: -1 })
      .populate('supplier_id', 'supplierName agencyName phoneNumber')
      .populate('inStock_id', 'items supplierAmount createdAt')
      .lean();

    // Compute outstanding for each
    const enriched = credits.map(c => ({
      ...c,
      outstanding: (Number(c.totalAmount) || 0) - (Number(c.paidAmount) || 0),
    }));

    return res.json({ success: true, credits: enriched });
  } catch (err) {
    console.error('listCredits error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Get summary totals per supplier
exports.creditSummary = async (req, res) => {
  try {
    const { shop_id } = req.user || {};
    if (!shop_id) return res.status(400).json({ success: false, message: 'Shop missing' });
    if (req.user.isBranch) return res.status(403).json({ success: false, message: 'Only admin can view supplier credits' });

    const credits = await SupplierCredit.find({ shop_id })
      .populate('supplier_id', 'supplierName agencyName phoneNumber')
      .lean();

    const summaryMap = {};
    credits.forEach(c => {
      const sid = c.supplier_id?._id?.toString() || c.supplier_id?.toString() || 'unknown';
      if (!summaryMap[sid]) {
        summaryMap[sid] = {
          supplier_id: c.supplier_id,
          supplierName: c.supplier_id?.supplierName || c.supplier_id?.agencyName || 'Unknown',
          totalCredit: 0,
          totalPaid: 0,
          outstanding: 0,
          count: 0,
        };
      }
      summaryMap[sid].totalCredit += Number(c.totalAmount) || 0;
      summaryMap[sid].totalPaid += Number(c.paidAmount) || 0;
      summaryMap[sid].outstanding += (Number(c.totalAmount) || 0) - (Number(c.paidAmount) || 0);
      summaryMap[sid].count += 1;
    });

    return res.json({ success: true, summary: Object.values(summaryMap) });
  } catch (err) {
    console.error('creditSummary error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Record a payment against a credit entry (admin only)
exports.recordPayment = async (req, res) => {
  try {
    const { shop_id } = req.user || {};
    if (!shop_id) return res.status(400).json({ success: false, message: 'Shop missing' });
    if (req.user.isBranch) return res.status(403).json({ success: false, message: 'Only admin can record payments' });

    const { id } = req.params;
    const { amount, note } = req.body || {};
    if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Valid amount required' });

    const credit = await SupplierCredit.findOne({ _id: id, shop_id });
    if (!credit) return res.status(404).json({ success: false, message: 'Credit entry not found' });

    const payAmount = Number(amount);
    const outstanding = (Number(credit.totalAmount) || 0) - (Number(credit.paidAmount) || 0);
    if (payAmount > outstanding) {
      return res.status(400).json({ success: false, message: `Payment exceeds outstanding amount (₹${outstanding.toFixed(2)})` });
    }

    credit.payments.push({
      amount: payAmount,
      note: note || '',
      createdBy: req.user.userId || '',
    });
    credit.paidAmount = (Number(credit.paidAmount) || 0) + payAmount;

    // Update status
    const newOutstanding = (Number(credit.totalAmount) || 0) - credit.paidAmount;
    if (newOutstanding <= 0) {
      credit.status = 'settled';
    } else if (credit.paidAmount > 0) {
      credit.status = 'partial';
    }

    await credit.save();
    return res.json({ success: true, credit });
  } catch (err) {
    console.error('recordPayment error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

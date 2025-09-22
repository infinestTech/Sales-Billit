const InStock = require('../models/inStock');
const Bank = require('../models/bank');
const BankTransaction = require('../models/bankTransaction');


exports.createInStock = async (req, res) => {
  try {
  console.debug('createInStock payload items:', JSON.stringify(req.body.items || []));
  const { shop_id, userId } = req.user || {};
    if (!shop_id) return res.status(400).json({ success: false, message: 'Shop missing' });


  // Branch users are not allowed to create in-stock entries via this endpoint
  if (req.user.isBranch) return res.status(403).json({ success: false, message: 'Branches cannot create in-stock entries' });


  const { supplier_id, bank_id, supplierAmount = 0, gstAmount = 0, items = [], reference = '' } = req.body || {};
    if (!supplier_id) return res.status(400).json({ success: false, message: 'supplier_id is required' });
  if (!bank_id) return res.status(400).json({ success: false, message: 'bank_id is required' });


  // Calculate totalCost for bank balance and transaction logic
  const totalCost = (items || []).reduce((s, it) => s + ((Number(it.costPrice) || 0) * (Number(it.quantity) || 1)), 0);


    // Fetch and validate bank balance
    const bank = await Bank.findOne({ _id: bank_id, $or: [{ shop_id }, { mysql_user_id: req.user.userId }] });
    if (!bank) return res.status(404).json({ success: false, message: 'Bank not found' });
    const currentBalance = Number(bank.accountBalance || 0);
    if (currentBalance < totalCost) {
      return res.status(400).json({ success: false, message: 'Insufficient bank balance' });
    }


  const doc = await InStock.create({
      shop_id,
      supplier_id,
      bank_id,
      supplierAmount: Number(supplierAmount) || 0,
      gstAmount: Number(gstAmount) || 0,
      items: (items || []).map(i => {
        // Helper to generate random alphanumeric string (3-6 chars)
        function randomProductNo() {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
          const len = Math.floor(Math.random() * 4) + 3; // 3 to 6
          let str = '';
          for (let j = 0; j < len; j++) {
            str += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return str;
        }
        // Use manual input as-is, only auto-generate if blank
        // Determine totalQuantity: prefer explicit imes length (for mobiles) if provided, else use quantity
        const imesArray = Array.isArray(i.imes) ? i.imes.map(x => (x || '').toString()) : [];
        const computedTotalQ = imesArray.length > 0 ? imesArray.length : (Number(i.quantity) || 1);
        return {
          productNo: i.productNo && i.productNo.trim() ? i.productNo : randomProductNo(),
          productName: i.productName || '',
          brand: i.brand || '',
          model: i.model || '',
          quantity: Number(i.quantity) || 1,
          totalQuantity: computedTotalQ,
          imes: imesArray,
          costPrice: Number(i.costPrice) || 0,
          sellingPrice: Number(i.sellingPrice) || 0,
          validity: i.validity ? new Date(i.validity) : undefined,
        };
      }),
      createdBy: String(userId || ''),
      updatedBy: String(userId || ''),
    });
  console.debug('createInStock saved doc items:', JSON.stringify(doc.items || []));


    // Debit bank and record transaction
    const newBalance = currentBalance - totalCost;
    bank.accountBalance = newBalance;
    await bank.save();
    const txn = await BankTransaction.create({
      shop_id,
      bank_id,
      type: 'debit',
      amount: totalCost,
      reference: reference || `InStock payment for supplier ${String(supplier_id)}`,
      supplier_id,
      inStock_id: doc._id,
      balanceAfter: newBalance,
      createdBy: String(userId || '')
    });


    return res.json({ success: true, entry: doc, bank: { _id: bank._id, accountBalance: newBalance }, transaction: txn });
  } catch (err) {
    console.error('createInStock error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};


exports.listInStock = async (req, res) => {
  try {
  const { shop_id } = req.user || {};
  const gstOnly = req.query.gstOnly === '1';
    if (!shop_id) return res.status(400).json({ success: false, message: 'Shop missing' });
    // If branch user, restrict to banks owned by that branch
    if (req.user.isBranch) {
      const Bank = require('../models/bank');
      const banks = await Bank.find({ branch_id: req.user.branch_id }).select('_id').lean();
      const bankIds = banks.map(b => b._id);
      if (!bankIds.length) return res.json({ success: true, entries: [] });
      const entries = await InStock.find({ shop_id, bank_id: { $in: bankIds } })
        .sort({ createdAt: -1 })
        .populate('supplier_id', 'supplierName agencyName')
        .lean();
      return res.json({ success: true, entries });
    }


    let entries = await InStock.find({ shop_id })
      .sort({ createdAt: -1 })
      .populate('supplier_id', 'supplierName agencyName')
      .populate('bank_id', 'bankName accountNumber')
      .lean();
    if (gstOnly) {
      entries = entries.filter(e => Number(e.gstAmount) > 0);
    }
    // For each returned entry, compute for each item how much was shipped
    // to branches by comparing totalQuantity vs current quantity.
    try {
      try { console.debug('FLOW listInStock: entries fetched', { shop_id, count: Array.isArray(entries) ? entries.length : 0 }); } catch (__) {}
      const enriched = (entries || []).map(e => {
        const items = (Array.isArray(e.items) ? e.items : []).map(it => {
          const totalQ = Number(it.totalQuantity || it.quantity || 0);
          const currentQ = Number(it.quantity || 0);
          const shippedQty = Math.max(0, totalQ - currentQ);
          try { console.debug('DEBUG inStock item imes', { productNo: it.productNo, imesCount: Array.isArray(it.imes) ? it.imes.length : 0 }); } catch (__) {}
          return { ...it, totalQuantity: totalQ, shippedQty };
        });
        return { ...e, items };
      });
      return res.json({ success: true, entries: enriched });
    } catch (err) {
      console.error('listInStock enrich error:', err && err.message ? err.message : err);
      return res.json({ success: true, entries });
    }
  } catch (err) {
    console.error('listInStock error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};





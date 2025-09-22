const mongoose = require('mongoose');
const WhatsappSale = require('../models/whatsappSale');

exports.createWhatsappSale = async (req, res) => {
  try {
    const shop_id = req.user && req.user.shop_id;
    if (!shop_id) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const branch_id = req.user.branch_id || req.body.branch_id || null;
    const seller_id = req.user.branch_id ? req.user.branch_id : (req.user.userId || '');

    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const customerNo = req.body.customerNo || '';
    const paymentMethod = req.body.paymentMethod || 'cash';
    const amountPaid = Number(req.body.amountPaid || 0);
    const bank_id = req.body.bank_id || '';

    const totalAmount = items.reduce((s, it) => s + (Number(it.qty || it.sellingQty || 0) * Number(it.sellingPrice || 0)), 0);

    // Create record
    const doc = await WhatsappSale.create({ shop_id, branch_id, seller_id, customerNo, items, totalAmount, paymentMethod, amountPaid, bank_id, createdBy: req.user.userId || req.user.branch_id || '' });

    // If payment to bank, create transaction similar to Sale
    try {
      if (bank_id) {
        const Bank = require('../models/bank');
        const BankTransaction = require('../models/bankTransaction');
        const bankDoc = await Bank.findById(bank_id);
        if (bankDoc) {
          const newBal = (Number(bankDoc.accountBalance || 0) + Number(totalAmount || 0));
          const tx = await BankTransaction.create({ shop_id: shop_id, bank_id: bank_id, type: 'credit', amount: Number(totalAmount || 0), reference: `WhatsappSale:${doc._id}`, balanceAfter: newBal, createdBy: req.user.userId || req.user.branch_id || '' });
          await Bank.findByIdAndUpdate(bank_id, { $set: { accountBalance: newBal } });
        }
      }
    } catch (e) {
      console.error('createWhatsappSale: bank update failed', e && e.message ? e.message : e);
    }

    // Decrement stock: prefer WhatsappStock supplyQty decrement, fallback to BranchStock by productId/productNo
    try {
  const WhatsappStock = require('../models/whatsappStock');
  const BranchStock = require('../models/branchStock');
      for (const it of items) {
        try {
          const qty = Math.max(0, Number(it.qty || it.sellingQty || 0));
          if (qty <= 0) continue;

          // Try whatsappStock match by productNo
          if (it.productNo) {
            const ws = await WhatsappStock.findOne({ shop_id: shop_id, productNo: it.productNo });
            if (ws) {
              ws.supplyQty = Math.max(0, Number(ws.supplyQty || 0) - qty);
              await ws.save();
              continue;
            }
          }

          // Fallback to BranchStock if productId provided
          const soldImes = Array.isArray(it.imes) ? it.imes : (Array.isArray(it.selectedImes) ? it.selectedImes : []);
          const q = { shop_id: shop_id, branch_id: branch_id };
          if (it.productId) q.productId = it.productId;
          else if (it.productNo) q.productNo = it.productNo;
          else continue;

          const update = {};
          if (qty > 0) update.$inc = { qty: -qty };
          if (soldImes && soldImes.length) update.$pullAll = { imes: soldImes };

          if (Object.keys(update).length) {
            const after = await BranchStock.findOneAndUpdate(q, update, { new: true }).lean();
            if (after && typeof after.qty === 'number' && after.qty < 0) {
              await BranchStock.updateOne({ _id: after._id }, { $set: { qty: 0 } });
            }
          }
        } catch (e) { /* ignore single-item errors */ }
      }
    } catch (e) { console.error('createWhatsappSale: decrement stock failed', e && e.message ? e.message : e); }

    return res.status(201).json({ success: true, sale: doc });
  } catch (err) {
    console.error('createWhatsappSale error:', err && err.message ? err.message : err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.listWhatsappSales = async (req, res) => {
  try {
    const shop_id = req.user.shop_id;
    const q = { shop_id };
    const rows = await WhatsappSale.find(q).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, rows });
  } catch (e) {
    console.error('listWhatsappSales error', e && e.message || e);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const Sale = require('../models/sale');

exports.listSales = async (req, res) => {
  try {
    const shop_id = req.user.shop_id;
    let branch_id = req.query.branch_id || req.user.branch_id || null;
    
    // If this is a branch user, force filter to their branch only
    if (req.user.isBranch && req.user.branch_id) {
      branch_id = req.user.branch_id;
    }
    
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(100, Math.max(10, Number(req.query.pageSize || 25)));
    const q = { shop_id };
    if (branch_id) q.branch_id = branch_id;

    // Optional date range filtering
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;
    if (from || to) {
      q.createdAt = {};
      if (from && !isNaN(from.getTime())) q.createdAt.$gte = from;
      if (to && !isNaN(to.getTime())) q.createdAt.$lte = new Date(to.getTime() + 86400000); // include full day
    }

    const total = await Sale.countDocuments(q);
    const sales = await Sale.find(q).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean();

    // Enrich sales with branch names
    try {
      const Branch = require('../models/branch');
      const branchIds = [...new Set(sales.map(s => s.branch_id).filter(Boolean))];
      if (branchIds.length) {
        const branches = await Branch.find({ _id: { $in: branchIds } }).lean();
        const branchMap = {};
        branches.forEach(b => { branchMap[String(b._id)] = b.name || ''; });
        sales.forEach(s => { s.branchName = branchMap[s.branch_id] || ''; });
      }
    } catch (e) { /* ignore enrichment errors */ }

    return res.json({ success: true, sales, total, page, pageSize });
  } catch (err) {
    console.error('listSales error:', err && err.message ? err.message : err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createSale = async (req, res) => {
  try {
    const shop_id = req.user.shop_id;
    const branch_id = req.user.branch_id || req.body.branch_id;
    if (!branch_id) return res.status(400).json({ success: false, message: 'branch_id required' });

    const seller_id = req.user.branch_id ? req.user.branch_id : (req.user.userId || '');
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const customerNo = req.body.customerNo || '';
    const customerName = req.body.customerName || '';
    const paymentMethod = req.body.paymentMethod || 'cash';
    const amountPaid = Number(req.body.amountPaid || 0);
    // Subtotal and discount/taxable calculation
    const computedSubTotal = Number(req.body.subTotal || items.reduce((s, it) => s + (Number(it.qty || it.sellingQty || 0) * Number(it.sellingPrice || 0)), 0));
    const discount = Number(req.body.discount || 0);
    const discountAmount = Number(((discount / 100) * computedSubTotal).toFixed(2));
    const taxableAmount = Math.max(0, Number((computedSubTotal - discountAmount).toFixed(2)));

    // GST calculation applied on taxableAmount
    const cgst = Number(req.body.cgst || 0);
    const sgst = Number(req.body.sgst || 0);
    const igst = Number(req.body.igst || 0);
    const cgstAmount = Number((cgst / 100 * taxableAmount).toFixed(2));
    const sgstAmount = Number((sgst / 100 * taxableAmount).toFixed(2));
    const igstAmount = Number((igst / 100 * taxableAmount).toFixed(2));
    let totalAmount = taxableAmount;
    if (igst > 0) {
      totalAmount += igstAmount;
    } else {
      totalAmount += cgstAmount + sgstAmount;
    }
    totalAmount = Number(totalAmount.toFixed(2));

    // Check branch stock availability before creating the sale
    try {
      const BranchStock = require('../models/branchStock');
      for (const it of items) {
        const required = Math.max(0, Number(it.qty || it.sellingQty || 0));
        if (required <= 0) continue;
        // Build search using productId and/or productNo
        const or = [];
        if (it.productId) or.push({ productId: it.productId });
        if (it.productNo && String(it.productNo).trim() !== '') or.push({ productNo: String(it.productNo).trim() });

        if (or.length === 0) {
          // No reliable identifier to check availability
          return res.status(400).json({ success: false, message: `Cannot verify stock for an item without productId or productNo` });
        }

        const query = { shop_id, branch_id, $or: or };
        const bs = await BranchStock.findOne(query).lean();
        const available = bs ? Number(bs.qty || 0) : 0;
        if (available < required) {
          const idDesc = it.productId || it.productNo || it.productName || 'unknown';
          return res.status(400).json({ success: false, message: `Insufficient stock for ${idDesc}: available ${available}, requested ${required}` });
        }

        // If client provided specific IMEs for this item, ensure branch stock actually contains them
        const soldImes = Array.isArray(it.imes) ? it.imes : (Array.isArray(it.selectedImes) ? it.selectedImes : []);
        if (soldImes && soldImes.length) {
          const branchImes = Array.isArray(bs?.imes) ? bs.imes : [];
          const missing = soldImes.filter(x => !branchImes.includes(x));
          if (missing.length) {
            const idDesc = it.productId || it.productNo || it.productName || 'unknown';
            return res.status(400).json({ success: false, message: `Branch does not have IMEs for ${idDesc}: missing ${missing.join(', ')}` });
          }
          // As an additional sanity check, ensure count of IMEs available >= required
          if (branchImes.length < required) {
            const idDesc = it.productId || it.productNo || it.productName || 'unknown';
            return res.status(400).json({ success: false, message: `Insufficient IME count for ${idDesc}: available ${branchImes.length}, requested ${required}` });
          }
        }
      }
    } catch (e) {
      console.error('createSale: availability check failed', e && e.message ? e.message : e);
      return res.status(500).json({ success: false, message: 'Server error during availability check' });
    }

    const doc = await Sale.create({
      shop_id,
      branch_id,
      seller_id,
      customerNo,
      customerName,
      items,
      subTotal: Number(computedSubTotal.toFixed(2)),
      discount,
      discountAmount,
      taxableAmount,
      cgst,
      sgst,
      igst,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalAmount,
      paymentMethod,
      amountPaid,
      createdBy: req.user.userId || req.user.branch_id || ''
    });

    // Decrement BranchStock quantities for sold items and remove sold IMEs from BranchStock.imes
    try {
      const BranchStock = require('../models/branchStock');
      for (const it of items) {
        try {
          const soldQty = Math.max(0, Number(it.qty || it.sellingQty || 0));
          const soldImes = Array.isArray(it.imes) ? it.imes : (Array.isArray(it.selectedImes) ? it.selectedImes : []);
          // Build query using productId or productNo
          const q = { shop_id, branch_id };
          if (it.productId) q.productId = it.productId;
          else if (it.productNo && String(it.productNo).trim() !== '') q.productNo = String(it.productNo).trim();
          else continue; // nothing to update

          const update = {};
          if (soldQty > 0) update.$inc = { qty: -soldQty };
          if (soldImes && soldImes.length) update.$pullAll = { imes: soldImes };

          // If nothing to do, continue
          if (!Object.keys(update).length) continue;

          const after = await BranchStock.findOneAndUpdate(q, update, { new: true }).lean();
          // protect against negative qty
          if (after && typeof after.qty === 'number' && after.qty < 0) {
            await BranchStock.updateOne({ _id: after._id }, { $set: { qty: 0 } });
          }
        } catch (e) {
          console.error('createSale: failed to update BranchStock for item', it && (it.productId || it.productNo), e && e.message ? e.message : e);
        }
      }
    } catch (e) {
      console.error('createSale: decrement branch stock failed', e && e.message ? e.message : e);
    }

    return res.status(201).json({ success: true, sale: doc });
  } catch (err) {
    console.error('createSale error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

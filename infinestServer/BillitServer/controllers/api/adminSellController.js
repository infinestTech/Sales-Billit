const { Product, ProductHistory } = require('../../models/mongoModels');
const mongoose = require('mongoose');

const adminSell = async (req, res) => {
  try {
    const { items, customerNo, paymentMethod, bank_id } = req.body || {};
    const shop_id = req.body.userId || (req.user && req.user.userId) || null;
    const branch_id = (req.user && req.user.branch_id) || null;

    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'No items provided' });

    // validate and prepare
    let totalAmount = 0;
    for (const it of items) {
      const qty = Number(it.qty || it.sellingQty || 0);
      const price = Number(it.sellingPrice || it.unitSellingPrice || 0);
      if (qty <= 0) return res.status(400).json({ error: 'Item with invalid qty' });
      totalAmount += qty * price;
    }

    // update product quantities and create ProductHistory entries
    const historyCreates = [];
    const productUpdates = [];
    for (const it of items) {
      if (!it.productId) continue;
      const pid = it.productId;
      const qty = Number(it.qty || it.sellingQty || 0);

      const prod = await Product.findById(pid);
      if (!prod) return res.status(400).json({ error: `Product ${pid} not found` });
      if (prod.quantity < qty) return res.status(400).json({ error: `Insufficient stock for ${prod.name}` });

      prod.quantity = prod.quantity - qty;
      prod.updatedAt = new Date();
      productUpdates.push(prod.save());

      historyCreates.push(ProductHistory.create({
        productId: pid,
        changeType: 'SELL',
        quantity: qty,
        costPrice: prod.costPrice,
        paidAmount: Number(it.lineTotal || (qty * (it.sellingPrice || 0))) || 0,
        notes: `Admin sell by ${req.user ? (req.user.userId || req.user.mysql_user_id) : 'admin'}`
      }));
    }

    await Promise.all(productUpdates);
    await Promise.all(historyCreates);

    // create AdminSale entry in Mongo
    const AdminSale = mongoose.model('AdminSale');
    const saleDoc = await AdminSale.create({
      shop_id: shop_id || undefined,
      branch_id: branch_id || undefined,
      seller_id: req.user ? (req.user.userId || req.user.branch_id) : '',
      customerNo: customerNo || '',
      items: items.map(it => ({ productId: it.productId, productNo: it.productNo || '', productName: it.productName || '', qty: Number(it.qty || it.sellingQty || 0), sellingPrice: Number(it.sellingPrice || 0), lineTotal: Number(it.lineTotal || 0) })),
      totalAmount,
      paymentMethod: paymentMethod || 'online',
      bank_id: bank_id || '',
      createdBy: req.user ? (req.user.userId || '') : ''
    });

    return res.status(201).json({ success: true, sale: saleDoc });
  } catch (err) {
    console.error('adminSell error:', err && err.message ? err.message : err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

module.exports = { adminSell };

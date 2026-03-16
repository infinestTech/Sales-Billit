const mongoose = require('mongoose');

const SupplierCreditPaymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  note: { type: String, default: '' },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

const SupplierCreditSchema = new mongoose.Schema({
  shop_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', index: true, required: true },
  supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', index: true, required: true },
  inStock_id: { type: mongoose.Schema.Types.ObjectId, ref: 'InStock', index: true },
  totalAmount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  note: { type: String, default: '' },
  payments: { type: [SupplierCreditPaymentSchema], default: [] },
  status: { type: String, enum: ['pending', 'partial', 'settled'], default: 'pending' },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('SupplierCredit', SupplierCreditSchema);

const mongoose = require('mongoose');

const SupplierCreditPaymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  note: { type: String, default: '' },
  method: { type: String, default: '' }, // Cash | Gpay | Card | Bank Transfer | Cheque
  paidOn: { type: Date }, // day the dealer was paid (defaults to createdAt)
  batch: { type: String, default: '' }, // one dealer payment split across several bills shares a batch id
  createdBy: { type: String, default: '' },
}, { timestamps: true });

const SupplierCreditSchema = new mongoose.Schema({
  shop_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', index: true, required: true },
  supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', index: true, required: true },
  inStock_id: { type: mongoose.Schema.Types.ObjectId, ref: 'InStock', index: true },
  // Set instead of inStock_id when a branch bought the stock directly (branch supply record)
  branchSupply_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BranchSupply', index: true },
  branch_id: { type: String, default: '' },
  // 'opening' = credit the dealer was already owed before the shop started using the app (set on the dealer)
  kind: { type: String, enum: ['purchase', 'opening'], default: 'purchase' },
  totalAmount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  note: { type: String, default: '' },
  payments: { type: [SupplierCreditPaymentSchema], default: [] },
  status: { type: String, enum: ['pending', 'partial', 'settled'], default: 'pending' },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('SupplierCredit', SupplierCreditSchema);

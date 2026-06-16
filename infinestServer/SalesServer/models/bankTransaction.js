const mongoose = require('mongoose');

const BankTransactionSchema = new mongoose.Schema({
  shop_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', index: true, required: true },
  bank_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', index: true, required: true },
  type: { type: String, enum: ['debit','credit'], required: true },
  amount: { type: Number, required: true },
  reference: { type: String, default: '' },
  supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  inStock_id: { type: mongoose.Schema.Types.ObjectId, ref: 'InStock' },
  balanceAfter: { type: Number, default: 0 },
  createdBy: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('BankTransaction', BankTransactionSchema);

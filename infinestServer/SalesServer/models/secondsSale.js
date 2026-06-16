const mongoose = require('mongoose');

const FileRefSchema = new mongoose.Schema({
  filename: String,
  originalName: String,
  mimeType: String,
  size: Number,
  path: String,
}, { _id: false });

const SecondsSaleSchema = new mongoose.Schema({
  shop_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', index: true },
  branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
  mobileName: { type: String, default: '' },
  model: { type: String, default: '' },
  imeNo: { type: String, default: '' },
  specification: { type: String, default: '' },
  mobileCondition: { type: String, default: '' },
  colour: { type: String, default: '' },
  sellerName: { type: String, default: '' },
  sellerAddress: { type: String, default: '' },
  referenceName: { type: String, default: '' },
  referenceNumber: { type: String, default: '' },
  reasonForSale: { type: String, default: '' },
  proofType: { type: String, default: '' },
  proofNo: { type: String, default: '' },
  valueOfProduct: { type: Number, default: 0 },
  paymentMethod: { type: String, default: '' },
  images: { type: [FileRefSchema], default: [] },
  documents: { type: [FileRefSchema], default: [] },
  signatures: { type: [FileRefSchema], default: [] },
  purchases: { type: [{
    customerName: String,
    phone: String,
    price: Number,
    images: [FileRefSchema],
    documents: [FileRefSchema],
    bankTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'BankTransaction' },
    bank_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank' },
    bankName: { type: String },
    createdAt: { type: Date, default: Date.now }
  }], default: [] },
  sold: { type: Boolean, default: false },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('SecondsSale', SecondsSaleSchema);

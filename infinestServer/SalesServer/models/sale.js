const mongoose = require('mongoose');

const SaleItem = new mongoose.Schema({
  productId: { type: String, default: '' },
  productNo: { type: String, default: '' },
  productName: { type: String, default: '' },
  qty: { type: Number, default: 0 },
  sellingPrice: { type: Number, default: 0 },
  lineTotal: { type: Number, default: 0 }
}, { _id: false });

const SaleSchema = new mongoose.Schema({
  shop_id: { type: String, index: true },
  branch_id: { type: String, index: true },
  seller_id: { type: String, default: '' },
  customerNo: { type: String, default: '' },
  items: { type: [SaleItem], default: [] },
  subTotal: { type: Number, default: 0 },
  discount: { type: Number, default: 0 }, // discount percentage
  discountAmount: { type: Number, default: 0 }, // discount amount
  taxableAmount: { type: Number, default: 0 }, // amount after discount, before tax
  cgst: { type: Number, default: 0 }, // CGST percentage
  sgst: { type: Number, default: 0 }, // SGST percentage
  igst: { type: Number, default: 0 }, // IGST percentage
  cgstAmount: { type: Number, default: 0 }, // CGST amount
  sgstAmount: { type: Number, default: 0 }, // SGST amount
  igstAmount: { type: Number, default: 0 }, // IGST amount
  totalAmount: { type: Number, default: 0 },
  paymentMethod: { type: String, enum: ['cash','online'], default: 'cash' },
  amountPaid: { type: Number, default: 0 },
  bank_id: { type: String, default: '' },
  createdBy: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Sale', SaleSchema);

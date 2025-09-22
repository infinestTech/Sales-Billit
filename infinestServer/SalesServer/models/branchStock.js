const mongoose = require('mongoose');

const BranchStockSchema = new mongoose.Schema({
  shop_id: { type: String, index: true },
  branch_id: { type: String, index: true },
  productId: { type: String },
  productNo: { type: String },
  productName: { type: String },
  brand: { type: String },
  model: { type: String },
  imes: { type: Array, default: [] },
  costPrice: { type: Number, default: 0 },
  qty: { type: Number, default: 0 },
  sellingPrice: { type: Number, default: 0 },
  validity: { type: Date }
}, { timestamps: true });

module.exports = mongoose.models && mongoose.models.BranchStock
  ? mongoose.models.BranchStock
  : mongoose.model('BranchStock', BranchStockSchema);

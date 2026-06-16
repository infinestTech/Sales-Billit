const mongoose = require('mongoose');

const WhatsappStockSchema = new mongoose.Schema({
  shop_id: { type: String, required: true, index: true },
  productNo: { type: String, required: true },
  productName: { type: String },
  brand: { type: String },
  model: { type: String },
  supplyQty: { type: Number, default: 0 },
  sellPercent: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 },
  createdBy: { type: String },
  updatedBy: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('WhatsappStock', WhatsappStockSchema);

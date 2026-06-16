const mongoose = require('mongoose');

const WhatsappSaleSchema = new mongoose.Schema({
  shop_id: { type: mongoose.Schema.Types.Mixed, index: true },
  branch_id: { type: mongoose.Schema.Types.Mixed, index: true },
  seller_id: { type: String, default: '' },
  customerNo: { type: String, default: '' },
  items: { type: Array, default: [] },
  totalAmount: { type: Number, default: 0 },
  paymentMethod: { type: String, default: 'cash' },
  amountPaid: { type: Number, default: 0 },
  bank_id: { type: String, default: '' },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.models.WhatsappSale || mongoose.model('WhatsappSale', WhatsappSaleSchema);

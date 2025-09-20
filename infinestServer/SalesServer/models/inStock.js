const mongoose = require('mongoose');


const InStockItemSchema = new mongoose.Schema({
  productNo: { type: String, default: '' },
  productName: { type: String, default: '' },
  brand: { type: String, default: '' },
  model: { type: String, default: '' },
  quantity: { type: Number, default: 1 },
  // Preserve the original total quantity when the stock was added.
  // This allows tracking how much was originally added vs how much has
  // been transferred to branches (quantity may be decremented later).
  totalQuantity: { type: Number, default: 1 },
  // For mobile items, store IMEI/IMES numbers associated with each unit
  imes: { type: [String], default: [] },
  costPrice: { type: Number, default: 0 },
  sellingPrice: { type: Number, default: 0 },
  // Store as Date for calendar input; old string values remain readable in Mongo
  validity: { type: Date },
}, { _id: false });


const InStockSchema = new mongoose.Schema({
  shop_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', index: true, required: true },
  supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', index: true, required: true },
  bank_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', index: true },
  supplierAmount: { type: Number, default: 0 },
  gstAmount: { type: Number, default: 0 },
  items: { type: [InStockItemSchema], default: [] },
  createdBy: { type: String, default: '' },
  updatedBy: { type: String, default: '' },
}, { timestamps: true });


module.exports = mongoose.model('InStock', InStockSchema);





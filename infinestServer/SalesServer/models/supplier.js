const mongoose = require('mongoose');

const SupplierSchema = new mongoose.Schema({
  shop_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', index: true, required: true },
  // Optional branch scoping: branch_id when created from a branch token
  branch_id: { type: String, default: '' },
  branch_name: { type: String, default: '' },
  supplierName: { type: String, default: '' },
  agencyName: { type: String, default: '' },
  phoneNumber: { type: String, default: '' },
  address: { type: String, default: '' },
  gstNumber: { type: String, default: '' },
  panNumber: { type: String, default: '' },
  createdBy: { type: String, default: '' },
  updatedBy: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Supplier', SupplierSchema);

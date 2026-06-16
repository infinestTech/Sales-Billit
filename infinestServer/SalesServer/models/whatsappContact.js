const mongoose = require('mongoose');

const WhatsappContactSchema = new mongoose.Schema({
  shop_id: { type: String, required: true, index: true },
  name: { type: String, required: true },
  number: { type: String, required: true },
  district: { type: String, required: true },
  createdBy: { type: String },
  updatedBy: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('WhatsappContact', WhatsappContactSchema);

const mongoose = require('mongoose');

// Named sequences (e.g. `sale_invoice:<shop_id>:<branch_id>` for printed invoice numbers)
const CounterSchema = new mongoose.Schema({
  _id: { type: String },
  seq: { type: Number, default: 0 }
}, { versionKey: false });

module.exports = mongoose.models.SalesCounter || mongoose.model('SalesCounter', CounterSchema, 'sales_counters');

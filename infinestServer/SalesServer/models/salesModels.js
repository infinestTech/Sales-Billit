const mongoose = require('mongoose');

const salesUserSchema = new mongoose.Schema({
  mysql_user_id: { type: String, required: true, unique: true },
  product: { type: String, default: 'SALES' },
  isSubscriptionActive: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now }
});

const SalesUser = mongoose.model('SalesUser', salesUserSchema);

module.exports = { SalesUser };

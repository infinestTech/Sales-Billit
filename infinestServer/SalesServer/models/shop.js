const mongoose = require('mongoose');

// Minimal Shop model to fetch by MySQL user ID; allow extra fields
const shopSchema = new mongoose.Schema({
  mysql_user_id: { type: String, required: true, unique: true }
}, { strict: false });

module.exports = mongoose.models.Shop || mongoose.model('Shop', shopSchema);

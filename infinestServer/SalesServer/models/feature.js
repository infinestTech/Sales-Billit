const mongoose = require('mongoose');

// Feature Schema for Sales Server
const featureSchema = new mongoose.Schema({
  plan_id: { type: String, required: true },
  feature_key: { type: String, required: true },
  type: { type: String, enum: ["boolean", "limit"], required: true },
  enabled: { type: Boolean },
  config: {
    totalPages: Number,
    entriesPerPage: Number,
    maxPerCreation: Number,
    // Sales-specific config fields
    maxBankAccounts: Number,
    maxSuppliers: Number,
    maxBranches: Number,
    maxProducts: Number,
  },
  description: { type: String }
}, {
  timestamps: true
});

const Feature = mongoose.model("Feature", featureSchema);

module.exports = { Feature };

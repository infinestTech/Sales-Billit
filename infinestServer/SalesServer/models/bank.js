const mongoose = require('mongoose');

const bankSchema = new mongoose.Schema(
  {
    mysql_user_id: { type: String, required: true, index: true },
    shop_id: { type: String, required: false, index: true },
  branch_id: { type: String, required: false, index: true },
  branchName: { type: String },
    bankName: { type: String },
    accountNumber: { type: String },
    holderName: { type: String },
    address: { type: String },
    phoneNumber: { type: String },
    accountBalance: { type: Number },
    createdBy: { type: String },
    updatedBy: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Bank || mongoose.model('Bank', bankSchema);


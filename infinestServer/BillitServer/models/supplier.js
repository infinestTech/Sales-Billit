const mongoose = require("mongoose");
const { PAYMENT_METHOD_ENUM } = require("../constants/paymentMethods");


// Minimal Supplier schema for BillitServer
// Mirrors required fields from request: Supplier Name, Agency Name, Phone Number, Address
// Linked to a shop via userId (consistent with existing Expense model usage)
const supplierSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  supplierName: { type: String, required: true, trim: true },
  agencyName: { type: String, trim: true },
  phoneNumber: { type: String, trim: true },
  address: { type: String, trim: true },
  totalAmount: { type: Number, default: 0 },
  lastPaymentMethod: { type: String, enum: PAYMENT_METHOD_ENUM, default: "" },
  createdAt: { type: Date, default: Date.now }
});


// Check if model already exists to prevent OverwriteModelError
const Supplier = mongoose.models.Supplier || mongoose.model("Supplier", supplierSchema);
module.exports = { Supplier };
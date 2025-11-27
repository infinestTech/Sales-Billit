const mongoose = require("mongoose");


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
  lastPaymentMethod: { type: String, enum: ["cash", "UPI", "card", "UPI-h", "UPI-s", "Cash + Card", "UPI H + CASH", "UPI S + CASH", "UPI H + CARD", "UPI S + CARD", ""], default: "" },
  createdAt: { type: Date, default: Date.now }
});


const Supplier = mongoose.model("Supplier", supplierSchema);
module.exports = { Supplier };
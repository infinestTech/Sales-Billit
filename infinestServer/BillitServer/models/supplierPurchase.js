const mongoose = require("mongoose");
const { PAYMENT_METHOD_ENUM } = require("../constants/paymentMethods");

// A stock bill received from a supplier: the opening stock behind an opening credit, or a later
// purchase/restock entered from the shop-admin dashboard. Items are also stored as service spares
// (Product + ProductHistory) so the user-portal Service Inventory stays in sync.
const supplierPurchaseItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  name: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true },
  costPrice: { type: Number, required: true },
  total: { type: Number, required: true },
  // true when this bill created the spare (vs. topping up an existing one)
  createdNew: { type: Boolean, default: false }
}, { _id: false });

const supplierPurchaseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // shop id
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
  kind: { type: String, enum: ["opening", "purchase"], required: true },
  purchaseType: { type: String, enum: ["credit", "cash"], required: true },
  paymentMethod: { type: String, enum: PAYMENT_METHOD_ENUM, default: "" },
  billNo: { type: String, trim: true, default: "" },
  date: { type: Date, default: Date.now },
  items: { type: [supplierPurchaseItemSchema], default: [] },
  totalAmount: { type: Number, required: true },
  notes: { type: String, trim: true, default: "" },
  createdAt: { type: Date, default: Date.now }
});

supplierPurchaseSchema.index({ userId: 1, supplierId: 1, date: 1 });

const SupplierPurchase = mongoose.models.SupplierPurchase || mongoose.model("SupplierPurchase", supplierPurchaseSchema);
module.exports = { SupplierPurchase };

const { Supplier } = require("../../models/supplier");
const { Product, ProductHistory, SupplierHistory } = require("../../models/mongoModels");


// Add a new supplier
// Expects: shop_id (maps to userId), supplierName (required), agencyName, phoneNumber, address
exports.addSupplier = async (req, res) => {
  try {
    const { shop_id, supplierName, agencyName, phoneNumber, address } = req.body;


    if (!shop_id) {
      return res.status(400).json({ success: false, message: "shop_id is required" });
    }
    if (!supplierName || !supplierName.toString().trim()) {
      return res.status(400).json({ success: false, message: "supplierName is required" });
    }


    const supplier = await Supplier.create({
      userId: shop_id,
      supplierName: supplierName.toString().trim(),
      agencyName: (agencyName || "").toString().trim(),
      phoneNumber: (phoneNumber || "").toString().trim(),
      address: (address || "").toString().trim(),
      totalAmount: 0,
      lastPaymentMethod: "",
    });


    return res.json({ success: true, supplier });
  } catch (err) {
    console.error("addSupplier error:", err.message || err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


// List suppliers for a shop
// Expects: shop_id in body
exports.listSuppliers = async (req, res) => {
  try {
    const { shop_id } = req.body;


    if (!shop_id) {
      return res.status(400).json({ success: false, message: "shop_id is required" });
    }


    const suppliers = await Supplier.find({ userId: shop_id }).sort({ createdAt: -1 }).lean();


    // If any supplier is missing lastPaymentMethod, derive it from latest product
    try {
      const { Product } = require("../../models/mongoModels");
      const ids = suppliers.map(s => s._id).filter(Boolean);
      if (ids.length) {
        const agg = await Product.aggregate([
          { $match: { userId: shop_id, supplierId: { $in: ids } } },
          { $sort: { addedDate: -1, _id: -1 } },
          { $group: { _id: "$supplierId", lastPaymentMethod: { $first: "$paymentMethod" } } }
        ]);
        const pmMap = new Map(agg.map(r => [String(r._id), r.lastPaymentMethod]));
        suppliers.forEach(s => {
          if (!s.lastPaymentMethod) {
            const v = pmMap.get(String(s._id));
            if (v) s.lastPaymentMethod = v;
          }
        });
      }
    } catch (e) {
      console.warn("supplier list aggregation fallback failed:", e?.message || e);
    }


    return res.json({ success: true, suppliers });
  } catch (err) {
    console.error("listSuppliers error:", err.message || err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


// Get product creation history for a supplier (ADD entries)
// Expects: { shop_id, supplierId }
exports.getSupplierHistory = async (req, res) => {
  try {
    const { shop_id, supplierId } = req.body || {};
    if (!shop_id || !supplierId) {
      return res.status(400).json({ success: false, message: "shop_id and supplierId are required" });
    }


    // Fetch products for this supplier in this shop
    const products = await Product.find({ userId: shop_id, supplierId }).select({ _id: 1, name: 1, paymentMethod: 1 }).lean();
    const byId = new Map(products.map(p => [String(p._id), p]));
    const productIds = products.map(p => p._id);


    // Fetch ADD history for those products (if any)
    let productItems = [];
    if (productIds.length) {
      const history = await ProductHistory.find({ productId: { $in: productIds }, changeType: "ADD" })
        .sort({ changeDate: -1, _id: -1 })
        .lean();


      productItems = history.map(h => {
        const p = byId.get(String(h.productId));
        const qty = Number(h.quantity || 0);
        const cost = Number(h.costPrice || 0);
        return {
          type: "ADD",
          productId: h.productId,
          productName: p?.name || "",
          quantity: qty,
          costPrice: cost,
          total: qty * cost,
          paymentMethod: p?.paymentMethod || "",
          date: h.changeDate || h.createdAt || null,
          message: "",
        };
      });
    }


    // Fetch Supplier message history
    const supplierMsgs = await SupplierHistory.find({ supplierId, userId: shop_id })
      .sort({ changeDate: -1, _id: -1 })
      .lean();
    const supplierItems = supplierMsgs.map(h => ({
      type: h.changeType,
      productId: null,
      productName: "",
      quantity: null,
      costPrice: null,
      total: h.totalAmount ?? null,
      paidAmount: typeof h.paidAmount !== 'undefined' ? h.paidAmount : null,
      previousAmount: typeof h.previousAmount !== 'undefined' ? h.previousAmount : null,
      paymentMethod: h.paymentMethod || "",
      date: h.changeDate || h.createdAt || null,
      message: h.message || "",
    }));


    // Merge and sort by date desc
    const items = [...productItems, ...supplierItems].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));


    return res.json({ success: true, items });
  } catch (err) {
    console.error("getSupplierHistory error:", err?.message || err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


// Update supplier fields (totalAmount, lastPaymentMethod) and log history message
// Expects: { shop_id, supplierId, totalAmount, lastPaymentMethod, message }
exports.updateSupplier = async (req, res) => {
  try {
    const { shop_id, supplierId, totalAmount, lastPaymentMethod, message, paidAmount, changeDate } = req.body || {};
    if (!shop_id || !supplierId) {
      return res.status(400).json({ success: false, message: "shop_id and supplierId are required" });
    }


    const update = {};
    let prevForHistory = undefined;
    // If frontend sends a paidAmount, subtract it from current supplier total server-side
    if (typeof paidAmount !== "undefined" && paidAmount !== null && paidAmount !== "") {
      const paid = Number(paidAmount);
      if (Number.isNaN(paid)) {
        return res.status(400).json({ success: false, message: "paidAmount must be a number" });
      }
      // fetch current supplier to compute new total
      const existing = await Supplier.findOne({ _id: supplierId, userId: shop_id });
      if (!existing) {
        return res.status(404).json({ success: false, message: "Supplier not found" });
      }
      const curr = Number(existing.totalAmount || 0);
      prevForHistory = curr;
      const newTotal = curr - paid;
      update.totalAmount = newTotal;
    } else if (typeof totalAmount !== "undefined" && totalAmount !== null && totalAmount !== "") {
      const amt = Number(totalAmount);
      if (Number.isNaN(amt)) {
        return res.status(400).json({ success: false, message: "totalAmount must be a number" });
      }
      update.totalAmount = amt;
    }
    if (typeof lastPaymentMethod === "string" && lastPaymentMethod.trim() !== "") {
      const allowedMethods = ["cash", "UPI", "card", "UPI-h", "UPI-s", "Cash + Card", "UPI H + CASH", "UPI S + CASH", "UPI H + CARD", "UPI S + CARD"];
      const pm = allowedMethods.includes(lastPaymentMethod) ? lastPaymentMethod : "cash";
      update.lastPaymentMethod = pm;
    }


    if (!Object.keys(update).length && !message) {
      return res.status(400).json({ success: false, message: "Nothing to update" });
    }


    const updated = await Supplier.findOneAndUpdate({ _id: supplierId, userId: shop_id }, { $set: update }, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: "Supplier not found" });
    }


    // Log supplier history message
    const historyPayload = {
      supplierId,
      userId: shop_id,
      changeType: "ADMIN_EDIT",
      message: message || "Admin edited supplier details",
      totalAmount: typeof update.totalAmount === "number" ? update.totalAmount : undefined,
      paymentMethod: update.lastPaymentMethod || "",
    };

    // Use provided changeDate for financial report accuracy (e.g. recording yesterday's entry today)
    if (changeDate) {
      historyPayload.changeDate = new Date(changeDate);
    }

    // If this update was a payment subtraction, include paid and previous amounts
    if (typeof paidAmount !== "undefined" && paidAmount !== null && paidAmount !== "") {
      const paid = Number(paidAmount) || 0;
      historyPayload.paidAmount = paid;
      historyPayload.previousAmount = typeof prevForHistory !== 'undefined' ? prevForHistory : undefined;
      // note: totalAmount in payload is the new total we already set in update
    }
    await SupplierHistory.create(historyPayload);


    return res.json({ success: true, supplier: updated });
  } catch (err) {
    console.error("updateSupplier error:", err?.message || err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};





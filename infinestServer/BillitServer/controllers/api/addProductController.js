const { Product, ProductHistory } = require("../../models/mongoModels");
const { Supplier } = require("../../models/supplier");


const addProduct = async (req, res) => {
  const { name, category, costPrice, sellingPrice, quantity, shop_id, supplierId, paymentMethod, purchaseType, purchaseAmount } = req.body;

  if (!name || !quantity || !shop_id) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    const qty = Number(quantity);
    const isCredit = purchaseType === 'credit';

    // purchaseAmount (total) takes priority over per-unit costPrice (legacy field)
    const totalCost = purchaseAmount > 0 ? Number(purchaseAmount) : Number(costPrice || 0) * qty;
    const costPriceVal = qty > 0 ? totalCost / qty : Number(costPrice || 0);

    const normalizedPM = isCredit ? 'credit' : (
      ["cash", "upi"].includes(String(paymentMethod || '').toLowerCase())
        ? String(paymentMethod).toLowerCase()
        : "cash"
    );

    // Create product
    const newProduct = await Product.create({
      name,
      category,
      costPrice: costPriceVal,
      sellingPrice: sellingPrice || undefined,
      quantity: qty,
      totalCost,
      userId: shop_id,
      supplierId: supplierId || undefined,
      paymentMethod: normalizedPM,
    });

    // Only increment supplier's totalAmount for credit purchases (cash means already paid, no debt)
    try {
      if (supplierId && isCredit) {
        await Supplier.findOneAndUpdate(
          { _id: supplierId, userId: shop_id },
          { $inc: { totalAmount: totalCost }, $set: { lastPaymentMethod: 'credit' } },
          { new: true }
        );
      }
    } catch (e) {
      console.warn("Failed to update supplier totalAmount:", e?.message || e);
    }

    // Create product history log
    await ProductHistory.create({
      productId: newProduct._id,
      changeType: "ADD",
      quantity: qty,
      costPrice: costPriceVal,
      notes: isCredit ? `Credit purchase from supplier` : `Cash purchase`
    });

    return res.status(201).json({
      message: "Product added successfully.",
      product: newProduct,
    });
  } catch (error) {
    console.error("Error adding product:", error);
    return res.status(500).json({ error: "Failed to add product." });
  }
};


module.exports = { addProduct };

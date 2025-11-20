const { Product, ProductHistory } = require("../../models/mongoModels");
const { Supplier } = require("../../models/supplier");


const addProduct = async (req, res) => {
  const { name, category, costPrice, sellingPrice, quantity, shop_id, supplierId, paymentMethod } = req.body;


  if (!name || !costPrice || !quantity || !shop_id) {
    return res.status(400).json({ error: "Missing required fields." });
  }


  try {
    const totalCost = costPrice * quantity;
    const normalizedPM = ["cash", "upi"].includes(String(paymentMethod || '').toLowerCase())
      ? String(paymentMethod).toLowerCase()
      : "cash";


    // Create product
    const newProduct = await Product.create({
      name,
      category,
      costPrice,
      sellingPrice,
      quantity,
      totalCost,
      userId: shop_id, // 👈 This is shop_id
      supplierId: supplierId || undefined,
      paymentMethod: normalizedPM,
    });


    // Increment supplier's totalAmount if supplierId provided
    try {
      if (supplierId) {
        await Supplier.findOneAndUpdate(
          { _id: supplierId, userId: shop_id },
          { $inc: { totalAmount: totalCost }, $set: { lastPaymentMethod: normalizedPM } },
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
      quantity,
      costPrice,
      notes: "Initial stock added"
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

const { Product, ProductHistory } = require("../../models/mongoModels");
const { Supplier } = require("../../models/supplier");

const returnSpare = async (req, res) => {
  const { productId, quantityReturned, shop_id } = req.body;

  if (!productId || !quantityReturned || !shop_id) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const qty = Number(quantityReturned);
  if (!qty || qty <= 0) {
    return res.status(400).json({ error: "Quantity must be a positive number." });
  }

  try {
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Spare not found." });
    }
    if (product.quantity < qty) {
      return res.status(400).json({ error: "Return quantity exceeds current stock." });
    }

    const returnValue = qty * product.costPrice;
    const updatedQty = product.quantity - qty;

    await Product.findByIdAndUpdate(productId, {
      quantity: updatedQty,
      totalCost: updatedQty * product.costPrice,
      updatedAt: new Date(),
    });

    // Reduce supplier outstanding amount if this product is linked to a supplier
    if (product.supplierId) {
      await Supplier.findOneAndUpdate(
        { _id: product.supplierId, userId: shop_id },
        { $inc: { totalAmount: -returnValue } }
      );
    }

    await ProductHistory.create({
      productId: product._id,
      changeType: "RETURN_TO_SUPPLIER",
      quantity: qty,
      costPrice: product.costPrice,
      paidAmount: returnValue,
      notes: `Returned ${qty} unit(s) to supplier (₹${returnValue})`,
    });

    return res.status(200).json({
      message: "Spare returned to supplier successfully.",
      returnValue,
      remainingStock: updatedQty,
    });
  } catch (err) {
    console.error("Error returning spare:", err);
    return res.status(500).json({ error: "Failed to process return." });
  }
};

module.exports = { returnSpare };

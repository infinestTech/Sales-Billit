const { Product } = require("../../models/mongoModels");

const listProducts = async (req, res) => {
  const { shop_id } = req.body;

  if (!shop_id) {
    return res.status(400).json({ error: "Shop ID is required." });
  }

  try {
    const products = await Product.find({ userId: shop_id })
      .populate("supplierId", "supplierName agencyName")
      .sort({ updatedAt: -1 });
    return res.status(200).json({ products });
  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({ error: "Failed to fetch products." });
  }
};

module.exports = { listProducts };

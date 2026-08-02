const { Product, ProductHistory } = require("../../models/mongoModels");

const getSpareHistory = async (req, res) => {
  const { shop_id, fromDate, toDate } = req.body;

  if (!shop_id) {
    return res.status(400).json({ error: "shop_id is required." });
  }

  try {
    const products = await Product.find({ userId: shop_id })
      .populate("supplierId", "supplierName agencyName")
      .lean();

    const productMap = {};
    products.forEach((p) => {
      productMap[p._id.toString()] = {
        name: p.name,
        supplierName:
          p.supplierId?.supplierName || p.supplierId?.agencyName || "—",
        paymentMethod: p.paymentMethod || "—",
      };
    });

    const productIds = products.map((p) => p._id);

    const query = {
      productId: { $in: productIds },
      changeType: { $in: ["ADD", "RESTOCK", "RETURN_TO_SUPPLIER", "USE_SPARE"] },
    };

    if (fromDate || toDate) {
      query.changeDate = {};
      if (fromDate) query.changeDate.$gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        query.changeDate.$lte = end;
      }
    }

    const history = await ProductHistory.find(query)
      .sort({ changeDate: -1 })
      .lean();

    const enriched = history.map((h) => {
      const pInfo = productMap[h.productId.toString()] || {};
      return {
        ...h,
        spareName: pInfo.name || "Unknown Spare",
        supplierName: pInfo.supplierName || "—",
        paymentMethod: pInfo.paymentMethod || "—",
        amount: (h.quantity || 0) * (h.costPrice || 0),
      };
    });

    return res.json({ success: true, history: enriched });
  } catch (err) {
    console.error("Error fetching spare history:", err);
    return res.status(500).json({ error: "Failed to fetch spare history." });
  }
};

module.exports = { getSpareHistory };

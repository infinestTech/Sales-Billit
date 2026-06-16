const { ProductHistory } = require("../../models/mongoModels");

const getProductHistory = async (req, res) => {
  const { fromDate, toDate, changeType } = req.body;
  const { productId } = req.params;

  try {
    if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid productId format." });
    }

    const filters = {
      productId
    };

    if (fromDate && toDate) {
      filters.changeDate = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate),
      };
    }

    if (changeType) {
      filters.changeType = changeType;
    }

    const history = await ProductHistory.find(filters).sort({ changeDate: -1 });

    return res.json({ history });
  } catch (error) {
    console.error("Error fetching product history:", error);
    return res.status(500).json({ error: "Failed to fetch product history." });
  }
};

module.exports = { getProductHistory };

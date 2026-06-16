const { Dealer } = require("../../models/mongoModels");

// POST /api/dealer-vendors
const getDealerVendors = async (req, res) => {
  const { dealerId } = req.body;

  if (!dealerId) {
    return res.status(400).json({ error: "Dealer ID is required." });
  }

  try {
    const dealer = await Dealer.findById(dealerId).select("vendors client_name");

    if (!dealer) {
      return res.status(404).json({ error: "Dealer not found." });
    }

    return res.status(200).json({
      dealerName: dealer.client_name,
      vendors: dealer.vendors || [],
    });
  } catch (error) {
    console.error("Error fetching dealer vendors:", error.message);
    return res.status(500).json({ error: "Failed to fetch vendor details." });
  }
};

module.exports = { getDealerVendors };

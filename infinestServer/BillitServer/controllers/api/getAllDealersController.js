const { Dealer } = require("../../models/mongoModels");


// POST /api/dealers
const getAllDealers = async (req, res) => {
  const { shop_id } = req.body;


  if (!shop_id) {
    return res.status(400).json({ error: "Shop ID is required." });
  }


  try {
    const dealers = await Dealer.find({ shop_id }).select("client_name mobile_number balance_amount vendors _id");


    const formatted = dealers.map((dealer) => ({
      id: dealer._id,
      clientName: dealer.client_name,
      mobileNumber: dealer.mobile_number,
      balanceAmount: dealer.balance_amount ?? 0,
      vendors: dealer.vendors || [],
    }));


    return res.status(200).json(formatted);
  } catch (error) {
    console.error("Error fetching dealers:", error.message);
    return res.status(500).json({ error: "Failed to fetch dealers. Please try again later." });
  }
};


module.exports = { getAllDealers };




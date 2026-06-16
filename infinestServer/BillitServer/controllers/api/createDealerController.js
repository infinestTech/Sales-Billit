const { Dealer, Shop } = require("../../models/mongoModels");


// POST /api/createdealer
const createDealer = async (req, res) => {
  const { clientName, mobileNumber, userId } = req.body; // userId = shop_id


  if (!clientName || !mobileNumber || !userId) {
    return res.status(400).json({ error: "Missing required fields: clientName, mobileNumber, or userId." });
  }


  try {
    const shop = await Shop.findById(userId);
    if (!shop) {
      return res.status(404).json({ error: "Shop not found for the provided userId (shop_id)." });
    }


    // 🚩 Enforce record limit check
    if (shop.record_limit && shop.record_count >= shop.record_limit) {
      return res.status(403).json({
        error: "You have reached your plan's record limit. Please upgrade your plan to add more records."
      });
    }


    const newDealer = await Dealer.create({
      shop_id: userId,
      client_name: clientName,
      mobile_number: mobileNumber,
      no_of_mobile: 0,
      customer_type: "Dealer"
    });


    // 🚩 Increment record_count
    shop.record_count += 1;
    await shop.save();


    return res.status(201).json({
      message: "Dealer created successfully.",
      dealer: newDealer
    });


  } catch (error) {
    console.error("❌ Error creating dealer:", error);
    return res.status(500).json({
      error: "An error occurred while creating the dealer. Please try again later."
    });
  }
};


module.exports = { createDealer };




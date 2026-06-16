const { Notification } = require("../../models/mongoModels");
const mongoose = require("mongoose");


const getNotifications = async (req, res) => {
  const { shop_id } = req.query;


  if (!shop_id) {
    return res.status(400).json({ success: false, error: "Missing required field: shop_id." });
  }


  if (!mongoose.Types.ObjectId.isValid(shop_id)) {
    return res.status(400).json({ success: false, error: "Invalid shop_id provided." });
  }


  try {
    const notifications = await Notification.find({
      shop_id: new mongoose.Types.ObjectId(shop_id)
    }).sort({ created_at: -1 });


    return res.status(200).json({ success: true, notifications });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch notifications." });
  }
};


module.exports = { getNotifications };





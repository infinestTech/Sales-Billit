

const { Notification } = require("../../models/mongoModels");


const clearAllNotifications = async (req, res) => {
  const { shop_id } = req.body;


  if (!shop_id) {
    return res.status(400).json({ error: "Missing required field: shop_id." });
  }


  try {
    const result = await Notification.deleteMany({ shop_id });


    return res.status(200).json({
      success: true,
      message: `Cleared ${result.deletedCount} notifications for shop_id ${shop_id}.`,
    });
  } catch (error) {
    console.error("Error clearing notifications:", error);
    return res.status(500).json({ error: "Failed to clear notifications." });
  }
};


module.exports = { clearAllNotifications };






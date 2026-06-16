const { Notification } = require("../../models/mongoModels");


const addNotification = async (req, res) => {
  const { shop_id, type, message } = req.body;


  if (!shop_id || !message) {
    return res.status(400).json({ error: "Missing required fields (shop_id, message)." });
  }


  try {
    const notification = await Notification.create({
      shop_id,
      type: type || "info",
      message
    });


    return res.status(200).json({ success: true, notification });
  } catch (error) {
    console.error("Error adding notification:", error);
    return res.status(500).json({ error: "Failed to add notification." });
  }
};


module.exports = { addNotification };





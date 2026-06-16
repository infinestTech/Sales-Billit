const { Notification } = require("../../models/mongoModels");


const deleteNotification = async (req, res) => {
  const { notification_id } = req.body;


  if (!notification_id) {
    return res.status(400).json({ error: "Missing required field: notification_id." });
  }


  try {
    const deleted = await Notification.findByIdAndDelete(notification_id);


    if (!deleted) {
      return res.status(404).json({ error: "Notification not found." });
    }


    return res.status(200).json({ success: true, message: "Notification deleted.", deleted });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return res.status(500).json({ error: "Failed to delete notification." });
  }
};


module.exports = { deleteNotification };





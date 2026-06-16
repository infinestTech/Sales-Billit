const { Mobile } = require("../../models/mongoModels");


const toggleMobileStatus = async (req, res) => {
  const { id, field } = req.body;


  if (!id || !field) {
    return res.status(400).json({ error: "Missing required parameters: id or field" });
  }


  if (!["ready", "delivered", "returned"].includes(field)) {
    return res.status(400).json({ error: "Invalid field parameter" });
  }


  try {
    const mobile = await Mobile.findById(id);
    if (!mobile) {
      return res.status(404).json({ error: "Mobile record not found" });
    }


    let updateData = {};


    if (field === "returned") {
      const isReady = !!mobile.ready;
      const isDelivered = !!mobile.delivered;


      if (!isReady && !isDelivered) {
        // Directly toggle returned
        updateData.returned = !mobile.returned;
      } else {
        // If either ready or delivered is true, set both to false and set returned to true
        updateData.ready = false;
        updateData.delivered = false;
        updateData.delivery_date = null; // clear delivery date
        updateData.returned = true;
      }
    } else if (field === "delivered") {
      const newValue = !mobile.delivered;
      updateData.delivered = newValue;
      updateData.delivery_date = newValue ? new Date() : null;
    } else if (field === "ready") {
      updateData.ready = !mobile.ready;
    }


    const updatedMobile = await Mobile.findByIdAndUpdate(id, updateData, { new: true });


    return res.status(200).json({ success: true, updatedMobile });
  } catch (error) {
    console.error("Error toggling status:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};


module.exports = { toggleMobileStatus };





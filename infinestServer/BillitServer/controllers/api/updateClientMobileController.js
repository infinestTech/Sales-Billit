const mongoose = require("mongoose");
const { Customer, Dealer, ReworkRecord } = require("../../models/mongoModels");

// POST /api/updateClientMobile { id, type, mobileNumber }
// Corrects a customer's/dealer's phone number entered wrongly at intake.
const updateClientMobile = async (req, res) => {
  const { id, type } = req.body;
  const mobileNumber = String(req.body.mobileNumber || "").replace(/[\s-]/g, "");

  if (!id || !type) {
    return res.status(400).json({ message: "Missing id or type" });
  }
  if (!["Customer", "Dealer"].includes(type)) {
    return res.status(400).json({ message: "Invalid type. Must be 'Customer' or 'Dealer'" });
  }
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid record id" });
  }
  if (!/^\+?\d{10,15}$/.test(mobileNumber)) {
    return res.status(400).json({ message: "Enter a valid mobile number (10-15 digits)" });
  }

  try {
    const Model = type === "Customer" ? Customer : Dealer;
    const record = await Model.findOne({ _id: id, shop_id: req.user?.shop_id });
    if (!record) {
      return res.status(404).json({ message: `${type} not found` });
    }

    const oldNumber = record.mobile_number;
    record.mobile_number = mobileNumber;
    // A WhatsApp number copied from the wrong mobile number is wrong too
    if (type === "Customer" && record.whatsapp_number && record.whatsapp_number === oldNumber) {
      record.whatsapp_number = mobileNumber;
    }
    await record.save();

    // Rework records keep a snapshot of the number
    await ReworkRecord.updateMany(
      { shop_id: record.shop_id, [type === "Customer" ? "customer_id" : "dealer_id"]: record._id },
      { $set: { mobile_number: mobileNumber } }
    );

    return res.status(200).json({
      message: "Mobile number updated",
      mobile_number: record.mobile_number,
      whatsapp_number: record.whatsapp_number || "",
    });
  } catch (error) {
    console.error("Error updating client mobile number:", error);
    return res.status(500).json({ message: "Failed to update mobile number", error: error.message });
  }
};

module.exports = { updateClientMobile };

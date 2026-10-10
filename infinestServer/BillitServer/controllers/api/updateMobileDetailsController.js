const mongoose = require("mongoose");
const { Mobile } = require("../../models/mongoModels");

// Only descriptive device details are editable here. Payment fields (paid_amount,
// payments, total_paid) and statuses have their own dedicated endpoints.
const TEXT_FIELDS = ["mobile_name", "model", "imei", "issue", "technician_name"];

const updateMobileDetails = async (req, res) => {
  const { id, updates } = req.body || {};
  const shopId = req.user?.shop_id;

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "A valid mobile record id is required" });
  }
  if (!shopId) {
    return res.status(401).json({ error: "Shop not found in token" });
  }
  if (!updates || typeof updates !== "object") {
    return res.status(400).json({ error: "No updates provided" });
  }

  const set = {};
  for (const field of TEXT_FIELDS) {
    if (updates[field] === undefined) continue;
    if (updates[field] !== null && typeof updates[field] !== "string") {
      return res.status(400).json({ error: `Invalid value for ${field}` });
    }
    set[field] = (updates[field] || "").trim();
  }

  if (set.mobile_name !== undefined && !set.mobile_name) {
    return res.status(400).json({ error: "Mobile name cannot be empty" });
  }

  if (updates.added_date !== undefined) {
    const date = new Date(updates.added_date);
    if (!updates.added_date || Number.isNaN(date.getTime())) {
      return res.status(400).json({ error: "Invalid date" });
    }
    set.added_date = date;
  }

  if (Object.keys(set).length === 0) {
    return res.status(400).json({ error: "No editable fields provided" });
  }
  set.update_date = new Date();

  try {
    const updatedMobile = await Mobile.findOneAndUpdate(
      { _id: id, shop_id: shopId },
      { $set: set },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedMobile) {
      return res.status(404).json({ error: "Mobile record not found" });
    }

    return res.json({ success: true, updatedMobile });
  } catch (error) {
    console.error("Failed to update mobile details:", error);
    return res.status(500).json({ error: "Failed to update mobile details" });
  }
};

module.exports = { updateMobileDetails };

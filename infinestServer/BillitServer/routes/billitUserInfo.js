const express = require("express");
const jwt = require("jsonwebtoken");
const { User, Role, Feature } = require("../models/mongoModels");
const authenticateToken = require("../utils/authMiddleware"); // ✅ Use shared middleware

const router = express.Router();

// ✅ GET /api/billit-user-info (now uses shared middleware)
router.get("/billit-user-info", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate({
      path: "role_id",
      populate: { path: "mongoPlanId mongoCategoryId" }
    });

    if (!user || !user.role_id) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const role = user.role_id.role;
    const category = user.role_id.mongoCategoryId?.name || "Unknown";
    const plan = user.role_id.mongoPlanId?.name || "Unknown";

    const features = await Feature.find({ plan_id: user.role_id.mongoPlanId._id });

    res.json({
      success: true,
      role,
      category,
      plan,
      features: features.map(f => f.feature_name)
    });
  } catch (err) {
    console.error("Error in billit-user-info:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;
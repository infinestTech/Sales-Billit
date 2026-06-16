const express = require("express");
const router = express.Router();
const { syncUserToBillit } = require("../controllers/userSyncController");
const authMySQLToken = require("../utils/authMySQLToken"); // ✅ Add this

router.post(
  "/sync-user-to-billit",
  authMySQLToken, // ✅ Enforce auth and inject req.user and token
  async (req, res) => {
    const { userId } = req.body;

    try {
      const authHeader = req.headers.authorization; // ✅ capture the token
      const result = await syncUserToBillit(userId, authHeader); // ✅ pass it correctly
      res.json(result);
    } catch (err) {
      console.error("❌ sync-user-to-billit error:", err.message);
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;

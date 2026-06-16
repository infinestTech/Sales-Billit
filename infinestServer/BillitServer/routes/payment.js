const express = require("express");
const Razorpay = require("razorpay");
const axios = require("../utils/axiosConfig"); // Use IPv4-specific axios
const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

router.post("/create-order", async (req, res) => {
  const { amount, userId, planId, categoryId } = req.body;

  if (!userId || !planId || !categoryId) {
    return res.status(400).json({ message: "userId, planId, and categoryId are required" });
  }

  // ✅ Handle free basic plan (amount = 0)
  if (amount === 0 || amount === "0") {
    return res.json({ 
      success: true, 
      isFree: true,
      message: "Free basic plan - no payment required",
      planId,
      categoryId
    });
  }

  if (!amount) {
    return res.status(400).json({ message: "Amount is required for paid plans" });
  }

  try {
    // ✅ Generate a safe receipt under 40 chars
    const receipt = `sub_${userId.slice(0, 8)}_${Date.now()}`.slice(0, 40);

    const options = {
      amount: amount * 100, // amount in paise
      currency: "INR",
      receipt,
      notes: {
        userId,
        mongoPlanId: planId,
        mongoCategoryId: categoryId
      }
    };

    const order = await razorpay.orders.create(options);

    // ✅ Log payment initiation to MySQL server
    try {
      await axios.post(`${process.env.AUTH_SERVER_URL}/log-subscription-event`, {
        userId,
        action: "PAYMENT_INITIATED",
        message: `Payment initiated for ₹${amount} | Order ID: ${order.id}`,
        metadata: {
          orderId: order.id,
          planId,
          categoryId
        }
      },
        {
          headers: {
            "x-internal-key": process.env.INTERNAL_API_KEY
          }
        }
      );
    } catch (logErr) {
      console.warn("⚠️ Failed to log PAYMENT_INITIATED:", logErr.message);
      // Do not block flow on log failure
    }

    res.json({ success: true, order });
  } catch (err) {
    console.error("❌ Order Creation Failed:", err);
    res.status(500).json({ message: "Order creation failed", error: err.message });
  }
});

module.exports = router;

const express = require("express");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const axios = require("../utils/axiosConfig");
const jwt = require("jsonwebtoken");
const { syncUserToBillit } = require("../controllers/userSyncController");

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

/**
 * POST /api/webhook/razorpay
 *
 * Receives Razorpay webhook events. This route MUST be mounted BEFORE
 * express.json() so the raw body is available for signature verification.
 *
 * Setup in Razorpay Dashboard:
 *   URL: https://your-domain/api/webhook/razorpay
 *   Events: payment.captured
 *   Secret: set as RAZORPAY_WEBHOOK_SECRET in .env
 */
router.post("/webhook/razorpay", express.raw({ type: "application/json" }), async (req, res) => {
  // ── 1. Verify webhook signature ─────────────────────────────────────────────
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (webhookSecret) {
    const signature = req.headers["x-razorpay-signature"];
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(req.body) // raw Buffer
      .digest("hex");

    if (signature !== expectedSignature) {
      console.warn("⚠️ Razorpay webhook: invalid signature — rejecting");
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }
  } else {
    console.warn("⚠️ RAZORPAY_WEBHOOK_SECRET not set — skipping signature verification (insecure)");
  }

  // ── 2. Parse event ───────────────────────────────────────────────────────────
  let event;
  try {
    event = JSON.parse(req.body.toString());
  } catch (parseErr) {
    return res.status(400).json({ success: false, message: "Invalid JSON body" });
  }

  // ── 3. Only process payment.captured events ──────────────────────────────────
  if (event.event !== "payment.captured") {
    return res.json({ success: true, message: `Event '${event.event}' ignored` });
  }

  const payment = event.payload?.payment?.entity;
  if (!payment) {
    return res.status(400).json({ success: false, message: "Missing payment entity in payload" });
  }

  const razorpayPaymentId = payment.id;
  const orderId = payment.order_id;
  const amountInRupees = payment.amount / 100;

  console.log(`🔔 Webhook received: payment.captured — paymentId=${razorpayPaymentId} orderId=${orderId}`);

  // Always respond 200 quickly so Razorpay doesn't retry
  res.json({ success: true, received: true });

  // ── 4. Process subscription asynchronously ───────────────────────────────────
  setImmediate(async () => {
    try {
      // Fetch order to get plan metadata from notes
      let order;
      try {
        order = await razorpay.orders.fetch(orderId);
      } catch (fetchErr) {
        console.error("❌ Webhook: failed to fetch Razorpay order:", fetchErr.message);
        return;
      }

      const mongoPlanId = order.notes?.mongoPlanId;
      const mongoCategoryId = order.notes?.mongoCategoryId;
      const userId = order.notes?.userId;

      if (!mongoPlanId || !mongoCategoryId || !userId) {
        console.error("❌ Webhook: order notes missing required fields:", order.notes);
        return;
      }

      // Create a short-lived internal JWT (no session required — internal call)
      const tempToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "10m" });

      // ── 5. Call internal activation endpoint (idempotent) ───────────────────
      let activationResult;
      try {
        const activateRes = await axios.post(
          `${process.env.AUTH_SERVER_URL}/internal-activate-subscription`,
          { userId, mongoPlanId, mongoCategoryId, amount: amountInRupees, paymentId: razorpayPaymentId },
          { headers: { "x-internal-key": process.env.INTERNAL_API_KEY } }
        );
        activationResult = activateRes.data;
        console.log(`✅ Webhook: MySQL subscription activated for user ${userId}, plan ${mongoPlanId}`);
      } catch (activateErr) {
        console.error("❌ Webhook: subscription activation failed:", activateErr?.response?.data || activateErr.message);
        return;
      }

      if (activationResult?.alreadyProcessed) {
        console.log(`ℹ️ Webhook: payment ${razorpayPaymentId} was already processed — skipping MongoDB sync`);
        return;
      }

      // ── 6. Log payment completed ─────────────────────────────────────────────
      try {
        await axios.post(
          `${process.env.AUTH_SERVER_URL}/log-subscription-event`,
          {
            userId,
            action: "PAYMENT_COMPLETED",
            message: `[WEBHOOK] Payment ₹${amountInRupees} captured | Payment ID: ${razorpayPaymentId}`,
            metadata: { paymentId: razorpayPaymentId, orderId, source: "webhook" }
          },
          { headers: { "x-internal-key": process.env.INTERNAL_API_KEY } }
        );
      } catch (logErr) {
        console.warn("⚠️ Webhook: failed to log PAYMENT_COMPLETED:", logErr.message);
      }

      // ── 7. Sync to MongoDB ───────────────────────────────────────────────────
      try {
        await syncUserToBillit(userId, `Bearer ${tempToken}`);
        console.log(`✅ Webhook: MongoDB sync complete for user ${userId}`);
      } catch (syncErr) {
        console.error("❌ Webhook: MongoDB sync failed:", syncErr.message);
        // MySQL is already updated — this is recoverable on next login
      }

    } catch (err) {
      console.error("❌ Webhook: unexpected error during processing:", err.message);
    }
  });
});

module.exports = router;

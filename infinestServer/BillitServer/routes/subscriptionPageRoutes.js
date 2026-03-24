const express = require("express");
const axios = require("../utils/axiosConfig"); // Use IPv4-specific axios
const Razorpay = require("razorpay");
const crypto = require("crypto");

const { syncUserToBillit } = require("../controllers/userSyncController");
const authMySQLToken = require("../utils/authMySQLToken");
const { User } = require("../models/mongoModels");

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ✅ Route for free basic plan subscription
router.post("/create-free-subscription", authMySQLToken, async (req, res) => {
  const { planId, categoryId } = req.body;
  const userId = req.user.userId;

  if (!planId || !categoryId) {
    return res.status(400).json({ success: false, message: "Missing required fields: planId and categoryId." });
  }
  
  // Validate that this is actually a basic plan
  try {
    const response = await axios.get(`${process.env.BILLIT_BACKEND_URL}/api/plan/${planId}`);
    const plan = response.data;
    
    if (!plan || (plan.name !== "Basic" && plan.name !== "Trial" && plan.name !== "Sales Trial")) {
      return res.status(400).json({ 
        success: false, 
        message: "This endpoint can only be used for Basic/Trial plan subscriptions." 
      });
    }
  } catch (err) {
    console.error("❌ Error validating basic plan:", err.message);
    // Continue anyway - just a safety check
  }

  try {
    // ✅ Log subscription initiation for free plan
    try {
      await axios.post(`${process.env.AUTH_SERVER_URL}/log-subscription-event`, {
        userId,
        action: "SUBSCRIPTION_STARTED",
        message: `Free basic plan subscription initiated for user`,
        metadata: {
          planId,
          categoryId,
          amount: 0,
          planType: "FREE_BASIC"
        }
      },
        {
          headers: {
            "x-internal-key": process.env.INTERNAL_API_KEY
          }
        }
      );
    } catch (logErr) {
      console.warn("⚠️ Failed to log SUBSCRIPTION_STARTED:", logErr.message);
    }

    // ✅ Call MySQL subscription API for free plan
    let mysqlResponse;
    try {
      // Check if user already has an active subscription
      let hasActive = false;
      let activePlanDetails = null;
      try {
        const subRes = await axios.get(`${process.env.AUTH_SERVER_URL}/check-active-subscription`, {
          headers: {
            Authorization: `Bearer ${req.headers.authorization?.split(" ")[1]}`
          }
        });
        hasActive = subRes.data?.hasActivePlan || false;
        activePlanDetails = subRes.data?.planDetails || null;
      } catch (checkErr) {
        console.warn("⚠️ Could not verify existing subscription:", checkErr.message);
      }

      if (hasActive) {
        // Instead of error, return a friendly response with 200 status
        return res.status(200).json({
          success: true,
          message: "User already has an active subscription. No changes were made.",
          activePlan: activePlanDetails,
          alreadySubscribed: true,
          isPaidPlan: false,
          noNewSubscription: true  // Special flag for front-end to recognize this scenario
        });
      }

      // Create free subscription
      mysqlResponse = await axios.post(`${process.env.AUTH_SERVER_URL}/mysql-subscribe-free`, {
        mongoPlanId: planId,
        mongoCategoryId: categoryId,
        amount: 0
      }, {
        headers: {
          Authorization: `Bearer ${req.headers.authorization?.split(" ")[1]}`
        }
      });

      // ✅ Log successful subscription completion
      try {
        await axios.post(`${process.env.AUTH_SERVER_URL}/log-subscription-event`, {
          userId,
          subscriptionId: mysqlResponse.data?.subscriptionId || null,
          action: "SUBSCRIPTION_STARTED",
          message: `Free basic plan subscription completed successfully`,
          metadata: {
            planId,
            categoryId,
            amount: 0,
            planType: "FREE_BASIC"
          }
        },
          {
            headers: {
              "x-internal-key": process.env.INTERNAL_API_KEY
            }
          }
        );
      } catch (logErr) {
        console.warn("⚠️ Failed to log SUBSCRIPTION_STARTED:", logErr.message);
      }

    } catch (mysqlErr) {
      console.error("❌ MySQL Free Subscription Error:", mysqlErr?.response?.data || mysqlErr.message);
      return res.status(500).json({
        success: false,
        message: "Free subscription failed.",
        error: mysqlErr?.response?.data?.message || mysqlErr.message
      });
    }

    // ✅ Sync to MongoDB
    try {
      const authHeader = req.headers.authorization;
      await syncUserToBillit(userId, authHeader);
    } catch (mongoErr) {
      console.error("❌ MongoDB sync failed:", mongoErr.message);
      return res.status(500).json({
        success: false,
        message: "MongoDB sync failed.",
        error: mongoErr.message
      });
    }

    // ✅ Final Response
    return res.json({
      success: true,
      message: "Free basic plan subscription completed and synced successfully.",
      mysql: mysqlResponse.data,
      newSubscriptionCreated: true  // Flag indicating a new subscription was created
    });

  } catch (err) {
    console.error("❌ Unexpected error in free subscription flow:", err);
    return res.status(500).json({ success: false, message: "Unexpected server error.", error: err.message });
  }
});

router.post("/create-subscription", authMySQLToken, async (req, res) => {
  const {
    amount,
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature
  } = req.body;

  const userId = req.user.userId; // ✅ Securely extracted from JWT

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !amount) {
    return res.status(400).json({ success: false, message: "Missing required fields." });
  }

  try {
    // ✅ Step 1: Verify Signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.warn("⚠️ Invalid signature detected for user:", userId);

      try {
        await axios.post(`${process.env.AUTH_SERVER_URL}/log-subscription-event`, {
          userId,
          action: "PAYMENT_FAILED",
          message: `Signature verification failed for Payment ID: ${razorpay_payment_id}`,
          metadata: {
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id
          }
        },
          {
            headers: {
              "x-internal-key": process.env.INTERNAL_API_KEY
            }
          }
        );
      } catch (logErr) {
        console.warn("⚠️ Failed to log PAYMENT_FAILED:", logErr.message);
      }

      return res.status(400).json({ success: false, message: "Signature verification failed." });
    }

    // ✅ Step 2: Fetch Order from Razorpay
    let order;
    try {
      order = await razorpay.orders.fetch(razorpay_order_id);
    } catch (fetchErr) {
      console.error("❌ Failed to fetch order from Razorpay:", fetchErr);
      return res.status(500).json({ success: false, message: "Failed to fetch Razorpay order.", error: fetchErr.message });
    }

    const planId = order.notes?.mongoPlanId;
    const categoryId = order.notes?.mongoCategoryId;

    if (!planId || !categoryId) {
      console.error("❌ Missing plan or category in Razorpay notes:", order.notes);
      return res.status(400).json({ success: false, message: "Order missing planId or categoryId in notes." });
    }

    // ✅ Log PAYMENT_COMPLETED
    try {
      await axios.post(`${process.env.AUTH_SERVER_URL}/log-subscription-event`, {
        userId,
        action: "PAYMENT_COMPLETED",
        message: `Payment ₹${amount} successful | Payment ID: ${razorpay_payment_id}`,
        metadata: {
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id
        }
      },
        {
          headers: {
            "x-internal-key": process.env.INTERNAL_API_KEY
          }
        }
      );
    } catch (logErr) {
      console.warn("⚠️ Failed to log PAYMENT_COMPLETED:", logErr.message);
    }

    // ✅ Step 3: Call MySQL Subscription API
    let mysqlResponse;
    try {
      let hasActive = false;
      try {
        const subRes = await axios.get(`${process.env.AUTH_SERVER_URL}/check-active-subscription`, {
          headers: {
            Authorization: `Bearer ${req.headers.authorization?.split(" ")[1]}`
          }
        });
        hasActive = subRes.data?.hasActivePlan || false;
      } catch (checkErr) {
        console.warn("⚠️ Could not verify existing subscription:", checkErr.message);
      }

      if (hasActive) {
        mysqlResponse = await axios.post(`${process.env.AUTH_SERVER_URL}/upgrade-subscription`, {
          newMongoPlanId: planId,
          newMongoCategoryId: categoryId,
          amount
        }, {
          headers: {
            Authorization: `Bearer ${req.headers.authorization?.split(" ")[1]}`
          }
        });
      } else {
        mysqlResponse = await axios.post(`${process.env.AUTH_SERVER_URL}/mysql-subscribe`, {
          mongoPlanId: planId,
          mongoCategoryId: categoryId,
          amount
        }, {
          headers: {
            Authorization: `Bearer ${req.headers.authorization?.split(" ")[1]}`
          }
        });
      }

      try {
        await axios.post(`${process.env.AUTH_SERVER_URL}/log-subscription-event`, {
          userId,
          subscriptionId: mysqlResponse.data?.subscriptionId || null,
          action: "SUBSCRIPTION_STARTED",
          message: `Subscription started successfully with planId: ${planId}`,
          metadata: {
            planId,
            categoryId,
            amount
          }
        },
          {
            headers: {
              "x-internal-key": process.env.INTERNAL_API_KEY
            }
          }
        );
      } catch (logErr) {
        console.warn("⚠️ Failed to log SUBSCRIPTION_STARTED:", logErr.message);
      }

    } catch (mysqlErr) {
      console.error("❌ MySQL Subscription Error:", mysqlErr?.response?.data || mysqlErr.message);
      return res.status(500).json({
        success: false,
        message: "MySQL subscription failed.",
        error: mysqlErr?.response?.data?.message || mysqlErr.message
      });
    }

    // ✅ Step 4: Sync to MongoDB
    try {
      const authHeader = req.headers.authorization; // ✅ capture
      await syncUserToBillit(userId, authHeader);   // ✅ pass to function

    } catch (mongoErr) {
      console.error("❌ MongoDB sync failed:", mongoErr.message);
      return res.status(500).json({
        success: false,
        message: "MongoDB sync failed.",
        error: mongoErr.message
      });
    }

    // ✅ Final Response
    return res.json({
      success: true,
      message: "Subscription completed and synced successfully.",
      mysql: mysqlResponse.data,
      newSubscriptionCreated: true  // Flag indicating a new subscription was created
    });

  } catch (err) {
    console.error("❌ Unexpected error in subscription flow:", err);
    return res.status(500).json({ success: false, message: "Unexpected server error.", error: err.message });
  }
});

// ✅ Unified route that handles both paid and free plans
router.post("/subscribe", authMySQLToken, async (req, res) => {
  const { planId, categoryId, isPaidPlan = true } = req.body;
  const userId = req.user.userId;

  if (!planId || !categoryId) {
    return res.status(400).json({ success: false, message: "Missing required fields: planId and categoryId." });
  }

  // For basic (free) plan, redirect to free subscription flow
  if (!isPaidPlan) {
    try {
      // Proceed with free subscription
      // Check if user already has an active subscription
      let hasActive = false;
      let activePlanDetails = null;
      try {
        const subRes = await axios.get(`${process.env.AUTH_SERVER_URL}/check-active-subscription`, {
          headers: {
            Authorization: `Bearer ${req.headers.authorization?.split(" ")[1]}`
          }
        });
        hasActive = subRes.data?.hasActivePlan || false;
        activePlanDetails = subRes.data?.planDetails || null;
      } catch (checkErr) {
        console.warn("⚠️ Could not verify existing subscription:", checkErr.message);
      }

      if (hasActive) {
        // Instead of error, return a friendly response with 200 status
        return res.status(200).json({
          success: true,
          message: "User already has an active subscription. No changes were made.",
          activePlan: activePlanDetails,
          alreadySubscribed: true,
          isPaidPlan: false,
          noNewSubscription: true  // Special flag for front-end to recognize this scenario
        });
      }

      // Log subscription initiation for free plan
      try {
        await axios.post(`${process.env.AUTH_SERVER_URL}/log-subscription-event`, {
          userId,
          action: "SUBSCRIPTION_STARTED",
          message: `Free basic plan subscription initiated for user`,
          metadata: {
            planId,
            categoryId,
            amount: 0,
            planType: "FREE_BASIC"
          }
        },
          {
            headers: {
              "x-internal-key": process.env.INTERNAL_API_KEY
            }
          }
        );
      } catch (logErr) {
        console.warn("⚠️ Failed to log SUBSCRIPTION_STARTED:", logErr.message);
      }

      // Create free subscription
      const mysqlResponse = await axios.post(`${process.env.AUTH_SERVER_URL}/mysql-subscribe-free`, {
        mongoPlanId: planId,
        mongoCategoryId: categoryId,
        amount: 0
      }, {
        headers: {
          Authorization: `Bearer ${req.headers.authorization?.split(" ")[1]}`
        }
      });

      // Log successful subscription completion
      try {
        await axios.post(`${process.env.AUTH_SERVER_URL}/log-subscription-event`, {
          userId,
          subscriptionId: mysqlResponse.data?.subscriptionId || null,
          action: "SUBSCRIPTION_STARTED",
          message: `Free basic plan subscription completed successfully`,
          metadata: {
            planId,
            categoryId,
            amount: 0,
            planType: "FREE_BASIC"
          }
        },
          {
            headers: {
              "x-internal-key": process.env.INTERNAL_API_KEY
            }
          }
        );
      } catch (logErr) {
        console.warn("⚠️ Failed to log SUBSCRIPTION_STARTED:", logErr.message);
      }

      // Sync to MongoDB
      try {
        const authHeader = req.headers.authorization;
        await syncUserToBillit(userId, authHeader);
        
        // Mark user as having used their trial
        const { User } = require('../models/mongoModels');
        await User.findOneAndUpdate(
          { mysql_user_id: userId },
          { hasUsedTrial: true },
          { new: true }
        );
      } catch (mongoErr) {
        console.error("❌ MongoDB sync failed:", mongoErr.message);
        return res.status(500).json({
          success: false,
          message: "MongoDB sync failed.",
          error: mongoErr.message
        });
      }

      // Return success response
      return res.json({
        success: true,
        message: "Free basic plan subscription completed and synced successfully.",
        mysql: mysqlResponse.data,
        isPaidPlan: false,
        newSubscriptionCreated: true  // Flag indicating a new subscription was created
      });
    } catch (err) {
      console.error("❌ Unexpected error in free subscription flow:", err);
      return res.status(500).json({ 
        success: false, 
        message: "Unexpected server error.", 
        error: err.message 
      });
    }
  } else {
    // For paid plans, provide order details for Razorpay checkout
    try {
      // Get plan details to determine amount
      let planDetails;
      try {
        const response = await axios.get(`${process.env.BILLIT_BACKEND_URL}/api/plan/${planId}`);
        planDetails = response.data;
      } catch (err) {
        return res.status(500).json({ 
          success: false, 
          message: "Failed to fetch plan details", 
          error: err.message 
        });
      }

      // Fetch authoritative price from MySQL (avoids stale MongoDB price)
      let mysqlPlanPrice = null;
      try {
        const mysqlResponse = await axios.get(`${process.env.AUTH_SERVER_URL}/plan/by-mongo/${planId}`);
        mysqlPlanPrice = mysqlResponse.data?.plan?.price;
      } catch (err) {
        console.warn("⚠️ Could not fetch MySQL plan price, falling back to MongoDB price:", err.message);
      }

      const planPrice = mysqlPlanPrice !== null && mysqlPlanPrice !== undefined
        ? Number(mysqlPlanPrice)
        : Number(planDetails?.price);

      if (!planDetails || !planPrice || planPrice <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid plan or missing price information"
        });
      }

      // Create a Razorpay order
      const orderOptions = {
        amount: planPrice * 100, // Convert to paise
        currency: "INR",
        receipt: `order_${Date.now()}`,
        notes: {
          mongoPlanId: planId,
          mongoCategoryId: categoryId,
          userId: userId
        }
      };

      const order = await razorpay.orders.create(orderOptions);

      return res.json({
        success: true,
        orderId: order.id,
        amount: order.amount,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
        planDetails,
        isPaidPlan: true
      });
    } catch (err) {
      console.error("❌ Error creating Razorpay order:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to create payment order",
        error: err.message
      });
    }
  }
});

// Check if user has used trial
router.get("/check-trial-status", authMySQLToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await User.findOne({ mysql_user_id: userId });
    
    if (!user) {
      return res.json({
        hasUsedTrial: false // New user, hasn't used trial yet
      });
    }
    
    return res.json({
      hasUsedTrial: user.hasUsedTrial || false
    });
  } catch (error) {
    console.error("Error checking trial status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check trial status",
      error: error.message
    });
  }
});


module.exports = router;
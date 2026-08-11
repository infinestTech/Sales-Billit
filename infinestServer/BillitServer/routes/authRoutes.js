const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('../utils/axiosConfig'); // Use IPv4-specific axios
const passport = require('passport');
const { User, Role, Shop } = require('../models/mongoModels');
const SessionManager = require('../utils/sessionManager'); // ✅ Import session manager
const router = express.Router();

require('dotenv').config(); // ✅ Load environment variables

// Start Google login
router.get('/auth/google',
  passport.authenticate('google', { scope: ['email', 'profile'] })
);

// Google callback
router.get('/auth/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed` }),
  (req, res) => {
    const token = jwt.sign({
      userId: req.user._id,
      mongoPlanId: req.user.mongoPlanId
    }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.redirect(`${process.env.FRONTEND_URL}/callback?token=${token}`);
  }
);

router.post('/billit-login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  try {
    // 1️⃣ Verify MySQL credentials
    const { data: authData } = await axios.post(`${process.env.AUTH_SERVER_URL}/verify-user-login`, {
      email,
      password
    });

    if (!authData.success) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const mysqlUserId = authData.userId;

    // 2️⃣ Sync user to Mongo directly (no HTTP call needed)
    const { syncUserToBillit } = require('../controllers/userSyncController');
    const jwtToken = jwt.sign(
      { userId: mysqlUserId },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const syncResult = await syncUserToBillit(mysqlUserId, `Bearer ${jwtToken}`);

    // ✅ Check if sync returned subscription expired
    if (syncResult && !syncResult.success && syncResult.subscriptionExpired) {
      return res.status(403).json({ 
        message: "Your trial plan has ended. Please subscribe to a valid plan to continue enjoying Fixel's amazing features!",
        trialExpired: true,
        redirectToPricing: true
      });
    }

    // 3️⃣ Find MongoDB User
    const user = await User.findOne({ mysql_user_id: mysqlUserId }).populate('role_id');

    if (!user) {
      return res.status(404).json({ message: "User not found in Billit database." });
    }

    if (!user.isSubscriptionActive) {
      return res.status(403).json({ message: "Subscription expired." });
    }

    // Check if trial has expired
    const now = new Date();
    if (user.trialExpiryDate && now > user.trialExpiryDate) {
      // Check if user has a paid plan
      const mongoPlanId = user.role_id.mongoPlanId;
      const isPremiumPlan = mongoPlanId && (mongoPlanId.includes('premium') || mongoPlanId.includes('gold'));
      
      if (!isPremiumPlan) {
        return res.status(403).json({ 
          message: "Your trial plan has ended. Please subscribe to a valid plan to continue enjoying Fixel's amazing features!",
          trialExpired: true,
          redirectToPricing: true
        });
      }
    }

    // 4️⃣ Find Shop for user
    const shop = await Shop.findOne({ mysql_user_id: mysqlUserId });

    if (!shop) {
      return res.status(404).json({ message: "Shop not found for this user." });
    }

    // 5️⃣ Create JWT
    const mongoPlanId = user.role_id.mongoPlanId;
    // Enforce: sales plan users are NOT allowed in Billit, but service and other plans are allowed
    if (mongoPlanId && mongoPlanId.startsWith('sales-')) {
      return res.status(403).json({ message: `You only have access to Sales product. Please login to the Sales portal.` });
    }

    const payload = {
      userId: mysqlUserId, // ✅ store MySQL UUID instead of MongoDB _id
      mongoPlanId,
      shop_id: shop._id
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    // 6️⃣ Fetch user's session limit from MySQL
    let sessionLimit = 1; // Default
    try {
      const { data: mysqlUserData } = await axios.get(`${process.env.AUTH_SERVER_URL}/admin/get-user-session-limit/${mysqlUserId}`);
      if (mysqlUserData.success && mysqlUserData.sessionLimit) {
        sessionLimit = mysqlUserData.sessionLimit;
      }
    } catch (err) {
      console.log('⚠️ Could not fetch session limit, using default:', err.message);
    }

    // 7️⃣ Create session (enforces session limit)
    const sessionMetadata = {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      sessionLimit
    };
    
    await SessionManager.createSession(mysqlUserId, token, sessionMetadata);

    return res.json({
      token,
      message: "Login successful!"
    });

  } catch (err) {
    console.error('Billit Login Error:', err?.response?.data || err);
    
    // Handle subscription-related errors
    if (err.message && err.message.includes('does not have active subscription access')) {
      return res.status(403).json({ 
        message: "Your trial plan has ended. Please subscribe to a valid plan to continue enjoying Fixel's amazing features!",
        trialExpired: true,
        redirectToPricing: true
      });
    }
    
    // Handle auth server errors
    if (err.message && err.message.includes('Auth server error')) {
      return res.status(503).json({ 
        message: "Authentication service is currently unavailable. Please try again later."
      });
    }
    
    // Handle specific error responses from auth server
    if (err?.response?.data?.message) {
      const errorMessage = err.response.data.message;

      if (err.response.data.accountDeactivated) {
        return res.status(403).json({
          message: errorMessage,
          accountDeactivated: true
        });
      }

      // Check for subscription errors
      if (errorMessage.includes('already have an active') || 
          errorMessage.includes('upgrade') || 
          errorMessage.includes('expire')) {
        return res.status(403).json({ 
          message: errorMessage,
          subscriptionConflict: true
        });
      }
      
      return res.status(err.response.status || 500).json({ 
        message: errorMessage 
      });
    }
    
    return res.status(500).json({ message: "An unexpected error occurred. Please try again." });
  }
});

// ✅ Logout endpoint - invalidates user's session
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(400).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    
    // Verify and decode token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Invalidate only the current session (not all sessions for this user)
    await SessionManager.invalidateCurrentSession(decoded.userId, token);
    
    return res.json({
      success: true,
      message: "Logged out successfully"
    });
  } catch (err) {
    console.error('Logout Error:', err);
    // Even if there's an error, return success (user intent is to logout)
    return res.json({
      success: true,
      message: "Logged out"
    });
  }
});

module.exports = router;

const jwt = require("jsonwebtoken");
const SessionManager = require("../utils/sessionManager");

/**
 * 🔐 Authentication Middleware with Session Validation
 * Validates JWT token AND checks if user has an active session
 * Prevents multiple concurrent logins from different devices
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ 
        success: false, 
        message: "No token provided",
        sessionExpired: true
      });
    }

    const token = authHeader.split(" ")[1];
    
    // 1️⃣ Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(403).json({ 
        success: false, 
        message: "Invalid or expired token",
        sessionExpired: true
      });
    }

    // 2️⃣ Validate active session (enforce single-device login)
    const isSessionValid = await SessionManager.validateSession(decoded.userId, token);
    
    if (!isSessionValid) {
      return res.status(401).json({ 
        success: false, 
        message: "Your session has expired or you have logged in from another device. Please login again.",
        sessionExpired: true,
        loggedOutFromAnotherDevice: true
      });
    }

    // 3️⃣ Attach user info to request
    req.userId = decoded.userId;
    req.mongoPlanId = decoded.mongoPlanId;
    req.shop_id = decoded.shop_id;
    
    next();
  } catch (err) {
    console.error("❌ Authentication error:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error during authentication" 
    });
  }
};

module.exports = authenticateToken;

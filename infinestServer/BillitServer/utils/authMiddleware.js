const jwt = require('jsonwebtoken');
const SessionManager = require('./sessionManager');

/**
 * 🔐 Authentication Middleware with Session Validation
 * Validates JWT token AND checks if user has an active session
 * Prevents multiple concurrent logins from different devices
 */
async function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ 
                message: "No token provided.",
                sessionExpired: true
            });
        }

        // 1️⃣ Verify JWT token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(403).json({ 
                message: "Invalid or expired token.",
                sessionExpired: true
            });
        }

        // 2️⃣ Validate active session (enforce single-device login)
        const isSessionValid = await SessionManager.validateSession(decoded.userId, token);
        
        if (!isSessionValid) {
            return res.status(401).json({ 
                message: "Your session has expired or you have logged in from another device. Please login again.",
                sessionExpired: true,
                loggedOutFromAnotherDevice: true
            });
        }

        // 3️⃣ Attach user info to request
        req.user = {
            userId: decoded.userId,
            mongoPlanId: decoded.mongoPlanId,
            shop_id: decoded.shop_id
        };
        
        next();
    } catch (error) {
        console.error("❌ Authentication error:", error);
        return res.status(500).json({ 
            message: "Error processing token." 
        });
    }
}

module.exports = authenticateToken;






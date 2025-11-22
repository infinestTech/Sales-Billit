const jwt = require("jsonwebtoken");

/**
 * Middleware to authenticate admin users
 * Verifies admin JWT token from Authorization header
 */
const adminAuth = async (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
        return res.status(401).json({ message: "No admin token provided." });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Verify it's an admin token
        if (!decoded.isAdmin) {
            return res.status(403).json({ message: "Access denied. Admin privileges required." });
        }

        req.admin = {
            email: decoded.email,
            isAdmin: true
        };

        next();
    } catch (err) {
        return res.status(403).json({ message: "Invalid or expired admin token." });
    }
};

module.exports = adminAuth;

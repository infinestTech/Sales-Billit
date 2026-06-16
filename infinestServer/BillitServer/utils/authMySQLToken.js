const axios = require('../utils/axiosConfig'); // Use IPv4-specific axios

const authMySQLToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];

        console.log("🔍 authMySQLToken - Token received:", token ? "YES" : "NO");
        console.log("🔍 authMySQLToken - AUTH_SERVER_URL:", process.env.AUTH_SERVER_URL);
        console.log("🔍 authMySQLToken - INTERNAL_API_KEY:", process.env.INTERNAL_API_KEY ? "SET" : "NOT SET");

        if (!token) {
            return res.status(401).json({ error: "Token missing." });
        }

        // Verify JWT with your MySQL auth server
        const response = await axios.post(
            `${process.env.AUTH_SERVER_URL}/internal-verify-token`,
            {},
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "x-internal-key": process.env.INTERNAL_API_KEY
                }
            }
        );

        console.log("🔍 authMySQLToken - Response status:", response.status);
        console.log("🔍 authMySQLToken - Response data:", response.data);

        if (!response.data.valid) {
            return res.status(403).json({ error: response.data.message || "Unauthorized." });
        }

        // Attach user to request
        req.user = response.data.user; // { userId, email, ... }

        console.log("✅ authMySQLToken - User attached:", req.user);

        next();
    } catch (err) {
        console.error("❌ authMySQLToken verification error:", err.response?.data || err.message);
        console.error("❌ authMySQLToken full error:", err);
        return res.status(403).json({ error: "Invalid token or auth server error." });
    }
};


module.exports = authMySQLToken;






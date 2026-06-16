// CommonDB/middleware/internalAuth.js
const internalAuth = (req, res, next) => {
    
    const apiKey = req.headers["x-internal-key"];
    if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
        return res.status(403).json({
            success: false,
            message: "Forbidden: Invalid internal API key"
        });
    }
    next();
};

module.exports = internalAuth;

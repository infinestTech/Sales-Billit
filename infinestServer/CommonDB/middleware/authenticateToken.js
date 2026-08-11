
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const { isUserBlacklisted } = require("../utils/tokenBlacklist");

const prisma = new PrismaClient();

const authenticateToken = async (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token provided." });

    try {
        const decodedUser = jwt.verify(token, process.env.JWT_SECRET);

        // Check if user is blacklisted (deleted)
        if (isUserBlacklisted(decodedUser.userId)) {
            return res.status(403).json({ 
                message: "Account has been deleted. Please contact support if you believe this is an error." 
            });
        }

        // Verify user still exists in database
        const userExists = await prisma.user.findUnique({
            where: { id: decodedUser.userId },
            select: { id: true, isDeactivated: true }
        });

        if (!userExists) {
            return res.status(403).json({ 
                message: "Account no longer exists. Please contact support if you believe this is an error." 
            });
        }

        if (userExists.isDeactivated) {
            return res.status(403).json({
                message: "Your account has been deactivated by the admin. Please contact the admin.",
                accountDeactivated: true
            });
        }

        const subscription = await prisma.subscription.findFirst({
            where: { userId: decodedUser.userId, status: "ACTIVE" },
            include: { plan: true }
        });

        req.user = {
            userId: decodedUser.userId,
            email: decodedUser.email,
            subscription: subscription || null
        };

        next();
    } catch (err) {
        return res.status(403).json({ message: "Invalid or expired token." });
    }
};

module.exports = authenticateToken;

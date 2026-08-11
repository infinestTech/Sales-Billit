const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const adminAuth = require('../middleware/adminAuth');
const axios = require('axios');
const { blacklistUser } = require('../utils/tokenBlacklist');
const { subtractTimeIST } = require('../utils/dateHelper');

const prisma = new PrismaClient();

// Admin login endpoint
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate credentials against environment variables
        if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ message: "Invalid admin credentials" });
        }

        // Generate admin JWT token
        const token = jwt.sign(
            { email, isAdmin: true },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            admin: { email }
        });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ message: "Login failed", error: error.message });
    }
});

// Get dashboard statistics
router.get('/stats', adminAuth, async (req, res) => {
    try {
        // Total users count
        const totalUsers = await prisma.user.count();

        // Active users (users who created records in last 30 days)
        const thirtyDaysAgo = subtractTimeIST(30, 'days');

        // Get active subscriptions
        const activeSubscriptions = await prisma.subscription.count({
            where: { status: 'ACTIVE' }
        });

        // Get total payments
        const totalPayments = await prisma.payment.count();

        // Get completed payments sum
        const paymentStats = await prisma.payment.aggregate({
            where: { status: 'COMPLETED' },
            _sum: { amount: true },
            _count: true
        });

        // Get subscription status breakdown
        const subscriptionBreakdown = await prisma.subscription.groupBy({
            by: ['status'],
            _count: true
        });

        // Get recent sign-ups (last 7 days)
        const sevenDaysAgo = subtractTimeIST(7, 'days');
        
        const recentSignUps = await prisma.user.count({
            where: {
                createdAt: { gte: sevenDaysAgo }
            }
        });

        // Get product access distribution
        const productDistribution = await prisma.productAccess.groupBy({
            by: ['product'],
            _count: true
        });

        res.json({
            success: true,
            stats: {
                totalUsers,
                activeSubscriptions,
                recentSignUps,
                totalPayments,
                revenue: paymentStats._sum.amount || 0,
                completedPayments: paymentStats._count,
                subscriptionBreakdown,
                productDistribution
            }
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ message: "Failed to fetch statistics", error: error.message });
    }
});

// Get all users with detailed information
router.get('/users', adminAuth, async (req, res) => {
    try {
        const { page = 1, limit = 50, search = '' } = req.query;
        const skip = (page - 1) * limit;

        const where = search ? {
            OR: [
                { email: { contains: search } },
                { username: { contains: search } },
                { name: { contains: search } }
            ]
        } : {};

        const users = await prisma.user.findMany({
            where,
            include: {
                subscription: {
                    include: {
                        plan: true
                    }
                },
                productAccess: true,
                payments: {
                    orderBy: { createdAt: 'desc' },
                    take: 5
                }
            },
            orderBy: { createdAt: 'desc' },
            skip: parseInt(skip),
            take: parseInt(limit)
        });

        const totalUsers = await prisma.user.count({ where });

        res.json({
            success: true,
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalUsers,
                totalPages: Math.ceil(totalUsers / limit)
            }
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ message: "Failed to fetch users", error: error.message });
    }
});

// Get active users (users with recent activity in MongoDB)
router.get('/users/active', adminAuth, async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(days));

        // Get MongoDB active users data
        let mongoActiveUsers = [];
        try {
            const billitResponse = await axios.get(
                `${process.env.BILLIT_SERVER_URL}/api/admin/active-users?days=${days}`,
                {
                    headers: {
                        'x-internal-key': process.env.INTERNAL_API_KEY
                    },
                    timeout: 5000
                }
            );
            mongoActiveUsers = billitResponse.data.activeUsers || [];
        } catch (mongoError) {
            console.error('MongoDB active users error:', mongoError.message);
        }

        // Get MySQL users
        const allUsers = await prisma.user.findMany({
            include: {
                subscription: {
                    include: {
                        plan: true
                    }
                },
                productAccess: true
            }
        });

        // Merge data
        const activeUsersMap = new Map();
        mongoActiveUsers.forEach(mu => {
            activeUsersMap.set(mu.mysql_user_id, {
                recordCount: mu.recordCount,
                lastActivity: mu.lastActivity
            });
        });

        const activeUsers = allUsers
            .filter(user => activeUsersMap.has(user.id))
            .map(user => ({
                ...user,
                mongoActivity: activeUsersMap.get(user.id)
            }))
            .sort((a, b) => 
                new Date(b.mongoActivity.lastActivity) - new Date(a.mongoActivity.lastActivity)
            );

        res.json({
            success: true,
            activeUsers,
            totalActive: activeUsers.length,
            period: `${days} days`
        });
    } catch (error) {
        console.error('Active users error:', error);
        res.status(500).json({ message: "Failed to fetch active users", error: error.message });
    }
});

// Get subscription logs
router.get('/subscription-logs', adminAuth, async (req, res) => {
    try {
        const { page = 1, limit = 100, userId = null } = req.query;
        const skip = (page - 1) * limit;

        const where = userId ? { userId } : {};

        const logs = await prisma.subscriptionLog.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        username: true,
                        name: true
                    }
                },
                subscription: {
                    include: {
                        plan: true
                    }
                },
                payment: true
            },
            orderBy: { createdAt: 'desc' },
            skip: parseInt(skip),
            take: parseInt(limit)
        });

        const totalLogs = await prisma.subscriptionLog.count({ where });

        res.json({
            success: true,
            logs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalLogs,
                totalPages: Math.ceil(totalLogs / limit)
            }
        });
    } catch (error) {
        console.error('Subscription logs error:', error);
        res.status(500).json({ message: "Failed to fetch subscription logs", error: error.message });
    }
});

// Get payment details
router.get('/payments', adminAuth, async (req, res) => {
    try {
        const { page = 1, limit = 100, status = null, userId = null } = req.query;
        const skip = (page - 1) * limit;

        const where = {};
        if (status) where.status = status;
        if (userId) where.userId = userId;

        const payments = await prisma.payment.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        username: true,
                        name: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip: parseInt(skip),
            take: parseInt(limit)
        });

        const totalPayments = await prisma.payment.count({ where });

        // Calculate revenue statistics
        const revenueStats = await prisma.payment.aggregate({
            where: { status: 'COMPLETED' },
            _sum: { amount: true },
            _avg: { amount: true }
        });

        res.json({
            success: true,
            payments,
            stats: {
                totalRevenue: revenueStats._sum.amount || 0,
                averagePayment: revenueStats._avg.amount || 0
            },
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalPayments,
                totalPages: Math.ceil(totalPayments / limit)
            }
        });
    } catch (error) {
        console.error('Payments error:', error);
        res.status(500).json({ message: "Failed to fetch payments", error: error.message });
    }
});

// Get user analytics (record creation by user)
router.get('/analytics/user-records', adminAuth, async (req, res) => {
    try {
        const { userId = null, startDate = null, endDate = null } = req.query;

        // Fetch MongoDB analytics
        let mongoAnalytics = [];
        try {
            const params = new URLSearchParams();
            if (userId) params.append('userId', userId);
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);

            const billitResponse = await axios.get(
                `${process.env.BILLIT_SERVER_URL}/api/admin/user-analytics?${params.toString()}`,
                {
                    headers: {
                        'x-internal-key': process.env.INTERNAL_API_KEY
                    },
                    timeout: 5000
                }
            );
            mongoAnalytics = billitResponse.data.analytics || [];
        } catch (mongoError) {
            console.error('MongoDB analytics error:', mongoError.message);
        }

        // Get MySQL user data
        const where = userId ? { id: userId } : {};
        const users = await prisma.user.findMany({
            where,
            include: {
                subscription: {
                    include: {
                        plan: true
                    }
                },
                productAccess: true
            }
        });

        // Merge analytics with user data
        const analyticsMap = new Map();
        mongoAnalytics.forEach(ma => {
            analyticsMap.set(ma.mysql_user_id, ma);
        });

        const userAnalytics = users.map(user => ({
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                name: user.name,
                subscription: user.subscription,
                productAccess: user.productAccess
            },
            analytics: analyticsMap.get(user.id) || {
                totalRecords: 0,
                recordsByType: {},
                lastActivity: null
            }
        })).filter(ua => ua.analytics.totalRecords > 0 || !userId);

        // Calculate totals
        const totalRecords = userAnalytics.reduce((sum, ua) => sum + ua.analytics.totalRecords, 0);

        res.json({
            success: true,
            userAnalytics,
            summary: {
                totalRecords,
                totalUsers: userAnalytics.length,
                averageRecordsPerUser: userAnalytics.length > 0 ? totalRecords / userAnalytics.length : 0
            }
        });
    } catch (error) {
        console.error('User analytics error:', error);
        res.status(500).json({ message: "Failed to fetch user analytics", error: error.message });
    }
});

// Get overall analytics
router.get('/analytics/overall', adminAuth, async (req, res) => {
    try {
        const { period = '30' } = req.query; // days
        const periodDays = parseInt(period);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - periodDays);

        // MySQL analytics
        const userGrowth = await prisma.user.groupBy({
            by: ['createdAt'],
            _count: true,
            where: {
                createdAt: { gte: startDate }
            }
        });

        const subscriptionGrowth = await prisma.subscription.groupBy({
            by: ['createdAt'],
            _count: true,
            where: {
                createdAt: { gte: startDate }
            }
        });

        const revenueByDay = await prisma.payment.groupBy({
            by: ['createdAt'],
            where: {
                createdAt: { gte: startDate },
                status: 'COMPLETED'
            },
            _sum: { amount: true },
            _count: true
        });

        // MongoDB analytics
        let mongoOverallStats = {};
        try {
            const billitResponse = await axios.get(
                `${process.env.BILLIT_SERVER_URL}/api/admin/overall-analytics?days=${periodDays}`,
                {
                    headers: {
                        'x-internal-key': process.env.INTERNAL_API_KEY
                    },
                    timeout: 5000
                }
            );
            mongoOverallStats = billitResponse.data || {};
        } catch (mongoError) {
            console.error('MongoDB overall analytics error:', mongoError.message);
        }

        res.json({
            success: true,
            period: `${periodDays} days`,
            mysql: {
                userGrowth,
                subscriptionGrowth,
                revenueByDay
            },
            mongodb: mongoOverallStats
        });
    } catch (error) {
        console.error('Overall analytics error:', error);
        res.status(500).json({ message: "Failed to fetch overall analytics", error: error.message });
    }
});

// Delete user completely (from both MySQL and MongoDB)
router.delete('/user/:userId', adminAuth, async (req, res) => {
    try {
        const { userId } = req.params;

        // Verify user exists
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                subscription: true,
                productAccess: true,
                payments: true,
                logs: true
            }
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const deletionSummary = {
            mysql: {
                productAccess: 0,
                payments: 0,
                subscriptions: 0,
                branches: 0,
                users: 0,
                subscriptionLogs: 0 // Count only, not deleted (kept for audit)
            },
            mongodb: {
                success: false,
                details: {}
            }
        };

        // Step 1: Delete from MongoDB first (this will handle all MongoDB collections)
        let mongoDeleteSuccess = false;
        let mongoDeleteError = null;
        
        try {
            console.log(`Attempting to delete MongoDB data for user: ${userId}`);
            const mongoResponse = await axios.delete(
                `${process.env.BILLIT_SERVER_URL}/api/admin/user/${userId}`,
                {
                    headers: {
                        'x-internal-key': process.env.INTERNAL_API_KEY
                    },
                    timeout: 30000 // Increased timeout for large datasets
                }
            );
            
            mongoDeleteSuccess = mongoResponse.data.success;
            deletionSummary.mongodb.success = true;
            deletionSummary.mongodb.details = mongoResponse.data.deletedCounts || {};
            console.log('✅ MongoDB deletion successful:', mongoResponse.data);
        } catch (mongoError) {
            mongoDeleteError = mongoError.message;
            console.error('❌ MongoDB deletion error:', mongoError.response?.data || mongoError.message);
            deletionSummary.mongodb.error = mongoError.response?.data?.message || mongoError.message;
            
            // Don't continue with MySQL deletion if MongoDB fails
            // This ensures data consistency
            return res.status(500).json({
                success: false,
                message: "Failed to delete user from MongoDB. Aborting to maintain data consistency.",
                error: mongoDeleteError,
                details: mongoError.response?.data
            });
        }

        // Step 2: Delete from MySQL (only if MongoDB deletion succeeded)
        try {
            // Delete product access
            const productAccessDeleted = await prisma.productAccess.deleteMany({
                where: { userId }
            });
            deletionSummary.mysql.productAccess = productAccessDeleted.count;

            // Delete payments (keep for audit trail, or delete if required)
            const paymentsDeleted = await prisma.payment.deleteMany({
                where: { userId }
            });
            deletionSummary.mysql.payments = paymentsDeleted.count;

            // Delete active subscription (this removes from active subscription count)
            const subscriptionsDeleted = await prisma.subscription.deleteMany({
                where: { 
                    User: { 
                        some: { id: userId } 
                    } 
                }
            });
            deletionSummary.mysql.subscriptions = subscriptionsDeleted.count;

            // Delete subscription logs (required to avoid foreign key constraint)
            // Note: We delete these to allow user deletion, but they could be kept if schema had onDelete: SetNull
            const logsDeleted = await prisma.subscriptionLog.deleteMany({
                where: { userId }
            });
            deletionSummary.mysql.subscriptionLogs = logsDeleted.count;

            // Delete branches owned by user (optional - only if Branch table exists)
            try {
                const branchesDeleted = await prisma.branch.deleteMany({
                    where: { 
                        OR: [
                            { ownerId: userId },
                            { adminUserId: userId }
                        ]
                    }
                });
                deletionSummary.mysql.branches = branchesDeleted.count;
            } catch (branchError) {
                // Branch table doesn't exist in this database - skip
                console.log('⚠️ Branch table not found, skipping branch deletion');
                deletionSummary.mysql.branches = 0;
            }

            // Finally delete user
            await prisma.user.delete({
                where: { id: userId }
            });
            deletionSummary.mysql.users = 1;

            // Add user to blacklist to invalidate any existing JWT tokens
            blacklistUser(userId);

            console.log('✅ MySQL deletion successful:', deletionSummary.mysql);

            res.json({
                success: true,
                message: "User and all associated data deleted successfully from both databases",
                deletedUser: {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    name: user.name
                },
                deletionSummary,
                warning: mongoDeleteSuccess ? null : "MongoDB deletion had issues but MySQL completed",
                auditNote: `Subscription logs (${deletionSummary.mysql.subscriptionLogs} records) kept for audit trail and compliance`,
                note: "User's active sessions have been invalidated. The user cannot access the system anymore, even with existing JWT tokens."
            });
        } catch (mysqlError) {
            console.error('❌ MySQL deletion error:', mysqlError);
            
            // This is a critical state - MongoDB is deleted but MySQL failed
            // Log this for manual intervention
            console.error('⚠️ CRITICAL: MongoDB deleted but MySQL deletion failed for user:', userId);
            
            res.status(500).json({
                success: false,
                message: "Critical error: MongoDB data deleted but MySQL deletion failed. Manual intervention required.",
                error: mysqlError.message,
                userId,
                deletionSummary
            });
        }
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ 
            message: "Failed to delete user", 
            error: error.message,
            stack: process.env.NODE_ENV === 'local' ? error.stack : undefined
        });
    }
});

// Get user detail by ID
router.get('/user/:userId', adminAuth, async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                subscription: {
                    include: {
                        plan: true
                    }
                },
                productAccess: true,
                payments: {
                    orderBy: { createdAt: 'desc' }
                },
                logs: {
                    orderBy: { createdAt: 'desc' },
                    take: 50
                }
            }
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Get MongoDB data
        let mongoData = null;
        try {
            const billitResponse = await axios.get(
                `${process.env.BILLIT_SERVER_URL}/api/admin/user/${userId}`,
                {
                    headers: {
                        'x-internal-key': process.env.INTERNAL_API_KEY
                    },
                    timeout: 5000
                }
            );
            mongoData = billitResponse.data;
        } catch (mongoError) {
            console.error('MongoDB user data error:', mongoError.message);
        }

        res.json({
            success: true,
            user,
            mongoData
        });
    } catch (error) {
        console.error('Get user detail error:', error);
        res.status(500).json({ message: "Failed to fetch user details", error: error.message });
    }
});

// ✅ Update user session limit
router.patch('/users/:userId/session-limit', adminAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        const { sessionLimit } = req.body;

        if (!sessionLimit || sessionLimit < 1 || sessionLimit > 10) {
            return res.status(400).json({ 
                success: false, 
                message: 'Session limit must be between 1 and 10' 
            });
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: { sessionLimit: parseInt(sessionLimit) },
            select: {
                id: true,
                email: true,
                username: true,
                sessionLimit: true
            }
        });

        res.json({
            success: true,
            message: 'Session limit updated successfully',
            user
        });
    } catch (error) {
        console.error('Update session limit error:', error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to update session limit", 
            error: error.message 
        });
    }
});

// ✅ Get user session limit (for auth server)
router.get('/get-user-session-limit/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { sessionLimit: true }
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            sessionLimit: user.sessionLimit || 1
        });
    } catch (err) {
        console.error('❌ Error fetching session limit:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch session limit' });
    }
});

// ✅ Toggle deactivation of a user's account (admin-only)
// Body: { isDeactivated: boolean, reason?: string }
router.patch('/users/:userId/deactivate', adminAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        const { isDeactivated, reason } = req.body;

        if (typeof isDeactivated !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'isDeactivated must be a boolean'
            });
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                isDeactivated,
                deactivatedAt: isDeactivated ? new Date() : null,
                deactivatedReason: isDeactivated ? (reason || null) : null
            },
            select: {
                id: true,
                email: true,
                username: true,
                isDeactivated: true,
                deactivatedAt: true,
                deactivatedReason: true
            }
        });

        // The isDeactivated flag is checked in authenticateToken on every request,
        // so active sessions/tokens are rejected immediately without needing a blacklist entry
        // (which would show a misleading "Account has been deleted" message).

        // Also kill any active BillitServer sessions so the user is logged out on all devices.
        if (isDeactivated) {
            try {
                await axios.post(
                    `${process.env.BILLIT_SERVER_URL}/api/admin/invalidate-user-sessions/${userId}`,
                    {},
                    { headers: { 'x-internal-key': process.env.INTERNAL_API_KEY } }
                );
            } catch (err) {
                console.warn('⚠️ Failed to invalidate BillitServer sessions:', err?.response?.data || err.message);
            }
        }

        res.json({
            success: true,
            message: isDeactivated ? 'User account deactivated.' : 'User account reactivated.',
            user
        });
    } catch (error) {
        console.error('Deactivate user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update deactivation status',
            error: error.message
        });
    }
});

// ✅ Admin: manually activate/recover subscription for a user
// Use this to fix users who paid via Razorpay but subscription wasn't created
// (e.g. page close / network drop after payment before create-subscription was called)
router.post('/manual-activate-subscription', adminAuth, async (req, res) => {
    const { email, userId: directUserId, mongoPlanId, mongoCategoryId, amount = 0, note } = req.body;

    if (!mongoPlanId || !mongoCategoryId) {
        return res.status(400).json({ message: "mongoPlanId and mongoCategoryId are required" });
    }
    if (!email && !directUserId) {
        return res.status(400).json({ message: "Either email or userId is required" });
    }

    try {
        // Resolve user
        let userId = directUserId;
        if (!userId && email) {
            const user = await prisma.user.findUnique({ where: { email } });
            if (!user) {
                return res.status(404).json({ message: `No user found with email: ${email}` });
            }
            userId = user.id;
        }

        // Call internal activation endpoint
        const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.AUTH_PORT || 7000}`;
        const activateRes = await axios.post(
            `${serverUrl}/internal-activate-subscription`,
            { userId, mongoPlanId, mongoCategoryId, amount, paymentId: note || `admin-manual-${Date.now()}` },
            { headers: { "x-internal-key": process.env.INTERNAL_API_KEY } }
        );

        // Log admin action
        try {
            await prisma.subscriptionLog.create({
                data: {
                    userId,
                    action: "SUBSCRIPTION_STARTED",
                    message: `[ADMIN MANUAL] Subscription manually activated by admin${note ? ` — reason: ${note}` : ''}`,
                    metadata: { mongoPlanId, mongoCategoryId, amount, adminAction: true }
                }
            });
        } catch (logErr) {
            console.warn("⚠️ Failed to log admin manual activation:", logErr.message);
        }

        return res.json({
            success: true,
            message: `Subscription activated for user ${email || userId}`,
            result: activateRes.data
        });

    } catch (err) {
        console.error("❌ Admin manual activation error:", err.response?.data || err.message);
        return res.status(500).json({
            success: false,
            message: "Manual activation failed",
            error: err.response?.data?.message || err.message
        });
    }
});

// ============================================================
// 💬 WhatsApp / MSG91 admin proxies (admin dashboard -> BillitServer)
// ============================================================

router.get('/shops/whatsapp', adminAuth, async (req, res) => {
    try {
        const billitResp = await axios.get(
            `${process.env.BILLIT_SERVER_URL}/api/admin/shops/whatsapp`,
            { headers: { 'x-internal-key': process.env.INTERNAL_API_KEY }, timeout: 8000 }
        );
        return res.json(billitResp.data);
    } catch (err) {
        console.error('Admin proxy /shops/whatsapp error:', err.response?.data || err.message);
        return res.status(err.response?.status || 500).json({
            message: 'Failed to load shop WhatsApp settings',
            error: err.response?.data || err.message,
        });
    }
});

router.get('/shops/:shopId/whatsapp/logs', adminAuth, async (req, res) => {
    try {
        const billitResp = await axios.get(
            `${process.env.BILLIT_SERVER_URL}/api/admin/shops/${req.params.shopId}/whatsapp/logs`,
            {
                headers: { 'x-internal-key': process.env.INTERNAL_API_KEY },
                params: req.query,
                timeout: 8000,
            }
        );
        return res.json(billitResp.data);
    } catch (err) {
        console.error('Admin proxy /shops/:id/whatsapp/logs error:', err.response?.data || err.message);
        return res.status(err.response?.status || 500).json({
            message: 'Failed to load WhatsApp logs',
            error: err.response?.data || err.message,
        });
    }
});

router.patch('/shops/:shopId/whatsapp', adminAuth, async (req, res) => {
    try {
        const billitResp = await axios.patch(
            `${process.env.BILLIT_SERVER_URL}/api/admin/shops/${req.params.shopId}/whatsapp`,
            req.body,
            { headers: { 'x-internal-key': process.env.INTERNAL_API_KEY }, timeout: 8000 }
        );
        return res.json(billitResp.data);
    } catch (err) {
        console.error('Admin proxy PATCH /shops/:id/whatsapp error:', err.response?.data || err.message);
        return res.status(err.response?.status || 500).json({
            message: 'Failed to update shop WhatsApp settings',
            error: err.response?.data || err.message,
        });
    }
});

router.get('/shops/:shopId/whatsapp/invoice', adminAuth, async (req, res) => {
    try {
        const billitResp = await axios.get(
            `${process.env.BILLIT_SERVER_URL}/api/admin/shops/${req.params.shopId}/whatsapp/invoice`,
            {
                headers: { 'x-internal-key': process.env.INTERNAL_API_KEY },
                params: req.query,
                timeout: 8000,
            }
        );
        return res.json(billitResp.data);
    } catch (err) {
        console.error('Admin proxy /shops/:id/whatsapp/invoice error:', err.response?.data || err.message);
        return res.status(err.response?.status || 500).json({
            message: 'Failed to generate WhatsApp invoice',
            error: err.response?.data || err.message,
        });
    }
});

// ============================================================
// 🖥️ Product UI Mode (legacy vs spares) — proxy to BillitServer
// ============================================================

// List all shops with their product UI mode
router.get('/shops/product-ui', adminAuth, async (req, res) => {
    try {
        const billitResp = await axios.get(
            `${process.env.BILLIT_SERVER_URL}/api/admin/shops/product-ui`,
            { headers: { 'x-internal-key': process.env.INTERNAL_API_KEY }, timeout: 8000 }
        );
        return res.json(billitResp.data);
    } catch (err) {
        console.error('Admin proxy GET /shops/product-ui error:', err.response?.data || err.message);
        return res.status(err.response?.status || 500).json({
            message: 'Failed to load product UI settings',
            error: err.response?.data || err.message,
        });
    }
});

// Toggle product UI mode for a specific shop
router.patch('/shops/:shopId/product-ui', adminAuth, async (req, res) => {
    try {
        const billitResp = await axios.patch(
            `${process.env.BILLIT_SERVER_URL}/api/admin/shops/${req.params.shopId}/product-ui`,
            req.body,
            { headers: { 'x-internal-key': process.env.INTERNAL_API_KEY }, timeout: 8000 }
        );
        return res.json(billitResp.data);
    } catch (err) {
        console.error('Admin proxy PATCH /shops/:id/product-ui error:', err.response?.data || err.message);
        return res.status(err.response?.status || 500).json({
            message: 'Failed to update product UI setting',
            error: err.response?.data || err.message,
        });
    }
});

module.exports = router;

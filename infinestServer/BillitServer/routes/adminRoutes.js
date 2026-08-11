const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { blacklistUser } = require('../utils/tokenBlacklist');
const SessionManager = require('../utils/sessionManager');
const {
    User,
    Shop,
    Mobile,
    Customer,
    Dealer,
    Product,
    Role,
    Manager,
    Technician,
    Notification,
    AdminSale,
    MobileBrand,
    MobileIssue,
    ProductHistory,
    SupplierHistory,
    Expense,
    DailySummary,
    Branch,
    WhatsAppLog
} = require('../models/mongoModels');
const { Supplier } = require('../models/supplier');

// Middleware to verify internal API calls
const internalAuth = (req, res, next) => {
    const apiKey = req.headers['x-internal-key'];
    if (apiKey !== process.env.INTERNAL_API_KEY) {
        return res.status(403).json({ message: 'Unauthorized' });
    }
    next();
};

// Force logout: terminate all active sessions for a user (used by admin deactivation).
router.post('/invalidate-user-sessions/:userId', internalAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });
        const result = await SessionManager.invalidateSession(userId);
        res.json({ success: true, deletedCount: result?.deletedCount || 0 });
    } catch (err) {
        console.error('❌ Failed to invalidate user sessions:', err);
        res.status(500).json({ success: false, message: 'Failed to invalidate sessions', error: err.message });
    }
});

// Get active users (users with recent record creation activity)
router.get('/active-users', internalAuth, async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(days));

        // Find all shops with recent activity
        const recentMobiles = await Mobile.aggregate([
            {
                $match: {
                    created_at: { $gte: daysAgo }
                }
            },
            {
                $lookup: {
                    from: 'shops',
                    localField: 'shop_id',
                    foreignField: '_id',
                    as: 'shop'
                }
            },
            {
                $unwind: '$shop'
            },
            {
                $group: {
                    _id: '$shop.mysql_user_id',
                    recordCount: { $sum: 1 },
                    lastActivity: { $max: '$created_at' }
                }
            }
        ]);

        // Find users with product additions
        const recentProducts = await Product.aggregate([
            {
                $match: {
                    addedDate: { $gte: daysAgo }
                }
            },
            {
                $group: {
                    _id: '$userId',
                    recordCount: { $sum: 1 },
                    lastActivity: { $max: '$addedDate' }
                }
            }
        ]);

        // Merge activities
        const activityMap = new Map();
        
        recentMobiles.forEach(item => {
            const userId = item._id;
            if (!activityMap.has(userId)) {
                activityMap.set(userId, {
                    mysql_user_id: userId,
                    recordCount: 0,
                    lastActivity: null
                });
            }
            const current = activityMap.get(userId);
            current.recordCount += item.recordCount;
            if (!current.lastActivity || item.lastActivity > current.lastActivity) {
                current.lastActivity = item.lastActivity;
            }
        });

        // Convert ObjectId userId to string for products
        recentProducts.forEach(item => {
            const userId = item._id.toString();
            if (!activityMap.has(userId)) {
                activityMap.set(userId, {
                    mysql_user_id: userId,
                    recordCount: 0,
                    lastActivity: null
                });
            }
            const current = activityMap.get(userId);
            current.recordCount += item.recordCount;
            if (!current.lastActivity || item.lastActivity > current.lastActivity) {
                current.lastActivity = item.lastActivity;
            }
        });

        const activeUsers = Array.from(activityMap.values());

        res.json({
            success: true,
            activeUsers,
            totalActive: activeUsers.length
        });
    } catch (error) {
        console.error('Active users error:', error);
        res.status(500).json({ message: 'Failed to fetch active users', error: error.message });
    }
});

// Get user analytics (record creation statistics)
router.get('/user-analytics', internalAuth, async (req, res) => {
    try {
        const { userId, startDate, endDate } = req.query;

        const dateFilter = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) dateFilter.$lte = new Date(endDate);

        let shopFilter = {};
        if (userId) {
            // Find shops for this user
            const shops = await Shop.find({ mysql_user_id: userId });
            const shopIds = shops.map(s => s._id);
            shopFilter = { shop_id: { $in: shopIds } };
        }

        // Mobile records analytics
        const mobileQuery = { ...shopFilter };
        if (Object.keys(dateFilter).length > 0) {
            mobileQuery.created_at = dateFilter;
        }

        const mobileStats = await Mobile.aggregate([
            { $match: mobileQuery },
            {
                $lookup: {
                    from: 'shops',
                    localField: 'shop_id',
                    foreignField: '_id',
                    as: 'shop'
                }
            },
            { $unwind: '$shop' },
            {
                $group: {
                    _id: '$shop.mysql_user_id',
                    mobileCount: { $sum: 1 },
                    delivered: { $sum: { $cond: ['$delivered', 1, 0] } },
                    ready: { $sum: { $cond: ['$ready', 1, 0] } },
                    pending: { $sum: { $cond: [{ $and: [{ $eq: ['$delivered', false] }, { $eq: ['$ready', false] }] }, 1, 0] } },
                    totalRevenue: { $sum: '$paid_amount' },
                    lastActivity: { $max: '$created_at' }
                }
            }
        ]);

        // Product analytics
        const productQuery = userId ? { userId } : {};
        if (Object.keys(dateFilter).length > 0) {
            productQuery.addedDate = dateFilter;
        }

        const productStats = await Product.aggregate([
            { $match: productQuery },
            {
                $group: {
                    _id: '$userId',
                    productCount: { $sum: 1 },
                    totalInventoryValue: { $sum: '$totalCost' },
                    lastActivity: { $max: '$addedDate' }
                }
            }
        ]);

        // Customer analytics
        const customerStats = await Customer.aggregate([
            { $match: shopFilter },
            {
                $lookup: {
                    from: 'shops',
                    localField: 'shop_id',
                    foreignField: '_id',
                    as: 'shop'
                }
            },
            { $unwind: '$shop' },
            {
                $group: {
                    _id: '$shop.mysql_user_id',
                    customerCount: { $sum: 1 },
                    totalBalance: { $sum: '$balance_amount' }
                }
            }
        ]);

        // Dealer analytics
        const dealerStats = await Dealer.aggregate([
            { $match: shopFilter },
            {
                $lookup: {
                    from: 'shops',
                    localField: 'shop_id',
                    foreignField: '_id',
                    as: 'shop'
                }
            },
            { $unwind: '$shop' },
            {
                $group: {
                    _id: '$shop.mysql_user_id',
                    dealerCount: { $sum: 1 },
                    totalBalance: { $sum: '$balance_amount' }
                }
            }
        ]);

        // Merge all stats
        const analyticsMap = new Map();

        mobileStats.forEach(stat => {
            analyticsMap.set(stat._id, {
                mysql_user_id: stat._id,
                totalRecords: stat.mobileCount,
                recordsByType: {
                    mobiles: {
                        total: stat.mobileCount,
                        delivered: stat.delivered,
                        ready: stat.ready,
                        pending: stat.pending,
                        revenue: stat.totalRevenue
                    }
                },
                lastActivity: stat.lastActivity
            });
        });

        productStats.forEach(stat => {
            const userId = stat._id.toString();
            if (!analyticsMap.has(userId)) {
                analyticsMap.set(userId, {
                    mysql_user_id: userId,
                    totalRecords: 0,
                    recordsByType: {},
                    lastActivity: null
                });
            }
            const current = analyticsMap.get(userId);
            current.totalRecords += stat.productCount;
            current.recordsByType.products = {
                total: stat.productCount,
                inventoryValue: stat.totalInventoryValue
            };
            if (!current.lastActivity || stat.lastActivity > current.lastActivity) {
                current.lastActivity = stat.lastActivity;
            }
        });

        customerStats.forEach(stat => {
            if (analyticsMap.has(stat._id)) {
                analyticsMap.get(stat._id).recordsByType.customers = {
                    total: stat.customerCount,
                    totalBalance: stat.totalBalance
                };
            }
        });

        dealerStats.forEach(stat => {
            if (analyticsMap.has(stat._id)) {
                analyticsMap.get(stat._id).recordsByType.dealers = {
                    total: stat.dealerCount,
                    totalBalance: stat.totalBalance
                };
            }
        });

        const analytics = Array.from(analyticsMap.values());

        res.json({
            success: true,
            analytics
        });
    } catch (error) {
        console.error('User analytics error:', error);
        res.status(500).json({ message: 'Failed to fetch user analytics', error: error.message });
    }
});

// Get overall analytics
router.get('/overall-analytics', internalAuth, async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(days));

        // Total counts
        const totalShops = await Shop.countDocuments();
        const totalMobiles = await Mobile.countDocuments();
        const totalCustomers = await Customer.countDocuments();
        const totalDealers = await Dealer.countDocuments();
        const totalProducts = await Product.countDocuments();

        // Recent activity
        const recentMobiles = await Mobile.countDocuments({ created_at: { $gte: daysAgo } });
        const recentProducts = await Product.countDocuments({ addedDate: { $gte: daysAgo } });

        // Revenue stats
        const revenueStats = await Mobile.aggregate([
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$paid_amount' },
                    averagePayment: { $avg: '$paid_amount' }
                }
            }
        ]);

        // Mobiles by status
        const mobilesByStatus = await Mobile.aggregate([
            {
                $group: {
                    _id: {
                        delivered: '$delivered',
                        ready: '$ready'
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Daily activity for the period
        const dailyActivity = await Mobile.aggregate([
            {
                $match: { created_at: { $gte: daysAgo } }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$created_at' }
                    },
                    count: { $sum: 1 },
                    revenue: { $sum: '$paid_amount' }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        res.json({
            success: true,
            totals: {
                shops: totalShops,
                mobiles: totalMobiles,
                customers: totalCustomers,
                dealers: totalDealers,
                products: totalProducts
            },
            recentActivity: {
                mobiles: recentMobiles,
                products: recentProducts
            },
            revenue: revenueStats[0] || { totalRevenue: 0, averagePayment: 0 },
            mobilesByStatus,
            dailyActivity
        });
    } catch (error) {
        console.error('Overall analytics error:', error);
        res.status(500).json({ message: 'Failed to fetch overall analytics', error: error.message });
    }
});

// Get user details from MongoDB
router.get('/user/:userId', internalAuth, async (req, res) => {
    try {
        const { userId } = req.params; // This is mysql_user_id (UUID)

        // Find MongoDB User using mysql_user_id
        const mongoUsers = await User.find({ mysql_user_id: userId }).lean();
        const mongoUserIds = mongoUsers.map(u => u._id);

        // Find user's shops
        const shops = await Shop.find({ mysql_user_id: userId }).lean();
        const shopIds = shops.map(s => s._id);

        // Find user's role
        const role = await Role.findOne({ mysql_user_id: userId }).lean();

        // Find products using MongoDB User ObjectId (not MySQL UUID)
        let products = [];
        if (mongoUserIds.length > 0) {
            products = await Product.find({ userId: { $in: mongoUserIds } }).lean();
        }

        // Find suppliers
        let suppliers = [];
        if (mongoUserIds.length > 0) {
            suppliers = await Supplier.find({ userId: { $in: mongoUserIds } }).lean();
        }

        // Find expenses
        let expenses = [];
        if (mongoUserIds.length > 0) {
            const { Expense } = require('../models/mongoModels');
            expenses = await Expense.find({ userId: { $in: mongoUserIds } })
                .sort({ createdAt: -1 })
                .limit(10)
                .lean();
        }

        // Count records for each shop
        const shopData = await Promise.all(shops.map(async (shop) => {
            const mobileCount = await Mobile.countDocuments({ shop_id: shop._id });
            const customerCount = await Customer.countDocuments({ shop_id: shop._id });
            const dealerCount = await Dealer.countDocuments({ shop_id: shop._id });
            
            const recentMobiles = await Mobile.find({ shop_id: shop._id })
                .sort({ created_at: -1 })
                .limit(10)
                .lean();

            return {
                ...shop,
                stats: {
                    mobiles: mobileCount,
                    customers: customerCount,
                    dealers: dealerCount
                },
                recentMobiles
            };
        }));

        res.json({
            success: true,
            role,
            shops: shopData,
            products: {
                count: products.length,
                items: products
            },
            suppliers: {
                count: suppliers.length,
                items: suppliers
            },
            expenses: {
                count: expenses.length,
                recentItems: expenses
            },
            mongoUsers: mongoUsers.length
        });
    } catch (error) {
        console.error('Get user MongoDB data error:', error);
        res.status(500).json({ message: 'Failed to fetch user data', error: error.message });
    }
});

// Delete user from MongoDB
router.delete('/user/:userId', internalAuth, async (req, res) => {
    try {
        const { userId } = req.params; // This is mysql_user_id

        // Step 1: Find MongoDB User using mysql_user_id
        const mongoUsers = await User.find({ mysql_user_id: userId });
        const mongoUserIds = mongoUsers.map(u => u._id);

        // Step 2: Find user's shops using mysql_user_id
        const shops = await Shop.find({ mysql_user_id: userId });
        const shopIds = shops.map(s => s._id);

        // Step 3: Find user's role
        const roles = await Role.find({ mysql_user_id: userId });
        const roleIds = roles.map(r => r._id);

        // Step 4: Find manager data if user is a manager
        const managers = await Manager.find({ mysql_user_id: userId });
        const managerIds = managers.map(m => m._id);

        // Deletion counts
        const deletedCounts = {
            mongoUsers: 0,
            shops: 0,
            mobiles: 0,
            customers: 0,
            dealers: 0,
            technicians: 0,
            notifications: 0,
            products: 0,
            productHistory: 0,
            suppliers: 0,
            supplierHistory: 0,
            expenses: 0,
            dailySummaries: 0,
            adminSales: 0,
            mobileBrands: 0,
            mobileIssues: 0,
            branches: 0,
            managers: 0,
            roles: 0
        };

        // Step 5: Delete all shop-related data
        if (shopIds.length > 0) {
            // Delete mobiles in these shops
            const mobileResult = await Mobile.deleteMany({ shop_id: { $in: shopIds } });
            deletedCounts.mobiles = mobileResult.deletedCount || 0;

            // Delete customers in these shops
            const customerResult = await Customer.deleteMany({ shop_id: { $in: shopIds } });
            deletedCounts.customers = customerResult.deletedCount || 0;

            // Delete dealers in these shops
            const dealerResult = await Dealer.deleteMany({ shop_id: { $in: shopIds } });
            deletedCounts.dealers = dealerResult.deletedCount || 0;

            // Delete technicians in these shops
            const technicianResult = await Technician.deleteMany({ shop_id: { $in: shopIds } });
            deletedCounts.technicians = technicianResult.deletedCount || 0;

            // Delete notifications for these shops
            const notificationResult = await Notification.deleteMany({ shop_id: { $in: shopIds } });
            deletedCounts.notifications = notificationResult.deletedCount || 0;

            // Delete admin sales for these shops
            const adminSaleResult = await AdminSale.deleteMany({ shop_id: { $in: shopIds } });
            deletedCounts.adminSales = adminSaleResult.deletedCount || 0;

            // Delete mobile brands for these shops
            const brandResult = await MobileBrand.deleteMany({ shop_id: { $in: shopIds } });
            deletedCounts.mobileBrands = brandResult.deletedCount || 0;

            // Delete mobile issues for these shops
            const issueResult = await MobileIssue.deleteMany({ shop_id: { $in: shopIds } });
            deletedCounts.mobileIssues = issueResult.deletedCount || 0;

            // Delete shops
            const shopResult = await Shop.deleteMany({ mysql_user_id: userId });
            deletedCounts.shops = shopResult.deletedCount || 0;
        }

        // Step 6: Delete user-related data using MongoDB User ObjectId
        if (mongoUserIds.length > 0) {
            // Delete products created by this user
            const productResult = await Product.deleteMany({ userId: { $in: mongoUserIds } });
            deletedCounts.products = productResult.deletedCount || 0;

            // Delete product history
            const productHistoryResult = await ProductHistory.deleteMany({ 
                productId: { $in: await Product.find({ userId: { $in: mongoUserIds } }).distinct('_id') }
            });
            deletedCounts.productHistory = productHistoryResult.deletedCount || 0;

            // Delete suppliers
            const supplierIds = await Supplier.find({ userId: { $in: mongoUserIds } }).distinct('_id');
            const supplierResult = await Supplier.deleteMany({ userId: { $in: mongoUserIds } });
            deletedCounts.suppliers = supplierResult.deletedCount || 0;

            // Delete supplier history
            const supplierHistoryResult = await SupplierHistory.deleteMany({ 
                supplierId: { $in: supplierIds }
            });
            deletedCounts.supplierHistory = supplierHistoryResult.deletedCount || 0;

            // Delete expenses
            const expenseResult = await Expense.deleteMany({ userId: { $in: mongoUserIds } });
            deletedCounts.expenses = expenseResult.deletedCount || 0;

            // Delete daily summaries
            const summaryResult = await DailySummary.deleteMany({ userId: { $in: mongoUserIds } });
            deletedCounts.dailySummaries = summaryResult.deletedCount || 0;
        }

        // Step 7: Delete manager-related data
        if (managerIds.length > 0) {
            // Delete branches managed by this manager
            const branchResult = await Branch.deleteMany({ manager_id: { $in: managerIds } });
            deletedCounts.branches = branchResult.deletedCount || 0;

            // Delete manager records
            const managerResult = await Manager.deleteMany({ mysql_user_id: userId });
            deletedCounts.managers = managerResult.deletedCount || 0;
        }

        // Step 8: Delete role
        const roleResult = await Role.deleteMany({ mysql_user_id: userId });
        deletedCounts.roles = roleResult.deletedCount || 0;

        // Step 9: Finally delete user records
        const userResult = await User.deleteMany({ mysql_user_id: userId });
        deletedCounts.mongoUsers = userResult.deletedCount || 0;

        // Step 10: Add user to blacklist to invalidate JWT tokens
        blacklistUser(userId);

        console.log('✅ MongoDB user deletion completed:', deletedCounts);

        res.json({
            success: true,
            message: 'User data completely deleted from MongoDB',
            deletedCounts
        });
    } catch (error) {
        console.error('Delete user MongoDB error:', error);
        res.status(500).json({ 
            message: 'Failed to delete user from MongoDB', 
            error: error.message,
            stack: process.env.NODE_ENV === 'local' ? error.stack : undefined
        });
    }
});

// ============================================================
// 💬 WhatsApp / MSG91 admin endpoints
// ============================================================

// List all shops with their WhatsApp config (for the admin toggles tab).
router.get('/shops/whatsapp', internalAuth, async (req, res) => {
    try {
        const shops = await Shop.find(
            {},
            'shop_name owner_name phone email location mysql_user_id whatsapp'
        ).sort({ shop_name: 1 }).lean();

        const defaultEvents = {
            record_created: true,
            mobiles_appended: true,
            mobile_ready: true,
            mobile_delivered: true,
            mobile_returned: false,
            balance_reminder: true,
        };

        // Aggregate WhatsApp send stats per shop in one query
        const statsAgg = await WhatsAppLog.aggregate([
            { $group: {
                _id: { shop_id: '$shop_id', status: '$status' },
                count: { $sum: 1 }
            } }
        ]);
        const statsByShop = {};
        statsAgg.forEach((row) => {
            const sid = row._id.shop_id ? String(row._id.shop_id) : 'none';
            if (!statsByShop[sid]) statsByShop[sid] = { sent: 0, skipped: 0, error: 0 };
            statsByShop[sid][row._id.status] = row.count;
        });

        const data = shops.map((s) => ({
            _id: s._id,
            shop_name: s.shop_name,
            owner_name: s.owner_name,
            phone: s.phone,
            email: s.email,
            location: s.location,
            mysql_user_id: s.mysql_user_id,
            whatsapp: {
                enabled: !!s.whatsapp?.enabled,
                rate_per_message: Number(s.whatsapp?.rate_per_message ?? 0.5),
                events: { ...defaultEvents, ...(s.whatsapp?.events || {}) },
            },
            wa_stats: statsByShop[String(s._id)] || { sent: 0, skipped: 0, error: 0 },
        }));

        res.json({ success: true, shops: data });
    } catch (error) {
        console.error('List shop WA settings error:', error);
        res.status(500).json({ message: 'Failed to fetch shops', error: error.message });
    }
});

// Update WhatsApp config for one shop (admin only).
// Body: { enabled?: boolean, events?: { [eventKey]: boolean } }
router.patch('/shops/:shopId/whatsapp', internalAuth, async (req, res) => {
    try {
        const { shopId } = req.params;
        const { enabled, events, rate_per_message } = req.body || {};

        const shop = await Shop.findById(shopId);
        if (!shop) return res.status(404).json({ message: 'Shop not found' });

        if (!shop.whatsapp) {
            shop.whatsapp = { enabled: false, rate_per_message: 0.5, events: {} };
        }
        if (typeof enabled === 'boolean') {
            shop.whatsapp.enabled = enabled;
        }
        if (rate_per_message !== undefined && rate_per_message !== null && !isNaN(Number(rate_per_message))) {
            const r = Number(rate_per_message);
            if (r < 0) return res.status(400).json({ message: 'rate_per_message must be >= 0' });
            shop.whatsapp.rate_per_message = r;
        }
        if (events && typeof events === 'object') {
            const allowed = [
                'record_created',
                'mobiles_appended',
                'mobile_ready',
                'mobile_delivered',
                'mobile_returned',
                'balance_reminder',
            ];
            allowed.forEach((k) => {
                if (typeof events[k] === 'boolean') {
                    shop.whatsapp.events[k] = events[k];
                }
            });
        }

        shop.markModified('whatsapp');
        await shop.save();

        res.json({
            success: true,
            shop: {
                _id: shop._id,
                shop_name: shop.shop_name,
                whatsapp: shop.whatsapp,
            },
        });
    } catch (error) {
        console.error('Update shop WA settings error:', error);
        res.status(500).json({ message: 'Failed to update WhatsApp settings', error: error.message });
    }
});

// Get recent WhatsApp logs for a specific shop (admin only).
// Query: ?limit=50&status=sent|skipped|error&event=mobile_ready
router.get('/shops/:shopId/whatsapp/logs', internalAuth, async (req, res) => {
    try {
        const { shopId } = req.params;
        const { limit = 50, status, event } = req.query;
        const filter = { shop_id: shopId };
        if (status) filter.status = status;
        if (event) filter.event = event;
        const logs = await WhatsAppLog.find(filter)
            .sort({ created_at: -1 })
            .limit(Math.min(parseInt(limit) || 50, 500))
            .lean();
        res.json({ success: true, logs });
    } catch (error) {
        console.error('Fetch WA logs error:', error);
        res.status(500).json({ message: 'Failed to fetch WhatsApp logs', error: error.message });
    }
});

// Generate WhatsApp invoice data for a shop (admin only).
// Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD  (both optional; default = current calendar month)
// Returns: shop info, rate, breakdown by event, total messages, total amount
router.get('/shops/:shopId/whatsapp/invoice', internalAuth, async (req, res) => {
    try {
        const { shopId } = req.params;
        const shop = await Shop.findById(shopId).lean();
        if (!shop) return res.status(404).json({ message: 'Shop not found' });

        let { from, to } = req.query;
        const now = new Date();
        const fromDate = from
            ? new Date(from)
            : new Date(now.getFullYear(), now.getMonth(), 1);
        const toDate = to
            ? new Date(to)
            : new Date(now.getFullYear(), now.getMonth() + 1, 1);
        // Make `to` inclusive of the chosen day if user passed a plain date
        if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
            toDate.setHours(23, 59, 59, 999);
        }

        const rate = Number(shop.whatsapp?.rate_per_message ?? 0.5);

        const breakdown = await WhatsAppLog.aggregate([
            {
                $match: {
                    shop_id: new mongoose.Types.ObjectId(shopId),
                    status: 'sent',
                    created_at: { $gte: fromDate, $lte: toDate },
                },
            },
            { $group: { _id: '$event', count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
        ]);

        const items = breakdown.map((b) => ({
            event: b._id,
            count: b.count,
            rate,
            amount: +(b.count * rate).toFixed(2),
        }));
        const totalMessages = items.reduce((s, i) => s + i.count, 0);
        const totalAmount = +(totalMessages * rate).toFixed(2);

        res.json({
            success: true,
            invoice: {
                generated_at: new Date(),
                period: { from: fromDate, to: toDate },
                shop: {
                    _id: shop._id,
                    shop_name: shop.shop_name,
                    owner_name: shop.owner_name,
                    phone: shop.phone,
                    email: shop.email,
                    location: shop.location,
                },
                rate_per_message: rate,
                items,
                total_messages: totalMessages,
                total_amount: totalAmount,
                currency: 'INR',
            },
        });
    } catch (error) {
        console.error('WA invoice error:', error);
        res.status(500).json({ message: 'Failed to generate invoice', error: error.message });
    }
});

// ==============================
// 🖥️ Product UI Mode (legacy vs spares)
// ==============================

// List all shops with their product UI mode setting
router.get('/shops/product-ui', internalAuth, async (req, res) => {
    try {
        const shops = await Shop.find(
            {},
            'shop_name owner_name email mysql_user_id use_legacy_product_ui'
        ).sort({ shop_name: 1 }).lean();

        res.json({
            success: true,
            shops: shops.map(s => ({
                _id: s._id,
                shop_name: s.shop_name,
                owner_name: s.owner_name,
                email: s.email,
                mysql_user_id: s.mysql_user_id,
                use_legacy_product_ui: !!s.use_legacy_product_ui,
            }))
        });
    } catch (error) {
        console.error('List shops product-ui error:', error);
        res.status(500).json({ message: 'Failed to fetch shops', error: error.message });
    }
});

// Toggle product UI mode for a specific shop
// Body: { use_legacy_product_ui: boolean }
router.patch('/shops/:shopId/product-ui', internalAuth, async (req, res) => {
    try {
        const { shopId } = req.params;
        const { use_legacy_product_ui } = req.body || {};

        if (typeof use_legacy_product_ui !== 'boolean') {
            return res.status(400).json({ message: 'use_legacy_product_ui must be a boolean' });
        }

        const shop = await Shop.findByIdAndUpdate(
            shopId,
            { $set: { use_legacy_product_ui } },
            { new: true }
        );
        if (!shop) return res.status(404).json({ message: 'Shop not found' });

        res.json({
            success: true,
            shop: {
                _id: shop._id,
                shop_name: shop.shop_name,
                use_legacy_product_ui: shop.use_legacy_product_ui,
            }
        });
    } catch (error) {
        console.error('Toggle product UI error:', error);
        res.status(500).json({ message: 'Failed to update product UI setting', error: error.message });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {
    Shop,
    ShopAdmin,
    Mobile,
    Customer,
    Dealer,
    Employee,
    Attendance,
    Technician,
    Product,
    Expense,
    AdminSale,
    User,
    Role
} = require('../models/mongoModels');
const { Supplier } = require('../models/supplier');

// JWT Secret for shop admins (different from regular users)
const SHOP_ADMIN_JWT_SECRET = process.env.SHOP_ADMIN_JWT_SECRET || 'shop-admin-secret-key-2024';

// Middleware to verify shop admin token
const shopAdminAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const decoded = jwt.verify(token, SHOP_ADMIN_JWT_SECRET);
        const shopAdmin = await ShopAdmin.findById(decoded.adminId).populate('shop_ids').populate('current_shop_id');

        if (!shopAdmin || !shopAdmin.is_active) {
            return res.status(401).json({ success: false, message: 'Invalid or inactive admin' });
        }

        req.shopAdmin = shopAdmin;
        // Use current_shop_id if set, otherwise use first shop or from query param
        const requestedShopId = req.query.shop_id || req.body.shop_id;
        if (requestedShopId && shopAdmin.shop_ids.some(shop => shop._id.toString() === requestedShopId)) {
            req.shopId = requestedShopId;
        } else {
            req.shopId = shopAdmin.current_shop_id?._id || shopAdmin.shop_ids[0]?._id;
        }
        
        if (!req.shopId) {
            return res.status(400).json({ success: false, message: 'No shop assigned to this admin' });
        }
        
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

// Middleware to verify internal API calls (for infinest admin to create shop admins)
const internalAuth = (req, res, next) => {
    const apiKey = req.headers['x-internal-key'];
    if (apiKey !== process.env.INTERNAL_API_KEY) {
        return res.status(403).json({ message: 'Unauthorized' });
    }
    next();
};

// ==============================
// 🔐 Shop Admin Login
// ==============================
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('🔐 Shop admin login attempt:', username);

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password required' });
        }

        // Find shop admin
        const shopAdmin = await ShopAdmin.findOne({ username, is_active: true }).populate('shop_ids');
        console.log('👤 Shop admin found:', !!shopAdmin);
        console.log('🏪 Number of shops:', shopAdmin?.shop_ids?.length || 0);
        
        if (shopAdmin && shopAdmin.shop_ids) {
            console.log('📋 Shop details from DB:');
            shopAdmin.shop_ids.forEach((shop, idx) => {
                console.log(`  Shop ${idx + 1}:`, {
                    _id: shop._id,
                    shop_name: shop.shop_name,
                    location: shop.location,
                    owner_name: shop.owner_name,
                    mysql_user_id: shop.mysql_user_id
                });
            });
        }

        if (!shopAdmin) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, shopAdmin.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Update last login
        shopAdmin.last_login = new Date();
        await shopAdmin.save();

        // Generate token
        const token = jwt.sign(
            { adminId: shopAdmin._id },
            SHOP_ADMIN_JWT_SECRET,
            { expiresIn: '7d' }
        );

        const responseData = {
            success: true,
            token,
            shopAdmin: {
                id: shopAdmin._id,
                username: shopAdmin.username,
                full_name: shopAdmin.full_name,
                email: shopAdmin.email,
                shops: shopAdmin.shop_ids.map(shop => ({
                    id: shop._id,
                    name: shop.shop_name,
                    location: shop.location,
                    owner_name: shop.owner_name
                })),
                current_shop_id: shopAdmin.current_shop_id
            }
        };

        console.log('✅ Login successful, returning data:', JSON.stringify(responseData.shopAdmin, null, 2));
        res.json(responseData);
    } catch (error) {
        console.error('❌ Shop admin login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ==============================
// 📊 Dashboard Overview
// ==============================
router.get('/dashboard/overview', shopAdminAuth, async (req, res) => {
    try {
        const shopId = req.shopId;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get counts
        const [
            totalEmployees,
            totalCustomers,
            totalDealers,
            totalMobiles,
            pendingRepairs,
            todayMobiles,
            totalProducts,
            totalTechnicians
        ] = await Promise.all([
            Employee.countDocuments({ shop_id: shopId }),
            Customer.countDocuments({ shop_id: shopId }),
            Dealer.countDocuments({ shop_id: shopId }),
            Mobile.countDocuments({ shop_id: shopId }),
            Mobile.countDocuments({ shop_id: shopId, ready: false, delivered: false }),
            Mobile.countDocuments({ shop_id: shopId, created_at: { $gte: today } }),
            Product.countDocuments({ shop_id: shopId }),
            Technician.countDocuments({ shop_id: shopId })
        ]);

        // Calculate today's revenue
        const todayMobilesWithRevenue = await Mobile.find({
            shop_id: shopId,
            created_at: { $gte: today },
            paid_amount: { $gt: 0 }
        });

        const todayRevenue = todayMobilesWithRevenue.reduce((sum, mobile) => sum + (mobile.paid_amount || 0), 0);

        // Get recent activities
        const recentMobiles = await Mobile.find({ shop_id: shopId })
            .sort({ created_at: -1 })
            .limit(10)
            .populate('customer_id dealer_id', 'client_name mobile_number');

        res.json({
            success: true,
            overview: {
                totalEmployees,
                totalCustomers,
                totalDealers,
                totalMobiles,
                pendingRepairs,
                todayMobiles,
                todayRevenue,
                totalProducts,
                totalTechnicians
            },
            recentActivities: recentMobiles
        });
    } catch (error) {
        console.error('Dashboard overview error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ==============================
// 👥 Employee Management
// ==============================
router.get('/employees', shopAdminAuth, async (req, res) => {
    try {
        const employees = await Employee.find({ shop_id: req.shopId }).sort({ created_at: -1 });

        // Get attendance stats for each employee (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const employeesWithStats = await Promise.all(
            employees.map(async (employee) => {
                const attendanceRecords = await Attendance.find({
                    employee_id: employee._id,
                    date: { $gte: thirtyDaysAgo.toISOString().split('T')[0] }
                });

                const presentDays = attendanceRecords.filter(a => a.status === 'present').length;
                const absentDays = attendanceRecords.filter(a => a.status === 'absent').length;
                const attendanceRate = attendanceRecords.length > 0 
                    ? ((presentDays / attendanceRecords.length) * 100).toFixed(1)
                    : 0;

                const empObj = employee.toObject();
                return {
                    ...empObj,
                    name: empObj.employee_name,
                    phone_number: empObj.mobile_number,
                    employee_id: empObj._id,
                    stats: {
                        presentDays,
                        absentDays,
                        totalDays: attendanceRecords.length,
                        attendanceRate: parseFloat(attendanceRate)
                    }
                };
            })
        );

        res.json({ success: true, employees: employeesWithStats });
    } catch (error) {
        console.error('Get employees error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get employee details with full attendance history
router.get('/employees/:employeeId', shopAdminAuth, async (req, res) => {
    try {
        const employee = await Employee.findOne({
            _id: req.params.employeeId,
            shop_id: req.shopId
        });

        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        // Get all attendance records
        const attendanceRecords = await Attendance.find({ employee_id: employee._id })
            .sort({ date: -1 })
            .limit(90); // Last 3 months

        res.json({ success: true, employee, attendanceRecords });
    } catch (error) {
        console.error('Get employee details error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ==============================
// 📈 Analytics & Revenue
// ==============================
router.get('/analytics/revenue', shopAdminAuth, async (req, res) => {
    try {
        const { period = '30' } = req.query; // days
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(period));

        // Service revenue (from mobiles)
        const mobileRevenue = await Mobile.aggregate([
            {
                $match: {
                    shop_id: req.shopId,
                    created_at: { $gte: daysAgo },
                    paid_amount: { $gt: 0 }
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } }
                    },
                    revenue: { $sum: "$paid_amount" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id.date": 1 } }
        ]);

        // Sales revenue (from products)
        const salesRevenue = await AdminSale.aggregate([
            {
                $match: {
                    shop_id: req.shopId,
                    createdAt: { $gte: daysAgo }
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
                    },
                    revenue: { $sum: "$totalAmount" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id.date": 1 } }
        ]);

        // Expenses
        const expenses = await Expense.aggregate([
            {
                $match: {
                    shop_id: req.shopId,
                    createdAt: { $gte: daysAgo }
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
                    },
                    amount: { $sum: "$amount" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id.date": 1 } }
        ]);

        // Total calculations
        const totalServiceRevenue = mobileRevenue.reduce((sum, item) => sum + item.revenue, 0);
        const totalSalesRevenue = salesRevenue.reduce((sum, item) => sum + item.revenue, 0);
        const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
        const totalRevenue = totalServiceRevenue + totalSalesRevenue;
        const netProfit = totalRevenue - totalExpenses;

        // Payment method breakdown
        const paymentBreakdown = await Mobile.aggregate([
            {
                $match: {
                    shop_id: req.shopId,
                    created_at: { $gte: daysAgo },
                    paid_amount: { $gt: 0 }
                }
            },
            {
                $group: {
                    _id: "$payment",
                    total: { $sum: "$paid_amount" },
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            success: true,
            analytics: {
                totalRevenue,
                totalServiceRevenue,
                totalSalesRevenue,
                totalExpenses,
                netProfit,
                mobileRevenue,
                salesRevenue,
                expenses,
                paymentBreakdown
            }
        });
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ==============================
// 📱 Service Analytics
// ==============================
router.get('/analytics/service', shopAdminAuth, async (req, res) => {
    try {
        const { period = '30' } = req.query;
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(period));

        // Mobile status breakdown
        const statusBreakdown = await Mobile.aggregate([
            { $match: { shop_id: req.shopId } },
            {
                $group: {
                    _id: {
                        ready: "$ready",
                        delivered: "$delivered",
                        returned: "$returned"
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Top technicians
        const topTechnicians = await Mobile.aggregate([
            {
                $match: {
                    shop_id: req.shopId,
                    created_at: { $gte: daysAgo },
                    technician_name: { $exists: true, $ne: "" }
                }
            },
            {
                $group: {
                    _id: "$technician_name",
                    completed: { $sum: { $cond: ["$ready", 1, 0] } },
                    total: { $sum: 1 },
                    totalRevenue: { $sum: "$paid_amount" }
                }
            },
            { $sort: { completed: -1 } },
            { $limit: 10 }
        ]);

        // Common issues
        const commonIssues = await Mobile.aggregate([
            {
                $match: {
                    shop_id: req.shopId,
                    created_at: { $gte: daysAgo },
                    issue: { $exists: true, $ne: "" }
                }
            },
            {
                $group: {
                    _id: "$issue",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        res.json({
            success: true,
            serviceAnalytics: {
                statusBreakdown,
                topTechnicians,
                commonIssues
            }
        });
    } catch (error) {
        console.error('Service analytics error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ==============================
// 🛍️ Customer Analytics
// ==============================
router.get('/analytics/customers', shopAdminAuth, async (req, res) => {
    try {
        // Top customers by revenue
        const topCustomers = await Mobile.aggregate([
            { $match: { shop_id: req.shopId, customer_id: { $exists: true } } },
            {
                $group: {
                    _id: "$customer_id",
                    totalSpent: { $sum: "$paid_amount" },
                    visitCount: { $sum: 1 }
                }
            },
            { $sort: { totalSpent: -1 } },
            { $limit: 20 },
            {
                $lookup: {
                    from: 'customers',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'customer'
                }
            },
            { $unwind: '$customer' }
        ]);

        // Customer type distribution
        const customerTypeDistribution = await Customer.aggregate([
            { $match: { shop_id: req.shopId } },
            {
                $group: {
                    _id: "$customer_type",
                    count: { $sum: 1 }
                }
            }
        ]);

        // Outstanding balances
        const outstandingBalances = await Customer.find({
            shop_id: req.shopId,
            balance_amount: { $gt: 0 }
        }).sort({ balance_amount: -1 }).limit(20);

        // Total counts
        const totalCustomers = await Customer.countDocuments({ shop_id: req.shopId });
        
        // New customers this month
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        const newThisMonth = await Customer.countDocuments({
            shop_id: req.shopId,
            created_at: { $gte: monthAgo }
        });

        // Active customers (have transactions in last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const activeCustomerIds = await Mobile.distinct('customer_id', {
            shop_id: req.shopId,
            created_at: { $gte: thirtyDaysAgo }
        });

        res.json({
            success: true,
            customerAnalytics: {
                total: totalCustomers,
                newThisMonth,
                active: activeCustomerIds.length,
                topCustomers,
                customerTypeDistribution,
                outstandingBalances
            }
        });
    } catch (error) {
        console.error('Customer analytics error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ==============================
// 📦 Inventory Analytics
// ==============================
router.get('/analytics/inventory', shopAdminAuth, async (req, res) => {
    try {
        // Get user ID from shop
        const shop = await Shop.findById(req.shopId);
        const user = await User.findOne({ mysql_user_id: shop.mysql_user_id });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Low stock products
        const lowStockProducts = await Product.find({
            userId: user._id,
            quantity: { $lt: 10 }
        }).sort({ quantity: 1 }).limit(20);

        // Product value
        const inventoryValue = await Product.aggregate([
            { $match: { userId: user._id } },
            {
                $group: {
                    _id: null,
                    totalValue: { $sum: { $multiply: ["$costPrice", "$quantity"] } },
                    totalProducts: { $sum: 1 },
                    totalQuantity: { $sum: "$quantity" }
                }
            }
        ]);

        // Category breakdown
        const categoryBreakdown = await Product.aggregate([
            { $match: { userId: user._id } },
            {
                $group: {
                    _id: "$category",
                    count: { $sum: 1 },
                    totalValue: { $sum: { $multiply: ["$costPrice", "$quantity"] } }
                }
            },
            { $sort: { totalValue: -1 } }
        ]);

        // Mobile inventory (for repair shop)
        const totalMobiles = await Mobile.countDocuments({ shop_id: req.shopId });
        const mobilesInStock = await Mobile.countDocuments({ 
            shop_id: req.shopId, 
            delivered: false,
            returned: false
        });

        // Top brands from mobiles
        const topBrands = await Mobile.aggregate([
            { $match: { shop_id: req.shopId, brand_name: { $exists: true, $ne: "" } } },
            {
                $group: {
                    _id: "$brand_name",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 5 },
            {
                $project: {
                    name: "$_id",
                    count: 1,
                    _id: 0
                }
            }
        ]);

        const invValue = inventoryValue[0] || { totalValue: 0, totalProducts: 0, totalQuantity: 0 };

        res.json({
            success: true,
            inventoryAnalytics: {
                total: totalMobiles,
                totalMobiles: totalMobiles,
                inStock: mobilesInStock,
                lowStock: lowStockProducts.length,
                topBrands,
                lowStockProducts,
                inventoryValue: invValue,
                categoryBreakdown,
                totalProducts: invValue.totalProducts
            }
        });
    } catch (error) {
        console.error('Inventory analytics error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ==============================
// 🏪 Shop Information
// ==============================
router.get('/shop-info', shopAdminAuth, async (req, res) => {
    try {
        const shop = await Shop.findById(req.shopId);
        const role = await Role.findOne({ mysql_user_id: shop.mysql_user_id });

        res.json({
            success: true,
            shop: {
                id: shop._id,
                name: shop.shop_name,
                location: shop.location,
                phone: shop.phone,
                email: shop.email,
                address: shop.address,
                owner_name: shop.owner_name,
                created_at: shop.created_at,
                role: role?.role,
                shop_type: role?.shop_type
            }
        });
    } catch (error) {
        console.error('Get shop info error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ==============================
// 🔧 CRUD Operations for Infinest Admin
// ==============================

// Create shop admin (only from infinest admin portal)
router.post('/create', internalAuth, async (req, res) => {
    try {
        console.log('📥 Received request body:', JSON.stringify(req.body, null, 2));
        
        const { 
            shop_admin_username, 
            shop_admin_password, 
            shop_credentials, // Array of [{email, password}]
            email, 
            phone, 
            full_name, 
            created_by 
        } = req.body;

        console.log('🔍 Validation check:', {
            has_username: !!shop_admin_username,
            has_password: !!shop_admin_password,
            has_credentials: !!shop_credentials,
            credentials_type: typeof shop_credentials,
            credentials_length: shop_credentials?.length
        });

        if (!shop_admin_username || !shop_admin_password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Shop admin username and password are required' 
            });
        }

        if (!shop_credentials || !Array.isArray(shop_credentials) || shop_credentials.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'At least one shop owner credential is required' 
            });
        }

        // Verify all shop owner credentials and collect shop IDs
        const axios = require('axios');
        const AUTH_SERVER_URL = process.env.AUTH_SERVER_URL || 'http://localhost:7000';
        
        const shopIds = [];
        const verifiedShops = [];

        for (const cred of shop_credentials) {
            if (!cred.email || !cred.password) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Each shop credential must have email and password' 
                });
            }

            try {
                const authResponse = await axios.post(`${AUTH_SERVER_URL}/verify-user-login`, {
                    email: cred.email,
                    password: cred.password
                });

                if (!authResponse.data.success || !authResponse.data.userId) {
                    return res.status(401).json({ 
                        success: false, 
                        message: `Invalid credentials for ${cred.email}` 
                    });
                }

                const mysqlUserId = authResponse.data.userId;
                
                // Find the shop associated with this MySQL user
                const shop = await Shop.findOne({ mysql_user_id: mysqlUserId.toString() });
                if (!shop) {
                    return res.status(404).json({ 
                        success: false, 
                        message: `No shop found for ${cred.email}` 
                    });
                }

                shopIds.push(shop._id);
                verifiedShops.push({
                    id: shop._id,
                    name: shop.shop_name,
                    location: shop.location,
                    owner_name: shop.owner_name
                });
            } catch (authError) {
                console.error('Auth verification error:', authError.response?.data || authError.message);
                return res.status(401).json({ 
                    success: false, 
                    message: `Invalid credentials for ${cred.email}`,
                    details: authError.response?.data?.message || 'Failed to verify credentials'
                });
            }
        }

        // Check if shop admin username already exists
        const existingUsername = await ShopAdmin.findOne({ username: shop_admin_username });
        if (existingUsername) {
            return res.status(400).json({ 
                success: false, 
                message: 'Shop admin username already exists. Use the update endpoint to add more shops.' 
            });
        }

        // Hash shop admin password
        const hashedPassword = await bcrypt.hash(shop_admin_password, 10);

        // Create shop admin with multiple shops
        const shopAdmin = new ShopAdmin({
            username: shop_admin_username,
            password: hashedPassword,
            shop_ids: shopIds,
            current_shop_id: shopIds[0], // Set first shop as current
            email,
            phone,
            full_name,
            created_by
        });

        await shopAdmin.save();

        res.json({
            success: true,
            message: `Shop admin created successfully with access to ${shopIds.length} shop(s)`,
            shopAdmin: {
                id: shopAdmin._id,
                username: shopAdmin.username,
                shops: verifiedShops,
                email: shopAdmin.email,
                full_name: shopAdmin.full_name,
                created_at: shopAdmin.created_at
            }
        });
    } catch (error) {
        console.error('Create shop admin error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get all shop admins (infinest admin only)
router.get('/all', internalAuth, async (req, res) => {
    try {
        const shopAdmins = await ShopAdmin.find()
            .populate('shop_ids', 'shop_name location owner_name phone email')
            .populate('current_shop_id', 'shop_name location')
            .sort({ created_at: -1 });

        res.json({ success: true, shopAdmins });
    } catch (error) {
        console.error('Get shop admins error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update shop admin (infinest admin only)
router.put('/:adminId', internalAuth, async (req, res) => {
    try {
        const { email, phone, full_name, is_active, password } = req.body;
        const shopAdmin = await ShopAdmin.findById(req.params.adminId);

        if (!shopAdmin) {
            return res.status(404).json({ success: false, message: 'Shop admin not found' });
        }

        if (email) shopAdmin.email = email;
        if (phone) shopAdmin.phone = phone;
        if (full_name) shopAdmin.full_name = full_name;
        if (typeof is_active !== 'undefined') shopAdmin.is_active = is_active;
        if (password) {
            shopAdmin.password = await bcrypt.hash(password, 10);
        }

        shopAdmin.updated_at = new Date();
        await shopAdmin.save();

        res.json({ success: true, message: 'Shop admin updated successfully', shopAdmin });
    } catch (error) {
        console.error('Update shop admin error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete shop admin (infinest admin only)
router.delete('/:adminId', internalAuth, async (req, res) => {
    try {
        const shopAdmin = await ShopAdmin.findByIdAndDelete(req.params.adminId);

        if (!shopAdmin) {
            return res.status(404).json({ success: false, message: 'Shop admin not found' });
        }

        res.json({ success: true, message: 'Shop admin deleted successfully' });
    } catch (error) {
        console.error('Delete shop admin error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Add shops to existing shop admin (infinest admin only)
router.post('/:adminId/add-shops', internalAuth, async (req, res) => {
    try {
        const { shop_credentials } = req.body; // Array of [{email, password}]

        if (!shop_credentials || shop_credentials.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'At least one shop credential is required' 
            });
        }

        const shopAdmin = await ShopAdmin.findById(req.params.adminId);
        if (!shopAdmin) {
            return res.status(404).json({ success: false, message: 'Shop admin not found' });
        }

        // Verify all shop owner credentials and collect shop IDs
        const axios = require('axios');
        const AUTH_SERVER_URL = process.env.AUTH_SERVER_URL || 'http://localhost:7000';
        
        const newShopIds = [];
        const verifiedShops = [];

        for (const cred of shop_credentials) {
            if (!cred.email || !cred.password) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Each shop credential must have email and password' 
                });
            }

            try {
                const authResponse = await axios.post(`${AUTH_SERVER_URL}/verify-user-login`, {
                    email: cred.email,
                    password: cred.password
                });

                if (!authResponse.data.success || !authResponse.data.userId) {
                    return res.status(401).json({ 
                        success: false, 
                        message: `Invalid credentials for ${cred.email}` 
                    });
                }

                const mysqlUserId = authResponse.data.userId;
                
                // Find the shop associated with this MySQL user
                const shop = await Shop.findOne({ mysql_user_id: mysqlUserId.toString() });
                if (!shop) {
                    return res.status(404).json({ 
                        success: false, 
                        message: `No shop found for ${cred.email}` 
                    });
                }

                // Check if shop is already assigned
                if (shopAdmin.shop_ids.includes(shop._id)) {
                    continue; // Skip if already assigned
                }

                newShopIds.push(shop._id);
                verifiedShops.push({
                    id: shop._id,
                    name: shop.shop_name,
                    location: shop.location,
                    owner_name: shop.owner_name
                });
            } catch (authError) {
                console.error('Auth verification error:', authError.response?.data || authError.message);
                return res.status(401).json({ 
                    success: false, 
                    message: `Invalid credentials for ${cred.email}`,
                    details: authError.response?.data?.message || 'Failed to verify credentials'
                });
            }
        }

        if (newShopIds.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'No new shops to add (all shops already assigned)' 
            });
        }

        // Add new shops to the admin
        shopAdmin.shop_ids.push(...newShopIds);
        shopAdmin.updated_at = new Date();
        await shopAdmin.save();

        res.json({
            success: true,
            message: `Added ${newShopIds.length} shop(s) to shop admin`,
            addedShops: verifiedShops
        });
    } catch (error) {
        console.error('Add shops error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Remove shop from shop admin (infinest admin only)
router.delete('/:adminId/remove-shop/:shopId', internalAuth, async (req, res) => {
    try {
        const shopAdmin = await ShopAdmin.findById(req.params.adminId);
        if (!shopAdmin) {
            return res.status(404).json({ success: false, message: 'Shop admin not found' });
        }

        const shopIdToRemove = req.params.shopId;
        
        // Check if shop is assigned
        const shopIndex = shopAdmin.shop_ids.findIndex(id => id.toString() === shopIdToRemove);
        if (shopIndex === -1) {
            return res.status(404).json({ success: false, message: 'Shop not assigned to this admin' });
        }

        // Remove shop
        shopAdmin.shop_ids.splice(shopIndex, 1);
        
        // If removed shop was current, set new current
        if (shopAdmin.current_shop_id?.toString() === shopIdToRemove) {
            shopAdmin.current_shop_id = shopAdmin.shop_ids[0] || null;
        }

        shopAdmin.updated_at = new Date();
        await shopAdmin.save();

        res.json({
            success: true,
            message: 'Shop removed successfully',
            remainingShops: shopAdmin.shop_ids.length
        });
    } catch (error) {
        console.error('Remove shop error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Switch current shop (shop admin can switch between their assigned shops)
router.post('/switch-shop', shopAdminAuth, async (req, res) => {
    try {
        const { shop_id } = req.body;

        if (!shop_id) {
            return res.status(400).json({ success: false, message: 'Shop ID is required' });
        }

        const shopAdmin = req.shopAdmin;

        // Verify shop is assigned to this admin
        const isAssigned = shopAdmin.shop_ids.some(id => id._id.toString() === shop_id);
        if (!isAssigned) {
            return res.status(403).json({ success: false, message: 'Shop not assigned to this admin' });
        }

        // Update current shop
        shopAdmin.current_shop_id = shop_id;
        shopAdmin.updated_at = new Date();
        await shopAdmin.save();

        const currentShop = await Shop.findById(shop_id);

        res.json({
            success: true,
            message: 'Shop switched successfully',
            currentShop: {
                id: currentShop._id,
                name: currentShop.shop_name,
                location: currentShop.location,
                owner_name: currentShop.owner_name
            }
        });
    } catch (error) {
        console.error('Switch shop error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get all assigned shops for current shop admin
router.get('/my-shops', shopAdminAuth, async (req, res) => {
    try {
        const shops = req.shopAdmin.shop_ids.map(shop => ({
            id: shop._id,
            name: shop.shop_name,
            location: shop.location,
            owner_name: shop.owner_name,
            isCurrent: shop._id.toString() === req.shopAdmin.current_shop_id?.toString()
        }));

        res.json({
            success: true,
            shops,
            currentShopId: req.shopAdmin.current_shop_id
        });
    } catch (error) {
        console.error('Get my shops error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;

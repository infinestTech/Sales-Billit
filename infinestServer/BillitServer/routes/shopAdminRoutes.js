const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const SessionManager = require('../utils/sessionManager'); // ✅ Import session manager
const { getISTTodayRange, getISTStartOfDay, getISTEndOfDay, subtractTimeIST, formatIST } = require('../utils/dateHelper');
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
    Role,
    Supplier,
    MobileBrand,
    MobileIssue
} = require('../models/mongoModels');

// JWT Secret for shop admins (different from regular users)
const SHOP_ADMIN_JWT_SECRET = process.env.SHOP_ADMIN_JWT_SECRET || 'shop-admin-secret-key-2024';

// Middleware to verify shop admin token with session validation
const shopAdminAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication required',
                sessionExpired: true
            });
        }

        const decoded = jwt.verify(token, SHOP_ADMIN_JWT_SECRET);
        
        // ✅ Validate session (enforce single-device login for shop admins)
        const isSessionValid = await SessionManager.validateSession(decoded.adminId.toString(), token);
        
        if (!isSessionValid) {
            return res.status(401).json({ 
                success: false, 
                message: 'Your session has expired or you have logged in from another device. Please login again.',
                sessionExpired: true,
                loggedOutFromAnotherDevice: true
            });
        }
        
        const shopAdmin = await ShopAdmin.findById(decoded.adminId).populate('shop_ids').populate('current_shop_id');

        if (!shopAdmin || !shopAdmin.is_active) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid or inactive admin',
                sessionExpired: true
            });
        }

        req.shopAdmin = shopAdmin;
        // Use current_shop_id if set, otherwise use first shop or from query/body param.
        // Accept both snake_case (shop_id) and camelCase (shopId) for compatibility.
        const requestedShopId = req.query.shop_id || req.query.shopId
            || req.body.shop_id || req.body.shopId;
        let shopId;
        if (requestedShopId && shopAdmin.shop_ids.some(shop => shop._id.toString() === String(requestedShopId))) {
            shopId = requestedShopId;
        } else {
            shopId = shopAdmin.current_shop_id?._id || shopAdmin.shop_ids[0]?._id;
        }
        
        if (!shopId) {
            return res.status(400).json({ success: false, message: 'No shop assigned to this admin' });
        }
        
        // Convert to ObjectId for MongoDB queries
        const mongoose = require('mongoose');
        req.shopId = typeof shopId === 'string' ? new mongoose.Types.ObjectId(shopId) : shopId;
        
        next();
    } catch (error) {
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid token',
            sessionExpired: true
        });
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

        // ✅ Create session (enforces session limit from shopAdmin.sessionLimit)
        const sessionMetadata = {
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            userType: 'shop_admin',
            sessionLimit: shopAdmin.sessionLimit || 1 // Use shop admin's session limit
        };
        
        await SessionManager.createSession(shopAdmin._id.toString(), token, sessionMetadata);

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
        const { getISTTodayRange } = require('../utils/dateHelper');
        const shopId = req.shopId;
        const { startOfDay: today, endOfDay } = getISTTodayRange();

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

        // Calculate today's revenue from payments made TODAY (not mobiles created today)
        
        const allMobiles = await Mobile.find({ shop_id: shopId }).lean();
        
        let todayRevenue = 0;
        allMobiles.forEach((m) => {
            if (m.payments && m.payments.length > 0) {
                // Sum up all payments made today
                const todaysPayments = m.payments.filter(p => {
                    const paymentDate = new Date(p.date);
                    return paymentDate >= today && paymentDate <= endOfDay;
                });
                todayRevenue += todaysPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
            } else {
                // Fallback for legacy data: if mobile was created today and has no payments array
                if (new Date(m.added_date || m.created_at) >= today && new Date(m.added_date || m.created_at) <= endOfDay) {
                    todayRevenue += (m.total_paid || m.paid_amount || 0);
                }
            }
        });

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
// 📊 Customer Details with Mobile Statistics
// ==============================
router.get('/customer-details', shopAdminAuth, async (req, res) => {
    try {
        const shopId = req.shopId;
        const { billNumber } = req.query; // Get bill number filter from query params

        console.log('Customer details request - shopId:', shopId, 'billNumber:', billNumber); // Debug log

        // Fetch all customers and dealers
        let customerQuery = { shop_id: shopId };
        let dealerQuery = { shop_id: shopId };
        
        // If bill number filter is provided, filter customers/dealers by bill_no
        if (billNumber && billNumber.trim()) {
            const billRegex = { $regex: billNumber.trim(), $options: 'i' };
            customerQuery.bill_no = billRegex;
            dealerQuery.bill_no = billRegex;
        }

        const [customers, dealers] = await Promise.all([
            Customer.find(customerQuery).lean(),
            Dealer.find(dealerQuery).lean()
        ]);

        // Combine customers and dealers
        const allClients = [
            ...customers.map(c => ({ ...c, customer_type: 'Customer' })),
            ...dealers.map(d => ({ ...d, customer_type: 'Dealer' }))
        ];

        // Fetch mobile statistics for each client
        const clientDetails = await Promise.all(
            allClients.map(async (client) => {
                // Build the query for mobiles
                const mobileQuery = {
                    shop_id: shopId,
                    [client.customer_type === 'Customer' ? 'customer_id' : 'dealer_id']: client._id
                };

                const mobiles = await Mobile.find(mobileQuery).lean();

                const totalMobiles = mobiles.length;
                const readyCount = mobiles.filter(m => m.ready).length;
                const notReadyCount = mobiles.filter(m => !m.ready).length;
                const deliveredCount = mobiles.filter(m => m.delivered).length;
                
                // Calculate total paid from payments array (not just paid_amount field)
                let totalPaid = 0;
                mobiles.forEach(m => {
                    if (m.payments && m.payments.length > 0) {
                        // Sum all payments in the payments array
                        totalPaid += m.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
                    } else {
                        // Fallback to paid_amount for legacy data without payments array
                        totalPaid += (m.paid_amount || 0);
                    }
                });

                // Get the latest mobile date and bill number
                const latestMobile = mobiles.sort((a, b) => 
                    new Date(b.created_at) - new Date(a.created_at)
                )[0];

                return {
                    _id: client._id,
                    client_name: client.client_name,
                    mobile_number: client.mobile_number,
                    customer_type: client.customer_type,
                    total_mobiles: totalMobiles,
                    ready_count: readyCount,
                    not_ready_count: notReadyCount,
                    delivered_count: deliveredCount,
                    total_paid: totalPaid,
                    latest_mobile_date: latestMobile?.created_at || client.created_at,
                    latest_bill_no: latestMobile?.bill_no || 'N/A'
                };
            })
        );

        // Filter out clients with no mobiles and sort by latest activity (latest first)
        const activeClients = clientDetails
            .filter(c => c.total_mobiles > 0)
            .sort((a, b) => new Date(b.latest_mobile_date) - new Date(a.latest_mobile_date));

        res.json({ success: true, customerDetails: activeClients });
    } catch (error) {
        console.error('Get customer details error:', error);
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
        const thirtyDaysAgo = subtractTimeIST(30, 'days');

        const employeesWithStats = await Promise.all(
            employees.map(async (employee) => {
                const attendanceRecords = await Attendance.find({
                    employee_id: employee._id,
                    date: { $gte: formatIST(thirtyDaysAgo, 'YYYY-MM-DD') }
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

// Get employee attendance details with filtering (uses new HR daily attendance store)
router.get('/employee-attendance', shopAdminAuth, async (req, res) => {
    try {
        const { employee_id, from_date, to_date } = req.query;

        if (!employee_id) {
            return res.status(400).json({ success: false, message: 'Employee ID is required' });
        }

        const mongoose = require('mongoose');
        const { HrDailyAttendance } = require('../models/mongoModels');
        const employeeObjectId = new mongoose.Types.ObjectId(employee_id);

        const query = { employee_id: employeeObjectId };
        let startDate, endDate;
        if (from_date && to_date) {
            startDate = from_date;
            endDate = to_date;
            query.date = { $gte: startDate, $lte: endDate };
        }

        const records = await HrDailyAttendance.find(query).sort({ date: -1 });

        const totalDays = records.length;
        const presentDays = records.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
        const absentDays = records.filter(r => r.status === 'ABSENT').length;
        const lateDays = records.filter(r => r.status === 'LATE').length;
        const attendanceRate = totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : 0;
        const totalLateMinutes = records.reduce((sum, r) => sum + (r.late_minutes || 0), 0);

        const dailyRecords = records.map(r => ({
            date: r.date,
            status: (r.status || '').toLowerCase(),
            lateMinutes: r.late_minutes || 0,
            workingHours: r.working_hours || 0
        }));

        res.json({
            success: true,
            attendance: {
                totalDays,
                presentDays,
                absentDays,
                lateDays,
                attendanceRate: parseFloat(attendanceRate),
                totalLateMinutes,
                dailyRecords,
                dateRange: from_date && to_date ? { from: startDate, to: endDate } : null
            }
        });
    } catch (error) {
        console.error('Get employee attendance error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete employee
router.delete('/employees/:employeeId', shopAdminAuth, async (req, res) => {
    try {
        const employeeId = req.params.employeeId;
        const shopId = req.shopId;

        // Check if employee exists and belongs to this shop
        const employee = await Employee.findOne({ _id: employeeId, shop_id: shopId });
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        // Delete employee and all related records
        await Promise.all([
            Employee.deleteOne({ _id: employeeId }),
            Attendance.deleteMany({ employee_id: employeeId })
        ]);

        res.json({ success: true, message: 'Employee deleted successfully' });
    } catch (error) {
        console.error('Delete employee error:', error);
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
        const { period = '30', fromDate, toDate } = req.query; // days or custom date range
        
        let startDate, endDate;
        if (fromDate && toDate) {
            // Use custom date range in IST
            startDate = getISTStartOfDay(new Date(fromDate));
            endDate = getISTEndOfDay(new Date(toDate));
        } else {
            // Use period (days) - inclusive calculation in IST
            const { endOfDay } = getISTTodayRange();
            endDate = endOfDay;
            
            // Subtract (period - 1) days to make it inclusive
            const daysBack = parseInt(period) - 1;
            startDate = getISTStartOfDay(subtractTimeIST(daysBack, 'days'));
        }

        // Service revenue (from mobiles) - using payments array with actual payment dates
        const mobileRevenue = await Mobile.aggregate([
            {
                $match: {
                    shop_id: req.shopId,
                    payments: { $exists: true, $ne: [] }
                }
            },
            {
                $unwind: "$payments"
            },
            {
                $match: {
                    "payments.date": { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$payments.date" } }
                    },
                    revenue: { $sum: "$payments.amount" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id.date": 1 } }
        ]);
        
        // Also get mobiles with legacy data (no payments array but has paid_amount)
        const legacyMobileRevenue = await Mobile.aggregate([
            {
                $match: {
                    shop_id: req.shopId,
                    created_at: { $gte: startDate, $lte: endDate },
                    paid_amount: { $gt: 0 },
                    $or: [
                        { payments: { $exists: false } },
                        { payments: { $size: 0 } }
                    ]
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
        
        // Combine modern and legacy revenue data
        const combinedMobileRevenue = {};
        mobileRevenue.forEach(item => {
            const date = item._id.date;
            combinedMobileRevenue[date] = {
                _id: item._id,
                revenue: (combinedMobileRevenue[date]?.revenue || 0) + item.revenue,
                count: (combinedMobileRevenue[date]?.count || 0) + item.count
            };
        });
        legacyMobileRevenue.forEach(item => {
            const date = item._id.date;
            combinedMobileRevenue[date] = {
                _id: item._id,
                revenue: (combinedMobileRevenue[date]?.revenue || 0) + item.revenue,
                count: (combinedMobileRevenue[date]?.count || 0) + item.count
            };
        });
        
        const finalMobileRevenue = Object.values(combinedMobileRevenue);

        // Sales revenue (from products)
        const salesRevenue = await AdminSale.aggregate([
            {
                $match: {
                    shop_id: req.shopId,
                    createdAt: { $gte: startDate, $lte: endDate }
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

        // Supplier Payments (from mobiles with supplier info) - grouped by date
        // Use update_date (when supplier payment was recorded) with fallback to created_at for older records
        const supplierPayments = await Mobile.aggregate([
            {
                $addFields: {
                    _supplierDate: { $ifNull: ['$update_date', '$created_at'] }
                }
            },
            {
                $match: {
                    shop_id: req.shopId,
                    _supplierDate: { $gte: startDate, $lte: endDate },
                    supplier_amount: { $gt: 0 }
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$_supplierDate" } }
                    },
                    amount: { $sum: "$supplier_amount" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id.date": 1 } }
        ]);

        // Operating Expenses (from Expense collection)
        const operatingExpenses = await Expense.aggregate([
            {
                $match: {
                    shop_id: req.shopId,
                    createdAt: { $gte: startDate, $lte: endDate }
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

        // Daily Wage Expenses (only include PAID salaries from HrSalaryRecord)
        const { HrSalaryRecord } = require('../models/mongoModels');
        
        // Get paid salary records for the date range
        const startMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
        const endMonth = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;
        
        const paidSalaryRecords = await HrSalaryRecord.find({
            shop_id: req.shopId,
            status: 'PAID',
            paid_at: { $exists: true, $ne: null },
            $or: [
                { paid_at: { $gte: startDate, $lte: endDate } },
                { month: { $gte: startMonth, $lte: endMonth } }
            ]
        });

        // Calculate daily wage expenses by payment date
        const dailyWageExpensesByDate = {};
        
        paidSalaryRecords.forEach(record => {
            // Use paid_at for expense tracking (when the salary was actually paid)
            if (record.paid_at) {
                const paymentDate = new Date(record.paid_at);
                const year = paymentDate.getFullYear();
                const month = String(paymentDate.getMonth() + 1).padStart(2, '0');
                const day = String(paymentDate.getDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${day}`;
                
                // Only include if within our date range
                if (dateStr >= startDate.toISOString().split('T')[0] && 
                    dateStr <= endDate.toISOString().split('T')[0]) {
                    if (!dailyWageExpensesByDate[dateStr]) {
                        dailyWageExpensesByDate[dateStr] = {
                            _id: { date: dateStr },
                            amount: 0,
                            count: 0
                        };
                    }
                    dailyWageExpensesByDate[dateStr].amount += record.paid_amount || 0;
                    dailyWageExpensesByDate[dateStr].count += 1;
                }
            }
        });

        const dailyWageExpenses = Object.values(dailyWageExpensesByDate).sort((a, b) => 
            a._id.date.localeCompare(b._id.date)
        );
        
        // Combine supplier payments, operating expenses, and daily wage expenses by date
        const expensesByDate = {};
        supplierPayments.forEach(item => {
            const date = item._id.date;
            expensesByDate[date] = {
                _id: item._id,
                amount: (expensesByDate[date]?.amount || 0) + item.amount,
                count: (expensesByDate[date]?.count || 0) + item.count
            };
        });
        operatingExpenses.forEach(item => {
            const date = item._id.date;
            expensesByDate[date] = {
                _id: item._id,
                amount: (expensesByDate[date]?.amount || 0) + item.amount,
                count: (expensesByDate[date]?.count || 0) + item.count
            };
        });
        dailyWageExpenses.forEach(item => {
            const date = item._id.date;
            expensesByDate[date] = {
                _id: item._id,
                amount: (expensesByDate[date]?.amount || 0) + item.amount,
                count: (expensesByDate[date]?.count || 0) + item.count
            };
        });
        
        const expenses = Object.values(expensesByDate);

        // Total calculations
        const totalServiceRevenue = finalMobileRevenue.reduce((sum, item) => sum + item.revenue, 0);
        const totalSalesRevenue = salesRevenue.reduce((sum, item) => sum + item.revenue, 0);
        const totalSupplierPayments = supplierPayments.reduce((sum, item) => sum + item.amount, 0);
        const totalOperatingExpenses = operatingExpenses.reduce((sum, item) => sum + item.amount, 0);
        const totalDailyWageExpenses = dailyWageExpenses.reduce((sum, item) => sum + item.amount, 0);
        const totalExpenses = totalSupplierPayments + totalOperatingExpenses + totalDailyWageExpenses;
        const totalRevenue = totalServiceRevenue + totalSalesRevenue;
        const netProfit = totalRevenue - totalExpenses;

        // Payment method breakdown
        const paymentBreakdown = await Mobile.aggregate([
            {
                $match: {
                    shop_id: req.shopId,
                    created_at: { $gte: startDate, $lte: endDate },
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
                totalSupplierPayments,
                totalOperatingExpenses,
                totalDailyWageExpenses,
                netProfit,
                mobileRevenue: finalMobileRevenue,
                salesRevenue,
                supplierPayments,
                operatingExpenses,
                dailyWageExpenses,
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
        const daysAgo = subtractTimeIST(parseInt(period), 'days');

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
        const monthAgo = subtractTimeIST(1, 'months');
        const newThisMonth = await Customer.countDocuments({
            shop_id: req.shopId,
            created_at: { $gte: monthAgo }
        });

        // Active customers (have transactions in last 30 days)
        const thirtyDaysAgo = subtractTimeIST(30, 'days');
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
// 📊 Financial Report
// ==============================
router.get('/reports/financial', shopAdminAuth, async (req, res) => {
    try {
        const { period, fromDate, toDate } = req.query;
        
        // Calculate date range in IST
        let startDate, endDate;
        if (fromDate && toDate) {
            startDate = getISTStartOfDay(new Date(fromDate));
            endDate = getISTEndOfDay(new Date(toDate));
        } else {
            // Use period (days) - inclusive calculation in IST
            const days = parseInt(period) || 30;
            const { endOfDay } = getISTTodayRange();
            endDate = endOfDay;
            const daysBack = days - 1;
            startDate = getISTStartOfDay(subtractTimeIST(daysBack, 'days'));
        }

        // Customer Payments - Get all payments made in the period (using payments array)
        const customerPayments = await Mobile.aggregate([
            {
                $match: {
                    shop_id: req.shopId,
                    customer_id: { $exists: true, $ne: null },
                    payments: { $exists: true, $ne: [] }
                }
            },
            { $unwind: '$payments' },
            {
                $match: {
                    'payments.date': { $gte: startDate, $lte: endDate }
                }
            },
            {
                $lookup: {
                    from: 'customers',
                    localField: 'customer_id',
                    foreignField: '_id',
                    as: 'customer'
                }
            },
            { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    date: '$payments.date',
                    customerName: { $ifNull: ['$customer.client_name', 'Walk-in Customer'] },
                    customerPhone: { $ifNull: ['$customer.mobile_number', ''] },
                    brand: { $ifNull: ['$mobile_name', ''] },
                    model: { $ifNull: ['$model', ''] },
                    issue: { $ifNull: ['$issue', ''] },
                    mobileName: {
                        $concat: [
                            { $ifNull: ['$mobile_name', ''] },
                            ' ',
                            { $ifNull: ['$model', ''] }
                        ]
                    },
                    paymentMethod: { $ifNull: ['$payments.method', 'Cash'] },
                    amount: { $ifNull: ['$payments.amount', 0] }
                }
            },
            { $sort: { date: 1 } }
        ]);
        
        // Add legacy customer payments (mobiles without payments array but created in period)
        const legacyCustomerPayments = await Mobile.aggregate([
            {
                $match: {
                    shop_id: req.shopId,
                    created_at: { $gte: startDate, $lte: endDate },
                    paid_amount: { $gt: 0 },
                    customer_id: { $exists: true, $ne: null },
                    $or: [
                        { payments: { $exists: false } },
                        { payments: { $size: 0 } }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'customers',
                    localField: 'customer_id',
                    foreignField: '_id',
                    as: 'customer'
                }
            },
            { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    date: '$created_at',
                    customerName: { $ifNull: ['$customer.client_name', 'Walk-in Customer'] },
                    customerPhone: { $ifNull: ['$customer.mobile_number', ''] },
                    brand: { $ifNull: ['$mobile_name', ''] },
                    model: { $ifNull: ['$model', ''] },
                    issue: { $ifNull: ['$issue', ''] },
                    mobileName: {
                        $concat: [
                            { $ifNull: ['$mobile_name', ''] },
                            ' ',
                            { $ifNull: ['$model', ''] }
                        ]
                    },
                    paymentMethod: { 
                        $cond: {
                            if: { $ne: ['$paymentMethod', null] },
                            then: '$paymentMethod',
                            else: { $ifNull: ['$payment', 'Cash'] }
                        }
                    },
                    amount: { $ifNull: ['$paid_amount', 0] }
                }
            },
            { $sort: { date: 1 } }
        ]);
        
        // Combine modern and legacy customer payments
        const allCustomerPayments = [...customerPayments, ...legacyCustomerPayments];

        // Dealer Payments - Get all payments made in the period (using payments array)
        const dealerPayments = await Mobile.aggregate([
            {
                $match: {
                    shop_id: req.shopId,
                    dealer_id: { $exists: true, $ne: null },
                    payments: { $exists: true, $ne: [] }
                }
            },
            { $unwind: '$payments' },
            {
                $match: {
                    'payments.date': { $gte: startDate, $lte: endDate }
                }
            },
            {
                $lookup: {
                    from: 'dealers',
                    localField: 'dealer_id',
                    foreignField: '_id',
                    as: 'dealer'
                }
            },
            { $unwind: { path: '$dealer', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    date: '$payments.date',
                    dealerName: { $ifNull: ['$dealer.client_name', 'Unknown Dealer'] },
                    dealerPhone: { $ifNull: ['$dealer.mobile_number', ''] },
                    brand: { $ifNull: ['$mobile_name', ''] },
                    model: { $ifNull: ['$model', ''] },
                    issue: { $ifNull: ['$issue', ''] },
                    mobileName: {
                        $concat: [
                            { $ifNull: ['$mobile_name', ''] },
                            ' ',
                            { $ifNull: ['$model', ''] }
                        ]
                    },
                    supplierName: { $ifNull: ['$supplierName', ''] },
                    supplierAmount: { $ifNull: ['$supplier_amount', 0] },
                    paymentMethod: { $ifNull: ['$payments.method', 'Cash'] },
                    amount: { $ifNull: ['$payments.amount', 0] }
                }
            },
            { $sort: { date: 1 } }
        ]);
        
        // Add legacy dealer payments (mobiles without payments array but created in period)
        const legacyDealerPayments = await Mobile.aggregate([
            {
                $match: {
                    shop_id: req.shopId,
                    created_at: { $gte: startDate, $lte: endDate },
                    paid_amount: { $gt: 0 },
                    dealer_id: { $exists: true, $ne: null },
                    $or: [
                        { payments: { $exists: false } },
                        { payments: { $size: 0 } }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'dealers',
                    localField: 'dealer_id',
                    foreignField: '_id',
                    as: 'dealer'
                }
            },
            { $unwind: { path: '$dealer', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    date: '$created_at',
                    dealerName: { $ifNull: ['$dealer.client_name', 'Unknown Dealer'] },
                    dealerPhone: { $ifNull: ['$dealer.mobile_number', ''] },
                    brand: { $ifNull: ['$mobile_name', ''] },
                    model: { $ifNull: ['$model', ''] },
                    issue: { $ifNull: ['$issue', ''] },
                    mobileName: {
                        $concat: [
                            { $ifNull: ['$mobile_name', ''] },
                            ' ',
                            { $ifNull: ['$model', ''] }
                        ]
                    },
                    supplierName: { $ifNull: ['$supplierName', ''] },
                    supplierAmount: { $ifNull: ['$supplier_amount', 0] },
                    paymentMethod: { 
                        $cond: {
                            if: { $ne: ['$paymentMethod', null] },
                            then: '$paymentMethod',
                            else: { $ifNull: ['$payment', 'Cash'] }
                        }
                    },
                    amount: { $ifNull: ['$paid_amount', 0] }
                }
            },
            { $sort: { date: 1 } }
        ]);
        
        // Combine modern and legacy dealer payments
        const allDealerPayments = [...dealerPayments, ...legacyDealerPayments];

        // Supplier Payments - Get from mobiles with supplier info
        // Use update_date (when supplier payment was recorded) with fallback to created_at for older records
        const supplierPayments = await Mobile.aggregate([
            {
                $addFields: {
                    _supplierDate: { $ifNull: ['$update_date', '$created_at'] }
                }
            },
            {
                $match: {
                    shop_id: req.shopId,
                    _supplierDate: { $gte: startDate, $lte: endDate },
                    supplier_amount: { $gt: 0 }
                }
            },
            {
                $project: {
                    date: '$_supplierDate',
                    supplierName: { $ifNull: ['$supplierName', 'Supplier'] },
                    productName: { $ifNull: ['$productName', 'Product/Part'] },
                    paymentMethod: { 
                        $cond: {
                            if: { $ne: ['$paymentMethod', null] },
                            then: '$paymentMethod',
                            else: { $ifNull: ['$payment', 'Cash'] }
                        }
                    },
                    amount: { $ifNull: ['$supplier_amount', 0] }
                }
            },
            { $sort: { date: 1 } }
        ]);

        // Operating Expenses - Get from expenses collection
        const operatingExpenses = await Expense.aggregate([
            {
                $match: {
                    shop_id: req.shopId,
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $project: {
                    date: '$createdAt',
                    category: { $ifNull: ['$category', 'Operating'] },
                    description: { $ifNull: ['$description', 'Expense'] },
                    amount: '$amount'
                }
            },
            { $sort: { date: 1 } }
        ]);

        // Also get AdminSale revenue
        const adminSales = await AdminSale.aggregate([
            {
                $match: {
                    shop_id: req.shopId,
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $project: {
                    date: '$createdAt',
                    customerName: 'Product Sale',
                    mobileName: { $ifNull: ['$productName', 'Products'] },
                    paymentMethod: { $ifNull: ['$paymentMethod', 'Cash'] },
                    amount: { $ifNull: ['$totalAmount', 0] }
                }
            },
            { $sort: { date: 1 } }
        ]);

        // Combine all customer payments (modern + legacy + admin sales)
        const finalCustomerPayments = [...allCustomerPayments, ...adminSales];

        // Calculate totals
        const totalCustomerPayments = finalCustomerPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const totalDealerPayments = allDealerPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const totalRevenue = totalCustomerPayments + totalDealerPayments;
        const totalSupplierPayments = supplierPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const totalOperatingExpenses = operatingExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const totalExpenses = totalSupplierPayments + totalOperatingExpenses;
        const netProfit = totalRevenue - totalExpenses;
        const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        // Payment Method Breakdown
        const paymentBreakdown = await Mobile.aggregate([
            {
                $match: {
                    shop_id: req.shopId,
                    created_at: { $gte: startDate, $lte: endDate },
                    paid_amount: { $gt: 0 }
                }
            },
            {
                $group: {
                    _id: { 
                        $cond: {
                            if: { $ne: ['$paymentMethod', null] },
                            then: '$paymentMethod',
                            else: { $ifNull: ['$payment', 'Cash'] }
                        }
                    },
                    total: { $sum: { $ifNull: ['$paid_amount', 0] } },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    method: '$_id',
                    total: 1,
                    count: 1
                }
            },
            { $sort: { total: -1 } }
        ]);

        res.json({
            success: true,
            report: {
                periodStart: startDate.toLocaleDateString('en-IN'),
                periodEnd: endDate.toLocaleDateString('en-IN'),
                summary: {
                    totalRevenue,
                    totalCustomerPayments,
                    totalDealerPayments,
                    totalSupplierPayments,
                    totalOperatingExpenses,
                    totalExpenses,
                    netProfit,
                    profitMargin
                },
                customerPayments: finalCustomerPayments,
                dealerPayments: allDealerPayments,
                supplierPayments,
                expenses: operatingExpenses,
                paymentBreakdown
            }
        });
    } catch (error) {
        console.error('Financial report error:', error);
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

// ✅ Shop Admin Logout endpoint - invalidates shop admin's session
router.post('/logout', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(400).json({ success: false, message: 'No token provided' });
        }

        // Verify and decode token
        const decoded = jwt.verify(token, SHOP_ADMIN_JWT_SECRET);
        
        // Invalidate session
        await SessionManager.invalidateCurrentSession(decoded.adminId.toString(), token);
        
        return res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (err) {
        console.error('Shop admin logout error:', err);
        // Even if there's an error, return success (user intent is to logout)
        return res.json({
            success: true,
            message: 'Logged out'
        });
    }
});

// ✅ Update shop admin session limit (from infinest admin portal)
router.patch('/:adminId/session-limit', internalAuth, async (req, res) => {
    try {
        const { adminId } = req.params;
        const { sessionLimit } = req.body;

        if (!sessionLimit || sessionLimit < 1 || sessionLimit > 10) {
            return res.status(400).json({ 
                success: false, 
                message: 'Session limit must be between 1 and 10' 
            });
        }

        const shopAdmin = await ShopAdmin.findByIdAndUpdate(
            adminId,
            { sessionLimit: parseInt(sessionLimit), updated_at: new Date() },
            { new: true }
        ).select('_id username email sessionLimit');

        if (!shopAdmin) {
            return res.status(404).json({ 
                success: false, 
                message: 'Shop admin not found' 
            });
        }

        res.json({
            success: true,
            message: 'Session limit updated successfully',
            shopAdmin
        });
    } catch (error) {
        console.error('Update shop admin session limit error:', error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to update session limit", 
            error: error.message 
        });
    }
});

// ==============================
// 🔒 Toggle Revenue Visibility for Users
// ==============================
// GET current revenue visibility setting
router.get('/shop-settings/revenue-visibility', shopAdminAuth, async (req, res) => {
    try {
        const shop = await Shop.findById(req.shopId);
        if (!shop) {
            return res.status(404).json({ success: false, message: 'Shop not found' });
        }
        res.json({
            success: true,
            revenueVisibleToUsers: shop.revenue_visible_to_users !== false // default true
        });
    } catch (error) {
        console.error('Get revenue visibility error:', error);
        res.status(500).json({ success: false, message: 'Failed to get setting', error: error.message });
    }
});

// PATCH toggle revenue visibility
router.patch('/shop-settings/revenue-visibility', shopAdminAuth, async (req, res) => {
    try {
        const { revenueVisibleToUsers } = req.body;
        if (typeof revenueVisibleToUsers !== 'boolean') {
            return res.status(400).json({ success: false, message: 'revenueVisibleToUsers must be a boolean' });
        }
        const shop = await Shop.findByIdAndUpdate(
            req.shopId,
            { revenue_visible_to_users: revenueVisibleToUsers },
            { new: true }
        );
        if (!shop) {
            return res.status(404).json({ success: false, message: 'Shop not found' });
        }
        res.json({
            success: true,
            message: `Revenue visibility ${revenueVisibleToUsers ? 'enabled' : 'disabled'} for users`,
            revenueVisibleToUsers: shop.revenue_visible_to_users
        });
    } catch (error) {
        console.error('Toggle revenue visibility error:', error);
        res.status(500).json({ success: false, message: 'Failed to update setting', error: error.message });
    }
});

// ==============================
// 📡 eSSL M20 Attendance Settings
// ==============================
const { EsslDevice, EsslPunchLog } = require('../models/mongoModels');
const { getDevicesForShop, getPunchLogsForShop } = require('../controllers/admsController');

// GET current eSSL settings for shop
router.get('/shop-settings/essl', shopAdminAuth, async (req, res) => {
    try {
        const shop = await Shop.findById(req.shopId).select('use_essl_attendance essl_device_serial shop_name');
        if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

        const devices = await getDevicesForShop(req.shopId);
        res.json({
            success: true,
            useEsslAttendance: shop.use_essl_attendance || false,
            esslDeviceSerial: shop.essl_device_serial || null,
            devices,
        });
    } catch (error) {
        console.error('Get eSSL settings error:', error);
        res.status(500).json({ success: false, message: 'Failed to get eSSL settings' });
    }
});

// PATCH toggle eSSL attendance & set device serial
router.patch('/shop-settings/essl', shopAdminAuth, async (req, res) => {
    try {
        const { useEsslAttendance, esslDeviceSerial } = req.body;

        if (typeof useEsslAttendance !== 'boolean') {
            return res.status(400).json({ success: false, message: 'useEsslAttendance must be a boolean' });
        }

        const updateData = { use_essl_attendance: useEsslAttendance };

        // Validate & link device serial when enabling
        if (useEsslAttendance) {
            if (!esslDeviceSerial || typeof esslDeviceSerial !== 'string') {
                return res.status(400).json({ success: false, message: 'esslDeviceSerial is required when enabling eSSL attendance' });
            }
            const serialSanitised = esslDeviceSerial.trim().slice(0, 64);
            updateData.essl_device_serial = serialSanitised;

            // Link device to this shop if it exists
            await EsslDevice.findOneAndUpdate(
                { device_serial: serialSanitised },
                { $set: { shop_id: req.shopId, is_active: true, last_activity: 'Linked to shop via admin portal' } },
                { upsert: true, new: true }
            );
        } else {
            // Deactivate device link when disabling — fetch current serial from DB first
            const currentShop = await Shop.findById(req.shopId).select('essl_device_serial').lean();
            if (currentShop?.essl_device_serial) {
                await EsslDevice.findOneAndUpdate(
                    { device_serial: currentShop.essl_device_serial },
                    { $set: { is_active: false, last_activity: 'Unlinked from shop via admin portal' } }
                );
            }
        }

        const shop = await Shop.findByIdAndUpdate(req.shopId, updateData, { new: true });
        if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

        res.json({
            success: true,
            message: `eSSL attendance ${useEsslAttendance ? 'enabled' : 'disabled'}`,
            useEsslAttendance: shop.use_essl_attendance,
            esslDeviceSerial: shop.essl_device_serial || null,
        });
    } catch (error) {
        console.error('Toggle eSSL settings error:', error);
        res.status(500).json({ success: false, message: 'Failed to update eSSL settings' });
    }
});

// GET recent ADMS punch logs for current shop (admin audit view)
router.get('/essl/punch-logs', shopAdminAuth, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 100, 500);
        const logs = await getPunchLogsForShop(req.shopId, limit);
        res.json({ success: true, logs });
    } catch (error) {
        console.error('Get punch logs error:', error);
        res.status(500).json({ success: false, message: 'Failed to get punch logs' });
    }
});

// GET registered devices for this shop
router.get('/essl/devices', shopAdminAuth, async (req, res) => {
    try {
        const devices = await getDevicesForShop(req.shopId);
        res.json({ success: true, devices });
    } catch (error) {
        console.error('Get eSSL devices error:', error);
        res.status(500).json({ success: false, message: 'Failed to get devices' });
    }
});

// GET detailed device connection status + debug info
router.get('/essl/device-status', shopAdminAuth, async (req, res) => {
    try {
        const { EsslDevice, EsslPunchLog } = require('../models/mongoModels');
        const mongoose = require('mongoose');
        const shopId = req.shopId;
        const shop = await Shop.findById(shopId);
        const esslSerial = shop?.essl_device_serial || null;

        // Find the registered device
        const device = esslSerial
            ? await EsslDevice.findOne({ device_serial: esslSerial }).lean()
            : await EsslDevice.findOne({ shop_id: shopId }).sort({ created_at: -1 }).lean();

        // Last punch log for this shop
        const lastPunch = await EsslPunchLog.findOne({ shop_id: shopId })
            .sort({ punch_time: -1 }).lean();

        // Total punches today
        const todayStr = new Date().toISOString().slice(0, 10);
        const todayPunches = await EsslPunchLog.countDocuments({
            shop_id: shopId,
            punch_time: { $gte: new Date(todayStr + 'T00:00:00.000Z') },
        });

        // Online check: last_seen within 5 minutes
        const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
        const lastSeenMs = device?.last_seen ? Date.now() - new Date(device.last_seen).getTime() : null;
        const isOnline = lastSeenMs !== null && lastSeenMs < ONLINE_THRESHOLD_MS;
        const hasEverConnected = !!device?.last_seen;

        // ADMS server URL that must be configured in the device
        const admsServerUrl = process.env.ADMS_SERVER_URL || 'http://billit.infinestech.com/iclock/';

        res.json({
            success: true,
            deviceRegistered: !!device,
            isOnline,
            hasEverConnected,
            deviceSerial: device?.device_serial || esslSerial || null,
            deviceName: device?.device_name || null,
            lastSeen: device?.last_seen || null,
            lastSeenMsAgo: lastSeenMs,
            lastActivity: device?.last_activity || null,
            lastPunch: lastPunch ? {
                time: lastPunch.punch_time,
                pin: lastPunch.device_pin,
                type: lastPunch.punch_type,
            } : null,
            todayPunchCount: todayPunches,
            // Debug / setup info
            debug: {
                admsServerUrl,
                requiredConfig: {
                    'ADMS Server Address': admsServerUrl,
                    'Server Port': '80 (HTTP — NOT HTTPS)',
                    'Device Serial': device?.device_serial || esslSerial || '(not set)',
                },
                tip: hasEverConnected
                    ? 'Device has connected before. If showing offline, check network or ADMS config.'
                    : 'Device has NEVER connected. Configure the ADMS server URL in the eSSL device settings.',
            },
        });
    } catch (error) {
        console.error('Get eSSL device status error:', error);
        res.status(500).json({ success: false, message: 'Failed to get device status' });
    }
});

// PATCH employee device_pin — map an employee to their eSSL device PIN
router.patch('/essl/employee-pin', shopAdminAuth, async (req, res) => {
    try {
        const { employee_id, device_pin } = req.body;
        if (!employee_id) return res.status(400).json({ success: false, message: 'employee_id required' });

        // Validate pin: digits only, 1-10 chars, or empty string to clear
        if (device_pin !== '' && device_pin !== null && device_pin !== undefined) {
            if (!/^\d{1,10}$/.test(String(device_pin).trim())) {
                return res.status(400).json({ success: false, message: 'device_pin must be numeric (1-10 digits)' });
            }
        }

        const { Employee, EsslPunchLog, Attendance } = require('../models/mongoModels');
        const mongoose = require('mongoose');
        const employee = await Employee.findOne({ _id: new mongoose.Types.ObjectId(employee_id), shop_id: req.shopId });
        if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

        const newPin = device_pin ? String(device_pin).trim() : undefined;

        // Prevent the same PIN being assigned to two employees in the same shop
        if (newPin) {
            const conflict = await Employee.findOne({
                shop_id: req.shopId,
                device_pin: newPin,
                _id: { $ne: employee._id },
            });
            if (conflict) {
                return res.status(409).json({
                    success: false,
                    message: `PIN ${newPin} is already assigned to ${conflict.name || conflict.employee_name}`,
                });
            }
        }

        employee.device_pin = newPin;
        await employee.save();

        // ── Backfill historical unmapped punches for this PIN ──────────────────
        let backfilled = 0;
        if (newPin) {
            const { processPunch } = require('../controllers/hrController');
            const unmapped = await EsslPunchLog.find({
                shop_id: req.shopId,
                device_pin: newPin,
                employee_id: { $in: [null, undefined] },
            }).sort({ punch_time: 1 }).lean();

            for (const log of unmapped) {
                try {
                    // Link the punch log
                    await EsslPunchLog.updateOne(
                        { _id: log._id },
                        { $set: { employee_id: employee._id, processed: true } },
                    );

                    // Upsert legacy Attendance for that date
                    const dateStr = new Date(log.punch_time).toISOString().slice(0, 10);
                    const existing = await Attendance.findOne({ employee_id: employee._id, date: dateStr });
                    if (!existing) {
                        await Attendance.create({
                            shop_id: req.shopId,
                            employee_id: employee._id,
                            date: dateStr,
                            status: 'present',
                            locked: false,
                            source: 'essl_m20',
                            check_in_time: log.punch_type === 'check_in' ? log.punch_time : undefined,
                            check_out_time: log.punch_type === 'check_out' ? log.punch_time : undefined,
                        });
                    } else {
                        const update = { source: 'essl_m20' };
                        if (log.punch_type === 'check_in' && !existing.check_in_time) update.check_in_time = log.punch_time;
                        if (log.punch_type === 'check_out') update.check_out_time = log.punch_time;
                        await Attendance.findByIdAndUpdate(existing._id, { $set: update });
                    }

                    // Feed into HR daily attendance (state machine + summary)
                    await processPunch(
                        req.shopId.toString(),
                        employee._id.toString(),
                        'ESSL_M20',
                        null,
                        new Date(log.punch_time),
                    );
                    backfilled++;
                } catch (e) {
                    console.error('[PIN backfill] punch error:', e.message);
                }
            }
        }

        res.json({
            success: true,
            message: backfilled > 0
                ? `Device PIN updated. ${backfilled} historical punch(es) linked to this employee.`
                : 'Device PIN updated.',
            device_pin: employee.device_pin || null,
            backfilled,
        });
    } catch (error) {
        console.error('Update employee device pin error:', error);
        res.status(500).json({ success: false, message: 'Failed to update device PIN' });
    }
});

// GET list of unlinked (auto-registered) devices — for "claim" UX
router.get('/essl/unlinked-devices', shopAdminAuth, async (req, res) => {
    try {
        const { EsslDevice } = require('../models/mongoModels');
        const devices = await EsslDevice.find({ shop_id: null })
            .sort({ last_seen: -1 })
            .limit(50)
            .lean();
        res.json({ success: true, devices });
    } catch (error) {
        console.error('Get unlinked devices error:', error);
        res.status(500).json({ success: false, message: 'Failed to get unlinked devices' });
    }
});

// POST link an unassigned device to current shop (set shop_id + activate)
router.post('/essl/link-device', shopAdminAuth, async (req, res) => {
    try {
        const { device_serial, device_name } = req.body;
        if (!device_serial) return res.status(400).json({ success: false, message: 'device_serial required' });

        const { EsslDevice } = require('../models/mongoModels');
        const device = await EsslDevice.findOne({ device_serial: String(device_serial).trim() });
        if (!device) return res.status(404).json({ success: false, message: 'Device not found. Make sure it has connected at least once.' });

        if (device.shop_id && device.shop_id.toString() !== req.shopId.toString()) {
            return res.status(409).json({ success: false, message: 'Device already linked to a different shop.' });
        }

        device.shop_id = req.shopId;
        device.is_active = true;
        if (device_name) device.device_name = String(device_name).trim();
        device.last_activity = 'Linked to shop';
        await device.save();

        // Also persist the serial on the shop record for quick access
        await Shop.findByIdAndUpdate(req.shopId, { $set: { essl_device_serial: device.device_serial } });

        res.json({ success: true, message: 'Device linked successfully', device });
    } catch (error) {
        console.error('Link device error:', error);
        res.status(500).json({ success: false, message: 'Failed to link device' });
    }
});

// POST unlink — set shop_id=null and deactivate (admin can move device to another shop)
router.post('/essl/unlink-device', shopAdminAuth, async (req, res) => {
    try {
        const { device_serial } = req.body;
        if (!device_serial) return res.status(400).json({ success: false, message: 'device_serial required' });

        const { EsslDevice } = require('../models/mongoModels');
        const device = await EsslDevice.findOne({ device_serial: String(device_serial).trim(), shop_id: req.shopId });
        if (!device) return res.status(404).json({ success: false, message: 'Device not found in this shop' });

        device.shop_id = null;
        device.is_active = false;
        device.last_activity = 'Unlinked from shop';
        await device.save();

        await Shop.findByIdAndUpdate(req.shopId, { $unset: { essl_device_serial: '' } });

        res.json({ success: true, message: 'Device unlinked' });
    } catch (error) {
        console.error('Unlink device error:', error);
        res.status(500).json({ success: false, message: 'Failed to unlink device' });
    }
});

// ── HR Routes (employee CRUD, attendance punch, salary calculation) ───────────
const hrController = require('../controllers/hrController');

// 🔐 Apply shopAdminAuth to ALL /hr/* routes (otherwise req.shopId is undefined)
router.use('/hr', shopAdminAuth);

// Employee CRUD
router.get('/hr/employees',                       hrController.listEmployees);
router.post('/hr/employees',                      hrController.createEmployee);
router.put('/hr/employees/:id',                   hrController.updateEmployee);
router.patch('/hr/employees/:id/deactivate',      hrController.deactivateEmployee);
router.patch('/hr/employees/:id/reactivate',      hrController.reactivateEmployee);
router.delete('/hr/employees/:id',                hrController.deleteEmployee);

// Attendance
router.get('/hr/attendance/daily',                hrController.getDailyAttendance);
router.post('/hr/attendance/punch',               hrController.softwarePunch);
router.get('/hr/attendance/report',               hrController.getAttendanceReport);
router.post('/hr/attendance/manual',              hrController.manualMark);
router.get('/hr/attendance/:id/monthly',          hrController.getMonthlyAttendance);

// Salary
router.get('/hr/salary/report',                   hrController.getSalaryReport);
router.post('/hr/salary/generate',                hrController.generateSalary);
router.post('/hr/salary/generate-bulk',           hrController.generateBulkSalary);
router.patch('/hr/salary/:id/finalize',           hrController.finalizeSalary);
router.patch('/hr/salary/:id/mark-paid',          hrController.markSalaryPaid);
router.get('/hr/salary/:id',                      hrController.getSalaryRecord);

// HR shop-level settings (duplicate punch window, lunch threshold/duration)
router.get('/hr/settings',                        hrController.getHrSettings);
router.patch('/hr/settings',                      hrController.updateHrSettings);

// ============================================================================
// CRUD ENDPOINTS — Records / Suppliers / Inventory / Expenses (shop-scoped)
// All endpoints below run under shopAdminAuth and use req.shopId for scoping.
// ============================================================================

const { Supplier: SupplierModel } = require('../models/supplier');
const { ProductHistory, SupplierHistory } = require('../models/mongoModels');
const { PAYMENT_METHOD_ENUM } = require('../constants/paymentMethods');

// -------------------- BILL NUMBER --------------------
router.post('/records/next-bill-number', shopAdminAuth, async (req, res) => {
    try {
        const { prefix } = req.body;
        if (!prefix || (prefix !== 'CUST' && prefix !== 'DEAL')) {
            return res.status(400).json({ success: false, message: "prefix must be 'CUST' or 'DEAL'" });
        }
        const Model = prefix === 'CUST' ? Customer : Dealer;
        const existing = await Model.find({
            shop_id: req.shopId,
            bill_no: { $regex: `^${prefix}-`, $ne: null }
        }).select('bill_no').lean();
        let highest = 0;
        const re = new RegExp(`^${prefix}-(\\d+)$`);
        existing.forEach(r => { const m = r.bill_no?.match(re); if (m) { const n = parseInt(m[1], 10); if (n > highest) highest = n; } });
        const billNumber = `${prefix}-${String(highest + 1).padStart(4, '0')}`;
        res.json({ success: true, billNumber });
    } catch (err) {
        console.error('next-bill-number error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/records/check-bill-number', shopAdminAuth, async (req, res) => {
    try {
        const { billNumber } = req.body;
        if (!billNumber) return res.status(400).json({ success: false, message: 'billNumber required' });
        const [c, d] = await Promise.all([
            Customer.findOne({ shop_id: req.shopId, bill_no: billNumber.trim() }).select('_id').lean(),
            Dealer.findOne({ shop_id: req.shopId, bill_no: billNumber.trim() }).select('_id').lean()
        ]);
        res.json({ success: true, exists: !!(c || d) });
    } catch (err) {
        console.error('check-bill-number error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// -------------------- CUSTOMER / DEALER CREATION --------------------
router.post('/records/customer', shopAdminAuth, async (req, res) => {
    try {
        const { clientName, mobileNumber, billNo, noOfMobile, balanceAmount, estimatedCost, MobileName = [], technicianname } = req.body;
        if (!clientName || !mobileNumber) {
            return res.status(400).json({ success: false, message: 'clientName & mobileNumber required' });
        }
        const customer = await Customer.create({
            shop_id: req.shopId,
            client_name: clientName,
            mobile_number: mobileNumber,
            bill_no: billNo || '',
            customer_type: 'Customer',
            no_of_mobile: Number(noOfMobile) || MobileName.length || 0,
            balance_amount: Number(balanceAmount) || 0,
            estimated_cost: Number(estimatedCost) || 0
        });
        const mobiles = [];
        for (const m of MobileName) {
            const payments = Array.isArray(m.payments) ? m.payments : (m.paid_amount ? [{ amount: Number(m.paid_amount), method: m.payment || 'Cash', date: new Date() }] : []);
            const total_paid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
            const mob = await Mobile.create({
                shop_id: req.shopId,
                customer_id: customer._id,
                mobile_name: m.mobile_name || m.mobileName || '',
                model: m.model || '',
                imei: m.imei || '',
                issue: m.issue || '',
                technician_name: m.technician_name || technicianname || '',
                payments,
                total_paid,
                paid_amount: total_paid
                // `payment` is intentionally not set here — the Mobile schema enum is lowercase
                // ("cash"/"UPI"/...) and defaults to "". Payments are recorded later via the
                // payments[] array (All Records → Pay), matching the fixel/dealer flow.
            });
            mobiles.push(mob);
        }
        res.json({ success: true, customer, mobiles });
    } catch (err) {
        console.error('create customer error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/records/dealer', shopAdminAuth, async (req, res) => {
    try {
        const { clientName, mobileNumber, billNo, balanceAmount, estimatedCost, vendors = [], MobileName = [] } = req.body;
        if (!clientName || !mobileNumber) return res.status(400).json({ success: false, message: 'clientName & mobileNumber required' });
        const dealer = await Dealer.create({
            shop_id: req.shopId,
            client_name: clientName,
            mobile_number: mobileNumber,
            bill_no: billNo || '',
            customer_type: 'Dealer',
            balance_amount: Number(balanceAmount) || 0,
            estimated_cost: Number(estimatedCost) || 0,
            no_of_mobile: vendors.reduce((s, v) => s + (Number(v.mobile_count) || 0), 0) || MobileName.length,
            vendors: vendors.map(v => ({ vendor_name: v.vendor_name, vendor_number: v.vendor_number, mobile_count: Number(v.mobile_count) || 0 }))
        });
        const mobiles = [];
        for (const m of MobileName) {
            const payments = Array.isArray(m.payments) ? m.payments : [];
            const total_paid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
            const mob = await Mobile.create({
                shop_id: req.shopId,
                dealer_id: dealer._id,
                mobile_name: m.mobile_name || '',
                model: m.model || '',
                imei: m.imei || '',
                issue: m.issue || '',
                payments, total_paid, paid_amount: total_paid
            });
            mobiles.push(mob);
        }
        res.json({ success: true, dealer, mobiles });
    } catch (err) {
        console.error('create dealer error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// -------------------- RECORDS LIST / STATUS / DELETE --------------------
router.get('/records', shopAdminAuth, async (req, res) => {
    try {
        const { tab = 'customers', page = 1, limit = 20, q = '' } = req.query;
        const Model = tab === 'dealers' ? Dealer : Customer;
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
        const skip = (pageNum - 1) * limitNum;

        const filter = { shop_id: req.shopId };
        if (q && q.trim()) {
            const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escaped, 'i');
            filter.$or = [{ client_name: regex }, { mobile_number: regex }, { bill_no: regex }];
        }

        const [clients, total, shop] = await Promise.all([
            Model.find(filter).sort({ created_at: -1 }).skip(skip).limit(limitNum).lean(),
            Model.countDocuments(filter),
            Shop.findById(req.shopId).select('owner_name phone address').lean()
        ]);

        const clientIds = clients.map(c => c._id);
        const idField = tab === 'dealers' ? 'dealer_id' : 'customer_id';
        const mobiles = clientIds.length
            ? await Mobile.find({ shop_id: req.shopId, [idField]: { $in: clientIds } }).lean()
            : [];

        res.json({
            success: true,
            [tab]: clients,
            mobiles,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
            shopOwnerName: shop?.owner_name || '',
            shopPhone: shop?.phone || '',
            shopaddress: shop?.address || ''
        });
    } catch (err) {
        console.error('records list error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/records/toggle-status', shopAdminAuth, async (req, res) => {
    try {
        const { mobileId, status, value } = req.body;
        if (!['ready', 'delivered', 'returned'].includes(status)) {
            return res.status(400).json({ success: false, message: 'invalid status' });
        }
        const update = { [status]: !!value };
        if (status === 'delivered' && value) update.delivery_date = new Date();
        const mobile = await Mobile.findOneAndUpdate({ _id: mobileId, shop_id: req.shopId }, update, { new: true });
        if (!mobile) return res.status(404).json({ success: false, message: 'Mobile not found' });
        res.json({ success: true, mobile });
    } catch (err) {
        console.error('toggle-status error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.delete('/records/mobile/:mobileId', shopAdminAuth, async (req, res) => {
    try {
        const result = await Mobile.findOneAndDelete({ _id: req.params.mobileId, shop_id: req.shopId });
        if (!result) return res.status(404).json({ success: false, message: 'Mobile not found' });
        res.json({ success: true });
    } catch (err) {
        console.error('delete mobile error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.put('/records/balance', shopAdminAuth, async (req, res) => {
    try {
        const { id, balanceAmount, type } = req.body;
        const Model = type === 'Dealer' ? Dealer : Customer;
        const updated = await Model.findOneAndUpdate(
            { _id: id, shop_id: req.shopId },
            { balance_amount: Number(balanceAmount) || 0 },
            { new: true }
        );
        if (!updated) return res.status(404).json({ success: false, message: 'Record not found' });
        res.json({ success: true, record: updated });
    } catch (err) {
        console.error('update balance error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.delete('/records/customer/:id', shopAdminAuth, async (req, res) => {
    try {
        const c = await Customer.findOneAndDelete({ _id: req.params.id, shop_id: req.shopId });
        if (!c) return res.status(404).json({ success: false, message: 'Not found' });
        await Mobile.deleteMany({ customer_id: req.params.id, shop_id: req.shopId });
        res.json({ success: true });
    } catch (err) {
        console.error('delete customer error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.delete('/records/dealer/:id', shopAdminAuth, async (req, res) => {
    try {
        const d = await Dealer.findOneAndDelete({ _id: req.params.id, shop_id: req.shopId });
        if (!d) return res.status(404).json({ success: false, message: 'Not found' });
        await Mobile.deleteMany({ dealer_id: req.params.id, shop_id: req.shopId });
        res.json({ success: true });
    } catch (err) {
        console.error('delete dealer error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// -------------------- PAYMENT ENTRY --------------------
router.post('/records/payment', shopAdminAuth, async (req, res) => {
    try {
        const { mobileId, amount, method } = req.body;
        const mobile = await Mobile.findOne({ _id: mobileId, shop_id: req.shopId });
        if (!mobile) return res.status(404).json({ success: false, message: 'Mobile not found' });
        mobile.payments = mobile.payments || [];
        mobile.payments.push({ amount: Number(amount) || 0, method: method || 'Cash', date: new Date() });
        mobile.total_paid = mobile.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        mobile.paid_amount = mobile.total_paid;
        await mobile.save();
        res.json({ success: true, mobile });
    } catch (err) {
        console.error('add payment error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.delete('/records/payment', shopAdminAuth, async (req, res) => {
    try {
        const { mobileId, paymentIndex } = req.body;
        const mobile = await Mobile.findOne({ _id: mobileId, shop_id: req.shopId });
        if (!mobile) return res.status(404).json({ success: false, message: 'Mobile not found' });
        if (!mobile.payments || paymentIndex < 0 || paymentIndex >= mobile.payments.length) {
            return res.status(400).json({ success: false, message: 'invalid paymentIndex' });
        }
        mobile.payments.splice(paymentIndex, 1);
        mobile.total_paid = mobile.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        mobile.paid_amount = mobile.total_paid;
        await mobile.save();
        res.json({ success: true, mobile });
    } catch (err) {
        console.error('delete payment error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// -------------------- SUPPLIERS --------------------
router.get('/suppliers', shopAdminAuth, async (req, res) => {
    try {
        const suppliers = await SupplierModel.find({ userId: req.shopId }).sort({ createdAt: -1 }).lean();
        res.json({ success: true, suppliers });
    } catch (err) {
        console.error('list suppliers error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/suppliers', shopAdminAuth, async (req, res) => {
    try {
        const { supplierName, agencyName, phoneNumber, address } = req.body;
        if (!supplierName?.toString().trim()) return res.status(400).json({ success: false, message: 'supplierName required' });
        const supplier = await SupplierModel.create({
            userId: req.shopId,
            supplierName: supplierName.toString().trim(),
            agencyName: (agencyName || '').toString().trim(),
            phoneNumber: (phoneNumber || '').toString().trim(),
            address: (address || '').toString().trim(),
            totalAmount: 0
        });
        res.json({ success: true, supplier });
    } catch (err) {
        console.error('add supplier error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.put('/suppliers/:id', shopAdminAuth, async (req, res) => {
    try {
        const { supplierName, agencyName, phoneNumber, address, totalAmount, lastPaymentMethod } = req.body;
        const update = {};
        if (supplierName != null) update.supplierName = supplierName.toString().trim();
        if (agencyName != null) update.agencyName = agencyName.toString().trim();
        if (phoneNumber != null) update.phoneNumber = phoneNumber.toString().trim();
        if (address != null) update.address = address.toString().trim();
        if (totalAmount != null) update.totalAmount = Number(totalAmount) || 0;
        if (lastPaymentMethod != null) update.lastPaymentMethod = lastPaymentMethod;
        const supplier = await SupplierModel.findOneAndUpdate({ _id: req.params.id, userId: req.shopId }, update, { new: true });
        if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
        res.json({ success: true, supplier });
    } catch (err) {
        console.error('update supplier error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.delete('/suppliers/:id', shopAdminAuth, async (req, res) => {
    try {
        const supplier = await SupplierModel.findOneAndDelete({ _id: req.params.id, userId: req.shopId });
        if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
        res.json({ success: true });
    } catch (err) {
        console.error('delete supplier error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// -------------------- PRODUCTS / INVENTORY --------------------
router.get('/products', shopAdminAuth, async (req, res) => {
    try {
        const products = await Product.find({ userId: req.shopId }).sort({ addedDate: -1 }).lean();
        res.json({ success: true, products });
    } catch (err) {
        console.error('list products error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/products', shopAdminAuth, async (req, res) => {
    try {
        const { name, category, costPrice, sellingPrice, quantity, supplierId, paymentMethod } = req.body;
        if (!name || costPrice == null || quantity == null) {
            return res.status(400).json({ success: false, message: 'name, costPrice, quantity required' });
        }
        const product = await Product.create({
            userId: req.shopId,
            name: name.toString().trim(),
            category: (category || '').toString().trim(),
            costPrice: Number(costPrice),
            sellingPrice: Number(sellingPrice) || 0,
            quantity: Number(quantity),
            supplierId: supplierId || undefined,
            paymentMethod: paymentMethod || undefined,
            addedDate: new Date()
        });
        if (supplierId) {
            const cost = Number(costPrice) * Number(quantity);
            await SupplierModel.findOneAndUpdate(
                { _id: supplierId, userId: req.shopId },
                { $inc: { totalAmount: cost }, lastPaymentMethod: paymentMethod || '' }
            );
        }
        await ProductHistory.create({
            productId: product._id, changeDate: new Date(), changeType: 'ADD',
            quantity: Number(quantity), costPrice: Number(costPrice)
        });
        res.json({ success: true, product });
    } catch (err) {
        console.error('add product error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.put('/products/:id', shopAdminAuth, async (req, res) => {
    try {
        const { name, category, costPrice, sellingPrice, quantity } = req.body;
        const product = await Product.findOne({ _id: req.params.id, userId: req.shopId });
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
        if (name != null) product.name = name.toString().trim();
        if (category != null) product.category = category.toString().trim();
        if (costPrice != null) product.costPrice = Number(costPrice);
        if (sellingPrice != null) product.sellingPrice = Number(sellingPrice);
        if (quantity != null) product.quantity = Number(quantity);
        product.updatedAt = new Date();
        await product.save();
        await ProductHistory.create({
            productId: product._id, changeDate: new Date(), changeType: 'EDIT',
            quantity: product.quantity, costPrice: product.costPrice
        });
        res.json({ success: true, product });
    } catch (err) {
        console.error('update product error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.delete('/products/:id', shopAdminAuth, async (req, res) => {
    try {
        const p = await Product.findOneAndDelete({ _id: req.params.id, userId: req.shopId });
        if (!p) return res.status(404).json({ success: false, message: 'Product not found' });
        await ProductHistory.create({
            productId: p._id, changeDate: new Date(), changeType: 'REMOVE',
            quantity: p.quantity, costPrice: p.costPrice
        });
        res.json({ success: true });
    } catch (err) {
        console.error('delete product error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/products/:id/sell', shopAdminAuth, async (req, res) => {
    try {
        const { quantitySold, sellingPrice } = req.body;
        const product = await Product.findOne({ _id: req.params.id, userId: req.shopId });
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
        const qty = Number(quantitySold) || 0;
        if (qty <= 0 || qty > product.quantity) return res.status(400).json({ success: false, message: 'Invalid quantity' });
        product.quantity -= qty;
        if (sellingPrice != null) product.sellingPrice = Number(sellingPrice);
        product.updatedAt = new Date();
        await product.save();
        await ProductHistory.create({
            productId: product._id, changeDate: new Date(), changeType: 'SELL',
            quantity: qty, costPrice: product.costPrice,
            paidAmount: (Number(sellingPrice) || product.sellingPrice) * qty
        });
        res.json({ success: true, product });
    } catch (err) {
        console.error('sell product error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/products/:id/restock', shopAdminAuth, async (req, res) => {
    try {
        const { quantityToAdd } = req.body;
        const qty = Number(quantityToAdd) || 0;
        if (qty <= 0) return res.status(400).json({ success: false, message: 'Invalid quantity' });
        const product = await Product.findOne({ _id: req.params.id, userId: req.shopId });
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
        product.quantity += qty;
        product.updatedAt = new Date();
        await product.save();
        await ProductHistory.create({
            productId: product._id, changeDate: new Date(), changeType: 'RESTOCK',
            quantity: qty, costPrice: product.costPrice
        });
        res.json({ success: true, product });
    } catch (err) {
        console.error('restock product error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// -------------------- EXPENSES --------------------
router.get('/expenses', shopAdminAuth, async (req, res) => {
    try {
        const { fromDate, toDate } = req.query;
        const filter = { userId: req.shopId };
        if (fromDate || toDate) {
            filter.createdAt = {};
            if (fromDate) filter.createdAt.$gte = new Date(fromDate);
            if (toDate) filter.createdAt.$lte = new Date(toDate);
        }
        const expenses = await Expense.find(filter).sort({ createdAt: -1 }).lean();
        const total = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
        res.json({ success: true, expenses, total });
    } catch (err) {
        console.error('list expenses error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/expenses', shopAdminAuth, async (req, res) => {
    try {
        const { title, amount, paymentMethod } = req.body;
        if (!title || amount == null) return res.status(400).json({ success: false, message: 'title & amount required' });
        const expense = await Expense.create({
            userId: req.shopId,
            title: title.toString().trim(),
            amount: Number(amount),
            paymentMethod: paymentMethod || 'Cash'
        });
        res.json({ success: true, expense });
    } catch (err) {
        console.error('add expense error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.put('/expenses/:id', shopAdminAuth, async (req, res) => {
    try {
        const { title, amount, paymentMethod } = req.body;
        const update = {};
        if (title != null) update.title = title.toString().trim();
        if (amount != null) update.amount = Number(amount);
        if (paymentMethod != null) update.paymentMethod = paymentMethod;
        const expense = await Expense.findOneAndUpdate({ _id: req.params.id, userId: req.shopId }, update, { new: true });
        if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });
        res.json({ success: true, expense });
    } catch (err) {
        console.error('update expense error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.delete('/expenses/:id', shopAdminAuth, async (req, res) => {
    try {
        const e = await Expense.findOneAndDelete({ _id: req.params.id, userId: req.shopId });
        if (!e) return res.status(404).json({ success: false, message: 'Expense not found' });
        res.json({ success: true });
    } catch (err) {
        console.error('delete expense error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// -------------------- BALANCE SUMMARY --------------------
router.get('/balance-summary', shopAdminAuth, async (req, res) => {
    try {
        const [customers, dealers] = await Promise.all([
            Customer.find({ shop_id: req.shopId, balance_amount: { $gt: 0 } })
                .select('client_name mobile_number balance_amount bill_no created_at').sort({ balance_amount: -1 }).lean(),
            Dealer.find({ shop_id: req.shopId, balance_amount: { $gt: 0 } })
                .select('client_name mobile_number balance_amount bill_no vendors created_at').sort({ balance_amount: -1 }).lean()
        ]);
        const totalCustomerBalance = customers.reduce((s, c) => s + (Number(c.balance_amount) || 0), 0);
        const totalDealerBalance = dealers.reduce((s, d) => s + (Number(d.balance_amount) || 0), 0);
        res.json({
            success: true, customers, dealers, totalCustomerBalance, totalDealerBalance,
            grandTotal: totalCustomerBalance + totalDealerBalance
        });
    } catch (err) {
        console.error('balance summary error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// -------------------- MOBILE REGISTRY (grouped by mobile_name) --------------------
router.get('/mobile-registry', shopAdminAuth, async (req, res) => {
    try {
        const mobiles = await Mobile.find({ shop_id: req.shopId })
            .populate('customer_id', 'client_name mobile_number')
            .populate('dealer_id', 'client_name mobile_number')
            .sort({ created_at: -1 }).lean();
        res.json({ success: true, mobiles });
    } catch (err) {
        console.error('mobile-registry error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// -------------------- META --------------------
router.get('/meta/payment-methods', shopAdminAuth, (req, res) => {
    res.json({ success: true, paymentMethods: PAYMENT_METHOD_ENUM });
});

// Mobile brands (shop-specific + global) — shop-admin equivalent of GET /api/mobile-brands/:shopId
router.get('/meta/mobile-brands', shopAdminAuth, async (req, res) => {
    try {
        const brands = await MobileBrand.find({
            $or: [{ shop_id: req.shopId }, { shop_id: null }],
            is_active: true
        }).sort({ brand_name: 1 }).lean();
        res.json({ success: true, brands });
    } catch (err) {
        console.error('meta mobile-brands error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Add a custom mobile brand for this shop
router.post('/meta/mobile-brands', shopAdminAuth, async (req, res) => {
    try {
        const { brandName } = req.body;
        if (!brandName || !brandName.trim()) {
            return res.status(400).json({ success: false, message: 'brandName required' });
        }
        const existing = await MobileBrand.findOne({
            shop_id: req.shopId,
            brand_name: { $regex: new RegExp(`^${brandName.trim()}$`, 'i') }
        });
        if (existing) return res.status(400).json({ success: false, message: 'Brand already exists' });
        const brand = await MobileBrand.create({
            shop_id: req.shopId,
            brand_name: brandName.trim(),
            is_custom: true,
            is_active: true
        });
        res.json({ success: true, brand });
    } catch (err) {
        console.error('add mobile-brand error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Mobile issues (shop-specific + global) — shop-admin equivalent of GET /api/mobile-issues/:shopId
router.get('/meta/mobile-issues', shopAdminAuth, async (req, res) => {
    try {
        const issues = await MobileIssue.find({
            $or: [{ shop_id: req.shopId }, { shop_id: null }],
            is_active: true
        }).sort({ issue_category: 1, issue_name: 1 }).lean();
        res.json({ success: true, issues });
    } catch (err) {
        console.error('meta mobile-issues error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Add a custom mobile issue for this shop
router.post('/meta/mobile-issues', shopAdminAuth, async (req, res) => {
    try {
        const { issueName, issueCategory } = req.body;
        if (!issueName || !issueName.trim()) {
            return res.status(400).json({ success: false, message: 'issueName required' });
        }
        const existing = await MobileIssue.findOne({
            shop_id: req.shopId,
            issue_name: { $regex: new RegExp(`^${issueName.trim()}$`, 'i') }
        });
        if (existing) return res.status(400).json({ success: false, message: 'Issue already exists' });
        const issue = await MobileIssue.create({
            shop_id: req.shopId,
            issue_name: issueName.trim(),
            issue_category: (issueCategory && issueCategory.trim()) || 'General',
            is_custom: true,
            is_active: true
        });
        res.json({ success: true, issue });
    } catch (err) {
        console.error('add mobile-issue error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;


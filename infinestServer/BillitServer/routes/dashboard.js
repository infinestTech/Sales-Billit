const express = require("express")
const router = express.Router()
const authenticateToken = require("../utils/authMiddleware")
const axios = require("../utils/axiosConfig")
const { getISTTodayRange } = require("../utils/dateHelper")
const {
  Shop,
  Customer,
  Dealer,
  Mobile,
  Technician,
  Product,
  ProductHistory,
  Expense,
  DailySummary,
} = require("../models/mongoModels")

// Lightweight endpoint for frontend to check if revenue/analytics is visible to users
router.get("/revenue-visibility", authenticateToken, async (req, res) => {
  try {
    const shopId = req.user.shop_id
    if (!shopId) {
      return res.status(400).json({ error: "Shop ID is required" })
    }
    const mongoose = require('mongoose')
    const shopObjectId = mongoose.Types.ObjectId.isValid(shopId) ? new mongoose.Types.ObjectId(shopId) : shopId
    const shop = await Shop.findById(shopObjectId).select('revenue_visible_to_users').lean()
    res.json({
      revenueVisible: shop?.revenue_visible_to_users !== false // default true
    })
  } catch (error) {
    console.error("Revenue visibility check error:", error)
    res.status(500).json({ error: "Failed to check revenue visibility" })
  }
})

router.get("/mobile-summary", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId
    const shopId = req.user.shop_id

    if (!userId || !shopId) {
      return res.status(400).json({ error: "User ID and Shop ID are required" })
    }

    // Convert shopId to ObjectId if it's a string
    const mongoose = require('mongoose')
    const shopObjectId = mongoose.Types.ObjectId.isValid(shopId) ? new mongoose.Types.ObjectId(shopId) : shopId

    // Check if revenue is visible to users for this shop
    const shopDoc = await Shop.findById(shopObjectId).select('revenue_visible_to_users').lean()
    const revenueVisible = shopDoc?.revenue_visible_to_users !== false // default true

    // Get today's date range in IST
    const { startOfDay, endOfDay } = getISTTodayRange()

    try {
      // Fetch MySQL user data via auth server
      let userDashboardData = null
      try {
        const authResponse = await axios.post(
          `${process.env.AUTH_SERVER_URL}/get-user-dashboard-data`,
          {},
          {
            headers: {
              Authorization: req.headers.authorization,
            },
          },
        )
        userDashboardData = authResponse.data
      } catch (authError) {
        console.error("Auth server error:", authError.response?.data || authError.message)
      }

      // Get today's expenses
      const todayExpenses = await Expense.aggregate([
        {
          $match: {
            userId: shopObjectId,
            createdAt: { $gte: startOfDay, $lt: endOfDay },
          },
        },
        {
          $group: {
            _id: null,
            totalExpenses: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ])

      // Get today's mobile revenue - FIXED: Only count payments made TODAY
      // Modern approach: Use payments array with actual payment dates
      const todayMobileRevenue = await Mobile.aggregate([
        {
          $match: {
            shop_id: shopObjectId,
            payments: { $exists: true, $ne: [] }
          }
        },
        {
          $unwind: "$payments"
        },
        {
          $match: {
            "payments.date": { $gte: startOfDay, $lt: endOfDay }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$payments.amount" },
            count: { $sum: 1 }
          }
        }
      ])
      
      // Legacy approach: For mobiles without payments array (old data)
      const legacyMobileRevenue = await Mobile.aggregate([
        {
          $match: {
            shop_id: shopObjectId,
            created_at: { $gte: startOfDay, $lt: endOfDay },
            paid_amount: { $gt: 0 },
            $or: [
              { payments: { $exists: false } },
              { payments: { $size: 0 } }
            ]
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$paid_amount" },
            count: { $sum: 1 }
          }
        }
      ])

      // Get today's product sales revenue from ProductHistory
      const todayProductSales = await ProductHistory.aggregate([
        {
          $match: {
            changeType: "SELL",
            changeDate: { $gte: startOfDay, $lt: endOfDay },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$paidAmount" },
            totalQuantity: { $sum: "$quantity" },
            count: { $sum: 1 },
          },
        },
      ])

      // Calculate totals - combine modern and legacy mobile revenue
      const mobileRevenue = (todayMobileRevenue[0]?.totalRevenue || 0) + (legacyMobileRevenue[0]?.totalRevenue || 0)
      const productRevenue = todayProductSales[0]?.totalRevenue || 0
      const totalRevenue = mobileRevenue + productRevenue
      const totalExpenses = todayExpenses[0]?.totalExpenses || 0
      const netProfit = totalRevenue - totalExpenses

      // Calculate transaction count - combine modern and legacy counts
      const mobileTransactions = (todayMobileRevenue[0]?.count || 0) + (legacyMobileRevenue[0]?.count || 0)
      const productTransactions = todayProductSales[0]?.count || 0
      const totalTransactions = mobileTransactions + productTransactions

      // Fetch DailySummary
      const todaySummary = await DailySummary.findOne({
        userId: shopObjectId,
        date: {
          $gte: startOfDay,
          $lt: endOfDay,
        },
      })

      // Fetch mobile repairs data
      const totalMobiles = await Mobile.countDocuments({ shop_id: shopObjectId })
      const pendingRepairs = await Mobile.countDocuments({
        shop_id: shopObjectId,
        ready: false,
        delivered: false,
      })
      const readyForDelivery = await Mobile.countDocuments({
        shop_id: shopObjectId,
        ready: true,
        delivered: false,
      })
      const deliveredToday = await Mobile.countDocuments({
        shop_id: shopObjectId,
        delivered: true,
        delivery_date: { $gte: startOfDay, $lt: endOfDay },
      })

      // Fetch customer data
      const totalCustomers = await Customer.countDocuments({ shop_id: shopObjectId })
      const totalDealers = await Dealer.countDocuments({ shop_id: shopObjectId })
      const newCustomersToday = await Customer.countDocuments({
        shop_id: shopObjectId,
        created_at: { $gte: startOfDay, $lt: endOfDay },
      })
      const newDealersToday = await Dealer.countDocuments({
        shop_id: shopObjectId,
        created_at: { $gte: startOfDay, $lt: endOfDay },
      })

      // Fetch inventory data
      const products = await Product.find({ userId: shopObjectId })
      const totalProducts = products.length
      const lowStockItems = products.filter((product) => product.quantity < 10).length
      const totalInventoryValue = products.reduce((sum, product) => sum + (product.totalCost || 0), 0)

      const lowStockProducts = products
        .filter((product) => product.quantity < 10)
        .map((product) => ({
          name: product.name,
          category: product.category || "General",
          quantity: product.quantity,
          minStock: 10,
          costPrice: product.costPrice,
          sellingPrice: product.sellingPrice,
        }))
        .sort((a, b) => a.quantity - b.quantity)

      const activeTechnicians = await Technician.countDocuments({ shop_id: shopObjectId })
      const avgMobilesPerTechnician = activeTechnicians > 0 ? Math.round(totalMobiles / activeTechnicians) : 0

      // Get recent expenses (last 7 days)
      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
      const recentExpenses = await Expense.find({
        userId: shopObjectId,
        createdAt: { $gte: sevenDaysAgo },
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .select("title amount createdAt")

      const formattedRecentExpenses = recentExpenses.map((expense) => ({
        title: expense.title,
        amount: expense.amount,
        createdAt: expense.createdAt.toISOString(),
      }))

      // Final sales data
      const finalSalesData = {
        totalRevenue: todaySummary?.totalRevenue || totalRevenue,
        totalExpenses: todaySummary?.totalExpense || totalExpenses,
        netProfit: todaySummary?.netRevenue || netProfit,
        transactionCount: totalTransactions,
        mobileRevenue,
        productRevenue,
      }

      const dashboardData = {
        todaySales: revenueVisible ? finalSalesData : {
          totalRevenue: 0,
          totalExpenses: 0,
          netProfit: 0,
          transactionCount: 0,
          mobileRevenue: 0,
          productRevenue: 0,
        },
        revenueVisible, // flag for frontend to know if revenue is hidden
        mobileRepairs: {
          totalMobiles,
          pendingRepairs,
          readyForDelivery,
          deliveredToday,
        },
        customers: {
          newCustomersToday,
          totalCustomers,
          newDealersToday,
          totalDealers,
        },
        inventory: {
          totalProducts,
          lowStockItems,
          totalInventoryValue,
        },
        technicians: {
          activeTechnicians,
          avgMobilesPerTechnician,
        },
        recentExpenses: formattedRecentExpenses,
        lowStockProducts: lowStockProducts,
        userInfo: userDashboardData?.success ? userDashboardData.user : null,
        subscription: userDashboardData?.success ? userDashboardData.subscription : null,
      }

      return res.json(dashboardData)
    } catch (dbError) {
      console.error("Database query error:", dbError)
      return res.status(500).json({ error: "Database query failed", details: dbError.message })
    }
  } catch (error) {
    console.error("Dashboard API error:", error)
    return res.status(500).json({ error: "Failed to fetch dashboard data", details: error.message })
  }
})

module.exports = router
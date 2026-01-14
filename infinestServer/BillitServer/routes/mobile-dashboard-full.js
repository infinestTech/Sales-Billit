const express = require("express")
const router = express.Router()
const authenticateToken = require("../utils/authMiddleware")
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
  DailySummary 
} = require("../models/mongoModels")

// Enhanced Mobile Dashboard Summary Route with more detailed queries
router.get("/mobile-summary-detailed", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId
    const shopId = req.user.shop_id

    if (!userId || !shopId) {
      return res.status(400).json({ error: "User ID and Shop ID are required" })
    }

    // Get today's date range in IST
    const { startOfDay, endOfDay } = getISTTodayRange();

    // Parallel queries for better performance
    const [todaySummary, products, todayProductSales, todayExpenses] = await Promise.all([
      // Today's summary
      DailySummary.findOne({
        userId: shopId,
        date: {
          $gte: startOfDay,
          $lt: endOfDay,
        },
      }),

      // All products for inventory
      Product.find({ userId: shopId }),

      // Today's product sales
      ProductHistory.find({
        changeType: "SELL",
        changeDate: {
          $gte: startOfDay,
          $lt: endOfDay,
        },
      }),

      // Today's expenses
      Expense.find({
        userId: shopId,
        createdAt: {
          $gte: startOfDay,
          $lt: endOfDay,
        },
      }),
    ])

    // Calculate inventory metrics
    const totalProducts = products.length
    const lowStockItems = products.filter((product) => product.quantity < 10).length
    const totalInventoryValue = products.reduce((sum, product) => sum + (product.totalCost || 0), 0)

    // Calculate today's revenue from product sales
    const todayRevenue = todayProductSales.reduce((sum, sale) => {
      return sum + (sale.paidAmount || 0)
    }, 0)

    // Calculate today's expenses
    const todayExpenseAmount = todayExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0)

    // Calculate net profit
    const netProfit = todayRevenue - todayExpenseAmount

    // Fetch mobile repairs data
    const [totalMobiles, pendingRepairs, readyForDelivery, deliveredToday] = await Promise.all([
      Mobile.countDocuments({ shop_id: shopId }),
      Mobile.countDocuments({ shop_id: shopId, ready: false, delivered: false }),
      Mobile.countDocuments({ shop_id: shopId, ready: true, delivered: false }),
      Mobile.countDocuments({
        shop_id: shopId,
        delivered: true,
        delivery_date: { $gte: startOfDay, $lt: endOfDay }
      })
    ])

    // Fetch customer data
    const [totalCustomers, totalDealers, newCustomersToday, newDealersToday] = await Promise.all([
      Customer.countDocuments({ shop_id: shopId }),
      Dealer.countDocuments({ shop_id: shopId }),
      Customer.countDocuments({
        shop_id: shopId,
        created_at: { $gte: startOfDay, $lt: endOfDay }
      }),
      Dealer.countDocuments({
        shop_id: shopId,
        created_at: { $gte: startOfDay, $lt: endOfDay }
      })
    ])

    // Fetch technician data
    const activeTechnicians = await Technician.countDocuments({ shop_id: shopId })
    const avgMobilesPerTechnician = activeTechnicians > 0 ? Math.round(totalMobiles / activeTechnicians) : 0

    const dashboardData = {
      todaySales: {
        totalRevenue: todaySummary?.totalRevenue || todayRevenue,
        totalExpenses: todaySummary?.totalExpense || todayExpenseAmount,
        netProfit: todaySummary?.netRevenue || netProfit,
        transactionCount: todayProductSales.length,
      },
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
      todayDetails: {
        salesTransactions: todayProductSales.map((sale) => ({
          productName: sale.productName || "Unknown",
          quantity: sale.quantity,
          amount: sale.paidAmount || 0,
          time: sale.changeDate,
        })),
        expenses: todayExpenses.map((expense) => ({
          title: expense.title,
          amount: expense.amount,
          time: expense.createdAt,
        })),
      },
    }

    return res.json(dashboardData)
  } catch (error) {
    console.error("Dashboard API error:", error)
    return res.status(500).json({ error: "Failed to fetch dashboard data" })
  }
})

module.exports = router

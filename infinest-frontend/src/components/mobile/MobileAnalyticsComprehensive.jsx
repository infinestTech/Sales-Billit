"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Plus, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Receipt, 
  Package, 
  Smartphone, 
  Eye, 
  Filter,
  RefreshCw,
  PieChart,
  BarChart3,
  Target,
  Percent,
  Minus,
  X,
  Wallet
} from "lucide-react"
import { usePlanFeatures } from "@/context/PlanFeatureContext"
import { logAndNotify, logError, logSuccess } from "@/utils/logger"
import api from "../api"
import { getLocalDateString } from "@/lib/utils"

export default function MobileAnalytics({ shopId }) {
  const { features, loading } = usePlanFeatures()
  const [activeTab, setActiveTab] = useState("overview") // overview, records, stock
  const [dateFilters, setDateFilters] = useState({
    fromDate: getLocalDateString(),
    toDate: getLocalDateString(),
    specificDate: getLocalDateString()
  })
  const [filterType, setFilterType] = useState("today") // today, range, specific
  const [isLoading, setIsLoading] = useState(false)
  
  // Analytics Data
  const [overviewData, setOverviewData] = useState({
    totalRevenue: 0,
    serviceRevenue: 0,
    stockRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    netProfitPercentage: 0,
    outstandingBalance: 0,
    balanceRecords: 0
  })
  
  const [recordsAnalytics, setRecordsAnalytics] = useState({
    totalRecords: 0,
    readyNotDeliveredRecords: 0,
    notReadyRecords: 0,
    totalRevenue: 0,
    avgRevenuePerRecord: 0,
    topCustomers: []
  })
  
  const [stockAnalytics, setStockAnalytics] = useState({
    totalProducts: 0,
    totalValue: 0,
    lowStockItems: 0,
    recentSales: 0,
    topSellingProducts: []
  })

  useEffect(() => {
    if (shopId) {
      fetchAnalyticsData()
    }
  }, [shopId, dateFilters, filterType])

  const fetchAnalyticsData = async () => {
    setIsLoading(true)
    try {
      const token = localStorage.getItem("token")
      if (!token) {
        logError("No authentication token found")
        return
      }

      // Prepare date parameters based on filter type
      let dateParams = {}
      if (filterType === "today") {
        dateParams = { date: getLocalDateString() }
      } else if (filterType === "range") {
        dateParams = { 
          fromDate: dateFilters.fromDate, 
          toDate: dateFilters.toDate,
          date: dateFilters.fromDate // Add fallback date for APIs that require it
        }
      } else if (filterType === "specific") {
        dateParams = { date: dateFilters.specificDate }
      }

      // Ensure we always have a date parameter
      if (!dateParams.date) {
        dateParams.date = getLocalDateString()
      }
      
      // Get dashboard summary data
      const overviewRes = await api.post("/api/dashboard/summary", 
        { shop_id: shopId, ...dateParams }, 
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      // Get daily summary for revenue breakdown
      const dailySummaryRes = await api.post("/api/daily-summary", 
        { shop_id: shopId, date: getLocalDateString(), ...dateParams }, 
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      console.log("Daily summary response:", dailySummaryRes.data)
      
      // Get expense data with error handling
      let expensesRes
      try {
        expensesRes = await api.post("/api/expenses/today", 
          { shop_id: shopId, date: dateParams.date }, 
          { headers: { Authorization: `Bearer ${token}` } }
        )
        console.log("Expenses response:", expensesRes.data)
      } catch (expenseError) {
        console.warn("Failed to fetch expenses:", expenseError)
        expensesRes = { data: { totalExpenses: 0 } }
      }
      
      const dailyData = dailySummaryRes.data
      const expenseData = expensesRes.data
      const overviewResponseData = overviewRes.data
      
      console.log("Processing data:", { dailyData, expenseData, overviewResponseData })
      
      // Calculate revenue with proper null checks
      const totalRevenue = parseFloat(dailyData?.totalRevenue || 0)
      const serviceRevenue = parseFloat(dailyData?.serviceRevenue || 0) 
      const stockRevenue = parseFloat(dailyData?.stockRevenue || 0)
      const totalExpenses = parseFloat(expenseData?.totalAmount || 0)
      
      const netProfit = totalRevenue - totalExpenses
      const netProfitPercentage = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100) : 0
      
      console.log("Calculated values:", { totalRevenue, serviceRevenue, stockRevenue, totalExpenses, netProfit })
      
      setOverviewData({
        totalRevenue,
        serviceRevenue,
        stockRevenue,
        totalExpenses,
        netProfit,
        netProfitPercentage,
        outstandingBalance: 0, // Will be updated by balance fetch
        balanceRecords: 0 // Will be updated by balance fetch
      })
      
      // Set records analytics with proper data mapping
      const mobilesData = overviewResponseData?.mobiles || []
      const readyNotDeliveredRecords = mobilesData.filter(m => 
        m.status === 'ready' || m.status === 'completed' || m.ready === true
      ).length
      const notReadyRecords = mobilesData.filter(m => 
        m.status === 'pending' || m.status === 'in-progress' || m.status === 'received' || m.ready === false
      ).length
      const avgRevenuePerRecord = mobilesData.length > 0 ? (totalRevenue / mobilesData.length) : 0
      
      console.log("Mobile records analysis:", {
        totalMobiles: mobilesData.length,
        readyNotDelivered: readyNotDeliveredRecords,
        notReady: notReadyRecords,
        sampleStatuses: mobilesData.slice(0, 3).map(m => ({ status: m.status, ready: m.ready }))
      })
      
      setRecordsAnalytics({
        totalRecords: mobilesData.length,
        readyNotDeliveredRecords,
        notReadyRecords,
        totalRevenue: serviceRevenue, // Use service revenue for records
        avgRevenuePerRecord,
        topCustomers: [] // You can fetch specific customer data if needed
      })
      
      // Fetch stock analytics with proper error handling
      try {
        const stockRes = await api.post("/api/products/list", 
          { shop_id: shopId }, 
          { headers: { Authorization: `Bearer ${token}` } }
        )
        
        console.log("Stock response:", stockRes.data)
        
        // Try different possible response structures
        const products = stockRes.data?.products || 
                        stockRes.data?.data || 
                        stockRes.data || 
                        []
        
        console.log("Products array:", products, "Length:", products.length)
        
        if (!Array.isArray(products)) {
          console.warn("Products is not an array:", products)
          throw new Error("Invalid products data structure")
        }
        
        const totalInventoryValue = products.reduce((sum, p) => {
          console.log("Processing product:", p)
          
          // Try multiple possible field names for price
          const price = parseFloat(
            p.price || 
            p.selling_price || 
            p.unit_price || 
            p.cost_price ||
            p.product_price ||
            p.purchase_price ||
            p.rate ||
            0
          )
          // Try multiple possible field names for quantity
          const quantity = parseInt(
            p.quantity || 
            p.stock_quantity || 
            p.stock || 
            p.available_quantity ||
            p.inventory_quantity ||
            p.available_stock ||
            p.current_stock ||
            0
          )
          
          const value = price * quantity
          console.log(`Product: ${p.name || p.product_name || 'Unknown'}, Price: ${price}, Quantity: ${quantity}, Value: ${value}`)
          return sum + value
        }, 0)
        
        const lowStockProducts = products.filter(p => {
          const qty = parseInt(
            p.quantity || 
            p.stock_quantity || 
            p.stock || 
            p.available_quantity ||
            p.inventory_quantity ||
            0
          )
          return qty <= 10
        })
        
        console.log("Stock calculations:", {
          totalProducts: products.length,
          totalInventoryValue,
          lowStockCount: lowStockProducts.length,
          sampleProducts: products.slice(0, 3).map(p => ({
            name: p.name || p.product_name,
            price: p.price || p.selling_price,
            quantity: p.quantity || p.stock_quantity
          }))
        })
        
        setStockAnalytics({
          totalProducts: products.length,
          totalValue: totalInventoryValue,
          lowStockItems: lowStockProducts.length,
          recentSales: stockRevenue, // Use stock revenue from daily summary
          topSellingProducts: products.slice(0, 5) // You can implement proper sorting based on sales
        })
        
      } catch (stockError) {
        console.error("Stock fetch error:", stockError)
        logError("Failed to fetch stock data", stockError)
        // Set default values if stock fetch fails
        setStockAnalytics({
          totalProducts: 0,
          totalValue: 0,
          lowStockItems: 0,
          recentSales: stockRevenue || 0,
          topSellingProducts: []
        })
      }
      
      // Fetch balance analytics with better error handling
      try {
        const [customerBalanceRes, dealerBalanceRes] = await Promise.all([
          api.post("/api/customers/balance", 
            { shop_id: shopId }, 
            { headers: { Authorization: `Bearer ${token}` } }
          ).catch(err => ({ data: [] })), // Return empty array on error
          api.post("/api/dealers/balance", 
            { shop_id: shopId }, 
            { headers: { Authorization: `Bearer ${token}` } }
          ).catch(err => ({ data: [] })) // Return empty array on error
        ])
        
        const customerBalances = Array.isArray(customerBalanceRes.data) ? customerBalanceRes.data : []
        const dealerBalances = Array.isArray(dealerBalanceRes.data) ? dealerBalanceRes.data : []
        const allBalanceData = [...customerBalances, ...dealerBalances]
        
        const totalBalance = allBalanceData.reduce((sum, item) => {
          const balance = parseFloat(item.balanceAmount || item.balance || 0)
          return sum + balance
        }, 0)
        
        console.log("Balance data:", { 
          customerCount: customerBalances.length, 
          dealerCount: dealerBalances.length, 
          totalBalance 
        })
        
        // Update overview data with balance information
        setOverviewData(prev => ({
          ...prev,
          outstandingBalance: totalBalance,
          balanceRecords: allBalanceData.length
        }))
        
      } catch (balanceError) {
        console.error("Balance fetch error:", balanceError)
        logError("Failed to fetch balance data", balanceError)
        // Set default values if balance fetch fails
        setOverviewData(prev => ({
          ...prev,
          outstandingBalance: 0,
          balanceRecords: 0
        }))
      }
      
    } catch (error) {
      console.error("Analytics fetch error:", error)
      logError("Failed to fetch analytics data", error)
      
      // Set default values on error
      setOverviewData({
        totalRevenue: 0,
        serviceRevenue: 0,
        stockRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        netProfitPercentage: 0,
        outstandingBalance: 0,
        balanceRecords: 0
      })
      
      setRecordsAnalytics({
        totalRecords: 0,
        readyNotDeliveredRecords: 0,
        notReadyRecords: 0,
        totalRevenue: 0,
        avgRevenuePerRecord: 0,
        topCustomers: []
      })
      
      setStockAnalytics({
        totalProducts: 0,
        totalValue: 0,
        lowStockItems: 0,
        recentSales: 0,
        topSellingProducts: []
      })
      
    } finally {
      setIsLoading(false)
    }
  }

  const getDateParams = () => {
    switch (filterType) {
      case "today":
        return { date: getLocalDateString() }
      case "range":
        return { 
          fromDate: dateFilters.fromDate, 
          toDate: dateFilters.toDate 
        }
      case "specific":
        return { date: dateFilters.specificDate }
      default:
        return { date: getLocalDateString() }
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0)
  }

  const formatPercentage = (value) => {
    return `${(value || 0).toFixed(1)}%`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900">Analytics Dashboard</h1>
            <button
              onClick={fetchAnalyticsData}
              disabled={isLoading}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          
          {/* Date Filter Controls */}
          <div className="space-y-3">
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {[
                { value: "today", label: "Today" },
                { value: "range", label: "Date Range" },
                { value: "specific", label: "Specific Date" }
              ].map(filter => (
                <button
                  key={filter.value}
                  onClick={() => setFilterType(filter.value)}
                  className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-colors ${
                    filterType === filter.value
                      ? "bg-blue-100 text-blue-700 border border-blue-300"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Date Inputs */}
            {filterType === "range" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">From Date</label>
                  <input
                    type="date"
                    value={dateFilters.fromDate}
                    onChange={(e) => setDateFilters(prev => ({ ...prev, fromDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">To Date</label>
                  <input
                    type="date"
                    value={dateFilters.toDate}
                    onChange={(e) => setDateFilters(prev => ({ ...prev, toDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {filterType === "specific" && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Select Date</label>
                <input
                  type="date"
                  value={dateFilters.specificDate}
                  onChange={(e) => setDateFilters(prev => ({ ...prev, specificDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}
            
            {/* Filter Summary */}
            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded-md">
              📅 Showing data for: 
              {filterType === "today" && " Today"}
              {filterType === "specific" && ` ${new Date(dateFilters.specificDate).toLocaleDateString()}`}
              {filterType === "range" && ` ${new Date(dateFilters.fromDate).toLocaleDateString()} - ${new Date(dateFilters.toDate).toLocaleDateString()}`}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto">
          {[
            { id: "overview", label: "Overview", icon: BarChart3 },
            { id: "records", label: "Records", icon: Smartphone },
            { id: "stock", label: "Stock", icon: Package }
          ].map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 px-2 text-center font-medium transition-colors whitespace-nowrap min-w-0 ${
                  activeTab === tab.id
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon className="w-4 h-4 mx-auto mb-1" />
                <span className="text-xs">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            <div className="text-center">
              <p className="text-gray-600 font-medium">Loading analytics...</p>
              <p className="text-sm text-gray-500">Fetching data for {
                filterType === "today" ? "today" :
                filterType === "specific" ? new Date(dateFilters.specificDate).toLocaleDateString() :
                `${new Date(dateFilters.fromDate).toLocaleDateString()} - ${new Date(dateFilters.toDate).toLocaleDateString()}`
              }</p>
            </div>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-4">
                {/* Debug Info - Remove in production */}
                {process.env.NODE_ENV === 'development' && (
                  <Card className="bg-yellow-50 border-yellow-200">
                    <CardContent className="p-3">
                      <p className="text-xs text-yellow-800 font-mono">
                        Debug: Revenue={overviewData.totalRevenue}, 
                        Service={overviewData.serviceRevenue}, 
                        Stock={overviewData.stockRevenue}
                      </p>
                    </CardContent>
                  </Card>
                )}
                
                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-green-700 font-medium">Total Revenue</p>
                          <p className="text-xl font-bold text-green-800">
                            {formatCurrency(overviewData.totalRevenue || 0)}
                          </p>
                          {overviewData.totalRevenue === 0 && (
                            <p className="text-xs text-green-600 mt-1">No revenue data</p>
                          )}
                        </div>
                        <TrendingUp className="w-8 h-8 text-green-600" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-red-700 font-medium">Total Expenses</p>
                          <p className="text-xl font-bold text-red-800">
                            {formatCurrency(overviewData.totalExpenses || 0)}
                          </p>
                          {overviewData.totalExpenses === 0 && (
                            <p className="text-xs text-red-600 mt-1">No expense data</p>
                          )}
                        </div>
                        <TrendingDown className="w-8 h-8 text-red-600" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Net Profit */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900">Net Profit</h3>
                      <Target className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Amount:</span>
                        <span className={`font-bold text-lg ${
                          overviewData.netProfit >= 0 ? "text-green-600" : "text-red-600"
                        }`}>
                          {formatCurrency(overviewData.netProfit)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Margin:</span>
                        <span className={`font-bold ${
                          overviewData.netProfitPercentage >= 0 ? "text-green-600" : "text-red-600"
                        }`}>
                          {formatPercentage(overviewData.netProfitPercentage)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Revenue Breakdown */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Revenue Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Smartphone className="w-5 h-5 text-blue-600" />
                        <span className="text-gray-700">Service Revenue</span>
                      </div>
                      <span className="font-semibold text-blue-600">
                        {formatCurrency(overviewData.serviceRevenue)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Package className="w-5 h-5 text-green-600" />
                        <span className="text-gray-700">Stock Revenue</span>
                      </div>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(overviewData.stockRevenue)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Records Tab */}
            {activeTab === "records" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <p className="text-sm text-gray-600">Total Records</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {recordsAnalytics.totalRecords || 0}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <p className="text-sm text-gray-600">Revenue</p>
                        <p className="text-xl font-bold text-green-600">
                          {formatCurrency(recordsAnalytics.totalRevenue || 0)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Ready (Not Delivered):</span>
                        <Badge className="bg-yellow-100 text-yellow-800">
                          {recordsAnalytics.readyNotDeliveredRecords || 0}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Not Ready:</span>
                        <Badge className="bg-red-100 text-red-800">
                          {recordsAnalytics.notReadyRecords || 0}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Avg Revenue/Record:</span>
                        <span className="font-semibold">
                          {formatCurrency(recordsAnalytics.avgRevenuePerRecord || 0)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Date Range Info */}
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center text-sm text-gray-600">
                      <p>Showing data for: 
                        {filterType === "today" && " Today"}
                        {filterType === "specific" && ` ${new Date(dateFilters.specificDate).toLocaleDateString()}`}
                        {filterType === "range" && ` ${new Date(dateFilters.fromDate).toLocaleDateString()} - ${new Date(dateFilters.toDate).toLocaleDateString()}`}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Stock Tab */}
            {activeTab === "stock" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <p className="text-sm text-gray-600">Total Products</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {stockAnalytics.totalProducts || 0}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <p className="text-sm text-gray-600">Stock Value</p>
                        <p className="text-xl font-bold text-green-600">
                          {formatCurrency(stockAnalytics.totalValue || 0)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Low Stock Items:</span>
                        <Badge className="bg-red-100 text-red-800">
                          {stockAnalytics.lowStockItems || 0}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Recent Sales:</span>
                        <span className="font-semibold">
                          {formatCurrency(stockAnalytics.recentSales || 0)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Stock Details */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Stock Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Package className="w-5 h-5 text-blue-600" />
                        <span className="text-gray-700">Total Inventory</span>
                      </div>
                      <span className="font-semibold text-blue-600">
                        {stockAnalytics.totalProducts || 0} items
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <DollarSign className="w-5 h-5 text-green-600" />
                        <span className="text-gray-700">Total Value</span>
                      </div>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(stockAnalytics.totalValue || 0)}
                      </span>
                    </div>
                    {(stockAnalytics.lowStockItems || 0) > 0 && (
                      <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <Minus className="w-5 h-5 text-red-600" />
                          <span className="text-gray-700">Low Stock Alert</span>
                        </div>
                        <span className="font-semibold text-red-600">
                          {stockAnalytics.lowStockItems} items
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

          </>
        )}
      </div>
    </div>
  )
}

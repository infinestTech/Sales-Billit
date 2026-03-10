"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Smartphone, DollarSign, Users, Package, Clock, CheckCircle, LogOut, BarChart3 } from "lucide-react"
import Pagination from "@/components/tables/Pagination"

export default function MobileDashboard({ shopId }) {
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // Pagination state for stock alert
  const [stockAlertCurrentPage, setStockAlertCurrentPage] = useState(1)
  const stockAlertsPerPage = 4

  useEffect(() => {
    fetchDashboardData()
    // Refresh data every 5 minutes
    const interval = setInterval(fetchDashboardData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [shopId])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)
      const token = localStorage.getItem("token")

      if (!token) {
        throw new Error("No authentication token found")
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/dashboard/mobile-summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setDashboardData(data)
      // Reset stock alert pagination to first page when new data is loaded
      setStockAlertCurrentPage(1)
    } catch (error) {
      if (error.message === 'Session expired' || error.response?.data?.sessionExpired) return;
      console.error("Failed to fetch dashboard data:", error)
      setError(error.message)

      // Set empty data structure to prevent crashes
      setDashboardData({
        todaySales: { totalRevenue: 0, totalExpenses: 0, netProfit: 0, transactionCount: 0 },
        mobileRepairs: { totalMobiles: 0, pendingRepairs: 0, readyForDelivery: 0, deliveredToday: 0 },
        customers: { newCustomersToday: 0, totalCustomers: 0, newDealersToday: 0 },
        inventory: { totalProducts: 0, lowStockItems: 0, totalInventoryValue: 0 },
        recentExpenses: [],
        lowStockProducts: [],
      })
      console.warn("Using fallback data structure due to API error")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-red-600 mb-4">Error loading dashboard: {error}</p>
            <button
              onClick={fetchDashboardData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(amount || 0)
  }

  const handleLogout = () => {
    // Clear authentication token
    localStorage.removeItem("token")

    // Redirect to login page or home page
    window.location.href = "/billit-login" // Adjust the path as needed
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-500">Overview of your business</p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 pb-20">
        {/* Sales Overview - Hidden when shop admin disables revenue visibility */}
        {dashboardData?.revenueVisible !== false && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
              Today's Sales
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="text-xs text-green-600 font-medium">Revenue</p>
                <p className="text-lg font-bold text-green-700">
                  {formatCurrency(dashboardData?.todaySales?.totalRevenue)}
                </p>
              </div>
              <div className="bg-red-50 p-3 rounded-lg">
                <p className="text-xs text-red-600 font-medium">Expenses</p>
                <p className="text-lg font-bold text-red-700">
                  {formatCurrency(dashboardData?.todaySales?.totalExpenses)}
                </p>
              </div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-xs text-blue-600 font-medium">Net Profit</p>
              <p className="text-xl font-bold text-blue-700">{formatCurrency(dashboardData?.todaySales?.netProfit)}</p>
            </div>
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-sm text-gray-600">Transactions</span>
              <Badge variant="secondary">{dashboardData?.todaySales?.transactionCount || 0}</Badge>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Mobile Repairs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Smartphone className="h-5 w-5 text-blue-600" />
              Mobile Repairs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-orange-50 p-3 rounded-lg text-center">
                <Clock className="h-6 w-6 text-orange-600 mx-auto mb-1" />
                <p className="text-xs text-orange-600 font-medium">Pending</p>
                <p className="text-2xl font-bold text-orange-700">
                  {dashboardData?.mobileRepairs?.pendingRepairs || 0}
                </p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg text-center">
                <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" />
                <p className="text-xs text-green-600 font-medium">Ready</p>
                <p className="text-2xl font-bold text-green-700">
                  {dashboardData?.mobileRepairs?.readyForDelivery || 0}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Delivered Today</span>
                <Badge variant="outline" className="text-green-600 border-green-600">
                  {dashboardData?.mobileRepairs?.deliveredToday || 0}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Mobiles</span>
                <Badge variant="secondary">{dashboardData?.mobileRepairs?.totalMobiles || 0}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-purple-600" />
              Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-purple-50 p-3 rounded-lg text-center">
                <p className="text-xs text-purple-600 font-medium">New Today</p>
                <p className="text-2xl font-bold text-purple-700">{dashboardData?.customers?.newCustomersToday || 0}</p>
              </div>
              <div className="bg-indigo-50 p-3 rounded-lg text-center">
                <p className="text-xs text-indigo-600 font-medium">New Dealers</p>
                <p className="text-2xl font-bold text-indigo-700">{dashboardData?.customers?.newDealersToday || 0}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Customers</span>
                <Badge variant="secondary">{dashboardData?.customers?.totalCustomers || 0}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inventory */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-amber-600" />
              Inventory
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-amber-50 p-3 rounded-lg mb-3">
              <p className="text-xs text-amber-600 font-medium">Total Value</p>
              <p className="text-xl font-bold text-amber-700">
                {formatCurrency(dashboardData?.inventory?.totalInventoryValue)}
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Products</span>
                <Badge variant="secondary">{dashboardData?.inventory?.totalProducts || 0}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Low Stock Items</span>
                <Badge variant="destructive">{dashboardData?.inventory?.lowStockItems || 0}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Expenses */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="h-5 w-5 text-red-600" />
              Recent Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboardData?.recentExpenses?.length > 0 ? (
                dashboardData.recentExpenses.slice(0, 3).map((expense, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-red-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{expense.title}</p>
                      <p className="text-xs text-gray-500">{new Date(expense.createdAt).toLocaleDateString("en-IN")}</p>
                    </div>
                    <p className="text-sm font-bold text-red-600">-{formatCurrency(expense.amount)}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500">No recent expenses</p>
                </div>
              )}
              <div className="pt-2 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Today's Total</span>
                  <Badge variant="destructive">{formatCurrency(dashboardData?.todaySales?.totalExpenses)}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-orange-600" />
              Stock Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboardData?.lowStockProducts?.length > 0 ? (
                <>
                  {dashboardData.lowStockProducts
                    .slice(
                      (stockAlertCurrentPage - 1) * stockAlertsPerPage,
                      stockAlertCurrentPage * stockAlertsPerPage
                    )
                    .map((product, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-orange-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{product.name}</p>
                          <p className="text-xs text-gray-500">{product.category}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-orange-600">{product.quantity} left</p>
                          <p className="text-xs text-gray-500">Min: {product.minStock}</p>
                        </div>
                      </div>
                    ))}
                  
                  {/* Pagination for Stock Alert */}
                  {dashboardData.lowStockProducts.length > stockAlertsPerPage && (
                    <div className="mt-4">
                      <Pagination
                        invoicesPerPage={stockAlertsPerPage}
                        totalInvoices={dashboardData.lowStockProducts.length}
                        paginate={setStockAlertCurrentPage}
                        currentPage={stockAlertCurrentPage}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500">All products in stock</p>
                </div>
              )}
              <div className="pt-2 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Items Need Restock</span>
                  <Badge variant="outline" className="text-orange-600 border-orange-600">
                    {dashboardData?.inventory?.lowStockItems || 0}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

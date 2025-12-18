"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Package,
  Smartphone,
  Calendar,
  Eye,
  RefreshCw
} from "lucide-react"

export default function MobileAnalytics({ shopId }) {
  const [analyticsData, setAnalyticsData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [timeRange, setTimeRange] = useState("week") // week, month, year

  useEffect(() => {
    if (shopId) fetchAnalytics()
  }, [shopId, timeRange])

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem("token")
      if (!token) return

      // This is a mock implementation - replace with actual API calls
      const mockData = {
        totalRevenue: 15420,
        revenueChange: 12.5,
        totalRecords: 245,
        recordsChange: 8.2,
        totalProducts: 67,
        productsChange: -2.1,
        totalCustomers: 156,
        customersChange: 15.3,
        recentActivity: [
          { date: "2024-01-15", records: 8, revenue: 2400 },
          { date: "2024-01-14", records: 12, revenue: 3200 },
          { date: "2024-01-13", records: 6, revenue: 1800 },
          { date: "2024-01-12", records: 15, revenue: 4100 },
          { date: "2024-01-11", records: 9, revenue: 2700 }
        ]
      }

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      setAnalyticsData(mockData)
    } catch (error) {
      if (error.message === 'Session expired' || error.response?.data?.sessionExpired) return;
      console.error("Error fetching analytics:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const StatCard = ({ title, value, change, icon: Icon, color = "blue" }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {change !== undefined && (
              <div className={`flex items-center space-x-1 text-sm ${
                change >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {change >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                <span>{Math.abs(change)}%</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-lg bg-${color}-100`}>
            <Icon className={`w-6 h-6 text-${color}-600`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
              <p className="text-sm text-gray-500">Business insights and metrics</p>
            </div>
            <button
              onClick={fetchAnalytics}
              disabled={isLoading}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Time Range Selector */}
          <div className="flex space-x-2">
            {[
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
              { value: "year", label: "Year" }
            ].map(range => (
              <button
                key={range.value}
                onClick={() => setTimeRange(range.value)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  timeRange === range.value
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {isLoading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-gray-400" />
            <p className="text-gray-500">Loading analytics...</p>
          </div>
        ) : analyticsData ? (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <StatCard
                title="Total Revenue"
                value={`₹${analyticsData.totalRevenue.toLocaleString()}`}
                change={analyticsData.revenueChange}
                icon={DollarSign}
                color="green"
              />
              <StatCard
                title="Total Records"
                value={analyticsData.totalRecords}
                change={analyticsData.recordsChange}
                icon={Smartphone}
                color="blue"
              />
              <StatCard
                title="Products"
                value={analyticsData.totalProducts}
                change={analyticsData.productsChange}
                icon={Package}
                color="purple"
              />
              <StatCard
                title="Customers"
                value={analyticsData.totalCustomers}
                change={analyticsData.customersChange}
                icon={Users}
                color="indigo"
              />
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5" />
                  <span>Recent Activity</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analyticsData.recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Calendar className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {new Date(activity.date).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-gray-600">
                            {activity.records} records
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">
                          ₹{activity.revenue.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Performance Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Performance Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-medium text-gray-900">Revenue Growth</p>
                        <p className="text-sm text-gray-600">Up {analyticsData.revenueChange}% this {timeRange}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Users className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="font-medium text-gray-900">Customer Growth</p>
                        <p className="text-sm text-gray-600">Up {analyticsData.customersChange}% this {timeRange}</p>
                      </div>
                    </div>
                  </div>

                  {analyticsData.productsChange < 0 && (
                    <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <TrendingDown className="w-5 h-5 text-yellow-600" />
                        <div>
                          <p className="font-medium text-gray-900">Stock Alert</p>
                          <p className="text-sm text-gray-600">Product count decreased this {timeRange}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Analytics Data</h3>
            <p className="text-gray-600 mb-4">
              Start creating records and managing stock to see your analytics.
            </p>
            <button
              onClick={fetchAnalytics}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh Data
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

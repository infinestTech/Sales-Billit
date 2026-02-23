"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Plus, 
  Minus, 
  Package, 
  Search, 
  Filter,
  Edit3,
  Trash2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ShoppingCart,
  Eye,
  DollarSign
} from "lucide-react"
import api from "../api"
import { getLocalDateString } from "@/lib/utils"

export default function MobileStockManager({ shopId }) {
  const [activeTab, setActiveTab] = useState("inventory") // inventory, add, history, analytics
  const [products, setProducts] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState("all") // all, low-stock, out-of-stock
  const [isLoading, setIsLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showSellForm, setShowSellForm] = useState(null)
  const [stockAnalytics, setStockAnalytics] = useState({
    totalProducts: 0,
    totalInventoryValue: 0,
    totalRevenue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    topSellingProducts: []
  })
  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "",
    quantity: "",
    price: "",
    costPrice: ""
  })
  const [sellData, setSellData] = useState({
    quantity: "",
    sellPrice: ""
  })

  useEffect(() => {
    if (shopId) {
      fetchProducts()
      if (activeTab === "analytics") {
        fetchStockAnalytics()
      }
    }
  }, [shopId, activeTab])

  const fetchProducts = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem("token")
      const response = await api.post(
        "/api/products/list",
        { shop_id: shopId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )
      setProducts(response.data.products || [])
    } catch (error) {
      console.error("Error fetching products:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchStockAnalytics = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await api.post(
        "/api/products/list",
        { shop_id: shopId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )
      
      const products = response.data.products || []
      
      // Calculate analytics from products
      const totalProducts = products.length
      const totalInventoryValue = products.reduce((sum, product) => {
        const price = product.sellingPrice || product.price || 0
        return sum + (product.quantity * price)
      }, 0)
      
      // For revenue calculation, use the daily summary API that has actual sales data
      let totalRevenue = 0
      try {
        const today = getLocalDateString()
        const revenueResponse = await api.post(
          "/api/daily-summary",
          { shop_id: shopId, date: today },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )
        totalRevenue = revenueResponse.data.stockRevenue || 0
      } catch (revenueError) {
        totalRevenue = 0
      }
      
      const lowStockProducts = products.filter(product => product.quantity <= 10)
      const outOfStockProducts = products.filter(product => product.quantity === 0)
      
      // Get top selling products (based on quantity sold or current popularity)
      const topSellingProducts = products
        .filter(p => p.quantity > 0) // Only include available products
        .sort((a, b) => {
          // Sort by price * quantity as a proxy for popularity
          const aValue = (a.sellingPrice || a.price || 0) * a.quantity
          const bValue = (b.sellingPrice || b.price || 0) * b.quantity
          return bValue - aValue
        })
        .slice(0, 5)
      
      setStockAnalytics({
        totalProducts,
        totalInventoryValue,
        totalRevenue,
        lowStockCount: lowStockProducts.length,
        outOfStockCount: outOfStockProducts.length,
        topSellingProducts: topSellingProducts.map(p => ({
          _id: p._id,
          name: p.name,
          category: p.category || "General",
          quantity: p.quantity,
          soldQuantity: 0, // Will be updated when sales API is available
          totalRevenue: 0 // Will be updated when sales API is available
        }))
      })
      
    } catch (error) {
      console.error("Error fetching stock analytics:", error)
    }
  }

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.quantity || !newProduct.price) {
      alert("Please fill all required fields")
      return
    }

    try {
      setIsLoading(true)
      const token = localStorage.getItem("token")
      const response = await api.post(
        "/api/products/add",
        {
          name: newProduct.name,
          category: newProduct.category || "",
          costPrice: parseFloat(newProduct.costPrice) || undefined,
          sellingPrice: parseFloat(newProduct.price),
          quantity: parseInt(newProduct.quantity),
          shop_id: shopId
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (response.data) {
        setNewProduct({
          name: "",
          quantity: "",
          price: "",
          costPrice: "",
          category: ""
        })
        setShowAddForm(false)
        fetchProducts()
        alert("Product added successfully!")
      }
    } catch (error) {
      console.error("Error adding product:", error)
      alert("Failed to add product")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSellProduct = async (productId) => {
    if (!sellData.quantity || !sellData.sellPrice) {
      alert("Please fill all fields")
      return
    }

    try {
      setIsLoading(true)
      const token = localStorage.getItem("token")
      const response = await api.post(
        "/api/products/sell",
        {
          shop_id: shopId,
          productId: productId,
          quantitySold: parseInt(sellData.quantity),
          paidAmount: parseFloat(sellData.sellPrice)
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (response.data) {
        setSellData({ quantity: "", sellPrice: "" })
        setShowSellForm(null)
        fetchProducts()
        alert("Sale recorded successfully!")
      }
    } catch (error) {
      console.error("Error selling product:", error)
      alert("Failed to record sale")
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddStock = async (productId, additionalQuantity) => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem("token")
      const response = await api.post(
        "/api/products/add-stock",
        {
          shop_id: shopId,
          product_id: productId,
          quantity: parseInt(additionalQuantity)
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (response.data.success) {
        fetchProducts()
        alert("Stock updated successfully!")
      }
    } catch (error) {
      console.error("Error updating stock:", error)
      alert("Failed to update stock")
    } finally {
      setIsLoading(false)
    }
  }

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase())
    
    let matchesFilter = true
    if (filterType === "low-stock") {
      matchesFilter = product.quantity <= 10
    } else if (filterType === "out-of-stock") {
      matchesFilter = product.quantity === 0
    }
    
    return matchesSearch && matchesFilter
  })

  const lowStockCount = products.filter(product => product.quantity <= 10).length
  const outOfStockCount = products.filter(product => product.quantity === 0).length
  const totalValue = products.reduce((sum, product) => sum + (product.quantity * (product.sellingPrice || product.price || 0)), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex overflow-x-auto">
          <button
            onClick={() => setActiveTab("inventory")}
            className={`flex-1 py-4 px-2 text-center font-medium transition-colors whitespace-nowrap min-w-0 ${
              activeTab === "inventory"
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Package className="w-4 h-4 mx-auto mb-1" />
            <span className="text-xs">Inventory</span>
          </button>
          <button
            onClick={() => setActiveTab("add")}
            className={`flex-1 py-4 px-2 text-center font-medium transition-colors whitespace-nowrap min-w-0 ${
              activeTab === "add"
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Plus className="w-4 h-4 mx-auto mb-1" />
            <span className="text-xs">Add Product</span>
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`flex-1 py-4 px-2 text-center font-medium transition-colors whitespace-nowrap min-w-0 ${
              activeTab === "analytics"
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <TrendingUp className="w-4 h-4 mx-auto mb-1" />
            <span className="text-xs">Analytics</span>
          </button>
        </div>
      </div>

      {/* Inventory Tab */}
      {activeTab === "inventory" && (
        <div className="p-4 space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Package className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Products</p>
                    <p className="text-xl font-bold">{products.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Low Stock</p>
                    <p className="text-xl font-bold text-red-600">{lowStockCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filter */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="flex space-x-2 overflow-x-auto pb-2">
                  {[
                    { value: "all", label: "All" },
                    { value: "low-stock", label: "Low Stock" },
                    { value: "out-of-stock", label: "Out of Stock" }
                  ].map(filter => (
                    <button
                      key={filter.value}
                      onClick={() => setFilterType(filter.value)}
                      className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                        filterType === filter.value
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Products List */}
          {isLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-gray-400" />
              <p className="text-gray-500">Loading products...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-lg">No products found</p>
              <p className="text-gray-400 text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProducts.map((product) => (
                <Card key={product._id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{product.name}</h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge 
                            variant={product.quantity > 10 ? "default" : product.quantity === 0 ? "destructive" : "secondary"}
                            className={
                              product.quantity > 10 
                                ? "bg-green-100 text-green-800" 
                                : product.quantity === 0 
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                            }
                          >
                            {product.quantity} in stock
                          </Badge>
                          {product.quantity <= 10 && product.quantity > 0 && (
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">₹{product.sellingPrice || product.price || 0}</p>
                        {product.costPrice && (
                          <p className="text-sm text-gray-500">Cost: ₹{product.costPrice}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setShowSellForm(showSellForm === product._id ? null : product._id)}
                        className="flex-1 bg-green-100 text-green-700 py-2 px-3 rounded-lg font-medium hover:bg-green-200 transition-colors flex items-center justify-center space-x-1"
                        disabled={product.quantity === 0}
                      >
                        <ShoppingCart className="w-4 h-4" />
                        <span>Sell</span>
                      </button>
                    </div>

                    {/* Sell Form */}
                    {showSellForm === product._id && (
                      <div className="mt-4 p-4 bg-green-50 rounded-lg space-y-3">
                        <h4 className="font-medium text-gray-900">Sell {product.name}</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            placeholder="Quantity"
                            max={product.quantity}
                            value={sellData.quantity}
                            onChange={(e) => setSellData(prev => ({ ...prev, quantity: e.target.value }))}
                            className="p-2 border border-gray-300 rounded"
                          />
                          <input
                            type="number"
                            placeholder="Sell Price"
                            value={sellData.sellPrice}
                            onChange={(e) => setSellData(prev => ({ ...prev, sellPrice: e.target.value }))}
                            className="p-2 border border-gray-300 rounded"
                          />
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleSellProduct(product._id)}
                            className="flex-1 bg-green-600 text-white py-2 px-4 rounded font-medium"
                            disabled={isLoading}
                          >
                            Confirm Sale
                          </button>
                          <button
                            onClick={() => setShowSellForm(null)}
                            className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Product Tab */}
      {activeTab === "add" && (
        <div className="p-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Add New Product</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter product name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <input
                  type="text"
                  value={newProduct.category}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter category (optional)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Initial Quantity *
                  </label>
                  <input
                    type="number"
                    value={newProduct.quantity}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, quantity: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selling Price *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, price: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cost Price
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newProduct.costPrice}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, costPrice: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
            </CardContent>
          </Card>

          <div className="sticky bottom-0 bg-white p-4 border-t border-gray-200">
            <button
              onClick={handleAddProduct}
              disabled={isLoading || !newProduct.name || !newProduct.quantity || !newProduct.price}
              className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
              <span>{isLoading ? "Adding..." : "Add Product"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === "analytics" && (
        <div className="p-4 space-y-4">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="p-3 bg-blue-100 rounded-lg mx-auto mb-2 w-fit">
                    <Package className="w-6 h-6 text-blue-600" />
                  </div>
                  <p className="text-sm text-gray-600">Total Products</p>
                  <p className="text-2xl font-bold text-blue-600">{stockAnalytics.totalProducts || 0}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="p-3 bg-green-100 rounded-lg mx-auto mb-2 w-fit">
                    <DollarSign className="w-6 h-6 text-green-600" />
                  </div>
                  <p className="text-sm text-gray-600">Inventory Value</p>
                  <p className="text-2xl font-bold text-green-600">₹{(stockAnalytics.totalInventoryValue || 0).toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Revenue & Low Stock */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="p-3 bg-purple-100 rounded-lg mx-auto mb-2 w-fit">
                    <TrendingUp className="w-6 h-6 text-purple-600" />
                  </div>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-xl font-bold text-purple-600">₹{(stockAnalytics.totalRevenue || 0).toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="p-3 bg-red-100 rounded-lg mx-auto mb-2 w-fit">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                  <p className="text-sm text-gray-600">Low Stock Items</p>
                  <p className="text-2xl font-bold text-red-600">{stockAnalytics.lowStockCount || 0}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Products by Value */}
          {stockAnalytics.topSellingProducts && stockAnalytics.topSellingProducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <span>Top Products by Value</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stockAnalytics.topSellingProducts.slice(0, 5).map((product, index) => (
                    <div key={product._id || `${product.name}-${index}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{product.name}</p>
                          <p className="text-sm text-gray-600">{product.category}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">₹{((products.find(p => p._id === product._id)?.sellingPrice || products.find(p => p._id === product._id)?.price || 0)).toFixed(2)}</p>
                        <p className="text-xs text-gray-500">{product.quantity} in stock</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Current Inventory Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Inventory Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between p-3 bg-green-50 rounded-lg">
                  <span className="text-gray-700">In Stock Products:</span>
                  <span className="font-semibold text-green-600">
                    {products.filter(p => p.quantity > 10).length}
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-yellow-50 rounded-lg">
                  <span className="text-gray-700">Low Stock Products:</span>
                  <span className="font-semibold text-yellow-600">
                    {products.filter(p => p.quantity > 0 && p.quantity <= 10).length}
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-red-50 rounded-lg">
                  <span className="text-gray-700">Out of Stock:</span>
                  <span className="font-semibold text-red-600">
                    {products.filter(p => p.quantity === 0).length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Low Stock Alert */}
          {products.filter(p => p.quantity > 0 && p.quantity <= 10).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <span>Low Stock Alert</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {products
                    .filter(product => product.quantity > 0 && product.quantity <= 10)
                    .map(product => (
                      <div key={product._id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{product.name}</p>
                          <p className="text-sm text-gray-600">{product.category}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                            {product.quantity} left
                          </Badge>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Old Analytics Tab Content - Remove this section */}
      {false && activeTab === "analytics" && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <DollarSign className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Inventory Value</p>
                    <p className="text-2xl font-bold text-green-600">₹{(stockAnalytics.totalInventoryValue || 0).toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Package className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Products</p>
                    <p className="text-2xl font-bold">{products.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-yellow-100 rounded-lg">
                    <AlertTriangle className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Low Stock Items</p>
                    <p className="text-2xl font-bold text-yellow-600">{lowStockCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-red-100 rounded-lg">
                    <TrendingDown className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Out of Stock</p>
                    <p className="text-2xl font-bold text-red-600">{outOfStockCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Low Stock Products */}
          {lowStockCount > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <span>Low Stock Alert</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {products
                    .filter(product => product.quantity <= 10)
                    .map(product => (
                      <div key={product._id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-gray-600">{product.quantity} remaining</p>
                        </div>
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                          Low Stock
                        </Badge>
                      </div>
                    ))
                  }
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

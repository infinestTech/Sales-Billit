"use client"

import { useEffect, useState } from "react"
import api from "../../components/api"
import { X, History, Filter, Calendar, Package, Search, RefreshCw, Download, Eye, TrendingUp, TrendingDown } from "lucide-react"

const ProductHistoryModal = ({ onClose, products, shop_id }) => {
  const [selectedProductId, setSelectedProductId] = useState("all")
  const [history, setHistory] = useState([])
  const [filteredHistory, setFilteredHistory] = useState([])
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [changeType, setChangeType] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState("all") // all, add, sell

  const fetchAllHistory = async (filters = {}) => {
    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      const promises = products.map(product => 
        api.post(
          `/api/products/history/${product._id}`,
          {
            shop_id,
            ...filters,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        )
      )
      
      const responses = await Promise.all(promises)
      const allHistory = []
      
      responses.forEach((response, index) => {
        const productHistory = response.data.history || []
        productHistory.forEach(entry => {
          allHistory.push({
            ...entry,
            productName: products[index].name,
            productId: products[index]._id
          })
        })
      })
      
      // Sort by date (newest first)
      allHistory.sort((a, b) => new Date(b.changeDate) - new Date(a.changeDate))
      setHistory(allHistory)
    } catch (error) {
      console.error("Error fetching all history:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSingleProductHistory = async (productId, filters = {}) => {
    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      const response = await api.post(
        `/api/products/history/${productId}`,
        {
          shop_id,
          ...filters,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )
      const productHistory = response.data.history || []
      const product = products.find(p => p._id === productId)
      
      const enrichedHistory = productHistory.map(entry => ({
        ...entry,
        productName: product?.name || "Unknown Product",
        productId: productId
      }))
      
      setHistory(enrichedHistory)
    } catch (error) {
      console.error("Error fetching history:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (products.length > 0) {
      if (selectedProductId === "all") {
        fetchAllHistory({ fromDate, toDate, changeType })
      } else {
        fetchSingleProductHistory(selectedProductId, { fromDate, toDate, changeType })
      }
    }
  }, [products, selectedProductId])

  useEffect(() => {
    let filtered = [...history]

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(entry => 
        entry.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.notes?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Filter by view mode
    if (viewMode !== "all") {
      filtered = filtered.filter(entry => entry.changeType === viewMode.toUpperCase())
    }

    setFilteredHistory(filtered)
    setCurrentPage(1) // Reset to first page when filters change
  }, [history, searchQuery, viewMode])

  const handleProductChange = (e) => {
    const productId = e.target.value
    setSelectedProductId(productId)
  }

  const handleApplyFilters = () => {
    const filters = { fromDate, toDate, changeType }
    if (selectedProductId === "all") {
      fetchAllHistory(filters)
    } else {
      fetchSingleProductHistory(selectedProductId, filters)
    }
  }

  const handleReset = () => {
    setFromDate("")
    setToDate("")
    setChangeType("")
    setSearchQuery("")
    setViewMode("all")
    setCurrentPage(1)
    if (selectedProductId === "all") {
      fetchAllHistory()
    } else {
      fetchSingleProductHistory(selectedProductId)
    }
  }

  // Pagination
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentItems = filteredHistory.slice(startIndex, endIndex)

  // Statistics
  const totalAdd = filteredHistory.filter(entry => entry.changeType === "ADD").length
  const totalSell = filteredHistory.filter(entry => entry.changeType === "SELL").length
  const totalAddQuantity = filteredHistory.filter(entry => entry.changeType === "ADD").reduce((sum, entry) => sum + entry.quantity, 0)
  const totalSellQuantity = filteredHistory.filter(entry => entry.changeType === "SELL").reduce((sum, entry) => sum + entry.quantity, 0)

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-start pt-4 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden border border-gray-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <History className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Product History</h3>
              <p className="text-indigo-100 text-sm">Track all stock movements and transactions</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <X className="h-6 w-6 text-white" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(95vh-80px)]">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-600 text-sm font-medium">Total Records</p>
                  <p className="text-2xl font-bold text-blue-800">{filteredHistory.length}</p>
                </div>
                <Eye className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-600 text-sm font-medium">Stock Added</p>
                  <p className="text-2xl font-bold text-green-800">{totalAdd} ({totalAddQuantity} qty)</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-xl p-4 border border-red-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-600 text-sm font-medium">Stock Sold</p>
                  <p className="text-2xl font-bold text-red-800">{totalSell} ({totalSellQuantity} qty)</p>
                </div>
                <TrendingDown className="h-8 w-8 text-red-600" />
              </div>
            </div>
            <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-600 text-sm font-medium">Net Movement</p>
                  <p className="text-2xl font-bold text-purple-800">{totalAddQuantity - totalSellQuantity}</p>
                </div>
                <Package className="h-8 w-8 text-purple-600" />
              </div>
            </div>
          </div>

          {/* View Mode Tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setViewMode("all")}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                viewMode === "all"
                  ? "bg-blue-600 text-white shadow-lg"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All History ({filteredHistory.length})
            </button>
            <button
              onClick={() => setViewMode("add")}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                viewMode === "add"
                  ? "bg-green-600 text-white shadow-lg"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Stock Added ({totalAdd})
            </button>
            <button
              onClick={() => setViewMode("sell")}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                viewMode === "sell"
                  ? "bg-red-600 text-white shadow-lg"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Stock Sold ({totalSell})
            </button>
          </div>

          {/* Filters */}
          <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-6 mb-6 border border-gray-200">
            <div className="flex items-center mb-4">
              <Filter className="h-5 w-5 text-blue-600 mr-2" />
              <h4 className="text-lg font-semibold text-gray-800">Filters & Search</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center">
                  <Package className="h-4 w-4 mr-2 text-blue-600" />
                  Select Product
                </label>
                <select
                  value={selectedProductId}
                  onChange={handleProductChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                >
                  <option value="all">All Products</option>
                  {products.map((product) => (
                    <option key={product._id} value={product._id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-green-600" />
                  From Date
                </label>
                <input
                  type="date"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-white"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-orange-600" />
                  To Date
                </label>
                <input
                  type="date"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 bg-white"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Change Type</label>
                <select
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 bg-white"
                  value={changeType}
                  onChange={(e) => setChangeType(e.target.value)}
                >
                  <option value="">All Types</option>
                  <option value="ADD">ADD</option>
                  <option value="SELL">SELL</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center">
                  <Search className="h-4 w-4 mr-2 text-indigo-600" />
                  Search
                </label>
                <input
                  type="text"
                  placeholder="Product name, notes..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-white"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-between mt-4">
              <button
                className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center space-x-2"
                onClick={handleReset}
              >
                <RefreshCw className="h-4 w-4" />
                <span>Reset</span>
              </button>
              <button
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center space-x-2"
                onClick={handleApplyFilters}
                disabled={loading}
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Filter className="h-4 w-4" />
                )}
                <span>{loading ? "Loading..." : "Apply Filters"}</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-lg">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mr-3" />
                <span className="text-lg text-gray-600">Loading history...</span>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-gray-100 to-gray-200">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                          Date & Time
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                          Product
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                          Type
                        </th>
                        <th className="px-6 py-4 text-center text-sm font-bold text-gray-700 border-b border-gray-300">
                          Quantity
                        </th>
                        <th className="px-6 py-4 text-right text-sm font-bold text-gray-700 border-b border-gray-300">
                          Cost Price
                        </th>
                        <th className="px-6 py-4 text-right text-sm font-bold text-gray-700 border-b border-gray-300">
                          Paid Amount
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                          Notes
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentItems.map((entry, index) => (
                        <tr
                          key={entry._id}
                          className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
                        >
                          <td className="px-6 py-4 text-sm text-gray-700 border-b border-gray-200">
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {new Date(entry.changeDate).toLocaleDateString("en-IN")}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(entry.changeDate).toLocaleTimeString("en-IN", {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm border-b border-gray-200">
                            <div className="flex items-center">
                              <Package className="h-4 w-4 text-gray-400 mr-2" />
                              <span className="font-medium text-gray-900">{entry.productName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm border-b border-gray-200">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center w-fit ${
                                entry.changeType === "ADD" 
                                  ? "bg-green-100 text-green-800" 
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {entry.changeType === "ADD" ? (
                                <TrendingUp className="h-3 w-3 mr-1" />
                              ) : (
                                <TrendingDown className="h-3 w-3 mr-1" />
                              )}
                              {entry.changeType}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-center border-b border-gray-200">
                            <span className={`font-bold text-lg ${
                              entry.changeType === "ADD" ? "text-green-600" : "text-red-600"
                            }`}>
                              {entry.changeType === "ADD" ? "+" : "-"}{entry.quantity}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-gray-700 border-b border-gray-200 font-medium">
                            ₹{entry.costPrice?.toLocaleString('en-IN') || '0'}
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-gray-700 border-b border-gray-200 font-medium">
                            {entry.paidAmount != null ? `₹${entry.paidAmount.toLocaleString('en-IN')}` : "-"}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700 border-b border-gray-200">
                            <div className="max-w-xs truncate" title={entry.notes}>
                              {entry.notes || "-"}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                    <div className="flex items-center text-sm text-gray-700">
                      Showing {startIndex + 1} to {Math.min(endIndex, filteredHistory.length)} of {filteredHistory.length} entries
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Previous
                      </button>
                      
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                currentPage === pageNum
                                  ? "bg-blue-600 text-white"
                                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>
                      
                      <button
                        onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {!loading && filteredHistory.length === 0 && (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                  <History className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-500 text-lg font-medium mb-2">No history found</p>
                <p className="text-gray-400 text-sm">
                  {searchQuery || fromDate || toDate || changeType
                    ? "Try adjusting your filters to see more results"
                    : selectedProductId === "all"
                    ? "No product history available for any products"
                    : "No history available for this product"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductHistoryModal

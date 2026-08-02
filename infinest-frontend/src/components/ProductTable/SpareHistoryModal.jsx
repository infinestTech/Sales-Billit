"use client"

import { useState, useEffect, useCallback } from "react"
import api from "../../components/api"
import { History, X, TrendingUp, RotateCcw, Wrench, Filter } from "lucide-react"

const SpareHistoryModal = ({ onClose, shop_id }) => {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      const res = await api.post(
        "/api/products/spare-history",
        {
          shop_id,
          ...(fromDate && { fromDate }),
          ...(toDate && { toDate }),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setHistory(res.data.history || [])
    } catch (err) {
      console.error("Failed to fetch spare history", err)
    } finally {
      setLoading(false)
    }
  }, [shop_id, fromDate, toDate])

  useEffect(() => {
    fetchHistory()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const purchases = history.filter(
    (h) => h.changeType === "ADD" || h.changeType === "RESTOCK"
  )
  const returns = history.filter((h) => h.changeType === "RETURN_TO_SUPPLIER")
  const usages = history.filter((h) => h.changeType === "USE_SPARE")

  const totalPurchaseAmount = purchases.reduce((sum, h) => sum + (h.amount || 0), 0)
  const totalReturnAmount = returns.reduce((sum, h) => sum + (h.amount || 0), 0)
  const totalUsedQty = usages.reduce((sum, h) => sum + (h.quantity || 0), 0)

  const getTypeBadge = (changeType) => {
    switch (changeType) {
      case "ADD":
      case "RESTOCK":
        return {
          label: "Purchased",
          bg: "bg-green-100",
          text: "text-green-800",
          Icon: TrendingUp,
        }
      case "RETURN_TO_SUPPLIER":
        return {
          label: "Returned",
          bg: "bg-amber-100",
          text: "text-amber-800",
          Icon: RotateCcw,
        }
      case "USE_SPARE":
        return {
          label: "Used on Mobile",
          bg: "bg-blue-100",
          text: "text-blue-800",
          Icon: Wrench,
        }
      default:
        return { label: changeType, bg: "bg-gray-100", text: "text-gray-800", Icon: null }
    }
  }

  const handleReset = () => {
    setFromDate("")
    setToDate("")
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-start pt-4 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden border border-gray-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <History className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Spare Purchase History</h3>
              <p className="text-orange-100 text-sm">
                Stock additions, supplier returns &amp; mobile usage
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="h-6 w-6 text-white" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(95vh-80px)]">
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
              <p className="text-green-600 text-sm font-medium">Total Purchased</p>
              <p className="text-2xl font-bold text-green-800 mt-1">
                ₹{totalPurchaseAmount.toLocaleString("en-IN")}
              </p>
              <p className="text-xs text-green-600 mt-1">{purchases.length} entries</p>
            </div>
            <div className="bg-gradient-to-r from-amber-50 to-amber-100 rounded-xl p-4 border border-amber-200">
              <p className="text-amber-600 text-sm font-medium">Returned to Supplier</p>
              <p className="text-2xl font-bold text-amber-800 mt-1">
                ₹{totalReturnAmount.toLocaleString("en-IN")}
              </p>
              <p className="text-xs text-amber-600 mt-1">{returns.length} entries</p>
            </div>
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
              <p className="text-blue-600 text-sm font-medium">Used on Mobiles</p>
              <p className="text-2xl font-bold text-blue-800 mt-1">{totalUsedQty} units</p>
              <p className="text-xs text-blue-600 mt-1">{usages.length} entries</p>
            </div>
          </div>

          {/* Date filter */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                />
              </div>
              <button
                onClick={fetchHistory}
                disabled={loading}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center space-x-2"
              >
                <Filter className="h-4 w-4" />
                <span>{loading ? "Loading..." : "Apply"}</span>
              </button>
              {(fromDate || toDate) && (
                <button
                  onClick={handleReset}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors bg-white"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full mr-3" />
                <span className="text-gray-600 text-lg">Loading history...</span>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-16">
                <History className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium text-lg">No history found</p>
                <p className="text-gray-400 text-sm mt-1">
                  {fromDate || toDate
                    ? "Try adjusting the date range"
                    : "No spare stock movements recorded yet"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-gray-100 to-gray-200">
                    <tr>
                      <th className="px-5 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                        Date
                      </th>
                      <th className="px-5 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                        Spare Name
                      </th>
                      <th className="px-5 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                        Supplier
                      </th>
                      <th className="px-5 py-4 text-center text-sm font-bold text-gray-700 border-b border-gray-300">
                        Qty
                      </th>
                      <th className="px-5 py-4 text-right text-sm font-bold text-gray-700 border-b border-gray-300">
                        Amount
                      </th>
                      <th className="px-5 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                        Payment
                      </th>
                      <th className="px-5 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                        Type
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((entry, idx) => {
                      const badge = getTypeBadge(entry.changeType)
                      const BadgeIcon = badge.Icon
                      return (
                        <tr
                          key={entry._id || idx}
                          className={`hover:bg-gray-50 transition-colors ${
                            idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                          }`}
                        >
                          <td className="px-5 py-3 border-b border-gray-200">
                            <div className="text-sm font-medium text-gray-900">
                              {new Date(entry.changeDate).toLocaleDateString("en-IN")}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(entry.changeDate).toLocaleTimeString("en-IN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </td>
                          <td className="px-5 py-3 border-b border-gray-200 font-medium text-gray-800">
                            {entry.spareName}
                          </td>
                          <td className="px-5 py-3 border-b border-gray-200 text-sm text-gray-600">
                            {entry.supplierName}
                          </td>
                          <td className="px-5 py-3 border-b border-gray-200 text-center font-bold text-gray-800">
                            {entry.quantity}
                          </td>
                          <td className="px-5 py-3 border-b border-gray-200 text-right font-semibold text-gray-800">
                            {entry.amount > 0
                              ? `₹${entry.amount.toLocaleString("en-IN")}`
                              : "—"}
                          </td>
                          <td className="px-5 py-3 border-b border-gray-200">
                            {entry.paymentMethod && entry.paymentMethod !== "—" ? (
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${
                                  entry.paymentMethod === "credit" ||
                                  entry.paymentMethod === "upi"
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-green-100 text-green-700"
                                }`}
                              >
                                {entry.paymentMethod === "cash"
                                  ? "Cash"
                                  : entry.paymentMethod === "upi"
                                  ? "UPI"
                                  : entry.paymentMethod === "credit"
                                  ? "Credit"
                                  : entry.paymentMethod}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3 border-b border-gray-200">
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}
                            >
                              {BadgeIcon && (
                                <BadgeIcon className="h-3 w-3 mr-1" />
                              )}
                              {badge.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SpareHistoryModal

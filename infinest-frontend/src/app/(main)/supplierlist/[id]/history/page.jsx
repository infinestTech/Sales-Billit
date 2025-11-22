"use client"


import { useEffect, useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { jwtDecode } from "jwt-decode"
import api from "@/components/api"
import { History, ArrowLeft, Package, Calendar, CreditCard, MessageSquare, TrendingUp } from "lucide-react"


export default function SupplierHistoryPage() {
  const params = useParams()
  const router = useRouter()
  const supplierId = params?.id


  const [shopId, setShopId] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  // Filters
  const [filterType, setFilterType] = useState("all") // all | credit | debt
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const filteredItems = useMemo(() => {
    return items.filter(it => {
      // Type filter
      if (filterType === "credit" && (it.type || "").toUpperCase() !== "CREDIT") return false
      if (filterType === "debt" && (it.type || "").toUpperCase() !== "DEBT") return false
      // Date range filter
      if (startDate || endDate) {
        const d = it.date ? new Date(it.date) : null
        if (!d) return false
        if (startDate) {
          const sd = new Date(startDate + "T00:00:00")
          if (d < sd) return false
        }
        if (endDate) {
          const ed = new Date(endDate + "T23:59:59")
          if (d > ed) return false
        }
      }
      return true
    })
  }, [items, filterType, startDate, endDate])


  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!token) {
      router.push("/billit-login")
      return
    }
    try {
      const decoded = jwtDecode(token)
      if (decoded?.shop_id) {
        setShopId(decoded.shop_id)
      } else {
        router.push("/billit-login")
      }
    } catch (e) {
      router.push("/billit-login")
    }
  }, [router])


  useEffect(() => {
    const fetchHistory = async () => {
      if (!shopId || !supplierId) return
      setLoading(true)
      setError("")
      try {
        const token = localStorage.getItem("token")
        const res = await api.post(
          "/api/suppliers/history",
          { shop_id: shopId, supplierId },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        setItems(res?.data?.items || [])
      } catch (err) {
        setError("Failed to load history")
        console.error("Supplier history error", err)
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [shopId, supplierId])


  return (
    <div className="h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push("/supplierlist")}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200 backdrop-blur-sm"
              title="Back to Suppliers"
            >
              <ArrowLeft className="h-5 w-5 text-white" />
            </button>
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-white/20 rounded-xl">
                <History className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Supplier History</h2>
                <p className="text-blue-100">View all transactions and activities</p>
              </div>
            </div>
          </div>
          {!loading && items.length > 0 && (
            <div className="hidden md:flex items-center space-x-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg">
              <TrendingUp className="h-5 w-5 text-white" />
              <span className="text-white font-semibold">{items.length} Transaction{items.length !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-8 py-6 overflow-auto bg-gradient-to-br from-gray-50 to-blue-50">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full mb-6 animate-pulse">
                <History className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Loading History...</h3>
              <p className="text-gray-600">Please wait while we fetch your data.</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
                <History className="h-10 w-10 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Error Loading History</h3>
              <p className="text-red-600">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full mb-6">
                <History className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No History Found</h3>
              <p className="text-gray-600">This supplier has no transaction history yet.</p>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 overflow-hidden shadow-lg rounded-xl">
            {/* Filter Bar */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row md:items-end gap-4">
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-gray-600 mb-1">Transaction Type</label>
                <div className="inline-flex rounded-lg overflow-hidden border border-gray-300">
                  <button
                    type="button"
                    onClick={() => setFilterType("all")}
                    className={`px-4 py-2 text-sm font-medium ${filterType === "all" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
                  >All</button>
                  <button
                    type="button"
                    onClick={() => setFilterType("credit")}
                    className={`px-4 py-2 text-sm font-medium border-l border-gray-300 ${filterType === "credit" ? "bg-green-600 text-white" : "bg-white text-gray-700"}`}
                  >Credit</button>
                  <button
                    type="button"
                    onClick={() => setFilterType("debt")}
                    className={`px-4 py-2 text-sm font-medium border-l border-gray-300 ${filterType === "debt" ? "bg-red-600 text-white" : "bg-white text-gray-700"}`}
                  >Debt</button>
                </div>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-gray-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-gray-600 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="flex items-center gap-2 mt-2 md:mt-0">
                <button
                  type="button"
                  onClick={() => { setFilterType("all"); setStartDate(""); setEndDate(""); }}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-100"
                >Clear</button>
                <span className="text-xs text-gray-500">Showing {filteredItems.length} / {items.length}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gradient-to-r from-gray-100 to-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                      <div className="flex items-center space-x-2">
                        <Package className="h-4 w-4" />
                        <span>Type</span>
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4" />
                        <span>Date & Time</span>
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">Product Name</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">Quantity</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">Cost Price</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">Total Amount</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                      <div className="flex items-center space-x-2">
                        <CreditCard className="h-4 w-4" />
                        <span>Payment</span>
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                      <div className="flex items-center space-x-2">
                        <MessageSquare className="h-4 w-4" />
                        <span>Message</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((it, i) => (
                    <tr
                      key={i}
                      className={`hover:bg-blue-50 transition-colors duration-200 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                    >
                      <td className="px-6 py-4 border-b border-gray-200">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${(() => {
                          const t = (it.type || '').toUpperCase()
                          if (t === 'CREDIT') return 'bg-green-100 text-green-800'
                          if (t === 'DEBT') return 'bg-red-100 text-red-800'
                          if (t === 'PURCHASE') return 'bg-blue-100 text-blue-800'
                          if (t === 'PAYMENT') return 'bg-indigo-100 text-indigo-800'
                          return 'bg-gray-100 text-gray-800'
                        })()}`}>
                          {(it.type || 'N/A').toLowerCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 border-b border-gray-200 text-gray-700">
                        {it.date ? new Date(it.date).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short"
                        }) : "-"}
                      </td>
                      <td className="px-6 py-4 border-b border-gray-200 text-gray-900 font-semibold">
                        {it.productName || "-"}
                      </td>
                      <td className="px-6 py-4 border-b border-gray-200 text-gray-700">
                        <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-800 font-medium">
                          {it.quantity || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 border-b border-gray-200 text-gray-700 font-medium">
                        ₹{Number(it.costPrice || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="px-6 py-4 border-b border-gray-200">
                        <span className={`font-bold text-lg ${(() => {
                          const t = (it.type || '').toUpperCase()
                          if (t === 'CREDIT') return 'text-green-600'
                          if (t === 'DEBT') return 'text-red-600'
                          return 'text-blue-600'
                        })()}`}>
                          ₹{Number(it.total || it.totalAmount || 0).toLocaleString("en-IN")}
                        </span>
                      </td>
                      <td className="px-6 py-4 border-b border-gray-200">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 capitalize">
                          {it.paymentMethod || "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-4 border-b border-gray-200 text-gray-600 max-w-xs truncate" title={it.message}>
                        {it.message || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}





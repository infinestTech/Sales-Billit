"use client"


import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { jwtDecode } from "jwt-decode"
import api from "@/components/api"
import { History, ArrowLeft, Package, Calendar, CreditCard, MessageSquare, TrendingUp } from "lucide-react"
import { PAYMENT_METHOD_OPTIONS } from "@/constants/paymentMethods"


export default function SupplierHistoryPage() {
  const params = useParams()
  const router = useRouter()
  const supplierId = params?.id


  const [shopId, setShopId] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")


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

  // Helper: try to parse product/quantity/cost from free-form message strings
  const parseMessage = (msg) => {
    if (!msg || typeof msg !== 'string') return {}
    // Examples formats:
    // "Added: ssss x1 - ₹90"
    // "Added: productName x2 - ₹120"
    // Try to match: <label>: <name> x<qty> - ₹<cost>
    const re = /(?:Added:|added:)?\s*([^x\-\n]+?)\s*[xX]\s*(\d+)\s*[-–]\s*₹?\s*(\d+(?:\.\d+)?)/i
    const m = msg.match(re)
    if (m) {
      return { name: m[1].trim(), qty: Number(m[2]), cost: Number(m[3]) }
    }
    // fallback: try to capture "<name> x<qty>" without cost
    const re2 = /([^x\-\n]+?)\s*[xX]\s*(\d+)/
    const m2 = msg.match(re2)
    if (m2) return { name: m2[1].trim(), qty: Number(m2[2]) }
    return {}
  }

  // Filters
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [paymentFilter, setPaymentFilter] = useState("all")
  const [minCost, setMinCost] = useState("")
  const [maxCost, setMaxCost] = useState("")
  const [minPaid, setMinPaid] = useState("")
  const [maxPaid, setMaxPaid] = useState("")
  const [messageFilter, setMessageFilter] = useState("")

  const clearFilters = () => {
    setStartDate("")
    setEndDate("")
    setPaymentFilter("all")
    setMinCost("")
    setMaxCost("")
    setMinPaid("")
    setMaxPaid("")
    setMessageFilter("")
  }

  // Compute filtered items (move complex logic out of JSX to avoid parser issues)
  const filteredItems = items.filter(it => {
    // date filter
    const itDate = it.date ? new Date(it.date) : null
    if (startDate) {
      const sd = new Date(startDate)
      if (!itDate || itDate < sd) return false
    }
    if (endDate) {
      const ed = new Date(endDate)
      ed.setHours(23,59,59,999)
      if (!itDate || itDate > ed) return false
    }

    // payment method filter
    if (paymentFilter && paymentFilter !== 'all') {
      const pm = (it.paymentMethod || '').toLowerCase()
      if (pm !== paymentFilter) return false
    }

    // cost filter (use costPrice if available or try to parse from message)
    const parsed = parseMessage(it.message)
    const cost = Number(it.costPrice || parsed.cost || 0)
    if (minCost !== "") {
      if (Number.isNaN(Number(minCost)) || cost < Number(minCost)) return false
    }
    if (maxCost !== "") {
      if (Number.isNaN(Number(maxCost)) || cost > Number(maxCost)) return false
    }

    // paid filter
    const paidVal = (typeof it.paidAmount !== 'undefined' && it.paidAmount !== null) ? Number(it.paidAmount) : null
    if (minPaid !== "") {
      if (paidVal === null || paidVal < Number(minPaid)) return false
    }
    if (maxPaid !== "") {
      if (paidVal === null || paidVal > Number(maxPaid)) return false
    }

    // message text filter
    if (messageFilter && messageFilter.trim() !== '') {
      const mf = messageFilter.trim().toLowerCase()
      if (!((it.message || '').toLowerCase().includes(mf))) return false
    }

    return true
  })


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
            {/* Simple Filters bar */}
            <div className="px-6 py-4 border-b bg-gray-50">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">From</label>
                  <input 
                    type="date" 
                    className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    value={startDate} 
                    onChange={e=>setStartDate(e.target.value)} 
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">To</label>
                  <input 
                    type="date" 
                    className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    value={endDate} 
                    onChange={e=>setEndDate(e.target.value)} 
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Payment</label>
                  <select 
                    className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={paymentFilter} 
                    onChange={e=>setPaymentFilter(e.target.value)}
                  >
                    <option value="all">All</option>
                    {PAYMENT_METHOD_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Cost ₹</label>
                  <input 
                    type="number" 
                    placeholder="Min" 
                    className="border border-gray-300 rounded px-3 py-2 w-20 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    value={minCost} 
                    onChange={e=>setMinCost(e.target.value)} 
                  />
                  <span className="text-gray-400">-</span>
                  <input 
                    type="number" 
                    placeholder="Max" 
                    className="border border-gray-300 rounded px-3 py-2 w-20 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    value={maxCost} 
                    onChange={e=>setMaxCost(e.target.value)} 
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Paid ₹</label>
                  <input 
                    type="number" 
                    placeholder="Min" 
                    className="border border-gray-300 rounded px-3 py-2 w-20 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    value={minPaid} 
                    onChange={e=>setMinPaid(e.target.value)} 
                  />
                  <span className="text-gray-400">-</span>
                  <input 
                    type="number" 
                    placeholder="Max" 
                    className="border border-gray-300 rounded px-3 py-2 w-20 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    value={maxPaid} 
                    onChange={e=>setMaxPaid(e.target.value)} 
                  />
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <input 
                    type="text" 
                    placeholder="Search message..." 
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    value={messageFilter} 
                    onChange={e=>setMessageFilter(e.target.value)} 
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded transition-colors" 
                    onClick={clearFilters}
                  >
                    Clear
                  </button>
                  <span className="text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded border">
                    {filteredItems.length} / {items.length}
                  </span>
                </div>
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
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">Paid</th>
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
                  {filteredItems.map((it, i) => {
                    const parsed = parseMessage(it.message)
                    const productName = it.productName || parsed.name || "-"
                    const quantity = (it.quantity !== undefined && it.quantity !== null && it.quantity !== 0) ? it.quantity : (parsed.qty || 0)
                    const costPrice = (it.costPrice !== undefined && it.costPrice !== null && Number(it.costPrice) !== 0) ? it.costPrice : (parsed.cost || 0)
                    return (
                      <tr
                        key={i}
                        className={`hover:bg-blue-50 transition-colors duration-200 ${((it.message||"").toLowerCase().startsWith('added')) ? 'bg-white' : 'bg-red-100/100'}`}
                      >
                        <td className="px-6 py-4 border-b border-gray-200">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                            (it.type || '').toLowerCase() === 'purchase' 
                              ? 'bg-green-100 text-green-800' 
                              : (it.type || '').toLowerCase() === 'payment'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
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
                          {productName}
                        </td>
                        <td className="px-6 py-4 border-b border-gray-200 text-gray-700">
                          <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-800 font-medium">
                            {quantity}
                          </span>
                        </td>
                        <td className="px-6 py-4 border-b border-gray-200 text-gray-700 font-medium">
                          ₹{Number(costPrice || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="px-6 py-4 border-b border-gray-200 text-gray-700 font-medium">
                          {typeof it.paidAmount === 'number' && it.paidAmount !== null ? (
                            <span className="text-green-600 font-bold">₹{Number(it.paidAmount || 0).toLocaleString("en-IN")}</span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                          {typeof it.previousAmount === 'number' && it.previousAmount !== null && (
                            <div className="text-xs text-gray-400">Prev: ₹{Number(it.previousAmount).toLocaleString("en-IN")}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 border-b border-gray-200">
                          <span className="text-blue-600 font-bold text-lg">
                            ₹{Number(it.total || 0).toLocaleString("en-IN")}
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
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}





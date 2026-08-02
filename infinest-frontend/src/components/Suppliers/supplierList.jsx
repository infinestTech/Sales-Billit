"use client"

import React, { useEffect, useState } from "react"
import { Users, Search, CreditCard, History, IndianRupee, TrendingDown, AlertCircle, CheckCircle, Plus } from "lucide-react"
import api from "@/components/api"
import AddSupplierModal from "@/components/ProductTable/AddSupplierModal"
import { useRouter } from "next/navigation"
import { PAYMENT_METHOD_OPTIONS, DEFAULT_PAYMENT_METHOD } from "@/constants/paymentMethods"

export default function SupplierList({ shopId }) {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false)
  // Pay Credit modal state
  const [payId, setPayId] = useState(null)
  const [paySupplier, setPaySupplier] = useState(null)
  const [payAmount, setPayAmount] = useState("")
  const [payPM, setPayPM] = useState(DEFAULT_PAYMENT_METHOD)
  const [payMsg, setPayMsg] = useState("")
  const [paying, setPaying] = useState(false)
  const router = useRouter()

  const fetchSuppliers = async () => {
    if (!shopId) return
    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      const res = await api.post(
        "/api/suppliers/list",
        { shop_id: shopId },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setSuppliers(res.data.suppliers || [])
    } catch (err) {
      console.error("Failed to load suppliers", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSuppliers() }, [shopId])

  const filtered = search
    ? suppliers.filter(s => s.supplierName.toLowerCase().includes(search.toLowerCase()) || (s.agencyName || "").toLowerCase().includes(search.toLowerCase()))
    : suppliers

  const totalCredit = suppliers.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0)
  const suppliersWithCredit = suppliers.filter(s => Number(s.totalAmount || 0) > 0).length

  const openPay = (s) => {
    setPayId(s._id)
    setPaySupplier(s)
    setPayAmount("")
    setPayPM(DEFAULT_PAYMENT_METHOD)
    setPayMsg("")
  }

  const closePay = () => {
    setPayId(null)
    setPaySupplier(null)
    setPayAmount("")
    setPayPM(DEFAULT_PAYMENT_METHOD)
    setPayMsg("")
  }

  const savePayment = async () => {
    const amt = Number(payAmount)
    if (!amt || amt <= 0) { alert("Enter a valid amount"); return }
    if (!payId || !shopId) return
    setPaying(true)
    try {
      const token = localStorage.getItem("token")
      await api.post(
        "/api/suppliers/update",
        { shop_id: shopId, supplierId: payId, paidAmount: amt, lastPaymentMethod: payPM, message: payMsg || `Payment: ₹${amt}` },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      await fetchSuppliers()
      closePay()
    } catch (e) {
      console.error("Payment failed", e)
      alert("Payment failed. Please try again.")
    } finally {
      setPaying(false)
    }
  }

  const creditColor = (amount) => {
    const n = Number(amount || 0)
    if (n <= 0) return { badge: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500", label: "Cleared" }
    if (n < 1000) return { badge: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500", label: "Low" }
    return { badge: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500", label: "Owed" }
  }

  return (
    <div className="h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 flex-shrink-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-white/20 rounded-xl">
              <Users className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Suppliers</h2>
              <p className="text-blue-100">Track credit balances and payments</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddSupplierModal(true)}
            className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2 backdrop-blur-sm border border-white/20"
          >
            <Plus className="h-5 w-5" />
            <span>Add Supplier</span>
          </button>
        </div>
      </div>

      {/* Credit Summary Banner */}
      {!loading && suppliers.length > 0 && (
        <div className={`px-8 py-4 flex-shrink-0 border-b ${totalCredit > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <IndianRupee className={`h-5 w-5 ${totalCredit > 0 ? "text-red-600" : "text-green-600"}`} />
              <span className="text-sm text-gray-600">Total Credit Owed:</span>
              <span className={`text-xl font-bold ${totalCredit > 0 ? "text-red-700" : "text-green-700"}`}>
                ₹{totalCredit.toLocaleString("en-IN")}
              </span>
            </div>
            {totalCredit > 0 ? (
              <div className="flex items-center gap-1.5 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span>{suppliersWithCredit} supplier{suppliersWithCredit !== 1 ? "s" : ""} with outstanding credit</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>All supplier accounts cleared</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="px-8 py-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or agency..."
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Supplier List */}
      <div className="flex-1 px-8 py-6 overflow-auto">
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4 animate-pulse">
              <Users className="h-8 w-8 text-blue-600" />
            </div>
            <p className="text-gray-600 font-medium">Loading suppliers...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <Users className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">No Suppliers Found</h3>
            <p className="text-gray-500">Add a supplier to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((s) => {
              const credit = Number(s.totalAmount || 0)
              const colors = creditColor(credit)
              return (
                <div
                  key={s._id}
                  className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 p-5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Supplier Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colors.dot}`} />
                        <h3 className="text-base font-bold text-gray-900 truncate">{s.supplierName}</h3>
                        {s.agencyName && (
                          <span className="text-sm text-gray-500 truncate">— {s.agencyName}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 ml-4">
                        {s.phoneNumber && <span>📞 {s.phoneNumber}</span>}
                        {s.address && <span className="truncate max-w-xs" title={s.address}>📍 {s.address}</span>}
                        {s.createdAt && <span>Added: {new Date(s.createdAt).toLocaleDateString("en-IN")}</span>}
                      </div>
                    </div>

                    {/* Credit Balance */}
                    <div className="flex-shrink-0 text-center sm:text-right">
                      <p className="text-xs text-gray-500 mb-1">Credit Balance</p>
                      <div className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border font-bold text-lg ${colors.badge}`}>
                        <IndianRupee className="h-4 w-4" />
                        {credit.toLocaleString("en-IN")}
                      </div>
                      {credit > 0 && s.lastPaymentMethod && (
                        <p className="text-xs text-gray-400 mt-1 capitalize">
                          Last: {s.lastPaymentMethod}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <button
                        onClick={() => openPay(s)}
                        className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                          credit > 0
                            ? "bg-red-600 hover:bg-red-700 text-white"
                            : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                        }`}
                        title={credit > 0 ? "Pay credit balance" : "Adjust credit"}
                      >
                        <TrendingDown className="h-4 w-4" />
                        {credit > 0 ? "Pay Credit" : "Adjust"}
                      </button>
                      <button
                        onClick={() => router.push(`/supplierlist/${s._id}/history`)}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-sm transition-colors border border-blue-200"
                        title="View history"
                      >
                        <History className="h-4 w-4" />
                        History
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pay Credit Modal */}
      {payId && paySupplier && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Pay Credit</h3>
                <p className="text-red-100 text-sm">{paySupplier.supplierName}{paySupplier.agencyName ? ` — ${paySupplier.agencyName}` : ""}</p>
              </div>
              <button onClick={closePay} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white text-lg leading-none">✕</button>
            </div>

            <div className="p-6 space-y-4">
              {/* Current balance */}
              <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-xl">
                <span className="text-sm font-medium text-red-700">Outstanding Credit Balance</span>
                <span className="text-2xl font-bold text-red-700">
                  ₹{Number(paySupplier.totalAmount || 0).toLocaleString("en-IN")}
                </span>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Amount Paying Now *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="w-full border border-gray-300 rounded-xl pl-8 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="0"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    autoFocus
                  />
                </div>
                {payAmount && Number(payAmount) > 0 && (
                  <p className="mt-1.5 text-sm text-gray-500">
                    Remaining after payment:{" "}
                    <span className={`font-semibold ${Number(paySupplier.totalAmount || 0) - Number(payAmount) <= 0 ? "text-green-600" : "text-red-600"}`}>
                      ₹{Math.max(0, Number(paySupplier.totalAmount || 0) - Number(payAmount)).toLocaleString("en-IN")}
                    </span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Payment Method *</label>
                <select
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
                  value={payPM}
                  onChange={(e) => setPayPM(e.target.value)}
                >
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Note (optional)</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="e.g. Paid via bank transfer"
                  value={payMsg}
                  onChange={(e) => setPayMsg(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                  onClick={closePay}
                  disabled={paying}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors disabled:opacity-50"
                  onClick={savePayment}
                  disabled={paying}
                >
                  {paying ? "Saving..." : "Confirm Payment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddSupplierModal && (
        <AddSupplierModal
          shop_id={shopId}
          onClose={() => setShowAddSupplierModal(false)}
          onSuccess={(newSupplier) => {
            setShowAddSupplierModal(false)
            if (newSupplier) setSuppliers(prev => [newSupplier, ...(prev || [])])
          }}
        />
      )}
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import api from "../../components/api"
import { X, Package, Tag, Hash, CreditCard, Banknote, AlertTriangle, IndianRupee } from "lucide-react"
import { logError } from "@/utils/logger"
import { PAYMENT_METHOD_OPTIONS, DEFAULT_PAYMENT_METHOD } from "@/constants/paymentMethods"

/**
 * AddSpareModal — Add service spare parts to inventory.
 * Uses a single "Purchase Amount" (total cost) instead of separate
 * cost price / selling price fields. Supports cash or credit purchase type.
 */
const AddSpareModal = ({ shop_id, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    name: "",
    category: "",
    purchaseAmount: "",
    quantity: "",
    supplierId: "",
    paymentMethod: DEFAULT_PAYMENT_METHOD,
  })
  const [purchaseType, setPurchaseType] = useState("cash") // "cash" | "credit"
  const [loading, setLoading] = useState(false)
  const [suppliers, setSuppliers] = useState([])

  useEffect(() => {
    const fetchSuppliers = async () => {
      if (!shop_id) return
      try {
        const token = localStorage.getItem("token")
        const res = await api.post(
          "/api/suppliers/list",
          { shop_id },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        setSuppliers(Array.isArray(res.data.suppliers) ? res.data.suppliers : [])
      } catch (err) {
        logError("Failed to load suppliers", err)
        setSuppliers([])
      }
    }
    fetchSuppliers()
  }, [shop_id])

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.quantity) {
      alert("Spare name and quantity are required.")
      return
    }
    if (!form.supplierId) {
      alert("Please select a supplier.")
      return
    }
    if (purchaseType === "credit" && !form.purchaseAmount) {
      alert("Please enter the purchase amount for credit purchases.")
      return
    }

    const qty = Number.parseInt(form.quantity)
    const purchaseAmount = Number(form.purchaseAmount || 0)
    // derive per-unit cost price from total amount
    const costPrice = purchaseAmount > 0 && qty > 0 ? purchaseAmount / qty : 0

    try {
      setLoading(true)
      const token = localStorage.getItem("token")
      await api.post(
        "/api/products/add",
        {
          name: form.name,
          category: form.category,
          costPrice,
          quantity: qty,
          purchaseAmount,
          supplierId: form.supplierId || undefined,
          paymentMethod: purchaseType === "credit" ? "credit" : form.paymentMethod,
          purchaseType,
          shop_id,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      onSuccess()
    } catch (error) {
      console.error("Error adding spare:", error)
      alert("Failed to add spare. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const selectedSupplierName = suppliers.find(s => s._id === form.supplierId)?.supplierName || "the supplier"
  const totalAmount = Number(form.purchaseAmount || 0)

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Add Spare Part</h2>
              <p className="text-orange-100 text-sm">Stock a spare for repair use</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Spare Name */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 flex items-center">
              <Package className="h-4 w-4 mr-2 text-orange-500" />
              Spare Name *
            </label>
            <input
              name="name"
              placeholder="e.g. Display Assembly, Battery"
              value={form.name}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all bg-gray-50 hover:bg-white"
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 flex items-center">
              <Tag className="h-4 w-4 mr-2 text-amber-500" />
              Category
            </label>
            <input
              name="category"
              placeholder="e.g. Display, Battery, Charging (optional)"
              value={form.category}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all bg-gray-50 hover:bg-white"
            />
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 flex items-center">
              <Hash className="h-4 w-4 mr-2 text-purple-600" />
              Quantity *
            </label>
            <input
              name="quantity"
              type="number"
              min="1"
              placeholder="Number of units"
              value={form.quantity}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-gray-50 hover:bg-white"
              required
            />
          </div>

          {/* Supplier */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">
                Supplier <span className="text-red-500 ml-1">*</span>
            </label>
            <select
              name="supplierId"
              value={form.supplierId}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all bg-gray-50 hover:bg-white"
            >
              <option value="">
                Select supplier (required)
              </option>
              {suppliers.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.supplierName}
                </option>
              ))}
            </select>
          </div>

          {/* Purchase Type Toggle */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">How are you paying?</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPurchaseType("cash")}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 font-semibold transition-all ${
                  purchaseType === "cash"
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                }`}
              >
                <Banknote className="h-4 w-4" />
                Cash / UPI
                <span className="text-xs font-normal">(Paid now)</span>
              </button>
              <button
                type="button"
                onClick={() => setPurchaseType("credit")}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 font-semibold transition-all ${
                  purchaseType === "credit"
                    ? "border-orange-500 bg-orange-50 text-orange-700"
                    : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                }`}
              >
                <CreditCard className="h-4 w-4" />
                Credit
                <span className="text-xs font-normal">(Pay later)</span>
              </button>
            </div>
          </div>

          {/* Purchase Amount — shown for both cash and credit, required for credit */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 flex items-center">
              <IndianRupee className="h-4 w-4 mr-2 text-green-600" />
              Purchase Amount {purchaseType === "credit" && <span className="text-red-500 ml-1">*</span>}
              <span className="ml-2 text-xs font-normal text-gray-500">(total for this batch)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">₹</span>
              <input
                name="purchaseAmount"
                type="number"
                min="0"
                placeholder="0"
                value={form.purchaseAmount}
                onChange={handleChange}
                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-gray-50 hover:bg-white"
              />
            </div>
            {form.purchaseAmount && form.quantity && Number(form.quantity) > 0 && (
              <p className="text-xs text-gray-500">
                ₹{(totalAmount / Number(form.quantity)).toFixed(0)} per unit
              </p>
            )}
          </div>

          {/* Payment Method — shown only for cash purchases */}
          {purchaseType === "cash" && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Payment Method</label>
              <select
                name="paymentMethod"
                value={form.paymentMethod}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-gray-50 hover:bg-white"
              >
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Credit notice */}
          {purchaseType === "credit" && totalAmount > 0 && (
            <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-xl">
              <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-orange-700">
                <span className="font-semibold">₹{totalAmount.toLocaleString("en-IN")}</span> will be added to{" "}
                <span className="font-semibold">{selectedSupplierName}</span>'s credit balance.
                Pay it off from the Suppliers page.
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all border border-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? "Adding..." : "Add Spare"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddSpareModal

"use client"


import { useEffect, useState } from "react"
import api from "../../components/api"
import { X, Package, Tag, DollarSign, Hash } from "lucide-react"
import { logAndNotify, logError, logSystem } from "@/utils/logger"
import { PAYMENT_METHOD_OPTIONS, DEFAULT_PAYMENT_METHOD } from "@/constants/paymentMethods"




const AddProductModal = ({ shop_id, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    name: "",
    category: "",
    costPrice: "",
    sellingPrice: "",
    quantity: "",
    supplierId: "",
    paymentMethod: DEFAULT_PAYMENT_METHOD,
  })
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
    if (!form.name || !form.costPrice || !form.quantity) {
       console.warn("Product name, cost price, and quantity are required.")
      return
    }




    console.log("Sending data:", {
      name: form.name,
      category: form.category,
      costPrice: Number.parseInt(form.costPrice),
      sellingPrice: form.sellingPrice ? Number.parseInt(form.sellingPrice) : undefined,
      quantity: Number.parseInt(form.quantity),
      supplierId: form.supplierId || undefined,
      paymentMethod: form.paymentMethod,
      shop_id,
    })




    try {
      setLoading(true)
      const token = localStorage.getItem("token")
      await api.post(
        "/api/products/add",
        {
          name: form.name,
          category: form.category,
          costPrice: Number.parseInt(form.costPrice),
          sellingPrice: form.sellingPrice ? Number.parseInt(form.sellingPrice) : undefined,
          quantity: Number.parseInt(form.quantity),
          supplierId: form.supplierId || undefined,
          paymentMethod: form.paymentMethod,
          shop_id,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )
      onSuccess()
    } catch (error) {
      console.error("Error adding product:", error)
       console.warn("Failed to add product.")
    } finally {
      setLoading(false)
    }
  }




  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Package className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Add New Product</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <X className="h-5 w-5 text-white" />
          </button>
        </div>




        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Product Name */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 flex items-center">
              <Package className="h-4 w-4 mr-2 text-blue-600" />
              Product Name *
            </label>
            <input
              name="name"
              placeholder="Enter product name"
              value={form.name}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
              required
            />
          </div>




          {/* Category */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 flex items-center">
              <Tag className="h-4 w-4 mr-2 text-indigo-600" />
              Category
            </label>
            <input
              name="category"
              placeholder="Enter category (optional)"
              value={form.category}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
            />
          </div>




          {/* Price Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center">
                <DollarSign className="h-4 w-4 mr-2 text-green-600" />
                Cost Price *
              </label>
              <input
                name="costPrice"
                type="number"
                placeholder="₹0"
                value={form.costPrice}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center">
                <DollarSign className="h-4 w-4 mr-2 text-emerald-600" />
                Selling Price
              </label>
              <input
                name="sellingPrice"
                type="number"
                placeholder="₹0"
                value={form.sellingPrice}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
              />
            </div>
          </div>


          {/* Supplier & Payment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center">
                Supplier
              </label>
              <select
                name="supplierId"
                value={form.supplierId}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
              >
                <option value="">Select supplier (optional)</option>
                {suppliers.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.supplierName}
                  </option>
                ))}
              </select>
            </div>


            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center">
                Payment Method
              </label>
              <select
                name="paymentMethod"
                value={form.paymentMethod}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
              >
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
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
              placeholder="Enter quantity"
              value={form.quantity}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
              required
            />
          </div>




          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all duration-200 border border-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
            >
              {loading ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Adding...
                </div>
              ) : (
                "Add Product"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}




export default AddProductModal
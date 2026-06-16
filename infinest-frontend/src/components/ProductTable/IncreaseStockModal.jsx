"use client"

import { useState } from "react"
import api from "../api"
import { X, Plus, Package, DollarSign } from "lucide-react"
import { logAndNotify, logError } from "@/utils/logger"

const IncreaseStockModal = ({ product, shop_id, onClose, onSuccess }) => {
  const [quantity, setQuantity] = useState("")
  const [costPrice, setCostPrice] = useState(product.costPrice || "")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    const quantityToAdd = parseInt(quantity, 10)
    const price = parseFloat(costPrice)

    if (!quantityToAdd || quantityToAdd <= 0) {
      logAndNotify("Please enter a valid quantity.", "warning", shop_id)
      return
    }

    if (!price || price <= 0) {
      logAndNotify("Please enter a valid cost price.", "warning", shop_id)
      return
    }

    try {
      setLoading(true)
      const token = localStorage.getItem("token")
      await api.post(
        "/api/products/increase-stock",
        {
          shop_id,
          productId: product._id,
          quantityToAdd,
          costPrice: price,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      logAndNotify("Stock increased successfully!", "success", shop_id)
      onSuccess()
    } catch (error) {
      logError("Failed to increase stock", error)
      logAndNotify("Failed to increase stock.", "error", shop_id)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Plus className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white">Increase Stock</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/20 rounded-lg"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Product Info */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-800">{product.name}</p>
              <p className="text-sm text-gray-600">
                Current Stock: <span className="font-semibold text-blue-600">{product.quantity}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Quantity Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Quantity to Add <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Plus className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="Enter quantity"
                min="1"
                required
              />
            </div>
          </div>

          {/* Cost Price Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Cost Price (per unit) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <DollarSign className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="number"
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                placeholder="Enter cost price"
                min="0.01"
                required
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Previous cost price: ₹{product.costPrice || 'N/A'}
            </p>
          </div>

          {/* Summary */}
          {quantity && costPrice && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-700">Total Cost:</span>
                <span className="text-lg font-bold text-green-700">
                  ₹{(parseFloat(quantity) * parseFloat(costPrice)).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">New Stock Level:</span>
                <span className="text-lg font-bold text-blue-700">
                  {product.quantity + parseInt(quantity || 0)}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all duration-200"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
            >
              {loading ? "Adding..." : "Add Stock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default IncreaseStockModal

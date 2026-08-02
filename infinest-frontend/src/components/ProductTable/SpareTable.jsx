"use client"

import { useState } from "react"
import api from "../../components/api"
import { Package, RotateCcw, X } from "lucide-react"
import { logAndNotify, logError } from "@/utils/logger"

const SpareTable = ({ products, onRefresh, shop_id }) => {
  // Return to supplier modal state
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [returnProduct, setReturnProduct] = useState(null)
  const [returnQty, setReturnQty] = useState("")
  const [returning, setReturning] = useState(false)

  const openReturnModal = (product) => {
    setReturnProduct(product)
    setReturnQty("")
    setShowReturnModal(true)
  }

  const closeReturnModal = () => {
    setShowReturnModal(false)
    setReturnProduct(null)
    setReturnQty("")
  }

  const handleReturn = async () => {
    const qty = parseInt(returnQty, 10)
    if (!qty || qty <= 0) {
      logAndNotify("Please enter a valid return quantity.", "warning", shop_id)
      return
    }
    if (qty > returnProduct.quantity) {
      logAndNotify("Return quantity exceeds current stock.", "warning", shop_id)
      return
    }

    setReturning(true)
    try {
      const token = localStorage.getItem("token")
      const res = await api.post(
        "/api/products/return",
        { productId: returnProduct._id, quantityReturned: qty, shop_id },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const returnValue = res.data.returnValue || qty * returnProduct.costPrice
      logAndNotify(
        `Returned ${qty} unit(s) of ${returnProduct.name} — ₹${returnValue.toLocaleString()} credited back`,
        "success",
        shop_id
      )
      closeReturnModal()
      onRefresh()
    } catch (err) {
      logError("Failed to return spare", err)
      logAndNotify(err?.response?.data?.error || "Failed to process return.", "error", shop_id)
    } finally {
      setReturning(false)
    }
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-orange-100 to-amber-100 rounded-full mb-6">
          <Package className="h-10 w-10 text-orange-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">No Spares Found</h3>
        <p className="text-gray-600">Add spares to your inventory using the button above.</p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white border border-gray-200 overflow-hidden shadow-lg rounded-xl">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gradient-to-r from-gray-100 to-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                  <div className="flex items-center">
                    <Package className="h-4 w-4 mr-2 text-orange-600" />
                    Spare Name
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">Category</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">Cost Price</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-700 border-b border-gray-300">In Stock</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">Supplier</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">Payment</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product, index) => (
                  <tr
                    key={product._id}
                    className={`hover:bg-orange-50 transition-colors duration-200 ${
                      index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                    }`}
                  >
                    <td className="px-6 py-4 border-b border-gray-200">
                      <span className="font-semibold text-gray-800">{product.name}</span>
                    </td>
                    <td className="px-6 py-4 border-b border-gray-200 text-sm text-gray-600">
                      {product.category || "—"}
                    </td>
                    <td className="px-6 py-4 border-b border-gray-200">
                      <span className="font-semibold text-gray-700">
                        {product.costPrice ? `₹${product.costPrice.toLocaleString("en-IN")}` : "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 border-b border-gray-200 text-center">
                      <span className="text-lg font-bold text-gray-800">{product.quantity}</span>
                    </td>
                    <td className="px-6 py-4 border-b border-gray-200 text-sm text-gray-600">
                      {product.supplierId?.supplierName || product.supplierId?.agencyName || "—"}
                    </td>
                    <td className="px-6 py-4 border-b border-gray-200 text-sm">
                      {product.paymentMethod ? (
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${
                          product.paymentMethod === "credit" ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"
                        }`}>
                          {product.paymentMethod}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 border-b border-gray-200">
                      <button
                        onClick={() => openReturnModal(product)}
                        disabled={product.quantity === 0}
                        className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center space-x-2 shadow hover:shadow-md"
                        title="Return excess stock to supplier"
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span>Return</span>
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Return to Supplier Modal */}
      {showReturnModal && returnProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <RotateCcw className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-lg font-bold text-white">Return to Supplier</h2>
              </div>
              <button onClick={closeReturnModal} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                <X className="h-5 w-5 text-white" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                <p className="text-sm font-semibold text-orange-800">{returnProduct.name}</p>
                <p className="text-xs text-orange-600 mt-1">
                  Current stock: <strong>{returnProduct.quantity} units</strong> · Cost: <strong>₹{returnProduct.costPrice?.toLocaleString()}/unit</strong>
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Return Quantity</label>
                <input
                  type="number"
                  min="1"
                  max={returnProduct.quantity}
                  value={returnQty}
                  onChange={(e) => setReturnQty(e.target.value)}
                  placeholder={`Max ${returnProduct.quantity}`}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all duration-200"
                />
              </div>

              {returnQty && parseInt(returnQty) > 0 && parseInt(returnQty) <= returnProduct.quantity && (
                <div className="bg-green-50 rounded-xl p-3 border border-green-200">
                  <p className="text-sm text-green-800">
                    Return value:{" "}
                    <strong>₹{(parseInt(returnQty) * returnProduct.costPrice).toLocaleString()}</strong>
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Remaining stock after return: {returnProduct.quantity - parseInt(returnQty)} units
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={closeReturnModal}
                  disabled={returning}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReturn}
                  disabled={returning || !returnQty || parseInt(returnQty) <= 0}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl font-semibold transition-all duration-200"
                >
                  {returning ? "Returning..." : "Confirm Return"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default SpareTable

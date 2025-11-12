"use client"

import { useState } from "react"
import api from "../../components/api"
import { ShoppingCart, Package, DollarSign, Hash, PlusCircle } from "lucide-react"
import { logAndNotify, logError } from "@/utils/logger"
import IncreaseStockModal from "./IncreaseStockModal"


const ProductTable = ({ products, onRefresh, shop_id }) => {
  const [sellInputs, setSellInputs] = useState({})
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [showIncreaseStockModal, setShowIncreaseStockModal] = useState(false)


  const handleInputChange = (productId, field, value) => {
    setSellInputs((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value,
      },
    }))
  }


  const handleSell = async (product) => {
    const { qty, amount } = sellInputs[product._id] || {}
    const quantity = Number.parseInt(qty, 10)
    const paidAmount = Number.parseInt(amount, 10)

    if (!quantity || quantity <= 0 || !paidAmount || paidAmount < 0) {
      logAndNotify("Please enter valid quantity and amount.", "warning", shop_id)
      return
    }

    if (quantity > product.quantity) {
      logAndNotify("Quantity exceeds available stock.", "warning", shop_id)
      return
    }

    try {
      const token = localStorage.getItem("token")
      await api.post(
        "/api/products/sell",
        {
          shop_id,
          productId: product._id,
          quantitySold: quantity,
          paidAmount,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      )
      logAndNotify("Product sold successfully!", "success", shop_id)
      onRefresh()
      setSellInputs((prev) => ({ ...prev, [product._id]: {} }))
    } catch (error) {
      logError("Failed to sell product", error)
      logAndNotify("Failed to sell product.", "error", shop_id)
    }
  }

  const handleIncreaseStock = (product) => {
    setSelectedProduct(product)
    setShowIncreaseStockModal(true)
  }


  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full mb-6">
          <Package className="h-10 w-10 text-blue-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">No Products Found</h3>
        <p className="text-gray-600">Start by adding your first product to the inventory.</p>
      </div>
    )
  }


  return (
    <div className="bg-white border border-gray-200 overflow-hidden shadow-lg rounded-xl">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gradient-to-r from-gray-100 to-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                <div className="flex items-center">
                  <Package className="h-4 w-4 mr-2 text-blue-600" />
                  Product Name
                </div>
              </th>
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                <div className="flex items-center">
                  <DollarSign className="h-4 w-4 mr-2 text-green-600" />
                  Selling Price
                </div>
              </th>
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                <div className="flex items-center">
                  <Hash className="h-4 w-4 mr-2 text-purple-600" />
                  In Stock
                </div>
              </th>
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">Sell Qty</th>
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                Paid Amount
              </th>
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">Action</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, index) => {
              const input = sellInputs[product._id] || {}
              const isLowStock = product.quantity <= 5


              return (
                <tr
                  key={product._id}
                  className={`hover:bg-blue-50 transition-colors duration-200 ${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                  }`}
                >
                  <td className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center space-x-2">
                      <div>
                        <div className="font-semibold text-gray-800">{product.name}</div>
                        {product.category && <div className="text-sm text-gray-500 mt-1">{product.category}</div>}
                      </div>
                      <button
                        onClick={() => handleIncreaseStock(product)}
                        className="ml-2 p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all duration-200 group"
                        title="Increase stock"
                      >
                        <PlusCircle className="h-5 w-5 group-hover:scale-110 transition-transform" />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 border-b border-gray-200">
                    <span className="font-semibold text-green-700">
                      {product.sellingPrice ? `₹${product.sellingPrice}` : "-"}
                    </span>
                  </td>
                  <td className="px-6 py-4 border-b border-gray-200">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                        isLowStock
                          ? "bg-red-100 text-red-800"
                          : product.quantity <= 10
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-green-100 text-green-800"
                      }`}
                    >
                      {product.quantity}
                      {isLowStock && <span className="ml-1">⚠️</span>}
                    </span>
                  </td>
                  <td className="px-6 py-4 border-b border-gray-200">
                    <input
                      type="number"
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      value={input.qty || ""}
                      onChange={(e) => handleInputChange(product._id, "qty", e.target.value)}
                      min="1"
                      max={product.quantity}
                      placeholder="0"
                    />
                  </td>
                  <td className="px-6 py-4 border-b border-gray-200">
                    <input
                      type="number"
                      className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                      value={input.amount || ""}
                      onChange={(e) => handleInputChange(product._id, "amount", e.target.value)}
                      placeholder="₹0"
                    />
                  </td>
                  <td className="px-6 py-4 border-b border-gray-200">
                    <button
                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                      onClick={() => handleSell(product)}
                    >
                      <ShoppingCart className="h-4 w-4" />
                      <span>Sell</span>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Increase Stock Modal */}
      {showIncreaseStockModal && selectedProduct && (
        <IncreaseStockModal
          product={selectedProduct}
          shop_id={shop_id}
          onClose={() => {
            setShowIncreaseStockModal(false)
            setSelectedProduct(null)
          }}
          onSuccess={() => {
            setShowIncreaseStockModal(false)
            setSelectedProduct(null)
            onRefresh()
          }}
        />
      )}
    </div>
  )
}


export default ProductTable



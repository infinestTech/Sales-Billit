"use client"

import { useEffect, useState } from "react"
import AddSpareModal from "./AddSpareModal"
import SpareHistoryModal from "./SpareHistoryModal"
import SpareTable from "./SpareTable"
import api from "../../components/api"
import { Plus, History, Search, Package } from "lucide-react"

const SpareInventoryPage = ({ shopId }) => {
  const [products, setProducts] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)

  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await api.post(
        "/api/products/list",
        { shop_id: shopId },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setProducts(response.data.products || [])
    } catch (error) {
      console.error("Error fetching spares:", error)
    }
  }

  const inStockProducts = products.filter((p) => Number(p.quantity) > 0)

  const filteredProducts = searchQuery
    ? inStockProducts.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : inStockProducts

  useEffect(() => {
    if (shopId) fetchProducts()
  }, [shopId])

  return (
    <div className="h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-6 flex-shrink-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-white/20 rounded-xl">
              <Package className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Service Spares Inventory</h2>
              <p className="text-orange-100">Track spare parts — purchases, stock, and supplier returns</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2 backdrop-blur-sm border border-white/20 hover:border-white/30"
            >
              <Plus className="h-5 w-5" />
              <span>Add Spare</span>
            </button>
            <button
              onClick={() => setShowHistoryModal(true)}
              className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2 backdrop-blur-sm border border-white/20 hover:border-white/30"
            >
              <History className="h-5 w-5" />
              <span>View History</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="px-8 py-6 bg-gradient-to-r from-gray-50 to-orange-50 border-b border-gray-200 flex-shrink-0">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative max-w-md flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search spares by name..."
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all duration-200 bg-white shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {searchQuery && (
          <p className="mt-2 text-sm text-gray-600">
            Found {filteredProducts.length} spare{filteredProducts.length !== 1 ? "s" : ""} matching &quot;{searchQuery}&quot;
          </p>
        )}
      </div>

      {/* Spare Table */}
      <div className="flex-1 px-8 py-6 overflow-auto bg-white">
        <SpareTable products={filteredProducts} onRefresh={fetchProducts} shop_id={shopId} />
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddSpareModal
          shop_id={shopId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false)
            fetchProducts()
          }}
        />
      )}

      {showHistoryModal && (
        <SpareHistoryModal
          shop_id={shopId}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </div>
  )
}

export default SpareInventoryPage

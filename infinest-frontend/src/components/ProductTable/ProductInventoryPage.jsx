"use client"


import { useEffect, useState } from "react"
import AddProductModal from "./AddProductModal"
import ProductHistoryModal from "./ProductHistoryModal"
import ProductTable from "./ProductTable"
import api from "../../components/api"
import { Plus, History, Search, Package, AlertTriangle, List } from "lucide-react"
import { useRouter } from "next/navigation"
// AddSupplierModal removed; supplier creation moved to supplier list page


const ProductInventoryPage = ({ shopId }) => {
  const [products, setProducts] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  // supplier modal handled on Supplier List page now
  const router = useRouter()
  const [showLowStockOnly, setShowLowStockOnly] = useState(false)


  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await api.post(
        "/api/products/list",
        { shop_id: shopId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )
      setProducts(response.data.products || [])
    } catch (error) {
      console.error("Error fetching products:", error)
    }
  }


  const filteredProducts = searchQuery
    ? products.filter((product) => product.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : products


  // Further filter by low stock if the toggle is enabled
  const finalFilteredProducts = showLowStockOnly
    ? filteredProducts.filter((product) => product.quantity <= 10) // Show products with 10 or less stock
    : filteredProducts


  const lowStockCount = products.filter((product) => product.quantity <= 10).length


  useEffect(() => {
    if (shopId) fetchProducts()
  }, [shopId])


  return (
    <div className="h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 flex-shrink-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-white/20 rounded-xl">
              <Package className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Product Inventory</h2>
              <p className="text-blue-100">Manage your stock and track sales</p>
            </div>
          </div>


          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2 backdrop-blur-sm border border-white/20 hover:border-white/30"
            >
              <Plus className="h-5 w-5" />
              <span>Add Product</span>
            </button>
            {/* Add Supplier moved to Supplier List page */}
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


      {/* Search Bar */}
      <div className="px-8 py-6 bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-200 flex-shrink-0">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative max-w-md flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search products by name..."
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>


          {/* Low Stock Filter Button */}
          <button
            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center space-x-2 shadow-sm ${
              showLowStockOnly
                ? 'bg-red-600 hover:bg-red-700 text-white border border-red-600'
                : 'bg-white hover:bg-red-50 text-red-600 border border-red-300 hover:border-red-400'
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
            <span>
              {showLowStockOnly ? 'Show All Products' : 'Low Stock Only'}
            </span>
            {lowStockCount > 0 && (
              <span className={`px-2 py-1 text-xs rounded-full font-bold ${
                showLowStockOnly
                  ? 'bg-white/20 text-white'
                  : 'bg-red-100 text-red-800'
              }`}>
                {lowStockCount}
              </span>
            )}
          </button>


          {/* Supplier List Button */}
          {/* <button
            onClick={() => router.push('/supplierlist')}
            className="px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center space-x-2 shadow-sm bg-white hover:bg-blue-50 text-blue-600 border border-blue-300 hover:border-blue-400"
            title="View all suppliers"
          >
            <List className="h-5 w-5" />
            <span>Supplier List</span>
          </button> */}
        </div>
       
        {searchQuery && (
          <p className="mt-2 text-sm text-gray-600">
            Found {finalFilteredProducts.length} product{finalFilteredProducts.length !== 1 ? "s" : ""} matching "{searchQuery}"
            {showLowStockOnly && " with low stock"}
          </p>
        )}
       
        {showLowStockOnly && !searchQuery && (
          <p className="mt-2 text-sm text-red-600 font-medium">
            Showing {finalFilteredProducts.length} product{finalFilteredProducts.length !== 1 ? "s" : ""} with low stock (≤10 items)
          </p>
        )}
      </div>


      {/* Product Table - This will expand to fill remaining space */}
      <div className="flex-1 px-8 py-6 overflow-auto bg-white">
        <ProductTable products={finalFilteredProducts} onRefresh={fetchProducts} shop_id={shopId} />
      </div>


      {/* Modals */}
      {showAddModal && (
        <AddProductModal
          shop_id={shopId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false)
            fetchProducts()
          }}
        />
      )}


      {showHistoryModal && (
        <ProductHistoryModal products={products} shop_id={shopId} onClose={() => setShowHistoryModal(false)} />
      )}


      {/* Supplier modal removed from this page */}
    </div>
  )
}


export default ProductInventoryPage
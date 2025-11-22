"use client"


import { useEffect, useState } from "react"
import { jwtDecode } from "jwt-decode"
import { UserPlus, RefreshCcw, Users } from "lucide-react"
import AddSupplierModal from "@/components/ProductTable/AddSupplierModal"
import SupplierList from "@/components/Supplier/SupplierList"

export default function SupplierListPage() {
  const [shopId, setShopId] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [refreshSignal, setRefreshSignal] = useState(0)
  const triggerRefresh = () => setRefreshSignal((v) => v + 1)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      window.location.href = "/billit-login"
      return
    }
    try {
      const decoded = jwtDecode(token)
      if (decoded?.shop_id) {
        setShopId(decoded.shop_id)
      } else {
        window.location.href = "/billit-login"
      }
    } catch (e) {
      console.error("Failed to decode token", e)
      window.location.href = "/billit-login"
    }
  }, [])

  return (
    <div className="h-screen bg-white flex flex-col">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 flex-shrink-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-white/20 rounded-xl">
              <Users className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Suppliers</h2>
              <p className="text-blue-100">Manage your supplier directory</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2 backdrop-blur-sm border border-white/20 hover:border-white/30"
            >
              <UserPlus className="h-5 w-5" />
              <span>Add Supplier</span>
            </button>
            <button
              onClick={triggerRefresh}
              className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2 backdrop-blur-sm border border-white/20 hover:border-white/30"
            >
              <RefreshCcw className="h-5 w-5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 px-8 py-6 overflow-auto bg-white">
        {shopId && <SupplierList shopId={shopId} refreshSignal={refreshSignal} />}
      </div>
      {showAddModal && shopId && (
        <AddSupplierModal
          shop_id={shopId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false)
            triggerRefresh()
          }}
        />
      )}
    </div>
  )
}







"use client"

import { useEffect, useState } from "react"
import { jwtDecode } from "jwt-decode"
import SupplierList from "@/components/Suppliers/supplierList"

export default function SupplierListPage() {
  const [shopId, setShopId] = useState(null)

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
      localStorage.removeItem("token")
      window.location.href = "/billit-login"
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {shopId ? (
        <SupplierList shopId={shopId} />
      ) : (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full mb-4 animate-spin">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
            <p className="text-lg text-gray-600 font-medium">Loading all records...</p>
          </div>
        </div>
      )}
    </div>
  )
}







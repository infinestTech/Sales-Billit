"use client"

import { useEffect, useState } from "react"
import ProductInventoryPage from "@/components/ProductTable/ProductInventoryPage"
import SpareInventoryPage from "@/components/ProductTable/SpareInventoryPage"
import { jwtDecode } from "jwt-decode"
import { usePlanFeatures } from "@/context/PlanFeatureContext"
import api from "@/components/api"

export default function AllRecordPage() {
  const [shopId, setShopId] = useState(null)
  const [useLegacyUI, setUseLegacyUI] = useState(null) // null = loading
  const { loading } = usePlanFeatures()

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (token) {
      try {
        const decoded = jwtDecode(token)
        if (decoded?.shop_id) {
          setShopId(decoded.shop_id)
          // Fetch which UI mode this shop uses
          api
            .get("/api/shop/product-ui-mode", {
              headers: { Authorization: `Bearer ${token}` },
            })
            .then((res) => setUseLegacyUI(!!res.data.use_legacy_product_ui))
            .catch(() => setUseLegacyUI(false)) // default to new spares UI
        } else {
          console.warn("No shop_id in token")
          window.location.href = "/billit-login"
        }
      } catch (err) {
        console.error("Token decode failed:", err)
        localStorage.removeItem("token")
        window.location.href = "/billit-login"
      }
    } else {
      window.location.href = "/billit-login"
    }
  }, [])

  if (loading || useLegacyUI === null) {
    return <p className="text-center text-gray-500 p-8">Loading...</p>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {shopId ? (
        useLegacyUI ? (
          <ProductInventoryPage shopId={shopId} />
        ) : (
          <SpareInventoryPage shopId={shopId} />
        )
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
            <p className="text-lg text-gray-600 font-medium">Loading your inventory...</p>
          </div>
        </div>
      )}
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import CreateRecordForm from "@/components/createrecord/CreateRecordForm"
import MobileDashboard from "@/components/dashboard/MobileDashboard"
import { jwtDecode } from "jwt-decode"
import { Plus } from "lucide-react"

export default function HomePage() {
  const [shopId, setShopId] = useState(null)
  const [isLimitReached, setIsLimitReached] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)

    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (token) {
      try {
        const decoded = jwtDecode(token)
        if (decoded?.shop_id) {
          setShopId(decoded.shop_id)
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

  // Loading state for both mobile and desktop
  if (!shopId) {
    return (
      <div className="min-h-screen bg-white">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your workspace...</p>
          </div>
        </div>
      </div>
    )
  }

  // Mobile Experience - Show Dashboard
  if (isMobile) {
    return <MobileDashboard shopId={shopId} />
  }

  // Desktop Experience - Original Layout
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-white/20 rounded-xl">
            <Plus className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Create New Record</h2>
            <p className="text-blue-100">Add customer or dealer records with mobile entries</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-6 bg-white">
        <CreateRecordForm shopId={shopId} isLimitReached={isLimitReached} setIsLimitReached={setIsLimitReached} />
      </div>
    </div>
  )
}

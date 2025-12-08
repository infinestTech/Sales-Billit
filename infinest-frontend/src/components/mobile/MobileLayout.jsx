"use client"

import { useState, useEffect } from "react"
import MobileNavigation from "./MobileNavigation"
import MobileRecordForm from "./MobileRecordForm"
import MobileStockManager from "./MobileStockManager"
import MobileExpenses from "./MobileExpenses"
import MobileAnalyticsComprehensive from "./MobileAnalyticsComprehensive"
import MobileBalanceCompact from "./MobileBalanceCompact"
import MobileProfile from "./MobileProfile"
import { usePlanFeatures } from "@/context/PlanFeatureContext"
import { checkFeatureAccess, FEATURE_CONFIG } from "@/utils/featureAccess"
import { createMobileFeatureLockedComponent } from "./MobileFeatureLocked"
import authApi from "../authApi"

export default function MobileLayout({ shopId, isLimitReached, setIsLimitReached }) {
  const [activeView, setActiveView] = useState("records") // Default to records
  const [profileImage, setProfileImage] = useState("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM0Qjc2ODgiLz4KPGNpcmNsZSBjeD0iMjAiIGN5PSIxNiIgcj0iNiIgZmlsbD0iI0Y5RkFGQiIvPgo8cGF0aCBkPSJNMTAgMzJjMC02IDQtMTAgMTAtMTBzMTAgNCAxMCAxMCIgZmlsbD0iI0Y5RkFGQiIvPgo8L3N2Zz4K")
  const [profileName, setProfileName] = useState("User")
  const { features, loading } = usePlanFeatures()

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem("token")
      if (!token) return

      try {
        const res = await authApi.get("/profile/get", {
          headers: { Authorization: `Bearer ${token}` },
        })

        const imageUrl = res.data.imageUrl || "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM0Qjc2ODgiLz4KPGNpcmNsZSBjeD0iMjAiIGN5PSIxNiIgcj0iNiIgZmlsbD0iI0Y5RkFGQiIvPgo8cGF0aCBkPSJNMTAgMzJjMC02IDQtMTAgMTAtMTBzMTAgNCAxMCAxMCIgZmlsbD0iI0Y5RkFGQiIvPgo8L3N2Zz4K"
        const name = res.data.name || "User"
        
        // Fix imageUrl to use correct protocol/domain if it's an absolute URL
        let correctedImageUrl = imageUrl
        if (imageUrl && imageUrl.startsWith('http')) {
          // Replace any https://localhost or https://127.0.0.1 with the correct auth API base URL
          correctedImageUrl = imageUrl.replace(/https?:\/\/(localhost|127\.0\.0\.1):\d+/, process.env.NEXT_PUBLIC_API_URL_AUTH)
          // Only add cache busting to HTTP URLs
          correctedImageUrl = `${correctedImageUrl}?t=${Date.now()}`
        }

        setProfileImage(correctedImageUrl)
        setProfileName(name)
      } catch (err) {
        console.error("❌ Failed to fetch profile:", err.response?.data || err.message)
      }
    }

    fetchProfile()
  }, [])

  const renderActiveView = () => {
    // Check feature access before rendering
    const checkAndRender = (featureConfig, component) => {
      if (!featureConfig) return component // No feature check needed
      
      const isEnabled = features[featureConfig.key]?.enabled
      if (!isEnabled) {
        return createMobileFeatureLockedComponent(
          featureConfig.name,
          featureConfig.description,
          featureConfig.requiredPlans,
          () => window.location.href = '/pricing'
        )
      }
      return component
    }

    switch (activeView) {
      case "records":
        return (
          <MobileRecordForm 
            shopId={shopId} 
            isLimitReached={isLimitReached} 
            setIsLimitReached={setIsLimitReached} 
          />
        )
      case "stock":
        return checkAndRender(
          FEATURE_CONFIG.product_inventory,
          <MobileStockManager shopId={shopId} />
        )
      case "expenses":
        return checkAndRender(
          FEATURE_CONFIG.expense_tracker,
          <MobileExpenses shopId={shopId} />
        )
      case "analytics":
        return checkAndRender(
          FEATURE_CONFIG.dashboard,
          <MobileAnalyticsComprehensive shopId={shopId} />
        )
      case "balance":
        return (
          <div className="p-4">
            <MobileBalanceCompact shopId={shopId} />
          </div>
        )
      case "profile":
        return <MobileProfile shopId={shopId} />
      default:
        return (
          <MobileRecordForm 
            shopId={shopId} 
            isLimitReached={isLimitReached} 
            setIsLimitReached={setIsLimitReached} 
          />
        )
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileNavigation
        activeView={activeView}
        setActiveView={setActiveView}
        profileImage={profileImage}
        profileName={profileName}
        features={features}
        shopId={shopId}
      />
      
      {/* Main Content */}
      <div className="pb-20"> {/* Add bottom padding for navigation */}
        {renderActiveView()}
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import MobileNavigation from "./MobileNavigation"
import MobileRecordForm from "./MobileRecordForm"
import MobileStock from "./stock/MobileStock"
import MobileBalance from "./balance/MobileBalance"
import MobileExpenses from "./expenses/MobileExpenses"
import MobileProfile from "./profile/MobileProfile"
import MobileSuppliers from "./suppliers/MobileSuppliers"
import MobileAttendance from "./attendance/MobileAttendance"
import MobileRegistry from "./registry/MobileRegistry"
import { usePlanFeatures } from "@/context/PlanFeatureContext"
import authApi from "../authApi"

const PLACEHOLDER_AVATAR =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM0Qjc2ODgiLz4KPGNpcmNsZSBjeD0iMjAiIGN5PSIxNiIgcj0iNiIgZmlsbD0iI0Y5RkFGQiIvPgo8cGF0aCBkPSJNMTAgMzJjMC02IDQtMTAgMTAtMTBzMTAgNCAxMCAxMCIgZmlsbD0iI0Y5RkFGQiIvPgo8L3N2Zz4K"

export default function MobileLayout({ shopId, isLimitReached, setIsLimitReached }) {
  const [activeView, setActiveView] = useState("records")
  const [profileImage, setProfileImage] = useState(PLACEHOLDER_AVATAR)
  const [profileName, setProfileName] = useState("User")
  const { features } = usePlanFeatures()

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem("token")
      if (!token) return
      try {
        const res = await authApi.get("/profile/get", {
          headers: { Authorization: `Bearer ${token}` },
        })
        const imageUrl = res.data.imageUrl || PLACEHOLDER_AVATAR
        const name = res.data.name || "User"
        let corrected = imageUrl
        if (imageUrl && imageUrl.startsWith("http")) {
          corrected = imageUrl.replace(
            /https?:\/\/(localhost|127\.0\.0\.1):\d+/,
            process.env.NEXT_PUBLIC_API_URL_AUTH
          )
          corrected = `${corrected}?t=${Date.now()}`
        }
        setProfileImage(corrected)
        setProfileName(name)
      } catch (err) {
        console.error("Failed to fetch profile:", err.response?.data || err.message)
      }
    }
    fetchProfile()
  }, [])

  const renderActiveView = () => {
    switch (activeView) {
      case "records":
        return (
          <MobileRecordForm
            shopId={shopId}
            isLimitReached={isLimitReached}
            setIsLimitReached={setIsLimitReached}
          />
        )
      case "suppliers":
        return <MobileSuppliers shopId={shopId} />
      case "registry":
        return <MobileRegistry shopId={shopId} />
      case "balance":
        return <MobileBalance shopId={shopId} />
      case "stock":
        return <MobileStock shopId={shopId} />
      case "attendance":
        return <MobileAttendance shopId={shopId} />
      case "expenses":
        return <MobileExpenses shopId={shopId} />
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
    <div className="min-h-screen bg-slate-50">
      <MobileNavigation
        activeView={activeView}
        setActiveView={setActiveView}
        profileImage={profileImage}
        profileName={profileName}
        features={features}
        shopId={shopId}
      />
      <div className="pb-20">{renderActiveView()}</div>
    </div>
  )
}

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
  const [useEsslAttendance, setUseEsslAttendance] = useState(false)
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

  // Fetch attendance source (eSSL or built-in)
  useEffect(() => {
    const fetchAttendanceSource = async () => {
      const token = localStorage.getItem("token")
      if (!token) return
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/dashboard/attendance-source`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (res.ok) {
          const data = await res.json()
          setUseEsslAttendance(data.useEsslAttendance === true)
        }
      } catch (err) {
        console.error("Failed to fetch attendance source:", err)
      }
    }
    fetchAttendanceSource()
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
        // When eSSL is active, this tab is hidden; guard against direct access
        if (useEsslAttendance) {
          return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 p-6 text-center">
              <div className="rounded-full bg-indigo-100 p-4">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-indigo-600"><path d="M12 2a10 10 0 0 0-6.88 17.25"/><path d="M12 2a10 10 0 0 1 6.88 17.25"/><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="1"/></svg>
              </div>
              <p className="font-semibold text-slate-700">Biometric Device Active</p>
              <p className="text-sm text-slate-500">
                Attendance is managed by the eSSL M20 biometric device. Contact your shop admin for attendance records.
              </p>
            </div>
          )
        }
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
        useEsslAttendance={useEsslAttendance}
      />
      <div className="pb-20">{renderActiveView()}</div>
    </div>
  )
}

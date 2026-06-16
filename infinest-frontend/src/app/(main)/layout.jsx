"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { jwtDecode } from "jwt-decode"
import { AppSidebar } from "@/components/layout/Sidebar"
import { PlanFeatureProvider } from "@/context/PlanFeatureContext"
import NotificationInbox from "@/components/NotificationInbox"
import NotificationMessage from "@/components/NotificationMessage"
import MobileLayout from "@/components/mobile/MobileLayout"
import { logSystem } from "@/utils/logger"

export default function MainLayout({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [shopId, setShopId] = useState(null)
  const [token, setToken] = useState(null)
  const [refreshNotifications, setRefreshNotifications] = useState(false)
  const [toastData, setToastData] = useState(null)
  const [isMobile, setIsMobile] = useState(false)
  const [isLimitReached, setIsLimitReached] = useState(false)

  const router = useRouter()

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
    try {
      const storedToken = localStorage.getItem("token")
      if (!storedToken) throw new Error("No token found.")

      const decoded = jwtDecode(storedToken)
      const now = Math.floor(Date.now() / 1000)

      if (decoded.exp && decoded.exp < now) {
        throw new Error("Token expired.")
      }

      if (!decoded.shop_id) {
        throw new Error("shop_id missing in token.")
      }

      setToken(storedToken)
      setShopId(decoded.shop_id)
      setIsAuthenticated(true)
      logSystem("MainLayout authenticated with shopId", "INFO", { shopId: decoded.shop_id })
    } catch (err) {
      logSystem("Unauthorized access", "WARN", err.message)
      localStorage.removeItem("token")
      router.replace("/billit-login")
    }
  }, [router])

  // Refresh inbox listener
  useEffect(() => {
    const handleRefresh = () => setRefreshNotifications((prev) => !prev)
    window.addEventListener("refresh-notifications", handleRefresh)
    return () => window.removeEventListener("refresh-notifications", handleRefresh)
  }, [])

  // Global toast listener
  useEffect(() => {
    const handleShowToast = (e) => {
      const { message, type } = e.detail
      setToastData({ message, type })
      const timer = setTimeout(() => {
        setToastData(null)
      }, 3000)
      return () => clearTimeout(timer)
    }

    window.addEventListener("show-notification-toast", handleShowToast)
    return () => window.removeEventListener("show-notification-toast", handleShowToast)
  }, [])

  if (!isAuthenticated) {
    return null // Prevent flicker before redirect
  }

  // Mobile Layout - No sidebar, full screen
  if (isMobile) {
    return (
      <PlanFeatureProvider>
        <div className="bg-white text-black min-h-screen">
          <MobileLayout 
            shopId={shopId} 
            isLimitReached={isLimitReached} 
            setIsLimitReached={setIsLimitReached} 
          />

          {/* Mobile Toast */}
          {toastData && (
            <NotificationMessage message={toastData.message} type={toastData.type} onClose={() => setToastData(null)} />
          )}
        </div>
      </PlanFeatureProvider>
    )
  }

  // Desktop Layout - Original with sidebar
  return (
    <PlanFeatureProvider>
      <div className="bg-white text-black">
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
          <AppSidebar sidebarOpen={true} setSidebarOpen={() => {}} role="user" />

          {/* Main Content */}
          <div className="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
            <main>
              <div className="mx-auto max-w-screen-2xl">{children}</div>
            </main>
          </div>

          {/* Notifications */}
          <NotificationInbox shopId={shopId} token={token} refreshSignal={refreshNotifications} />

          {/* Desktop Toast */}
          {toastData && (
            <NotificationMessage message={toastData.message} type={toastData.type} onClose={() => setToastData(null)} />
          )}
        </div>
      </div>
    </PlanFeatureProvider>
  )
}

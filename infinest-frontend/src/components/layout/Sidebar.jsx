"use client"
import { useState, useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Plus, Database,User, Smartphone, Wallet, Shield, Package, Receipt, X, Power, BarChart3, CalendarCheck } from "lucide-react"
import { usePlanFeatures } from "@/context/PlanFeatureContext"
import authApi from "../authApi"

export function AppSidebar({ sidebarOpen, setSidebarOpen, role }) {
  const pathname = usePathname()
  const trigger = useRef(null)
  const sidebar = useRef(null)
  const { features } = usePlanFeatures()
  const [profileImage, setProfileImage] = useState("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM0Qjc2ODgiLz4KPGNpcmNsZSBjeD0iMjAiIGN5PSIxNiIgcj0iNiIgZmlsbD0iI0Y5RkFGQiIvPgo8cGF0aCBkPSJNMTAgMzJjMC02IDQtMTAgMTAtMTBzMTAgNCAxMCAxMCIgZmlsbD0iI0Y5RkFGQiIvPgo8L3N2Zz4K")
  const [profileName, setProfileName] = useState("User")
  const [isHovered, setIsHovered] = useState(false)
  const [shopId, setShopId] = useState(null)
  const [revenueVisible, setRevenueVisible] = useState(true)

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem("token")
      if (!token) return

      try {
        // Extract shopId from token
        const { jwtDecode } = await import("jwt-decode");
        const decoded = jwtDecode(token);
        setShopId(decoded?.shop_id || null);

        // Fetch revenue visibility setting
        try {
          const rvRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/dashboard/revenue-visibility`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (rvRes.ok) {
            const rvData = await rvRes.json();
            setRevenueVisible(rvData.revenueVisible !== false);
          }
        } catch (rvErr) {
          console.error("Failed to check revenue visibility:", rvErr);
        }

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
        localStorage.setItem("profileImage", correctedImageUrl)
        localStorage.setItem("profileName", name)
      } catch (err) {
        console.error("❌ Failed to fetch profile:", err.response?.data || err.message)
      }
    }

    fetchProfile()
  }, [])

  useEffect(() => {
    const handleStorageChange = () => {
      let updatedImage = localStorage.getItem("profileImage") || "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM0Qjc2ODgiLz4KPGNpcmNsZSBjeD0iMjAiIGN5PSIxNiIgcj0iNiIgZmlsbD0iI0Y5RkFGQiIvPgo8cGF0aCBkPSJNMTAgMzJjMC02IDQtMTAgMTAtMTBzMTAgNCAxMCAxMCIgZmlsbD0iI0Y5RkFGQiIvPgo8L3N2Zz4K"
      const updatedName = localStorage.getItem("profileName") || "User"
      
      // Fix imageUrl to use correct protocol/domain if it's an absolute URL  
      if (updatedImage && updatedImage.startsWith('http')) {
        updatedImage = updatedImage.replace(/https?:\/\/(localhost|127\.0\.0\.1):\d+/, process.env.NEXT_PUBLIC_API_URL_AUTH)
        // Only add cache busting to HTTP URLs
        updatedImage = `${updatedImage}?t=${Date.now()}`
      }
      
      setProfileImage(updatedImage)
      setProfileName(updatedName)
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [])

  const handleSignOut = async (e) => {
    e.stopPropagation()

    if (window.confirm("Are you sure you want to sign out?")) {
      try {
        // ✅ Call logout endpoint to invalidate session
        const token = localStorage.getItem("token")
        if (token) {
          await fetch(`${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/logout`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json"
            }
          })
        }
      } catch (error) {
        console.error("Logout error:", error)
        // Continue with logout even if API call fails
      } finally {
        // Clear local storage
        localStorage.removeItem("token")
        localStorage.removeItem("authToken")
        localStorage.removeItem("userRole")
        localStorage.removeItem("profileImage")
        localStorage.removeItem("profileName")

        window.location.href = "/billit-login"
        window.history.replaceState(null, "", "/billit-login")
      }
    }
  }

  const handleProfileClick = () => {
    setSidebarOpen(false)
    window.location.href = "/profile"
  }

  // Helper function to get shop ID for notifications
  const getShopIdForNotifications = () => {
    return shopId;
  }

  const navigationItems = [
    { title: "Create", url: "/application", icon: Plus },
    { title: "All Records", url: "/allrecord", icon: Database },
        { title: "Supplier", url: "/supplier", icon: User },
    { title: "Mobile Registry", url: "/mobilename", icon: Smartphone },
    { title: "Balance Summary", url: "/balanceamount", icon: Wallet },
    ...(revenueVisible ? [{ title: "Analytics Dashboard", url: "/analytics", icon: BarChart3, featureKey: "analytics_dashboard_enabled" }] : []),
    ...(role === "admin" ? [{ title: "Admin Dashboard", url: "/admin-dashboard", icon: Shield }] : []),
    { title: "Service Inventory", url: "/product", icon: Package, featureKey: "product_inventory_enabled" },
     { title: "Attendance", url: "/attendance", icon: CalendarCheck },
    { title: "Expenses", url: "/todayexpenses", icon: Receipt, featureKey: "expense_tracker_enabled" },
  ]

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        sidebar.current &&
        !sidebar.current.contains(e.target) &&
        trigger.current &&
        !trigger.current.contains(e.target)
      ) {
        setSidebarOpen(false)
      }
    }

    document.addEventListener("click", handleClickOutside)
    return () => document.removeEventListener("click", handleClickOutside)
  }, [setSidebarOpen])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setSidebarOpen(false)
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [setSidebarOpen])

  return (
    <>
      <aside
        ref={sidebar}
        className={`fixed left-0 top-0 z-50 flex h-screen w-80 flex-col overflow-y-auto overflow-x-hidden bg-gradient-to-b from-gray-900 via-gray-900 to-black shadow-2xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 border-r border-gray-700/50 backdrop-blur-xl scrollbar-hide ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        {/* Header */}
        <div className="relative z-10 flex items-center justify-between border-b border-gray-700/50 bg-gray-900/80 backdrop-blur-xl px-8 py-6">
          <Link href="/" className="flex items-center group">
            <div className="relative">
              <span className="text-7xl font-black bg-gradient-to-r from-blue-300 via-indigo-300 to-blue-400 bg-clip-text text-transparent tracking-wide group-hover:from-blue-200 group-hover:to-indigo-200 transition-all duration-300 drop-shadow-lg">
                Fixel
              </span>
            </div>
          </Link>
          <button
            ref={trigger}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden text-gray-400 hover:text-white hover:bg-gray-700/50 p-2 rounded-lg transition-all duration-200 backdrop-blur-sm border border-gray-700/30 hover:border-gray-600/50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="relative z-10 flex-1 px-6 py-6">
          <ul className="space-y-2">
            {navigationItems.map((item) => {
              const isActive = item.url === "/" ? pathname === "/" : pathname.startsWith(item.url)
              // All features are available during 10-day trial
              const featureEnabled = true
              const showLock = false

              return (
                <li key={item.title}>
                  <Link
                    href={item.url}
                    onClick={() => setSidebarOpen(false)}
                    className={`group relative flex items-center space-x-4 rounded-xl px-4 py-3.5 transition-all duration-300 font-medium overflow-hidden ${isActive
                        ? "bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-white shadow-lg backdrop-blur-sm border border-blue-400/30 transform scale-[1.02]"
                        : "text-gray-300 hover:text-white hover:bg-gray-800/50 hover:backdrop-blur-sm hover:border-gray-600/30 border border-transparent"
                      }`}
                  >
                    <div
                      className={`relative z-10 p-2 rounded-lg transition-all duration-300 ${isActive
                          ? "bg-gradient-to-r from-blue-500/30 to-indigo-500/30 shadow-lg"
                          : "group-hover:bg-gray-700/50"
                        }`}
                    >
                      <item.icon
                        className={`h-5 w-5 transition-all duration-300 ${isActive ? "text-blue-300 drop-shadow-sm" : "text-gray-400 group-hover:text-blue-300"
                          }`}
                      />
                    </div>
                    <span
                      className={`relative z-10 text-base transition-all duration-300 ${isActive ? "text-white font-semibold" : "group-hover:text-white"
                        }`}
                    >
                      {item.title}
                    </span>
                    {showLock && <Lock className="h-4 w-4 text-yellow-400" />}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Profile Section */}
        <div className="relative z-10 p-6">
          <div className="relative group">
            {/* Main Profile Card */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800/50 via-slate-700/30 to-slate-900/50 backdrop-blur-xl border border-slate-600/30 shadow-2xl">
              {/* Floating Orbs */}
              <div className="absolute top-2 right-2 w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              <div className="absolute bottom-3 left-3 w-1 h-1 bg-purple-400 rounded-full animate-ping"></div>

              {/* Content */}
              <div className="relative p-4">
                <div className="flex items-center justify-between">
                  {/* Profile Section */}
                  <button
                    onClick={handleProfileClick}
                    className="flex items-center space-x-3 hover:scale-105 transition-transform duration-300"
                  >
                    <div className="relative">
                      <img
                        src={profileImage || "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM0Qjc2ODgiLz4KPGNpcmNsZSBjeD0iMjAiIGN5PSIxNiIgcj0iNiIgZmlsbD0iI0Y5RkFGQiIvPgo8cGF0aCBkPSJNMTAgMzJjMC02IDQtMTAgMTAtMTBzMTAgNCAxMCAxMCIgZmlsbD0iI0Y5RkFGQiIvPgo8L3N2Zz4K"}
                        alt="Profile"
                        className="w-12 h-12 rounded-full object-cover border-2 border-slate-500/50 hover:border-blue-400/70 transition-all duration-300 shadow-lg"
                        onError={(e) => {
                          e.target.onerror = null; // Prevent infinite loop
                          e.target.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM0Qjc2ODgiLz4KPGNpcmNsZSBjeD0iMjAiIGN5PSIxNiIgcj0iNiIgZmlsbD0iI0Y5RkFGQiIvPgo8cGF0aCBkPSJNMTAgMzJjMC02IDQtMTAgMTAtMTBzMTAgNCAxMCAxMCIgZmlsbD0iI0Y5RkFGQiIvPgo8L3N2Zz4K"
                        }}
                      />
                    </div>

                    {/* User Info */}
                    <div className="text-left">
                      <div className="text-white font-medium text-sm hover:text-blue-300 transition-colors">
                        {profileName}
                      </div>
                    </div>
                  </button>

                  {/* Logout Button */}
                  <button
                    onClick={handleSignOut}
                    className="p-3 rounded-xl bg-slate-700/30 border border-slate-600/30 hover:bg-red-500/10 hover:border-red-400/20 transition-all duration-300"
                  >
                    <Power className="h-5 w-5 text-slate-400 hover:text-red-400 transition-colors duration-300" />
                  </button>
                </div>

                {/* Bottom Accent Line */}
                <div className="mt-3 h-0.5 bg-gradient-to-r from-transparent via-blue-400/50 to-transparent"></div>
              </div>
            </div>

            {/* Floating Action Indicator */}
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full opacity-60">
              <div className="w-full h-full bg-white/30 rounded-full animate-ping"></div>
            </div>
          </div>
        </div>
      </aside>

      <style jsx global>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </>
  )
}

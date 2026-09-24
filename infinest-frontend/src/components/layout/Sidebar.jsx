"use client"
import { useState, useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Plus, Database, User, Smartphone, Wallet, Shield, Package, Receipt, Power, BarChart3, RotateCcw, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { usePlanFeatures } from "@/context/PlanFeatureContext"
import authApi from "../authApi"

const DEFAULT_WIDTH = 320
const MIN_WIDTH = 240
const MAX_WIDTH = 440
// Releasing a drag narrower than this hides the sidebar completely
const COLLAPSE_AT = 170
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

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
    {
      group: "Records & Repairs",
      icon: Database,
      items: [
        { title: "All Records", url: "/allrecord", icon: Database },
        { title: "Rework", url: "/rework", icon: RotateCcw },
        { title: "Mobile Registry", url: "/mobilename", icon: Smartphone },
      ],
    },
    {
      group: "Suppliers & Inventory",
      icon: Package,
      items: [
        { title: "Supplier", url: "/supplier", icon: User },
        { title: "Service Inventory", url: "/product", icon: Package, featureKey: "product_inventory_enabled" },
      ],
    },
    ...(revenueVisible ? [{ title: "Analytics Dashboard", url: "/analytics", icon: BarChart3, featureKey: "analytics_dashboard_enabled" }] : []),
    ...(role === "admin" ? [{ title: "Admin Dashboard", url: "/admin-dashboard", icon: Shield }] : []),
    {
      group: "Finance",
      icon: Wallet,
      items: [
        { title: "Balance Summary", url: "/balanceamount", icon: Wallet },
        { title: "Expenses", url: "/todayexpenses", icon: Receipt, featureKey: "expense_tracker_enabled" },
      ],
    },
  ]

  // Groups auto-expand once when the active route falls inside them; users can still toggle freely afterwards
  const [openGroups, setOpenGroups] = useState({})
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev }
      navigationItems.forEach((entry) => {
        if (entry.group && entry.items.some((it) => pathname.startsWith(it.url))) {
          next[entry.group] = true
        }
      })
      return next
    })
  }, [pathname])

  const toggleGroup = (name) => setOpenGroups((prev) => ({ ...prev, [name]: !prev[name] }))

  // ---- Resizable / collapsible sidebar ----
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [collapsed, setCollapsed] = useState(false)
  const [dragWidth, setDragWidth] = useState(null) // non-null only while dragging
  const dragState = useRef({ active: false, moved: false, startX: 0, last: 0, fromTab: false })
  const prefsLoaded = useRef(false)

  useEffect(() => {
    try {
      const savedWidth = Number(localStorage.getItem("sidebar_width"))
      if (savedWidth) setWidth(clamp(savedWidth, MIN_WIDTH, MAX_WIDTH))
      setCollapsed(localStorage.getItem("sidebar_collapsed") === "1")
    } catch {}
    prefsLoaded.current = true
  }, [])

  useEffect(() => {
    if (!prefsLoaded.current) return
    try {
      localStorage.setItem("sidebar_width", String(width))
      localStorage.setItem("sidebar_collapsed", collapsed ? "1" : "0")
    } catch {}
  }, [width, collapsed])

  const startDrag = (e, fromTab = false) => {
    e.preventDefault()
    const initial = fromTab ? 0 : width
    dragState.current = { active: true, moved: false, startX: e.clientX, last: initial, fromTab }
    setDragWidth(initial)
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"

    const onMove = (ev) => {
      const s = dragState.current
      if (!s.active) return
      if (Math.abs(ev.clientX - s.startX) > 4) s.moved = true
      s.last = clamp(ev.clientX, 0, MAX_WIDTH)
      setDragWidth(s.last)
    }
    const onUp = () => {
      const s = dragState.current
      s.active = false
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""

      if (s.fromTab && !s.moved) {
        // Plain click on the pull tab: restore the last width
        setCollapsed(false)
      } else if (s.moved) {
        if (s.last < COLLAPSE_AT) {
          setCollapsed(true)
        } else {
          setCollapsed(false)
          setWidth(clamp(s.last, MIN_WIDTH, MAX_WIDTH))
        }
      }
      setDragWidth(null)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  const isDragging = dragWidth !== null
  const displayWidth = isDragging ? dragWidth : collapsed ? 0 : width
  // Inner panel keeps a usable width and is right-anchored, so shrinking the wrapper reads as a slide
  const innerWidth = isDragging ? clamp(dragWidth, MIN_WIDTH, MAX_WIDTH) : width
  const willCollapse = isDragging && dragWidth < COLLAPSE_AT
  const compact = innerWidth < 300

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
      <div
        className={`relative h-screen flex-shrink-0 overflow-hidden ${isDragging ? "" : "transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"}`}
        style={{ width: displayWidth }}
      >
      <aside
        ref={sidebar}
        className={`absolute right-0 top-0 flex h-screen flex-col overflow-y-auto overflow-x-hidden bg-gradient-to-b from-gray-900 via-gray-900 to-black shadow-2xl border-r border-gray-700/50 backdrop-blur-xl scrollbar-hide transition-opacity duration-200 ${willCollapse ? "opacity-60" : "opacity-100"}`}
        style={{ width: innerWidth }}
      >
        {/* Header */}
        <div className={`relative z-10 flex items-center justify-between border-b border-gray-700/50 bg-gray-900/80 backdrop-blur-xl py-6 ${compact ? "px-6" : "px-8"}`}>
          <Link href="/" className="flex items-center group">
            <div className="relative">
              <span className={`${compact ? "text-5xl" : "text-7xl"} font-black bg-gradient-to-r from-blue-300 via-indigo-300 to-blue-400 bg-clip-text text-transparent tracking-wide group-hover:from-blue-200 group-hover:to-indigo-200 transition-all duration-300 drop-shadow-lg`}>
                Fixel
              </span>
            </div>
          </Link>
          <button
            ref={trigger}
            onClick={() => setCollapsed(true)}
            title="Hide sidebar"
            className="text-gray-400 hover:text-white hover:bg-gray-700/50 p-2 rounded-lg transition-all duration-200 backdrop-blur-sm border border-gray-700/30 hover:border-gray-600/50"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="relative z-10 flex-1 px-6 py-6">
          <ul className="space-y-2">
            {navigationItems.map((entry) => {
              if (entry.group) {
                const isOpen = !!openGroups[entry.group]
                const groupActive = entry.items.some((it) => pathname.startsWith(it.url))

                return (
                  <li key={entry.group}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(entry.group)}
                      className={`group flex w-full items-center space-x-4 rounded-xl px-4 py-3.5 transition-all duration-300 font-medium ${groupActive
                          ? "text-white"
                          : "text-gray-300 hover:text-white hover:bg-gray-800/50 border border-transparent"
                        }`}
                    >
                      <div className={`relative z-10 p-2 rounded-lg transition-all duration-300 ${groupActive ? "bg-gradient-to-r from-blue-500/30 to-indigo-500/30 shadow-lg" : "group-hover:bg-gray-700/50"}`}>
                        <entry.icon className={`h-5 w-5 ${groupActive ? "text-blue-300" : "text-gray-400 group-hover:text-blue-300"}`} />
                      </div>
                      <span className="flex-1 truncate text-left text-base">{entry.group}</span>
                      <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isOpen && (
                      <ul className="mt-1 space-y-1 border-l border-gray-700/50 pl-4 ml-5">
                        {entry.items.map((item) => {
                          const isActive = pathname.startsWith(item.url)
                          return (
                            <li key={item.title}>
                              <Link
                                href={item.url}
                                onClick={() => setSidebarOpen(false)}
                                className={`group relative flex items-center space-x-3 rounded-lg px-3 py-2.5 transition-all duration-300 font-medium ${isActive
                                    ? "bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-white border border-blue-400/30"
                                    : "text-gray-400 hover:text-white hover:bg-gray-800/50 border border-transparent"
                                  }`}
                              >
                                <item.icon className={`h-4 w-4 ${isActive ? "text-blue-300" : "text-gray-500 group-hover:text-blue-300"}`} />
                                <span className="text-sm">{item.title}</span>
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </li>
                )
              }

              const isActive = entry.url === "/" ? pathname === "/" : pathname.startsWith(entry.url)

              return (
                <li key={entry.title}>
                  <Link
                    href={entry.url}
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
                      <entry.icon
                        className={`h-5 w-5 transition-all duration-300 ${isActive ? "text-blue-300 drop-shadow-sm" : "text-gray-400 group-hover:text-blue-300"
                          }`}
                      />
                    </div>
                    <span
                      className={`relative z-10 text-base transition-all duration-300 ${isActive ? "text-white font-semibold" : "group-hover:text-white"
                        }`}
                    >
                      {entry.title}
                    </span>
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

        {/* Drag handle on the right edge */}
        <div
          onPointerDown={(e) => startDrag(e)}
          onDoubleClick={() => setWidth(DEFAULT_WIDTH)}
          title="Drag to resize • double-click to reset"
          className="group/handle absolute right-0 top-0 z-20 flex h-full w-2 cursor-col-resize touch-none justify-end"
        >
          <div
            className={`h-full w-0.5 transition-colors duration-150 ${
              isDragging ? (willCollapse ? "bg-red-400/80" : "bg-blue-400") : "bg-transparent group-hover/handle:bg-blue-400/60"
            }`}
          />
        </div>
      </div>

      {/* Pull-out tab shown while the sidebar is hidden (click or drag it outward) */}
      <button
        type="button"
        onPointerDown={(e) => startDrag(e, true)}
        title="Show sidebar"
        aria-label="Show sidebar"
        className={`fixed left-0 top-1/2 z-50 flex h-16 w-5 -translate-y-1/2 cursor-col-resize touch-none items-center justify-center rounded-r-lg border border-l-0 border-gray-700/60 bg-gradient-to-b from-gray-900 to-black text-gray-400 shadow-lg transition-all duration-300 hover:w-7 hover:text-white ${
          collapsed && !isDragging ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-full opacity-0"
        }`}
      >
        <ChevronRight className="h-4 w-4" />
      </button>

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

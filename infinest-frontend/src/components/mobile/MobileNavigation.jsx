"use client"

import { useState } from "react"
import {
  Plus,
  Database,
  User,
  Smartphone,
  Wallet,
  Package,
  CalendarCheck,
  Receipt,
  Menu,
  X,
  LogOut,
} from "lucide-react"

// Order matches the desktop sidebar (Sidebar.jsx)
const NAV_ITEMS = [
  { id: "records", label: "Create", icon: Plus, description: "Create / All Records" },
  { id: "suppliers", label: "Supplier", icon: User, description: "Suppliers & dues" },
  { id: "registry", label: "Mobile Registry", icon: Smartphone, description: "All devices" },
  { id: "balance", label: "Balance Summary", icon: Wallet, description: "Outstanding balances" },
  { id: "stock", label: "Service Inventory", icon: Package, description: "Inventory & history" },
  { id: "attendance", label: "Attendance", icon: CalendarCheck, description: "Employee attendance" },
  { id: "expenses", label: "Expenses", icon: Receipt, description: "Track expenses" },
]

// 5 most-used quick taps for the bottom bar
const BOTTOM_TABS = [
  { id: "records", label: "Home", icon: Plus },
  { id: "balance", label: "Balance", icon: Wallet },
  { id: "stock", label: "Stock", icon: Package },
  { id: "attendance", label: "Staff", icon: CalendarCheck },
  { id: "expenses", label: "Costs", icon: Receipt },
]

export default function MobileNavigation({
  activeView,
  setActiveView,
  profileImage,
  profileName,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const go = (id) => {
    setActiveView(id)
    setIsMenuOpen(false)
  }

  const handleSignOut = async () => {
    if (!window.confirm("Sign out?")) return
    try {
      const token = localStorage.getItem("token")
      if (token) {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }).catch(() => {})
      }
    } finally {
      localStorage.removeItem("token")
      localStorage.removeItem("authToken")
      localStorage.removeItem("userRole")
      localStorage.removeItem("profileImage")
      localStorage.removeItem("profileName")
      window.location.href = "/billit-login"
    }
  }

  const activeMeta =
    NAV_ITEMS.find((i) => i.id === activeView) ||
    (activeView === "profile" ? { label: "Profile", description: "Account & settings" } : null)

  return (
    <>
      {/* Top header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMenuOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div>
              <h1 className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
                Fixel
              </h1>
              <p className="text-[11px] text-slate-500">
                {activeMeta?.description || "Mobile Dashboard"}
              </p>
            </div>
          </div>
          <button
            onClick={() => go("profile")}
            className="rounded-full ring-2 ring-transparent transition-all hover:ring-indigo-300"
            aria-label="Profile"
          >
            <img
              src={profileImage}
              alt={profileName}
              className="h-9 w-9 rounded-full border-2 border-slate-200 object-cover"
              onError={(e) => {
                e.target.onerror = null
                e.target.src =
                  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM0Qjc2ODgiLz4KPGNpcmNsZSBjeD0iMjAiIGN5PSIxNiIgcj0iNiIgZmlsbD0iI0Y5RkFGQiIvPgo8cGF0aCBkPSJNMTAgMzJjMC02IDQtMTAgMTAtMTBzMTAgNCAxMCAxMCIgZmlsbD0iI0Y5RkFGQiIvPgo8L3N2Zz4K"
              }}
            />
          </button>
        </div>
      </header>

      {/* Drawer overlay */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* Side drawer */}
      <aside
        className={`fixed left-0 top-0 z-40 flex h-full w-72 flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-slate-100 shadow-2xl transition-transform duration-300 ease-out ${
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-base font-black text-white shadow-lg">
              F
            </div>
            <span className="bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-2xl font-black tracking-tight text-transparent">
              Fixel
            </span>
          </div>
          <button
            onClick={() => setIsMenuOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Profile card */}
        <button
          onClick={() => go("profile")}
          className={`mx-3 mt-3 flex items-center gap-3 rounded-xl border border-white/10 px-3 py-3 text-left transition-colors ${
            activeView === "profile"
              ? "bg-gradient-to-r from-indigo-500/30 to-violet-500/30"
              : "bg-white/5 hover:bg-white/10"
          }`}
        >
          <img
            src={profileImage}
            alt={profileName}
            className="h-11 w-11 rounded-full border-2 border-white/20 object-cover"
            onError={(e) => {
              e.target.onerror = null
              e.target.src =
                "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM0Qjc2ODgiLz4KPGNpcmNsZSBjeD0iMjAiIGN5PSIxNiIgcj0iNiIgZmlsbD0iI0Y5RkFGQiIvPgo8cGF0aCBkPSJNMTAgMzJjMC02IDQtMTAgMTAtMTBzMTAgNCAxMCAxMCIgZmlsbD0iI0Y5RkFGQiIvPgo8L3N2Zz4K"
            }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{profileName}</p>
            <p className="text-[11px] text-slate-400">View profile & settings</p>
          </div>
        </button>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Workspace
          </p>
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const active = activeView === item.id
              return (
                <li key={item.id}>
                  <button
                    onClick={() => go(item.id)}
                    className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                      active
                        ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-900/40"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        active ? "bg-white/20" : "bg-white/5 group-hover:bg-white/10"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight">{item.label}</p>
                      <p
                        className={`truncate text-[10px] leading-tight ${
                          active ? "text-white/80" : "text-slate-500"
                        }`}
                      >
                        {item.description}
                      </p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Sign out */}
        <div className="border-t border-white/10 p-3">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-rose-300 hover:bg-rose-500/10"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="grid grid-cols-5">
          {BOTTOM_TABS.map((tab) => {
            const Icon = tab.icon
            const active = activeView === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => go(tab.id)}
                className={`relative flex flex-col items-center justify-center py-2 transition-colors ${
                  active ? "text-indigo-600" : "text-slate-500"
                }`}
              >
                {active && (
                  <span className="absolute top-0 h-0.5 w-10 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
                )}
                <Icon className={`mb-0.5 h-5 w-5 ${active ? "text-indigo-600" : "text-slate-500"}`} />
                <span className="text-[10px] font-medium leading-none">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}

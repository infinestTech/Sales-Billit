"use client"
import { useEffect, useState } from "react"
import axios from "axios"
import { Store, Loader2 } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || "http://localhost:8000"

// Combo-plan only (the server decides; renders nothing otherwise): swaps the Service session for a Shop Admin session and opens the Sales section,
// so the owner never has to sign in a second time. The server re-checks the plan.
export default function SwitchToSalesButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [eligible, setEligible] = useState(false)

  useEffect(() => {
    let alive = true
    axios
      .get(`${API_URL}/api/shop-admin/sso/from-service/eligible`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })
      .then((res) => { if (alive) setEligible(!!res.data?.eligible) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const handleSwitch = async () => {
    if (loading) return
    setLoading(true)
    setError("")
    try {
      const res = await axios.post(
        `${API_URL}/api/shop-admin/sso/from-service`,
        {},
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      )
      const { token, shopAdmin } = res.data
      localStorage.setItem("shopAdminToken", token)
      localStorage.setItem("shopAdminInfo", JSON.stringify(shopAdmin))
      localStorage.setItem("currentShopId", shopAdmin.current_shop_id)
      window.location.href = "/shop-admin/dashboard?tab=sales-inventory"
    } catch (err) {
      setError(err?.response?.data?.message || "Could not open Sales. Please try again.")
      setLoading(false)
      setTimeout(() => setError(""), 4000)
    }
  }

  if (!eligible) return null

  return (
    <div className="fixed bottom-20 left-3 z-30 md:bottom-auto md:left-auto md:right-6 md:top-4">
      <button
        type="button"
        onClick={handleSwitch}
        disabled={loading}
        className="flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:from-indigo-500 hover:to-violet-500 disabled:opacity-70"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}
        {loading ? "Opening Sales…" : "Switch to Sales"}
      </button>
      {error && (
        <div className="mt-2 max-w-xs rounded-lg bg-red-600 px-3 py-2 text-xs text-white shadow-lg">{error}</div>
      )}
    </div>
  )
}

"use client"
import { useEffect, useState } from "react"
import axios from "axios"
import { Store, Loader2, X } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || "http://localhost:8000"
const SALES_URL = (process.env.NEXT_PUBLIC_SALES_FRONTEND_URL || "http://localhost:3020").replace(/\/+$/, "")

// Combo-plan only (the server decides; renders nothing otherwise): opens the Sales branch portal
// (POS) already signed in, so the owner never logs in a second time. A shop with several branches
// picks one first; the server hands back a 60-second one-time code that the branch portal exchanges
// for its normal branch session.
export default function SwitchToSalesButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [eligible, setEligible] = useState(false)
  const [branches, setBranches] = useState(null)

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

  const handleSwitch = async (branchId) => {
    if (loading) return
    setLoading(true)
    setError("")
    try {
      const res = await axios.post(
        `${API_URL}/api/shop-admin/sso/from-service`,
        branchId ? { branch_id: branchId } : {},
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      )
      if (res.data.needsBranch) {
        setBranches(res.data.branches || [])
        setLoading(false)
        return
      }
      window.location.href = `${SALES_URL}/?sso=${encodeURIComponent(res.data.code)}#product-sales`
    } catch (err) {
      setError(err?.response?.data?.message || "Could not open Sales. Please try again.")
      setLoading(false)
      setTimeout(() => setError(""), 5000)
    }
  }

  if (!eligible) return null

  return (
    <div className="fixed bottom-20 left-3 z-30 md:bottom-auto md:left-auto md:right-6 md:top-4">
      <button
        type="button"
        onClick={() => handleSwitch()}
        disabled={loading}
        className="flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:from-indigo-500 hover:to-violet-500 disabled:opacity-70"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}
        {loading ? "Opening Sales…" : "Switch to Sales"}
      </button>

      {error && (
        <div className="mt-2 max-w-xs rounded-lg bg-red-600 px-3 py-2 text-xs text-white shadow-lg">{error}</div>
      )}

      {branches && (
        <div className="mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 text-slate-800 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">Open which branch?</span>
            <button type="button" onClick={() => setBranches(null)} aria-label="Close" className="text-slate-400 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {branches.map((b) => (
              <button
                key={b.id}
                type="button"
                disabled={loading}
                onClick={() => handleSwitch(b.id)}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-indigo-50 disabled:opacity-60"
              >
                <span className="block font-medium">{b.name}</span>
                {b.address ? <span className="block truncate text-xs text-slate-500">{b.address}</span> : null}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

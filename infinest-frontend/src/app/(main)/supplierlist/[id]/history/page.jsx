"use client"


import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { jwtDecode } from "jwt-decode"
import api from "@/components/api"


export default function SupplierHistoryPage() {
  const params = useParams()
  const router = useRouter()
  const supplierId = params?.id


  const [shopId, setShopId] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")


  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!token) {
      router.push("/billit-login")
      return
    }
    try {
      const decoded = jwtDecode(token)
      if (decoded?.shop_id) {
        setShopId(decoded.shop_id)
      } else {
        router.push("/billit-login")
      }
    } catch (e) {
      router.push("/billit-login")
    }
  }, [router])


  useEffect(() => {
    const fetchHistory = async () => {
      if (!shopId || !supplierId) return
      setLoading(true)
      setError("")
      try {
        const token = localStorage.getItem("token")
        const res = await api.post(
          "/api/suppliers/history",
          { shop_id: shopId, supplierId },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        setItems(res?.data?.items || [])
      } catch (err) {
        setError("Failed to load history")
        console.error("Supplier history error", err)
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [shopId, supplierId])


  return (
    <div className="min-h-screen bg-white">
      <div className="px-6 py-4 border-b flex items-center gap-3">
        <button
          onClick={() => router.push("/supplierlist")}
          className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
        >
          ← Back
        </button>
        <h1 className="text-xl font-semibold">Supplier History</h1>
      </div>


      <div className="p-6">
        {loading ? (
          <div className="text-gray-600">Loading history…</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : items.length === 0 ? (
          <div className="text-gray-600">No history found.</div>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Product</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Quantity</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Cost Price</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Total</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Payment</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Message</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-4 py-3 text-gray-700 capitalize">{(it.type || '').toLowerCase()}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {it.date ? new Date(it.date).toLocaleString("en-IN") : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-800 font-medium">{it.productName || "-"}</td>
                    <td className="px-4 py-3 text-gray-700">{it.quantity}</td>
                    <td className="px-4 py-3 text-gray-700">₹{Number(it.costPrice || 0).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-gray-900 font-semibold">₹{Number(it.total || 0).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-gray-700 capitalize">{it.paymentMethod || "-"}</td>
                    <td className="px-4 py-3 text-gray-700">{it.message || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}





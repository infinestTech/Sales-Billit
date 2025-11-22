"use client"

import { useEffect, useState } from "react"
import api from "../api"
import { Search, Users } from "lucide-react"
import { useRouter } from "next/navigation"

// Reusable supplier list table component
// Props: shopId (required)
//        refreshSignal (number) - change value to force refetch
const SupplierList = ({ shopId, refreshSignal = 0 }) => {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [editId, setEditId] = useState(null)
  const [editAmount, setEditAmount] = useState("") // adjustment amount
  const [editPM, setEditPM] = useState("cash")
  const [editMsg, setEditMsg] = useState("") // message / product note
  const [editMode, setEditMode] = useState("credit") // credit adds, debt subtracts
  const [originalTotal, setOriginalTotal] = useState(0)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const fetchSuppliers = async () => {
    if (!shopId) return
    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      const res = await api.post(
        "/api/suppliers/list",
        { shop_id: shopId },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      setSuppliers(res.data.suppliers || [])
    } catch (err) {
      console.error("Failed to load suppliers", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSuppliers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, refreshSignal])

  const openEdit = (s) => {
    setEditId(s._id)
    setOriginalTotal(Number(s.totalAmount || 0))
    setEditAmount("")
    setEditPM((s.lastPaymentMethod || "cash").toLowerCase())
    setEditMsg("")
    setEditMode("credit")
  }

  const closeEdit = () => {
    setEditId(null)
    setEditAmount("")
    setEditPM("cash")
    setEditMsg("")
    setEditMode("credit")
    setOriginalTotal(0)
  }

  const saveEdit = async () => {
    if (!editId || !shopId) return
    const adj = Number(editAmount)
    if (Number.isNaN(adj) || adj <= 0) {
      console.error("Invalid adjustment amount")
      return
    }
    const newTotal = editMode === "credit" ? originalTotal + adj : originalTotal - adj
    if (newTotal < 0) {
      console.error("Resulting total cannot be negative")
      return
    }
    setSaving(true)
    try {
      const token = localStorage.getItem("token")
      await api.post(
        "/api/suppliers/update",
        {
          shop_id: shopId,
          supplierId: editId,
          totalAmount: newTotal,
          lastPaymentMethod: editPM,
          message: editMsg || `${editMode === "credit" ? "Credit" : "Debt"} adjustment of ₹${adj}`,
          adjustmentType: editMode,
          adjustmentAmount: adj,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      await fetchSuppliers()
      closeEdit()
    } catch (e) {
      console.error("Save edit failed", e)
    } finally {
      setSaving(false)
    }
  }

  const filtered = search
    ? suppliers.filter((s) => s.supplierName.toLowerCase().includes(search.toLowerCase()))
    : suppliers

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search suppliers by name..."
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {search && (
          <p className="mt-2 text-sm text-gray-600">
            Found {filtered.length} supplier{filtered.length !== 1 ? "s" : ""} matching "{search}".
          </p>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <div className="bg-white border border-gray-200 overflow-hidden shadow-lg rounded-xl">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full mb-6 animate-pulse">
                <Users className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Loading Suppliers...</h3>
              <p className="text-gray-600">Please wait while we fetch your data.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full mb-6">
                <Users className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No Suppliers Found</h3>
              <p className="text-gray-600">Add a supplier using the button above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gradient-to-r from-gray-100 to-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">Name</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">Agency</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">Phone</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">Address</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">Supplier Amount</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">Payment Method</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">Added</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">History</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, i) => (
                    <tr
                      key={s._id || i}
                      className={`hover:bg-blue-50 transition-colors duration-200 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
                    >
                      <td className="px-6 py-4 border-b border-gray-200 font-semibold text-gray-800">{s.supplierName}</td>
                      <td className="px-6 py-4 border-b border-gray-200 text-gray-700">{s.agencyName || "-"}</td>
                      <td className="px-6 py-4 border-b border-gray-200 text-gray-700">{s.phoneNumber || "-"}</td>
                      <td className="px-6 py-4 border-b border-gray-200 text-gray-700 max-w-xs truncate" title={s.address}>{s.address || "-"}</td>
                      <td className="px-6 py-4 border-b border-gray-200 text-gray-900 font-semibold">₹{Number(s.totalAmount || 0).toLocaleString("en-IN")}</td>
                      <td className="px-6 py-4 border-b border-gray-200 text-gray-700 capitalize">{s.lastPaymentMethod || "-"}</td>
                      <td className="px-6 py-4 border-b border-gray-200 text-sm text-gray-600">
                        {s.createdAt ? new Date(s.createdAt).toLocaleDateString("en-IN") : "-"}
                      </td>
                      <td className="px-6 py-4 border-b border-gray-200 text-sm">
                        <button
                          onClick={() => router.push(`/supplierlist/${s._id}/history`)}
                          className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                          title="View history"
                        >
                          View
                        </button>
                      </td>
                      <td className="px-6 py-4 border-b border-gray-200 text-sm">
                        <button
                          onClick={() => openEdit(s)}
                          className="px-3 py-2 rounded-lg bg-gray-800 text-white hover:bg-black transition-colors"
                          title="Edit supplier"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-2">Edit Supplier</h3>
            <p className="text-sm text-gray-600 mb-4">Current Total: ₹{originalTotal.toLocaleString("en-IN")}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adjustment Type</label>
                <div className="inline-flex rounded-lg overflow-hidden border border-gray-300">
                  <button
                    type="button"
                    onClick={() => setEditMode("credit")}
                    className={`px-4 py-2 text-sm font-medium ${editMode === "credit" ? "bg-green-600 text-white" : "bg-white text-gray-700"}`}
                  >
                    Credit (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditMode("debt")}
                    className={`px-4 py-2 text-sm font-medium border-l border-gray-300 ${editMode === "debt" ? "bg-red-600 text-white" : "bg-white text-gray-700"}`}
                  >
                    Debt (-)
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adjustment Amount (₹)</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Enter amount to apply"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={editPM}
                  onChange={(e) => setEditPM(e.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message / Product Note</label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Optional product or reason"
                  value={editMsg}
                  onChange={(e) => setEditMsg(e.target.value)}
                />
              </div>
              {editAmount && !Number.isNaN(Number(editAmount)) && Number(editAmount) > 0 && (
                <p className="text-xs text-gray-500">
                  New Total Preview: ₹{(editMode === "credit" ? originalTotal + Number(editAmount) : originalTotal - Number(editAmount)).toLocaleString("en-IN")}
                </p>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button className="px-3 py-2 rounded-lg border" onClick={closeEdit} disabled={saving}>Cancel</button>
              <button className="px-3 py-2 rounded-lg bg-blue-600 text-white" onClick={saveEdit} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SupplierList

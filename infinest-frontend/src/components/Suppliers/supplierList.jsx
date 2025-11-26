"use client"

import React, { useEffect, useState } from "react"
import { Users, Search } from "lucide-react"
import api from "@/components/api"
import AddSupplierModal from "@/components/ProductTable/AddSupplierModal"
import { useRouter } from "next/navigation"

export default function SupplierList({ shopId }) {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editAmount, setEditAmount] = useState("")
  const [editPM, setEditPM] = useState("cash")
  const [editMsg, setEditMsg] = useState("")
  const [editCurrentAmount, setEditCurrentAmount] = useState(0)
  const [editPaidAmount, setEditPaidAmount] = useState("")
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const fetchSuppliers = async () => {
      if (!shopId) return
      setLoading(true)
      try {
        const token = localStorage.getItem("token")
        const res = await api.post(
          "/api/suppliers/list",
          { shop_id: shopId },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        setSuppliers(res.data.suppliers || [])
      } catch (err) {
        console.error("Failed to load suppliers", err)
      } finally {
        setLoading(false)
      }
    }
    fetchSuppliers()
  }, [shopId])

  const filtered = search
    ? suppliers.filter(s => s.supplierName.toLowerCase().includes(search.toLowerCase()))
    : suppliers

  const openEdit = (s) => {
    setEditId(s._id)
    setEditCurrentAmount(Number(s.totalAmount || 0))
    setEditPaidAmount("")
    setEditPM((s.lastPaymentMethod || "cash").toLowerCase())
    setEditMsg("Admin edited supplier amount/payment method")
  }

  const closeEdit = () => {
    setEditId(null)
    setEditAmount("")
    setEditPM("cash")
    setEditMsg("")
    setEditCurrentAmount(0)
    setEditPaidAmount("")
  }

  const saveEdit = async () => {
    if (!editId || !shopId) return
    setSaving(true)
    try {
      const token = localStorage.getItem("token")
      // prefer sending paidAmount so server subtracts it from current total
      const paid = Number(editPaidAmount) || 0
      await api.post(
        "/api/suppliers/update",
        { shop_id: shopId, supplierId: editId, paidAmount: paid, lastPaymentMethod: editPM, message: editMsg },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      // refresh list
      const res = await api.post(
        "/api/suppliers/list",
        { shop_id: shopId },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setSuppliers(res.data.suppliers || [])
      closeEdit()
    } catch (e) {
      console.error("Save edit failed", e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 flex-shrink-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-white/20 rounded-xl">
              <Users className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Suppliers</h2>
              <p className="text-blue-100">Manage your supplier directory</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowAddSupplierModal(true)}
              className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2 backdrop-blur-sm border border-white/20 hover:border-white/30"
            >
              <Users className="h-5 w-5" />
              <span>Add Supplier</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-8 py-6 bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-200 flex-shrink-0">
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


      {/* Table */}
      <div className="flex-1 px-8 py-6 overflow-auto bg-white">
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
                      className={`hover:bg-blue-50 transition-colors duration-200 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                    >
                      <td className="px-6 py-4 border-b border-gray-200 font-semibold text-gray-800">{s.supplierName}</td>
                      <td className="px-6 py-4 border-b border-gray-200 text-gray-700">{s.agencyName || '-'}</td>
                      <td className="px-6 py-4 border-b border-gray-200 text-gray-700">{s.phoneNumber || '-'}</td>
                      <td className="px-6 py-4 border-b border-gray-200 text-gray-700 max-w-xs truncate" title={s.address}>{s.address || '-'}</td>
                      <td className="px-6 py-4 border-b border-gray-200 text-gray-900 font-semibold">{Number(s.totalAmount || 0).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-4 border-b border-gray-200 text-gray-700 capitalize">{s.lastPaymentMethod || '-'}</td>
                      <td className="px-6 py-4 border-b border-gray-200 text-sm text-gray-600">{s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN') : '-'}</td>
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
            <h3 className="text-lg font-semibold mb-4">Edit Supplier</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Supplier Amount (₹)</label>
                <input
                  type="text"
                  readOnly
                  className="w-full border rounded-lg px-3 py-2 bg-gray-50"
                  value={`₹${Number(editCurrentAmount || 0).toLocaleString('en-IN')}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Paid Supplier Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full border rounded-lg px-3 py-2"
                  value={editPaidAmount}
                  onChange={(e) => setEditPaidAmount(e.target.value)}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Message (History)</label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Admin edit note"
                  value={editMsg}
                  onChange={(e) => setEditMsg(e.target.value)}
                />
              </div>
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

      {showAddSupplierModal && (
        <AddSupplierModal
          shop_id={shopId}
          onClose={() => setShowAddSupplierModal(false)}
          onSuccess={(newSupplier) => {
            setShowAddSupplierModal(false)
            if (newSupplier) setSuppliers(prev => [newSupplier, ...(prev || [])])
          }}
        />
      )}
    </div>
  )
}

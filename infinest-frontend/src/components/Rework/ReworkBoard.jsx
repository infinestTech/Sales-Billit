"use client"

import { useEffect, useState, useCallback } from "react"
import api from "../api"
import {
  RotateCcw,
  Search,
  Filter,
  ShieldCheck,
  ShieldOff,
  Wrench,
  CheckCircle,
  Clock,
  Phone,
  Smartphone,
  Calendar,
  X,
  Plus,
  Hash,
  AlertCircle,
  Package,
  User as UserIcon,
} from "lucide-react"

const STATUS_META = {
  added: { label: "Added", icon: Clock, color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", pill: "bg-amber-100 text-amber-800" },
  working_on: { label: "Working On", icon: Wrench, color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", pill: "bg-blue-100 text-blue-800" },
  completed: { label: "Completed", icon: CheckCircle, color: "text-green-700", bg: "bg-green-50", border: "border-green-200", pill: "bg-green-100 text-green-800" },
}

const formatDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A")

const formatWarranty = (record) => {
  if (!record?.has_warranty) return "No Warranty"
  const months = record.warranty_months
  const expiry = record.warranty_expiry_date ? formatDate(record.warranty_expiry_date) : null
  return `${months ? `${months} Month${months === 1 ? "" : "s"}` : "Yes"}${expiry ? ` (till ${expiry})` : ""}`
}

const WarrantyBadge = ({ record }) => (
  record?.has_warranty ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
      <ShieldCheck className="h-3.5 w-3.5" /> {formatWarranty(record)}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
      <ShieldOff className="h-3.5 w-3.5" /> No Warranty
    </span>
  )
)

const ReworkBoard = ({ shopId }) => {
  // Search (delivered mobiles) state
  const [filters, setFilters] = useState({ clientName: "", mobileNumber: "", mobileName: "", imei: "", fromDate: "", toDate: "" })
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Add-to-rework modal state
  const [addModalMobile, setAddModalMobile] = useState(null)
  const [complaint, setComplaint] = useState("")
  const [adding, setAdding] = useState(false)

  // Rework list state
  const [reworkRecords, setReworkRecords] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all") // all | added | working_on | completed
  const [updatingId, setUpdatingId] = useState(null)

  const fetchReworkList = useCallback(async () => {
    if (!shopId) return
    setLoadingList(true)
    try {
      const token = localStorage.getItem("token")
      const res = await api.post(
        "/api/rework/list",
        { shopId },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setReworkRecords(res.data.records || [])
    } catch (error) {
      console.error("Error fetching rework list:", error.message)
    } finally {
      setLoadingList(false)
    }
  }, [shopId])

  useEffect(() => {
    fetchReworkList()
  }, [fetchReworkList])

  const handleFilterChange = (field, value) => setFilters((prev) => ({ ...prev, [field]: value }))

  const handleSearch = async () => {
    if (!shopId) return
    setSearching(true)
    setHasSearched(true)
    try {
      const token = localStorage.getItem("token")
      const res = await api.post(
        "/api/rework/search-delivered",
        { shopId, ...filters },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setSearchResults(res.data.mobiles || [])
    } catch (error) {
      console.error("Error searching delivered mobiles:", error.message)
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleClearFilters = () => {
    setFilters({ clientName: "", mobileNumber: "", mobileName: "", imei: "", fromDate: "", toDate: "" })
    setSearchResults([])
    setHasSearched(false)
  }

  const openAddModal = (mobile) => {
    setAddModalMobile(mobile)
    setComplaint("")
  }

  const closeAddModal = () => {
    if (adding) return
    setAddModalMobile(null)
    setComplaint("")
  }

  const submitAddToRework = async () => {
    if (!complaint.trim()) {
      alert("Please describe the customer's complaint before adding.")
      return
    }
    setAdding(true)
    try {
      const token = localStorage.getItem("token")
      await api.post(
        "/api/rework/add",
        { shopId, mobileId: addModalMobile._id, complaint: complaint.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setSearchResults((prev) =>
        prev.map((m) => (m._id === addModalMobile._id ? { ...m, already_in_rework: true } : m))
      )
      setAddModalMobile(null)
      setComplaint("")
      await fetchReworkList()
    } catch (error) {
      const msg = error.response?.data?.error || "Failed to add to rework list."
      alert(msg)
      console.error("Error adding to rework:", error.message)
    } finally {
      setAdding(false)
    }
  }

  const changeStatus = async (record, newStatus) => {
    setUpdatingId(record._id)
    try {
      const token = localStorage.getItem("token")
      await api.put(
        "/api/rework/status",
        { id: record._id, status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      await fetchReworkList()
    } catch (error) {
      console.error("Error updating rework status:", error.message)
      alert("Failed to update status.")
    } finally {
      setUpdatingId(null)
    }
  }

  const grouped = {
    added: reworkRecords.filter((r) => r.status === "added"),
    working_on: reworkRecords.filter((r) => r.status === "working_on"),
    completed: reworkRecords.filter((r) => r.status === "completed"),
  }

  const sectionsToShow = statusFilter === "all" ? ["added", "working_on", "completed"] : [statusFilter]

  const ReworkCard = ({ record }) => {
    const meta = STATUS_META[record.status]
    const Icon = meta.icon
    return (
      <div className={`bg-white border ${meta.border} rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow duration-200`}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-800">{record.client_name}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${meta.pill}`}>
                <Icon className="h-3 w-3" /> {meta.label}
              </span>
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
              <Phone className="h-3.5 w-3.5" /> {record.mobile_number}
            </div>
          </div>
          <WarrantyBadge record={record} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 mt-3 text-sm text-gray-600">
          <div className="flex items-center gap-1.5">
            <Smartphone className="h-3.5 w-3.5 text-purple-500" />
            <span className="font-medium text-gray-800">{record.mobile_name}</span>
            {record.model && <span className="text-gray-400">({record.model})</span>}
          </div>
          {record.imei && (
            <div className="flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5 text-teal-500" /> IMEI: {record.imei}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-orange-500" /> Previous issue: {record.previous_issue || "N/A"}
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-gray-400" /> Delivered: {formatDate(record.previous_delivery_date)}
          </div>
          {record.productName && (
            <div className="flex items-center gap-1.5 sm:col-span-2">
              <Package className="h-3.5 w-3.5 text-indigo-500" /> Part used: {record.productName}
              {record.supplierName ? ` (from ${record.supplierName})` : ""}
            </div>
          )}
        </div>

        <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700">
          <span className="font-semibold text-gray-800">Customer's complaint: </span>
          {record.complaint}
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-400">Added to rework: {formatDate(record.added_date)}</span>
          <div className="flex items-center gap-2">
            {record.status !== "added" && (
              <button
                onClick={() => changeStatus(record, "added")}
                disabled={updatingId === record._id}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-50 transition-colors"
              >
                Move to Added
              </button>
            )}
            {record.status !== "working_on" && (
              <button
                onClick={() => changeStatus(record, "working_on")}
                disabled={updatingId === record._id}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {record.status === "completed" ? "Reopen — Working On" : "Start Working"}
              </button>
            )}
            {record.status !== "completed" && (
              <button
                onClick={() => changeStatus(record, "completed")}
                disabled={updatingId === record._id}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                Mark Completed
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-5 xl:px-8 xl:py-6">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-white/20 rounded-xl">
            <RotateCcw className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Rework</h2>
            <p className="text-blue-100">Track devices returned with a new complaint after delivery</p>
          </div>
        </div>
      </div>

      {/* Search delivered devices */}
      <div className="px-4 py-6 xl:px-8 bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-200">
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <Filter className="h-5 w-5 mr-2 text-blue-600" />
            Find a Delivered Device
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Client Name</label>
              <input
                type="text"
                value={filters.clientName}
                onChange={(e) => handleFilterChange("clientName", e.target.value)}
                placeholder="Search by client name"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 hover:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Mobile Number</label>
              <input
                type="text"
                value={filters.mobileNumber}
                onChange={(e) => handleFilterChange("mobileNumber", e.target.value)}
                placeholder="Customer phone number"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 hover:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Device Name</label>
              <input
                type="text"
                value={filters.mobileName}
                onChange={(e) => handleFilterChange("mobileName", e.target.value)}
                placeholder="e.g. iPhone 12"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 hover:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">IMEI No</label>
              <input
                type="text"
                value={filters.imei}
                onChange={(e) => handleFilterChange("imei", e.target.value)}
                placeholder="Search by IMEI"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 hover:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Delivered From</label>
              <input
                type="date"
                value={filters.fromDate}
                onChange={(e) => handleFilterChange("fromDate", e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 hover:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Delivered To</label>
              <input
                type="date"
                value={filters.toDate}
                min={filters.fromDate || undefined}
                onChange={(e) => handleFilterChange("toDate", e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 hover:bg-white transition-colors"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleSearch}
              disabled={searching}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2 disabled:opacity-60"
            >
              <Search className="h-4 w-4" />
              {searching ? "Searching..." : "Search"}
            </button>
            <button
              onClick={handleClearFilters}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          </div>

          {/* Search results */}
          {hasSearched && (
            <div className="mt-6">
              {searchResults.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">No delivered devices matched your filters.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-600 uppercase">Client</th>
                        <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-600 uppercase">Device</th>
                        <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-600 uppercase">Prev. Issue</th>
                        <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-600 uppercase">Delivered</th>
                        <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-600 uppercase">Warranty</th>
                        <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-600 uppercase"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchResults.map((m) => (
                        <tr key={m._id} className="border-t border-gray-100 hover:bg-blue-50/50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-800">{m.client_name}</div>
                            <div className="text-xs text-gray-500">{m.mobile_number}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-gray-800">{m.mobile_name} {m.model && <span className="text-gray-400">({m.model})</span>}</div>
                            {m.imei && <div className="text-xs text-gray-400 font-mono">{m.imei}</div>}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{m.issue || "N/A"}</td>
                          <td className="px-4 py-3 text-gray-600">{formatDate(m.delivery_date)}</td>
                          <td className="px-4 py-3"><WarrantyBadge record={m} /></td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => openAddModal(m)}
                              disabled={m.already_in_rework}
                              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 ml-auto transition-colors ${
                                m.already_in_rework
                                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                  : "bg-blue-600 hover:bg-blue-700 text-white"
                              }`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              {m.already_in_rework ? "In Rework" : "Add"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Rework list */}
      <div className="px-4 py-6 xl:px-8">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-lg font-semibold text-gray-800">Rework List</h3>
          <div className="flex items-center gap-2">
            {["all", "added", "working_on", "completed"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  statusFilter === s ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s === "all" ? "All" : STATUS_META[s].label} {s !== "all" && `(${grouped[s].length})`}
              </button>
            ))}
          </div>
        </div>

        {loadingList ? (
          <div className="text-center py-12 text-gray-500">Loading rework list...</div>
        ) : reworkRecords.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full mb-6">
              <RotateCcw className="h-10 w-10 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No Rework Records Yet</h3>
            <p className="text-gray-600">Search for a delivered device above and add it here when a customer reports a complaint.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {sectionsToShow.map((status) => (
              grouped[status].length > 0 && (
                <div key={status}>
                  <div className={`flex items-center gap-2 mb-3 text-sm font-bold uppercase tracking-wide ${STATUS_META[status].color}`}>
                    {(() => { const Icon = STATUS_META[status].icon; return <Icon className="h-4 w-4" /> })()}
                    {STATUS_META[status].label} ({grouped[status].length})
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {grouped[status].map((record) => (
                      <ReworkCard key={record._id} record={record} />
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        )}
      </div>

      {/* Add-to-rework modal */}
      {addModalMobile && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[9998] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-xl">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="h-5 w-5" /> Add to Rework
              </h3>
              <button onClick={closeAddModal} className="text-white/80 hover:text-white transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-800 font-semibold">
                  <UserIcon className="h-4 w-4 text-indigo-500" /> {addModalMobile.client_name}
                  <span className="text-gray-400 font-normal">• {addModalMobile.mobile_number}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Smartphone className="h-4 w-4 text-purple-500" />
                  {addModalMobile.mobile_name} {addModalMobile.model && `(${addModalMobile.model})`}
                </div>
                {addModalMobile.imei && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Hash className="h-4 w-4 text-teal-500" /> IMEI: {addModalMobile.imei}
                  </div>
                )}
                <div className="flex items-center gap-2 text-gray-600">
                  <AlertCircle className="h-4 w-4 text-orange-500" /> Previous issue: {addModalMobile.issue || "N/A"}
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="h-4 w-4 text-gray-400" /> Delivered: {formatDate(addModalMobile.delivery_date)}
                </div>
                {addModalMobile.technician_name && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Wrench className="h-4 w-4 text-gray-400" /> Technician: {addModalMobile.technician_name}
                  </div>
                )}
                {addModalMobile.productName && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Package className="h-4 w-4 text-indigo-500" /> Part used: {addModalMobile.productName}
                    {addModalMobile.supplierName ? ` (from ${addModalMobile.supplierName})` : ""}
                  </div>
                )}
                <div className="pt-1">
                  <WarrantyBadge record={addModalMobile} />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">Customer's Complaint</label>
                <textarea
                  value={complaint}
                  onChange={(e) => setComplaint(e.target.value)}
                  rows={4}
                  placeholder="Describe what the customer is complaining about this time..."
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                />
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <button
                  onClick={closeAddModal}
                  disabled={adding}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitAddToRework}
                  disabled={adding}
                  className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {adding ? "Adding..." : "Add to Rework"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReworkBoard

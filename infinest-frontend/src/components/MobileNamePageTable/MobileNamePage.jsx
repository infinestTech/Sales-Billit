"use client"

import { useEffect, useState, useRef } from "react"
import { useSearchParams } from "next/navigation"
import Pagination from "@/components/tables/Pagination"
import api from "@/components/api"
import { Smartphone, Filter, Users, Phone, Wrench, User, Hash, AlertCircle, Edit3, Search, Calendar, Download, ChevronDown, Image as ImageIcon } from "lucide-react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { PAYMENT_METHOD_OPTIONS } from "@/constants/paymentMethods"
import MobileImagesModal from "./MobileImagesModal"

const MobileNamePage = ({ shopId }) => {
  const searchParams = useSearchParams()
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [clientFilter, setClientFilter] = useState("")
  const [clientFilterLabel, setClientFilterLabel] = useState("")
  const [clientSearchOpen, setClientSearchOpen] = useState(false)
  const [clientSearchText, setClientSearchText] = useState("")
  const clientDropdownRef = useRef(null)
  const [dealerNames, setDealerNames] = useState([])
  // Default to "All" — no status filter is applied out of the box, so nothing is hidden by default
  const [selectedStatus, setSelectedStatus] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [invoicesPerPage] = useState(20)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [editingTechnician, setEditingTechnician] = useState(null)
  const [technicianName, setTechnicianName] = useState("")
  const [imeiSearch, setImeiSearch] = useState("")
  // Extra filters — resolved server-side so exact records are found without loading everything
  const [mobileNameFilter, setMobileNameFilter] = useState("")
  const [modelFilter, setModelFilter] = useState("")
  const [technicianFilter, setTechnicianFilter] = useState("")
  const [billNoFilter, setBillNoFilter] = useState("")
  const [appliedFilters, setAppliedFilters] = useState({ imei: "", mobileName: "", model: "", technician: "", billNo: "" })
  const [viewImagesMobileId, setViewImagesMobileId] = useState(null)
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  // { open, mobile, mode: 'ready'|'delivered'|'sbrd'|'returnedChoice' }
  const [statusModal, setStatusModal] = useState({ open: false, mobile: null, mode: null })
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [deliverPayAmount, setDeliverPayAmount] = useState("")
  const [deliverPayMethod, setDeliverPayMethod] = useState("")
  const [warrantyHasInput, setWarrantyHasInput] = useState(null) // true | false | null (undecided)
  const [warrantyMonthsInput, setWarrantyMonthsInput] = useState(6) // 3 | 6 | "custom"
  const [warrantyCustomMonths, setWarrantyCustomMonths] = useState("")

  // Set status and IMEI from URL params on mount
  useEffect(() => {
    const statusParam = searchParams.get('status')
    const imeiParam = searchParams.get('imei')
    if (imeiParam) {
      setImeiSearch(imeiParam)
    } else if (statusParam === 'pending') {
      setSelectedStatus('readyNotDelivered')
    } else if (statusParam === 'notReady') {
      setSelectedStatus('notReady')
    }
  }, [searchParams])

  // Builds the shared filter payload used by both the paginated list fetch and the PDF export
  const buildRegistryFilters = () => {
    const filters = { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }
    if (appliedFilters.imei.trim()) {
      // IMEI search takes priority — status filter is disabled while it's active (see status select)
      filters.imei = appliedFilters.imei.trim()
    } else if (selectedStatus) {
      filters.status = selectedStatus
    }
    if (appliedFilters.mobileName.trim()) filters.mobileName = appliedFilters.mobileName.trim()
    if (appliedFilters.model.trim()) filters.model = appliedFilters.model.trim()
    if (appliedFilters.technician.trim()) filters.technician = appliedFilters.technician.trim()
    if (appliedFilters.billNo.trim()) filters.billNo = appliedFilters.billNo.trim()
    if (clientFilter === "__customers__") filters.customerType = "Customer"
    else if (clientFilter === "__dealers__") filters.customerType = "Dealer"
    else if (clientFilter) {
      filters.customerType = "Dealer"
      filters.clientName = clientFilter
    }
    return filters
  }

  // Fetches a single page from the server — never loads the whole shop's mobiles at once
  const fetchRegistry = async (page = currentPage) => {
    if (!shopId) return
    try {
      setLoading(true)
      const token = localStorage.getItem("token")
      const response = await api.post(
        "/api/mobile-registry",
        { page, limit: invoicesPerPage, ...buildRegistryFilters() },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      setRows(response.data.mobiles || [])
      setTotal(response.data.total || 0)
    } catch (error) {
      console.error("Error fetching mobile registry:", error.message)
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  const fetchDealerNames = async () => {
    try {
      if (!shopId) return
      const token = localStorage.getItem("token")
      const response = await api.post(
        "/api/dealers",
        { shop_id: shopId },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      const names = [...new Set((response.data || []).map((d) => d.clientName).filter(Boolean))].sort()
      setDealerNames(names)
    } catch (error) {
      console.error("Error fetching dealer list:", error.message)
    }
  }

  const handleTechnicianClick = (mobile) => {
    setEditingTechnician(mobile.id)
    setTechnicianName(mobile.technician)
  }

  const handleTechnicianChange = (e) => {
    let value = e.target.value
    value = value.replace(/\s{4,}/g, "   ")
    if (value.length <= 20) setTechnicianName(value)
  }

  const handleTechnicianBlur = async (mobileId) => {
    try {
      if (technicianName.trim() === "") return

      const token = localStorage.getItem("token")

      await api.put(
        `/api/updateTechnician/${mobileId}`,
        { technicianName },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      setRows((prev) =>
        prev.map((mobile) => (mobile.id === mobileId ? { ...mobile, technician: technicianName } : mobile)),
      )

      setEditingTechnician(null)
    } catch (error) {
      console.error("Error updating technician name:", error.message)
    }
  }

  useEffect(() => {
    fetchDealerNames()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId])

  // Debounce free-text filters so every keystroke doesn't trigger a fetch
  useEffect(() => {
    const t = setTimeout(() => {
      setAppliedFilters({
        imei: imeiSearch,
        mobileName: mobileNameFilter,
        model: modelFilter,
        technician: technicianFilter,
        billNo: billNoFilter,
      })
      setCurrentPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [imeiSearch, mobileNameFilter, modelFilter, technicianFilter, billNoFilter])

  useEffect(() => {
    fetchRegistry(currentPage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, clientFilter, selectedStatus, dateFrom, dateTo, appliedFilters, currentPage])

  const callToggle = async (mobileId, field, extra = {}) => {
    const token = localStorage.getItem("token")
    const res = await api.post(
      "/api/toggle-status",
      { id: mobileId, field, ...extra },
      { headers: { Authorization: `Bearer ${token}` } },
    )
    return res.data.updatedMobile
  }

  const openStatusModal = (mobile) => {
    let mode = null
    if (mobile.isDelivered) mode = null
    else if (mobile.isReturn) mode = "returnedChoice"
    else if (mobile.isShouldBeReturned) mode = "sbrd"
    else if (mobile.isReady) mode = "delivered"
    else if (mobile.isProcessing) mode = "ready"
    else mode = "processing"

    if (!mode) return
    setDeliverPayAmount("")
    setDeliverPayMethod("")
    setWarrantyHasInput(null)
    setWarrantyMonthsInput(6)
    setWarrantyCustomMonths("")
    setStatusModal({ open: true, mobile, mode })
  }

  const closeStatusModal = () => {
    if (statusUpdating) return
    setDeliverPayAmount("")
    setDeliverPayMethod("")
    setWarrantyHasInput(null)
    setWarrantyMonthsInput(6)
    setWarrantyCustomMonths("")
    setStatusModal({ open: false, mobile: null, mode: null })
  }

  const performStatusAction = async (action) => {
    const mobile = statusModal.mobile
    if (!mobile) return
    setStatusUpdating(true)
    try {
      if (action === "processing") {
        await callToggle(mobile.id, "processing")
      } else if (action === "ready") {
        await callToggle(mobile.id, "ready")
      } else if (action === "delivered") {
        const existingPaid = Number(mobile.totalPaid) || 0
        const addAmount = Number(deliverPayAmount) || 0
        if (addAmount <= 0 && existingPaid <= 0) {
          alert("Please enter the paid amount before marking this device as Delivered.")
          setStatusUpdating(false)
          return
        }
        if (addAmount > 0 && !deliverPayMethod) {
          alert("Please select a payment method.")
          setStatusUpdating(false)
          return
        }
        if (warrantyHasInput === null) {
          alert("Please specify whether this device has a warranty.")
          setStatusUpdating(false)
          return
        }
        let warrantyMonths = null
        if (warrantyHasInput === true) {
          warrantyMonths = warrantyMonthsInput === "custom" ? Number(warrantyCustomMonths) : Number(warrantyMonthsInput)
          if (!warrantyMonths || warrantyMonths <= 0) {
            alert("Please enter a valid warranty duration.")
            setStatusUpdating(false)
            return
          }
        }
        if (addAmount > 0) {
          const token = localStorage.getItem("token")
          await api.post(
            "/api/add-payment-entry",
            {
              id: mobile.id,
              amount: addAmount,
              method: deliverPayMethod,
              date: new Date().toISOString(),
            },
            { headers: { Authorization: `Bearer ${token}` } },
          )
        }
        await callToggle(mobile.id, "delivered", {
          hasWarranty: warrantyHasInput,
          warrantyMonths,
        })
      } else if (action === "sbrdToReturned") {
        // SBRd → Returned (single cycle step)
        await callToggle(mobile.id, "returned")
      } else if (action === "returnedToNone") {
        // Returned → None (single cycle step)
        await callToggle(mobile.id, "returned")
      } else if (action === "returnedToSbrd") {
        // Returned → None → SBRd (two cycle steps)
        await callToggle(mobile.id, "returned")
        await callToggle(mobile.id, "returned")
      }
      // Re-fetch this page so the status change and any filter-driven reordering are reflected
      await fetchRegistry(currentPage)
      setStatusModal({ open: false, mobile: null, mode: null })
    } catch (error) {
      const msg = error.response?.data?.error || "Failed to update status."
      alert(msg)
    } finally {
      setStatusUpdating(false)
    }
  }

  useEffect(() => {
    const handler = (e) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target)) {
        setClientSearchOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const handleClientSelect = (value, label) => {
    setClientFilter(value)
    setClientFilterLabel(label)
    setClientSearchText("")
    setClientSearchOpen(false)
    setCurrentPage(1)
  }

  const handleStatusChange = (e) => {
    setSelectedStatus(e.target.value)
    setCurrentPage(1)
  }

  const handleImeiSearchChange = (e) => {
    setImeiSearch(e.target.value)
  }

  const filteredDealerNames = dealerNames.filter((n) =>
    n.toLowerCase().includes(clientSearchText.toLowerCase())
  )

  const paginate = (pageNumber) => {
    if (pageNumber < 1 || pageNumber > Math.max(1, Math.ceil(total / invoicesPerPage))) return
    setCurrentPage(pageNumber)
  }

  // Count of "more filters" currently applied, shown as a badge on the toggle button
  const advancedFilterCount = [mobileNameFilter, modelFilter, technicianFilter, billNoFilter, dateFrom, dateTo].filter(
    (v) => String(v || "").trim().length > 0
  ).length

  const clearAllFilters = () => {
    setClientFilter("")
    setClientFilterLabel("")
    setSelectedStatus("")
    setImeiSearch("")
    setMobileNameFilter("")
    setModelFilter("")
    setTechnicianFilter("")
    setBillNoFilter("")
    setDateFrom("")
    setDateTo("")
  }

  const handleExportPDF = async () => {
    try {
      setExporting(true)
      const token = localStorage.getItem("token")
      // Bounded bulk fetch (server caps at 3000) instead of ever loading the whole shop client-side
      const response = await api.post(
        "/api/mobile-registry",
        { page: 1, limit: 3000, forExport: true, ...buildRegistryFilters() },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      const exportRows = response.data.mobiles || []
      const grandTotal = response.data.total || exportRows.length

      const doc = new jsPDF({ orientation: "landscape" })

      // Title
      doc.setFontSize(16)
      doc.setTextColor(30, 64, 175)
      doc.text("Mobile Registry Report", 14, 16)

      // Applied filters summary
      doc.setFontSize(9)
      doc.setTextColor(80, 80, 80)
      const filterParts = []
      if (clientFilter === "__customers__") filterParts.push("Type: Customer")
      else if (clientFilter === "__dealers__") filterParts.push("Type: Dealer")
      else if (clientFilter) filterParts.push(`Dealer: ${clientFilter}`)
      if (selectedStatus && !imeiSearch.trim()) {
        const statusLabels = { notReady: "Not Ready", processing: "Processing", readyNotDelivered: "Pending", returned: "Returned", shouldBeReturned: "Should Be Returned", delivered: "Delivered" }
        filterParts.push(`Status: ${statusLabels[selectedStatus] || selectedStatus}`)
      }
      if (dateFrom) filterParts.push(`From: ${dateFrom}`)
      if (dateTo) filterParts.push(`To: ${dateTo}`)
      if (imeiSearch.trim()) filterParts.push(`IMEI: ${imeiSearch.trim()}`)
      if (filterParts.length > 0) {
        doc.text(`Filters — ${filterParts.join("  |  ")}`, 14, 23)
      }
      doc.setFontSize(8)
      doc.setTextColor(120, 120, 120)
      doc.text(`Generated: ${new Date().toLocaleString("en-IN")}  |  Total records: ${grandTotal}`, 14, 29)

      autoTable(doc, {
        startY: 33,
        head: [["S.No", "Client Name", "Type", "Mobile Name", "Model", "IMEI No", "Issues", "Technician", "Status", "Date Added"]],
        body: exportRows.map((m, i) => [
          i + 1,
          m.clientName,
          m.customerType,
          m.mobileName,
          m.model || "-",
          m.imei || "-",
          m.issues,
          m.technician || "-",
          m.isDelivered ? "Delivered" : m.isReturn ? "Returned" : m.isShouldBeReturned ? "Should Be Returned" : m.isReady ? "Ready" : m.isProcessing ? "Processing" : "Not Ready",
          m.addedDate ? new Date(m.addedDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A",
        ]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [240, 244, 255] },
        columnStyles: { 0: { cellWidth: 12 }, 6: { cellWidth: 40 } },
      })

      if (grandTotal > exportRows.length) {
        alert(`This PDF includes the first ${exportRows.length.toLocaleString("en-IN")} of ${grandTotal.toLocaleString("en-IN")} matching records. Narrow your filters to export the rest.`)
      }

      const dateStr = new Date().toISOString().split("T")[0]
      doc.save(`mobile-registry-${dateStr}.pdf`)
    } catch (error) {
      console.error("Error exporting PDF:", error.message)
      alert("Failed to export PDF. Please try again.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-white/20 rounded-xl">
            <Smartphone className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Mobile Registry</h2>
            <p className="text-blue-100">Track and manage mobile device repairs</p>
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div className="px-8 py-3 bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-200 flex-shrink-0">
        <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center">
              <Filter className="h-4 w-4 mr-2 text-blue-600" />
              Filter Options
            </h3>
            <div className="flex items-center gap-2">
              {advancedFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs font-medium text-gray-500 hover:text-red-600 transition-colors"
                >
                  Clear all
                </button>
              )}
              <button
                onClick={() => setShowMoreFilters((prev) => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg transition-colors duration-200"
              >
                More Filters
                {advancedFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                    {advancedFilterCount}
                  </span>
                )}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showMoreFilters ? "rotate-180" : ""}`} />
              </button>
              <button
                onClick={handleExportPDF}
                disabled={exporting}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-3.5 w-3.5" />
                {exporting ? "Exporting..." : "Export PDF"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Client Filter */}
            <div className="space-y-1" ref={clientDropdownRef}>
              <label className="text-xs font-semibold text-gray-700 flex items-center">
                <Users className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
                Client
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setClientSearchOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 hover:bg-white text-left text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                >
                  <span className={clientFilterLabel ? "text-gray-900" : "text-gray-400"}>
                    {clientFilterLabel || "All"}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${clientSearchOpen ? "rotate-180" : ""}`} />
                </button>

                {clientSearchOpen && (
                  <div className="absolute z-50 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg">
                    <div className="p-2 border-b border-gray-100">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          value={clientSearchText}
                          onChange={(e) => setClientSearchText(e.target.value)}
                          placeholder="Search dealer..."
                          autoFocus
                          className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <ul className="max-h-52 overflow-y-auto py-1">
                      {!clientSearchText && (
                        <>
                          <li>
                            <button type="button" onClick={() => handleClientSelect("", "")} className="w-full text-left px-4 py-2 text-sm text-gray-500 hover:bg-gray-50">All</button>
                          </li>
                          <li>
                            <button type="button" onClick={() => handleClientSelect("__customers__", "All Customers")} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50">All Customers</button>
                          </li>
                          <li>
                            <button type="button" onClick={() => handleClientSelect("__dealers__", "All Dealers")} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50">All Dealers</button>
                          </li>
                          {filteredDealerNames.length > 0 && (
                            <li className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide border-t border-gray-100 mt-1 pt-2">Specific Dealer</li>
                          )}
                        </>
                      )}
                      {filteredDealerNames.length > 0 ? (
                        filteredDealerNames.map((name) => (
                          <li key={name}>
                            <button
                              type="button"
                              onClick={() => handleClientSelect(name, name)}
                              className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 text-gray-800 ${clientFilter === name ? "bg-blue-50 font-medium" : ""}`}
                            >
                              {name}
                            </button>
                          </li>
                        ))
                      ) : (
                        clientSearchText && <li className="px-4 py-2 text-sm text-gray-400">No dealers found</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 flex items-center">
                <AlertCircle className="h-3.5 w-3.5 mr-1.5 text-indigo-600" />
                Status
              </label>
              <select
                value={selectedStatus}
                onChange={handleStatusChange}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white ${imeiSearch.trim() ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={!!imeiSearch.trim()}
              >
                <option value="">All Statuses</option>
                <option value="notReady">Not Ready</option>
                <option value="processing">Processing</option>
                <option value="readyNotDelivered">Pending</option>
                <option value="shouldBeReturned">Should Be Returned (SBRd)</option>
                <option value="returned">Returned</option>
                <option value="delivered">Delivered</option>
              </select>
            </div>

            {/* IMEI Search */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 flex items-center">
                <Search className="h-3.5 w-3.5 mr-1.5 text-teal-600" />
                IMEI No
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={imeiSearch}
                  onChange={handleImeiSearchChange}
                  placeholder="Search IMEI number..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white pr-9"
                />
                {imeiSearch && (
                  <button
                    onClick={() => setImeiSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {showMoreFilters && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-100">
              {/* Mobile Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 flex items-center">
                  <Phone className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
                  Mobile Name
                </label>
                <input
                  type="text"
                  value={mobileNameFilter}
                  onChange={(e) => setMobileNameFilter(e.target.value)}
                  placeholder="Search mobile name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                />
              </div>

              {/* Model */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 flex items-center">
                  <Smartphone className="h-3.5 w-3.5 mr-1.5 text-indigo-600" />
                  Model
                </label>
                <input
                  type="text"
                  value={modelFilter}
                  onChange={(e) => setModelFilter(e.target.value)}
                  placeholder="Search model..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                />
              </div>

              {/* Technician */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 flex items-center">
                  <Wrench className="h-3.5 w-3.5 mr-1.5 text-purple-600" />
                  Technician
                </label>
                <input
                  type="text"
                  value={technicianFilter}
                  onChange={(e) => setTechnicianFilter(e.target.value)}
                  placeholder="Search technician..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                />
              </div>

              {/* Bill Number */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 flex items-center">
                  <Hash className="h-3.5 w-3.5 mr-1.5 text-green-600" />
                  Bill Number
                </label>
                <input
                  type="text"
                  value={billNoFilter}
                  onChange={(e) => setBillNoFilter(e.target.value)}
                  placeholder="Search bill number..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                />
              </div>

              {/* Date From */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 flex items-center">
                  <Calendar className="h-3.5 w-3.5 mr-1.5 text-orange-600" />
                  From Date
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1) }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                />
              </div>

              {/* Date To */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 flex items-center">
                  <Calendar className="h-3.5 w-3.5 mr-1.5 text-orange-600" />
                  To Date
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1) }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                  />
                  {(dateFrom || dateTo) && (
                    <button
                      onClick={() => { setDateFrom(""); setDateTo(""); setCurrentPage(1) }}
                      className="px-2.5 py-2 text-xs text-gray-500 hover:text-red-500 border border-gray-300 rounded-lg hover:border-red-300 transition-colors bg-gray-50"
                      title="Clear dates"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table Section */}
      <div className="flex-1 px-8 py-6 overflow-auto bg-white">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full mb-4 animate-spin">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
            <p className="text-lg text-gray-600 font-medium">Loading mobile data...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full mb-6">
              <Smartphone className="h-10 w-10 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No Mobile Records Found</h3>
            <p className="text-gray-600">No mobile devices match the selected filters.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 overflow-hidden shadow-lg rounded-xl">
            <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
              <span className="text-sm text-blue-700 font-medium">
                Showing {rows.length} of {total} record{total !== 1 ? "s" : ""}
                {clientFilter && clientFilter !== "__customers__" && clientFilter !== "__dealers__" ? ` for ${clientFilter}` : ""}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gradient-to-r from-gray-100 to-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                      <div className="flex items-center">
                        <Hash className="h-4 w-4 mr-2 text-blue-600" />
                        S.No
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-2 text-indigo-600" />
                        Client Name
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 mr-2 text-green-600" />
                        Mobile Name
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                      <div className="flex items-center">
                        <Hash className="h-4 w-4 mr-2 text-teal-600" />
                        IMEI No
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                      <div className="flex items-center">
                        <AlertCircle className="h-4 w-4 mr-2 text-orange-600" />
                        Issues
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                      <div className="flex items-center">
                        <Wrench className="h-4 w-4 mr-2 text-purple-600" />
                        Technician
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                      <div className="flex items-center">
                        <svg className="h-4 w-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Date Added
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                      <div className="flex items-center">
                        <AlertCircle className="h-4 w-4 mr-2 text-green-600" />
                        Status
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                      Photos
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((data, index) => (
                    <tr
                      key={index}
                      className={`hover:bg-blue-50 transition-colors duration-200 ${
                        index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                      }`}
                    >
                      <td className="px-6 py-4 border-b border-gray-200">
                        <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                          {(currentPage - 1) * invoicesPerPage + index + 1}
                        </span>
                      </td>
                      <td className="px-6 py-4 border-b border-gray-200">
                        <div className="font-semibold text-gray-800">{data.clientName}</div>
                        <div className="text-sm text-gray-500 mt-1">
                          {data.customerType === "Customer" ? "Customer" : "Dealer"}
                        </div>
                      </td>
                      <td className="px-6 py-4 border-b border-gray-200">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-700">{data.mobileName}</span>
                          {data.model && (
                            <span className="text-xs text-gray-500 mt-0.5">{data.model}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 border-b border-gray-200">
                        <span className="text-sm text-gray-600 font-mono">{data.imei || "-"}</span>
                      </td>
                      <td className="px-6 py-4 border-b border-gray-200">
                        <span className="text-sm text-gray-600">{data.issues}</span>
                      </td>
                      <td className="px-6 py-4 border-b border-gray-200">
                        {editingTechnician === data.id ? (
                          <input
                            type="text"
                            value={technicianName}
                            onChange={handleTechnicianChange}
                            onBlur={() => handleTechnicianBlur(data.id)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                            autoFocus
                          />
                        ) : (
                          <div
                            onClick={() => handleTechnicianClick(data)}
                            className="cursor-pointer flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-purple-50 transition-colors duration-200 group"
                          >
                            <span className="text-gray-700 group-hover:text-purple-700">
                              {data.technician || "Click to add"}
                            </span>
                            <Edit3 className="h-4 w-4 text-gray-400 group-hover:text-purple-600 opacity-0 group-hover:opacity-100 transition-all duration-200" />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 border-b border-gray-200">
                        <span className="text-sm text-gray-600">
                          {data.addedDate ? new Date(data.addedDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          }) : 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 border-b border-gray-200">
                        {(() => {
                          const clickable = !data.isDelivered
                          const badge = data.isDelivered ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">Delivered</span>
                          ) : data.isReturn ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">Returned</span>
                          ) : data.isShouldBeReturned ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">SBRd</span>
                          ) : data.isReady ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Ready</span>
                          ) : data.isProcessing ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">Processing</span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">Not Ready</span>
                          )
                          return clickable ? (
                            <button
                              type="button"
                              onClick={() => openStatusModal(data)}
                              className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full hover:opacity-80 transition-opacity"
                              title="Click to update status"
                            >
                              {badge}
                            </button>
                          ) : (
                            badge
                          )
                        })()}
                      </td>
                      <td className="px-6 py-4 border-b border-gray-200">
                        {data.hasImages ? (
                          <button
                            type="button"
                            onClick={() => setViewImagesMobileId(data.id)}
                            className="flex items-center gap-1.5 rounded-md border border-blue-600 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                          >
                            <ImageIcon className="h-3.5 w-3.5" />
                            View Photos
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">No photos</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <Pagination
                invoicesPerPage={invoicesPerPage}
                totalInvoices={total}
                paginate={paginate}
                currentPage={currentPage}
              />
            </div>
          </div>
        )}
      </div>

      {statusModal.open && statusModal.mobile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Update Status</h3>
              <p className="text-sm text-gray-500 mt-1">
                {statusModal.mobile.clientName} — {statusModal.mobile.mobileName}
                {statusModal.mobile.model ? ` (${statusModal.mobile.model})` : ""}
              </p>
            </div>
            <div className="px-6 py-5 space-y-3">
              {statusModal.mode === "processing" && (
                <>
                  <p className="text-sm text-gray-700">Mark this device as <span className="font-semibold text-purple-700">Processing</span> (technician has started the repair)?</p>
                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={closeStatusModal} disabled={statusUpdating} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50">Cancel</button>
                    <button onClick={() => performStatusAction("processing")} disabled={statusUpdating} className="px-4 py-2 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50">
                      {statusUpdating ? "Updating…" : "Mark as Processing"}
                    </button>
                  </div>
                </>
              )}
              {statusModal.mode === "ready" && (
                <>
                  <p className="text-sm text-gray-700">Mark this device as <span className="font-semibold text-blue-700">Ready</span>?</p>
                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={closeStatusModal} disabled={statusUpdating} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50">Cancel</button>
                    <button onClick={() => performStatusAction("ready")} disabled={statusUpdating} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                      {statusUpdating ? "Updating…" : "Mark as Ready"}
                    </button>
                  </div>
                </>
              )}
              {statusModal.mode === "delivered" && (
                <>
                  <p className="text-sm text-gray-700">Mark this device as <span className="font-semibold text-green-700">Delivered</span>?</p>
                  <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600">
                    Already paid: <span className="font-semibold text-gray-900">₹{(Number(statusModal.mobile.totalPaid) || 0).toLocaleString("en-IN")}</span>
                  </div>
                  {(Number(statusModal.mobile.totalPaid) || 0) <= 0 && (
                    <p className="text-xs text-red-600">
                      No payment recorded yet. Enter the paid amount below — otherwise the status cannot be changed.
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Paid Amount (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={deliverPayAmount}
                        onChange={(e) => setDeliverPayAmount(e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Payment Method</label>
                      <select
                        value={deliverPayMethod}
                        onChange={(e) => setDeliverPayMethod(e.target.value)}
                        disabled={!Number(deliverPayAmount)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white disabled:bg-gray-100"
                      >
                        {PAYMENT_METHOD_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Leave amount blank only if a payment is already recorded.
                  </p>
                  <div className="pt-1 border-t border-gray-100">
                    <label className="block text-xs font-medium text-gray-700 mb-1.5 mt-2">Warranty</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setWarrantyHasInput(true)}
                        className={`py-2 rounded-lg border-2 text-sm font-semibold transition-colors ${
                          warrantyHasInput === true
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                            : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                        }`}
                      >
                        Warranty
                      </button>
                      <button
                        type="button"
                        onClick={() => setWarrantyHasInput(false)}
                        className={`py-2 rounded-lg border-2 text-sm font-semibold transition-colors ${
                          warrantyHasInput === false
                            ? "border-gray-500 bg-gray-100 text-gray-700"
                            : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                        }`}
                      >
                        No Warranty
                      </button>
                    </div>
                    {warrantyHasInput === true && (
                      <div className="mt-2">
                        <div className="grid grid-cols-3 gap-2">
                          {[3, 6].map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setWarrantyMonthsInput(m)}
                              className={`py-1.5 rounded-lg border-2 text-xs font-medium transition-colors ${
                                warrantyMonthsInput === m
                                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                  : "border-gray-200 bg-white text-gray-600"
                              }`}
                            >
                              {m} Months
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setWarrantyMonthsInput("custom")}
                            className={`py-1.5 rounded-lg border-2 text-xs font-medium transition-colors ${
                              warrantyMonthsInput === "custom"
                                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                : "border-gray-200 bg-white text-gray-600"
                            }`}
                          >
                            Custom
                          </button>
                        </div>
                        {warrantyMonthsInput === "custom" && (
                          <input
                            type="number"
                            min="1"
                            value={warrantyCustomMonths}
                            onChange={(e) => setWarrantyCustomMonths(e.target.value)}
                            placeholder="Months"
                            className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={closeStatusModal} disabled={statusUpdating} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50">Cancel</button>
                    <button onClick={() => performStatusAction("delivered")} disabled={statusUpdating} className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
                      {statusUpdating ? "Updating…" : "Mark as Delivered"}
                    </button>
                  </div>
                </>
              )}
              {statusModal.mode === "sbrd" && (
                <>
                  <p className="text-sm text-gray-700">Mark this device as <span className="font-semibold text-yellow-700">Returned</span>?</p>
                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={closeStatusModal} disabled={statusUpdating} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50">Cancel</button>
                    <button onClick={() => performStatusAction("sbrdToReturned")} disabled={statusUpdating} className="px-4 py-2 text-sm text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 disabled:opacity-50">
                      {statusUpdating ? "Updating…" : "Mark as Returned"}
                    </button>
                  </div>
                </>
              )}
              {statusModal.mode === "returnedChoice" && (
                <>
                  <p className="text-sm text-gray-700">Change status of this returned device to:</p>
                  <div className="grid grid-cols-1 gap-2 pt-1">
                    <button
                      onClick={() => performStatusAction("returnedToSbrd")}
                      disabled={statusUpdating}
                      className="px-4 py-3 text-sm font-medium text-amber-800 bg-amber-100 rounded-lg hover:bg-amber-200 disabled:opacity-50 text-left"
                    >
                      Move to <span className="font-semibold">SBRd</span> (Should Be Returned)
                    </button>
                    <button
                      onClick={() => performStatusAction("returnedToNone")}
                      disabled={statusUpdating}
                      className="px-4 py-3 text-sm font-medium text-red-800 bg-red-100 rounded-lg hover:bg-red-200 disabled:opacity-50 text-left"
                    >
                      Move to <span className="font-semibold">Not Ready</span>
                    </button>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button onClick={closeStatusModal} disabled={statusUpdating} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50">Cancel</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {viewImagesMobileId && (
        <MobileImagesModal mobileId={viewImagesMobileId} onClose={() => setViewImagesMobileId(null)} />
      )}
    </div>
  )
}

export default MobileNamePage

"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { useSearchParams } from "next/navigation"
import Pagination from "@/components/tables/Pagination"
import api from "@/components/api"
import { Smartphone, Filter, Users, Phone, Wrench, User, Hash, AlertCircle, Edit3, Search, Calendar, Download, ChevronDown } from "lucide-react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

const MobileNamePage = ({ shopId }) => {
  const searchParams = useSearchParams()
  const [mobileData, setMobileData] = useState([])
  const [clientFilter, setClientFilter] = useState("")
  const [clientFilterLabel, setClientFilterLabel] = useState("")
  const [clientSearchOpen, setClientSearchOpen] = useState(false)
  const [clientSearchText, setClientSearchText] = useState("")
  const clientDropdownRef = useRef(null)
  const [selectedStatus, setSelectedStatus] = useState("notReady")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [invoicesPerPage] = useState(15)
  const [loading, setLoading] = useState(true)
  const [editingTechnician, setEditingTechnician] = useState(null)
  const [technicianName, setTechnicianName] = useState("")
  const [imeiSearch, setImeiSearch] = useState("")

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

  const fetchMobileData = async () => {
    try {
      if (!shopId) {
        console.warn("Shop ID is not available.")
        return
      }

      setLoading(true)
      const token = localStorage.getItem("token")

      const response = await api.post(
        "/api/fetchAllData",
        { shop_id: shopId },
        { headers: { Authorization: `Bearer ${token}` } },
      )

      const { customers, dealers } = response.data

      const consolidatedData = [...customers, ...dealers].flatMap((entry) =>
        entry.mobiles.map((mobile, index) => ({
          id: mobile._id,
          clientId: entry._id,
          clientName: entry.client_name,
          customerType: entry.customer_type,
          mobileName: mobile.mobile_name,
          model: mobile.model || "",
          imei: mobile.imei || "",
          issues: mobile.issue || "No issues specified",
          technician: mobile.technician_name || "",
          isReady: mobile.ready,
          isDelivered: mobile.delivered,
          isReturn: mobile.returned,
          isShouldBeReturned: mobile.should_be_returned,
          addedDate: mobile.added_date,
          index,
        })),
      )

      const sortedData = consolidatedData.sort((a, b) => new Date(b.addedDate) - new Date(a.addedDate))

      setMobileData(sortedData)
    } catch (error) {
      console.error("Error fetching mobile data:", error.message)
      setMobileData([])
    } finally {
      setLoading(false)
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

      setMobileData((prev) =>
        prev.map((mobile) => (mobile.id === mobileId ? { ...mobile, technician: technicianName } : mobile)),
      )

      setEditingTechnician(null)
    } catch (error) {
      console.error("Error updating technician name:", error.message)
    }
  }

  useEffect(() => {
    fetchMobileData()
  }, [shopId])

  // Close client dropdown on outside click
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
    setCurrentPage(1)
  }

  // Unique dealer names derived from data
  const dealerNames = useMemo(() => {
    const names = mobileData
      .filter((m) => m.customerType === "Dealer")
      .map((m) => m.clientName)
    return [...new Set(names)].sort()
  }, [mobileData])

  const filteredDealerNames = dealerNames.filter((n) =>
    n.toLowerCase().includes(clientSearchText.toLowerCase())
  )

  const filteredMobileData = mobileData
    .filter((mobile) => {
      if (!clientFilter) return true
      if (clientFilter === "__customers__") return mobile.customerType === "Customer"
      if (clientFilter === "__dealers__") return mobile.customerType === "Dealer"
      return mobile.clientName === clientFilter
    })
    .filter((mobile) => {
      if (!dateFrom && !dateTo) return true
      const added = mobile.addedDate ? new Date(mobile.addedDate) : null
      if (!added) return false
      const from = dateFrom ? new Date(dateFrom) : null
      const to = dateTo ? new Date(new Date(dateTo).setHours(23, 59, 59, 999)) : null
      if (from && added < from) return false
      if (to && added > to) return false
      return true
    })
    .filter((mobile) => {
      // When IMEI search is active, skip status filter and show all matching mobiles
      if (imeiSearch.trim()) return true
      switch (selectedStatus) {
        case "notReady":
          return !mobile.isReady && !mobile.isShouldBeReturned && !mobile.isReturn
        case "notDelivered":
          return !mobile.isDelivered
        case "readyNotDelivered":
          return mobile.isReady && !mobile.isDelivered
        case "return":
          return mobile.isReturn
        case "shouldBeReturned":
          return mobile.isShouldBeReturned
        default:
          return true
      }
    })
    .filter((mobile) => {
      if (!imeiSearch.trim()) return true
      return mobile.imei && mobile.imei.toLowerCase().includes(imeiSearch.trim().toLowerCase())
    })

  const indexOfLastInvoice = currentPage * invoicesPerPage
  const indexOfFirstInvoice = indexOfLastInvoice - invoicesPerPage
  const currentInvoices = filteredMobileData.slice(indexOfFirstInvoice, indexOfLastInvoice)

  const paginate = (pageNumber) => {
    if (pageNumber < 1 || pageNumber > Math.ceil(filteredMobileData.length / invoicesPerPage)) return
    setCurrentPage(pageNumber)
  }

  const handleExportPDF = () => {
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
      const statusLabels = { notReady: "Not Ready", notDelivered: "Not Delivered", readyNotDelivered: "Pending", return: "Return", shouldBeReturned: "Should Be Returned" }
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
    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}  |  Total records: ${filteredMobileData.length}`, 14, 29)

    autoTable(doc, {
      startY: 33,
      head: [["S.No", "Client Name", "Type", "Mobile Name", "Model", "IMEI No", "Issues", "Technician", "Status", "Date Added"]],
      body: filteredMobileData.map((m, i) => [
        i + 1,
        m.clientName,
        m.customerType,
        m.mobileName,
        m.model || "-",
        m.imei || "-",
        m.issues,
        m.technician || "-",
        m.isDelivered ? "Delivered" : m.isReturn ? "Returned" : m.isShouldBeReturned ? "Should Be Returned" : m.isReady ? "Ready" : "Not Ready",
        m.addedDate ? new Date(m.addedDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A",
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [240, 244, 255] },
      columnStyles: { 0: { cellWidth: 12 }, 6: { cellWidth: 40 } },
    })

    const dateStr = new Date().toISOString().split("T")[0]
    doc.save(`mobile-registry-${dateStr}.pdf`)
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
      <div className="px-8 py-6 bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-200 flex-shrink-0">
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <Filter className="h-5 w-5 mr-2 text-blue-600" />
              Filter Options
            </h3>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 shadow-sm"
            >
              <Download className="h-4 w-4" />
              Export PDF
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {/* Client Filter */}
            <div className="space-y-2" ref={clientDropdownRef}>
              <label className="text-sm font-semibold text-gray-700 flex items-center">
                <Users className="h-4 w-4 mr-2 text-blue-600" />
                Filter by Client
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setClientSearchOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 hover:bg-white text-left focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
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
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center">
                <AlertCircle className="h-4 w-4 mr-2 text-indigo-600" />
                Filter by Status
              </label>
              <select
                value={selectedStatus}
                onChange={handleStatusChange}
                className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white ${imeiSearch.trim() ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={!!imeiSearch.trim()}
              >
                <option value="notReady">Not Ready</option>
                <option value="notDelivered">Not Delivered</option>
                <option value="readyNotDelivered">Pending</option>
                <option value="shouldBeReturned">Should Be Returned (SBRd)</option>
                <option value="return">Return</option>
              </select>
              {imeiSearch.trim() && (
                <p className="text-xs text-gray-400">Status filter disabled during IMEI search</p>
              )}
            </div>

            {/* IMEI Search */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center">
                <Search className="h-4 w-4 mr-2 text-teal-600" />
                Filter by IMEI No
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={imeiSearch}
                  onChange={handleImeiSearchChange}
                  placeholder="Search IMEI number..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white pr-10"
                />
                {imeiSearch && (
                  <button
                    onClick={() => { setImeiSearch(""); setCurrentPage(1); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>



            {/* Date From */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-orange-600" />
                From Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1) }}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
              />
            </div>

            {/* Date To */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-orange-600" />
                To Date
              </label>
              <div className="flex gap-2 items-end">
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1) }}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                />
                {(dateFrom || dateTo) && (
                  <button
                    onClick={() => { setDateFrom(""); setDateTo(""); setCurrentPage(1) }}
                    className="px-3 py-3 text-xs text-gray-500 hover:text-red-500 border border-gray-300 rounded-xl hover:border-red-300 transition-colors bg-gray-50"
                    title="Clear dates"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
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
        ) : currentInvoices.length === 0 ? (
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
                Showing {filteredMobileData.length} record{filteredMobileData.length !== 1 ? "s" : ""}
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
                  </tr>
                </thead>
                <tbody>
                  {currentInvoices.map((data, index) => (
                    <tr
                      key={index}
                      className={`hover:bg-blue-50 transition-colors duration-200 ${
                        index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                      }`}
                    >
                      <td className="px-6 py-4 border-b border-gray-200">
                        <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                          {indexOfFirstInvoice + index + 1}
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
                        {data.isDelivered ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">Delivered</span>
                        ) : data.isReturn ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">Returned</span>
                        ) : data.isShouldBeReturned ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">SBRd</span>
                        ) : data.isReady ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Ready</span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">Not Ready</span>
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
                totalInvoices={filteredMobileData.length}
                paginate={paginate}
                currentPage={currentPage}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MobileNamePage

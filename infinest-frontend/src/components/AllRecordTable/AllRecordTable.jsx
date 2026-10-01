"use client"


import React, { useState, useEffect, useCallback, useRef } from "react"
import Filters from "./Filters"
import MobileNameTable from "../tables/MobileNameTable"
import Pagination from "../tables/Pagination"
import VendorHistoryPopup from "../tables/VendorHistoryPopup"
import api from "../api"
import ReceiptGenerator from "./ReceiptGenerator"
import { formatPaymentMethodLabel } from "@/constants/paymentMethods"
import {
  Database,
  Users,
  Phone,
  FileText,
  Smartphone,
  DollarSign,
  Hash,
  RotateCcw,
  Package,
  Calculator,
  MessageCircle,
} from "lucide-react"
import StatCard from "@/components/ui/StatCard"

const EMPTY_TOTALS = {
  notReadyCount: 0,
  processingCount: 0,
  deliveredCount: 0,
  notReadyFalseCount: 0,
  notDeliveredFalseCount: 0,
  returnCount: 0,
  shouldBeReturnedCount: 0,
}

// Same per-mobile rules the server uses for the summary cards
const countMobiles = (mobiles = []) => {
  const t = { ...EMPTY_TOTALS }
  mobiles.forEach((mobile) => {
    if (mobile.returned) {
      t.returnCount++
    } else if (mobile.should_be_returned) {
      t.shouldBeReturnedCount++
    } else {
      if (!mobile.ready) {
        t.notReadyFalseCount++
        if (mobile.processing) t.processingCount++
      } else t.notReadyCount++

      if (mobile.delivered) t.deliveredCount++
      else t.notDeliveredFalseCount++
    }
  })
  return t
}


const AllRecordTable = ({ shopId, filterDate }) => {
  const [filteredInvoices, setFilteredInvoices] = useState([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [loading, setLoading] = useState(true)
  const activeFiltersRef = useRef({})
  const abortRef = useRef(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [invoicesPerPage] = useState(7)
  const [expandedRow, setExpandedRow] = useState(null)
  const [selectedClient, setSelectedClient] = useState(null)
  const [vendorPopup, setVendorPopup] = useState(null)
  const [shopPhoneNumberState, setShopPhoneNumberState] = useState("")
  const [totals, setTotals] = useState(EMPTY_TOTALS)
  const [shopOwnerName, setShopOwnerName] = useState("")
const [shopAddressState, setShopAddressState] = useState("")


  const openReceiptModal = (client) => {
    setSelectedClient(client)
  }


  const closeReceiptModal = () => {
    setSelectedClient(null)
  }


  const fetchInvoices = useCallback(
    async (filters = {}, page = 1) => {
      if (!shopId) {
        console.error("Shop ID is missing.")
        return
      }

      // Only the latest request may update the table
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)

      try {
        const token = localStorage.getItem("token")
        const response = await api.post(
          "/api/records",
          {
            shopId,
            ...filters,
            page,
            limit: invoicesPerPage,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          },
        )

      const { records, total, totals: serverTotals, shopOwnerName, shopPhone, shopaddress } = response.data;


        if ((shopPhone || "9876543210") !== shopPhoneNumberState) {
          setShopPhoneNumberState(shopPhone || "9876543210")
        }


        if (shopOwnerName !== "") {
          setShopOwnerName(shopOwnerName)
        }


        if (shopaddress !== "") {
    setShopAddressState(shopaddress)
}


        setFilteredInvoices((records || []).map((record) => ({ ...record, owner_name: shopOwnerName })))
        setTotalRecords(total || 0)
        // Page 2+ keeps the totals from page 1 plus any local status edits since then
        if (page === 1) setTotals({ ...EMPTY_TOTALS, ...(serverTotals || {}) })
      } catch (error) {
        if (error?.code === "ERR_CANCELED" || error?.name === "CanceledError") return
        // ✅ Silently handle session expiry errors (user will be redirected)
        if (error.message === 'Session expired' || error.response?.data?.sessionExpired) {
          // Session expired, user will be redirected by interceptor
          return;
        }
        // Log other errors
        console.error("Error fetching invoices:", error)
      } finally {
        if (abortRef.current === controller) setLoading(false)
      }
    },
    [shopId, invoicesPerPage],
  )


  useEffect(() => {
    if (shopId) {
      activeFiltersRef.current = {}
      setCurrentPage(1)
      fetchInvoices({}, 1)
    }
  }, [shopId, fetchInvoices, filterDate])

  useEffect(() => () => abortRef.current?.abort(), [])


  const applyFilters = (filters) => {
    activeFiltersRef.current = filters
    setCurrentPage(1)
    fetchInvoices(filters, 1)
  }

  const changePage = (page) => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / invoicesPerPage))
    const next = Math.min(Math.max(1, page), totalPages)
    if (next === currentPage) return
    setCurrentPage(next)
    fetchInvoices(activeFiltersRef.current, next)
  }


  const toggleRow = (index) => {
    setExpandedRow(expandedRow === index ? null : index)
  }


  const updateMobileData = (invoiceIndex, updatedMobileData) => {
    // Summary cards cover every matching record, so adjust them by this row's change only
    const before = countMobiles(filteredInvoices[invoiceIndex]?.MobileName)
    const after = countMobiles(updatedMobileData)
    setTotals((prev) => {
      const next = { ...prev }
      Object.keys(EMPTY_TOTALS).forEach((key) => {
        next[key] = Math.max(0, (prev[key] || 0) - before[key] + after[key])
      })
      return next
    })
    setFilteredInvoices((prev) => {
      const updated = [...prev]
      updated[invoiceIndex] = {
        ...updated[invoiceIndex],
        MobileName: [...updatedMobileData],
      }
      return updated
    })
  }


  const updateBalance = async (id, balanceAmount, type) => {
    try {
      const token = localStorage.getItem("token")
      const response = await api.post(
        "/api/allUpdateBalance",
        {
          id,
          balanceAmount,
          type,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )
      console.warn(response.data.message)
    } catch (error) {
      console.error("Error updating balance:", error)
    }
  }

  const updateEstimatedCost = async (id, estimatedCost, type) => {
    try {
      const token = localStorage.getItem("token")
      const response = await api.post(
        "/api/allUpdateEstimatedCost",
        {
          id,
          estimatedCost,
          type,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )
      console.warn(response.data.message)
    } catch (error) {
      console.error("Error updating estimated cost:", error)
    }
  }

  const sendBalanceReminder = async (id, type) => {
    try {
      const token = localStorage.getItem("token")
      const response = await api.post(
        "/api/sendBalanceReminder",
        { id, type },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      const status = response?.data?.status
      if (status === "sent") {
        alert("✅ WhatsApp reminder sent.")
      } else {
        alert(`ℹ️ Reminder not sent: ${response?.data?.reason || response?.data?.message || "check WhatsApp settings"}`)
      }
    } catch (error) {
      const msg = error.response?.data?.error || error.message
      alert(`❌ Failed to send reminder: ${msg}`)
      console.error("Error sending reminder:", error)
    }
  }


  const indexOfFirstInvoice = (currentPage - 1) * invoicesPerPage
  const currentInvoices = filteredInvoices


 
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-5 xl:px-8 xl:py-6">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-white/20 rounded-xl">
            <Database className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">All Records</h2>
            <p className="text-blue-100">Complete overview of customer and dealer records</p>
          </div>
        </div>
      </div>


      {/* Summary Cards */}
      <div className="px-4 py-4 xl:px-8 xl:py-6 bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 xl:mb-6">
          <StatCard
            title="Repair Status"
            icon={Package}
            iconClass="bg-blue-50 text-blue-600"
            metrics={[
              { label: "Ready", value: totals.notReadyCount, textClass: "text-emerald-600", barClass: "bg-emerald-500" },
              { label: "Processing", value: totals.processingCount, textClass: "text-amber-600", barClass: "bg-amber-400" },
              // notReadyFalseCount includes processing devices; show only untouched ones here
              { label: "Not Ready", value: Math.max(0, totals.notReadyFalseCount - totals.processingCount), textClass: "text-rose-600", barClass: "bg-rose-500" },
            ]}
          />
          <StatCard
            title="Delivery Status"
            icon={Smartphone}
            iconClass="bg-emerald-50 text-emerald-600"
            metrics={[
              { label: "Delivered", value: totals.deliveredCount, textClass: "text-emerald-600", barClass: "bg-emerald-500" },
              { label: "Pending", value: totals.notDeliveredFalseCount, textClass: "text-orange-600", barClass: "bg-orange-400" },
            ]}
          />
          <StatCard
            title="Return Status"
            icon={RotateCcw}
            iconClass="bg-violet-50 text-violet-600"
            metrics={[
              { label: "Should Return", value: totals.shouldBeReturnedCount, textClass: "text-amber-600", barClass: "bg-amber-400" },
              { label: "Returned", value: totals.returnCount, textClass: "text-violet-600", barClass: "bg-violet-500" },
            ]}
          />
        </div>


        {/* Filters */}
        <Filters onFilter={applyFilters} />
      </div>


      {/* Table Section - Now flows naturally */}
      <div className="px-4 py-4 xl:px-8 xl:py-6 bg-white">
        {loading && filteredInvoices.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading records...</span>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full mb-6">
              <Database className="h-10 w-10 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No Records Found</h3>
            <p className="text-gray-600">No records found for the selected filters.</p>
          </div>
        ) : (
          <div className={`bg-white border border-gray-200 overflow-hidden shadow-lg rounded-xl transition-opacity ${loading ? "opacity-60" : ""}`}>
            <div className="overflow-x-auto">
              <table className="min-w-[960px] w-full">
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
                        <Users className="h-4 w-4 mr-2 text-indigo-600" />
                        Client Name
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 mr-2 text-green-600" />
                        Mobile Number
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                      <div className="flex items-center">
                        <Smartphone className="h-4 w-4 mr-2 text-purple-600" />
                        No. of Mobiles
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                      <div className="flex items-center">
                        <FileText className="h-4 w-4 mr-2 text-orange-600" />
                        Bill No
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                      <div className="flex items-center">
                        Payment Breakdown
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                      <div className="flex items-center">
                        <Calculator className="h-4 w-4 mr-2 text-emerald-600" />
                        Estimated Cost
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-2 text-red-600" />
                        Balance Amount
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                      Generate Receipt
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {currentInvoices.map((invoice, index) => (
                    <React.Fragment key={index}>
                      <tr
                        className={`hover:bg-blue-50 transition-colors duration-200 cursor-pointer ${
                          index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                        }`}
                        onClick={() => toggleRow(index)}
                      >
                        <td className="px-6 py-4 border-b border-gray-200">
                          <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                            {indexOfFirstInvoice + index + 1}
                          </span>
                        </td>
                        <td className="px-6 py-4 border-b border-gray-200">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold text-gray-800">{invoice.client_name}</div>
                            {invoice.customer_type === "Dealer" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setVendorPopup({ dealerId: invoice._id, dealerName: invoice.client_name })
                                }}
                                className="px-2 py-0.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                              >
                                View
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 border-b border-gray-200">
                          <span className="font-medium text-gray-700">{invoice.mobile_number}</span>
                        </td>
                        <td className="px-6 py-4 border-b border-gray-200">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-purple-100 text-purple-800">
                            {invoice.MobileName.length}
                          </span>
                        </td>
                        <td className="px-6 py-4 border-b border-gray-200">
                          <span className="font-medium text-gray-700">{invoice.bill_no || "N/A"}</span>
                        </td>
                        <td className="px-6 py-4 border-b border-gray-200" onClick={(e) => e.stopPropagation()}>
                          <div className="text-sm text-gray-700">
                            {(() => {
                              const allPayments = invoice.MobileName.flatMap(m => m.payments || [])
                              const paymentsByMethod = {}
                              allPayments.forEach(p => {
                                const method = p.method || 'N/A'
                                paymentsByMethod[method] = (paymentsByMethod[method] || 0) + (p.amount || 0)
                              })
                              const methods = Object.entries(paymentsByMethod)
                              if (methods.length > 0) {
                                return (
                                  <div className="space-y-0.5">
                                    {methods.map(([method, amount], idx) => (
                                      <div key={idx} className="flex items-center gap-2">
                                        <span className="text-gray-600">{formatPaymentMethodLabel(method)}</span>
                                        <span className="font-medium">₹{amount.toLocaleString("en-IN")}</span>
                                      </div>
                                    ))}
                                  </div>
                                )
                              }
                              return <span className="text-gray-400">-</span>
                            })()}
                          </div>
                        </td>
                        <td className="px-6 py-4 border-b border-gray-200" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="number"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                            value={invoice.estimated_cost ?? ""}
                            onChange={(e) => {
                              const val = e.target.value
                              if (/^\d{0,8}$/.test(val)) {
                                const updated = [...filteredInvoices]
                                updated[index].estimated_cost = val
                                setFilteredInvoices(updated)
                              }
                            }}
                            onBlur={(e) =>
                              updateEstimatedCost(
                                invoice._id,
                                Number.parseInt(e.target.value, 10) || 0,
                                invoice.customer_type || "Customer",
                              )
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="px-6 py-4 border-b border-gray-200">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                              value={invoice.balance_amount || ""}
                            onChange={(e) => {
                              const val = e.target.value
                              if (/^\d{0,8}$/.test(val)) {
                                const updated = [...filteredInvoices]
                                updated[index].balance_amount = val
                                setFilteredInvoices(updated)
                              }
                            }}
                            onBlur={(e) =>
                              updateBalance(
                                invoice._id,
                                Number.parseInt(e.target.value, 10) || 0,
                                invoice.customer_type || "Dealer",
                              )
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                            {Number(invoice.balance_amount) > 0 && (
                              <button
                                type="button"
                                title="Send WhatsApp balance reminder"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  sendBalanceReminder(invoice._id, invoice.customer_type || "Customer")
                                }}
                                className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-green-100 hover:bg-green-200 text-green-700 transition-colors"
                              >
                                <MessageCircle className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 xl:px-6 xl:py-4 border-b border-gray-200 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openReceiptModal(invoice)
                            }}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center space-x-2"
                          >
                            <FileText className="h-4 w-4" />
                            <span>Receipt</span>
                          </button>
                        </td>
                      </tr>
                      {expandedRow === index && (
                        <tr>
                          <td colSpan="9" className="px-6 py-4 bg-gray-50/30">
                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                              <MobileNameTable
                                mobileData={invoice.MobileName}
                                setMobileData={(updatedMobileData) =>
                                  updateMobileData(index, updatedMobileData)
                                }
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>


            {/* Pagination */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <Pagination
                invoicesPerPage={invoicesPerPage}
                totalInvoices={totalRecords}
                paginate={changePage}
                currentPage={currentPage}
              />
            </div>
          </div>
        )}
      </div>


      {/* Receipt Modal */}
      {selectedClient && (
        <ReceiptGenerator
          clientData={{
            client_name: selectedClient.client_name || selectedClient.clientName,
            mobile_number: selectedClient.mobile_number || selectedClient.mobileNumber,
            owner_name:
              selectedClient.owner_name || selectedClient.ownerName || shopOwnerName || "INFINFEST MOBILE SERVICE",
            bill_no: selectedClient.bill_no || selectedClient.billNo || "N/A",
            MobileName: selectedClient.MobileName.map((m) => ({
                  _id: m._id,
                  mobile_name: m.mobile_name || m.mobileName,
              model: m.model || m.model_no || m.modelNo || "",
              imei: m.imei || m.imei_no || m.imeiNo || "",
                  issue: m.issue,
                  added_date: m.added_date || m.addedDate,
                  delivery_date: m.delivery_date || m.deliveryDate || null,
                  // Use total_paid from payments array if available, fallback to legacy paid_amount
                  payments: m.payments || [],
                  total_paid: m.total_paid || 0,
                  paid_amount: typeof m.paid_amount !== 'undefined' && m.paid_amount !== null ? m.paid_amount : 0,
                  has_warranty: m.has_warranty || false,
                  warranty_months: m.warranty_months || null,
                  warranty_expiry_date: m.warranty_expiry_date || null,
                })),  
          }}
          shopPhoneNumber={shopPhoneNumberState}
          shopAddress={shopAddressState}  
          closeModal={closeReceiptModal}
        />
      )}

      {/* Vendor History Popup */}
      {vendorPopup && (
        <VendorHistoryPopup
          dealerId={vendorPopup.dealerId}
          dealerName={vendorPopup.dealerName}
          onClose={() => setVendorPopup(null)}
        />
      )}
    </div>
  )
}


export default AllRecordTable






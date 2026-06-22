"use client"


import React, { useState, useEffect, useCallback } from "react"
import Filters from "./Filters"
import MobileNameTable from "../tables/MobileNameTable"
import Pagination from "../tables/Pagination"
import VendorHistoryPopup from "../tables/VendorHistoryPopup"
import api from "../api"
import ReceiptGenerator from "./ReceiptGenerator"
import {
  Database,
  Users,
  Phone,
  FileText,
  Smartphone,
  DollarSign,
  Hash,
  CheckCircle,
  XCircle,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Package,
  Calculator,
  MessageCircle,
} from "lucide-react"


const AllRecordTable = ({ shopId, filterDate }) => {
  const [filteredInvoices, setFilteredInvoices] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [invoicesPerPage] = useState(7)
  const [expandedRow, setExpandedRow] = useState(null)
  const [selectedClient, setSelectedClient] = useState(null)
  const [vendorPopup, setVendorPopup] = useState(null)
  const [shopPhoneNumberState, setShopPhoneNumberState] = useState("")
  const [totals, setTotals] = useState({
    notReadyCount: 0,
    deliveredCount: 0,
    notReadyFalseCount: 0,
    notDeliveredFalseCount: 0,
    returnCount: 0,
  })
  const [shopOwnerName, setShopOwnerName] = useState("")
const [shopAddressState, setShopAddressState] = useState("")


  const openReceiptModal = (client) => {
    setSelectedClient(client)
  }


  const closeReceiptModal = () => {
    setSelectedClient(null)
  }


  const fetchInvoices = useCallback(
    async (filters = {}) => {
      try {
        if (!shopId) {
          console.error("Shop ID is missing.")
          return
        }


        const token = localStorage.getItem("token")
        const response = await api.post(
          "/api/records",
          {
            shopId,
            ...filters,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        )


      const { mobiles, customers, dealers, shopOwnerName, shopPhone, shopaddress } = response.data;


        if ((shopPhone || "9876543210") !== shopPhoneNumberState) {
          setShopPhoneNumberState(shopPhone || "9876543210")
        }


        if (shopOwnerName !== "") {
          setShopOwnerName(shopOwnerName)
        }


        if (shopaddress !== "") {
    setShopAddressState(shopaddress)
}


        const customersWithMobiles = customers.map((customer) => ({
          ...customer,
          owner_name: shopOwnerName,
          MobileName: mobiles.filter((mobile) => mobile.customer_id === customer._id),
        }))


        const dealersWithMobiles = dealers.map((dealer) => ({
          ...dealer,
          owner_name: shopOwnerName,
          MobileName: mobiles.filter((mobile) => mobile.dealer_id === dealer._id),
        }))


        const data = [...customersWithMobiles, ...dealersWithMobiles]
          .filter((record) => record.MobileName.length > 0)
          .sort((a, b) => {
            const dateA = new Date(a.MobileName[0]?.added_date || 0)
            const dateB = new Date(b.MobileName[0]?.added_date || 0)
            return dateB - dateA
          })


        setFilteredInvoices(data)
        calculateTotals(data)
      } catch (error) {
        // ✅ Silently handle session expiry errors (user will be redirected)
        if (error.message === 'Session expired' || error.response?.data?.sessionExpired) {
          // Session expired, user will be redirected by interceptor
          return;
        }
        // Log other errors
        console.error("Error fetching invoices:", error)
      }
    },
    [shopId],
  )


  useEffect(() => {
    if (shopId) {
      fetchInvoices()
    }
  }, [shopId, fetchInvoices, filterDate])


  const calculateTotals = (data) => {
    let notReadyCount = 0,
      deliveredCount = 0,
      notReadyFalseCount = 0,
      notDeliveredFalseCount = 0,
      returnCount = 0


    data.forEach((invoice) => {
      invoice.MobileName.forEach((mobile) => {
        if (mobile.returned) {
          returnCount++
        } else {
          if (!mobile.ready) notReadyFalseCount++
          else notReadyCount++


          if (mobile.delivered) deliveredCount++
          else notDeliveredFalseCount++
        }
      })
    })


    setTotals({ notReadyCount, deliveredCount, notReadyFalseCount, notDeliveredFalseCount, returnCount })
  }


  const applyFilters = (filters) => {
    fetchInvoices(filters)
    setCurrentPage(1)
  }


  const toggleRow = (index) => {
    setExpandedRow(expandedRow === index ? null : index)
  }


  const updateMobileData = (invoiceIndex, updatedMobileData) => {
    setFilteredInvoices((prev) => {
      const updated = [...prev]
      updated[invoiceIndex] = {
        ...updated[invoiceIndex],
        MobileName: [...updatedMobileData],
      }
      calculateTotals(updated)
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


  const indexOfLastInvoice = currentPage * invoicesPerPage
  const indexOfFirstInvoice = indexOfLastInvoice - invoicesPerPage
  const currentInvoices = filteredInvoices.slice(indexOfFirstInvoice, indexOfLastInvoice)


 
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-4 xl:gap-6 mb-4 xl:mb-6">
          <div className="bg-white rounded-xl p-4 xl:p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-600 mb-1">Ready Status</p>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-600 mr-1" />
                    <span className="text-lg font-bold text-green-700">{totals.notReadyCount}</span>
                    <span className="text-sm text-gray-500 ml-1">Ready</span>
                  </div>
                  <div className="flex items-center">
                    <XCircle className="h-4 w-4 text-red-600 mr-1" />
                    <span className="text-lg font-bold text-red-700">{totals.notReadyFalseCount}</span>
                    <span className="text-sm text-gray-500 ml-1">Not Ready</span>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Package className="h-8 w-8 text-blue-600" />
              </div>
            </div>
          </div>


          <div className="bg-white rounded-xl p-4 xl:p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-600 mb-1">Delivery Status</p>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                    <span className="text-lg font-bold text-green-700">{totals.deliveredCount}</span>
                    <span className="text-sm text-gray-500 ml-1">Delivered</span>
                  </div>
                  <div className="flex items-center">
                    <TrendingDown className="h-4 w-4 text-orange-600 mr-1" />
                    <span className="text-lg font-bold text-orange-700">{totals.notDeliveredFalseCount}</span>
                    <span className="text-sm text-gray-500 ml-1">Pending</span>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <Smartphone className="h-8 w-8 text-green-600" />
              </div>
            </div>
          </div>


          <div className="bg-white rounded-xl p-4 xl:p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-600 mb-1">Return Status</p>
                <p className="text-2xl font-bold text-purple-700">{totals.returnCount}</p>
                <p className="text-sm text-gray-500">Returned</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl">
                <RotateCcw className="h-8 w-8 text-purple-600" />
              </div>
            </div>
          </div>
        </div>


        {/* Filters */}
        <Filters onFilter={applyFilters} />
      </div>


      {/* Table Section - Now flows naturally */}
      <div className="px-4 py-4 xl:px-8 xl:py-6 bg-white">
        {filteredInvoices.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full mb-6">
              <Database className="h-10 w-10 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No Records Found</h3>
            <p className="text-gray-600">No records found for the selected filters.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 overflow-hidden shadow-lg rounded-xl">
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
                                        <span className="text-gray-600">{method}</span>
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
                                updated[indexOfFirstInvoice + index].estimated_cost = val
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
                                updated[indexOfFirstInvoice + index].balance_amount = val
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
                                  updateMobileData(indexOfFirstInvoice + index, updatedMobileData)
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
                totalInvoices={filteredInvoices.length}
                paginate={setCurrentPage}
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






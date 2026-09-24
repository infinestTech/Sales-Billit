"use client"

import React, { useState, useEffect } from "react"
import Pagination from "./Pagination"
import MobileNameTable from "./MobileNameTable"
import VendorHistoryPopup from "./VendorHistoryPopup"
import api from "../api"
import { usePlanFeatures } from "@/context/PlanFeatureContext"
import { useRouter } from "next/navigation"
import { formatPaymentMethodLabel } from "@/constants/paymentMethods"
import StatCard from "@/components/ui/StatCard"
import { Package, Truck, RotateCcw, IndianRupee } from "lucide-react"

const RecordTable = ({ shop_id, setIsLimitReached }) => {
  const { features } = usePlanFeatures()
  const router = useRouter()
  const [data, setData] = useState([])
  const [filteredData, setFilteredData] = useState([])
  const [expandedRow, setExpandedRow] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [isNotReadyFilter, setIsNotReadyFilter] = useState(false)
  const [todayRevenue, setTodayRevenue] = useState(0)
  const [revenueVisible, setRevenueVisible] = useState(true)
  const [vendorPopup, setVendorPopup] = useState(null) // { dealerId, dealerName }
  const ROWS_PER_PAGE = 15

  useEffect(() => {
    if (shop_id && features.entry_limit) {
      const maxPages = features.entry_limit.totalPages || 30
      const entriesPerPage = features.entry_limit.entriesPerPage || 15
      const maxTotalRecords = maxPages * entriesPerPage
      if (data.length >= maxTotalRecords) {
        setIsLimitReached(true)
      } else {
        setIsLimitReached(false)
      }
    }
  }, [data, features, shop_id])

  useEffect(() => {
    if (shop_id) {
      fetchRecords()
      fetchTodayRevenue()
    }
  }, [shop_id])

  const fetchRecords = async () => {
    try {
      const token = localStorage.getItem("token")
      const res = await api.post(
        "/api/recordsToday",
        { shop_id },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      const { records, todayRevenue, revenueVisible: rv } = res.data
      setData(records)
      setFilteredData(records)
      setTodayRevenue(todayRevenue || 0)
      if (rv !== undefined) setRevenueVisible(rv)
    } catch (error) {
      if (error.message === 'Session expired' || error.response?.data?.sessionExpired) return;
      console.error("Error fetching records:", error)
      setData([])
      setFilteredData([])
    }
  }

  const fetchTodayRevenue = async () => {
    try {
      const token = localStorage.getItem("token")
      const res = await api.post(
        "/api/recordsToday",
        { shop_id },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )
      const { todayRevenue } = res.data
      setTodayRevenue(todayRevenue || 0)
    } catch (error) {
      if (error.message === 'Session expired' || error.response?.data?.sessionExpired) return;
      console.error("Error fetching today's revenue:", error.message)
      setTodayRevenue(0)
    }
  }

  const toggleRow = (index) => {
    setExpandedRow(expandedRow === index ? null : index)
  }

  const updateBalance = async (id, balanceAmount, type) => {
    try {
      const token = localStorage.getItem("token")
      await api.post(
        "/api/updateBalance",
        { id, balanceAmount, type },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )
      await fetchRecords()
      await fetchTodayRevenue()
    } catch (error) {
      console.error("Error updating balance:", error.response?.data || error.message)
    }
  }

  const updateEstimatedCost = async (id, estimatedCost, type) => {
    try {
      const token = localStorage.getItem("token")
      await api.post(
        "/api/allUpdateEstimatedCost",
        { id, estimatedCost, type },
        { headers: { Authorization: `Bearer ${token}` } },
      )
    } catch (error) {
      console.error("Error updating estimated cost:", error.response?.data || error.message)
    }
  }

  const handleBalanceChange = (index, value) => {
    const updated = [...filteredData]
    updated[index].balanceAmount = value
    setFilteredData(updated)
  }

  const handleEstimatedCostChange = (index, value) => {
    const updated = [...filteredData]
    updated[index].estimatedCost = value
    setFilteredData(updated)
  }

  const updateMobileData = (index, updatedMobiles) => {
    const update = [...filteredData]
    update[index].mobiles = updatedMobiles
    setFilteredData(update)
    const updateMain = [...data]
    updateMain[index].mobiles = updatedMobiles
    setData(updateMain)
  }

  const computeTotals = () => {
    let notReady = 0,
      processing = 0,
      ready = 0,
      delivered = 0,
      pending = 0,
      returned = 0,
      shouldBeReturned = 0
    data.forEach((record) => {
      record.mobiles?.forEach((m) => {
        if (m.returned) returned++
        else if (m.should_be_returned) shouldBeReturned++
        else {
          if (m.ready) ready++
          else if (m.processing) processing++
          else notReady++
          if (m.delivered) delivered++
          else if (m.ready && !m.delivered) pending++ // Only count ready but not delivered
        }
      })
    })
    return { ready, processing, notReady, delivered, pending, returned, shouldBeReturned }
  }

  const totals = computeTotals()
  const currentData = filteredData.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE)

  return (
    <div className="space-y-4">
      {/* Today's Record Header */}
      <div className="flex items-end justify-between border-t border-gray-200 pt-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Today&apos;s Record</h2>
          <p className="text-sm text-gray-500">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "short", year: "numeric" })}
          </p>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
          {data.length} record{data.length !== 1 ? "s" : ""} today
        </span>
      </div>

      {/* Statistics Cards */}
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${revenueVisible ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
        <StatCard
          title="Repair Status"
          icon={Package}
          iconClass="bg-blue-50 text-blue-600"
          metrics={[
            { label: "Ready", value: totals.ready, textClass: "text-emerald-600", barClass: "bg-emerald-500" },
            { label: "Processing", value: totals.processing, textClass: "text-amber-600", barClass: "bg-amber-400" },
            {
              label: "Not Ready",
              value: totals.notReady,
              textClass: "text-rose-600",
              barClass: "bg-rose-500",
              onClick: () => router.push("/mobilename?status=notReady"),
              hint: "View not-ready devices in Mobile Registry",
            },
          ]}
        />
        <StatCard
          title="Delivery Status"
          icon={Truck}
          iconClass="bg-emerald-50 text-emerald-600"
          metrics={[
            { label: "Delivered", value: totals.delivered, textClass: "text-emerald-600", barClass: "bg-emerald-500" },
            {
              label: "Pending",
              value: totals.pending,
              textClass: "text-orange-600",
              barClass: "bg-orange-400",
              onClick: () => router.push("/mobilename?status=pending"),
              hint: "View ready-but-undelivered devices in Mobile Registry",
            },
          ]}
        />
        <StatCard
          title="Return Status"
          icon={RotateCcw}
          iconClass="bg-violet-50 text-violet-600"
          metrics={[
            { label: "Should Return", value: totals.shouldBeReturned, textClass: "text-amber-600", barClass: "bg-amber-400" },
            { label: "Returned", value: totals.returned, textClass: "text-violet-600", barClass: "bg-violet-500" },
          ]}
        />
        {/* Hidden when shop admin disables revenue visibility */}
        {revenueVisible && (
          <StatCard
            title="Today's Revenue"
            icon={IndianRupee}
            iconClass="bg-indigo-50 text-indigo-600"
            showBar={false}
            metrics={[
              { label: "Collected today", value: `₹${todayRevenue.toLocaleString("en-IN")}`, textClass: "text-gray-900" },
            ]}
            footer="Service payments + spare sales"
          />
        )}
      </div>

      {/* Records Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[840px] w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700 border-b border-gray-200">S.No</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700 border-b border-gray-200">
                  Client Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700 border-b border-gray-200">
                  Mobile Number
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700 border-b border-gray-200">
                  Bill Number
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700 border-b border-gray-200">
                  Mobiles
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700 border-b border-gray-200">
                  Payment Breakdown
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700 border-b border-gray-200">
                  Estimated Cost
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700 border-b border-gray-200">
                  Balance Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {currentData.map((record, index) => (
                <React.Fragment key={record.id}>
                  <tr
                    className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100 cursor-pointer transition-colors duration-200`}
                    onClick={() => toggleRow(index)}
                  >
                    <td className="px-6 py-4 border-b border-gray-200">
                      <span className="text-sm text-gray-900">{(currentPage - 1) * ROWS_PER_PAGE + index + 1}</span>
                    </td>
                    <td className="px-6 py-4 border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-900">{record.clientName}</span>
                        {record.customerType === "Dealer" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setVendorPopup({ dealerId: record.id, dealerName: record.clientName })
                            }}
                            className="px-2 py-0.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                          >
                            View
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 border-b border-gray-200">
                      <span className="text-sm text-gray-900">{record.mobileNumber}</span>
                    </td>
                    <td className="px-6 py-4 border-b border-gray-200">
                      <span className="text-sm text-gray-900">{record.billNo}</span>
                    </td>
                    <td className="px-6 py-4 border-b border-gray-200">
                      <span className="text-sm text-gray-900">{record.mobiles.length}</span>
                    </td>
                    <td className="px-6 py-4 border-b border-gray-200">
                      <div className="text-sm text-gray-700">
                        {(() => {
                          const allPayments = record.mobiles.flatMap(m => m.payments || [])
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
                    <td className="px-6 py-4 border-b border-gray-200">
                      <input
                        type="number"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                        placeholder="₹0"
                        value={record.estimatedCost ?? ""}
                        onChange={(e) => handleEstimatedCostChange((currentPage - 1) * ROWS_PER_PAGE + index, e.target.value)}
                        onBlur={(e) =>
                          updateEstimatedCost(
                            record.id,
                            Number.parseInt(e.target.value, 10) || 0,
                            record.customerType || "Customer",
                          )
                        }
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-6 py-4 border-b border-gray-200">
                      <input
                        type="number"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="₹0"
                        value={record.balanceAmount || ""}
                        onChange={(e) => handleBalanceChange((currentPage - 1) * ROWS_PER_PAGE + index, e.target.value)}
                        onBlur={(e) =>
                          updateBalance(
                            record.id,
                            Number.parseInt(e.target.value, 10) || 0,
                            record.customerType || "Dealer",
                          )
                        }
                      />
                    </td>
                  </tr>
                  {expandedRow === index && (
                    <tr>
                      <td colSpan="8" className="border-b border-gray-200 bg-gray-50 px-6 py-4">
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                            <h5 className="text-sm font-medium text-gray-800">Mobile Device Details</h5>
                          </div>
                          <div className="p-4">
                            <MobileNameTable
                              mobileData={record.mobiles}
                              setMobileData={(updatedMobiles) =>
                                updateMobileData((currentPage - 1) * ROWS_PER_PAGE + index, updatedMobiles)
                              }
                              onRevenueUpdate={fetchTodayRevenue}
                            />
                          </div>
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
        <div className="px-6 py-3 border-t border-gray-200">
          <Pagination
            invoicesPerPage={ROWS_PER_PAGE}
            totalInvoices={filteredData.length}
            paginate={setCurrentPage}
            currentPage={currentPage}
          />
        </div>
      </div>

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

export default RecordTable


"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Pagination from "@/components/tables/Pagination"
import api from "@/components/api"
import { Smartphone, Filter, Users, Phone, Wrench, User, Hash, AlertCircle, Edit3 } from "lucide-react"

const MobileNamePage = ({ shopId }) => {
  const searchParams = useSearchParams()
  const [mobileData, setMobileData] = useState([])
  const [selectedCustomerType, setSelectedCustomerType] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("notReady")
  const [currentPage, setCurrentPage] = useState(1)
  const [invoicesPerPage] = useState(15)
  const [loading, setLoading] = useState(true)
  const [editingTechnician, setEditingTechnician] = useState(null)
  const [technicianName, setTechnicianName] = useState("")

  // Set status from URL params on mount
  useEffect(() => {
    const statusParam = searchParams.get('status')
    if (statusParam === 'pending') {
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
          issues: mobile.issue || "No issues specified",
          technician: mobile.technician_name || "",
          isReady: mobile.ready,
          isDelivered: mobile.delivered,
          isReturn: mobile.returned,
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

  const handleCustomerTypeChange = (e) => {
    setSelectedCustomerType(e.target.value)
    setCurrentPage(1)
  }

  const handleStatusChange = (e) => {
    setSelectedStatus(e.target.value)
    setCurrentPage(1)
  }

  const filteredMobileData = mobileData
    .filter((mobile) => (selectedCustomerType ? mobile.customerType === selectedCustomerType : true))
    .filter((mobile) => {
      switch (selectedStatus) {
        case "notReady":
          return !mobile.isReady
        case "notDelivered":
          return !mobile.isDelivered
        case "readyNotDelivered":
          return mobile.isReady && !mobile.isDelivered
        case "return":
          return mobile.isReturn
        default:
          return true
      }
    })

  const indexOfLastInvoice = currentPage * invoicesPerPage
  const indexOfFirstInvoice = indexOfLastInvoice - invoicesPerPage
  const currentInvoices = filteredMobileData.slice(indexOfFirstInvoice, indexOfLastInvoice)

  const paginate = (pageNumber) => {
    if (pageNumber < 1 || pageNumber > Math.ceil(filteredMobileData.length / invoicesPerPage)) return
    setCurrentPage(pageNumber)
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
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <Filter className="h-5 w-5 mr-2 text-blue-600" />
            Filter Options
          </h3>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center">
                <Users className="h-4 w-4 mr-2 text-blue-600" />
                Filter by Customer Type
              </label>
              <select
                value={selectedCustomerType}
                onChange={handleCustomerTypeChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
              >
                <option value="">All Types</option>
                <option value="Customer">Customer</option>
                <option value="Dealer">Dealer</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center">
                <AlertCircle className="h-4 w-4 mr-2 text-indigo-600" />
                Filter by Status
              </label>
              <select
                value={selectedStatus}
                onChange={handleStatusChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
              >
                <option value="notReady">Not Ready</option>
                <option value="notDelivered">Not Delivered</option>
                <option value="readyNotDelivered">Pending</option>
                <option value="return">Return</option>
              </select>
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

"use client"

import React, { useState, useEffect } from "react"
import Pagination from "../tables/Pagination"
import MobileNameTable from "../tables/MobileNameTable"
import api from "../api"
import {
  Wallet,
  Search,
  Users,
  Phone,
  FileText,
  Smartphone,
  DollarSign,
  Edit3,
  Trash2,
  Save,
  X,
  Hash,
  Filter,
} from "lucide-react"

const BalanceAmount = ({ shopId }) => {
  const [mobileData, setMobileData] = useState([])
  const [clientName, setClientName] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [invoicesPerPage] = useState(10)
  const [expandedRow, setExpandedRow] = useState(null)
  const [editingIndex, setEditingIndex] = useState(null)
  const [editBalanceAmount, setEditBalanceAmount] = useState("")
  const [originalData, setOriginalData] = useState([])

  const fetchMobileData = async () => {
    try {
      if (!shopId) {
        console.error("Shop ID is not available. Unable to fetch data.")
        return
      }

      const token = localStorage.getItem("token")

      const customerResponse = await api.post(
        "/api/customers/balance",
        { shop_id: shopId },
        { headers: { Authorization: `Bearer ${token}` } },
      )

      const customers = customerResponse.data.map((customer) => ({
        ...customer,
        type: "Customer",
        mobiles: customer.mobiles.map((mobile) => ({
          mobileName: mobile.mobileName,
          addedDate: mobile.addedDate,
          issue: mobile.issue || "No issue",
        })),
      }))

      const dealerResponse = await api.post(
        "/api/dealers/balance",
        { shop_id: shopId },
        { headers: { Authorization: `Bearer ${token}` } },
      )

      const dealers = dealerResponse.data.map((dealer) => ({
        ...dealer,
        type: "Dealer",
        mobiles: dealer.mobiles.map((mobile) => ({
          mobileName: mobile.mobileName,
          issue: mobile.issue || "No issue",
        })),
      }))

      const consolidatedData = [...customers, ...dealers]

      const sortedData = consolidatedData.sort((a, b) => {
        const dateA = new Date(a.mobiles[0]?.addedDate || 0)
        const dateB = new Date(b.mobiles[0]?.addedDate || 0)
        return dateB - dateA
      })

      setOriginalData(sortedData)
      setMobileData(sortedData)
    } catch (error) {
      if (error.message === 'Session expired' || error.response?.data?.sessionExpired) return;
      console.error("Error fetching balance data:", error)
    }
  }

  useEffect(() => {
    fetchMobileData()
  }, [shopId])

  const handleClientNameFilter = () => {
    if (!clientName.trim()) {
      console.warn("Please enter a client name to filter!")
      return
    }

    const filteredData = originalData.filter((data) => data.clientName.toLowerCase().includes(clientName.toLowerCase()))

    if (filteredData.length === 0) {
      console.warn("No records found for the entered client name!")
      return
    }

    setMobileData(filteredData)
  }

  const toggleRow = (index) => {
    setExpandedRow(expandedRow === index ? null : index)
  }

  const handleClearBalance = async (id, type) => {
    try {
      const token = localStorage.getItem("token")
      const response = await api.put(
        "/api/invoices/clearBalance",
        { id, type },
        { headers: { Authorization: `Bearer ${token}` } },
      )

      if (response.data.success) {
        setMobileData((prevData) => prevData.filter((item) => item.id !== id))
        console.warn("Balance amount cleared and row removed successfully!")
      } else {
        console.error("Failed to clear balance amount:", response.data.error)
      }
    } catch (error) {
      console.error("Error clearing balance amount:", error)
    }
  }

  const handleSaveBalance = async (id, type) => {
    if (!String(editBalanceAmount).trim()) {
      console.warn("Balance amount cannot be empty.")
      return
    }

    try {
      const token = localStorage.getItem("token")
      const response = await api.put(
        "/api/invoices/updateBalance",
        {
          id,
          balanceAmount: Number.parseFloat(editBalanceAmount),
          type,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      )

      if (response.data.success) {
        console.warn("Balance amount updated successfully!")
        setEditingIndex(null)
        setEditBalanceAmount("")
        fetchMobileData()
      } else {
        console.error("Failed to update balance amount:", response.data.error)
      }
    } catch (error) {
      console.error("Error saving balance amount:", error)
    }
  }

  const indexOfLastInvoice = currentPage * invoicesPerPage
  const indexOfFirstInvoice = indexOfLastInvoice - invoicesPerPage
  const currentInvoices = mobileData.slice(indexOfFirstInvoice, indexOfLastInvoice)

  const paginate = (pageNumber) => setCurrentPage(pageNumber)

  const handleClearFilter = () => {
    setClientName("")
    setMobileData(originalData)
    setCurrentPage(1)
  }

  return (
    <div className="h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-white/20 rounded-xl">
            <Wallet className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Balance Summary</h2>
            <p className="text-blue-100">Manage customer and dealer balance amounts</p>
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

          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center">
                <Search className="h-4 w-4 mr-2 text-blue-600" />
                Filter by Client Name
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                placeholder="Enter client name to filter"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleClientNameFilter}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center space-x-2"
              >
                <Search className="h-5 w-5" />
                <span>Apply Filter</span>
              </button>
              <button
                onClick={handleClearFilter}
                className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center space-x-2"
              >
                <X className="h-5 w-5" />
                <span>Clear Filter</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="flex-1 px-8 py-6 overflow-auto bg-white">
        {currentInvoices.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full mb-6">
              <Wallet className="h-10 w-10 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No Balance Records Found</h3>
            <p className="text-gray-600">No outstanding balance amounts to display.</p>
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
                        <FileText className="h-4 w-4 mr-2 text-orange-600" />
                        Bill Number
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                      <div className="flex items-center">
                        <Smartphone className="h-4 w-4 mr-2 text-purple-600" />
                        No Of Mobile
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-2 text-red-600" />
                        Balance Amount
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {currentInvoices.map((invoice, index) => (
                    <React.Fragment key={index}>
                      <tr
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
                          <div className="font-semibold text-gray-800">{invoice.clientName}</div>
                        </td>
                        <td className="px-6 py-4 border-b border-gray-200">
                          <span className="font-medium text-gray-700">{invoice.mobileNumber}</span>
                        </td>
                        <td className="px-6 py-4 border-b border-gray-200">
                          <span className="font-medium text-gray-700">{invoice.billNo}</span>
                        </td>
                        <td className="px-6 py-4 border-b border-gray-200">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-purple-100 text-purple-800">
                            {invoice.noOfMobile}
                          </span>
                        </td>
                        <td className="px-6 py-4 border-b border-gray-200">
                          {editingIndex === index ? (
                            <input
                              type="number"
                              value={editBalanceAmount}
                              onChange={(e) => {
                                const value = e.target.value
                                if (/^\d{0,8}$/.test(value)) {
                                  setEditBalanceAmount(value)
                                }
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                            />
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800">
                              ₹{invoice.balanceAmount || "0.00"}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 border-b border-gray-200">
                          <div className="flex space-x-2">
                            {editingIndex === index ? (
                              <>
                                <button
                                  onClick={() => handleSaveBalance(invoice.id, invoice.type)}
                                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-3 py-1.5 rounded-lg font-semibold transition-all duration-200 flex items-center space-x-1 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                                >
                                  <Save className="h-4 w-4" />
                                  <span>Save</span>
                                </button>
                                <button
                                  onClick={() => setEditingIndex(null)}
                                  className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-3 py-1.5 rounded-lg font-semibold transition-all duration-200 flex items-center space-x-1 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                                >
                                  <X className="h-4 w-4" />
                                  <span>Cancel</span>
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingIndex(index)
                                    setEditBalanceAmount(invoice.balanceAmount)
                                  }}
                                  className="bg-green-500 text-white px-3 py-1.5 rounded-lg font-semibold transition-all duration-200 flex items-center space-x-1 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                                >
                                  <Edit3 className="h-4 w-4" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  onClick={() => handleClearBalance(invoice.id, invoice.type)}
                                  className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-3 py-1.5 rounded-lg font-semibold transition-all duration-200 flex items-center space-x-1 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span>Clear</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedRow === index && (
                        <tr>
                          <td colSpan="7" className="px-6 py-4 bg-gray-50/30">
                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                              <MobileNameTable mobileData={invoice.mobiles} hideActions />
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
                totalInvoices={mobileData.length}
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

export default BalanceAmount

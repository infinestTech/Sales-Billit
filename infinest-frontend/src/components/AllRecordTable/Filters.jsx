"use client"

import { useState } from "react"
import {
  Search,
  Filter,
  Calendar,
  Users,
  Phone,
  FileText,
  Smartphone,
  X,
  CalendarRange,
  UserCheck,
  UserX,
} from "lucide-react"

const Filters = ({ onFilter }) => {
  const [filters, setFilters] = useState({
    clientName: "",
    mobileName: "",
    customerType: "",
    fromDate: "",
    toDate: "",
    mobileNumber: "",
    billNo: "",
    mobileDate: "",
  })

  const [datePopup, setDatePopup] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSearch = () => {
    onFilter(filters)
  }

  const handleClear = () => {
    const clearedFilters = {
      clientName: "",
      mobileName: "",
      customerType: "",
      fromDate: "",
      mobileNumber: "",
      toDate: "",
      billNo: "",
      mobileDate: "",
    }
    setFilters(clearedFilters)
    onFilter(clearedFilters)
  }

  const toggleDatePopup = () => {
    setDatePopup((prev) => !prev)
  }

  return (
    <div className="bg-white rounded-xl p-4 xl:p-6 shadow-lg border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
        <Filter className="h-5 w-5 mr-2 text-blue-600" />
        Filter Options
      </h3>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 xl:gap-4 mb-3 xl:mb-4">
        {/* Client Name */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700 flex items-center">
            <Users className="h-4 w-4 mr-2 text-blue-600" />
            Client Name
          </label>
          <input
            type="text"
            name="clientName"
            placeholder="Enter client name"
            value={filters.clientName}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
          />
        </div>

        {/* Mobile Name */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700 flex items-center">
            <Smartphone className="h-4 w-4 mr-2 text-indigo-600" />
            Mobile Name
          </label>
          <input
            type="text"
            name="mobileName"
            placeholder="Enter mobile name"
            value={filters.mobileName}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
          />
        </div>

        {/* Bill Number */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700 flex items-center">
            <FileText className="h-4 w-4 mr-2 text-green-600" />
            Bill Number
          </label>
          <input
            type="text"
            name="billNo"
            placeholder="Enter bill number"
            value={filters.billNo}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
          />
        </div>

        {/* Mobile Number */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700 flex items-center">
            <Phone className="h-4 w-4 mr-2 text-orange-600" />
            Mobile Number
          </label>
          <input
            type="text"
            name="mobileNumber"
            placeholder="Enter mobile number"
            value={filters.mobileNumber}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 xl:gap-4 items-end">
        {/* Mobile Date */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700 flex items-center">
            <Calendar className="h-4 w-4 mr-2 text-purple-600" />
            Mobile Date
          </label>
          <input
            type="date"
            name="mobileDate"
            value={filters.mobileDate}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
          />
        </div>

        {/* Date Range Popup */}
        <div className="relative space-y-2">
          <label className="text-sm font-semibold text-gray-700 flex items-center">
            <CalendarRange className="h-4 w-4 mr-2 text-pink-600" />
            Date Range
          </label>
          <button
            onClick={toggleDatePopup}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white text-left"
          >
            Select Date Range
          </button>
          {datePopup && (
            <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg p-4 z-10 min-w-[280px]">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">From Date:</label>
                  <input
                    type="date"
                    name="fromDate"
                    value={filters.fromDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">To Date:</label>
                  <input
                    type="date"
                    name="toDate"
                    value={filters.toDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={toggleDatePopup}
                  className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-semibold transition-all duration-200"
                >
                  Apply Range
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Customer Type Radio Buttons */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700 flex items-center">
            <Users className="h-4 w-4 mr-2 text-teal-600" />
            Customer Type
          </label>
          <div className="flex items-center space-x-4 px-4 py-3 border border-gray-300 rounded-xl bg-gray-50">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="customerType"
                value="Customer"
                checked={filters.customerType === "Customer"}
                onChange={handleChange}
                className="text-blue-500 focus:ring-blue-500"
              />
              <UserCheck className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Customer</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="customerType"
                value="Dealer"
                checked={filters.customerType === "Dealer"}
                onChange={handleChange}
                className="text-indigo-500 focus:ring-indigo-500"
              />
              <UserX className="h-4 w-4 text-indigo-600" />
              <span className="text-sm font-medium text-gray-700">Dealer</span>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={handleSearch}
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 xl:px-6 xl:py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center justify-center space-x-2"
          >
            <Search className="h-5 w-5" />
            <span>Search</span>
          </button>
          <button
            onClick={handleClear}
            className="flex-1 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-4 py-2 xl:px-6 xl:py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center justify-center space-x-2"
          >
            <X className="h-5 w-5" />
            <span>Clear</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default Filters

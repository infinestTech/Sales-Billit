"use client"

import { useEffect, useRef, useState } from "react"
import { RefreshCw, UserCheck, UserPlus } from "lucide-react"

export default function CustomerForm({ formData, setFormData, disabled, onBillNumberChange, onRegenerateBillNumber, shopId }) {
  const [suggestions, setSuggestions] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedExisting, setSelectedExisting] = useState(null)
  const debounceRef = useRef(null)
  const dropdownRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const searchCustomers = async (value) => {
    if (!shopId || value.trim().length < 3) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }
    setSearchLoading(true)
    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/search-customers-by-mobile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mobileNumber: value.trim(), userId: shopId }),
      })
      const data = await res.json()
      if (res.ok && data.customers.length > 0) {
        setSuggestions(data.customers)
        setShowDropdown(true)
      } else {
        setSuggestions([])
        setShowDropdown(false)
      }
    } catch {
      setSuggestions([])
      setShowDropdown(false)
    } finally {
      setSearchLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    if (name === "billNo") {
      onBillNumberChange(value)
    } else if (name === "mobileNumber") {
      // Clear existing selection when user edits the number
      setSelectedExisting(null)
      setFormData((prev) => {
        const { existingCustomerId: _dropped, ...rest } = prev
        return { ...rest, mobileNumber: value, clientName: selectedExisting ? "" : prev.clientName }
      })
      // Debounce search
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => searchCustomers(value), 400)
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }))
    }
  }

  const handleSelectExisting = (customer) => {
    setSelectedExisting(customer)
    setFormData((prev) => ({
      ...prev,
      clientName: customer.clientName,
      mobileNumber: customer.mobileNumber,
      existingCustomerId: customer.id,
    }))
    setSuggestions([])
    setShowDropdown(false)
  }

  const handleCreateNew = () => {
    setSelectedExisting(null)
    setShowDropdown(false)
    setFormData((prev) => {
      const { existingCustomerId: _dropped, ...rest } = prev
      return { ...rest, clientName: "" }
    })
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-4">
      {/* First Row */}
      <div>
        <label className="block text-gray-700 font-medium mb-2">Client Name</label>
        <input
          type="text"
          name="clientName"
          placeholder="Enter client name"
          value={formData.clientName || ""}
          onChange={handleInputChange}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {selectedExisting && (
          <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
            <UserCheck className="h-3 w-3" />
            Adding mobiles to existing record{selectedExisting.lastBillNo ? ` (${selectedExisting.lastBillNo})` : ""}
          </p>
        )}
      </div>

      <div className="relative" ref={dropdownRef}>
        <label className="block text-gray-700 font-medium mb-2">Mobile Number</label>
        <div className="relative">
          <input
            type="tel"
            name="mobileNumber"
            placeholder="Enter mobile number"
            value={formData.mobileNumber || ""}
            onChange={handleInputChange}
            disabled={disabled}
            autoComplete="off"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {searchLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <RefreshCw className="h-4 w-4 text-gray-400 animate-spin" />
            </div>
          )}
        </div>

        {/* Customer suggestion dropdown */}
        {showDropdown && suggestions.length > 0 && (
          <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-100">
              Existing customers — select to pre-fill
            </div>
            {suggestions.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelectExisting(c)}
                className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-gray-50 last:border-0 flex items-start gap-2 transition-colors"
              >
                <UserCheck className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-800">{c.clientName}</p>
                  <p className="text-xs text-gray-500">{c.mobileNumber}{c.lastBillNo ? ` · Last: ${c.lastBillNo}` : ""}</p>
                </div>
              </button>
            ))}
            <button
              type="button"
              onClick={handleCreateNew}
              className="w-full text-left px-3 py-2.5 hover:bg-green-50 flex items-center gap-2 text-green-700 transition-colors"
            >
              <UserPlus className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium">Create as new customer</span>
            </button>
          </div>
        )}
      </div>

      <div>
        <label className="block text-gray-700 font-medium mb-2">No. of Mobile</label>
        <input
          type="number"
          name="noOfMobile"
          placeholder="Enter number of mobiles"
          min="1"
          max="15"
          value={formData.noOfMobile || ""}
          onChange={handleInputChange}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* Second Row */}
      <div>
        <label className="block text-gray-700 font-medium mb-2">Bill Number</label>
        <div className="flex gap-2">
          <input
            type="text"
            name="billNo"
            placeholder="e.g., CUST-0001"
            value={formData.billNo || ""}
            onChange={handleInputChange}
            disabled={disabled}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={onRegenerateBillNumber}
            disabled={disabled}
            className="px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-300 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Generate new sequential bill number"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">Auto-generated, but editable</p>
      </div>

      <div>
        <label className="block text-gray-700 font-medium mb-2">Technician Name</label>
        <input
          type="text"
          name="technician"
          placeholder="Enter technician name"
          value={formData.technician || ""}
          onChange={handleInputChange}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  )
}

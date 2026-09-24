"use client"

import { useEffect, useRef, useState } from "react"
import { MessageCircle, RefreshCw, UserCheck, UserPlus, User, Phone, Smartphone, FileText, Wrench, IndianRupee } from "lucide-react"
import { useShopWhatsappConfig } from "@/hooks/useShopWhatsappConfig"

const labelCls = "mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700"
const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-60"

export default function CustomerForm({ formData, setFormData, disabled, onBillNumberChange, onRegenerateBillNumber, shopId }) {
  const [suggestions, setSuggestions] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedExisting, setSelectedExisting] = useState(null)
  const debounceRef = useRef(null)
  const dropdownRef = useRef(null)
  // WhatsApp Number field is only active when the admin has enabled WA for this shop
  const waShopEnabled = useShopWhatsappConfig()
  const waFieldDisabled = disabled || waShopEnabled !== true

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
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
        <div className="rounded-lg bg-blue-50 p-1.5 text-blue-600">
          <User className="h-4 w-4" />
        </div>
        <h4 className="text-sm font-semibold text-gray-900">Customer Details</h4>
      </div>
    <div className="grid grid-cols-1 gap-x-4 gap-y-5 p-5 sm:grid-cols-2 xl:grid-cols-3">
      <div>
        <label className={labelCls}>
          <User className="h-3.5 w-3.5 text-gray-400" />
          Client Name <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          name="clientName"
          placeholder="Enter client name"
          value={formData.clientName || ""}
          onChange={handleInputChange}
          disabled={disabled}
          className={inputCls}
        />
        {selectedExisting && (
          <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
            <UserCheck className="h-3 w-3" />
            Adding mobiles to existing record{selectedExisting.lastBillNo ? ` (${selectedExisting.lastBillNo})` : ""}
          </p>
        )}
      </div>

      <div className="relative" ref={dropdownRef}>
        <label className={labelCls}>
          <Phone className="h-3.5 w-3.5 text-gray-400" />
          Mobile Number <span className="text-rose-500">*</span>
        </label>
        <div className="relative">
          <input
            type="tel"
            name="mobileNumber"
            placeholder="Enter mobile number"
            value={formData.mobileNumber || ""}
            onChange={handleInputChange}
            disabled={disabled}
            autoComplete="off"
            className={inputCls}
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
        <label className={labelCls}>
          <Smartphone className="h-3.5 w-3.5 text-gray-400" />
          No. of Mobiles <span className="text-rose-500">*</span>
        </label>
        <input
          type="number"
          name="noOfMobile"
          placeholder="1 – 15"
          min="1"
          max="15"
          value={formData.noOfMobile || ""}
          onChange={handleInputChange}
          disabled={disabled}
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>
          <FileText className="h-3.5 w-3.5 text-gray-400" />
          Bill Number <span className="text-rose-500">*</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            name="billNo"
            placeholder="e.g., CUST-0001"
            value={formData.billNo || ""}
            onChange={handleInputChange}
            disabled={disabled}
            className={`${inputCls} flex-1 font-mono`}
          />
          <button
            type="button"
            onClick={onRegenerateBillNumber}
            disabled={disabled}
            className="rounded-lg border border-gray-300 bg-white px-3 text-gray-600 shadow-sm transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            title="Generate new sequential bill number"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-400">Auto-generated, but editable</p>
      </div>

      <div>
        <label className={labelCls}>
          <Wrench className="h-3.5 w-3.5 text-gray-400" />
          Technician Name
        </label>
        <input
          type="text"
          name="technician"
          placeholder="Optional"
          value={formData.technician || ""}
          onChange={handleInputChange}
          disabled={disabled}
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>
          <IndianRupee className="h-3.5 w-3.5 text-gray-400" />
          Estimated Cost
        </label>
        <input
          type="number"
          name="estimatedCost"
          placeholder="₹ 0"
          min="0"
          value={formData.estimatedCost ?? ""}
          onChange={handleInputChange}
          disabled={disabled}
          className={inputCls}
        />
      </div>

      <div>
        <label className={`${labelCls} ${waShopEnabled === true ? "" : "text-gray-400"}`}>
          <MessageCircle className={`h-3.5 w-3.5 ${waShopEnabled === true ? "text-green-600" : "text-gray-400"}`} />
          WhatsApp Number
          {waShopEnabled !== true && (
            <span className="ml-auto rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
              Disabled
            </span>
          )}
        </label>
        <input
          type="tel"
          name="whatsappNumber"
          placeholder="Same as mobile number if empty"
          value={formData.whatsappNumber || ""}
          onChange={handleInputChange}
          disabled={waFieldDisabled}
          className={inputCls}
        />
        <p className="mt-1 text-xs text-gray-400">
          {waShopEnabled === true
            ? "Used for WhatsApp notifications \u2014 overrides mobile number if provided"
            : "Enable WhatsApp in the admin portal to use this field"}
        </p>
      </div>
    </div>
    </div>
  )
}

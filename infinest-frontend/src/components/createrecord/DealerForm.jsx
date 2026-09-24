"use client"

import { useState, useEffect, useRef } from "react"
import { PlusCircle, User, Hash, Smartphone, FileText, Wrench, RefreshCw, UserCheck, Phone, Search, ChevronDown, Store, X } from "lucide-react"
import { logAndNotify, logSuccess } from "@/utils/logger"

const labelCls = "mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700"
const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-60"

export default function DealerForm({ dealers, formData, setFormData, handleCreateDealer, disabled, onBillNumberChange, onRegenerateBillNumber }) {
  const [dealerSearch, setDealerSearch] = useState("")
  const [dealerDropdownOpen, setDealerDropdownOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const dealerDropdownRef = useRef(null)

  const filteredDealers = dealers.filter((dealer) =>
    dealer.clientName.toLowerCase().includes(dealerSearch.toLowerCase())
  )

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dealerDropdownRef.current && !dealerDropdownRef.current.contains(e.target)) {
        setDealerDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleDealerSelect = (clientName) => {
    setFormData((prev) => ({ ...prev, selectedDealer: clientName }))
    setDealerSearch("")
    setDealerDropdownOpen(false)
  }

  const handleDealerCreate = async () => {
    // Add validation for dealerName and dealerNumber
    if (!(formData.dealerName || "").trim()) {
      logAndNotify("Dealer Name cannot be empty.", "warning")
      return
    }

    if (!(formData.dealerNumber || "").trim()) {
      logAndNotify("Dealer Number cannot be empty.", "warning")
      return
    }

    // Ensure dealerNumber is a string (though it should be from the input)
    const success = await handleCreateDealer(formData.dealerName, formData.dealerNumber)

    if (success) {
      logSuccess("Dealer created successfully!")
      setFormData((prev) => ({
        ...prev,
        selectedDealer: prev.dealerName.trim(),
        dealerName: "",
        dealerNumber: "",
      }))
      setShowCreate(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-blue-50 p-1.5 text-blue-600">
            <Store className="h-4 w-4" />
          </div>
          <h4 className="text-sm font-semibold text-gray-900">Dealer Details</h4>
        </div>
        {!showCreate && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            disabled={disabled}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            New Dealer
          </button>
        )}
      </div>

      {/* Inline create-dealer panel */}
      {showCreate && (
        <div className="border-b border-gray-100 bg-blue-50/40 px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Add a new dealer</p>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-md p-1 text-gray-400 transition-colors hover:bg-white hover:text-gray-600"
              title="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <label className={labelCls}>
                <User className="h-3.5 w-3.5 text-gray-400" />
                Dealer Name
              </label>
              <input
                type="text"
                value={formData.dealerName || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, dealerName: e.target.value }))}
                placeholder="Enter dealer name"
                disabled={disabled}
                autoFocus
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>
                <Hash className="h-3.5 w-3.5 text-gray-400" />
                Dealer Number
              </label>
              <input
                type="text"
                value={formData.dealerNumber || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, dealerNumber: e.target.value }))}
                placeholder="Enter dealer number"
                disabled={disabled}
                className={inputCls}
              />
            </div>
            <button
              type="button"
              onClick={handleDealerCreate}
              disabled={disabled}
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PlusCircle className="h-4 w-4" />
              Create Dealer
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-x-4 gap-y-5 p-5 sm:grid-cols-2 xl:grid-cols-3">
          <div ref={dealerDropdownRef}>
            <label className={labelCls}>
              <User className="h-3.5 w-3.5 text-gray-400" />
              Select Dealer <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => !disabled && setDealerDropdownOpen((prev) => !prev)}
                disabled={disabled}
                className={`${inputCls} flex items-center justify-between text-left`}
              >
                <span className={formData.selectedDealer ? "" : "text-gray-400"}>
                  {formData.selectedDealer || "Select Dealer"}
                </span>
                <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${dealerDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {dealerDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                  <div className="p-2 border-b border-gray-100">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={dealerSearch}
                        onChange={(e) => setDealerSearch(e.target.value)}
                        placeholder="Search dealer..."
                        autoFocus
                        className="w-full pl-8 pr-3 py-2 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <ul className="max-h-48 overflow-y-auto py-1">
                    <li>
                      <button
                        type="button"
                        onClick={() => handleDealerSelect("")}
                        className="w-full text-left px-4 py-2 text-sm text-gray-500 hover:bg-gray-50"
                      >
                        Select Dealer
                      </button>
                    </li>
                    {filteredDealers.length > 0 ? (
                      filteredDealers.map((dealer) => (
                        <li key={dealer.id}>
                          <button
                            type="button"
                            onClick={() => handleDealerSelect(dealer.clientName)}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 text-gray-900 ${formData.selectedDealer === dealer.clientName ? "bg-blue-50 font-medium text-blue-700" : ""}`}
                          >
                            {dealer.clientName}
                          </button>
                        </li>
                      ))
                    ) : (
                      <li className="px-4 py-2 text-sm text-gray-400">
                        No dealers found —{" "}
                        <button
                          type="button"
                          onClick={() => {
                            setDealerDropdownOpen(false)
                            setShowCreate(true)
                          }}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          create one
                        </button>
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className={labelCls}>
              <Smartphone className="h-3.5 w-3.5 text-gray-400" />
              No. of Mobiles <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              value={formData.noOfMobile || ""}
              disabled={disabled}
              placeholder="Number of devices"
              min="1"
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, noOfMobile: Number.parseInt(e.target.value, 10) || 0 }))
              }
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
                value={formData.billNo || ""}
                placeholder="e.g., DEAL-0001"
                onChange={(e) => onBillNumberChange(e.target.value)}
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
              value={formData.technician || ""}
              disabled={disabled}
              placeholder="Optional"
              onChange={(e) => setFormData((prev) => ({ ...prev, technician: e.target.value }))}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>
              <UserCheck className="h-3.5 w-3.5 text-gray-400" />
              Vendor Name
            </label>
            <input
              type="text"
              value={formData.vendorName || ""}
              disabled={disabled}
              onChange={(e) => setFormData((prev) => ({ ...prev, vendorName: e.target.value }))}
              placeholder="Optional"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>
              <Phone className="h-3.5 w-3.5 text-gray-400" />
              Vendor Number
            </label>
            <input
              type="text"
              value={formData.vendorNumber || ""}
              disabled={disabled}
              onChange={(e) => setFormData((prev) => ({ ...prev, vendorNumber: e.target.value }))}
              placeholder="Optional"
              className={inputCls}
            />
          </div>
      </div>
    </div>
  )
}

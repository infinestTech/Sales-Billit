"use client"

import { useState, useEffect, useRef } from "react"
import { PlusCircle, User, Hash, Smartphone, FileText, Wrench, Users, RefreshCw, UserCheck, Phone, Search, ChevronDown } from "lucide-react"
import { logAndNotify, logSuccess } from "@/utils/logger"

export default function DealerForm({ dealers, formData, setFormData, handleCreateDealer, disabled, onBillNumberChange, onRegenerateBillNumber }) {
  const [dealerSearch, setDealerSearch] = useState("")
  const [dealerDropdownOpen, setDealerDropdownOpen] = useState(false)
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
    if (!formData.dealerName.trim()) {
      logAndNotify("Dealer Name cannot be empty.", "warning")
      return
    }

    if (!formData.dealerNumber.trim()) {
      logAndNotify("Dealer Number cannot be empty.", "warning")
      return
    }

    // Ensure dealerNumber is a string (though it should be from the input)
    const success = await handleCreateDealer(formData.dealerName, formData.dealerNumber)

    if (success) {
      logSuccess("Dealer created successfully!")
      setFormData((prev) => ({
        ...prev,
        dealerName: "",
        dealerNumber: "",
      }))
    }
  }

  return (
    <div className="space-y-4 xl:space-y-8">
      {/* Create New Dealer Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 xl:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 xl:mb-6">
          <PlusCircle className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create New Dealer</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              <User className="h-4 w-4 text-gray-500" />
              Dealer Name
            </label>
            <input
              type="text"
              value={formData.dealerName || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, dealerName: e.target.value }))}
              placeholder="Enter dealer name"
              disabled={disabled}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-4 py-3 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              <Hash className="h-4 w-4 text-gray-500" />
              Dealer Number
            </label>
            <input
              type="text"
              value={formData.dealerNumber || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, dealerNumber: e.target.value }))}
              placeholder="Enter dealer number"
              disabled={disabled}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-4 py-3 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleDealerCreate}
              disabled={disabled}
              className="w-full flex items-center justify-center gap-2 rounded-md bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all font-medium"
            >
              <PlusCircle className="h-4 w-4" />
              Create Dealer
            </button>
          </div>
        </div>
      </div>

      {/* Select Existing Dealer Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 xl:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 xl:mb-6">
          <Users className="h-5 w-5 text-green-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Dealer Information</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2" ref={dealerDropdownRef}>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              <User className="h-4 w-4 text-gray-500" />
              Select Dealer
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => !disabled && setDealerDropdownOpen((prev) => !prev)}
                disabled={disabled}
                className="w-full flex items-center justify-between rounded-md border border-gray-300 dark:border-gray-600 px-4 py-3 bg-white dark:bg-gray-700 text-left text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className={formData.selectedDealer ? "" : "text-gray-400 dark:text-gray-500"}>
                  {formData.selectedDealer || "Select Dealer"}
                </span>
                <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${dealerDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {dealerDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-lg">
                  <div className="p-2 border-b border-gray-200 dark:border-gray-600">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={dealerSearch}
                        onChange={(e) => setDealerSearch(e.target.value)}
                        placeholder="Search dealer..."
                        autoFocus
                        className="w-full pl-8 pr-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-500 dark:bg-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  </div>
                  <ul className="max-h-48 overflow-y-auto py-1">
                    <li>
                      <button
                        type="button"
                        onClick={() => handleDealerSelect("")}
                        className="w-full text-left px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600"
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
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-green-50 dark:hover:bg-gray-600 text-gray-900 dark:text-white ${formData.selectedDealer === dealer.clientName ? "bg-green-50 dark:bg-gray-600 font-medium" : ""}`}
                          >
                            {dealer.clientName}
                          </button>
                        </li>
                      ))
                    ) : (
                      <li className="px-4 py-2 text-sm text-gray-400 dark:text-gray-500">No dealers found</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              <Smartphone className="h-4 w-4 text-gray-500" />
              No. of Mobile
            </label>
            <input
              type="number"
              value={formData.noOfMobile || ""}
              disabled={disabled}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, noOfMobile: Number.parseInt(e.target.value, 10) || 0 }))
              }
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-4 py-3 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              <FileText className="h-4 w-4 text-gray-500" />
              Bill Number
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.billNo || ""}
                placeholder="e.g., DEAL-0001"
                onChange={(e) => onBillNumberChange(e.target.value)}
                disabled={disabled}
                className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 px-4 py-3 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={onRegenerateBillNumber}
                disabled={disabled}
                className="px-3 py-3 bg-green-100 hover:bg-green-200 text-green-700 border border-green-300 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:bg-green-800 dark:hover:bg-green-700 dark:text-green-200 dark:border-green-600"
                title="Generate new sequential bill number"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Auto-generated, but editable</p>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              <Wrench className="h-4 w-4 text-gray-500" />
              Technician Name
            </label>
            <input
              type="text"
              value={formData.technician || ""}
              disabled={disabled}
              onChange={(e) => setFormData((prev) => ({ ...prev, technician: e.target.value }))}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-4 py-3 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              <UserCheck className="h-4 w-4 text-gray-500" />
              Vendor Name
            </label>
            <input
              type="text"
              value={formData.vendorName || ""}
              disabled={disabled}
              onChange={(e) => setFormData((prev) => ({ ...prev, vendorName: e.target.value }))}
              placeholder="Enter vendor name"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-4 py-3 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              <Phone className="h-4 w-4 text-gray-500" />
              Vendor Number
            </label>
            <input
              type="text"
              value={formData.vendorNumber || ""}
              disabled={disabled}
              onChange={(e) => setFormData((prev) => ({ ...prev, vendorNumber: e.target.value }))}
              placeholder="Enter vendor number"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-4 py-3 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

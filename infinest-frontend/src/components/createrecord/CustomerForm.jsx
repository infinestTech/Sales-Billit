"use client"

import { RefreshCw } from "lucide-react"

export default function CustomerForm({ formData, setFormData, disabled, onBillNumberChange, onRegenerateBillNumber }) {
  const handleInputChange = (e) => {
    const { name, value } = e.target
    if (name === 'billNo') {
      onBillNumberChange(value)
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }))
    }
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
      </div>

      <div>
        <label className="block text-gray-700 font-medium mb-2">Mobile Number</label>
        <input
          type="tel"
          name="mobileNumber"
          placeholder="Enter mobile number"
          value={formData.mobileNumber || ""}
          onChange={handleInputChange}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        />
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

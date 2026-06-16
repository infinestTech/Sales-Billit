"use client"

import { useState, useEffect } from "react"
import CustomerForm from "./CustomerForm"
import DealerForm from "./DealerForm"
import MobileEntryTable from "./MobileEntryTable"
import RecordTable from "@/components/tables/RecordTable"
import { Plus, Check, X, AlertTriangle } from "lucide-react"
import { usePlanFeatures } from "@/context/PlanFeatureContext"
import { logAndNotify, logError, logSuccess, logSystem } from "@/utils/logger"


export default function CreateRecordForm({ shopId, isLimitReached, setIsLimitReached }) {
  const { features, loading } = usePlanFeatures()
  const [customerType, setCustomerType] = useState("Customer")
  const [formData, setFormData] = useState({})
  const [rows, setRows] = useState([])
  const [dealers, setDealers] = useState([])
  const [isTableVisible, setIsTableVisible] = useState(false)
  const [recordTableKey, setRecordTableKey] = useState(0)
  const [billNumberTimeout, setBillNumberTimeout] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)


  useEffect(() => {
    if (customerType === "Dealer" && shopId) fetchDealers()
    // Auto-generate bill number when customer type changes or component mounts
    generateSequentialBillNumber()
  }, [customerType, shopId])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (billNumberTimeout) {
        clearTimeout(billNumberTimeout)
      }
    }
  }, [billNumberTimeout])

  const generateSequentialBillNumber = async () => {
    try {
      const token = localStorage.getItem("token")
      if (!token) {
        logError("No token found for generating bill number", new Error("Missing authentication token"))
        return
      }

      const prefix = customerType === "Customer" ? "CUST" : "DEAL"
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/next-bill-number`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          prefix: prefix,
          userId: shopId
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        logError("Failed to generate bill number", new Error(data.error || "Unknown error"))
        // Fallback to sequential numbering starting from 0001 if API doesn't exist
        const fallbackNumber = `${prefix}-0001`
        setFormData(prev => ({
          ...prev,
          billNo: fallbackNumber
        }))
        logSystem("Using fallback bill number generation", shopId)
        return
      }

      setFormData(prev => ({
        ...prev,
        billNo: data.billNumber
      }))
    } catch (error) {
      logError("Error generating bill number", error)
      // Fallback to sequential numbering starting from 0001
      const prefix = customerType === "Customer" ? "CUST" : "DEAL"
      const fallbackNumber = `${prefix}-0001`
      setFormData(prev => ({
        ...prev,
        billNo: fallbackNumber
      }))
      logSystem("Using fallback bill number generation due to error", shopId)
    }
  }

  const checkBillNumberExists = async (billNumber) => {
    try {
      const token = localStorage.getItem("token")
      if (!token) return false

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/check-bill-number`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          billNumber: billNumber,
          userId: shopId
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        logError("Failed to check bill number", new Error(data.error || "Unknown error"))
        return false // If API fails, allow the bill number
      }

      return data.exists
    } catch (error) {
      logError("Error checking bill number", error)
      return false // If error, allow the bill number
    }
  }

  const handleBillNumberChange = async (newBillNumber) => {
    setFormData(prev => ({
      ...prev,
      billNo: newBillNumber
    }))

    // Clear existing timeout
    if (billNumberTimeout) {
      clearTimeout(billNumberTimeout)
    }

    // Set new timeout for validation (debounce)
    const timeoutId = setTimeout(async () => {
      if (newBillNumber.trim().length > 0) {
        const exists = await checkBillNumberExists(newBillNumber.trim())
        if (exists) {
          logAndNotify("This bill number already exists. Please use a different number.", "warning", shopId)
        }
      }
    }, 1000) // Wait 1 second after user stops typing

    setBillNumberTimeout(timeoutId)
  }


  const fetchDealers = async () => {
    try {
      const token = localStorage.getItem("token")
      if (!token) {
        logError("No token found for fetching dealers", new Error("Missing authentication token"))
        return
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/dealers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ shop_id: shopId }),
      })

      const data = await response.json()
      if (!response.ok) {
        logError("Failed to fetch dealers", new Error(data.error || "Unknown error"))
        return
      }
      setDealers(data)
    } catch (error) {
      logError("Failed to fetch dealers", error)
    }
  }


  const handleCreateDealer = async (dealerName, dealerNumber) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/createdealer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          clientName: dealerName,
          mobileNumber: dealerNumber,
          userId: shopId,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        logError("Dealer creation failed", new Error(data.error || "Unknown error"))
        return false
      }

      setDealers((prev) => [
        ...prev,
        {
          id: data.dealer._id,
          clientName: data.dealer.client_name,
          mobileNumber: data.dealer.mobile_number,
        },
      ])
      logSuccess("Dealer created successfully!", shopId)
      return true
    } catch (error) {
      logError("Error creating dealer", error)
      return false
    }
  }


  const validateFormData = () => {
    if (customerType === "Customer") {
      // Allow any customer data - no validation for duplicates
      if (!formData.clientName || formData.clientName.trim().length === 0) return false
      if (!formData.mobileNumber || formData.mobileNumber.trim().length === 0) return false
    }

    if (customerType === "Dealer") {
      if (!formData.selectedDealer || !formData.selectedDealer.trim()) return false
    }

    if (!formData.noOfMobile || formData.noOfMobile < 1 || formData.noOfMobile > 15) return false
    // Validate bill number format and presence
  if (!formData.billNo || formData.billNo.trim().length === 0) return false
  // Technician is optional. If provided, enforce a minimum length of 2 chars.
  if (formData.technician && formData.technician.trim().length > 0 && formData.technician.trim().length < 2) return false

    return true
  }


  const generateRows = (count) => {
    setRows(
      Array.from({ length: count }, () => ({
        description: "",
        descriptionIssue: "",
        imei: "",
        date: new Date().toISOString().split("T")[0],
      })),
    )
    setIsTableVisible(true)
  }
  const handleSubmit = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      // Validate bill number uniqueness before submission
      if (formData.billNo && formData.billNo.trim().length > 0) {
        const exists = await checkBillNumberExists(formData.billNo.trim())
        if (exists) {
          logAndNotify("This bill number already exists. Please use a different number or regenerate a new one.", "error", shopId)
          return
        }
      }

      const mobileNameIssues = rows.map((row) => ({
        mobileName: row.description,
        model: row.model || "",
        imei: row.imei || "",
        issues: row.descriptionIssue,
        date: row.date,
        ready: false,
        delivered: false,
        return: false,
      }));

      // Validate every row has a mobile brand selected
      const emptyBrandIndex = mobileNameIssues.findIndex((m) => !m.mobileName || !m.mobileName.trim())
      if (emptyBrandIndex !== -1) {
        logAndNotify(`Row ${emptyBrandIndex + 1}: Mobile Name is required. Please select a brand.`, "warning", shopId)
        return
      }

      const dataToSend = {
        ...formData,
        customerType,
        MobileName: mobileNameIssues,
        userId: shopId,
      };

      if (customerType === "Dealer") {
        const matchedDealer = dealers.find((d) => d.clientName === formData.selectedDealer);
        if (!matchedDealer) {
          logAndNotify("Selected dealer not found. Please try again.", "error", shopId);
          return;
        }
        dataToSend.dealerId = matchedDealer.id;
        delete dataToSend.dealerName;
        delete dataToSend.dealerNumber;
      }

      const endpoint = customerType === "Customer" ? "createcustomer" : "updatedealer";
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(dataToSend),
      });

      const result = await response.json();
      if (!response.ok) {
        logError("Record submission failed", new Error(result.error || "Unknown error"));
        return;
      }

      // Success - show notification
      logSuccess("Record created successfully!", shopId);

      // Reset state
      setIsTableVisible(false);
      setRows([]);
      setFormData({});
      setRecordTableKey((prev) => prev + 1);

      // Generate new bill number for next record
      generateSequentialBillNumber();
    } catch (error) {
      logError("Submit failed", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Limit Warning */}
      {isLimitReached && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div>
              <h3 className="text-red-800 font-medium">Plan Limit Reached</h3>
              <p className="text-red-700 text-sm">
                You have reached your plan's records Creation limit. Upgrade to Premium to add more.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Customer Type Selection */}
      <div className="mb-6">
        <div className="flex items-center space-x-4">
          <label className="text-gray-700 font-medium">Customer Type:</label>
          <select
            value={customerType}
            onChange={(e) => setCustomerType(e.target.value)}
            disabled={isLimitReached}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="Customer">Customer</option>
            <option value="Dealer">Dealer</option>
          </select>
        </div>
      </div>

      {/* Form Section */}
      <div className="space-y-4">
        {customerType === "Customer" ? (
          <CustomerForm 
            formData={formData} 
            setFormData={setFormData} 
            disabled={isLimitReached} 
            onBillNumberChange={handleBillNumberChange}
            onRegenerateBillNumber={generateSequentialBillNumber}
          />
        ) : (
          <DealerForm
            dealers={dealers}
            formData={formData}
            setFormData={setFormData}
            disabled={isLimitReached}
            handleCreateDealer={handleCreateDealer}
            onBillNumberChange={handleBillNumberChange}
            onRegenerateBillNumber={generateSequentialBillNumber}
          />
        )}
      </div>

      {/* Add Mobile Entries Button */}
      <div className="mb-6">
        <button
          onClick={() => {
            if (loading) {
              logAndNotify("Please wait, loading your plan features...", "warning", shopId)
              return
            }
            const dealerMobileLimit = features.dealer_mobile_create_limit?.maxPerCreation ?? 5
            if (customerType === "Dealer" && formData.noOfMobile > dealerMobileLimit) {
              logAndNotify(`Your plan allows only ${dealerMobileLimit} mobiles per creation for dealers.`, "warning", shopId)
              return
            }
            if (!validateFormData()) {
              logAndNotify("Please complete all required fields before adding mobile entries.", "warning", shopId)
              return
            }
            generateRows(formData.noOfMobile)
          }}
          disabled={isLimitReached}
          className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-md font-medium transition-colors duration-200 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" />
          <span>Add Mobile Entries</span>
        </button>
      </div>

      {/* Mobile Entry Modal */}
      {isTableVisible && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setIsTableVisible(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 lg:p-4">
            <div className="relative w-full max-w-6xl bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden max-h-[95vh] lg:max-h-[90vh]">
              {/* Modal Header */}
              <div className="bg-gray-50 px-4 py-3 xl:px-6 xl:py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Add Mobile Entries</h2>
                <button
                  onClick={() => setIsTableVisible(false)}
                  className="p-1 hover:bg-gray-200 rounded-md transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                <MobileEntryTable rows={rows} setRows={setRows} />
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleSubmit}
                    disabled={isLimitReached || isSubmitting}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md font-medium transition-colors duration-200 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Check className="h-4 w-4" />
                    <span>{isSubmitting ? "Submitting..." : "Submit Record"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Record Table */}
      {shopId && <RecordTable key={recordTableKey} shop_id={shopId} setIsLimitReached={setIsLimitReached} />}
    </div>
  )
}

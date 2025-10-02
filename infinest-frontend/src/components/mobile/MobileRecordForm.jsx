


"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Plus, 
  Minus, 
  User, 
  Users, 
  Phone, 
  Save, 
  Trash2, 
  Filter,
  Search,
  Eye,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronUp,
  Edit,
  RotateCcw,
  Truck,
  DollarSign,
  Smartphone,
  FileText
} from "lucide-react"
import { usePlanFeatures } from "@/context/PlanFeatureContext"
import { logAndNotify, logError, logSuccess } from "@/utils/logger"
import api from "../api"
import MobileBillGenerator from "./MobileBillGenerator"

export default function MobileRecordForm({ shopId, isLimitReached, setIsLimitReached }) {
  const { features, loading } = usePlanFeatures()
  const [activeTab, setActiveTab] = useState("create") // create, view
  const [customerType, setCustomerType] = useState("Customer")
  const [formData, setFormData] = useState({})
  const [rows, setRows] = useState([])
  const [dealers, setDealers] = useState([])
  const [records, setRecords] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [isLoading, setIsLoading] = useState(false)
  const [showNewDealerForm, setShowNewDealerForm] = useState(false)
  const [newDealer, setNewDealer] = useState({ name: "", phone: "" })
  
  // Enhanced functionality state
  const [dateFilters, setDateFilters] = useState({
    fromDate: "",
    toDate: "",
    mobileDate: ""
  })
  const [showFilters, setShowFilters] = useState(false)
  const [expandedRecords, setExpandedRecords] = useState(new Set())
  const [billNumberTimeout, setBillNumberTimeout] = useState(null)
  
  // Bill generator state
  const [showBillGenerator, setShowBillGenerator] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [shopData, setShopData] = useState(null)

  useEffect(() => {
    if (customerType === "Dealer" && shopId) fetchDealers()
    generateSequentialBillNumber()
  }, [customerType, shopId])

  useEffect(() => {
    if (activeTab === "view" && shopId) {
      fetchRecords()
      fetchShopData()
    }
  }, [activeTab, shopId])

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
        logAndNotify("Using fallback bill number generation", "info", shopId)
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
      logAndNotify("Using fallback bill number generation due to error", "info", shopId)
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

  const generateBillNumber = () => {
    generateSequentialBillNumber()
  }

  const fetchDealers = async () => {
    try {
      const token = localStorage.getItem("token")
      if (!token) return

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/dealers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ shop_id: shopId }),
      })

      const data = await response.json()
      if (response.ok) {
        setDealers(data)
      }
    } catch (error) {
      logError("Failed to fetch dealers", error)
    }
  }

  const fetchRecords = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem("token")
      if (!token || !shopId) return

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/records`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ shopId }),
      })

      const data = await response.json()
      if (response.ok) {
        const { mobiles, customers, dealers } = data
        
        const customersWithMobiles = customers.map((customer) => ({
          ...customer,
          MobileName: mobiles.filter((mobile) => mobile.customer_id === customer._id),
        }))

        const dealersWithMobiles = dealers.map((dealer) => ({
          ...dealer,
          MobileName: mobiles.filter((mobile) => mobile.dealer_id === dealer._id),
        }))

        const allRecords = [...customersWithMobiles, ...dealersWithMobiles]
          .filter((record) => record.MobileName.length > 0)
          .sort((a, b) => {
            const dateA = new Date(a.MobileName[0]?.added_date || 0)
            const dateB = new Date(b.MobileName[0]?.added_date || 0)
            return dateB - dateA
          })

        setRecords(allRecords)
      } else {
        logError("Failed to fetch records", new Error(data.error || "Unknown error"))
      }
    } catch (error) {
      logError("Failed to fetch records", error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchShopData = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await api.post("/api/profile", 
        { shop_id: shopId }, 
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setShopData({
        name: response.data.shop_name,
        phone: response.data.shop_phone,
        email: response.data.shop_email,
        address: response.data.shop_address
      })
    } catch (error) {
      logError("Failed to fetch shop data", error)
    }
  }

  const handleGenerateBill = (record) => {
    setSelectedRecord(record)
    setShowBillGenerator(true)
  }

  const handleCreateDealer = async () => {
    if (!newDealer.name || !newDealer.phone) return

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/createdealer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          clientName: newDealer.name,
          mobileNumber: newDealer.phone,
          userId: shopId,
        }),
      })

      const data = await response.json()
      if (response.ok) {
        setDealers(prev => [...prev, {
          id: data.dealer._id,
          clientName: data.dealer.client_name,
          mobileNumber: data.dealer.mobile_number,
        }])
        setNewDealer({ name: "", phone: "" })
        setShowNewDealerForm(false)
        logSuccess("Dealer created successfully!")
      }
    } catch (error) {
      logError("Failed to create dealer", error)
    }
  }

  const addRow = () => {
    setRows([...rows, {
      id: Date.now(),
      description: "",
      descriptionIssue: "",
      date: new Date().toISOString().split("T")[0]
    }])
  }

  const removeRow = (id) => {
    setRows(rows.filter(row => row.id !== id))
  }

  const updateRow = (id, field, value) => {
    setRows(rows.map(row => 
      row.id === id ? { ...row, [field]: value } : row
    ))
  }

  const handleSubmit = async () => {
    // Validate bill number uniqueness before submission
    if (formData.billNo && formData.billNo.trim().length > 0) {
      const exists = await checkBillNumberExists(formData.billNo.trim())
      if (exists) {
        logAndNotify("This bill number already exists. Please use a different number or generate a new one.", "error", shopId)
        return
      }
    }

    if (customerType === "Customer") {
      // technician is optional; only validate clientName/mobileNumber and rows
      if (!formData.clientName || !formData.mobileNumber || rows.length === 0) {
        logError("Please fill all required fields", new Error("Missing required data"))
        return
      }
    } else if (customerType === "Dealer") {
      // technician is optional for dealers too
      if (!formData.selectedDealer || rows.length === 0) {
        logError("Please select a dealer and fill all required fields", new Error("Missing required data"))
        return
      }
    }

    if (!formData.noOfMobile || parseInt(formData.noOfMobile) !== rows.length) {
      logError("Number of mobiles must match the entries", new Error("Mobile count mismatch"))
      return
    }

    // Validate bill number is present
    if (!formData.billNo || formData.billNo.trim().length === 0) {
      logError("Bill number is required", new Error("Missing bill number"))
      return
    }

    try {
      setIsLoading(true)
      const token = localStorage.getItem("token")
      
      const mobileNameIssues = rows.map((row) => ({
        mobileName: row.description,
        issues: row.descriptionIssue,
        date: row.date,
        ready: false,
        delivered: false,
        return: false,
      }))

      const dataToSend = {
        ...formData,
        customerType,
        MobileName: mobileNameIssues,
        userId: shopId,
      }

      if (customerType === "Dealer") {
        const matchedDealer = dealers.find((d) => d.clientName === formData.selectedDealer)
        if (!matchedDealer) {
          logError("Selected dealer not found", new Error("Dealer not found"))
          return
        }
        dataToSend.dealerId = matchedDealer.id
        delete dataToSend.dealerName
        delete dataToSend.dealerNumber
      }

      const endpoint = customerType === "Customer" ? "createcustomer" : "updatedealer"
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(dataToSend),
      })

      const data = await response.json()
      if (response.ok) {
        logSuccess("Record created successfully!")
        setFormData({})
        setRows([])
        generateSequentialBillNumber()
        if (activeTab === "view") fetchRecords()
      } else {
        throw new Error(data.error || "Failed to create record")
      }
    } catch (error) {
      logError("Failed to create record", error)
    } finally {
      setIsLoading(false)
    }
  }

  const applyDateFilters = (record) => {
    if (!dateFilters.fromDate && !dateFilters.toDate && !dateFilters.mobileDate) {
      return true
    }

    return record.MobileName?.some(mobile => {
      const mobileDate = new Date(mobile.added_date)
      const fromDate = dateFilters.fromDate ? new Date(dateFilters.fromDate) : null
      const toDate = dateFilters.toDate ? new Date(dateFilters.toDate) : null
      const specificDate = dateFilters.mobileDate ? new Date(dateFilters.mobileDate) : null

      if (specificDate) {
        const mobileDateStr = mobileDate.toDateString()
        const specificDateStr = specificDate.toDateString()
        return mobileDateStr === specificDateStr
      }

      if (fromDate && toDate) {
        return mobileDate >= fromDate && mobileDate <= toDate
      }

      if (fromDate) {
        return mobileDate >= fromDate
      }

      if (toDate) {
        return mobileDate <= toDate
      }

      return true
    }) || false
  }

  const filteredRecords = records.filter(record => {
    const matchesSearch = record.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         record.mobile_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         record.bill_no?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const totalMobiles = record.MobileName?.length || 0
    const readyMobiles = record.MobileName?.filter(mobile => mobile.ready)?.length || 0
    const status = readyMobiles === totalMobiles && totalMobiles > 0 ? "completed" : "pending"
    
    const matchesFilter = filterType === "all" || 
                         (filterType === "pending" && status === "pending") ||
                         (filterType === "completed" && status === "completed") ||
                         (filterType === "customer" && record.customer_type === "Customer") ||
                         (filterType === "dealer" && record.customer_type === "Dealer")
    
    const matchesDateFilter = applyDateFilters(record)
    
    return matchesSearch && matchesFilter && matchesDateFilter
  })

  const toggleRecordExpansion = (recordId) => {
    const newExpanded = new Set(expandedRecords)
    if (newExpanded.has(recordId)) {
      newExpanded.delete(recordId)
    } else {
      newExpanded.add(recordId)
    }
    setExpandedRecords(newExpanded)
  }

  const toggleMobileStatus = async (mobileId, field) => {
    try {
      const token = localStorage.getItem("token")
      const response = await api.post(
        "/api/toggle-status",
        {
          id: mobileId,
          field,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (response.data) {
        await fetchRecords()
        logSuccess(`${field} status updated successfully`)
      }
    } catch (error) {
      logError(`Failed to toggle ${field} status`, error)
    }
  }

  // Add debounced update for paid amount to prevent auto-refresh
  const updatePaidAmountDebounced = useRef(null)
  
  const updatePaidAmountLocally = (recordIndex, mobileIndex, amount) => {
    // Update local state immediately
    setRecords(prevRecords => {
      const updatedRecords = [...prevRecords]
      if (updatedRecords[recordIndex] && updatedRecords[recordIndex].MobileName && updatedRecords[recordIndex].MobileName[mobileIndex]) {
        updatedRecords[recordIndex].MobileName[mobileIndex].paid_amount = amount
      }
      return updatedRecords
    })
  }

  const updatePaidAmount = async (mobileId, amount, recordIndex, mobileIndex) => {
    // Update local state immediately to prevent refresh
    updatePaidAmountLocally(recordIndex, mobileIndex, amount)
    
    // Clear previous timeout
    if (updatePaidAmountDebounced.current) {
      clearTimeout(updatePaidAmountDebounced.current)
    }
    
    // Debounce API call to prevent too many requests
    updatePaidAmountDebounced.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem("token")
        const response = await api.post(
          "/api/update-paid-amount",
          {
            id: mobileId,
            paidAmount: parseInt(amount, 10),
            updateDate: new Date().toISOString(),
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        if (response.data) {
          // Only show success message, don't refresh the entire list
          logSuccess("Paid amount updated successfully")
        }
      } catch (error) {
        logError("Failed to update paid amount", error)
        // Revert local state on error
        updatePaidAmountLocally(recordIndex, mobileIndex, 0)
      }
    }, 1000) // 1 second debounce
  }

  const clearDateFilters = () => {
    setDateFilters({
      fromDate: "",
      toDate: "",
      mobileDate: ""
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex overflow-x-auto">
          <button
            onClick={() => setActiveTab("create")}
            className={`flex-1 py-4 px-2 text-center font-medium transition-colors whitespace-nowrap min-w-0 ${
              activeTab === "create"
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Plus className="w-4 h-4 mx-auto mb-1" />
            <span className="text-xs">Create</span>
          </button>
          <button
            onClick={() => setActiveTab("view")}
            className={`flex-1 py-4 px-2 text-center font-medium transition-colors whitespace-nowrap min-w-0 ${
              activeTab === "view"
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Eye className="w-4 h-4 mx-auto mb-1" />
            <span className="text-xs">View Records</span>
          </button>
        </div>
      </div>

      {/* Create Record Tab */}
      {activeTab === "create" && (
        <div className="p-4 space-y-4">
          {/* Customer Type Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Customer Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCustomerType("Customer")}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                    customerType === "Customer"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <User className="w-4 h-4 mx-auto mb-1" />
                  Customer
                </button>
                <button
                  onClick={() => setCustomerType("Dealer")}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                    customerType === "Dealer"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <Users className="w-4 h-4 mx-auto mb-1" />
                  Dealer
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Customer/Dealer Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                {customerType === "Customer" ? "Customer" : "Dealer"} Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {customerType === "Dealer" && (
                <div className="space-y-4">
                  {showNewDealerForm && (
                    <div className="bg-blue-50 p-4 rounded-lg space-y-3">
                      <h4 className="font-medium text-gray-900">Create New Dealer</h4>
                      <input
                        type="text"
                        placeholder="Dealer Name"
                        value={newDealer.name}
                        onChange={(e) => setNewDealer(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg"
                      />
                      <input
                        type="tel"
                        placeholder="Dealer Phone Number"
                        value={newDealer.phone}
                        onChange={(e) => setNewDealer(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg"
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={handleCreateDealer}
                          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium"
                        >
                          Create Dealer
                        </button>
                        <button
                          onClick={() => setShowNewDealerForm(false)}
                          className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Dealer
                    </label>
                    <select
                      value={formData.selectedDealer || ""}
                      onChange={(e) => {
                        const dealer = dealers.find(d => d.clientName === e.target.value)
                        if (dealer) {
                          setFormData(prev => ({
                            ...prev,
                            selectedDealer: dealer.clientName,
                            dealerId: dealer.id,
                            clientName: dealer.clientName,
                            mobileNumber: dealer.mobileNumber
                          }))
                        } else {
                          setFormData(prev => ({
                            ...prev,
                            selectedDealer: "",
                            dealerId: "",
                            clientName: "",
                            mobileNumber: ""
                          }))
                        }
                      }}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a dealer</option>
                      {dealers.map(dealer => (
                        <option key={dealer.id} value={dealer.clientName}>
                          {dealer.clientName} - {dealer.mobileNumber}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setShowNewDealerForm(!showNewDealerForm)}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                    >
                      + Create New Dealer
                    </button>
                  </div>

                  {formData.selectedDealer && (
                    <div className="bg-green-50 p-3 rounded-lg">
                      <p className="text-sm text-green-700">
                        <strong>Selected Dealer:</strong> {formData.clientName} - {formData.mobileNumber}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {customerType === "Customer" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Customer Name
                    </label>
                    <input
                      type="text"
                      value={formData.clientName || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter customer name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={formData.mobileNumber || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, mobileNumber: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter phone number"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Mobiles
                </label>
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={formData.noOfMobile || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, noOfMobile: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter number of mobiles"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Technician Name
                </label>
                <input
                  type="text"
                  value={formData.technician || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, technician: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter technician name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bill Number
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={formData.billNo || ""}
                    onChange={(e) => handleBillNumberChange(e.target.value)}
                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., CUST-0001"
                  />
                  <button
                    onClick={generateBillNumber}
                    className="px-4 py-3 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                    title="Generate new sequential bill number"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Auto-generated, but editable</p>
              </div>
            </CardContent>
          </Card>

          {/* Mobile Entries */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Mobile Entries</CardTitle>
              <button
                onClick={addRow}
                className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
              </button>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Phone className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No mobile entries added yet</p>
                  <p className="text-sm">Tap the + button to add a mobile</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {rows.map((row, index) => (
                    <div key={row.id} className="bg-gray-50 p-4 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">Mobile #{index + 1}</h4>
                        <button
                          onClick={() => removeRow(row.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <input
                        type="text"
                        placeholder="Mobile Name"
                        value={row.description}
                        onChange={(e) => updateRow(row.id, "description", e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded"
                      />
                      
                      <textarea
                        placeholder="Issues/Problems"
                        value={row.descriptionIssue}
                        onChange={(e) => updateRow(row.id, "descriptionIssue", e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded h-20 resize-none"
                      />
                      
                      <input
                        type="date"
                        value={row.date}
                        onChange={(e) => updateRow(row.id, "date", e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded"
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="sticky bottom-0 bg-white p-4 border-t border-gray-200">
            <button
              onClick={handleSubmit}
              disabled={
                  isLoading || 
                  !formData.noOfMobile || 
                  rows.length === 0 ||
                  (customerType === "Customer" && (!formData.clientName || !formData.mobileNumber)) ||
                  (customerType === "Dealer" && !formData.selectedDealer)
                }
              className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              <span>{isLoading ? "Creating..." : "Create Record"}</span>
            </button>
          </div>
        </div>
      )}

      {/* View Records Tab */}
      {activeTab === "view" && (
        <div className="p-4 space-y-4">
          {/* Search and Filter */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search by name, phone, or bill number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="flex space-x-2 overflow-x-auto pb-2">
                  {[
                    { value: "all", label: "All" },
                    { value: "pending", label: "Pending" },
                    { value: "completed", label: "Completed" },
                    { value: "customer", label: "Customer" },
                    { value: "dealer", label: "Dealer" }
                  ].map(filter => (
                    <button
                      key={filter.value}
                      onClick={() => setFilterType(filter.value)}
                      className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
                        filterType === filter.value
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                {/* Date Filters Toggle */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
                  >
                    <Filter className="w-4 h-4" />
                    <span>Date Filters</span>
                    {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  
                  {(dateFilters.fromDate || dateFilters.toDate || dateFilters.mobileDate) && (
                    <button
                      onClick={clearDateFilters}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>

                {/* Date Filters */}
                {showFilters && (
                  <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          <Calendar className="w-4 h-4 inline mr-1" />
                          From Date
                        </label>
                        <input
                          type="date"
                          value={dateFilters.fromDate}
                          onChange={(e) => setDateFilters(prev => ({ ...prev, fromDate: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          <Calendar className="w-4 h-4 inline mr-1" />
                          To Date
                        </label>
                        <input
                          type="date"
                          value={dateFilters.toDate}
                          onChange={(e) => setDateFilters(prev => ({ ...prev, toDate: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          <Calendar className="w-4 h-4 inline mr-1" />
                          Specific Date
                        </label>
                        <input
                          type="date"
                          value={dateFilters.mobileDate}
                          onChange={(e) => setDateFilters(prev => ({ ...prev, mobileDate: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Records List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading records...</span>
            </div>
          ) : filteredRecords.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Eye className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Records Found</h3>
                <p className="text-gray-500">No records match your current filters.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredRecords.map((record, recordIndex) => {
                const totalMobiles = record.MobileName?.length || 0
                const readyMobiles = record.MobileName?.filter(mobile => mobile.ready)?.length || 0
                const status = readyMobiles === totalMobiles && totalMobiles > 0 ? "completed" : "pending"
                const isExpanded = expandedRecords.has(record._id)
                
                return (
                  <Card key={record._id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{record.client_name}</h3>
                          <p className="text-sm text-gray-600">{record.mobile_number}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge 
                            variant={status === "completed" ? "default" : "secondary"}
                            className={status === "completed" ? "bg-green-100 text-green-800" : ""}
                          >
                            {status === "completed" ? (
                              <CheckCircle className="w-3 h-3 mr-1" />
                            ) : (
                              <AlertTriangle className="w-3 h-3 mr-1" />
                            )}
                            {status}
                          </Badge>
                          <button
                            onClick={() => handleGenerateBill(record)}
                            className="p-1 hover:bg-blue-100 rounded text-blue-600"
                            title="Generate Bill"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleRecordExpansion(record._id)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Bill No:</span>
                          <span className="font-medium">{record.bill_no || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Type:</span>
                          <span className="font-medium">{record.customer_type}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Mobiles:</span>
                          <span className="font-medium">{totalMobiles}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Ready:</span>
                          <span className="font-medium text-green-600">
                            {readyMobiles}/{totalMobiles}
                          </span>
                        </div>
                      </div>

                      {/* Expanded Mobile Details */}
                      {isExpanded && record.MobileName && record.MobileName.length > 0 && (
                        <div className="mt-4 space-y-3 border-t pt-4">
                          <h4 className="font-medium text-gray-900 flex items-center">
                            <Smartphone className="w-4 h-4 mr-2" />
                            Mobile Devices
                          </h4>
                          {record.MobileName.map((mobile, mobileIndex) => (
                            <div key={mobile._id || mobileIndex} className="bg-gray-50 p-3 rounded-lg">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">{mobile.mobile_name}</p>
                                  <p className="text-sm text-gray-600">{mobile.issue || "No issue specified"}</p>
                                  <p className="text-xs text-gray-500">
                                    Added: {new Date(mobile.added_date).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              
                              {/* Mobile Status Controls */}
                              <div className="grid grid-cols-2 gap-2 mt-3">
                                <div className="space-y-1">
                                  <label className="text-xs text-gray-600">Ready Status</label>
                                  <button
                                    onClick={() => toggleMobileStatus(mobile._id, "ready")}
                                    className={`w-full px-2 py-1 text-xs font-medium rounded transition-colors ${
                                      mobile.ready
                                        ? "bg-green-100 text-green-800 hover:bg-green-200"
                                        : "bg-red-100 text-red-800 hover:bg-red-200"
                                    }`}
                                  >
                                    {mobile.ready ? "Ready" : "Not Ready"}
                                  </button>
                                </div>
                                
                                <div className="space-y-1">
                                  <label className="text-xs text-gray-600">Delivery Status</label>
                                  <button
                                    onClick={() => toggleMobileStatus(mobile._id, "delivered")}
                                    className={`w-full px-2 py-1 text-xs font-medium rounded transition-colors ${
                                      mobile.delivered
                                        ? "bg-blue-100 text-blue-800 hover:bg-blue-200"
                                        : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                                    }`}
                                  >
                                    <Truck className="w-3 h-3 inline mr-1" />
                                    {mobile.delivered ? "Delivered" : "Pending"}
                                  </button>
                                </div>
                                
                                <div className="space-y-1">
                                  <label className="text-xs text-gray-600">Return Status</label>
                                  <button
                                    onClick={() => toggleMobileStatus(mobile._id, "returned")}
                                    className={`w-full px-2 py-1 text-xs font-medium rounded transition-colors ${
                                      mobile.returned
                                        ? "bg-red-100 text-red-800 hover:bg-red-200"
                                        : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                                    }`}
                                  >
                                    <RotateCcw className="w-3 h-3 inline mr-1" />
                                    {mobile.returned ? "Returned" : "Active"}
                                  </button>
                                </div>
                                
                                <div className="space-y-1">
                                  <label className="text-xs text-gray-600">Paid Amount</label>
                                  <div className="flex items-center space-x-1">
                                    <DollarSign className="w-3 h-3 text-green-600" />
                                    <input
                                      type="number"
                                      value={mobile.paid_amount || ""}
                                      onChange={(e) => updatePaidAmount(mobile._id, e.target.value, recordIndex, mobileIndex)}
                                      className="flex-1 px-1 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                      placeholder="0"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Bill Generator Modal */}
      {showBillGenerator && selectedRecord && shopData && (
        <MobileBillGenerator
          record={selectedRecord}
          shopData={shopData}
          onClose={() => {
            setShowBillGenerator(false)
            setSelectedRecord(null)
          }}
        />
      )}
    </div>
  )
}








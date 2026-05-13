

"use client"

import { useEffect, useState } from "react"
import Pagination from "./Pagination"
import api from "../api"
import { Calendar, Smartphone, AlertCircle, CheckCircle, RotateCcw, DollarSign, Truck, Package, Eye } from "lucide-react"
import { useRouter } from "next/navigation"
import { jwtDecode } from "jwt-decode"
import { PAYMENT_METHOD_OPTIONS } from "@/constants/paymentMethods"




const MobileNameTable = ({ mobileData, setMobileData, onRevenueUpdate, hideActions }) => {
  const router = useRouter()
  const validMobileData = Array.isArray(mobileData) ? mobileData : []
  const [currentPage, setCurrentPage] = useState(1)
  const [sellOpen, setSellOpen] = useState(false)
  const [activeMobileIndex, setActiveMobileIndex] = useState(null)
  const [activeMobileId, setActiveMobileId] = useState(null)
  const [shopId, setShopId] = useState(null)
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [selectedSupplierId, setSelectedSupplierId] = useState("")
  const [supplierQuery, setSupplierQuery] = useState("")
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState("")
  const [productNameInput, setProductNameInput] = useState("")
  const [sellQty, setSellQty] = useState(1)
  const [paidAmount, setPaidAmount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState("")
  const [warranty, setWarranty] = useState("")
  const [selling, setSelling] = useState(false)
  const [sellDate, setSellDate] = useState(new Date().toISOString().split("T")[0])

  // Split Payment Modal States
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [activePaymentMobileId, setActivePaymentMobileId] = useState(null)
  const [activePaymentMobileIndex, setActivePaymentMobileIndex] = useState(null)
  const [newPaymentAmount, setNewPaymentAmount] = useState("")
  const [newPaymentMethod, setNewPaymentMethod] = useState("")
  const [addingPayment, setAddingPayment] = useState(false)
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 })
  const [viewPopupPosition, setViewPopupPosition] = useState({ top: 0, left: 0 })

  // Console log all mobile data with model values
  useEffect(() => {
    console.log("Mobile Data with Models:", validMobileData.map(m => ({
      name: m.mobile_name,
      model: m.model,
      id: m._id
    })))
  }, [validMobileData])




  useEffect(() => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      if (token) {
        const dec = jwtDecode(token)
        if (dec?.shop_id) setShopId(dec.shop_id)
      }
    } catch {}
  }, [])
  const itemsPerPage = 5




  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentMobileData = validMobileData.slice(indexOfFirstItem, indexOfLastItem)



  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A"
    return new Date(dateStr).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    })
  }




  const paginate = (pageNumber) => setCurrentPage(pageNumber)




  const toggleStatus = async (index, field) => {
    if (hideActions) return




    const mobile = currentMobileData[index]
    const globalIndex = indexOfFirstItem + index




    try {
      const token = localStorage.getItem("token")
      const response = await api.post(
        "/api/toggle-status",
        {
          id: mobile._id,
          field,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )




      const updated = response.data.updatedMobile
      const updatedData = [...mobileData]
      const localRecord = updatedData[globalIndex] || {}
      const merged = {
        ...localRecord,
        ...updated,
        payment: updated.payment !== undefined ? updated.payment : localRecord.payment,
        paid_amount: updated.paid_amount !== undefined ? updated.paid_amount : localRecord.paid_amount,
        deliveryDate: updated.deliveryDate,
      }
      updatedData[globalIndex] = merged




      setMobileData(updatedData)
    } catch (error) {
      console.error(`Failed to toggle ${field}:`, error.message)
    }
  }




  const updatePaidAmount = async (index, value, paymentMethod) => {
    if (hideActions) return




    const mobile = currentMobileData[index]
    const globalIndex = indexOfFirstItem + index

    // Console log the model value
    console.log("Mobile Model:", mobile.model)




    try {
      const token = localStorage.getItem("token")
      const response = await api.post(
        "/api/update-paid-amount",
        {
          id: mobile._id,
          paidAmount: Number.parseInt(value, 10),
          updateDate: new Date().toISOString(),
          payment: paymentMethod !== undefined ? paymentMethod : (mobile.payment || undefined),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )




      const updated = response.data.updatedMobile
      const updatedData = [...mobileData]
      const localRecord = updatedData[globalIndex] || {}
      const merged = {
        ...localRecord,
        ...updated,
        payment: updated.payment !== undefined ? updated.payment : (paymentMethod !== undefined ? paymentMethod : localRecord.payment),
        paid_amount: updated.paid_amount !== undefined ? updated.paid_amount : localRecord.paid_amount,
      }
      updatedData[globalIndex] = merged




      setMobileData(updatedData)




      if (typeof onRevenueUpdate === "function") {
        onRevenueUpdate()
      }
    } catch (error) {
      console.error("Failed to update paid amount:", error.message)
    }
  }




  const openPaymentModal = async (mobile, localIndex) => {
    if (hideActions) return
    const globalIndex = indexOfFirstItem + localIndex
    setActivePaymentMobileId(mobile?._id || null)
    setActivePaymentMobileIndex(globalIndex)
    setPaymentModalOpen(true)
    setNewPaymentAmount("")
    setNewPaymentMethod("")
    
    // Position popup near the button
    setTimeout(() => {
      const button = document.getElementById(`add-payment-btn-${globalIndex}`)
      if (button) {
        const rect = button.getBoundingClientRect()
        setPopupPosition({
          top: rect.bottom + window.scrollY + 8,
          left: rect.left + window.scrollX
        })
      }
    }, 0)
  }

  const openSellModal = async (mobile, localIndex) => {
    if (hideActions) return
    // compute global index for updating mobileData later
    const globalIndex = indexOfFirstItem + (localIndex || 0)
    setActiveMobileIndex(globalIndex)
    setActiveMobileId(mobile?._id || null)
    setSellOpen(true)
    // Reset all fields to empty/default values
    setSelectedProductId("")
    setProductNameInput("")
    setSelectedSupplierId("")
    setSupplierQuery("")
    setPaidAmount(0)
    setSellQty(1)
    setPaymentMethod("")
    setWarranty("")
    setSellDate(new Date().toISOString().split("T")[0])
    try {
      const token = localStorage.getItem("token")
      if (!token || !shopId) return
      const res = await api.post(
        "/api/products/list",
        { shop_id: shopId },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setProducts(res?.data?.products || [])
      // fetch suppliers for dropdown
      try {
        const sres = await api.post(
          "/api/suppliers/list",
          { shop_id: shopId },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const fetchedSuppliers = sres?.data?.suppliers || []
        setSuppliers(fetchedSuppliers)
        // Do not prefill any values - always start with empty form
      } catch (e) {
        console.error("Failed to load suppliers", e)
      }
    } catch (e) {
      console.error("Failed to load products", e)
    }
  }




  const closeSellModal = () => {
    setSellOpen(false)
    setSelectedProductId("")
    setSellQty(1)
    setPaidAmount(0)
    setPaymentMethod("")
    setWarranty("")
    setSellDate(new Date().toISOString().split("T")[0])
    setSelectedSupplierId("")
    setSupplierQuery("")
    setProductNameInput("")
    setActiveMobileIndex(null)
    setActiveMobileId(null)
  }




  const closePaymentModal = () => {
    setPaymentModalOpen(false)
    setActivePaymentMobileId(null)
    setActivePaymentMobileIndex(null)
    setNewPaymentAmount("")
    setNewPaymentMethod("")
    setPopupPosition({ top: 0, left: 0 })
  }

  // Update view popup position when toggled
  useEffect(() => {
    if (activePaymentMobileIndex !== null && !paymentModalOpen) {
      const button = document.getElementById(`view-payment-btn-${activePaymentMobileIndex}`)
      if (button) {
        const rect = button.getBoundingClientRect()
        setViewPopupPosition({
          top: rect.bottom + window.scrollY + 8,
          left: rect.right + window.scrollX - 320 // 320px is popup width
        })
      }
    }
  }, [activePaymentMobileIndex, paymentModalOpen])

  const addPaymentEntry = async () => {
    if (!newPaymentAmount || !newPaymentMethod) {
      alert("Please enter amount and select payment method")
      return
    }
    
    const amount = Number.parseFloat(newPaymentAmount)
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount")
      return
    }

    setAddingPayment(true)
    try {
      const token = localStorage.getItem("token")
      const response = await api.post(
        "/api/add-payment-entry",
        {
          id: activePaymentMobileId,
          amount: amount,
          method: newPaymentMethod,
          date: new Date().toISOString()
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      const updated = response.data.updatedMobile
      const updatedData = [...mobileData]
      const localRecord = updatedData[activePaymentMobileIndex] || {}
      const merged = {
        ...localRecord,
        ...updated,
        payments: updated.payments || [],
        total_paid: updated.total_paid || 0,
      }
      updatedData[activePaymentMobileIndex] = merged

      setMobileData(updatedData)
      setNewPaymentAmount("")
      setNewPaymentMethod("")

      if (typeof onRevenueUpdate === "function") {
        onRevenueUpdate()
      }
    } catch (error) {
      console.error("Failed to add payment entry:", error.message)
      alert("Failed to add payment. Please try again.")
    } finally {
      setAddingPayment(false)
    }
  }

  const deletePaymentEntry = async (paymentId) => {
    if (!confirm("Are you sure you want to delete this payment entry?")) return

    try {
      const token = localStorage.getItem("token")
      const response = await api.post(
        "/api/delete-payment-entry",
        {
          id: activePaymentMobileId,
          paymentId: paymentId
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      const updated = response.data.updatedMobile
      const updatedData = [...mobileData]
      const localRecord = updatedData[activePaymentMobileIndex] || {}
      const merged = {
        ...localRecord,
        ...updated,
        payments: updated.payments || [],
        total_paid: updated.total_paid || 0,
      }
      updatedData[activePaymentMobileIndex] = merged

      setMobileData(updatedData)

      if (typeof onRevenueUpdate === "function") {
        onRevenueUpdate()
      }
    } catch (error) {
      console.error("Failed to delete payment entry:", error.message)
      alert("Failed to delete payment. Please try again.")
    }
  }

  const submitSell = async () => {
    if (!sellQty) return
    if (!selectedSupplierId) {
      alert("Please select a supplier")
      return
    }
    setSelling(true)
    try {
      const token = localStorage.getItem("token")

      // Compute the selected date from date picker
      const selectedDateObj = new Date(sellDate + "T12:00:00")
      const selectedDate = selectedDateObj.toISOString()

      // If typed product matches an existing product by name, use its id to perform product sell
      const matchingProduct = products.find(p => (p.name || "").toLowerCase() === (productNameInput || "").toLowerCase())
      if (matchingProduct) {
        await api.post(
          "/api/products/sell",
          { productId: matchingProduct._id || selectedProductId, quantitySold: Number(sellQty), paidAmount: Number(paidAmount || 0), sellDate: selectedDate },
          { headers: { Authorization: `Bearer ${token}` } }
        )
      } else {
        // If no matching product, skip product sell but still proceed to supplier update
        console.warn("No matching product found by name; skipping product sell and only updating supplier history")
      }

      // find current supplier total and increment it by the paidAmount (or cost)
      const currentSupplier = suppliers.find(s => String(s._id) === String(selectedSupplierId))
      const currentTotal = Number(currentSupplier?.totalAmount || 0)
      const increment = Number(paidAmount || 0)
      const newTotal = currentTotal + increment

      // call supplier update to record history and update totalAmount
      await api.post(
        "/api/suppliers/update",
        { shop_id: shopId, supplierId: selectedSupplierId, totalAmount: newTotal, lastPaymentMethod: paymentMethod || DEFAULT_PAYMENT_METHOD, message: `Added: ${productNameInput} x${sellQty} - ₹${increment}`, changeDate: selectedDate },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      

      // Save supplier/product details and supplier amount to mobile record
      // This tracks what was used/sold and the cost for this mobile
      if (activeMobileId) {
        try {
          // Get the current mobile record to preserve existing paid_amount
          const currentMobile = mobileData.find(m => m._id === activeMobileId) || {}
          const currentPaidAmount = currentMobile.paid_amount || 0
          
          await api.post(
            "/api/update-paid-amount",
            { 
              id: activeMobileId, 
              paidAmount: currentPaidAmount, 
              updateDate: selectedDate, 
              supplierId: selectedSupplierId, 
              supplierName: supplierQuery, 
              productName: productNameInput, 
              quantity: sellQty, 
              supplierAmount: Number(paidAmount || 0),
              paymentMethod: paymentMethod,
              warranty: warranty
            },
            { headers: { Authorization: `Bearer ${token}` } }
          )
        } catch (e) {
          console.warn("Failed to update mobile supplier details on server", e)
        }
      }

      if (activeMobileIndex !== null && activeMobileIndex !== undefined) {
        const updated = [...mobileData]
        updated[activeMobileIndex] = {
          ...updated[activeMobileIndex],
          // Do NOT update paid_amount here - that's only for the table's "Paid Amount" field
          // Update supplier/product tracking fields and supplier amount
          productName: productNameInput,
          quantity: sellQty,
          supplierId: selectedSupplierId,
          supplierName: supplierQuery,
          supplier_amount: Number(paidAmount || 0),
          paymentMethod: paymentMethod,
          warranty: warranty,
        }
        setMobileData(updated)
      }

      if (typeof onRevenueUpdate === "function") onRevenueUpdate()

      closeSellModal()
    } catch (e) {
      const msg = e?.response?.data?.error || e?.response?.data?.message || e.message
      alert(msg || "Failed to sell product / update supplier")
    } finally {
      setSelling(false)
    }
  }




  if (validMobileData.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full mb-4">
          <Smartphone className="h-8 w-8 text-blue-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">No Mobile Data</h3>
        <p className="text-gray-600">No mobile devices found for this record.</p>
      </div>
    )
  }




  return (
    <div className="bg-white border border-gray-200 overflow-hidden shadow-lg rounded-xl">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gradient-to-r from-gray-100 to-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                  Date
                </div>
              </th>
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                <div className="flex items-center">
                  <Smartphone className="h-4 w-4 mr-2 text-indigo-600" />
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
                  <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                  Ready
                </div>
              </th>
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                <div className="flex items-center">
                  <Truck className="h-4 w-4 mr-2 text-purple-600" />
                  Delivered
                </div>
              </th>
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-pink-600" />
                  Delivered Date
                </div>
              </th>
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                <div className="flex items-center">
                  <RotateCcw className="h-4 w-4 mr-2 text-red-600" />
                  Returned
                </div>
              </th>
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                <div className="flex items-center">
                  <Package className="h-4 w-4 mr-2 text-blue-600" />
                  Product
                </div>
              </th>
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                <div className="flex items-center">
                  <DollarSign className="h-4 w-4 mr-2 text-emerald-600" />
                  Paid Amount
                </div>
              </th>
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                <div className="flex items-center">
                  <Eye className="h-4 w-4 mr-2 text-teal-600" />
                  IMEI
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {currentMobileData.map((mobile, index) => (
              <tr
                key={mobile.id || index}
                className={`hover:bg-blue-50 transition-colors duration-200 ${
                  index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                }`}
              >
                <td className="px-6 py-4 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-700">{formatDate(mobile.added_date)}</span>
                </td>
                <td className="px-6 py-4 border-b border-gray-200">
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-800">{mobile.mobile_name}</span>
                    {mobile.model && (
                      <span className="text-xs text-gray-500 mt-0.5">{mobile.model}</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 border-b border-gray-200">
                  <span className="text-sm text-gray-600">{mobile.issue || "N/A"}</span>
                </td>
                <td className="px-6 py-4 border-b border-gray-200">
                  <button
                    onClick={() => toggleStatus(index, "ready")}
                    disabled={hideActions}
                    className={`px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200 ${
                      mobile.ready
                        ? "bg-green-100 text-green-800 hover:bg-green-200"
                        : "bg-red-100 text-red-800 hover:bg-red-200"
                    } ${hideActions ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                  >
                    {mobile.ready ? "Yes" : "No"}
                  </button>
                </td>
                <td className="px-6 py-4 border-b border-gray-200">
                  <button
                    onClick={() => toggleStatus(index, "delivered")}
                    disabled={hideActions}
                    className={`px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200 ${
                      mobile.delivered
                        ? "bg-green-100 text-green-800 hover:bg-green-200"
                        : "bg-red-100 text-red-800 hover:bg-red-200"
                    } ${hideActions ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                  >
                    {mobile.delivered ? "Yes" : "No"}
                  </button>
                </td>
                <td className="px-6 py-4 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-700">{formatDate(mobile.delivery_date)}</span>
                </td>
                <td className="px-6 py-4 border-b border-gray-200">
                  <button
                    onClick={() => toggleStatus(index, "returned")}
                    disabled={hideActions}
                    className={`px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200 ${
                      mobile.returned
                        ? "bg-green-100 text-green-800 hover:bg-green-200"
                        : "bg-red-100 text-red-800 hover:bg-red-200"
                    } ${hideActions ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                  >
                    {mobile.returned ? "Yes" : "No"}
                  </button>
                </td>
                <td className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {mobile.productName || mobile.product || mobile.itemName || "-"}
                    </span>
                    {(mobile.productName || mobile.product || mobile.itemName) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (activeMobileIndex === (indexOfFirstItem + index)) {
                            setActiveMobileIndex(null)
                          } else {
                            setActiveMobileIndex(indexOfFirstItem + index)
                          }
                        }}
                        className="px-2 py-0.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
                        id={`view-product-btn-${indexOfFirstItem + index}`}
                      >
                        {activeMobileIndex === (indexOfFirstItem + index) ? 'Hide' : 'View'}
                      </button>
                    )}
                    <button
                      onClick={() => openSellModal(mobile, index)}
                      disabled={hideActions}
                      className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                        hideActions ? "cursor-not-allowed opacity-60 bg-gray-300" : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      {mobile.productName || mobile.product || mobile.itemName ? 'Edit' : '+ Use'}
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      ₹{(mobile.total_paid || mobile.paid_amount || 0).toLocaleString("en-IN")}
                    </span>
                    <button
                      onClick={(e) => {
                        openPaymentModal(mobile, index)
                      }}
                      disabled={hideActions}
                      className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                        hideActions ? "cursor-not-allowed opacity-60 bg-gray-300" : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                      id={`add-payment-btn-${indexOfFirstItem + index}`}
                    >
                      + Add
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4 border-b border-gray-200">
                  {mobile.imei ? (
                    <button
                      onClick={() => router.push(`/mobilename?imei=${encodeURIComponent(mobile.imei)}`)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 hover:text-teal-800 transition-colors"
                      title={`IMEI: ${mobile.imei}`}
                    >
                      <Eye className="h-3 w-3" />
                      View IMEI
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>




      {/* Pagination */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <Pagination
          invoicesPerPage={itemsPerPage}
          totalInvoices={validMobileData.length}
          paginate={paginate}
          currentPage={currentPage}
        />
      </div>




      {/* Add Payment Popup */}
      {paymentModalOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={closePaymentModal}></div>
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl border border-gray-200 p-5 w-80 z-50">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-semibold text-gray-900">Add Payment</h4>
              <button
                onClick={closePaymentModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mb-4 pb-4 border-b border-gray-200">
              <p className="text-xs text-gray-600 mb-1">Current Total</p>
              <p className="text-xl font-bold text-gray-900">
                ₹{((mobileData[activePaymentMobileIndex]?.total_paid || mobileData[activePaymentMobileIndex]?.paid_amount || 0)).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Amount</label>
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="₹0"
                  value={newPaymentAmount}
                  onChange={(e) => setNewPaymentAmount(e.target.value)}
                  min="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Method</label>
                <select
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  value={newPaymentMethod}
                  onChange={(e) => setNewPaymentMethod(e.target.value)}
                >
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={addPaymentEntry}
                disabled={addingPayment || !newPaymentAmount || !newPaymentMethod}
                className="w-full bg-blue-600 text-white py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {addingPayment ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* View Payment History Popup */}
      {activePaymentMobileIndex !== null && !paymentModalOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setActivePaymentMobileIndex(null)}></div>
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl border border-gray-200 p-5 w-96 max-h-[500px] overflow-y-auto z-50">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-semibold text-gray-900">Payment History</h4>
              <button
                onClick={() => setActivePaymentMobileIndex(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mb-4 pb-4 border-b border-gray-200">
              <p className="text-xs text-gray-600 mb-1">Total Amount</p>
              <p className="text-xl font-bold text-gray-900">
                ₹{((mobileData[activePaymentMobileIndex]?.total_paid || mobileData[activePaymentMobileIndex]?.paid_amount || 0)).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="space-y-2">
              {mobileData[activePaymentMobileIndex]?.payments && mobileData[activePaymentMobileIndex].payments.length > 0 ? (
                mobileData[activePaymentMobileIndex].payments.map((payment, pIdx) => (
                  <div key={payment._id || pIdx} className="border-b border-gray-100 pb-2 last:border-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                        {payment.method || 'N/A'}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        ₹{(payment.amount || 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        {new Date(payment.date).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </p>
                      <button
                        onClick={() => deletePaymentEntry(payment._id)}
                        className="text-red-600 hover:bg-red-50 rounded p-0.5 transition-colors"
                        title="Delete"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-sm text-gray-500">
                  No payments yet
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* View Product Details Popup */}
      {activeMobileIndex !== null && !sellOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setActiveMobileIndex(null)}></div>
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl border border-gray-200 p-5 w-96 z-50">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-semibold text-gray-900">Product Details</h4>
              <button
                onClick={() => setActiveMobileIndex(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3">
              <div className="border-b border-gray-100 pb-3">
                <p className="text-xs text-gray-600 mb-1">Product Name</p>
                <p className="text-sm font-semibold text-gray-900">
                  {mobileData[activeMobileIndex]?.productName || mobileData[activeMobileIndex]?.product || mobileData[activeMobileIndex]?.itemName || "N/A"}
                </p>
              </div>
              {mobileData[activeMobileIndex]?.quantity && (
                <div className="border-b border-gray-100 pb-3">
                  <p className="text-xs text-gray-600 mb-1">Quantity</p>
                  <p className="text-sm font-medium text-gray-900">{mobileData[activeMobileIndex].quantity}</p>
                </div>
              )}
              {mobileData[activeMobileIndex]?.supplierName && (
                <div className="border-b border-gray-100 pb-3">
                  <p className="text-xs text-gray-600 mb-1">Supplier</p>
                  <p className="text-sm font-medium text-gray-900">{mobileData[activeMobileIndex].supplierName}</p>
                </div>
              )}
              {mobileData[activeMobileIndex]?.supplier_amount > 0 && (
                <div className="border-b border-gray-100 pb-3">
                  <p className="text-xs text-gray-600 mb-1">Supplier Cost</p>
                  <p className="text-sm font-semibold text-gray-900">
                    ₹{(mobileData[activeMobileIndex].supplier_amount || 0).toLocaleString("en-IN")}
                  </p>
                </div>
              )}
              {mobileData[activeMobileIndex]?.paymentMethod && (
                <div className="border-b border-gray-100 pb-3">
                  <p className="text-xs text-gray-600 mb-1">Payment Method</p>
                  <p className="text-sm font-medium text-gray-900">{mobileData[activeMobileIndex].paymentMethod}</p>
                </div>
              )}
              {mobileData[activeMobileIndex]?.warranty && (
                <div>
                  <p className="text-xs text-gray-600 mb-1">Warranty</p>
                  <p className="text-sm font-medium text-gray-900 capitalize">{mobileData[activeMobileIndex].warranty.replace('-', ' ')}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Sell Product Modal */}
      {sellOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Use Product</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={sellDate}
                  onChange={(e) => setSellDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Type or select supplier..."
                  value={supplierQuery}
                  onChange={(e) => {
                    setSupplierQuery(e.target.value)
                    setShowSupplierDropdown(true)
                  }}
                  onFocus={() => setShowSupplierDropdown(true)}
                />
                {showSupplierDropdown && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-auto">
                    {(suppliers.filter(s => s.supplierName.toLowerCase().includes(supplierQuery.toLowerCase()))).map(s => (
                      <div
                        key={s._id}
                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer"
                        onClick={() => {
                          setSelectedSupplierId(s._id)
                          setSupplierQuery(s.supplierName)
                          setShowSupplierDropdown(false)
                        }}
                      >
                        {s.supplierName} {s.agencyName ? `- ${s.agencyName}` : ''}
                      </div>
                    ))}
                    {suppliers.length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500">No suppliers found</div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product (type name)</label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Enter product name or select existing"
                  value={productNameInput}
                  onChange={(e) => setProductNameInput(e.target.value)}
                />
                {/* Product hint removed as requested */}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min={1}
                  className="w-full border rounded-lg px-3 py-2"
                  value={sellQty}
                  onChange={(e) => setSellQty(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supplier Amount (optional)
                  <span className="text-xs text-gray-500 block">Cost paid to supplier for this product</span>
                </label>
                <input
                  type="number"
                  min={0}
                  className="w-full border rounded-lg px-3 py-2"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Warranty</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={warranty}
                  onChange={(e) => setWarranty(e.target.value)}
                >
                  <option value="">Select</option>
                  <option value="warranty">Warranty</option>
                  <option value="no-warranty">No Warranty</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button className="px-3 py-2 rounded-lg border" onClick={closeSellModal} disabled={selling}>Cancel</button>
              <button className="px-3 py-2 rounded-lg bg-blue-600 text-white" onClick={submitSell} disabled={selling}>
                {selling ? "Selling..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}




export default MobileNameTable


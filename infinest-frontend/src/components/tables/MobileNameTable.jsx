

"use client"

import { useEffect, useState } from "react"
import Pagination from "./Pagination"
import api from "../api"
import { Calendar, Smartphone, AlertCircle, CheckCircle, RotateCcw, DollarSign, Truck, Package } from "lucide-react"
import { jwtDecode } from "jwt-decode"




const MobileNameTable = ({ mobileData, setMobileData, onRevenueUpdate, hideActions }) => {
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
  const [selling, setSelling] = useState(false)
  // Keep last used values so new rows default to the last saved values
  const [lastSupplierId, setLastSupplierId] = useState("")
  const [lastSupplierQuery, setLastSupplierQuery] = useState("")
  const [lastProductName, setLastProductName] = useState("")
  const [lastSellQty, setLastSellQty] = useState(1)
  const [lastPaidAmount, setLastPaidAmount] = useState(0)

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
    // load last-used values from localStorage
    try {
      const lsSupplierId = typeof window !== 'undefined' ? localStorage.getItem('lastSupplierId_MobileSell') : null
      const lsSupplierQuery = typeof window !== 'undefined' ? localStorage.getItem('lastSupplierQuery_MobileSell') : null
      const lsProductName = typeof window !== 'undefined' ? localStorage.getItem('lastProductName_MobileSell') : null
      const lsQty = typeof window !== 'undefined' ? localStorage.getItem('lastSellQty_MobileSell') : null
      const lsPaid = typeof window !== 'undefined' ? localStorage.getItem('lastPaidAmount_MobileSell') : null
      if (lsSupplierId) setLastSupplierId(lsSupplierId)
      if (lsSupplierQuery) setLastSupplierQuery(lsSupplierQuery)
      if (lsProductName) setLastProductName(lsProductName)
      if (lsQty) setLastSellQty(Number(lsQty))
      if (lsPaid) setLastPaidAmount(Number(lsPaid))
    } catch (e) {
      // ignore
    }
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




  const openSellModal = async (mobile, localIndex) => {
    if (hideActions) return
    // compute global index for updating mobileData later
    const globalIndex = indexOfFirstItem + (localIndex || 0)
    setActiveMobileIndex(globalIndex)
    setActiveMobileId(mobile?._id || null)
    setSellOpen(true)
    // start with empty defaults; we'll override with saved values from the mobile if present
    // Use last-used values as defaults; mobile-specific values (if any) will override below
    setSelectedProductId("")
    setProductNameInput(lastProductName || "")
    setSelectedSupplierId(lastSupplierId || "")
    setSupplierQuery(lastSupplierQuery || "")
    setPaidAmount(lastPaidAmount || 0)
    setSellQty(lastSellQty || 1)
    try {
      const token = localStorage.getItem("token")
      if (!token || !shopId) return
      const res = await api.post(
        "/api/products/list",
        { shop_id: shopId },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setProducts(res?.data?.products || [])
      // Do not pre-select product; leave product input empty per request
      // fetch suppliers for dropdown
      try {
        const sres = await api.post(
          "/api/suppliers/list",
          { shop_id: shopId },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const fetchedSuppliers = sres?.data?.suppliers || []
        setSuppliers(fetchedSuppliers)
        // If opening for an existing mobile that already has values, prefill them
          if (mobile) {
          // Prefill supplier amount (NOT the customer paid amount)
          if (mobile.supplier_amount !== undefined && mobile.supplier_amount !== null) {
            setPaidAmount(mobile.supplier_amount)
          }
          // Prefill product name if available on mobile record
          const possibleProductName = mobile.productName || mobile.product || mobile.itemName || ""
          if (possibleProductName) setProductNameInput(possibleProductName)
          if (mobile.quantity) setSellQty(mobile.quantity)

          // Determine supplier id/name from multiple possible fields
          const mobileSupplierId = mobile.supplierId || (mobile.supplier && (mobile.supplier._id || mobile.supplier.id)) || mobile.supplier_id || mobile.supplier
          const mobileSupplierName = mobile.supplierName || mobile.supplier_name || (mobile.supplier && (mobile.supplier.supplierName || mobile.supplier.name)) || (typeof mobile.supplier === 'string' ? mobile.supplier : undefined)

          // Try to match supplier by id first
          if (mobileSupplierId) {
            const match = fetchedSuppliers.find(s => String(s._id) === String(mobileSupplierId))
            if (match) {
              setSelectedSupplierId(match._id)
              setSupplierQuery(match.supplierName || "")
            } else if (mobileSupplierName) {
              // fallback to name if id didn't match
              setSupplierQuery(mobileSupplierName)
            }
          } else if (mobileSupplierName) {
            const match = fetchedSuppliers.find(s => (s.supplierName || "").toLowerCase() === String(mobileSupplierName).toLowerCase())
            if (match) {
              setSelectedSupplierId(match._id)
              setSupplierQuery(match.supplierName || "")
            } else {
              // if supplierName exists but not in list, just show the name
              setSupplierQuery(mobileSupplierName)
            }
          }
        } else {
          // if no mobile-specific data, ensure we show last-used values
          if (!mobile) {
            if (lastProductName) setProductNameInput(lastProductName)
            if (lastSellQty) setSellQty(lastSellQty)
            if (lastPaidAmount) setPaidAmount(lastPaidAmount)
            if (lastSupplierId) setSelectedSupplierId(lastSupplierId)
            if (lastSupplierQuery) setSupplierQuery(lastSupplierQuery)
          }
        }
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
    setSelectedSupplierId("")
    setSupplierQuery("")
    setProductNameInput("")
    setActiveMobileIndex(null)
    setActiveMobileId(null)
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

      // If typed product matches an existing product by name, use its id to perform product sell
      const matchingProduct = products.find(p => (p.name || "").toLowerCase() === (productNameInput || "").toLowerCase())
      if (matchingProduct) {
        await api.post(
          "/api/products/sell",
          { productId: matchingProduct._id || selectedProductId, quantitySold: Number(sellQty), paidAmount: Number(paidAmount || 0) },
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
        { shop_id: shopId, supplierId: selectedSupplierId, totalAmount: newTotal, lastPaymentMethod: (currentSupplier?.lastPaymentMethod || "cash"), message: `Added: ${productNameInput} x${sellQty} - ₹${increment}` },
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
              updateDate: new Date().toISOString(), 
              supplierId: selectedSupplierId, 
              supplierName: supplierQuery, 
              productName: productNameInput, 
              quantity: sellQty, 
              supplierAmount: Number(paidAmount || 0) 
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
        }
        setMobileData(updated)
      }

      // save last-used values (persist to localStorage so they survive refresh)
      try {
        setLastSupplierId(selectedSupplierId)
        setLastSupplierQuery(supplierQuery)
        setLastProductName(productNameInput)
        setLastSellQty(sellQty)
        setLastPaidAmount(paidAmount)
        if (typeof window !== 'undefined') {
          localStorage.setItem('lastSupplierId_MobileSell', String(selectedSupplierId || ""))
          localStorage.setItem('lastSupplierQuery_MobileSell', String(supplierQuery || ""))
          localStorage.setItem('lastProductName_MobileSell', String(productNameInput || ""))
          localStorage.setItem('lastSellQty_MobileSell', String(sellQty || 1))
          localStorage.setItem('lastPaidAmount_MobileSell', String(paidAmount || 0))
        }
      } catch (e) {
        // ignore storage errors
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
                  Payment
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
                  <div className="flex flex-col space-y-1">
                    {mobile.productName || mobile.product || mobile.itemName ? (
                      <div className="space-y-1">
                        <span className="text-sm font-medium text-gray-800">{mobile.productName || mobile.product || mobile.itemName}</span>
                        {mobile.quantity && (
                          <span className="text-xs text-gray-500">Qty: {mobile.quantity}</span>
                        )}
                        {mobile.supplierName && (
                          <span className="text-xs text-blue-600">Supplier: {mobile.supplierName}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">No product assigned</span>
                    )}
                    <button
                      onClick={() => openSellModal(mobile, index)}
                      disabled={hideActions}
                      className={`px-2 py-1 text-xs font-semibold rounded-full transition-all duration-200 bg-blue-600 text-white hover:bg-blue-700 ${hideActions ? "cursor-not-allowed opacity-60" : "cursor-pointer"} w-fit`}
                    >
                      {mobile.productName || mobile.product || mobile.itemName ? 'Edit' : 'Use'}
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4 border-b border-gray-200">
                  <input
                    type="number"
                    placeholder="₹0"
                    value={mobile.paid_amount || ""}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                    onChange={(e) => {
                      if (hideActions) return
                      const value = e.target.value
                      if (/^\d{0,8}$/.test(value)) {
                        const updated = [...mobileData]
                        updated[indexOfFirstItem + index].paid_amount = value
                        setMobileData(updated)
                      }
                    }}
                    onBlur={(e) => updatePaidAmount(index, e.target.value || 0, (currentMobileData[index]?.payment))}
                    disabled={hideActions}
                  />
                </td>
                <td className="px-6 py-4 border-b border-gray-200">
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    value={mobile.payment || ""}
                    onChange={(e) => {
                      if (hideActions) return
                      const val = e.target.value
                      const updated = [...mobileData]
                      updated[indexOfFirstItem + index].payment = val
                      setMobileData(updated)
                      const currentAmount = currentMobileData[index]?.paid_amount || 0
                      updatePaidAmount(index, currentAmount, val)
                    }}
                    disabled={hideActions}
                  >
                    <option value="">Select</option>
                    <option value="cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="card">Card</option>
                    <option value="UPI-h">UPI-H</option>
                    <option value="UPI-s">UPI-S</option>
                    <option value="Cash + Card">CASH + CARD</option>
                    <option value="UPI H + CASH">UPI H + CASH</option>
                    <option value="UPI S + CASH">UPI S + CASH</option>
                    <option value="UPI H + CARD">UPI H + CARD</option>
                    <option value="UPI S + CARD">UPI S + CARD</option>
                  </select>
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




      {/* Sell Product Modal */}
      {sellOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Sell Product</h3>
            <div className="space-y-4">
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
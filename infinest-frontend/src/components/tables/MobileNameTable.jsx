

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
  const [shopId, setShopId] = useState(null)
  const [products, setProducts] = useState([])
  const [selectedProductId, setSelectedProductId] = useState("")
  const [sellQty, setSellQty] = useState(1)
  const [paidAmount, setPaidAmount] = useState(0)
  const [selling, setSelling] = useState(false)




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
      updatedData[globalIndex] = { ...updated, deliveryDate: updated.deliveryDate }




      setMobileData(updatedData)
    } catch (error) {
      console.error(`Failed to toggle ${field}:`, error.message)
    }
  }




  const updatePaidAmount = async (index, value, paymentMethod) => {
    if (hideActions) return




    const mobile = currentMobileData[index]
    const globalIndex = indexOfFirstItem + index




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
      updatedData[globalIndex] = { ...updated }




      setMobileData(updatedData)




      if (typeof onRevenueUpdate === "function") {
        onRevenueUpdate()
      }
    } catch (error) {
      console.error("Failed to update paid amount:", error.message)
    }
  }




  const openSellModal = async () => {
    if (hideActions) return
    setSellOpen(true)
    try {
      const token = localStorage.getItem("token")
      if (!token || !shopId) return
      const res = await api.post(
        "/api/products/list",
        { shop_id: shopId },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setProducts(res?.data?.products || [])
      if ((res?.data?.products || []).length) {
        setSelectedProductId(res.data.products[0]._id)
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
  }




  const submitSell = async () => {
    if (!selectedProductId || !sellQty) return
    setSelling(true)
    try {
      const token = localStorage.getItem("token")
      await api.post(
        "/api/products/sell",
        { productId: selectedProductId, quantitySold: Number(sellQty), paidAmount: Number(paidAmount || 0) },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      closeSellModal()
    } catch (e) {
      const msg = e?.response?.data?.error || e.message
      alert(msg || "Failed to sell product")
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
                  <span className="font-semibold text-gray-800">{mobile.mobile_name}</span>
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
                  <button
                    onClick={openSellModal}
                    disabled={hideActions}
                    className={`px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200 bg-blue-600 text-white hover:bg-blue-700 ${hideActions ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                  >
                    Use
                  </button>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                >
                  {products.map(p => (
                    <option key={p._id} value={p._id}>{p.name} (Qty: {p.quantity})</option>
                  ))}
                </select>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Paid Amount (optional)</label>
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
                {selling ? "Selling..." : "Sell"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}




export default MobileNameTable
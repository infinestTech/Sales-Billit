"use client"


import { useState } from "react"
import { X } from "lucide-react"
import { logAndNotify, logError } from "@/utils/logger"
import api from "../api"
import { useRouter } from "next/navigation"


const AddSupplierModal = ({ shop_id, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    supplierName: "",
    agencyName: "",
    phoneNumber: "",
    address: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()


  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }


  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.supplierName.trim()) {
      logAndNotify("Supplier name is required", "warning", shop_id)
      return
    }


    try {
      setIsSubmitting(true)
      const token = localStorage.getItem("token")
      const payload = {
        shop_id,
        supplierName: form.supplierName.trim(),
        agencyName: form.agencyName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        address: form.address.trim(),
      }
      const res = await api.post("/api/suppliers/add", payload, { headers: { Authorization: `Bearer ${token}` } })


      if (res?.data?.success) {
        logAndNotify("Supplier added successfully", "success", shop_id)
        onSuccess && onSuccess(res.data.supplier)
        // Optional: navigate to supplier list for immediate view
        router.push("/supplierlist")
      } else {
        logAndNotify("Failed to add supplier", "error", shop_id)
      }
    } catch (err) {
      logError("Supplier add error", err)
      const msg = err?.response?.data?.message || err?.message || "Failed to add supplier"
      logAndNotify(msg, "error", shop_id)
    } finally {
      setIsSubmitting(false)
    }
  }


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Add Supplier</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>


        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name</label>
            <input
              name="supplierName"
              value={form.supplierName}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., ABC Distributors"
              required
            />
          </div>


          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Agency Name</label>
              <input
                name="agencyName"
                value={form.agencyName}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Agency / Company"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                name="phoneNumber"
                value={form.phoneNumber}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="10-digit phone"
              />
            </div>
          </div>


          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea
              name="address"
              value={form.address}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Street, City, State"
            />
          </div>


         


          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Supplier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


export default AddSupplierModal





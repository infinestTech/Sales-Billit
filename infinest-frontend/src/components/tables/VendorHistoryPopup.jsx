"use client"

import { useState, useEffect } from "react"
import { X, Users, Phone, User, Loader2, AlertCircle, Smartphone } from "lucide-react"

export default function VendorHistoryPopup({ dealerId, dealerName, onClose }) {
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (dealerId) fetchVendors()
  }, [dealerId])

  const fetchVendors = async () => {
    try {
      setLoading(true)
      setError(null)
      const token = localStorage.getItem("token")
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/dealer-vendors`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ dealerId }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch vendors")
      }
      setVendors(data.vendors || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl border border-gray-200 w-[440px] max-h-[80vh] z-50 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <Users className="h-5 w-5" />
              <div>
                <h3 className="text-base font-semibold">Vendor History</h3>
                <p className="text-blue-100 text-xs">{dealerName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white hover:bg-white/20 rounded-md p-1 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(80vh-72px)] p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-500 text-sm">Loading vendors...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12 text-red-500">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span className="text-sm">{error}</span>
            </div>
          ) : vendors.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">No vendors found</p>
              <p className="text-gray-400 text-xs mt-1">Vendor details will appear here once added</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Total Vendors
                </span>
                <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  {vendors.length}
                </span>
              </div>
              {vendors.map((vendor, index) => (
                <div
                  key={vendor._id || index}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-blue-50/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-blue-600 flex-shrink-0" />
                        <span className="font-semibold text-gray-900 text-sm">{vendor.vendor_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <span className="text-gray-600 text-sm">{vendor.vendor_number}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full flex-shrink-0">
                      <Smartphone className="h-3.5 w-3.5" />
                      <span className="text-xs font-semibold">{vendor.mobile_count || 0}</span>
                    </div>
                  </div>
                  {vendor.created_at && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <span className="text-xs text-gray-400">
                        Added on {new Date(vendor.created_at).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "2-digit",
                        })}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

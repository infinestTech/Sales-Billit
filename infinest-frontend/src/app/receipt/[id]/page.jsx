"use client"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Phone, Calendar, Store, Smartphone, Clock, CheckCircle, Truck, RotateCcw, AlertCircle, FileText, MapPin, Mail, Globe } from 'lucide-react'
export default function ReceiptViewPage() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch receipt data from public backend endpoint without authentication
        const backendUrl = process.env.NEXT_PUBLIC_API_URL_BILLIT
        const response = await fetch(`${backendUrl}/api/receipt/public/${id}`)
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const receiptData = await response.json()
        
        console.log("Receipt data received:", receiptData)
        
        // Debug the specific fields we're having issues with
        console.log("Shop name fields:", {
          shop_name: receiptData.shop_name,
          owner_name: receiptData.owner_name,
          shop_email: receiptData.shop_email,
          address: receiptData.address
        })
        
        setData(receiptData)
      } catch (err) {
        console.error("Error loading data:", err)
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchData()
  }, [id])

  const getStatusInfo = (mobile) => {
    if (mobile.returned) {
      return {
        status: "Returned",
        color: "bg-red-500",
        textColor: "text-red-700",
        bgColor: "bg-red-50",
        icon: RotateCcw,
        progress: 100,
      }
    }
    if (mobile.delivered) {
      return {
        status: "Delivered",
        color: "bg-green-500",
        textColor: "text-green-700",
        bgColor: "bg-green-50",
        icon: CheckCircle,
        progress: 100,
      }
    }
    if (mobile.ready) {
      return {
        status: "Ready for Pickup",
        color: "bg-blue-500",
        textColor: "text-blue-700",
        bgColor: "bg-blue-50",
        icon: Truck,
        progress: 75,
      }
    }
    return {
      status: "In Progress",
      color: "bg-yellow-500",
      textColor: "text-yellow-700",
      bgColor: "bg-yellow-50",
      icon: Clock,
      progress: 25,
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return "N/A"
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }

  const getDaysElapsed = (dateString) => {
    if (!dateString) return 0
    const addedDate = new Date(dateString)
    const today = new Date()
    const diffTime = Math.abs(today.getTime() - addedDate.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700">Loading receipt...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md mx-4 bg-white">
          <CardContent className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Receipt Not Found</h3>
            <p className="text-gray-600">The requested receipt could not be found.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Helper function to get display name
  const getShopDisplayName = () => {
    if (data.owner_name && data.owner_name.trim() !== "" && data.owner_name !== "N/A") {
      return data.owner_name;
    }
    if (data.shop_name && data.shop_name.trim() !== "" && data.shop_name !== "N/A") {
      return data.shop_name;
    }
    return "Mobile Service Center";
  }

  // Helper function to get address from multiple possible field names
  const getShopAddress = () => {
    // Use the same field name as the profile endpoint
    if (data.address && 
        data.address.trim() !== "" && 
        data.address !== "N/A" && 
        data.address.toLowerCase() !== "null" && 
        data.address !== "undefined") {
      return data.address;
    }
    return null;
  }

  const mobileRecords = Array.isArray(data.MobileName) ? data.MobileName : []
  
  // Filter out delivered mobiles for dealers - only show non-delivered devices
  const filteredMobileRecords = mobileRecords.filter((mobile) => !mobile.delivered && !mobile.returned)
  
  const totalMobiles = filteredMobileRecords.length
  const completedMobiles = filteredMobileRecords.filter((m) => m.ready).length

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header - Shop Profile */}
        <Card className="shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <div className="text-center">
              <CardTitle className="text-3xl font-bold mb-2">
                {getShopDisplayName()}
              </CardTitle>
              <div className="flex flex-col sm:flex-row justify-center items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span>{data.shop_phone || "Not Provided"}</span>
                </div>
                
                {data.shop_email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span>{data.shop_email}</span>
                  </div>
                )}
                
                {getShopAddress() && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{getShopAddress()}</span>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Receipt Details */}
        <Card className="shadow-md bg-white">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Customer Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Customer Name:</span>
                    <span className="font-medium text-gray-900">{data.client_name || "Not Provided"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Mobile Number:</span>
                    <span className="font-medium text-gray-900">{data.mobile_number || "Not Provided"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Bill Number:</span>
                    <span className="font-medium text-gray-900">{data.bill_no || "N/A"}</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Service Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Date Submitted:</span>
                    <span className="font-medium text-gray-900">{formatDate(data.added_date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Devices:</span>
                    <span className="font-medium text-gray-900">{totalMobiles}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ready for Pickup:</span>
                    <span className="font-medium text-green-600">{completedMobiles}/{totalMobiles}</span>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Mobile Devices Table */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Device Service Status</h3>
              
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-4 py-3 text-left">S.No</th>
                      <th className="border border-gray-300 px-4 py-3 text-left">Device</th>
                      <th className="border border-gray-300 px-4 py-3 text-left">Issue</th>
                      <th className="border border-gray-300 px-4 py-3 text-left">Date Added</th>
                      <th className="border border-gray-300 px-4 py-3 text-left">Delivery Date</th>
                      <th className="border border-gray-300 px-4 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMobileRecords.map((mobile, index) => {
                      const statusInfo = getStatusInfo(mobile)
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-4 py-3 text-gray-900">{index + 1}</td>
                          <td className="border border-gray-300 px-4 py-3 font-medium text-gray-900">
                            {mobile.mobile_name}
                          </td>
                          <td className="border border-gray-300 px-4 py-3 text-gray-900">
                            {mobile.issue || "N/A"}
                          </td>
                          <td className="border border-gray-300 px-4 py-3 text-gray-900">
                            {formatDate(mobile.added_date)}
                          </td>
                          <td className="border border-gray-300 px-4 py-3 text-gray-900">
                            {formatDate(mobile.delivery_date)}
                          </td>
                          <td className="border border-gray-300 px-4 py-3">
                            <Badge 
                              variant="secondary" 
                              className={`${statusInfo.bgColor} ${statusInfo.textColor} border-0`}
                            >
                              {statusInfo.status}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                {filteredMobileRecords.map((mobile, index) => {
                  const statusInfo = getStatusInfo(mobile)
                  const StatusIcon = statusInfo.icon
                  return (
                    <Card key={index} className="border border-gray-200">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-semibold text-blue-600">
                              {index + 1}
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900">{mobile.mobile_name}</h4>
                              <p className="text-sm text-gray-600">{mobile.issue || "N/A"}</p>
                            </div>
                          </div>
                          <Badge 
                            variant="secondary" 
                            className={`${statusInfo.bgColor} ${statusInfo.textColor} border-0`}
                          >
                            {statusInfo.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Added:</span> {formatDate(mobile.added_date)}
                          </div>
                          <div>
                            <span className="font-medium">Delivery:</span> {formatDate(mobile.delivery_date)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>

            {/* Summary Statistics */}
            <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg border">
                <div className="text-2xl font-bold text-blue-600">{totalMobiles}</div>
                <div className="text-sm text-gray-600">Total Devices</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg border">
                <div className="text-2xl font-bold text-yellow-600">
                  {filteredMobileRecords.filter((m) => !m.ready).length}
                </div>
                <div className="text-sm text-gray-600">In Progress</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg border">
                <div className="text-2xl font-bold text-green-600">
                  {filteredMobileRecords.filter((m) => m.ready).length}
                </div>
                <div className="text-sm text-gray-600">Ready for Pickup</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>Thank you for choosing our service!</p>
          <p>For any queries, please contact us at {data.shop_phone || "N/A"}</p>
        </div>
      </div>
    </div>
  )
}

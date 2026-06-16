"use client"


import React, { useState, useEffect } from "react"
import Filters from "../AllRecordTable/Filters"
import MobileNameTable from "../tables/MobileNameTable"
import Pagination from "../tables/Pagination"
import ReceiptGenerator from "../AllRecordTable/ReceiptGenerator"
import api from "../api"
import { Download, Upload, Archive, Database, Users, Hash, Phone, FileText, DollarSign } from "lucide-react"


const BackupViewer = ({ shopId }) => {
  const [backupData, setBackupData] = useState(null)
  const [filteredData, setFilteredData] = useState([])
  const [filters, setFilters] = useState({})
  const [receiptModal, setReceiptModal] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [alertMessage, setAlertMessage] = useState(null)
  const perPage = 7


  const downloadFullBackup = async () => {
    try {
      setIsDownloading(true)
      const token = localStorage.getItem("token")
      const res = await api.post(
        "/api/backup/download",
        { shopId },
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob",
        },
      )


      const blob = new Blob([res.data], { type: "application/octet-stream" })
      const link = document.createElement("a")
      link.href = window.URL.createObjectURL(blob)
      link.download = `full-backup-${new Date().toISOString()}.bkb`
      link.click()
    } catch (err) {
       console.warn("Backup download failed.")
    } finally {
      setIsDownloading(false)
    }
  }


  const uploadBackup = async (e) => {
    const file = e.target.files[0]
    if (!file) return


    const formData = new FormData()
    formData.append("file", file)


    try {
      setIsUploading(true)
      const res = await api.post("/api/backup/view", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })
      setBackupData(res.data)
      applyFilters(res.data, filters)
    } catch (err) {
      console.error("❌ Upload failed:", err.message)
       console.warn("Invalid backup file")
    } finally {
      setIsUploading(false)
    }
  }


  const applyFilters = (data, filters) => {
    const { clientName = "", mobileName = "", billNo = "", mobileNumber = "" } = filters
    const filtered = [
      ...data.customers.map((c) => ({
        ...c,
        customerType: "Customer",
        MobileName: data.mobiles.filter((m) => m.customer_id === c._id),
      })),
      ...data.dealers.map((d) => ({
        ...d,
        customerType: "Dealer",
        MobileName: data.mobiles.filter((m) => m.dealer_id === d._id),
      })),
    ]
      .filter((entry) => entry.MobileName.length > 0)
      .filter(
        (entry) =>
          entry.client_name?.toLowerCase().includes(clientName.toLowerCase()) &&
          entry.mobile_number?.toLowerCase().includes(mobileNumber.toLowerCase()) &&
          (entry.bill_no || "").toLowerCase().includes(billNo.toLowerCase()) &&
          entry.MobileName.some((m) => m.mobile_name?.toLowerCase().includes(mobileName.toLowerCase())),
      )


    setFilteredData(filtered)
  }


  const handleFilter = (filterObj) => {
    setFilters(filterObj)
    if (backupData) {
      applyFilters(backupData, filterObj)
    }
  }


  const paginated = filteredData.slice((currentPage - 1) * perPage, currentPage * perPage)


  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await api.get("/api/backup/alerts")
        if (res.data.message) setAlertMessage(res.data.message)
      } catch (err) {
        console.warn("Alert fetch failed")
      }
    }, 5000)


    return () => clearInterval(interval)
  }, [])


  return (
    <div className="h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-white/20 rounded-xl">
            <Archive className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Backup Management</h2>
            <p className="text-blue-100">Download and restore your business data</p>
          </div>
        </div>
      </div>


      {/* Action Buttons */}
      <div className="px-8 py-6 bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-200 flex-shrink-0">
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={downloadFullBackup}
            disabled={isDownloading}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center justify-center space-x-2"
          >
            {isDownloading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span>Downloading...</span>
              </>
            ) : (
              <>
                <Download className="h-5 w-5" />
                <span>Download Backup File</span>
              </>
            )}
          </button>


          <label className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center justify-center space-x-2 cursor-pointer">
            {isUploading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="h-5 w-5" />
                <span>Upload Backup</span>
              </>
            )}
            <input type="file" hidden accept=".bkb" onChange={uploadBackup} disabled={isUploading} />
          </label>
        </div>
      </div>


      {/* Content Area */}
      <div className="flex-1 px-8 py-6 overflow-auto bg-white">
        {!backupData ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full mb-6">
              <Database className="h-10 w-10 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No Backup Loaded</h3>
            <p className="text-gray-600">Upload a backup file to view and manage your data.</p>
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="mb-6">
              <Filters onFilter={handleFilter} />
            </div>


            {/* Data Table */}
            <div className="bg-white border border-gray-200 overflow-hidden shadow-lg rounded-xl">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gradient-to-r from-gray-100 to-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                        <div className="flex items-center">
                          <Hash className="h-4 w-4 mr-2 text-blue-600" />
                          S.No
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-2 text-indigo-600" />
                          Client Name
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                        <div className="flex items-center">
                          <Phone className="h-4 w-4 mr-2 text-green-600" />
                          Mobile Number
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                        <div className="flex items-center">
                          <Database className="h-4 w-4 mr-2 text-purple-600" />
                          No. of Mobiles
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                        <div className="flex items-center">
                          <FileText className="h-4 w-4 mr-2 text-orange-600" />
                          Bill No
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                        <div className="flex items-center">
                          <DollarSign className="h-4 w-4 mr-2 text-red-600" />
                          Balance
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((invoice, idx) => (
                      <React.Fragment key={idx}>
                        <tr
                          className={`hover:bg-blue-50 transition-colors duration-200 ${
                            idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                          }`}
                        >
                          <td className="px-6 py-4 border-b border-gray-200">
                            <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                              {(currentPage - 1) * perPage + idx + 1}
                            </span>
                          </td>
                          <td className="px-6 py-4 border-b border-gray-200">
                            <div className="font-semibold text-gray-800">{invoice.client_name}</div>
                            <div className="text-sm text-gray-500 mt-1">
                              {invoice.customerType === "Customer" ? "Customer" : "Dealer"}
                            </div>
                          </td>
                          <td className="px-6 py-4 border-b border-gray-200">
                            <span className="font-medium text-gray-700">{invoice.mobile_number}</span>
                          </td>
                          <td className="px-6 py-4 border-b border-gray-200">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-purple-100 text-purple-800">
                              {invoice.MobileName.length}
                            </span>
                          </td>
                          <td className="px-6 py-4 border-b border-gray-200">
                            <span className="font-medium text-gray-700">{invoice.bill_no}</span>
                          </td>
                          <td className="px-6 py-4 border-b border-gray-200">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800">
                              ₹{invoice.balance_amount || 0}
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td colSpan="6" className="px-6 py-4 bg-gray-50/30">
                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                              <MobileNameTable mobileData={invoice.MobileName} setMobileData={() => {}} />
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>


              {/* Pagination */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <Pagination
                  invoicesPerPage={perPage}
                  totalInvoices={filteredData.length}
                  paginate={setCurrentPage}
                  currentPage={currentPage}
                />
              </div>
            </div>
          </>
        )}
      </div>


      {/* Receipt Modal */}
      {receiptModal && (
        <ReceiptGenerator
          clientData={{
            client_name: receiptModal.client_name,
            mobile_number: receiptModal.mobile_number,
            bill_no: receiptModal.bill_no,
            MobileName: receiptModal.MobileName.map((m) => ({
              ...m,
              paid_amount: typeof m.paid_amount !== 'undefined' && m.paid_amount !== null ? m.paid_amount : 0,
            })),
          }}
          closeModal={() => setReceiptModal(null)}
        />
      )}
    </div>
  )
}


export default BackupViewer





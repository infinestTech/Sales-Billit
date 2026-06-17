"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Attendance from "@/components/Attendance/attendanceList"
import { jwtDecode } from "jwt-decode"

export default function AllRecordPage() {
  const [shopId, setShopId] = useState(null)
  const [esslActive, setEsslActive] = useState(null) // null = loading
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem("token")

    if (token) {
      try {
        const decoded = jwtDecode(token)

        if (decoded?.shop_id) {
          setShopId(decoded.shop_id)

          // Check if the shop is using eSSL attendance
          fetch(`${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/dashboard/attendance-source`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((res) => res.ok ? res.json() : { useEsslAttendance: false })
            .then((data) => setEsslActive(data.useEsslAttendance === true))
            .catch(() => setEsslActive(false))
        } else {
          console.warn("No shop_id in token")
          window.location.href = "/billit-login"
        }
      } catch (err) {
        console.error("Token decode failed:", err)
        localStorage.removeItem("token")
        window.location.href = "/billit-login"
      }
    } else {
      window.location.href = "/billit-login"
    }
  }, [])

  // Still loading attendance source
  if (esslActive === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full mb-4 animate-spin">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <p className="text-lg text-gray-600 font-medium">Loading attendance…</p>
        </div>
      </div>
    )
  }

  // eSSL active — show informational block instead of the manual attendance UI
  if (esslActive) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl bg-white shadow-lg p-8 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-indigo-600">
              <path d="M12 2a10 10 0 0 0-6.88 17.25"/><path d="M12 2a10 10 0 0 1 6.88 17.25"/><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="1"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800">Biometric Device Active</h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            Your shop is using the <strong>eSSL M20 biometric device</strong> for attendance.
            Attendance records are captured automatically — manual marking is disabled.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {shopId ? (
        <Attendance shopId={shopId} />
      ) : (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full mb-4 animate-spin">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
            <p className="text-lg text-gray-600 font-medium">Loading attendance…</p>
          </div>
        </div>
      )}
    </div>
  )
}

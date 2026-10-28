"use client"

import { useEffect, useState } from "react"
import {
  Loader2,
  Plus,
  Trash2,
  CreditCard,
  CheckCircle2,
  XCircle,
  Receipt,
  Wallet,
} from "lucide-react"
import api from "@/components/api"
import { logAndNotify, logError, logSuccess } from "@/utils/logger"
import { formatPaymentMethodLabel } from "@/constants/paymentMethods"
import AddPaymentModal from "@/components/tables/AddPaymentModal"
import BottomSheet from "./BottomSheet"
import { formatDateTime, formatINR } from "./utils"

/**
 * Manage payments for a single mobile (split-payment array).
 * Uses the desktop endpoints:
 *   POST /api/add-payment-entry
 *   POST /api/delete-payment-entry
 *   POST /api/update-paid-amount  (legacy quick-set)
 *
 * Props:
 *   open, onClose, mobile (current mobile object), onUpdated(updatedMobile)
 */
export default function MobilePaymentSheet({
  open,
  onClose,
  mobile,
  shopId,
  onUpdated,
}) {
  const [adding, setAdding] = useState(false) // AddPaymentModal: method(s) first, then amounts
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    if (!open) setAdding(false)
  }, [open])

  if (!mobile) return null

  const payments = Array.isArray(mobile.payments) ? mobile.payments : []
  const totalPaid =
    Number(mobile.total_paid || 0) ||
    payments.reduce((s, p) => s + Number(p.amount || 0), 0) ||
    Number(mobile.paid_amount || 0)

  const headers = {
    Authorization: `Bearer ${
      typeof window !== "undefined" ? localStorage.getItem("token") : ""
    }`,
  }

  // One payment entry per mode (Cash ₹500 + Gpay ₹300 → two entries)
  const handleAdd = async (splits) => {
    let updated = null
    for (const split of splits) {
      try {
        const res = await api.post(
          "/api/add-payment-entry",
          { id: mobile._id, amount: split.amount, method: split.method, date: new Date().toISOString() },
          { headers }
        )
        updated = res.data?.updatedMobile || updated
      } catch (err) {
        logError(err.response?.data?.error || "Failed to add payment", err, shopId)
        if (updated) onUpdated?.(updated)
        throw new Error(updated
          ? `Saved part of the payment, but ${split.method} ₹${split.amount} failed. Check the history.`
          : "Failed to add payment. Please try again.")
      }
    }
    logSuccess("Payment added.", shopId)
    onUpdated?.(updated)
    setAdding(false)
  }

  const handleDelete = async (paymentId) => {
    if (!paymentId) return
    if (!confirm("Delete this payment?")) return
    setDeletingId(paymentId)
    try {
      const res = await api.post(
        "/api/delete-payment-entry",
        { id: mobile._id, paymentId },
        { headers }
      )
      logSuccess("Payment deleted.", shopId)
      onUpdated?.(res.data?.updatedMobile || null)
    } catch (err) {
      logError(
        err.response?.data?.error || "Failed to delete payment",
        err,
        shopId
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
    <BottomSheet
      open={open}
      onClose={adding ? () => {} : onClose}
      title="Payments"
      subtitle={`${mobile.mobile_name || "Mobile"} • Total ${formatINR(totalPaid)}`}
      footer={
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-base font-semibold text-white"
        >
          <Plus className="h-5 w-5" /> Add payment
        </button>
      }
    >
      {/* Existing payments */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          History ({payments.length})
        </p>
        {payments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
            <Wallet className="mx-auto mb-2 h-6 w-6 text-gray-400" />
            <p className="text-sm text-gray-500">No payments yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div
                key={p._id || `${p.date}-${p.amount}`}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {formatINR(p.amount)}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {formatPaymentMethodLabel(p.method) || "Other"} • {formatDateTime(p.date)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(p._id)}
                  disabled={deletingId === p._id}
                  className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-50"
                  aria-label="Delete payment"
                >
                  {deletingId === p._id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </BottomSheet>
    {/* Outside the sheet: its transform would otherwise anchor the fixed modal to the sheet */}
    <AddPaymentModal open={adding} currentTotal={totalPaid} onClose={() => setAdding(false)} onSubmit={handleAdd} />
    </>
  )
}

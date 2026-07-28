"use client"

import { useEffect, useState } from "react"
import {
  CheckCircle2,
  Circle,
  Loader2,
  Trash2,
  Wallet,
  Smartphone,
  Hash,
  Wrench,
  Calendar,
  Undo2,
  AlertTriangle,
  Receipt,
  Save,
  Pencil,
  PackageSearch,
} from "lucide-react"
import api from "@/components/api"
import { logAndNotify, logError, logSuccess } from "@/utils/logger"
import BottomSheet from "./BottomSheet"
import MobilePaymentSheet from "./MobilePaymentSheet"
import MobileUseProductSheet from "./MobileUseProductSheet"
import { formatDate, formatINR } from "./utils"
import { useShopWhatsappConfig } from "@/hooks/useShopWhatsappConfig"

/**
 * Detail bottom-sheet for one record.
 * Per-mobile actions:
 *   - Toggle Ready / Delivered / Returned (POST /api/toggle-status)
 *   - Open payments sheet (split payments)
 *   - Delete this mobile (DELETE /api/invoices/:clientId/:mobileIndex)
 * Record-level actions:
 *   - Edit balance amount (POST /api/allUpdateBalance)
 *   - Open receipt sheet (callback to parent)
 */
export default function MobileRecordDetailSheet({
  open,
  onClose,
  record,
  shopId,
  onChanged,
  onReceipt,
}) {
  const [working, setWorking] = useState({}) // mobileId -> bool
  const [paymentMobile, setPaymentMobile] = useState(null)
  const [useProductMobile, setUseProductMobile] = useState(null)
  const [balance, setBalance] = useState("")
  const [savingBalance, setSavingBalance] = useState(false)
  const [editingBalance, setEditingBalance] = useState(false)
  const [waConfirmState, setWaConfirmState] = useState({ open: false, mobile: null, field: null })
  // Whether WhatsApp automation is enabled for this shop (drives dialog visibility)
  const waShopEnabled = useShopWhatsappConfig()

  useEffect(() => {
    if (record) {
      setBalance(String(record.balance_amount ?? 0))
      setEditingBalance(false)
    }
  }, [record])

  if (!record) return null

  const headers = {
    Authorization: `Bearer ${
      typeof window !== "undefined" ? localStorage.getItem("token") : ""
    }`,
  }

  const setBusy = (id, val) =>
    setWorking((prev) => ({ ...prev, [id]: val }))

  // WA-triggering fields — only false→true transitions fire a WhatsApp message
  const WA_TRIGGER_FIELDS = ["ready", "delivered", "returned"]
  const WA_FIELD_LABELS = { ready: "Ready for Pickup", delivered: "Delivered", returned: "Returned" }

  const executeToggle = async (mobile, field, skipWhatsapp = false) => {
    setBusy(mobile._id, true)
    try {
      const res = await api.post(
        "/api/toggle-status",
        { id: mobile._id, field, skipWhatsapp },
        { headers }
      )
      onChanged?.({ type: "mobile", mobile: res.data?.updatedMobile })
    } catch (err) {
      logError(
        err.response?.data?.error || `Failed to toggle ${field}`,
        err,
        shopId
      )
    } finally {
      setBusy(mobile._id, false)
    }
  }

  const handleToggle = (mobile, field) => {
    // For false→true on WA-triggering fields, ask about WA only when WA is enabled for this shop
    if (WA_TRIGGER_FIELDS.includes(field) && !mobile[field] && waShopEnabled === true) {
      setWaConfirmState({ open: true, mobile, field })
      return
    }
    executeToggle(mobile, field)
  }

  const handleDelete = async (mobile, mobileIndex) => {
    if (!confirm(`Delete mobile #${mobileIndex + 1} from this record?`)) return
    setBusy(mobile._id, true)
    try {
      await api.delete(
        `/api/invoices/${record._id}/${mobileIndex}`,
        { headers }
      )
      logSuccess("Mobile deleted.", shopId)
      onChanged?.({ type: "deleted-mobile", mobileId: mobile._id })
    } catch (err) {
      logError(
        err.response?.data?.error || "Failed to delete mobile",
        err,
        shopId
      )
    } finally {
      setBusy(mobile._id, false)
    }
  }

  const handlePaymentUpdated = (updatedMobile) => {
    if (updatedMobile) {
      onChanged?.({ type: "mobile", mobile: updatedMobile })
    } else {
      onChanged?.({ type: "refresh" })
    }
  }

  const handleSaveBalance = async () => {
    const value = Number(balance)
    if (Number.isNaN(value) || value < 0) {
      logAndNotify("Enter a valid balance.", "warning", shopId)
      return
    }
    setSavingBalance(true)
    try {
      await api.post(
        "/api/allUpdateBalance",
        {
          id: record._id,
          balanceAmount: value,
          type: record.customer_type || "Customer",
        },
        { headers }
      )
      logSuccess("Balance updated.", shopId)
      onChanged?.({
        type: "record",
        recordId: record._id,
        patch: { balance_amount: value },
      })
      setEditingBalance(false)
    } catch (err) {
      logError(
        err.response?.data?.error || "Failed to update balance",
        err,
        shopId
      )
    } finally {
      setSavingBalance(false)
    }
  }

  const mobiles = record.mobiles || []

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        title={record.client_name || "Record"}
        subtitle={`${record.bill_no || "No bill"} • ${
          record.customer_type || "Customer"
        } • ${mobiles.length} mobile${mobiles.length === 1 ? "" : "s"}`}
        footer={
          <button
            type="button"
            onClick={() => onReceipt?.(record)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-base font-semibold text-white"
          >
            <Receipt className="h-5 w-5" /> Generate receipt
          </button>
        }
      >
        {/* Balance editor */}
        <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-500">
                Balance amount
              </p>
              {!editingBalance ? (
                <p
                  className={`mt-1 text-xl font-bold ${
                    Number(balance) > 0
                      ? "text-rose-600"
                      : "text-emerald-600"
                  }`}
                >
                  {formatINR(balance)}
                </p>
              ) : (
                <input
                  type="number"
                  inputMode="decimal"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  className="mt-1 w-32 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                />
              )}
            </div>
            {!editingBalance ? (
              <button
                type="button"
                onClick={() => setEditingBalance(true)}
                className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700"
              >
                <Pencil className="h-4 w-4" /> Edit
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveBalance}
                disabled={savingBalance}
                className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {savingBalance ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save
              </button>
            )}
          </div>
        </div>

        {/* Mobiles list */}
        {mobiles.length === 0 && (
          <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
            No mobile entries on this record.
          </p>
        )}
        <div className="space-y-3 pb-2">
          {mobiles.map((m, idx) => {
            const busy = !!working[m._id]
            const totalPaid =
              Number(m.total_paid || 0) ||
              (Array.isArray(m.payments)
                ? m.payments.reduce(
                    (s, p) => s + Number(p.amount || 0),
                    0
                  )
                : 0) ||
              Number(m.paid_amount || 0)
            return (
              <div
                key={m._id || idx}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white"
              >
                <div className="flex items-start justify-between gap-3 px-4 pt-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Smartphone className="h-3.5 w-3.5 text-gray-500" />
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {m.mobile_name || "Mobile"}{" "}
                        {m.model && (
                          <span className="font-normal text-gray-500">
                            • {m.model}
                          </span>
                        )}
                      </p>
                    </div>
                    {m.imei && (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-500">
                        <Hash className="h-3 w-3" /> {m.imei}
                      </p>
                    )}
                    {m.issue && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-600">
                        <Wrench className="h-3 w-3" /> {m.issue}
                      </p>
                    )}
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-400">
                      <Calendar className="h-3 w-3" />
                      Added {formatDate(m.added_date)}
                      {m.delivered && m.delivery_date && (
                        <> • Delivered {formatDate(m.delivery_date)}</>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(m, idx)}
                    disabled={busy}
                    className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 disabled:opacity-40"
                    aria-label="Delete mobile"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {/* Status toggles */}
                <div className="mt-2 grid grid-cols-3 gap-2 px-4">
                  <StatusButton
                    label="Ready"
                    active={!!m.ready}
                    busy={busy}
                    onClick={() => handleToggle(m, "ready")}
                    color="blue"
                  />
                  <StatusButton
                    label="Delivered"
                    active={!!m.delivered}
                    busy={busy}
                    onClick={() => handleToggle(m, "delivered")}
                    color="emerald"
                  />
                  <StatusButton
                    label="Returned"
                    active={!!m.returned}
                    busy={busy}
                    onClick={() => handleToggle(m, "returned")}
                    color="rose"
                  />
                </div>

                {/* Use Product row */}
                <button
                  type="button"
                  onClick={() => setUseProductMobile(m)}
                  className="mt-2 flex w-full items-center justify-between border-t border-gray-100 bg-violet-50 px-4 py-2.5 text-left"
                >
                  <div className="flex items-center gap-2">
                    <PackageSearch className="h-4 w-4 text-violet-600" />
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">
                        Product used
                      </p>
                      <p className="text-sm font-semibold text-gray-900">
                        {m.productName
                          ? `${m.productName}${m.quantity ? ` × ${m.quantity}` : ""}`
                          : "Not set"}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-violet-700">
                    {m.productName ? "Update" : "Add"}
                  </span>
                </button>

                {/* Payment row */}
                <button
                  type="button"
                  onClick={() => setPaymentMobile(m)}
                  className="flex w-full items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-2.5 text-left"
                >
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-emerald-600" />
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">
                        Paid
                      </p>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatINR(totalPaid)}
                        {Array.isArray(m.payments) && m.payments.length > 0 && (
                          <span className="ml-1 text-xs font-normal text-gray-500">
                            ({m.payments.length} entry
                            {m.payments.length === 1 ? "" : "s"})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-indigo-700">
                    Manage
                  </span>
                </button>
              </div>
            )
          })}
        </div>
      </BottomSheet>

      {/* WhatsApp Send Confirmation Dialog */}
      {waConfirmState.open && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[60]" />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl border border-gray-200 p-6 w-80 z-[60]">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-xl">
                💬
              </div>
              <h4 className="text-base font-semibold text-gray-900">Also send WhatsApp?</h4>
            </div>
            <p className="text-sm text-gray-600 mb-1">
              Status will be marked as{" "}
              <span className="font-semibold">{WA_FIELD_LABELS[waConfirmState.field]}</span>{" "}
              regardless.
            </p>
            <p className="text-sm text-gray-500 mb-5">
              Do you also want to send a WhatsApp notification to the customer?
            </p>
            <div className="flex gap-2">
              <button
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  const { mobile, field } = waConfirmState
                  setWaConfirmState({ open: false, mobile: null, field: null })
                  executeToggle(mobile, field, true)
                }}
              >
                Skip WhatsApp
              </button>
              <button
                className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                onClick={() => {
                  const { mobile, field } = waConfirmState
                  setWaConfirmState({ open: false, mobile: null, field: null })
                  executeToggle(mobile, field, false)
                }}
              >
                Send WhatsApp
              </button>
            </div>
          </div>
        </>
      )}

      <MobilePaymentSheet
        open={!!paymentMobile}
        onClose={() => setPaymentMobile(null)}
        mobile={paymentMobile}
        shopId={shopId}
        onUpdated={handlePaymentUpdated}
      />

      <MobileUseProductSheet
        open={!!useProductMobile}
        onClose={() => setUseProductMobile(null)}
        mobile={useProductMobile}
        shopId={shopId}
        onUpdated={() => {
          setUseProductMobile(null)
          onChanged?.({ type: "refresh" })
        }}
      />
    </>
  )
}

const colorMap = {
  blue: {
    on: "bg-indigo-50 border-indigo-300 text-indigo-700",
    off: "bg-white border-gray-200 text-gray-500",
  },
  emerald: {
    on: "bg-emerald-50 border-emerald-300 text-emerald-700",
    off: "bg-white border-gray-200 text-gray-500",
  },
  rose: {
    on: "bg-rose-50 border-rose-300 text-rose-700",
    off: "bg-white border-gray-200 text-gray-500",
  },
}

function StatusButton({ label, active, busy, onClick, color }) {
  const cls = colorMap[color] || colorMap.blue
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
        active ? cls.on : cls.off
      }`}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : active ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <Circle className="h-3.5 w-3.5" />
      )}
      {label}
    </button>
  )
}

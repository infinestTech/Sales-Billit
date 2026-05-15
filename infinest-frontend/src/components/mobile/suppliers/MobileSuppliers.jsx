"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Users,
  Search,
  X,
  Plus,
  RefreshCw,
  Phone,
  MapPin,
  ChevronRight,
  Edit3,
  Wallet,
} from "lucide-react"
import api from "@/components/api"
import BottomSheet from "../records/BottomSheet"
import { formatINR, formatDate, getShopIdFromToken } from "../records/utils"
import { logAndNotify, logError } from "@/utils/logger"
import {
  PAYMENT_METHOD_OPTIONS,
  DEFAULT_PAYMENT_METHOD,
} from "@/constants/paymentMethods"

export default function MobileSuppliers({ shopId: shopIdProp }) {
  const shopId = shopIdProp || getShopIdFromToken()
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [active, setActive] = useState(null) // for edit sheet
  const [showAdd, setShowAdd] = useState(false)

  const fetch = async () => {
    if (!shopId) return
    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      const res = await api.post(
        "/api/suppliers/list",
        { shop_id: shopId },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setSuppliers(res.data?.suppliers || [])
    } catch (err) {
      logError("Failed to load suppliers", err, shopId)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId])

  const filtered = useMemo(() => {
    if (!search.trim()) return suppliers
    const q = search.trim().toLowerCase()
    return suppliers.filter(
      (s) =>
        s.supplierName?.toLowerCase().includes(q) ||
        s.agencyName?.toLowerCase().includes(q) ||
        s.phoneNumber?.includes(q)
    )
  }, [suppliers, search])

  const totalDue = useMemo(
    () => suppliers.reduce((s, x) => s + Number(x.totalAmount || 0), 0),
    [suppliers]
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="px-4 pt-3 pb-2">
          <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 p-4 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs opacity-90">Total payable to suppliers</p>
                <p className="text-2xl font-bold">{formatINR(totalDue)}</p>
              </div>
              <Users className="h-8 w-8 opacity-80" />
            </div>
            <p className="mt-2 text-xs opacity-90">
              {suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""} on file
            </p>
          </div>
        </div>
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search supplier or agency…"
              className="w-full rounded-full border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-9 text-sm focus:border-amber-500 focus:bg-white focus:outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="mt-2 flex justify-end">
            <button
              onClick={fetch}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2 p-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-white" />
          ))}
        </div>
      ) : !filtered.length ? (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <Users className="mb-3 h-12 w-12 text-gray-300" />
          <p className="font-medium text-gray-700">No suppliers</p>
          <p className="text-sm text-gray-500">Tap "Add Supplier" to begin.</p>
        </div>
      ) : (
        <ul className="space-y-2 p-3 pb-32">
          {filtered.map((s) => (
            <li key={s._id}>
              <button
                onClick={() => setActive(s)}
                className="block w-full rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm active:bg-gray-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold text-gray-900">
                      {s.supplierName}
                    </h3>
                    {s.agencyName && (
                      <p className="truncate text-xs text-gray-500">{s.agencyName}</p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                      {s.phoneNumber && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {s.phoneNumber}
                        </span>
                      )}
                      {s.lastPaymentMethod && (
                        <span className="rounded-full bg-gray-100 px-1.5 py-0.5 capitalize text-gray-600">
                          {s.lastPaymentMethod}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-gray-500">Owed</p>
                    <p className="text-lg font-bold text-amber-600">
                      {formatINR(s.totalAmount)}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-gray-300" />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-24 right-4 z-20 flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg active:scale-95"
      >
        <Plus className="h-5 w-5" /> Add Supplier
      </button>

      {active && (
        <SupplierEditSheet
          supplier={active}
          shopId={shopId}
          onClose={() => setActive(null)}
          onSaved={() => {
            setActive(null)
            fetch()
          }}
        />
      )}

      {showAdd && (
        <AddSupplierSheet
          shopId={shopId}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false)
            fetch()
          }}
        />
      )}
    </div>
  )
}

function SupplierEditSheet({ supplier, shopId, onClose, onSaved }) {
  const [paid, setPaid] = useState("")
  const [pm, setPm] = useState(
    (supplier.lastPaymentMethod || DEFAULT_PAYMENT_METHOD).toLowerCase()
  )
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const current = Number(supplier.totalAmount || 0)
  const after = Math.max(0, current - Number(paid || 0))

  const submit = async () => {
    if (saving || !paid || Number(paid) <= 0) return
    setSaving(true)
    try {
      const token = localStorage.getItem("token")
      await api.post(
        "/api/suppliers/update",
        {
          shop_id: shopId,
          supplierId: supplier._id,
          paidAmount: Number(paid),
          lastPaymentMethod: pm,
          message: note || "Mobile: payment recorded",
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      logAndNotify("Payment recorded", "success", shopId)
      onSaved()
    } catch (err) {
      logError("Failed to update supplier", err, shopId)
      logAndNotify("Failed to record payment", "error", shopId)
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={supplier.supplierName}
      subtitle={supplier.agencyName || supplier.phoneNumber || ""}
      footer={
        <button
          onClick={submit}
          disabled={!paid || Number(paid) <= 0 || saving}
          className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : `Pay ${formatINR(paid || 0)}`}
        </button>
      }
    >
      <div className="rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 p-4 text-center">
        <p className="text-xs font-semibold uppercase text-amber-700">Currently owed</p>
        <p className="text-2xl font-bold text-amber-700">{formatINR(current)}</p>
      </div>

      <div className="mt-3 space-y-3">
        {supplier.address && (
          <div className="flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-sm">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <span className="text-gray-700">{supplier.address}</span>
          </div>
        )}
        <Field label="Payment amount ₹">
          <input
            type="number"
            inputMode="decimal"
            value={paid}
            onChange={(e) => setPaid(e.target.value)}
            className="input"
            placeholder="0"
          />
        </Field>
        <Field label="Payment method">
          <select value={pm} onChange={(e) => setPm(e.target.value)} className="input">
            {PAYMENT_METHOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Note (optional)">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="input"
            placeholder="e.g. Invoice #1023"
          />
        </Field>
        {Number(paid) > 0 && (
          <div className="rounded-lg bg-emerald-50 p-3 text-sm">
            <div className="flex justify-between text-emerald-800">
              <span>After payment</span>
              <span className="font-bold">{formatINR(after)}</span>
            </div>
          </div>
        )}
      </div>
      <SharedInputStyle />
    </BottomSheet>
  )
}

function AddSupplierSheet({ shopId, onClose, onSaved }) {
  const [form, setForm] = useState({
    supplierName: "",
    agencyName: "",
    phoneNumber: "",
    address: "",
  })
  const [saving, setSaving] = useState(false)
  const valid = form.supplierName.trim().length > 0
  const submit = async () => {
    if (!valid || saving) return
    setSaving(true)
    try {
      const token = localStorage.getItem("token")
      await api.post(
        "/api/suppliers/add",
        { shop_id: shopId, ...form, supplierName: form.supplierName.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      logAndNotify("Supplier added", "success", shopId)
      onSaved()
    } catch (err) {
      logError("Failed to add supplier", err, shopId)
      logAndNotify("Failed to add supplier", "error", shopId)
    } finally {
      setSaving(false)
    }
  }
  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  return (
    <BottomSheet
      open
      onClose={onClose}
      title="Add Supplier"
      footer={
        <button
          onClick={submit}
          disabled={!valid || saving}
          className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Supplier"}
        </button>
      }
    >
      <div className="space-y-3 pt-2">
        <Field label="Supplier name *">
          <input value={form.supplierName} onChange={upd("supplierName")} className="input" />
        </Field>
        <Field label="Agency / company">
          <input value={form.agencyName} onChange={upd("agencyName")} className="input" />
        </Field>
        <Field label="Phone">
          <input
            value={form.phoneNumber}
            onChange={upd("phoneNumber")}
            inputMode="tel"
            className="input"
          />
        </Field>
        <Field label="Address">
          <textarea
            value={form.address}
            onChange={upd("address")}
            rows={2}
            className="input resize-none"
          />
        </Field>
      </div>
      <SharedInputStyle />
    </BottomSheet>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </span>
      {children}
    </label>
  )
}

function SharedInputStyle() {
  return (
    <style jsx>{`
      :global(.input) {
        width: 100%;
        border: 1px solid #e5e7eb;
        background: #f9fafb;
        border-radius: 0.75rem;
        padding: 0.625rem 0.875rem;
        font-size: 0.875rem;
      }
      :global(.input:focus) {
        outline: none;
        border-color: #f59e0b;
        background: white;
      }
    `}</style>
  )
}

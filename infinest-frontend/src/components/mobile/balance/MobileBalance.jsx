"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Wallet,
  Search,
  X,
  RefreshCw,
  Phone,
  ChevronRight,
  Edit3,
  Check,
  Trash2,
  Smartphone,
  Receipt,
} from "lucide-react"
import api from "@/components/api"
import BottomSheet from "../records/BottomSheet"
import { formatINR, formatDate, getShopIdFromToken } from "../records/utils"
import { logAndNotify, logError } from "@/utils/logger"

const TYPE_CHIPS = [
  { id: "all", label: "All" },
  { id: "Customer", label: "Customers" },
  { id: "Dealer", label: "Dealers" },
]

export default function MobileBalance({ shopId: shopIdProp }) {
  const shopId = shopIdProp || getShopIdFromToken()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [active, setActive] = useState(null) // row open in sheet

  const fetchData = async () => {
    if (!shopId) return
    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      const headers = { Authorization: `Bearer ${token}` }
      const [cRes, dRes] = await Promise.all([
        api.post("/api/customers/balance", { shop_id: shopId }, { headers }),
        api.post("/api/dealers/balance", { shop_id: shopId }, { headers }),
      ])
      const customers = (cRes.data || []).map((c) => ({
        ...c,
        type: "Customer",
        mobiles: (c.mobiles || []).map((m) => ({
          mobileName: m.mobileName,
          addedDate: m.addedDate,
          issue: m.issue || "No issue",
        })),
      }))
      const dealers = (dRes.data || []).map((d) => ({
        ...d,
        type: "Dealer",
        mobiles: (d.mobiles || []).map((m) => ({
          mobileName: m.mobileName,
          addedDate: m.addedDate,
          issue: m.issue || "No issue",
        })),
      }))
      const merged = [...customers, ...dealers].sort((a, b) => {
        const da = new Date(a.mobiles[0]?.addedDate || 0)
        const db = new Date(b.mobiles[0]?.addedDate || 0)
        return db - da
      })
      setRows(merged)
    } catch (err) {
      if (err?.response?.data?.sessionExpired) return
      logError("Failed to load balances", err, shopId)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId])

  const filtered = useMemo(() => {
    let list = rows
    if (typeFilter !== "all") list = list.filter((r) => r.type === typeFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (r) =>
          (r.client_name || r.clientName || "").toLowerCase().includes(q) ||
          (r.mobile_number || "").includes(q) ||
          (r.bill_no || "").toLowerCase().includes(q)
      )
    }
    return list
  }, [rows, search, typeFilter])

  const stats = useMemo(() => {
    const total = filtered.reduce(
      (s, r) => s + Number(r.balance_amount || 0),
      0
    )
    const cust = filtered.filter((r) => r.type === "Customer")
    const deal = filtered.filter((r) => r.type === "Dealer")
    return {
      total,
      custTotal: cust.reduce((s, r) => s + Number(r.balance_amount || 0), 0),
      dealTotal: deal.reduce((s, r) => s + Number(r.balance_amount || 0), 0),
      count: filtered.length,
    }
  }, [filtered])

  const handleSave = async (id, type, amount) => {
    try {
      const token = localStorage.getItem("token")
      const res = await api.put(
        "/api/invoices/updateBalance",
        { id, balanceAmount: Number(amount), type },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.data.success) {
        setRows((prev) =>
          prev.map((r) => (r._id === id ? { ...r, balance_amount: Number(amount) } : r))
        )
        logAndNotify("Balance updated", "success", shopId)
        return true
      }
      throw new Error(res.data.error || "Update failed")
    } catch (err) {
      logError("Failed to update balance", err, shopId)
      logAndNotify("Failed to update balance", "error", shopId)
      return false
    }
  }

  const handleClear = async (id, type) => {
    try {
      const token = localStorage.getItem("token")
      const res = await api.put(
        "/api/invoices/clearBalance",
        { id, type },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.data.success) {
        setRows((prev) => prev.filter((r) => r._id !== id))
        logAndNotify("Balance cleared", "success", shopId)
        return true
      }
      throw new Error(res.data.error || "Clear failed")
    } catch (err) {
      logError("Failed to clear balance", err, shopId)
      logAndNotify("Failed to clear balance", "error", shopId)
      return false
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="px-4 pt-3 pb-2">
          <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 p-4 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium opacity-90">Total outstanding</p>
                <p className="text-2xl font-bold">{formatINR(stats.total)}</p>
              </div>
              <Wallet className="h-8 w-8 opacity-80" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-white/15 px-2 py-1.5">
                <div className="opacity-80">Customers</div>
                <div className="font-semibold">{formatINR(stats.custTotal)}</div>
              </div>
              <div className="rounded-lg bg-white/15 px-2 py-1.5">
                <div className="opacity-80">Dealers</div>
                <div className="font-semibold">{formatINR(stats.dealTotal)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, bill…"
              className="w-full rounded-full border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-9 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
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
          <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
            {TYPE_CHIPS.map((c) => (
              <button
                key={c.id}
                onClick={() => setTypeFilter(c.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  typeFilter === c.id
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 bg-white text-gray-600"
                }`}
              >
                {c.label}
              </button>
            ))}
            <button
              onClick={fetchData}
              className="ml-auto inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {stats.count} record{stats.count !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2 p-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-white" />
          ))}
        </div>
      ) : !filtered.length ? (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <Wallet className="mb-3 h-12 w-12 text-gray-300" />
          <p className="font-medium text-gray-700">No outstanding balances</p>
          <p className="text-sm text-gray-500">All payments are settled.</p>
        </div>
      ) : (
        <ul className="space-y-2 p-3 pb-24">
          {filtered.map((r) => (
            <li key={r._id}>
              <button
                onClick={() => setActive(r)}
                className="block w-full rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm active:bg-gray-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          r.type === "Customer" ? "bg-indigo-500" : "bg-purple-500"
                        }`}
                      />
                      <h3 className="truncate text-base font-semibold text-gray-900">
                        {r.client_name || r.clientName}
                      </h3>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                      {r.mobile_number && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {r.mobile_number}
                        </span>
                      )}
                      {r.bill_no && (
                        <span className="inline-flex items-center gap-1">
                          <Receipt className="h-3 w-3" />
                          #{r.bill_no}
                        </span>
                      )}
                      {r.noOfMobile != null && (
                        <span className="inline-flex items-center gap-1">
                          <Smartphone className="h-3 w-3" />
                          {r.noOfMobile} mobile{r.noOfMobile !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-gray-500">Due</p>
                    <p className="text-lg font-bold text-red-600">
                      {formatINR(r.balance_amount)}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-gray-300" />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {active && (
        <BalanceDetailSheet
          row={active}
          onClose={() => setActive(null)}
          onSave={handleSave}
          onClear={handleClear}
        />
      )}
    </div>
  )
}

function BalanceDetailSheet({ row, onClose, onSave, onClear }) {
  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState(String(row.balance_amount || 0))
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    const ok = await onSave(row._id, row.type, amount)
    setBusy(false)
    if (ok) {
      setEditing(false)
      onClose()
    }
  }

  const clear = async () => {
    if (!confirm("Clear this balance entry?")) return
    setBusy(true)
    const ok = await onClear(row._id, row.type)
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={row.client_name || row.clientName}
      subtitle={`${row.type} • ${row.mobile_number || "—"}`}
      footer={
        editing ? (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditing(false)
                setAmount(String(row.balance_amount || 0))
              }}
              className="flex-1 rounded-xl bg-gray-100 py-3 text-sm font-semibold text-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Check className="mr-1 inline h-4 w-4" />
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={clear}
              disabled={busy}
              className="flex-1 rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-600 disabled:opacity-50"
            >
              <Trash2 className="mr-1 inline h-4 w-4" />
              Clear
            </button>
            <button
              onClick={() => setEditing(true)}
              className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white"
            >
              <Edit3 className="mr-1 inline h-4 w-4" />
              Edit Balance
            </button>
          </div>
        )
      }
    >
      <div className="rounded-xl bg-gradient-to-r from-red-50 to-orange-50 p-4 text-center">
        <p className="text-xs font-semibold uppercase text-red-600">Outstanding</p>
        {editing ? (
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mx-auto mt-1 w-40 rounded-lg border border-red-200 bg-white px-3 py-2 text-center text-xl font-bold text-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
            autoFocus
          />
        ) : (
          <p className="mt-1 text-3xl font-bold text-red-700">
            {formatINR(row.balance_amount)}
          </p>
        )}
        {row.bill_no && (
          <p className="mt-1 text-xs text-gray-500">Bill #{row.bill_no}</p>
        )}
      </div>

      {row.mobiles?.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase text-gray-500">
            Linked mobiles ({row.mobiles.length})
          </p>
          <ul className="space-y-2">
            {row.mobiles.map((m, i) => (
              <li
                key={i}
                className="rounded-lg border border-gray-100 bg-gray-50 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {m.mobileName || "—"}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {m.issue}
                    </p>
                  </div>
                  {m.addedDate && (
                    <span className="text-[10px] text-gray-500">
                      {formatDate(m.addedDate)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </BottomSheet>
  )
}

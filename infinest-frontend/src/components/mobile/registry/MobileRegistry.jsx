"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Smartphone,
  Search,
  X,
  RefreshCw,
  CheckCircle2,
  Truck,
  RotateCcw,
  User,
  Wrench,
  Edit3,
} from "lucide-react"
import api from "@/components/api"
import BottomSheet from "../records/BottomSheet"
import { formatDate, getShopIdFromToken } from "../records/utils"
import { logAndNotify, logError } from "@/utils/logger"

const STATUS_CHIPS = [
  { id: "all", label: "All" },
  { id: "ready", label: "Ready", tone: "emerald" },
  { id: "delivered", label: "Delivered", tone: "blue" },
  { id: "returned", label: "Returned", tone: "rose" },
  { id: "pending", label: "Pending", tone: "amber" },
]

export default function MobileRegistry({ shopId: shopIdProp }) {
  const shopId = shopIdProp || getShopIdFromToken()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [editing, setEditing] = useState(null)

  const fetchData = async () => {
    if (!shopId) return
    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      const res = await api.post(
        "/api/fetchAllData",
        { shop_id: shopId },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const { customers = [], dealers = [] } = res.data || {}
      const flat = [...customers, ...dealers].flatMap((entry) =>
        (entry.mobiles || []).map((m) => ({
          id: m._id,
          clientName: entry.client_name,
          customerType: entry.customer_type,
          mobileName: m.mobile_name,
          model: m.model || "",
          imei: m.imei || "",
          issue: m.issue || "",
          technician: m.technician_name || "",
          ready: m.ready,
          delivered: m.delivered,
          returned: m.returned,
          addedDate: m.added_date,
        }))
      )
      flat.sort((a, b) => new Date(b.addedDate) - new Date(a.addedDate))
      setRows(flat)
    } catch (err) {
      logError("Failed to load registry", err, shopId)
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
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (r) =>
          r.clientName?.toLowerCase().includes(q) ||
          r.mobileName?.toLowerCase().includes(q) ||
          r.imei?.toLowerCase().includes(q) ||
          r.technician?.toLowerCase().includes(q)
      )
    }
    if (filter === "ready") list = list.filter((r) => r.ready && !r.delivered)
    else if (filter === "delivered") list = list.filter((r) => r.delivered)
    else if (filter === "returned") list = list.filter((r) => r.returned)
    else if (filter === "pending") list = list.filter((r) => !r.ready && !r.delivered && !r.returned)
    return list
  }, [rows, search, filter])

  const stats = useMemo(() => {
    return {
      total: rows.length,
      ready: rows.filter((r) => r.ready && !r.delivered).length,
      delivered: rows.filter((r) => r.delivered).length,
    }
  }, [rows])

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="px-4 pt-3 pb-2">
          <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 p-4 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs opacity-80">Mobile Registry</p>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs opacity-80">total devices</p>
              </div>
              <Smartphone className="h-8 w-8 opacity-60" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
              <Pill label="Ready" value={stats.ready} />
              <Pill label="Delivered" value={stats.delivered} />
            </div>
          </div>
        </div>
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, IMEI, model…"
              className="w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-9 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
            {STATUS_CHIPS.map((c) => (
              <button
                key={c.id}
                onClick={() => setFilter(c.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  filter === c.id
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                {c.label}
              </button>
            ))}
            <button
              onClick={fetchData}
              className="ml-auto rounded-full border border-slate-200 bg-white p-1.5 text-slate-600"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
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
          <Smartphone className="mb-3 h-12 w-12 text-slate-300" />
          <p className="font-medium text-slate-700">No devices</p>
        </div>
      ) : (
        <ul className="space-y-2 p-3 pb-32">
          {filtered.map((r) => (
            <li key={r.id} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-slate-900">
                      {r.mobileName} {r.model && <span className="font-normal text-slate-500">· {r.model}</span>}
                    </h3>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    <User className="mr-1 inline h-3 w-3" />
                    {r.clientName} · {r.customerType}
                  </p>
                  {r.imei && (
                    <p className="truncate text-[11px] font-mono text-slate-500">IMEI: {r.imei}</p>
                  )}
                  {r.issue && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600">{r.issue}</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    <StatusBadges row={r} />
                  </div>
                </div>
                <div className="text-right text-[11px] text-slate-400">
                  {formatDate(r.addedDate)}
                </div>
              </div>
              <button
                onClick={() => setEditing(r)}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-xs font-medium text-slate-700"
              >
                <Wrench className="h-3.5 w-3.5" />
                {r.technician ? `Tech: ${r.technician}` : "Assign technician"}
                <Edit3 className="h-3 w-3 opacity-60" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <TechnicianSheet
          row={editing}
          shopId={shopId}
          onClose={() => setEditing(null)}
          onSaved={(name) => {
            setRows((prev) =>
              prev.map((x) => (x.id === editing.id ? { ...x, technician: name } : x))
            )
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function Pill({ label, value }) {
  return (
    <div className="rounded-lg bg-white/10 px-2 py-1.5">
      <div className="text-[10px] opacity-90">{label}</div>
      <div className="text-base font-bold">{value}</div>
    </div>
  )
}

function StatusBadges({ row }) {
  const tags = []
  if (row.delivered) tags.push({ label: "Delivered", cls: "bg-indigo-100 text-indigo-700", Icon: Truck })
  else if (row.ready) tags.push({ label: "Ready", cls: "bg-emerald-100 text-emerald-700", Icon: CheckCircle2 })
  else tags.push({ label: "Pending", cls: "bg-amber-100 text-amber-700", Icon: Wrench })
  if (row.returned) tags.push({ label: "Returned", cls: "bg-rose-100 text-rose-700", Icon: RotateCcw })
  return tags.map((t, i) => (
    <span key={i} className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${t.cls}`}>
      <t.Icon className="h-2.5 w-2.5" /> {t.label}
    </span>
  ))
}

function TechnicianSheet({ row, shopId, onClose, onSaved }) {
  const [name, setName] = useState(row.technician || "")
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    if (saving) return
    setSaving(true)
    try {
      const token = localStorage.getItem("token")
      await api.put(
        `/api/updateTechnician/${row.id}`,
        { technicianName: name.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      logAndNotify("Technician updated", "success", shopId)
      onSaved(name.trim())
    } catch (err) {
      logError("Failed to update technician", err, shopId)
      logAndNotify("Failed to update", "error", shopId)
    } finally {
      setSaving(false)
    }
  }
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={`${row.mobileName}${row.model ? " · " + row.model : ""}`}
      subtitle={row.clientName}
      footer={
        <button
          onClick={submit}
          disabled={saving}
          className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Technician"}
        </button>
      }
    >
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Technician name
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 40))}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
          autoFocus
        />
      </label>
    </BottomSheet>
  )
}

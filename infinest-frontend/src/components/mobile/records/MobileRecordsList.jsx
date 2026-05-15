"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  Clock,
  Undo2,
  Wallet,
  Loader2,
  X,
} from "lucide-react"
import api from "@/components/api"
import { logError } from "@/utils/logger"
import ReceiptGenerator from "@/components/AllRecordTable/ReceiptGenerator"
import MobileFiltersSheet, { emptyFilters } from "./MobileFiltersSheet"
import MobileRecordCard from "./MobileRecordCard"
import MobileRecordDetailSheet from "./MobileRecordDetailSheet"
import { formatINR, summarizeMobiles } from "./utils"

/**
 * Mobile-native All-Records / View tab.
 * Mirrors the desktop AllRecordTable feature set:
 *   - Filters (POST /api/records)
 *   - Per-mobile status toggles, payments, delete
 *   - Balance edit
 *   - Receipt generation (reuses desktop ReceiptGenerator modal)
 */
export default function MobileRecordsList({ shopId, refreshKey }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filters, setFilters] = useState(emptyFilters)
  const [quickQuery, setQuickQuery] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [activeChip, setActiveChip] = useState("all") // all | pending | ready | delivered | returned | balance

  const [openRecord, setOpenRecord] = useState(null)
  const [receiptRecord, setReceiptRecord] = useState(null)

  const [shopMeta, setShopMeta] = useState({
    phone: "",
    address: "",
    owner: "",
  })

  const fetchRecords = useCallback(
    async (currentFilters = filters, silent = false) => {
      if (!shopId) return
      if (!silent) setLoading(true)
      else setRefreshing(true)
      try {
        const payload = { shopId, ...currentFilters }
        const res = await api.post("/api/records", payload, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        })
        const { mobiles = [], customers = [], dealers = [] } = res.data || {}
        setShopMeta({
          phone: res.data?.shopPhone || "",
          address: res.data?.shopaddress || "",
          owner: res.data?.shopOwnerName || "",
        })

        // Group mobiles by client (customer or dealer)
        const groups = new Map()
        for (const c of customers) {
          groups.set(`c_${c._id}`, {
            ...c,
            customer_type: "Customer",
            mobiles: [],
          })
        }
        for (const d of dealers) {
          groups.set(`d_${d._id}`, {
            ...d,
            customer_type: "Dealer",
            mobiles: [],
          })
        }
        for (const m of mobiles) {
          const key = m.customer_id
            ? `c_${m.customer_id}`
            : m.dealer_id
            ? `d_${m.dealer_id}`
            : null
          if (key && groups.has(key)) {
            groups.get(key).mobiles.push(m)
          }
        }
        const list = Array.from(groups.values()).sort((a, b) => {
          const ad = a.mobiles[0]?.added_date || a.createdAt || 0
          const bd = b.mobiles[0]?.added_date || b.createdAt || 0
          return new Date(bd) - new Date(ad)
        })
        setRecords(list)
      } catch (err) {
        logError("Failed to load records", err, shopId)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shopId]
  )

  useEffect(() => {
    fetchRecords(filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, refreshKey])

  // Quick query (client-side) and chip filtering
  const visible = useMemo(() => {
    const q = quickQuery.trim().toLowerCase()
    return records.filter((r) => {
      if (q) {
        const hay = [
          r.client_name,
          r.mobile_number,
          r.bill_no,
          ...(r.mobiles || []).map((m) => m.mobile_name),
          ...(r.mobiles || []).map((m) => m.imei),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      const stats = summarizeMobiles(r.mobiles || [])
      switch (activeChip) {
        case "pending":
          return stats.pending > 0
        case "ready":
          return stats.ready > 0
        case "delivered":
          return stats.total > 0 && stats.delivered === stats.total
        case "returned":
          return stats.returned > 0
        case "balance":
          return Number(r.balance_amount || 0) > 0
        default:
          return true
      }
    })
  }, [records, quickQuery, activeChip])

  // Top-of-list aggregate stats
  const totals = useMemo(() => {
    let pending = 0,
      ready = 0,
      delivered = 0,
      returned = 0,
      paid = 0,
      balance = 0
    for (const r of records) {
      const s = summarizeMobiles(r.mobiles || [])
      pending += s.pending
      ready += s.ready
      delivered += s.delivered
      returned += s.returned
      paid += s.totalPaid
      balance += Number(r.balance_amount || 0)
    }
    return { pending, ready, delivered, returned, paid, balance }
  }, [records])

  const handleRecordChanged = useCallback(
    (event) => {
      if (!event) return
      if (event.type === "mobile" && event.mobile) {
        setRecords((prev) =>
          prev.map((r) => ({
            ...r,
            mobiles: (r.mobiles || []).map((m) =>
              m._id === event.mobile._id ? { ...m, ...event.mobile } : m
            ),
          }))
        )
        // Keep openRecord in sync
        setOpenRecord((cur) =>
          cur
            ? {
                ...cur,
                mobiles: (cur.mobiles || []).map((m) =>
                  m._id === event.mobile._id ? { ...m, ...event.mobile } : m
                ),
              }
            : cur
        )
      } else if (event.type === "deleted-mobile" && event.mobileId) {
        setRecords((prev) =>
          prev
            .map((r) => ({
              ...r,
              mobiles: (r.mobiles || []).filter(
                (m) => m._id !== event.mobileId
              ),
            }))
            // If a record loses all mobiles, drop it
            .filter((r) => (r.mobiles || []).length > 0)
        )
        setOpenRecord((cur) =>
          cur
            ? {
                ...cur,
                mobiles: (cur.mobiles || []).filter(
                  (m) => m._id !== event.mobileId
                ),
              }
            : cur
        )
      } else if (event.type === "record" && event.recordId && event.patch) {
        setRecords((prev) =>
          prev.map((r) =>
            r._id === event.recordId ? { ...r, ...event.patch } : r
          )
        )
        setOpenRecord((cur) =>
          cur && cur._id === event.recordId ? { ...cur, ...event.patch } : cur
        )
      } else if (event.type === "refresh") {
        fetchRecords(filters, true)
      }
    },
    [fetchRecords, filters]
  )

  const handleApplyFilters = (next) => {
    setFilters(next)
    fetchRecords(next, false)
  }

  // Build receipt clientData when a record opens
  const receiptClientData = useMemo(() => {
    if (!receiptRecord) return null
    return {
      client_name: receiptRecord.client_name,
      mobile_number: receiptRecord.mobile_number,
      owner_name: shopMeta.owner || "INFINFEST MOBILE SERVICE",
      bill_no: receiptRecord.bill_no || "N/A",
      MobileName: (receiptRecord.mobiles || []).map((m) => ({
        _id: m._id,
        mobile_name: m.mobile_name,
        model: m.model || "",
        imei: m.imei || "",
        issue: m.issue,
        added_date: m.added_date,
        delivery_date: m.delivery_date || null,
        payments: m.payments || [],
        total_paid: m.total_paid || 0,
        paid_amount: m.paid_amount ?? 0,
      })),
    }
  }, [receiptRecord, shopMeta.owner])

  return (
    <div className="px-4 pb-24 pt-4">
      {/* Sticky search + filter */}
      <div className="sticky top-0 z-10 -mx-4 mb-3 bg-white/95 px-4 pb-3 backdrop-blur">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={quickQuery}
              onChange={(e) => setQuickQuery(e.target.value)}
              placeholder="Search name, phone, bill, IMEI…"
              className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-9 pr-9 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
            />
            {quickQuery && (
              <button
                type="button"
                onClick={() => setQuickQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            className="flex items-center gap-1 rounded-xl border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700"
          >
            <Filter className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => fetchRecords(filters, true)}
            disabled={refreshing}
            className="flex items-center gap-1 rounded-xl border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        {/* Quick stats */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="Delivered" value={totals.delivered} color="emerald" icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
          <Stat label="Pending" value={totals.pending + totals.ready} color="amber" icon={<Clock className="h-3.5 w-3.5" />} />
          <Stat label="Balance" value={formatINR(totals.balance)} color="rose" icon={<Wallet className="h-3.5 w-3.5" />} compact />
        </div>

        {/* Chip filter */}
        <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {[
            { id: "all", label: "All" },
            { id: "pending", label: "Pending" },
            { id: "ready", label: "Ready" },
            { id: "delivered", label: "Delivered" },
            { id: "returned", label: "Returned" },
            { id: "balance", label: "Has balance" },
          ].map((chip) => {
            const active = activeChip === chip.id
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setActiveChip(chip.id)}
                className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${
                  active
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 bg-white text-gray-600"
                }`}
              >
                {chip.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading records…
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-600">
            No records match your filters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => (
            <MobileRecordCard
              key={r._id}
              record={r}
              onOpen={(rec) => setOpenRecord(rec)}
              onReceipt={(rec) => setReceiptRecord(rec)}
            />
          ))}
        </div>
      )}

      {/* Sheets */}
      <MobileFiltersSheet
        open={showFilters}
        onClose={() => setShowFilters(false)}
        initial={filters}
        onApply={handleApplyFilters}
      />

      <MobileRecordDetailSheet
        open={!!openRecord}
        onClose={() => setOpenRecord(null)}
        record={openRecord}
        shopId={shopId}
        onChanged={handleRecordChanged}
        onReceipt={(rec) => setReceiptRecord(rec)}
      />

      {/* Receipt Modal — reuses desktop generator (full-screen) */}
      {receiptClientData && (
        <ReceiptGenerator
          clientData={receiptClientData}
          shopPhoneNumber={shopMeta.phone}
          shopAddress={shopMeta.address}
          closeModal={() => setReceiptRecord(null)}
        />
      )}
    </div>
  )
}

const statColor = {
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
  blue: "bg-indigo-50 text-indigo-700",
}

function Stat({ label, value, color, icon, compact }) {
  return (
    <div className={`rounded-xl px-2.5 py-2 ${statColor[color]}`}>
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">
        {icon}
        {label}
      </div>
      <p className={`mt-0.5 font-bold ${compact ? "text-sm" : "text-base"}`}>
        {value}
      </p>
    </div>
  )
}

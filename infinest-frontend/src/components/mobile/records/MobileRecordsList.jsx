"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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

const PAGE_SIZE = 20
const EMPTY_TOTALS = { pending: 0, ready: 0, delivered: 0, balance: 0 }

const statsDelta = (beforeMobiles, afterMobiles) => {
  const b = summarizeMobiles(beforeMobiles || [])
  const a = summarizeMobiles(afterMobiles || [])
  return {
    pending: a.pending - b.pending,
    ready: a.ready - b.ready,
    delivered: a.delivered - b.delivered,
  }
}

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
  const [activeChip, setActiveChip] = useState("all") // all | pending | processing | ready | delivered | shouldBeReturned | returned | balance
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [totals, setTotals] = useState(EMPTY_TOTALS)

  const queryRef = useRef("")
  const chipRef = useRef("all")
  const filtersRef = useRef(emptyFilters)
  const abortRef = useRef(null)
  // Set after local edits so the next server request regroups instead of using its short-lived cache
  const needsFreshRef = useRef(false)
  const sentinelRef = useRef(null)

  const [openRecord, setOpenRecord] = useState(null)
  const [receiptRecord, setReceiptRecord] = useState(null)

  const [shopMeta, setShopMeta] = useState({
    phone: "",
    address: "",
    owner: "",
  })

  // Loads one page; page 1 replaces the list, later pages append (infinite scroll)
  const loadPage = useCallback(
    async ({ pageToLoad = 1, fresh = false, mode = "replace", silent = false } = {}) => {
      if (!shopId) return
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      if (mode === "append") setLoadingMore(true)
      else if (!silent) setLoading(true)
      else setRefreshing(true)

      const forceFresh = fresh || needsFreshRef.current
      try {
        const payload = {
          shopId,
          ...filtersRef.current,
          view: "mobile",
          page: pageToLoad,
          limit: PAGE_SIZE,
          q: queryRef.current,
          chip: chipRef.current,
          fresh: forceFresh,
        }
        const res = await api.post("/api/records", payload, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          signal: controller.signal,
        })
        if (forceFresh) needsFreshRef.current = false
        setShopMeta({
          phone: res.data?.shopPhone || "",
          address: res.data?.shopaddress || "",
          owner: res.data?.shopOwnerName || "",
        })

        const incoming = res.data?.records || []
        if (mode === "append") {
          setRecords((prev) => {
            const seen = new Set(prev.map((r) => r._id))
            return [...prev, ...incoming.filter((r) => !seen.has(r._id))]
          })
        } else {
          setRecords(incoming)
          setTotals({ ...EMPTY_TOTALS, ...(res.data?.totals || {}) })
        }
        setPage(pageToLoad)
        setHasMore(!!res.data?.hasMore)
      } catch (err) {
        if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") return
        logError("Failed to load records", err, shopId)
      } finally {
        if (abortRef.current === controller) {
          setLoading(false)
          setRefreshing(false)
          setLoadingMore(false)
        }
      }
    },
    [shopId]
  )

  const fetchRecords = useCallback(
    (currentFilters = filtersRef.current, silent = false) => {
      filtersRef.current = currentFilters
      return loadPage({ pageToLoad: 1, fresh: true, mode: "replace", silent })
    },
    [loadPage]
  )

  useEffect(() => {
    fetchRecords(filtersRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, refreshKey])

  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(quickQuery.trim()), 300)
    return () => clearTimeout(t)
  }, [quickQuery])

  // Search text / chip changes re-query the server (the loaded list is also filtered instantly below)
  useEffect(() => {
    if (queryRef.current === debouncedQuery && chipRef.current === activeChip) return
    queryRef.current = debouncedQuery
    chipRef.current = activeChip
    loadPage({ pageToLoad: 1, mode: "replace", silent: true })
  }, [debouncedQuery, activeChip, loadPage])

  const loadMore = useCallback(() => {
    if (!hasMore || loading || loadingMore || refreshing) return
    loadPage({ pageToLoad: page + 1, mode: "append" })
  }, [hasMore, loading, loadingMore, refreshing, page, loadPage])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasMore) return
    const observer = new IntersectionObserver(
      (items) => {
        if (items.some((i) => i.isIntersecting)) loadMore()
      },
      { rootMargin: "400px 0px" }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, loadMore])

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
        case "processing":
          return stats.processing > 0
        case "ready":
          return stats.ready > 0
        case "delivered":
          return stats.total > 0 && stats.delivered === stats.total
        case "shouldBeReturned":
          return stats.shouldBeReturned > 0
        case "returned":
          return stats.returned > 0
        case "balance":
          return Number(r.balance_amount || 0) > 0
        default:
          return true
      }
    })
  }, [records, quickQuery, activeChip])

  const adjustTotals = (delta) =>
    setTotals((prev) => ({
      pending: Math.max(0, prev.pending + (delta.pending || 0)),
      ready: Math.max(0, prev.ready + (delta.ready || 0)),
      delivered: Math.max(0, prev.delivered + (delta.delivered || 0)),
      balance: prev.balance + (delta.balance || 0),
    }))

  const handleRecordChanged = useCallback(
    (event) => {
      if (!event) return
      needsFreshRef.current = true
      if (event.type === "mobile" && event.mobile) {
        const owner = records.find((r) => (r.mobiles || []).some((m) => m._id === event.mobile._id))
        if (owner) {
          const after = owner.mobiles.map((m) => (m._id === event.mobile._id ? { ...m, ...event.mobile } : m))
          adjustTotals(statsDelta(owner.mobiles, after))
        }
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
        const owner = records.find((r) => (r.mobiles || []).some((m) => m._id === event.mobileId))
        if (owner) {
          const after = owner.mobiles.filter((m) => m._id !== event.mobileId)
          const delta = statsDelta(owner.mobiles, after)
          // A record that loses its last mobile is dropped from the list, and from the balance total
          if (after.length === 0) delta.balance = -Number(owner.balance_amount || 0)
          adjustTotals(delta)
        }
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
        const target = records.find((r) => r._id === event.recordId)
        if (target && "balance_amount" in event.patch) {
          adjustTotals({
            balance: Number(event.patch.balance_amount || 0) - Number(target.balance_amount || 0),
          })
        }
        setRecords((prev) =>
          prev.map((r) =>
            r._id === event.recordId ? { ...r, ...event.patch } : r
          )
        )
        setOpenRecord((cur) =>
          cur && cur._id === event.recordId ? { ...cur, ...event.patch } : cur
        )
      } else if (event.type === "refresh") {
        fetchRecords(filtersRef.current, true)
      }
    },
    [fetchRecords, records]
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
            { id: "processing", label: "Processing" },
            { id: "ready", label: "Ready" },
            { id: "delivered", label: "Delivered" },
            { id: "shouldBeReturned", label: "SBRd" },
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

      {!loading && hasMore && (
        <div ref={sentinelRef} className="flex items-center justify-center py-6 text-sm text-gray-500">
          {loadingMore ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading more…
            </>
          ) : (
            <button
              type="button"
              onClick={loadMore}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
            >
              Load more
            </button>
          )}
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

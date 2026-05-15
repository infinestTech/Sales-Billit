"use client"

import { useEffect, useMemo, useState } from "react"
import {
  DollarSign,
  Plus,
  Search,
  X,
  Calendar,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Receipt,
} from "lucide-react"
import api from "@/components/api"
import BottomSheet from "../records/BottomSheet"
import {
  formatINR,
  formatDateTime,
  todayIST,
  getShopIdFromToken,
} from "../records/utils"
import { logAndNotify, logError } from "@/utils/logger"
import {
  PAYMENT_METHOD_OPTIONS,
  DEFAULT_PAYMENT_METHOD,
} from "@/constants/paymentMethods"

const RANGE_CHIPS = [
  { id: "today", label: "Today" },
  { id: "specific", label: "Specific" },
  { id: "range", label: "Range" },
]

export default function MobileExpenses({ shopId: shopIdProp }) {
  const shopId = shopIdProp || getShopIdFromToken()
  const [mode, setMode] = useState("today")
  const [date, setDate] = useState(todayIST())
  const [from, setFrom] = useState(todayIST())
  const [to, setTo] = useState(todayIST())
  const [expenses, setExpenses] = useState([])
  const [revenue, setRevenue] = useState({ totalRevenue: 0, serviceRevenue: 0, stockRevenue: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  const [showDate, setShowDate] = useState(false)

  const enumerateDates = (start, end) => {
    const out = []
    const s = new Date(start)
    const e = new Date(end)
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return [start]
    while (s <= e) {
      out.push(s.toISOString().slice(0, 10))
      s.setDate(s.getDate() + 1)
    }
    return out
  }

  const fetchData = async () => {
    if (!shopId) return
    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      const headers = { Authorization: `Bearer ${token}` }
      let dates = []
      if (mode === "today") dates = [todayIST()]
      else if (mode === "specific") dates = [date]
      else dates = enumerateDates(from, to)

      // Aggregate expenses across each date
      const expRes = await Promise.all(
        dates.map((d) =>
          api
            .post("/api/expenses/today", { shop_id: shopId, date: d }, { headers })
            .then((r) => r.data?.expenses || r.data || [])
            .catch(() => [])
        )
      )
      const flat = expRes.flat()
      flat.sort(
        (a, b) =>
          new Date(b.createdAt || b.date || 0) -
          new Date(a.createdAt || a.date || 0)
      )
      setExpenses(flat)

      // Aggregate daily-summary revenue
      const revRes = await Promise.all(
        dates.map((d) =>
          api
            .post(
              "/api/daily-summary",
              { shop_id: shopId, date: d },
              { headers }
            )
            .then((r) => r.data || {})
            .catch(() => ({}))
        )
      )
      const rev = revRes.reduce(
        (acc, r) => {
          acc.totalRevenue += Number(r.totalRevenue || 0)
          acc.serviceRevenue += Number(r.serviceRevenue || 0)
          acc.stockRevenue += Number(r.stockRevenue || 0)
          return acc
        },
        { totalRevenue: 0, serviceRevenue: 0, stockRevenue: 0 }
      )
      setRevenue(rev)
    } catch (err) {
      logError("Failed to load expenses", err, shopId)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, mode, date, from, to])

  const filtered = useMemo(() => {
    if (!search.trim()) return expenses
    const q = search.trim().toLowerCase()
    return expenses.filter(
      (e) =>
        (e.title || "").toLowerCase().includes(q) ||
        (e.paymentMethod || "").toLowerCase().includes(q)
    )
  }, [expenses, search])

  const totalExp = useMemo(
    () => expenses.reduce((s, e) => s + Number(e.amount || 0), 0),
    [expenses]
  )
  const net = revenue.totalRevenue - totalExp

  const dateLabel =
    mode === "today"
      ? "Today"
      : mode === "specific"
      ? date
      : `${from} → ${to}`

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="px-4 pt-3 pb-2">
          <div
            className={`rounded-2xl p-4 text-white ${
              net >= 0
                ? "bg-gradient-to-r from-emerald-500 to-teal-600"
                : "bg-gradient-to-r from-rose-500 to-red-600"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs opacity-90">Net profit</p>
                <p className="text-2xl font-bold">{formatINR(net)}</p>
              </div>
              <DollarSign className="h-8 w-8 opacity-80" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-white/15 px-2 py-1.5">
                <div className="flex items-center gap-1 opacity-90">
                  <TrendingUp className="h-3 w-3" /> Revenue
                </div>
                <div className="font-semibold">{formatINR(revenue.totalRevenue)}</div>
              </div>
              <div className="rounded-lg bg-white/15 px-2 py-1.5">
                <div className="flex items-center gap-1 opacity-90">
                  <TrendingDown className="h-3 w-3" /> Expenses
                </div>
                <div className="font-semibold">{formatINR(totalExp)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDate(true)}
              className="flex flex-1 items-center justify-between rounded-full border border-gray-200 bg-white px-4 py-2 text-sm"
            >
              <span className="flex items-center gap-2 text-gray-700">
                <Calendar className="h-4 w-4 text-gray-500" />
                {dateLabel}
              </span>
              <span className="text-xs text-indigo-600">Change</span>
            </button>
            <button
              onClick={fetchData}
              className="rounded-full border border-gray-200 bg-white p-2 text-gray-600"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search expenses…"
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
          <p className="mt-1 text-xs text-gray-500">
            {filtered.length} expense{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2 p-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-white" />
          ))}
        </div>
      ) : !filtered.length ? (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <Receipt className="mb-3 h-12 w-12 text-gray-300" />
          <p className="font-medium text-gray-700">No expenses</p>
          <p className="text-sm text-gray-500">Tap "Add" to record one.</p>
        </div>
      ) : (
        <ul className="space-y-2 p-3 pb-32">
          {filtered.map((e, i) => (
            <li
              key={e._id || i}
              className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {e.title || "—"}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
                  <span>{formatDateTime(e.createdAt || e.date)}</span>
                  {e.paymentMethod && (
                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 capitalize text-gray-600">
                      {e.paymentMethod}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm font-bold text-rose-600">
                -{formatINR(e.amount)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-24 right-4 z-20 flex items-center gap-2 rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-lg active:scale-95"
      >
        <Plus className="h-5 w-5" /> Add Expense
      </button>

      {showAdd && (
        <AddExpenseSheet
          shopId={shopId}
          defaultDate={mode === "specific" ? date : todayIST()}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false)
            fetchData()
          }}
        />
      )}

      {showDate && (
        <DateFilterSheet
          mode={mode}
          date={date}
          from={from}
          to={to}
          onClose={() => setShowDate(false)}
          onApply={(next) => {
            setMode(next.mode)
            setDate(next.date)
            setFrom(next.from)
            setTo(next.to)
            setShowDate(false)
          }}
        />
      )}
    </div>
  )
}

function AddExpenseSheet({ shopId, defaultDate, onClose, onSaved }) {
  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [pm, setPm] = useState(DEFAULT_PAYMENT_METHOD)
  const [date, setDate] = useState(defaultDate)
  const [saving, setSaving] = useState(false)

  const valid = title.trim() && Number(amount) > 0

  const submit = async () => {
    if (!valid || saving) return
    setSaving(true)
    try {
      const token = localStorage.getItem("token")
      // Use chosen date but anchor time to now
      const now = new Date()
      const [y, m, d] = date.split("-").map(Number)
      const createdAt = new Date(y, (m || 1) - 1, d || 1, now.getHours(), now.getMinutes(), now.getSeconds())
      await api.post(
        "/api/expenses/add",
        {
          shop_id: shopId,
          title: title.trim(),
          amount: Number(amount),
          paymentMethod: pm,
          createdAt: createdAt.toISOString(),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      logAndNotify("Expense added", "success", shopId)
      onSaved()
    } catch (err) {
      logError("Failed to add expense", err, shopId)
      logAndNotify("Failed to add expense", "error", shopId)
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title="Add Expense"
      footer={
        <button
          onClick={submit}
          disabled={!valid || saving}
          className="w-full rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : `Save ${amount ? formatINR(amount) : ""}`}
        </button>
      }
    >
      <div className="space-y-3 pt-2">
        <Field label="Title *">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Office stationery"
            className="input"
          />
        </Field>
        <Field label="Amount ₹ *">
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Payment Method">
          <select value={pm} onChange={(e) => setPm(e.target.value)} className="input">
            {PAYMENT_METHOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
          />
        </Field>
      </div>
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
          border-color: #f43f5e;
          background: white;
        }
      `}</style>
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

function DateFilterSheet({ mode, date, from, to, onClose, onApply }) {
  const [m, setM] = useState(mode)
  const [d, setD] = useState(date)
  const [f, setF] = useState(from)
  const [t, setT] = useState(to)
  return (
    <BottomSheet
      open
      onClose={onClose}
      title="Filter by date"
      footer={
        <button
          onClick={() => onApply({ mode: m, date: d, from: f, to: t })}
          className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white"
        >
          Apply
        </button>
      }
    >
      <div className="mb-3 flex rounded-xl bg-gray-100 p-1">
        {RANGE_CHIPS.map((c) => (
          <button
            key={c.id}
            onClick={() => setM(c.id)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              m === c.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      {m === "specific" && (
        <Field label="Date">
          <input
            type="date"
            value={d}
            onChange={(e) => setD(e.target.value)}
            className="input"
          />
        </Field>
      )}
      {m === "range" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <input
              type="date"
              value={f}
              onChange={(e) => setF(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="To">
            <input
              type="date"
              value={t}
              onChange={(e) => setT(e.target.value)}
              className="input"
            />
          </Field>
        </div>
      )}
      {m === "today" && (
        <p className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-700">
          Showing today's data only.
        </p>
      )}
    </BottomSheet>
  )
}

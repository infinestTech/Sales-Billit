"use client"

import { useEffect, useMemo, useState } from "react"
import {
  CalendarCheck,
  Search,
  X,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  UserPlus,
  Phone,
  Users,
} from "lucide-react"
import api from "@/components/api"
import BottomSheet from "../records/BottomSheet"
import { todayIST, getShopIdFromToken } from "../records/utils"
import { logAndNotify, logError } from "@/utils/logger"

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "present", label: "Present", tone: "emerald" },
  { id: "absent", label: "Absent", tone: "rose" },
  { id: "unmarked", label: "Unmarked", tone: "gray" },
]

export default function MobileAttendance({ shopId: shopIdProp }) {
  const shopId = shopIdProp || getShopIdFromToken()
  const [date, setDate] = useState(todayIST())
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [showAdd, setShowAdd] = useState(false)
  const [showDate, setShowDate] = useState(false)

  const fetchData = async () => {
    if (!shopId) return
    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      const headers = { Authorization: `Bearer ${token}` }
      const empRes = await api.get(`/api/employees/${shopId}`, { headers })
      const base = empRes.data?.data || []
      const attRes = await api
        .get(`/api/employees/attendance/${shopId}?date=${date}`, { headers })
        .catch(() => ({ data: {} }))
      setEmployees(attRes.data?.data || base)
    } catch (err) {
      logError("Failed to load attendance", err, shopId)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, date])

  const filtered = useMemo(() => {
    let list = employees
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (e) =>
          e.employee_name?.toLowerCase().includes(q) ||
          e.mobile_number?.includes(q)
      )
    }
    if (filter !== "all") {
      list = list.filter((e) => {
        const s = e.attendance?.status
        if (filter === "unmarked") return !s
        return s === filter
      })
    }
    return list
  }, [employees, search, filter])

  const stats = useMemo(() => {
    const present = employees.filter((e) => e.attendance?.status === "present").length
    const absent = employees.filter((e) => e.attendance?.status === "absent").length
    return { total: employees.length, present, absent }
  }, [employees])

  const isToday = date === todayIST()

  const mark = async (employeeId, status) => {
    try {
      const token = localStorage.getItem("token")
      await api.post(
        "/api/employees/attendance/mark",
        { shop_id: shopId, employee_id: employeeId, status },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      await fetchData()
    } catch (err) {
      const msg = err?.response?.data?.message
      if (err?.response?.status === 409) {
        logAndNotify(msg || "Already locked for this day", "warning", shopId)
        await fetchData()
      } else {
        logError("Failed to mark attendance", err, shopId)
        logAndNotify("Failed to mark attendance", "error", shopId)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="px-4 pt-3 pb-2">
          <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 p-4 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs opacity-90">Attendance · {date}</p>
                <p className="text-2xl font-bold">{stats.present} / {stats.total}</p>
                <p className="text-xs opacity-90">present today</p>
              </div>
              <CalendarCheck className="h-8 w-8 opacity-80" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <Pill label="Present" value={stats.present} tone="emerald" />
              <Pill label="Absent" value={stats.absent} tone="rose" />
              <Pill
                label="Unmarked"
                value={stats.total - stats.present - stats.absent}
                tone="amber"
              />
            </div>
          </div>
        </div>
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDate(true)}
              className="flex flex-1 items-center justify-between rounded-full border border-gray-200 bg-white px-4 py-2 text-sm"
            >
              <span className="text-gray-700">{isToday ? "Today" : date}</span>
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
              placeholder="Search employee…"
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
            {STATUS_FILTERS.map((c) => (
              <button
                key={c.id}
                onClick={() => setFilter(c.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  filter === c.id
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 bg-white text-gray-600"
                }`}
              >
                {c.label}
              </button>
            ))}
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
          <p className="font-medium text-gray-700">No employees</p>
          <p className="text-sm text-gray-500">Tap "Add Employee" to start.</p>
        </div>
      ) : (
        <ul className="space-y-2 p-3 pb-32">
          {filtered.map((e) => (
            <EmployeeCard
              key={e._id}
              employee={e}
              isToday={isToday}
              onMark={mark}
            />
          ))}
        </ul>
      )}

      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-24 right-4 z-20 flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg active:scale-95"
      >
        <UserPlus className="h-5 w-5" /> Add Employee
      </button>

      {showAdd && (
        <AddEmployeeSheet
          shopId={shopId}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false)
            fetchData()
          }}
        />
      )}

      {showDate && (
        <BottomSheet
          open
          onClose={() => setShowDate(false)}
          title="Pick date"
          footer={
            <button
              onClick={() => setShowDate(false)}
              className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white"
            >
              Done
            </button>
          }
        >
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm"
          />
          <button
            onClick={() => {
              setDate(todayIST())
            }}
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white py-2 text-sm font-medium text-gray-700"
          >
            Today
          </button>
        </BottomSheet>
      )}
    </div>
  )
}

function Pill({ label, value, tone }) {
  const map = {
    emerald: "bg-emerald-400/30",
    rose: "bg-rose-400/30",
    amber: "bg-amber-400/30",
  }
  return (
    <div className={`rounded-lg px-2 py-1.5 ${map[tone]}`}>
      <div className="text-[10px] opacity-90">{label}</div>
      <div className="text-base font-bold">{value}</div>
    </div>
  )
}

function EmployeeCard({ employee, isToday, onMark }) {
  const status = employee.attendance?.status

  return (
    <li className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-gray-900">
              {employee.employee_name}
            </h3>
            <StatusBadge status={status} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            {employee.mobile_number && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {employee.mobile_number}
              </span>
            )}
            {employee.blood_group && (
              <span className="rounded-full bg-rose-50 px-1.5 py-0.5 font-semibold text-rose-700">
                {employee.blood_group}
              </span>
            )}
          </div>
        </div>
      </div>

      {isToday && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => onMark(employee._id, "present")}
            disabled={status === "present"}
            className={`flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
              status === "present"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-emerald-600 text-white active:scale-[0.98]"
            }`}
          >
            <CheckCircle2 className="h-4 w-4" /> Present
          </button>
          <button
            onClick={() => onMark(employee._id, "absent")}
            disabled={status === "absent"}
            className={`flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
              status === "absent"
                ? "bg-rose-100 text-rose-700"
                : "bg-rose-600 text-white active:scale-[0.98]"
            }`}
          >
            <XCircle className="h-4 w-4" /> Absent
          </button>
        </div>
      )}
    </li>
  )
}

function StatusBadge({ status }) {
  if (status === "present")
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
        PRESENT
      </span>
    )
  if (status === "absent")
    return (
      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
        ABSENT
      </span>
    )
  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
      —
    </span>
  )
}

function AddEmployeeSheet({ shopId, onClose, onSaved }) {
  const [form, setForm] = useState({
    employee_name: "",
    mobile_number: "",
    address: "",
    blood_group: "",
  })
  const [saving, setSaving] = useState(false)
  const valid = form.employee_name.trim() && form.mobile_number.trim()
  const submit = async () => {
    if (!valid || saving) return
    setSaving(true)
    try {
      const token = localStorage.getItem("token")
      const res = await api.post(
        "/api/employees/add",
        { shop_id: shopId, ...form },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.data?.success) {
        logAndNotify("Employee added", "success", shopId)
        onSaved()
      } else {
        logAndNotify(res.data?.message || "Failed to add", "error", shopId)
      }
    } catch (err) {
      logError("Failed to add employee", err, shopId)
      logAndNotify("Failed to add employee", "error", shopId)
    } finally {
      setSaving(false)
    }
  }
  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  return (
    <BottomSheet
      open
      onClose={onClose}
      title="Add Employee"
      footer={
        <button
          onClick={submit}
          disabled={!valid || saving}
          className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Add Employee"}
        </button>
      }
    >
      <div className="space-y-3 pt-2">
        <Field label="Name *">
          <input value={form.employee_name} onChange={upd("employee_name")} className="input" />
        </Field>
        <Field label="Mobile number *">
          <input
            value={form.mobile_number}
            onChange={upd("mobile_number")}
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
        <Field label="Blood group">
          <select value={form.blood_group} onChange={upd("blood_group")} className="input">
            <option value="">—</option>
            {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
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
          border-color: #6366f1;
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

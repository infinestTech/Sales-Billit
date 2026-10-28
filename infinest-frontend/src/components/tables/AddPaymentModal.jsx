"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { X, ArrowLeft, Check, Banknote, Smartphone, CreditCard } from "lucide-react"

// Add Payment for a service record, in two steps: pick how the customer paid (one mode or a combination),
// then enter the amount. A combination asks for the total received plus the amount per mode; the mode
// not typed in fills with the remainder, and Add stays off until the split tallies with the total.
// onSubmit receives [{ method, amount }] — one payment entry per mode.

const ICONS = { Cash: Banknote, Gpay: Smartphone, "Gpay-H": Smartphone, "Gpay-S": Smartphone, Card: CreditCard }

const MODES = [
  { key: "Cash", methods: ["Cash"] },
  { key: "Gpay", methods: ["Gpay"] },
  { key: "Card", methods: ["Card"] },
  { key: "Cash + Gpay", methods: ["Cash", "Gpay"] },
  { key: "Cash + Card", methods: ["Cash", "Card"] },
  { key: "Gpay + Card", methods: ["Gpay", "Card"] },
  { key: "Cash + Gpay + Card", methods: ["Cash", "Gpay", "Card"] },
]
// Separate Gpay accounts some shops track (Gpay-H / Gpay-S)
const OTHER_MODES = [
  { key: "Gpay-H", methods: ["Gpay-H"] },
  { key: "Gpay-S", methods: ["Gpay-S"] },
]

const num = (v) => {
  const n = Number.parseFloat(v)
  return Number.isFinite(n) ? n : 0
}
const round2 = (n) => Math.round(n * 100) / 100
const rupees = (n) => "₹" + round2(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })

function ModeIcons({ methods, className }) {
  return (
    <span className="flex items-center -space-x-1">
      {methods.map((m) => {
        const Icon = ICONS[m] || Banknote
        return (
          <span key={m} className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-blue-50 text-blue-600 ${className || ""}`}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        )
      })}
    </span>
  )
}

export default function AddPaymentModal({ open, currentTotal, onClose, onSubmit }) {
  const [mode, setMode] = useState(null)
  const [total, setTotal] = useState("")
  const [amounts, setAmounts] = useState({})
  const [touched, setTouched] = useState([]) // split fields the user typed in, oldest first
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const firstInput = useRef(null)

  useEffect(() => {
    if (!open) return
    setMode(null)
    setTotal("")
    setAmounts({})
    setTouched([])
    setError("")
    setSaving(false)
  }, [open])

  useEffect(() => {
    if (mode) setTimeout(() => firstInput.current?.focus(), 30)
  }, [mode])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === "Escape" && !saving) onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, saving, onClose])

  const isSplit = !!mode && mode.methods.length > 1

  // The mode that takes the remainder: the last one the user has not typed in
  const autoMethod = useMemo(() => {
    if (!isSplit) return null
    const free = mode.methods.filter((m) => !touched.includes(m))
    return free.length ? free[free.length - 1] : null
  }, [isSplit, mode, touched])

  const fillRemainder = (nextTotal, nextAmounts, target) => {
    if (!target) return nextAmounts
    const others = mode.methods.filter((m) => m !== target).reduce((s, m) => s + num(nextAmounts[m]), 0)
    const rest = round2(num(nextTotal) - others)
    return { ...nextAmounts, [target]: nextTotal === "" ? "" : String(Math.max(0, rest)) }
  }

  const changeTotal = (value) => {
    setTotal(value)
    if (isSplit) setAmounts((a) => fillRemainder(value, a, autoMethod))
  }

  const changeSplit = (method, value) => {
    const nextTouched = [...touched.filter((m) => m !== method), method]
    // Keep at least one field free to absorb the remainder
    const trimmed = nextTouched.length >= mode.methods.length ? nextTouched.slice(1) : nextTouched
    const free = mode.methods.filter((m) => !trimmed.includes(m))
    const target = free.length ? free[free.length - 1] : null
    setTouched(trimmed)
    setAmounts((a) => fillRemainder(total, { ...a, [method]: value }, target))
  }

  const pickMode = (m) => {
    setMode(m)
    setAmounts({})
    setTouched([])
    setError("")
  }

  const totalNum = round2(num(total))
  const splitSum = isSplit ? round2(mode.methods.reduce((s, m) => s + num(amounts[m]), 0)) : totalNum
  const diff = round2(totalNum - splitSum)
  const tallied = totalNum > 0 && Math.abs(diff) < 0.01
  const missingPart = isSplit && mode.methods.some((m) => !(num(amounts[m]) > 0))
  const canSave = !!mode && tallied && !missingPart && !saving

  const submit = async (e) => {
    e?.preventDefault()
    if (!canSave) return
    setSaving(true)
    setError("")
    try {
      const splits = isSplit
        ? mode.methods.map((m) => ({ method: m, amount: round2(num(amounts[m])) }))
        : [{ method: mode.methods[0], amount: totalNum }]
      await onSubmit(splits)
    } catch (err) {
      setError(err?.message || "Failed to add payment. Please try again.")
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => !saving && onClose()} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-payment-title"
        className="fixed left-1/2 top-1/2 z-[61] w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            {mode && (
              <button type="button" onClick={() => setMode(null)} disabled={saving}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100" aria-label="Change payment method">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <h4 id="add-payment-title" className="text-base font-semibold text-gray-900">Add Payment</h4>
              <p className="text-xs text-gray-500">
                Step {mode ? 2 : 1} of 2 · {mode ? "Enter the amount" : "How did the customer pay?"}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between bg-gray-50 px-5 py-3">
          <span className="text-xs text-gray-600">Paid so far</span>
          <span className="text-lg font-bold text-gray-900">{rupees(currentTotal || 0)}</span>
        </div>

        {!mode ? (
          <div className="p-5">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => pickMode(m)}
                  className={`flex flex-col items-start gap-2 rounded-lg border border-gray-200 p-3 text-left transition hover:border-blue-500 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 ${m.methods.length === 3 ? "col-span-2 sm:col-span-3 flex-row items-center" : ""}`}
                >
                  <ModeIcons methods={m.methods} />
                  <span className="text-sm font-semibold text-gray-800">{m.key}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">Other:</span>
              {OTHER_MODES.map((m) => (
                <button key={m.key} type="button" onClick={() => pickMode(m)}
                  className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:border-blue-500 hover:bg-blue-50">
                  {m.key}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="p-5">
            <div className="mb-4 flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                <ModeIcons methods={mode.methods} /> {mode.key}
              </span>
              <button type="button" onClick={() => setMode(null)} disabled={saving} className="text-xs font-medium text-blue-700 hover:underline">
                Change
              </button>
            </div>

            <label className="mb-1 block text-xs font-medium text-gray-700" htmlFor="pay-total">
              {isSplit ? "Total amount received" : `Amount received by ${mode.key}`}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₹</span>
              <input
                id="pay-total"
                ref={firstInput}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={total}
                onChange={(e) => changeTotal(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="0"
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-7 pr-3 text-lg font-semibold focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            {isSplit && (
              <div className="mt-4 space-y-2.5">
                <p className="text-xs font-medium text-gray-700">Split by payment method</p>
                {mode.methods.map((m) => {
                  const Icon = ICONS[m] || Banknote
                  const isAuto = m === autoMethod
                  return (
                    <div key={m} className="flex items-center gap-3">
                      <span className="flex w-20 shrink-0 items-center gap-1.5 text-sm font-medium text-gray-700">
                        <Icon className="h-4 w-4 text-blue-600" /> {m}
                      </span>
                      <div className="relative flex-1">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₹</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={amounts[m] ?? ""}
                          onChange={(e) => changeSplit(m, e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          placeholder="0"
                          aria-label={`${m} amount`}
                          className={`w-full rounded-lg border py-2 pl-7 pr-16 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${isAuto ? "border-dashed border-gray-300 bg-gray-50" : "border-gray-300"}`}
                        />
                        {isAuto && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase text-gray-400">auto</span>}
                      </div>
                    </div>
                  )
                })}

                <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium ${
                  totalNum <= 0 ? "bg-gray-50 text-gray-500" : tallied ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800"
                }`}>
                  <span>Split {rupees(splitSum)} of {rupees(totalNum)}</span>
                  <span>
                    {totalNum <= 0 ? "Enter the total first" : tallied
                      ? (missingPart ? "Each method needs an amount" : "✓ Tallied")
                      : diff > 0 ? `${rupees(diff)} left to assign` : `${rupees(-diff)} over the total`}
                  </span>
                </div>
              </div>
            )}

            {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

            <button
              type="submit"
              disabled={!canSave}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {saving ? "Adding..." : totalNum > 0 ? `Add ${rupees(totalNum)}` : "Add payment"}
            </button>
          </form>
        )}
      </div>
    </>
  )
}

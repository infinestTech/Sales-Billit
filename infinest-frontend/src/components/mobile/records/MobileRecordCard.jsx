"use client"

import { useState } from "react"
import {
  Phone,
  Receipt,
  ChevronRight,
  Building2,
  User as UserIcon,
  CheckCircle2,
  Clock,
  Undo2,
  Wallet,
  AlertTriangle,
} from "lucide-react"
import { aggregatePaymentsByMethod, formatINR, summarizeMobiles, truncate } from "./utils"

/**
 * Single record card. Tap to open detail sheet. Quick actions for call & receipt.
 */
export default function MobileRecordCard({ record, onOpen, onReceipt }) {
  const stats = summarizeMobiles(record.mobiles || [])
  const breakdown = aggregatePaymentsByMethod(record.mobiles || [])
  const isDealer = record.customer_type === "Dealer"
  const allDelivered = stats.total > 0 && stats.delivered === stats.total

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${
        allDelivered ? "border-emerald-200" : "border-gray-200"
      }`}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => onOpen(record)}
        className="block w-full px-4 pt-3 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {isDealer ? (
                <Building2 className="h-3.5 w-3.5 text-purple-600" />
              ) : (
                <UserIcon className="h-3.5 w-3.5 text-indigo-600" />
              )}
              <p className="truncate text-base font-semibold text-gray-900">
                {record.client_name || "Unnamed"}
              </p>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {record.mobile_number || "—"}
              </span>
              <span>•</span>
              <span>{record.bill_no || "No bill"}</span>
            </div>
          </div>
          <ChevronRight className="mt-1 h-5 w-5 flex-shrink-0 text-gray-400" />
        </div>
      </button>

      {/* Status chips */}
      <div className="mt-2 flex flex-wrap gap-1.5 px-4">
        <Chip
          color="emerald"
          icon={<CheckCircle2 className="h-3 w-3" />}
          label={`Delivered ${stats.delivered}/${stats.total}`}
        />
        {stats.ready > 0 && (
          <Chip
            color="blue"
            icon={<Clock className="h-3 w-3" />}
            label={`Ready ${stats.ready}`}
          />
        )}
        {stats.pending > 0 && (
          <Chip color="amber" label={`Pending ${stats.pending}`} />
        )}
        {stats.shouldBeReturned > 0 && (
          <Chip
            color="amber"
            icon={<AlertTriangle className="h-3 w-3" />}
            label={`SBRd ${stats.shouldBeReturned}`}
          />
        )}
        {stats.returned > 0 && (
          <Chip
            color="rose"
            icon={<Undo2 className="h-3 w-3" />}
            label={`Returned ${stats.returned}`}
          />
        )}
      </div>

      {/* Money row */}
      <div className="mt-3 flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-2.5 text-xs">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-500">
            Balance
          </p>
          <p
            className={`text-sm font-semibold ${
              record.balance_amount > 0 ? "text-rose-600" : "text-gray-700"
            }`}
          >
            {formatINR(record.balance_amount)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-gray-500">
            Paid
          </p>
          <p className="text-sm font-semibold text-emerald-600">
            {formatINR(stats.totalPaid)}
          </p>
        </div>
      </div>

      {/* Payment breakdown */}
      {breakdown.length > 0 && (
        <div className="flex flex-wrap gap-1 px-4 py-2 text-[11px] text-gray-600">
          {breakdown.map((b) => (
            <span
              key={b.method}
              className="rounded-full bg-gray-100 px-2 py-0.5"
            >
              {b.method}: {formatINR(b.amount)}
            </span>
          ))}
        </div>
      )}

      {/* Footer actions */}
      <div className="grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100">
        {record.mobile_number ? (
          <a
            href={`tel:${record.mobile_number}`}
            className="flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-gray-700"
          >
            <Phone className="h-4 w-4" /> Call
          </a>
        ) : (
          <span className="flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-gray-300">
            <Phone className="h-4 w-4" /> Call
          </span>
        )}
        <button
          type="button"
          onClick={() => onReceipt(record)}
          className="flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-indigo-700"
        >
          <Receipt className="h-4 w-4" /> Receipt
        </button>
      </div>
    </div>
  )
}

const colorMap = {
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  blue: "bg-indigo-50 text-indigo-700 border-indigo-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  gray: "bg-gray-100 text-gray-700 border-gray-200",
}

function Chip({ color = "gray", icon, label }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${colorMap[color]}`}
    >
      {icon}
      {label}
    </span>
  )
}

"use client"

import { useState } from "react"
import { Filter, X, Calendar, Search, RotateCcw } from "lucide-react"
import BottomSheet from "./BottomSheet"

const emptyFilters = {
  clientName: "",
  mobileName: "",
  customerType: "",
  billNo: "",
  mobileNumber: "",
  mobileDate: "",
  fromDate: "",
  toDate: "",
}

export default function MobileFiltersSheet({
  open,
  onClose,
  initial,
  onApply,
}) {
  const [filters, setFilters] = useState(initial || emptyFilters)

  const set = (k, v) => setFilters((p) => ({ ...p, [k]: v }))

  const handleReset = () => {
    setFilters(emptyFilters)
    onApply(emptyFilters)
    onClose()
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Filters"
      subtitle="Narrow down records"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-300 bg-white py-3 text-sm font-medium text-gray-700"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(filters)
              onClose()
            }}
            className="flex flex-[2] items-center justify-center gap-1 rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white"
          >
            <Search className="h-4 w-4" /> Apply filters
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <FilterField label="Customer type">
          <div className="grid grid-cols-3 gap-2">
            {[
              { v: "", l: "All" },
              { v: "Customer", l: "Customer" },
              { v: "Dealer", l: "Dealer" },
            ].map((o) => {
              const active = filters.customerType === o.v
              return (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => set("customerType", o.v)}
                  className={`rounded-lg border px-2 py-2 text-sm ${
                    active
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-semibold"
                      : "border-gray-300 bg-white text-gray-700"
                  }`}
                >
                  {o.l}
                </button>
              )
            })}
          </div>
        </FilterField>

        <FilterField label="Client name">
          <input
            value={filters.clientName}
            onChange={(e) => set("clientName", e.target.value)}
            placeholder="Search by name"
            className="filter-input"
          />
        </FilterField>
        <FilterField label="Phone number">
          <input
            value={filters.mobileNumber}
            onChange={(e) => set("mobileNumber", e.target.value)}
            placeholder="Phone number"
            className="filter-input"
          />
        </FilterField>
        <FilterField label="Bill number">
          <input
            value={filters.billNo}
            onChange={(e) => set("billNo", e.target.value)}
            placeholder="CUST-…/DEAL-…"
            className="filter-input"
          />
        </FilterField>
        <FilterField label="Mobile name / brand">
          <input
            value={filters.mobileName}
            onChange={(e) => set("mobileName", e.target.value)}
            placeholder="iPhone, Samsung…"
            className="filter-input"
          />
        </FilterField>

        <FilterField label="Specific mobile date">
          <input
            type="date"
            value={filters.mobileDate}
            onChange={(e) => set("mobileDate", e.target.value)}
            className="filter-input"
          />
        </FilterField>

        <div className="grid grid-cols-2 gap-2">
          <FilterField label="From">
            <input
              type="date"
              value={filters.fromDate}
              onChange={(e) => set("fromDate", e.target.value)}
              className="filter-input"
            />
          </FilterField>
          <FilterField label="To">
            <input
              type="date"
              value={filters.toDate}
              onChange={(e) => set("toDate", e.target.value)}
              className="filter-input"
            />
          </FilterField>
        </div>
      </div>

      <style jsx>{`
        :global(.filter-input) {
          width: 100%;
          padding: 0.625rem 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid #d1d5db;
          background: white;
          font-size: 0.875rem;
        }
        :global(.filter-input:focus) {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
          outline: none;
        }
      `}</style>
    </BottomSheet>
  )
}

function FilterField({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">
        {label}
      </label>
      {children}
    </div>
  )
}

export { emptyFilters }

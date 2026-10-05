"use client";
import React from "react";

export const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || "http://localhost:8000";
export const authHeaders = () => ({ Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("shopAdminToken") : ""}` });

const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const PERIOD_PRESETS = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "this-month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "90d", label: "Last 90 days" },
];

export function presetRange(id) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const minus = (days) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
  switch (id) {
    case "today": return { from: ymd(today), to: ymd(today) };
    case "7d": return { from: ymd(minus(6)), to: ymd(today) };
    case "90d": return { from: ymd(minus(89)), to: ymd(today) };
    case "last-month": {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: ymd(first), to: ymd(last) };
    }
    case "this-month":
    default:
      return { from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), to: ymd(today) };
  }
}

export function usePeriod(initial = "this-month") {
  const [preset, setPreset] = React.useState(initial);
  const [range, setRange] = React.useState(() => presetRange(initial));
  const choose = (id) => { setPreset(id); setRange(presetRange(id)); };
  const setCustom = (patch) => { setPreset("custom"); setRange((r) => ({ ...r, ...patch })); };
  return { preset, range, choose, setCustom };
}

export function PeriodPicker({ period }) {
  const { preset, range, choose, setCustom } = period;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex flex-wrap rounded-lg border border-gray-200 bg-gray-50 p-1">
        {PERIOD_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => choose(p.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${preset === p.id ? "bg-green-600 text-white shadow" : "text-gray-600 hover:bg-white"}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 text-xs text-gray-600">
        <input type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && setCustom({ from: e.target.value })}
          className="px-2 py-1.5 border border-gray-300 rounded-lg text-gray-900 bg-white" />
        <span>to</span>
        <input type="date" value={range.to} min={range.from} onChange={(e) => e.target.value && setCustom({ to: e.target.value })}
          className="px-2 py-1.5 border border-gray-300 rounded-lg text-gray-900 bg-white" />
      </div>
    </div>
  );
}

export const inr = (n, digits = 0) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: digits }).format(Number(n) || 0);
export const num = (n) => new Intl.NumberFormat("en-IN").format(Number(n) || 0);
export const pct = (n) => (n === null || n === undefined ? "—" : `${Number(n).toFixed(1)}%`);

export function StatCard({ label, value, sub, tone = "gray", icon: Icon }) {
  const tones = {
    gray: "border-gray-200 text-gray-800",
    green: "border-green-200 bg-green-50 text-green-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-800",
    orange: "border-orange-200 bg-orange-50 text-orange-800",
    red: "border-red-200 bg-red-50 text-red-800",
  };
  return (
    <div className={`rounded-xl border p-4 bg-white ${tones[tone] || tones.gray}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium opacity-70">{label}</span>
        {Icon && <Icon className="h-4 w-4 opacity-60" />}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs mt-1 opacity-70">{sub}</div>}
    </div>
  );
}

export function Notice({ tone = "amber", children }) {
  const tones = {
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    red: "bg-red-50 border-red-200 text-red-700",
    blue: "bg-blue-50 border-blue-200 text-blue-800",
  };
  return <div className={`p-3 border rounded-lg text-sm ${tones[tone] || tones.amber}`}>{children}</div>;
}

export function downloadCsv(filename, header, rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

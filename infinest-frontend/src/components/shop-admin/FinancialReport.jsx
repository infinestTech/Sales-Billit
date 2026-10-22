"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import {
  FileText, RefreshCw, Download, FileSpreadsheet, TrendingUp, Wallet, Receipt, Landmark, ShoppingBag, Wrench, Layers, ArrowDownUp,
} from "lucide-react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { API_URL, authHeaders, usePeriod, PeriodPicker, StatCard, Notice, inr, num, pct } from "./analytics/analyticsShared";

/**
 * Shop-admin Financial Report.
 *   Sales only   → the sales report
 *   Service only → the existing service report (rendered by the dashboard, passed in as `serviceReport`)
 *   Combo        → Sales / Service / Sales + Service
 *
 * Sales numbers come from GET /api/shop-admin/reports/sales-financial (SalesServer financialReportController):
 *   Sales profit = sold for (after discount, before GST) − cost;  Net profit = sales profit − expenses;
 *   Net cash flow = collected − dealer payments − expenses − second-hand phones bought.
 * Service numbers come from the service report (GET /api/shop-admin/reports/financial), which is cash based:
 *   net = payments collected − supplier payments − expenses − spare purchases (+ returns).
 */

const IST_OFFSET_MS = 330 * 60 * 1000;
const istDay = (d) => new Date(new Date(d).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
const istDateTime = (d) => (d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
const istDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }) : "");
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const sum = (rows, key) => round2(rows.reduce((s, r) => s + (Number(typeof key === "function" ? key(r) : r[key]) || 0), 0));
const monthLabel = (ym) => { const [y, m] = ym.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" }); };
const dayLabel = (d) => { const [y, m, day] = d.split("-").map(Number); return new Date(y, m - 1, day).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }); };
const SOURCE_LABEL = { pos: "POS", whatsapp: "WhatsApp", seconds: "Second-hand" };

// ── Column helpers (one definition drives the on-screen table, the Excel sheet and the PDF table) ──
const money = (key, label, extra = {}) => ({ key, label, money: true, align: "right", ...extra });
const count = (key, label, extra = {}) => ({ key, label, align: "right", fmt: num, ...extra });
const percent = (key, label) => ({ key, label, align: "right", fmt: pct, raw: (r) => r[key] });
const text = (key, label, extra = {}) => ({ key, label, ...extra });
const cellValue = (col, row) => (col.value ? col.value(row) : row[col.key]);

/** Sums day rows into months when the range is long (or when asked). */
function groupPeriods(rows, groupBy, numericKeys) {
  const monthly = groupBy === "month" || (groupBy === "auto" && rows.length > 62);
  if (!monthly) return { rows: rows.map((r) => ({ ...r, period: dayLabel(r.date) })), monthly: false };
  const map = new Map();
  rows.forEach((r) => {
    const key = r.date.slice(0, 7);
    const m = map.get(key) || { date: key, period: monthLabel(key), ...Object.fromEntries(numericKeys.map((k) => [k, 0])) };
    numericKeys.forEach((k) => { m[k] = round2(m[k] + (Number(r[k]) || 0)); });
    map.set(key, m);
  });
  return { rows: [...map.values()], monthly: true };
}

// ── Sales sections ──
const SALES_DAY_KEYS = ["bills", "netSales", "gst", "revenue", "cogs", "salesProfit", "expenses", "netProfit", "supplierPayments", "netCashFlow"];

function salesSections(report, groupBy) {
  const days = groupPeriods(report.byDay || [], groupBy, SALES_DAY_KEYS);
  return [
    {
      id: "trend", title: days.monthly ? "Month-wise" : "Day-wise", rows: days.rows, totals: true,
      columns: [text("period", days.monthly ? "Month" : "Date"), count("bills", "Bills"), money("netSales", "Sold for"), money("gst", "GST"),
        money("cogs", "Cost of goods"), money("salesProfit", "Sales profit", { tone: "profit" }), money("expenses", "Expenses"),
        money("netProfit", "Net profit", { tone: "profit", strong: true }), money("supplierPayments", "Dealer payments"), money("netCashFlow", "Net cash flow", { tone: "profit" })],
    },
    {
      id: "bills", title: "Bills", rows: report.bills || [], totals: true, expandable: true,
      columns: [text("date", "Date", { value: (r) => istDateTime(r.date) }), text("invoiceNo", "Invoice", { value: (r) => (r.invoiceNo ? `#${r.invoiceNo}` : "") }),
        text("source", "Type", { value: (r) => SOURCE_LABEL[r.source] || r.source }), text("branchName", "Branch"),
        text("customerName", "Customer", { value: (r) => [r.customerName, r.customerNo].filter(Boolean).join(" · ") }),
        text("employeeName", "Salesperson", { value: (r) => r.employeeName || "" }), text("paymentMethod", "Payment"),
        count("itemsSold", "Items"), money("netSales", "Sold for"), money("gst", "GST"), money("revenue", "Bill total"), money("cost", "Cost"),
        money("profit", "Profit", { tone: "profit", strong: true })],
    },
    {
      id: "products", title: "Products", rows: report.products || [], totals: true,
      columns: [text("productNo", "Code"), text("productName", "Product"), count("qty", "Qty"), money("revenue", "Sold for"), money("cost", "Cost"),
        money("profit", "Profit", { tone: "profit", strong: true }), percent("marginPercent", "Margin")],
    },
    {
      id: "expenses", title: "Expenses", rows: report.expenses || [], totals: true,
      columns: [text("date", "Date", { value: (r) => istDate(r.date) }), text("branchName", "Branch"), text("title", "Expense"), text("paymentMethod", "Payment"), money("amount", "Amount")],
    },
    {
      id: "dealers", title: "Dealer payments", rows: report.supplierPayments || [], totals: true,
      columns: [text("date", "Date", { value: (r) => istDate(r.date) }), text("dealer", "Dealer"), text("branchName", "Branch"), text("method", "Method"),
        count("bills", "Bills settled"), text("note", "Note"), money("amount", "Amount paid")],
    },
    {
      id: "branches", title: "Branches", rows: report.byBranch || [], totals: true,
      columns: [text("branchName", "Branch"), count("bills", "Bills"), money("netSales", "Sold for"), money("cogs", "Cost"), money("salesProfit", "Sales profit", { tone: "profit" }),
        percent("marginPercent", "Margin"), money("expenses", "Expenses"), money("netProfit", "Net profit", { tone: "profit", strong: true }), money("supplierPayments", "Dealer payments")],
    },
    {
      id: "employees", title: "Salespeople", rows: report.byEmployee || [], totals: true,
      columns: [text("name", "Salesperson"), text("code", "Code"), count("bills", "Bills"), count("itemsSold", "Items"), money("netSales", "Sold for"),
        money("salesProfit", "Sales profit", { tone: "profit", strong: true }), percent("marginPercent", "Margin")],
    },
    {
      id: "payments", title: "Payment modes", rows: report.byPayment || [], totals: true,
      columns: [text("method", "Mode"), count("bills", "Bills"), money("amount", "Amount received")],
    },
  ];
}

function salesSummaryRows(s) {
  const rows = [
    { label: "Bills", value: num(s.bills), note: [s.posBills && `${num(s.posBills)} POS`, s.whatsappBills && `${num(s.whatsappBills)} WhatsApp`, s.secondsSold && `${num(s.secondsSold)} second-hand`].filter(Boolean).join(" · ") },
    { label: "Items sold", value: num(s.itemsSold) },
    { label: "Gross sales (before discount)", amount: s.grossSales },
    { label: "Discount given", amount: -s.discount },
    { label: "Sold for (after discount, before GST)", amount: s.netSales },
    { label: "GST collected", amount: s.gst },
    { label: "Total billed / collected", amount: s.collected, strong: true },
    { label: "Cost of goods sold", amount: -s.cogs },
    { label: "Sales profit (sold for − cost)", amount: s.salesProfit, strong: true, note: `${pct(s.marginPercent)} margin` },
  ];
  if (s.secondsSold) rows.push({ label: "  of which second-hand phones", amount: s.secondsProfit, note: `${num(s.secondsSold)} sold for ${inr(s.secondsRevenue)}` });
  rows.push(
    { label: "Expenses", amount: -s.expenses, note: `${num(s.expenseCount)} entries` },
    { label: "Net profit (sales profit − expenses)", amount: s.netProfit, strong: true, note: `${pct(s.netMarginPercent)} of sales` },
    { label: "Dealer (supplier credit) payments", amount: -s.supplierPayments, note: `${num(s.supplierPaymentCount)} payments` },
  );
  if (s.secondsPurchases) rows.push({ label: "Second-hand phones bought", amount: -s.secondsPurchases });
  rows.push({ label: "Net cash flow (collected − dealer payments − expenses)", amount: s.netCashFlow, strong: true });
  return rows;
}

// ── Service report helpers (shape of GET /reports/financial) ──
function serviceByDay(svc, from, to) {
  const days = new Map();
  for (let t = new Date(`${from}T00:00:00Z`).getTime(); t <= new Date(`${to}T00:00:00Z`).getTime(); t += 86400000) {
    const d = new Date(t).toISOString().slice(0, 10);
    days.set(d, { date: d, serviceIncome: 0, serviceOut: 0 });
  }
  const add = (rows, field, sign) => (rows || []).forEach((r) => {
    if (!r?.date) return;
    const d = days.get(istDay(r.date));
    if (d) d[field] += sign * (Number(r.amount) || 0);
  });
  add(svc?.customerPayments, "serviceIncome", 1);
  add(svc?.dealerPayments, "serviceIncome", 1);
  add(svc?.supplierPayments, "serviceOut", 1);
  add(svc?.expenses, "serviceOut", 1);
  add(svc?.sparePurchases, "serviceOut", 1);
  add(svc?.spareReturns, "serviceOut", -1);
  return days;
}

function serviceSections(svc) {
  const income = [
    ...(svc?.customerPayments || []).map((p) => ({ ...p, kind: "Customer", party: p.customerName, detail: [p.mobileName, p.issue].filter(Boolean).join(" · ") })),
    ...(svc?.dealerPayments || []).map((p) => ({ ...p, kind: "Dealer", party: p.dealerName || p.customerName || "", detail: p.mobileName || "" })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date));
  return [
    {
      id: "svc-income", title: "Service — payments collected", rows: income, totals: true,
      columns: [text("date", "Date", { value: (r) => istDate(r.date) }), text("kind", "From"), text("party", "Name"), text("detail", "Job"), text("paymentMethod", "Payment"), money("amount", "Amount")],
    },
    {
      id: "svc-expenses", title: "Service — expenses", rows: svc?.expenses || [], totals: true,
      columns: [text("date", "Date", { value: (r) => istDate(r.date) }), text("category", "Category"), text("description", "Expense"), money("amount", "Amount")],
    },
    {
      id: "svc-suppliers", title: "Service — supplier payments", rows: svc?.supplierPayments || [], totals: true,
      columns: [text("date", "Date", { value: (r) => istDate(r.date) }), text("supplierName", "Supplier"), text("productName", "For"), text("paymentMethod", "Payment"), money("amount", "Amount")],
    },
    {
      id: "svc-spares", title: "Service — spare parts purchased", rows: svc?.sparePurchases || [], totals: true,
      columns: [text("date", "Date", { value: (r) => istDate(r.date) }), text("spareName", "Spare"), count("quantity", "Qty"), money("costPrice", "Unit cost"), money("amount", "Amount")],
    },
  ];
}

// ── Exports ──
const fileStamp = (range) => `${range.from}_to_${range.to}`;

function exportExcel({ fileName, summaryTitle, summaryRows, meta, sections }) {
  const wb = XLSX.utils.book_new();
  const summary = [
    [summaryTitle], ...meta.map((m) => [m]), [],
    ["Metric", "Amount (₹)", "Note"],
    ...summaryRows.map((r) => [r.label.trim(), r.amount !== undefined ? round2(r.amount) : r.value, r.note || ""]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(summary);
  ws["!cols"] = [{ wch: 52 }, { wch: 18 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws, "Summary");
  const used = new Set(["Summary"]);
  sections.forEach((sec) => {
    const header = sec.columns.map((c) => (c.money ? `${c.label} (₹)` : c.label));
    const body = sec.rows.map((r) => sec.columns.map((c) => {
      const v = cellValue(c, r);
      if (c.money) return round2(v);
      if (c.raw) return c.raw(r);
      return v ?? "";
    }));
    if (sec.totals && sec.rows.length) body.push(sec.columns.map((c, i) => (i === 0 ? "Total" : c.money ? sum(sec.rows, (r) => cellValue(c, r)) : c.fmt === num ? sum(sec.rows, (r) => cellValue(c, r)) : "")));
    const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
    sheet["!cols"] = sec.columns.map((c) => ({ wch: Math.max(10, c.label.length + 4, c.key === "productName" || c.key === "customerName" ? 32 : 0) }));
    let name = sec.title.replace(/[\\/?*[\]:]/g, "").slice(0, 31);
    while (used.has(name)) name = `${name.slice(0, 28)}_${used.size}`;
    used.add(name);
    XLSX.utils.book_append_sheet(wb, sheet, name);
  });
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

async function exportPdf({ fileName, title, summaryRows, meta, sections }) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  // The built-in PDF fonts have no ₹ glyph, so amounts are printed as plain numbers under "(Rs)" headings
  const amt = (n) => (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // ...and no Unicode minus either
  const t = (v) => String(v ?? "").replace(/−/g, "-").replace(/₹/g, "Rs ");
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFontSize(16); doc.setFont("helvetica", "bold");
  doc.text(t(title), 14, 16);
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(90);
  meta.forEach((m, i) => doc.text(t(m), 14, 22 + i * 4.5));
  doc.setTextColor(0);
  let y = 22 + meta.length * 4.5 + 2;

  autoTable(doc, {
    startY: y,
    head: [["Summary", "Amount (Rs)", "Note"]],
    body: summaryRows.map((r) => [t(r.label.trim()), r.amount !== undefined ? amt(r.amount) : t(r.value), t(r.note || "")]),
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 1.6 },
    headStyles: { fillColor: [22, 163, 74] },
    columnStyles: { 0: { cellWidth: 95 }, 1: { halign: "right", cellWidth: 40 } },
    didParseCell: (d) => { if (d.section === "body" && summaryRows[d.row.index]?.strong) d.cell.styles.fontStyle = "bold"; },
    margin: { left: 14, right: 14 },
  });
  y = doc.lastAutoTable.finalY + 8;

  sections.forEach((sec) => {
    if (!sec.rows.length) return;
    if (y > doc.internal.pageSize.getHeight() - 45) { doc.addPage(); y = 16; }
    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text(t(`${sec.title} (${sec.rows.length})`), 14, y);
    doc.setFont("helvetica", "normal");
    const body = sec.rows.map((r) => sec.columns.map((c) => {
      const v = cellValue(c, r);
      if (c.money) return amt(v);
      if (c.fmt) return t(c.fmt(v));
      return t(v);
    }));
    const foot = sec.totals ? [sec.columns.map((c, i) => (i === 0 ? "Total" : c.money ? amt(sum(sec.rows, (r) => cellValue(c, r))) : c.fmt === num ? num(sum(sec.rows, (r) => cellValue(c, r))) : ""))] : undefined;
    autoTable(doc, {
      startY: y + 2,
      head: [sec.columns.map((c) => t(c.money ? `${c.label} (Rs)` : c.label))],
      body,
      foot,
      theme: "striped",
      styles: { fontSize: 7.5, cellPadding: 1.3, overflow: "linebreak" },
      headStyles: { fillColor: [55, 65, 81] },
      footStyles: { fillColor: [229, 231, 235], textColor: 20, fontStyle: "bold" },
      columnStyles: Object.fromEntries(sec.columns.map((c, i) => [i, c.align === "right" ? { halign: "right" } : {}])),
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;
  });

  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(120);
    doc.text(`Page ${i} of ${pages}`, pageW - 14, doc.internal.pageSize.getHeight() - 6, { align: "right" });
  }
  doc.save(`${fileName}.pdf`);
}

// ── UI pieces ──
function Panel({ title, action, children, className = "" }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

const toneClass = (col, v) => (col.tone === "profit" ? (Number(v) < 0 ? "text-red-600" : "text-green-700") : "text-gray-800");

function DataTable({ section }) {
  const [limit, setLimit] = useState(100);
  const [open, setOpen] = useState(null);
  const { columns, rows, totals, expandable } = section;
  useEffect(() => { setLimit(100); setOpen(null); }, [rows]);
  if (!rows.length) return <div className="py-10 text-center text-sm text-gray-500">Nothing to show for this period.</div>;
  const shown = rows.slice(0, limit);
  const show = (c, r) => {
    const v = cellValue(c, r);
    if (c.money) return inr(v, 2);
    if (c.fmt) return c.fmt(v);
    return v === undefined || v === null || v === "" ? "—" : v;
  };
  return (
    <div>
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-3 py-2 text-xs font-semibold text-gray-600 whitespace-nowrap ${c.align === "right" ? "text-right" : "text-left"}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {shown.map((r, i) => {
              const key = r.id || r.date || `${i}`;
              return (
                <React.Fragment key={key}>
                  <tr
                    className={`${expandable ? "cursor-pointer" : ""} hover:bg-gray-50`}
                    onClick={expandable ? () => setOpen(open === key ? null : key) : undefined}
                    title={expandable ? "Show items" : undefined}
                  >
                    {columns.map((c) => (
                      <td key={c.key} className={`px-3 py-2 whitespace-nowrap ${c.align === "right" ? "text-right tabular-nums" : "text-left"} ${c.strong ? "font-semibold" : ""} ${toneClass(c, cellValue(c, r))}`}>
                        {show(c, r)}
                      </td>
                    ))}
                  </tr>
                  {expandable && open === key && Array.isArray(r.items) && (
                    <tr className="bg-indigo-50/40">
                      <td colSpan={columns.length} className="px-3 py-2">
                        <div className="sticky left-3 inline-block">
                        <table className="text-xs">
                          <thead><tr className="text-gray-500"><th className="text-left pr-4">Product</th><th className="text-right pr-4">Qty</th><th className="text-right pr-4">Sold at</th><th className="text-right pr-4">Cost</th><th className="text-right">Profit</th></tr></thead>
                          <tbody>
                            {r.items.map((it, j) => (
                              <tr key={j}>
                                <td className="pr-4 py-0.5 text-gray-800">{it.productName}{it.productNo ? <span className="text-gray-400"> · {it.productNo}</span> : null}</td>
                                <td className="pr-4 text-right">{num(it.qty)}</td>
                                <td className="pr-4 text-right">{inr(it.soldAt, 2)}</td>
                                <td className="pr-4 text-right">{it.costPrice > 0 ? inr(it.costPrice, 2) : <span className="text-amber-600">not recorded</span>}</td>
                                <td className={`text-right font-medium ${it.profit < 0 ? "text-red-600" : "text-green-700"}`}>{inr(it.profit, 2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          {totals && (
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                {columns.map((c, i) => {
                  const total = c.money || c.fmt === num ? sum(rows, (r) => cellValue(c, r)) : null;
                  return (
                    <td key={c.key} className={`px-3 py-2 whitespace-nowrap ${c.align === "right" ? "text-right tabular-nums" : ""} ${total !== null ? toneClass(c, total) : ""}`}>
                      {i === 0 ? "Total" : total === null ? "" : c.money ? inr(total, 2) : num(total)}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {rows.length > limit && (
        <div className="text-center mt-3">
          <button onClick={() => setLimit((l) => l + 200)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50">
            Show more ({num(rows.length - limit)} left)
          </button>
        </div>
      )}
    </div>
  );
}

function SummaryTable({ rows }) {
  return (
    <div className="divide-y divide-gray-100">
      {rows.map((r) => (
        <div key={r.label} className={`flex flex-wrap items-baseline justify-between gap-x-4 py-2 ${r.strong ? "font-semibold" : ""}`}>
          <div className="text-sm text-gray-700">{r.label.trim()}{r.note ? <span className="ml-2 text-xs font-normal text-gray-500">{r.note}</span> : null}</div>
          <div className={`text-sm tabular-nums ${r.amount !== undefined ? (r.amount < 0 ? "text-red-600" : r.strong ? "text-green-700" : "text-gray-900") : "text-gray-900"}`}>
            {r.amount !== undefined ? inr(r.amount, 2) : r.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionTabs({ sections, active, onChange }) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
      {sections.map((s) => (
        <button
          key={s.id}
          onClick={() => onChange(s.id)}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${active === s.id ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
        >
          {s.title}<span className="ml-1 opacity-60">{s.rows.length}</span>
        </button>
      ))}
    </div>
  );
}

const selectCls = "px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white";

export default function FinancialReport({ shopId, shopName, access, serviceReport }) {
  const hasSales = !!access?.sales;
  const hasService = !!access?.service;
  const isCombo = hasSales && hasService;
  const [view, setView] = useState(isCombo ? "combined" : "sales");
  const period = usePeriod("this-month");
  const [filters, setFilters] = useState({ branch_id: "", employee_id: "", payment: "" });
  const [groupBy, setGroupBy] = useState("auto");
  const [sales, setSales] = useState(null);
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("trend");
  const [exporting, setExporting] = useState("");

  const combined = view === "combined";
  const load = useCallback(async () => {
    if (!shopId || view === "service") return;
    setLoading(true); setError("");
    try {
      const salesParams = { shopId, shop_id: shopId, ...period.range, ...(combined ? {} : Object.fromEntries(Object.entries(filters).filter(([, v]) => v))) };
      const [salesRes, serviceRes] = await Promise.all([
        axios.get(`${API_URL}/api/shop-admin/reports/sales-financial`, { headers: authHeaders(), params: salesParams }),
        combined
          ? axios.get(`${API_URL}/api/shop-admin/reports/financial`, { headers: authHeaders(), params: { shop_id: shopId, fromDate: period.range.from, toDate: period.range.to } })
          : Promise.resolve(null),
      ]);
      setSales(salesRes.data);
      setService(serviceRes ? serviceRes.data.report : null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load the financial report");
    } finally { setLoading(false); }
  }, [shopId, view, combined, period.range, filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setTab(combined ? "combined-trend" : "trend"); }, [combined]);

  const report = sales?.report;
  const s = report?.summary;
  const branches = report?.branches || [];
  const employees = sales?.employees || [];
  const salesSecs = useMemo(() => (report ? salesSections(report, groupBy) : []), [report, groupBy]);

  // Combined: one day-wise table across both businesses, plus a side-by-side summary
  const combinedData = useMemo(() => {
    if (!combined || !report || !service) return null;
    const svc = service.summary || {};
    const svcDays = serviceByDay(service, period.range.from, period.range.to);
    const dayRows = (report.byDay || []).map((d) => {
      const sv = svcDays.get(d.date) || { serviceIncome: 0, serviceOut: 0 };
      const serviceNet = round2(sv.serviceIncome - sv.serviceOut);
      return {
        date: d.date,
        salesProfit: d.salesProfit,
        salesExpenses: d.expenses,
        salesNet: d.netProfit,
        serviceIncome: round2(sv.serviceIncome),
        serviceOut: round2(sv.serviceOut),
        serviceNet,
        totalNet: round2(d.netProfit + serviceNet),
        cashFlow: round2(d.netCashFlow + serviceNet),
      };
    });
    const keys = ["salesProfit", "salesExpenses", "salesNet", "serviceIncome", "serviceOut", "serviceNet", "totalNet", "cashFlow"];
    const grouped = groupPeriods(dayRows, groupBy, keys);
    const spares = round2((svc.totalSparePurchases || 0) - (svc.totalSpareReturns || 0));
    const compare = [
      { label: "Money collected", sales: s.collected, service: svc.totalRevenue || 0 },
      { label: "Sales profit (sold for − cost)", sales: s.salesProfit, service: null },
      { label: "Expenses", sales: -s.expenses, service: -(svc.totalOperatingExpenses || 0) },
      { label: "Spare parts bought (net of returns)", sales: null, service: -spares },
      { label: "Dealer / supplier payments", sales: -s.supplierPayments, service: -(svc.totalSupplierPayments || 0) },
      { label: "Net profit", sales: s.netProfit, service: svc.netProfit || 0, strong: true },
      { label: "Net cash flow", sales: s.netCashFlow, service: svc.netProfit || 0, strong: true },
    ].map((r) => ({ ...r, total: round2((r.sales || 0) + (r.service || 0)) }));
    const trendSection = {
      id: "combined-trend", title: grouped.monthly ? "Month-wise" : "Day-wise", rows: grouped.rows, totals: true,
      columns: [text("period", grouped.monthly ? "Month" : "Date"), money("salesProfit", "Sales profit"), money("salesExpenses", "Sales expenses"),
        money("salesNet", "Sales net profit", { tone: "profit" }), money("serviceIncome", "Service collected"), money("serviceOut", "Service outflow"),
        money("serviceNet", "Service net", { tone: "profit" }), money("totalNet", "Total net profit", { tone: "profit", strong: true }), money("cashFlow", "Total cash flow", { tone: "profit" })],
    };
    return { compare, trendSection, totalNet: round2(s.netProfit + (svc.netProfit || 0)), totalCash: round2(s.netCashFlow + (svc.netProfit || 0)), svc };
  }, [combined, report, service, s, groupBy, period.range]);

  const sections = useMemo(() => (combined && combinedData
    ? [combinedData.trendSection, ...salesSecs.filter((x) => x.id !== "trend").map((x) => ({ ...x, title: `Sales — ${x.title}` })), ...serviceSections(service)]
    : salesSecs), [combined, combinedData, salesSecs, service]);
  const activeSection = sections.find((x) => x.id === tab) || sections[0];

  const chartRows = combined && combinedData ? combinedData.trendSection.rows : salesSecs[0]?.rows || [];

  const filterMeta = () => {
    const parts = [`Period: ${istDate(`${period.range.from}T12:00:00+05:30`)} to ${istDate(`${period.range.to}T12:00:00+05:30`)}`];
    if (!combined) {
      if (filters.branch_id) parts.push(`Branch: ${branches.find((b) => b.id === filters.branch_id)?.name || filters.branch_id}`);
      if (filters.employee_id) parts.push(`Salesperson: ${filters.employee_id === "none" ? "Not recorded" : employees.find((e) => e.id === filters.employee_id)?.name || filters.employee_id}`);
      if (filters.payment) parts.push(`Payment mode: ${filters.payment}`);
    }
    return [parts.join("   ·   "), `Generated ${istDateTime(new Date())}`];
  };

  const runExport = async (kind) => {
    if (!s) return;
    setExporting(kind);
    try {
      const label = combined ? "Sales + Service" : "Sales";
      const title = `${shopName ? `${shopName} — ` : ""}Financial Report (${label})`;
      const summaryRows = combined && combinedData
        ? combinedData.compare.flatMap((r) => [
          ...(r.sales !== null ? [{ label: `Sales — ${r.label}`, amount: r.sales, strong: r.strong }] : []),
          ...(r.service !== null ? [{ label: `Service — ${r.label}`, amount: r.service, strong: r.strong }] : []),
          { label: `Total — ${r.label}`, amount: r.total, strong: true },
        ])
        : salesSummaryRows(s);
      const args = {
        fileName: `financial-report-${combined ? "sales-service" : "sales"}_${fileStamp(period.range)}`,
        title,
        summaryTitle: title,
        summaryRows,
        meta: filterMeta(),
        sections,
      };
      if (kind === "pdf") await exportPdf(args);
      else exportExcel(args);
    } catch (err) {
      console.error("Financial report export failed", err);
      setError("Export failed. Please try again.");
    } finally { setExporting(""); }
  };

  const viewTabs = [
    hasSales && { id: "sales", label: "Sales", icon: ShoppingBag },
    hasService && { id: "service", label: "Service", icon: Wrench },
    isCombo && { id: "combined", label: "Sales + Service", icon: Layers },
  ].filter(Boolean);

  return (
    <div className="space-y-4 text-gray-800">
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-green-600" />
            <h2 className="text-xl font-bold text-gray-800">Financial Report</h2>
          </div>
          {viewTabs.length > 1 && (
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
              {viewTabs.map((v) => (
                <button key={v.id} onClick={() => setView(v.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition ${view === v.id ? "bg-green-600 text-white shadow" : "text-gray-600 hover:bg-white"}`}>
                  <v.icon className="h-4 w-4" />{v.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {view !== "service" && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <PeriodPicker period={period} />
              <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className={selectCls} title="Group the trend by">
                <option value="auto">Auto group</option>
                <option value="day">Day-wise</option>
                <option value="month">Month-wise</option>
              </select>
            </div>
            {!combined && (
              <div className="flex flex-wrap items-center gap-2">
                <select value={filters.branch_id} onChange={(e) => setFilters((f) => ({ ...f, branch_id: e.target.value }))} className={selectCls}>
                  <option value="">All branches</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <select value={filters.employee_id} onChange={(e) => setFilters((f) => ({ ...f, employee_id: e.target.value }))} className={selectCls}>
                  <option value="">All salespeople</option>
                  <option value="none">Not recorded</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.name}{e.code ? ` (${e.code})` : ""}</option>)}
                </select>
                <select value={filters.payment} onChange={(e) => setFilters((f) => ({ ...f, payment: e.target.value }))} className={selectCls}>
                  <option value="">All payment modes</option>
                  <option value="Cash">Cash</option>
                  <option value="Gpay">Gpay</option>
                  <option value="Card">Card</option>
                </select>
                {(filters.branch_id || filters.employee_id || filters.payment) && (
                  <button onClick={() => setFilters({ branch_id: "", employee_id: "", payment: "" })} className="text-xs text-gray-500 hover:text-gray-800 underline">Clear filters</button>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm hover:bg-gray-50" title="Refresh">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
              </button>
              <button onClick={() => runExport("pdf")} disabled={!s || !!exporting} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white text-sm font-medium">
                <Download className="h-4 w-4" />{exporting === "pdf" ? "Preparing…" : "Export PDF"}
              </button>
              <button onClick={() => runExport("xlsx")} disabled={!s || !!exporting} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-medium">
                <FileSpreadsheet className="h-4 w-4" />{exporting === "xlsx" ? "Preparing…" : "Export Excel"}
              </button>
            </div>
          </>
        )}
      </div>

      {view === "service" ? (
        serviceReport || <Notice>Service report is not available for this plan.</Notice>
      ) : (
        <>
          {error && <Notice tone="red">{error}</Notice>}
          {loading && !s && <div className="p-12 text-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto" /></div>}

          {s && (
            <>
              {s.uncostedItems > 0 && (
                <Notice>
                  {num(s.uncostedItems)} sold item(s) have no cost price recorded, so their full sale value is counted as profit.
                  Set the cost price on those products in inventory to correct future reports.
                </Notice>
              )}
              {s.estimatedCostItems > 0 && (
                <Notice tone="blue">{num(s.estimatedCostItems)} older sold item(s) had no cost saved with the bill; their current stock cost was used.</Notice>
              )}
              {report.truncated && <Notice tone="blue">This period has a very large number of entries; lists show the first 3,000 of each. Narrow the period for the full detail.</Notice>}
              {!combined && filters.employee_id && <Notice tone="blue">The salesperson filter narrows bills only — expenses and dealer payments still cover the whole {filters.branch_id ? "branch" : "shop"}.</Notice>}

              {combined && combinedData ? (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard label="Total net profit" value={inr(combinedData.totalNet)} sub="Sales net + service net" tone={combinedData.totalNet < 0 ? "red" : "green"} icon={TrendingUp} />
                    <StatCard label="Total net cash flow" value={inr(combinedData.totalCash)} sub="After dealer & supplier payments" tone={combinedData.totalCash < 0 ? "red" : "blue"} icon={ArrowDownUp} />
                    <StatCard label="Sales net profit" value={inr(s.netProfit)} sub={`Profit ${inr(s.salesProfit)} − expenses ${inr(s.expenses)}`} tone="indigo" icon={ShoppingBag} />
                    <StatCard label="Service net" value={inr(combinedData.svc.netProfit || 0)} sub={`Collected ${inr(combinedData.svc.totalRevenue || 0)}`} tone="orange" icon={Wrench} />
                  </div>
                  <Panel title="Sales vs Service">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Metric</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Sales</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Service</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {combinedData.compare.map((r) => (
                            <tr key={r.label} className={r.strong ? "font-semibold" : ""}>
                              <td className="px-3 py-2 text-gray-700">{r.label}</td>
                              {[r.sales, r.service, r.total].map((v, i) => (
                                <td key={i} className={`px-3 py-2 text-right tabular-nums ${v === null ? "text-gray-400" : v < 0 ? "text-red-600" : "text-gray-900"}`}>{v === null ? "—" : inr(v, 2)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Sales net profit = sales profit − expenses (dealer payments are cash flow, since the cost of what was sold is already deducted).
                      Service figures follow the Service report: payments collected minus supplier payments, expenses and spare parts bought.
                    </p>
                  </Panel>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard label="Sales profit" value={inr(s.salesProfit)} sub={`${pct(s.marginPercent)} on ${inr(s.netSales)} sold`} tone={s.salesProfit < 0 ? "red" : "green"} icon={TrendingUp} />
                    <StatCard label="Expenses" value={inr(s.expenses)} sub={`${num(s.expenseCount)} entries`} tone="orange" icon={Receipt} />
                    <StatCard label="Net profit" value={inr(s.netProfit)} sub="Sales profit − expenses" tone={s.netProfit < 0 ? "red" : "indigo"} icon={Wallet} />
                    <StatCard label="Dealer payments" value={inr(s.supplierPayments)} sub={`${num(s.supplierPaymentCount)} payments (cash out)`} tone="gray" icon={Landmark} />
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard label="Total billed" value={inr(s.collected)} sub={`${num(s.bills)} bills · avg ${inr(s.avgBillValue)}`} />
                    <StatCard label="Cost of goods sold" value={inr(s.cogs)} sub={`${num(s.itemsSold)} items`} />
                    <StatCard label="GST collected" value={inr(s.gst)} sub={s.discount ? `Discount ${inr(s.discount)}` : "No discounts"} />
                    <StatCard label="Net cash flow" value={inr(s.netCashFlow)} sub="Billed − dealer payments − expenses" tone={s.netCashFlow < 0 ? "red" : "blue"} icon={ArrowDownUp} />
                  </div>
                </>
              )}

              <div className={`grid gap-4 ${combined ? "" : "lg:grid-cols-5"}`}>
                <Panel title={combined ? "Net profit trend" : "Profit trend"} className={combined ? "" : "lg:col-span-3"}>
                  {chartRows.length ? (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartRows} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                          <Tooltip formatter={(v) => inr(v, 2)} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          {combined ? (
                            <>
                              <Bar dataKey="salesNet" name="Sales net" fill="#6366f1" radius={[3, 3, 0, 0]} />
                              <Bar dataKey="serviceNet" name="Service net" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                              <Line dataKey="totalNet" name="Total net profit" stroke="#16a34a" strokeWidth={2} dot={false} />
                            </>
                          ) : (
                            <>
                              <Bar dataKey="salesProfit" name="Sales profit" fill="#10b981" radius={[3, 3, 0, 0]} />
                              <Bar dataKey="expenses" name="Expenses" fill="#f87171" radius={[3, 3, 0, 0]} />
                              <Line dataKey="netProfit" name="Net profit" stroke="#6366f1" strokeWidth={2} dot={false} />
                            </>
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <div className="py-10 text-center text-sm text-gray-500">No data for this period.</div>}
                </Panel>
                {!combined && (
                  <Panel title="Profit & loss" className="lg:col-span-2">
                    <SummaryTable rows={salesSummaryRows(s)} />
                  </Panel>
                )}
              </div>

              <Panel title="Details" action={<span className="text-xs text-gray-500">{activeSection?.expandable ? "Click a bill to see its items" : ""}</span>}>
                <div className="mb-3"><SectionTabs sections={sections} active={activeSection?.id} onChange={setTab} /></div>
                {activeSection && <DataTable section={activeSection} />}
              </Panel>
            </>
          )}
        </>
      )}
    </div>
  );
}

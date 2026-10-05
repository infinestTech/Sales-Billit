"use client";
import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { BarChart3, RefreshCw, TrendingUp, Wallet, Receipt, Landmark, Users, Wrench, ArrowRight } from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, BarChart,
} from "recharts";
import { API_URL, authHeaders, usePeriod, PeriodPicker, StatCard, Notice, inr, num, pct } from "./analytics/analyticsShared";

const PIE_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#84cc16", "#f97316"];

const PL_ROWS = [
  { key: "revenue", label: "Revenue", hint: "Service payments collected + net sales (excl. GST)" },
  { key: "directCost", label: "Direct costs", hint: "Spare parts (service) + cost of goods sold (sales)", negative: true },
  { key: "grossProfit", label: "Gross profit", strong: true },
  { key: "expenses", label: "Operating expenses", hint: "Shop expenses + branch expenses", negative: true },
  { key: "payroll", label: "Payroll", hint: "Wages accrued from attendance + estimated incentives", negative: true },
  { key: "netProfit", label: "Net profit", strong: true },
];

function Panel({ title, action, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function BusinessAnalytics({ shopId, access, onNavigate }) {
  const period = usePeriod("this-month");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true); setError("");
    try {
      const res = await axios.get(`${API_URL}/api/shop-admin/analytics/business`, { headers: authHeaders(), params: { shopId, ...period.range } });
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load analytics");
    } finally { setLoading(false); }
  }, [shopId, period.range]);

  useEffect(() => { load(); }, [load]);

  const hasSales = !!access?.sales;
  const hasService = !!access?.service;
  const c = data?.combined || {};
  const segs = data?.segments || {};
  const segCols = [hasService && segs.service && { id: "service", label: "Service" }, hasSales && segs.sales && { id: "sales", label: "Sales" }].filter(Boolean);
  const salesTotals = data?.sales?.totals;
  const jobs = data?.service?.jobs;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-green-600" />
          <h2 className="text-xl font-bold text-gray-800">Business Analytics</h2>
          {hasSales && hasService && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Sales + Service</span>}
        </div>
        <div className="flex items-center gap-2">
          <PeriodPicker period={period} />
          <button onClick={load} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50" title="Refresh"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
        </div>
      </div>

      {error && <Notice tone="red">{error}</Notice>}
      {(data?.warnings || []).map((w) => <Notice key={w}>{w}</Notice>)}
      {loading && !data && <div className="p-12 text-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto" /></div>}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <StatCard label="Revenue" value={inr(c.revenue)} tone="green" icon={TrendingUp} />
            <StatCard label="Gross profit" value={inr(c.grossProfit)} sub={c.revenue ? `${pct((c.grossProfit / c.revenue) * 100)} margin` : null} tone="blue" />
            <StatCard label="Expenses" value={inr(c.expenses)} tone="orange" icon={Receipt} />
            <StatCard label="Payroll" value={inr(c.payroll)} tone="orange" icon={Users} />
            <StatCard label="Net profit" value={inr(c.netProfit)} sub={`${pct(c.netMarginPercent)} net margin`} tone={c.netProfit >= 0 ? "green" : "red"} icon={Wallet} />
            <StatCard label="GST collected" value={inr(data.gstCollected)} sub="liability, not revenue" tone="gray" icon={Landmark} />
          </div>

          {salesTotals?.uncostedItems > 0 && (
            <Notice>
              {num(salesTotals.uncostedItems)} sold item line(s) have no cost price (sales made before cost tracking, or stock without cost), so sales gross profit is overstated by their cost.
            </Notice>
          )}

          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Panel title="Revenue trend">
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={data.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => inr(v)} />
                    <Legend />
                    {hasService && <Bar dataKey="serviceRevenue" name="Service" stackId="r" fill="#10b981" />}
                    {hasSales && <Bar dataKey="salesRevenue" name="Sales (net)" stackId="r" fill="#6366f1" />}
                    {hasSales && <Line type="monotone" dataKey="salesProfit" name="Sales gross profit" stroke="#f59e0b" dot={false} />}
                  </ComposedChart>
                </ResponsiveContainer>
              </Panel>
            </div>
            <Panel title="Profit & loss">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500">
                  <tr>
                    <th className="text-left py-1" />
                    {segCols.length > 1 && segCols.map((s) => <th key={s.id} className="text-right py-1">{s.label}</th>)}
                    <th className="text-right py-1">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {PL_ROWS.map((row) => (
                    <tr key={row.key} className={row.strong ? "border-t font-semibold" : ""} title={row.hint}>
                      <td className="py-1.5 text-gray-700">{row.label}</td>
                      {segCols.length > 1 && segCols.map((s) => (
                        <td key={s.id} className={`py-1.5 text-right ${row.negative ? "text-red-600" : ""}`}>{row.negative ? "−" : ""}{inr(segs[s.id][row.key])}</td>
                      ))}
                      <td className={`py-1.5 text-right ${row.negative ? "text-red-600" : row.key === "netProfit" ? (c.netProfit >= 0 ? "text-green-700" : "text-red-700") : ""}`}>
                        {row.negative ? "−" : ""}{inr(c[row.key])}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-gray-400 mt-2">Hover a row for its definition. Payroll is split by each employee&apos;s business unit.</p>
            </Panel>
          </div>

          {hasSales && data.sales && (
            <div className="grid lg:grid-cols-3 gap-4">
              <Panel title="Branches">
                {data.sales.byBranch.length === 0 ? <p className="text-sm text-gray-500">No sales in this period.</p> : (
                  <table className="w-full text-xs">
                    <thead className="text-gray-500"><tr><th className="text-left py-1">Branch</th><th className="text-right py-1">Bills</th><th className="text-right py-1">Net sales</th><th className="text-right py-1">GP</th><th className="text-right py-1">Expenses</th></tr></thead>
                    <tbody className="divide-y">
                      {data.sales.byBranch.map((b) => (
                        <tr key={b.branchId}>
                          <td className="py-1.5 font-medium">{b.branchName}</td>
                          <td className="py-1.5 text-right">{b.salesCount}</td>
                          <td className="py-1.5 text-right">{inr(b.netSales)}</td>
                          <td className="py-1.5 text-right">{inr(b.grossProfit)}</td>
                          <td className="py-1.5 text-right text-red-600">{inr(b.expenses)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Panel>
              <Panel title="Payment mix (sales)">
                {data.sales.byPayment.length === 0 ? <p className="text-sm text-gray-500">No payments.</p> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={data.sales.byPayment} dataKey="amount" nameKey="method" outerRadius={80} label={(e) => e.method}>
                        {data.sales.byPayment.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => inr(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Panel>
              <Panel title="Busy hours (sales)">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.sales.byHour}>
                    <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickFormatter={(h) => `${h}:00`} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip formatter={(v, n) => (n === "Bills" ? v : inr(v))} labelFormatter={(h) => `${h}:00 – ${h}:59`} />
                    <Bar dataKey="count" name="Bills" fill="#6366f1" />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-4">
            {hasSales && data.sales && (
              <Panel title="Top products">
                {data.sales.topProducts.length === 0 ? <p className="text-sm text-gray-500">No products sold.</p> : (
                  <table className="w-full text-xs">
                    <thead className="text-gray-500"><tr><th className="text-left py-1">Product</th><th className="text-right py-1">Qty</th><th className="text-right py-1">Revenue</th><th className="text-right py-1">Margin</th></tr></thead>
                    <tbody className="divide-y">
                      {data.sales.topProducts.map((p) => (
                        <tr key={`${p.productNo}-${p.productName}`}>
                          <td className="py-1.5"><div className="font-medium">{p.productName}</div><div className="text-gray-400">{p.productNo}</div></td>
                          <td className="py-1.5 text-right">{p.qty}</td>
                          <td className="py-1.5 text-right">{inr(p.revenue)}</td>
                          <td className="py-1.5 text-right">{p.cost > 0 ? inr(p.revenue - p.cost) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Panel>
            )}
            {hasService && jobs && (
              <Panel title="Service pipeline (jobs received in period)">
                <div className="grid grid-cols-5 gap-2 text-center">
                  {[["Received", jobs.received, "text-gray-800"], ["Completed", jobs.completed, "text-green-700"], ["Delivered", jobs.delivered, "text-blue-700"],
                    ["Returned", jobs.returned, "text-red-600"], ["Pending", jobs.pending, "text-amber-600"]].map(([label, v, cls]) => (
                    <div key={label} className="rounded-lg bg-gray-50 p-3">
                      <div className={`text-xl font-bold ${cls}`}>{num(v)}</div>
                      <div className="text-[11px] text-gray-500">{label}</div>
                    </div>
                  ))}
                </div>
                {data.service.byPaymentMethod.length > 0 && (
                  <div className="mt-3 text-xs text-gray-600">
                    <span className="font-semibold">Collections by method: </span>
                    {data.service.byPaymentMethod.map((m) => `${m.method} ${inr(m.amount)}`).join(" · ")}
                  </div>
                )}
              </Panel>
            )}
          </div>

          <Panel
            title="Workforce"
            action={onNavigate && (
              <button onClick={() => onNavigate("hr-performance")} className="flex items-center gap-1 text-xs text-green-700 hover:underline">
                Employee performance <ArrowRight className="h-3 w-3" />
              </button>
            )}
          >
            <div className="grid md:grid-cols-4 gap-3 mb-3">
              <StatCard label="Employees" value={num(data.workforce.employees)} tone="gray" icon={Users} />
              <StatCard label="Present days" value={num(data.workforce.presentDays)} sub={`${num(data.workforce.lateDays)} late`} tone="gray" />
              <StatCard label="Wages accrued" value={inr(data.workforce.accruedWages)} tone="orange" />
              <StatCard label="Est. incentives" value={inr(data.workforce.incentives)} tone="indigo" />
            </div>
            {data.workforce.topPerformers.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {data.workforce.topPerformers.map((p, i) => (
                  <div key={p.employeeId} className="flex items-center gap-2 border rounded-lg px-3 py-2">
                    <span className="text-lg font-bold text-gray-400">{i + 1}</span>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{p.name} <span className="font-mono text-xs text-gray-500">{p.code}</span></div>
                      <div className="text-xs text-gray-500">
                        {inr(p.contribution)}
                        {p.netSales > 0 && p.serviceRevenue > 0 ? ` (sales ${inr(p.netSales)} + service ${inr(p.serviceRevenue)})` : ""}
                        {p.serviceRevenue > 0 && !p.netSales ? <> <Wrench className="inline h-3 w-3" /></> : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No credited sales or service jobs yet. Enter employee codes at the POS and use employee codes/names as technicians to see rankings.</p>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

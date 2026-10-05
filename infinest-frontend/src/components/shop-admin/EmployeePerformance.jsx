"use client";
import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  Award, TrendingUp, Wrench, Users, Wallet, Download, RefreshCw, X, AlertCircle, ShoppingBag,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
} from "recharts";
import {
  API_URL, authHeaders, usePeriod, PeriodPicker, StatCard, Notice, inr, num, pct, downloadCsv,
} from "./analytics/analyticsShared";

const UNIT_BADGE = {
  sales: "bg-indigo-100 text-indigo-700",
  service: "bg-emerald-100 text-emerald-700",
};

function TargetBar({ achievement }) {
  if (achievement === null || achievement === undefined) return <span className="text-gray-400">—</span>;
  const width = Math.min(100, Math.max(0, achievement));
  const color = achievement >= 100 ? "bg-green-500" : achievement >= 70 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="min-w-[90px]">
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden"><div className={`h-2 ${color}`} style={{ width: `${width}%` }} /></div>
      <div className="text-[11px] text-gray-600 mt-0.5">{pct(achievement)}</div>
    </div>
  );
}

function EmployeeDetail({ shopId, employeeId, range, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    axios.get(`${API_URL}/api/shop-admin/hr/performance/${employeeId}`, { headers: authHeaders(), params: { shopId, ...range } })
      .then((res) => { if (alive) setData(res.data); })
      .catch((err) => { if (alive) setError(err.response?.data?.message || "Failed to load details"); });
    return () => { alive = false; };
  }, [shopId, employeeId, range]);

  const present = data?.attendance?.filter((a) => a.status === "PRESENT").length || 0;
  const late = data?.attendance?.filter((a) => a.lateMinutes > 0).length || 0;
  const wages = data?.attendance?.reduce((s, a) => s + (a.wage || 0), 0) || 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{data?.employee?.name || "Employee"}</h3>
            <p className="text-xs text-gray-500">
              <span className="font-mono">{data?.employee?.code}</span>
              {data?.employee?.designation ? ` · ${data.employee.designation}` : ""} · {range.from} → {range.to}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto p-6 space-y-5">
          {error && <Notice tone="red">{error}</Notice>}
          {!data && !error && <div className="p-10 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto" /></div>}
          {data && (
            <>
              {(data.warnings || []).map((w) => <Notice key={w}>{w}</Notice>)}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Present days" value={present} sub={`${late} late day(s)`} tone="green" />
                <StatCard label="Wages accrued" value={inr(wages)} tone="gray" />
                {data.sales && <StatCard label="Net sales" value={inr(data.sales.totals.netSales)} sub={`${data.sales.totals.salesCount} bills · avg ${inr(data.sales.totals.avgBillValue)}`} tone="indigo" />}
                {data.sales && <StatCard label="Gross profit" value={inr(data.sales.totals.grossProfit)} sub={`margin ${pct(data.sales.totals.marginPercent)}`} tone="blue" />}
                {!data.sales && <StatCard label="Service jobs" value={data.serviceJobs.length} tone="blue" />}
              </div>

              {data.sales?.byDay?.length > 0 && (
                <div className="border rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Daily net sales</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={data.sales.byDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => inr(v)} />
                      <Area type="monotone" dataKey="netSales" name="Net sales" stroke="#4f46e5" fill="#c7d2fe" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                {data.sales && (
                  <div className="border rounded-xl overflow-hidden">
                    <div className="px-4 py-2 bg-gray-50 text-sm font-semibold text-gray-700">Recent bills</div>
                    {data.sales.recentSales.length === 0 ? <p className="p-4 text-sm text-gray-500">No bills in this period.</p> : (
                      <table className="w-full text-xs">
                        <thead className="text-gray-500"><tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Customer</th><th className="px-3 py-2 text-left">Branch</th><th className="px-3 py-2 text-right">Total</th></tr></thead>
                        <tbody className="divide-y">
                          {data.sales.recentSales.map((s) => (
                            <tr key={s.id}>
                              <td className="px-3 py-2">{new Date(s.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</td>
                              <td className="px-3 py-2">{s.customerName || "Walk-in"}</td>
                              <td className="px-3 py-2">{s.branchName || "—"}</td>
                              <td className="px-3 py-2 text-right font-semibold">{inr(s.totalAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {data.sales.topProducts.length > 0 && (
                      <div className="px-4 py-3 border-t text-xs text-gray-600">
                        <span className="font-semibold">Top products: </span>
                        {data.sales.topProducts.map((p) => `${p.productName} (${p.qty})`).join(", ")}
                      </div>
                    )}
                  </div>
                )}
                <div className="border rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 text-sm font-semibold text-gray-700">Service jobs</div>
                  {data.serviceJobs.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500">No service jobs matched. Jobs are credited when the technician name equals this employee&apos;s code or name.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="text-gray-500"><tr><th className="px-3 py-2 text-left">Device</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-right">Collected</th></tr></thead>
                      <tbody className="divide-y">
                        {data.serviceJobs.map((j) => (
                          <tr key={j.id}>
                            <td className="px-3 py-2"><div className="font-medium">{j.device || "—"}</div><div className="text-gray-400">{j.issue}</div></td>
                            <td className="px-3 py-2">{j.status}</td>
                            <td className="px-3 py-2 text-right">{inr(j.collected)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 text-sm font-semibold text-gray-700">Attendance</div>
                {data.attendance.length === 0 ? <p className="p-4 text-sm text-gray-500">No attendance recorded in this period.</p> : (
                  <div className="flex flex-wrap gap-1.5 p-3">
                    {data.attendance.map((a) => (
                      <span key={a.date} title={`${a.date} · ${a.status}${a.lateMinutes ? ` · ${a.lateMinutes} min late` : ""} · ${a.workedHours}h`}
                        className={`text-[11px] px-2 py-1 rounded ${a.status === "PRESENT" ? (a.lateMinutes ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800") : a.status === "LEAVE" ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-700"}`}>
                        {a.date.slice(5)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EmployeePerformance({ shopId, unit = "all", access }) {
  const period = usePeriod("this-month");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [savingPos, setSavingPos] = useState(false);

  const showSales = !!access?.sales;
  const showService = !!access?.service;

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true); setError("");
    try {
      const res = await axios.get(`${API_URL}/api/shop-admin/hr/performance`, {
        headers: authHeaders(),
        params: { shopId, ...period.range, unit: unit === "all" ? undefined : unit },
      });
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load performance");
    } finally { setLoading(false); }
  }, [shopId, unit, period.range]);

  useEffect(() => { load(); }, [load]);

  const togglePosRule = async () => {
    const next = !data?.posSettings?.requireEmployeeCode;
    setSavingPos(true);
    try {
      const res = await axios.patch(`${API_URL}/api/shop-admin/shop-settings/pos`, { requireEmployeeCode: next }, { headers: authHeaders(), params: { shopId } });
      setData((d) => ({ ...d, posSettings: res.data.data }));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update POS rule");
    } finally { setSavingPos(false); }
  };

  const rows = data?.rows || [];
  const t = data?.totals || {};
  const chartData = rows.filter((r) => r.contribution > 0).slice(0, 10).map((r) => ({
    name: r.code || r.name, sales: r.sales.netSales, service: r.service.revenue,
  }));

  const exportCsv = () => {
    const header = ["Rank", "Code", "Name", "Unit", "Present days", "Late days", "Bills", "Net sales", "Gross profit", "Target", "Achievement %",
      "Service jobs", "Completed", "Service collected", "Wages accrued", "Sales commission", "Service commission", "Target bonus", "Total incentive", "Contribution", "Revenue/present day"];
    downloadCsv(`employee-performance_${period.range.from}_${period.range.to}.csv`, header, rows.map((r) => [
      r.rank ?? "", r.code, r.name, r.businessUnit, r.attendance.presentDays, r.attendance.lateDays, r.sales.count, r.sales.netSales,
      r.sales.grossProfit, r.sales.target, r.sales.targetAchievement ?? "", r.service.jobs, r.service.completed, r.service.revenue,
      r.attendance.accruedWages, r.incentive.salesCommission, r.incentive.serviceCommission, r.incentive.targetBonus, r.incentive.total,
      r.contribution, r.revenuePerPresentDay ?? "",
    ]));
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-green-600" />
          <h2 className="text-xl font-bold text-gray-800">Employee Performance</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker period={period} />
          <button onClick={load} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50" title="Refresh"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
          <button onClick={exportCsv} disabled={!rows.length} className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
            <Download className="h-4 w-4" /> Export
          </button>
        </div>
      </div>

      {error && <Notice tone="red"><AlertCircle className="inline h-4 w-4 mr-1" />{error}</Notice>}
      {(data?.warnings || []).map((w) => <Notice key={w}>{w}</Notice>)}

      {showSales && data && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-800">Require employee code on every POS sale</div>
            <div className="text-xs text-gray-500">When on, branches cannot complete a sale without a valid code, so every bill is credited to a salesperson.</div>
          </div>
          <button onClick={togglePosRule} disabled={savingPos}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${data.posSettings?.requireEmployeeCode ? "bg-green-600" : "bg-gray-300"} disabled:opacity-60`}>
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${data.posSettings?.requireEmployeeCode ? "translate-x-5" : "translate-x-1"}`} />
          </button>
        </div>
      )}

      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard label="Team contribution" value={inr(t.contribution)} sub={`${t.employees} employee(s)`} tone="green" icon={TrendingUp} />
          {showSales && <StatCard label="Credited sales" value={inr(t.netSales)} sub={`${num(t.salesCount)} bills · ${num(data.unattributedSales?.salesCount)} uncredited`} tone="indigo" icon={ShoppingBag} />}
          {showService && <StatCard label="Service collections" value={inr(t.serviceRevenue)} sub={`${num(t.serviceJobs)} jobs`} tone="blue" icon={Wrench} />}
          <StatCard label="Payroll cost" value={inr(t.accruedWages + t.incentives)} sub={`wages ${inr(t.accruedWages)} + incentives ${inr(t.incentives)}`} tone="orange" icon={Wallet} />
          <StatCard label="Attendance" value={`${num(t.presentDays)} days`} sub={`${num(t.lateDays)} late arrivals`} tone="gray" icon={Users} />
        </div>
      )}

      {showSales && data?.unattributedSales?.salesCount > 0 && (
        <Notice tone="blue">
          {num(data.unattributedSales.salesCount)} bill(s) worth {inr(data.unattributedSales.netSales)} (net) were billed without an employee code and are not credited to anyone.
          {!data.posSettings?.requireEmployeeCode && " Turn on the POS rule above to make the code mandatory."}
        </Notice>
      )}
      {showService && data?.unlinkedTechnicians?.length > 0 && (
        <Notice>
          Service jobs with technician names that don&apos;t match any employee:{" "}
          {data.unlinkedTechnicians.slice(0, 8).map((u) => `${u.name} (${u.jobs} jobs, ${inr(u.revenue)})`).join(", ")}.
          Use the employee&apos;s code or exact name as the technician to credit these jobs.
        </Notice>
      )}

      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Leaderboard — revenue contribution</h3>
          <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 34)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => inr(v)} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
              <Tooltip formatter={(v) => inr(v)} />
              <Legend />
              {showSales && <Bar dataKey="sales" name="Net sales" stackId="a" fill="#6366f1" />}
              {showService && <Bar dataKey="service" name="Service collected" stackId="a" fill="#10b981" />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading && !data ? (
          <div className="p-12 text-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto" /></div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No employees for this selection.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600 uppercase">
                <tr>
                  <th className="px-3 py-3 text-left">#</th>
                  <th className="px-3 py-3 text-left">Employee</th>
                  <th className="px-3 py-3 text-left">Attendance</th>
                  {showSales && <th className="px-3 py-3 text-right">Sales</th>}
                  {showSales && <th className="px-3 py-3 text-left">Target</th>}
                  {showService && <th className="px-3 py-3 text-right">Service</th>}
                  <th className="px-3 py-3 text-right">Wages</th>
                  <th className="px-3 py-3 text-right">Est. incentive</th>
                  <th className="px-3 py-3 text-right">Per present day</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.employeeId} className={`hover:bg-gray-50 ${r.isActive ? "" : "opacity-60"}`}>
                    <td className="px-3 py-3 font-bold text-gray-500">{r.rank ?? "—"}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-gray-900">{r.name}</div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <span className="font-mono">{r.code}</span>
                        <span className={`px-1.5 rounded ${UNIT_BADGE[r.businessUnit]}`}>{r.businessUnit}</span>
                        {!r.isActive && <span className="text-red-500">inactive</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <div><span className="text-green-700 font-semibold">{r.attendance.presentDays}P</span> · <span className="text-red-600">{r.attendance.absentDays}A</span> · <span className="text-blue-600">{r.attendance.leaveDays}L</span></div>
                      <div className="text-gray-500">{r.attendance.lateDays} late · {r.attendance.workedHours}h</div>
                    </td>
                    {showSales && (
                      <td className="px-3 py-3 text-right">
                        <div className="font-semibold text-gray-900">{inr(r.sales.netSales)}</div>
                        <div className="text-xs text-gray-500">{r.sales.count} bills · GP {inr(r.sales.grossProfit)}</div>
                      </td>
                    )}
                    {showSales && (
                      <td className="px-3 py-3">
                        <TargetBar achievement={r.sales.targetAchievement} />
                        {r.sales.target > 0 && <div className="text-[11px] text-gray-400">of {inr(r.sales.target)}</div>}
                      </td>
                    )}
                    {showService && (
                      <td className="px-3 py-3 text-right">
                        <div className="font-semibold text-gray-900">{inr(r.service.revenue)}</div>
                        <div className="text-xs text-gray-500">{r.service.completed}/{r.service.jobs} jobs done</div>
                      </td>
                    )}
                    <td className="px-3 py-3 text-right text-gray-700">{inr(r.attendance.accruedWages)}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="font-semibold text-indigo-700">{r.incentive.total ? inr(r.incentive.total) : "—"}</div>
                      {r.incentive.targetBonus > 0 && <div className="text-[11px] text-green-600">incl. target bonus</div>}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-700">{r.revenuePerPresentDay === null ? "—" : inr(r.revenuePerPresentDay)}</td>
                    <td className="px-3 py-3 text-right">
                      <button onClick={() => setDetailId(r.employeeId)} className="px-3 py-1 text-xs rounded-lg border border-gray-200 hover:bg-gray-100">Details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Sales are credited by the employee code entered at the POS (net = after discount, before GST). Service collections are payments received in the period on jobs whose technician matches the employee&apos;s code or name.
        Wages are the daily wages accrued from attendance. Target progress is against the monthly target (scaled up for ranges longer than a month); incentives are estimates — the final amounts are calculated in Salary.
      </p>

      {detailId && <EmployeeDetail shopId={shopId} employeeId={detailId} range={period.range} onClose={() => setDetailId(null)} />}
    </div>
  );
}

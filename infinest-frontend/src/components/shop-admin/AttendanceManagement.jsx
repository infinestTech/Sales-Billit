"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Clock, CheckCircle, XCircle, AlertCircle, Calendar,
  User, Users, LogIn, LogOut, RefreshCw, Filter,
  ArrowRight, Download, ChevronLeft, ChevronRight, Edit2
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || "http://localhost:8000";

const STATUS_LABELS = {
  PRESENT: { label: "Present", color: "bg-green-100 text-green-700" },
  ABSENT: { label: "Absent", color: "bg-red-100 text-red-700" },
  HALF_DAY: { label: "Half Day", color: "bg-yellow-100 text-yellow-700" },
  LEAVE: { label: "Leave", color: "bg-blue-100 text-blue-700" },
  HOLIDAY: { label: "Holiday", color: "bg-purple-100 text-purple-700" },
  WEEKLY_OFF: { label: "Weekly Off", color: "bg-gray-100 text-gray-600" },
};

export default function AttendanceManagement({ shopId }) {
  const [activeTab, setActiveTab] = useState("daily");
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);

  // Daily view state
  const [dailyDate, setDailyDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [dailyRecords, setDailyRecords] = useState([]);

  // Software punch state
  const [punchEmployeeId, setPunchEmployeeId] = useState("");
  const [punchMsg, setPunchMsg] = useState(null);
  const [punching, setPunching] = useState(false);

  // Monthly view state
  const [monthlyEmployeeId, setMonthlyEmployeeId] = useState("");
  const [monthlyMonth, setMonthlyMonth] = useState(() => {
    const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });
  const [monthlyRecords, setMonthlyRecords] = useState([]);
  const [monthlySummary, setMonthlySummary] = useState(null);

  // Manual attendance state
  const [manualEmpId, setManualEmpId] = useState("");
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [manualStatus, setManualStatus] = useState("PRESENT");
  const [manualLeaveType, setManualLeaveType] = useState("");
  const [manualMsg, setManualMsg] = useState(null);
  const [savingManual, setSavingManual] = useState(false);

  // Monthly report state
  const [reportMonth, setReportMonth] = useState(() => {
    const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });
  const [reportData, setReportData] = useState(null);

  const token = () => localStorage.getItem("shopAdminToken");
  const headers = () => ({ Authorization: `Bearer ${token()}` });

  useEffect(() => {
    if (shopId) fetchEmployees();
  }, [shopId]);

  useEffect(() => {
    if (shopId && activeTab === "daily") fetchDailyAttendance();
  }, [dailyDate, shopId, activeTab]);

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/employees`, {
        headers: headers(),
        params: { shopId, isActive: true },
      });
      if (res.data.success) setEmployees(res.data.data || []);
    } catch (_) {}
  };

  // ── Daily view ──────────────────────────────────────────────────────────────
  const fetchDailyAttendance = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/attendance/daily`, {
        headers: headers(),
        params: { date: dailyDate, shopId },
      });
      if (res.data.success) setDailyRecords(res.data.data || []);
    } catch (_) {
      setDailyRecords([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Software punch ───────────────────────────────────────────────────────────
  const handlePunch = async () => {
    if (!punchEmployeeId) return;
    setPunching(true);
    setPunchMsg(null);
    try {
      const res = await axios.post(
        `${API_URL}/api/attendance/punch`,
        { employeeId: punchEmployeeId, source: "SOFTWARE" },
        { headers: headers() }
      );
      const d = res.data;
      setPunchMsg({
        type: d.punchType,
        isLate: d.isLate,
        late: d.lateMinutes,
        permMin: d.totalPermissionMinutes,
        status: d.status,
        msg: d.message,
      });
      if (activeTab === "daily") fetchDailyAttendance();
    } catch (err) {
      setPunchMsg({ error: err.response?.data?.message || "Punch failed" });
    } finally {
      setPunching(false);
    }
  };

  // ── Monthly attendance ───────────────────────────────────────────────────────
  const fetchMonthlyAttendance = async () => {
    if (!monthlyEmployeeId) return;
    setLoading(true);
    try {
      const [year, month] = monthlyMonth.split("-");
      const res = await axios.get(`${API_URL}/api/attendance/${monthlyEmployeeId}/monthly`, {
        headers: headers(),
        params: { month, year },
      });
      if (res.data.success) {
        setMonthlyRecords(res.data.data || []);
        setMonthlySummary(res.data.summary || null);
      }
    } catch (_) {
      setMonthlyRecords([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Manual mark ─────────────────────────────────────────────────────────────
  const handleManualMark = async () => {
    if (!manualEmpId || !manualDate || !manualStatus) return;
    setSavingManual(true);
    setManualMsg(null);
    try {
      await axios.post(
        `${API_URL}/api/attendance/manual`,
        { employeeId: manualEmpId, date: manualDate, status: manualStatus, leaveType: manualLeaveType },
        { headers: headers() }
      );
      setManualMsg({ success: `Attendance marked as ${manualStatus}` });
      fetchDailyAttendance();
    } catch (err) {
      setManualMsg({ error: err.response?.data?.message || "Failed to mark attendance" });
    } finally {
      setSavingManual(false);
    }
  };

  // ── Monthly report ───────────────────────────────────────────────────────────
  const fetchMonthlyReport = async () => {
    setLoading(true);
    try {
      const [year, month] = reportMonth.split("-");
      const res = await axios.get(`${API_URL}/api/attendance/report`, {
        headers: headers(),
        params: { shopId, month, year },
      });
      if (res.data.success) setReportData(res.data.data || []);
    } catch (_) {
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const getEmployeeName = (id) => employees.find((e) => e.employeeId === id)?.name || id;

  const fmtTime = (d) =>
    d ? new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";

  const fmtMin = (m) => {
    if (!m) return "0 min";
    const h = Math.floor(m / 60), min = m % 60;
    return h > 0 ? `${h}h ${min}m` : `${min}m`;
  };

  const TAB = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
        activeTab === id ? "bg-green-600 text-white" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Header & tabs */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-xl font-bold text-gray-800 mb-3">Attendance Management</h2>
        <div className="flex gap-2 flex-wrap">
          <TAB id="daily" label="Daily View" icon={Calendar} />
          <TAB id="punch" label="Software Punch" icon={LogIn} />
          <TAB id="monthly" label="Employee Monthly" icon={User} />
          <TAB id="manual" label="Manual Mark" icon={Edit2} />
          <TAB id="report" label="Monthly Report" icon={Users} />
        </div>
      </div>

      {/* ── Daily View ────────────────────────────────────────────────────────── */}
      {activeTab === "daily" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Date</label>
              <input
                type="date"
                value={dailyDate}
                onChange={(e) => setDailyDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                style={{ colorScheme: "light" }}
              />
            </div>
            <button
              onClick={fetchDailyAttendance}
              className="flex items-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <span className="text-sm text-gray-500 ml-auto">{dailyRecords.length} punch records</span>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto" /></div>
            ) : dailyRecords.length === 0 ? (
              <div className="p-12 text-center">
                <Clock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No punch records for {dailyDate}</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["Employee", "First In", "Last Out", "Status", "Late", "Permission Hrs", "Work Hrs", "Punches"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dailyRecords.map((rec) => {
                    const s = STATUS_LABELS[rec.status] || STATUS_LABELS.PRESENT;
                    return (
                      <tr key={rec._id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">
                            {rec.employee?.name || rec.employeeId}
                          </div>
                          <div className="text-xs text-gray-500">{rec.employeeId}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{fmtTime(rec.firstPunchTime)}</td>
                        <td className="px-4 py-3 text-gray-700">{fmtTime(rec.lastPunchTime)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${s.color}`}>{s.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          {rec.isLate ? (
                            <span className="flex items-center gap-1 text-orange-600 text-xs font-semibold">
                              <AlertCircle className="h-3 w-3" /> {fmtMin(rec.lateMinutes)}
                            </span>
                          ) : (
                            <span className="text-green-600 text-xs">On time</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {rec.totalPermissionMinutes > 0 ? (
                            <span className="text-blue-600 text-xs font-semibold">{fmtMin(rec.totalPermissionMinutes)}</span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700 text-xs">{fmtMin(rec.totalWorkMinutes)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {rec.punches?.map((p, i) => (
                              <span
                                key={i}
                                className={`px-1.5 py-0.5 rounded text-xs font-semibold ${p.type === "IN" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                              >
                                {p.type} {fmtTime(p.time)}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Software Punch ────────────────────────────────────────────────────── */}
      {activeTab === "punch" && (
        <div className="max-w-md mx-auto space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="font-bold text-gray-800 text-lg mb-4 flex items-center gap-2">
              <LogIn className="h-5 w-5 text-green-600" />
              Employee Punch
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Employee punches IN on first tap. Subsequent taps alternate OUT (permission) → IN (return) → OUT (end of day).
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Employee</label>
                <select
                  value={punchEmployeeId}
                  onChange={(e) => { setPunchEmployeeId(e.target.value); setPunchMsg(null); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">— Select Employee —</option>
                  {employees.map((e) => (
                    <option key={e.employeeId} value={e.employeeId}>{e.name} ({e.employeeId})</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handlePunch}
                disabled={!punchEmployeeId || punching}
                className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg font-semibold text-base transition flex items-center justify-center gap-2"
              >
                {punching ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                ) : (
                  <><Clock className="h-5 w-5" /> Punch Attendance</>
                )}
              </button>
            </div>

            {punchMsg && !punchMsg.error && (
              <div className={`mt-4 p-4 rounded-xl border ${punchMsg.type === "IN" ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200"}`}>
                <div className={`font-bold text-lg flex items-center gap-2 ${punchMsg.type === "IN" ? "text-green-700" : "text-blue-700"}`}>
                  {punchMsg.type === "IN" ? <LogIn className="h-5 w-5" /> : <LogOut className="h-5 w-5" />}
                  Punched {punchMsg.type}
                </div>
                <p className={`text-sm mt-1 ${punchMsg.type === "IN" ? "text-green-600" : "text-blue-600"}`}>{punchMsg.msg}</p>
                {punchMsg.isLate && (
                  <div className="mt-2 flex items-center gap-1 text-orange-600 text-sm font-semibold">
                    <AlertCircle className="h-4 w-4" /> Late by {fmtMin(punchMsg.late)}
                  </div>
                )}
                {punchMsg.permMin > 0 && (
                  <div className="mt-1 text-blue-600 text-sm">
                    Permission accumulated: {fmtMin(punchMsg.permMin)}
                  </div>
                )}
                <div className="mt-2 text-xs text-gray-500">Status: {punchMsg.status}</div>
              </div>
            )}
            {punchMsg?.error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <AlertCircle className="h-4 w-4 inline mr-1" /> {punchMsg.error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Monthly Employee View ─────────────────────────────────────────────── */}
      {activeTab === "monthly" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Employee</label>
              <select
                value={monthlyEmployeeId}
                onChange={(e) => setMonthlyEmployeeId(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">— Select Employee —</option>
                {employees.map((e) => (
                  <option key={e.employeeId} value={e.employeeId}>{e.name} ({e.employeeId})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Month</label>
              <input
                type="month"
                value={monthlyMonth}
                onChange={(e) => setMonthlyMonth(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button
              onClick={fetchMonthlyAttendance}
              disabled={!monthlyEmployeeId}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition"
            >
              Load
            </button>
          </div>

          {monthlySummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Present", val: monthlySummary.present, color: "text-green-700 bg-green-50 border-green-200" },
                { label: "Absent", val: monthlySummary.absent, color: "text-red-700 bg-red-50 border-red-200" },
                { label: "Half Day", val: monthlySummary.halfDay, color: "text-yellow-700 bg-yellow-50 border-yellow-200" },
                { label: "Late Days", val: monthlySummary.lateDays, color: "text-orange-700 bg-orange-50 border-orange-200" },
              ].map(({ label, val, color }) => (
                <div key={label} className={`rounded-xl border p-4 ${color}`}>
                  <div className="text-xs font-medium mb-1">{label}</div>
                  <div className="text-3xl font-bold">{val}</div>
                </div>
              ))}
              <div className="col-span-2 md:col-span-2 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-700">
                <div className="text-xs font-medium mb-1">Total Permission</div>
                <div className="text-2xl font-bold">{fmtMin(monthlySummary.totalPermissionMinutes)}</div>
              </div>
              <div className="col-span-2 md:col-span-2 rounded-xl border border-orange-200 bg-orange-50 p-4 text-orange-700">
                <div className="text-xs font-medium mb-1">Total Late</div>
                <div className="text-2xl font-bold">{fmtMin(monthlySummary.totalLateMinutes)}</div>
              </div>
            </div>
          )}

          {monthlyRecords.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["Date", "First In", "Last Out", "Status", "Late", "Permission", "Work Time", "Punches"].map((h) => (
                      <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {monthlyRecords.map((rec) => {
                    const s = STATUS_LABELS[rec.status] || STATUS_LABELS.PRESENT;
                    return (
                      <tr key={rec._id} className="hover:bg-gray-50 transition">
                        <td className="px-3 py-2 text-gray-700 font-medium">
                          {new Date(rec.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                        </td>
                        <td className="px-3 py-2 text-gray-700">{fmtTime(rec.firstPunchTime)}</td>
                        <td className="px-3 py-2 text-gray-700">{fmtTime(rec.lastPunchTime)}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.color}`}>{s.label}</span>
                        </td>
                        <td className="px-3 py-2">
                          {rec.isLate ? (
                            <span className="text-orange-600 text-xs font-semibold">{fmtMin(rec.lateMinutes)}</span>
                          ) : (
                            <span className="text-green-600 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {rec.totalPermissionMinutes > 0 ? (
                            <span className="text-blue-600 text-xs">{fmtMin(rec.totalPermissionMinutes)}</span>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-2 text-gray-600 text-xs">{fmtMin(rec.totalWorkMinutes)}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{rec.punches?.length || 0} punches</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Manual Mark ──────────────────────────────────────────────────────── */}
      {activeTab === "manual" && (
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-green-600" /> Manual Attendance Mark
            </h3>
            <p className="text-sm text-gray-500">Use this to mark leave, holiday, or correct a day's attendance status.</p>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Employee</label>
              <select
                value={manualEmpId}
                onChange={(e) => setManualEmpId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">— Select Employee —</option>
                {employees.map((e) => (
                  <option key={e.employeeId} value={e.employeeId}>{e.name} ({e.employeeId})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                style={{ colorScheme: "light" }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                value={manualStatus}
                onChange={(e) => setManualStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
              >
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            {manualStatus === "LEAVE" && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Leave Type</label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                  placeholder="Sick, Casual, etc."
                  value={manualLeaveType}
                  onChange={(e) => setManualLeaveType(e.target.value)}
                />
              </div>
            )}

            <button
              onClick={handleManualMark}
              disabled={!manualEmpId || savingManual}
              className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg font-medium text-sm transition"
            >
              {savingManual ? "Saving…" : "Mark Attendance"}
            </button>

            {manualMsg?.success && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4" /> {manualMsg.success}
              </div>
            )}
            {manualMsg?.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> {manualMsg.error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Monthly Report ────────────────────────────────────────────────────── */}
      {activeTab === "report" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Month</label>
              <input
                type="month"
                value={reportMonth}
                onChange={(e) => setReportMonth(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
              />
            </div>
            <button
              onClick={fetchMonthlyReport}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition"
            >
              Generate Report
            </button>
          </div>

          {loading && <div className="bg-white rounded-xl border p-12 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto" /></div>}

          {reportData && reportData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
                <h3 className="text-white font-bold text-lg">
                  Attendance Report — {new Date(reportMonth + "-01").toLocaleString("en-IN", { month: "long", year: "numeric" })}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {["Employee", "Department", "Present", "Absent", "Half Day", "Leave", "Late Days", "Late Time", "Permission Time"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {reportData.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{row.employee?.name || row.employeeId}</div>
                          <div className="text-xs text-gray-500">{row.employeeId}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{row.employee?.department || "—"}</td>
                        <td className="px-4 py-3 font-semibold text-green-700">{row.present}</td>
                        <td className="px-4 py-3 font-semibold text-red-700">{row.absent}</td>
                        <td className="px-4 py-3 text-yellow-700">{row.halfDay}</td>
                        <td className="px-4 py-3 text-blue-700">{row.leave}</td>
                        <td className="px-4 py-3">
                          {row.lateDays > 0 ? (
                            <span className="text-orange-600 font-semibold">{row.lateDays}</span>
                          ) : "0"}
                        </td>
                        <td className="px-4 py-3 text-orange-600 text-xs">{fmtMin(row.totalLateMinutes)}</td>
                        <td className="px-4 py-3 text-blue-600 text-xs">{fmtMin(row.totalPermissionMinutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportData && reportData.length === 0 && !loading && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No attendance records for this period.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

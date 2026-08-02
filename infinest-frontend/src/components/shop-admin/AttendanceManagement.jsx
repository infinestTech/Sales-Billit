"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Clock, CheckCircle, XCircle, AlertCircle, Calendar,
  User, Users, LogIn, LogOut, RefreshCw, Filter,
  ArrowRight, Download, ChevronLeft, ChevronRight, Edit2, Settings, Save,
  ToggleLeft, ToggleRight, Gift, TimerReset, SlidersHorizontal, Clock4,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || "http://localhost:8000";

const STATUS_LABELS = {
  PRESENT: { label: "Present", color: "bg-green-100 text-green-700" },
  ABSENT: { label: "Absent", color: "bg-red-100 text-red-700" },
  LEAVE: { label: "Leave", color: "bg-blue-100 text-blue-700" },
  HOLIDAY: { label: "Holiday", color: "bg-purple-100 text-purple-700" },
};

const PUNCH_STYLE = {
  CHECK_IN:  "bg-green-100 text-green-700",
  CHECK_OUT: "bg-red-100 text-red-700",
  LUNCH_OUT: "bg-amber-100 text-amber-700",
  LUNCH_IN:  "bg-emerald-100 text-emerald-700",
  DUPLICATE: "bg-gray-100 text-gray-500",
};

const PUNCH_LABEL = {
  CHECK_IN:  "IN",
  CHECK_OUT: "OUT",
  LUNCH_OUT: "LUNCH OUT",
  LUNCH_IN:  "LUNCH IN",
  DUPLICATE: "DUPLICATE",
};

export default function AttendanceManagement({ shopId }) {
  const [activeTab, setActiveTab] = useState("daily");
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);

  // Daily view state
  const [dailyDate, setDailyDate] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
  const [dailyRecords, setDailyRecords] = useState([]);

  // Software punch state
  const [punchEmployeeId, setPunchEmployeeId] = useState("");
  const [punchMsg, setPunchMsg] = useState(null);
  const [punching, setPunching] = useState(false);

  // Monthly view state
  const [monthlyEmployeeId, setMonthlyEmployeeId] = useState("");
  const [monthlyMonth, setMonthlyMonth] = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7)
  );
  const [monthlyRecords, setMonthlyRecords] = useState([]);
  const [monthlySummary, setMonthlySummary] = useState(null);

  // Manual attendance state
  const [manualEmpId, setManualEmpId] = useState("");
  const [manualDate, setManualDate] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
  const [manualStatus, setManualStatus] = useState("PRESENT");
  const [manualLeaveType, setManualLeaveType] = useState("");
  const [manualMsg, setManualMsg] = useState(null);
  const [savingManual, setSavingManual] = useState(false);

  // Monthly report state
  const [reportMonth, setReportMonth] = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7)
  );
  const [reportData, setReportData] = useState(null);

  // HR settings state
  const [hrSettings, setHrSettings] = useState({
    duplicatePunchWindowMinutes: 180,
    lunchThresholdTime: "12:00",
    lunchBreakMinutes: 30,
    enableLateDeduction: true,
    workingHoursType: "fixed",
    flexibleMinHoursPerDay: 8,
    enableOvertimeBonus: false,
    overtimeThresholdMinutes: 30,
    overtimeBonusRatePerHour: 0,
  });
  const [hrSettingsLoading, setHrSettingsLoading] = useState(false);
  const [hrSettingsSaving, setHrSettingsSaving] = useState(false);
  const [hrSettingsMsg, setHrSettingsMsg] = useState(null);

  const token = () => localStorage.getItem("shopAdminToken");
  const headers = () => ({ Authorization: `Bearer ${token()}` });

  useEffect(() => {
    if (shopId) {
      fetchEmployees();
      fetchHrSettings(); // Load HR settings on mount so they're ready before the settings tab is visited
    }
  }, [shopId]);

  useEffect(() => {
    if (shopId && activeTab === "daily") fetchDailyAttendance();
  }, [dailyDate, shopId, activeTab]);

  useEffect(() => {
    if (shopId && activeTab === "settings") fetchHrSettings(); // Re-fetch when settings tab is opened (ensures latest values)
  }, [shopId, activeTab]);

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/shop-admin/hr/employees`, {
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
      const res = await axios.get(`${API_URL}/api/shop-admin/hr/attendance/daily`, {
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
        `${API_URL}/api/shop-admin/hr/attendance/punch`,
        { employeeId: punchEmployeeId, source: "SOFTWARE" },
        { headers: headers() }
      );
      const d = res.data;
      setPunchMsg({
        type: d.punchType,
        isLate: d.isLate,
        late: d.lateMinutes,
        lateDeduction: d.lateDeduction,
        lunchMin: d.lunchMinutes,
        workedMin: d.workedMinutes,
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
      const res = await axios.get(`${API_URL}/api/shop-admin/hr/attendance/${monthlyEmployeeId}/monthly`, {
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
        `${API_URL}/api/shop-admin/hr/attendance/manual`,
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
      const res = await axios.get(`${API_URL}/api/shop-admin/hr/attendance/report`, {
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
  // ── HR Settings ──────────────────────────────────────────────────────────────────────
  const fetchHrSettings = async () => {
    setHrSettingsLoading(true); setHrSettingsMsg(null);
    try {
      const res = await axios.get(`${API_URL}/api/shop-admin/hr/settings`, {
        headers: headers(), params: { shopId },
      });
      if (res.data.success && res.data.data) {
        setHrSettings({
          duplicatePunchWindowMinutes: res.data.data.duplicatePunchWindowMinutes ?? 180,
          lunchThresholdTime:          res.data.data.lunchThresholdTime ?? "12:00",
          lunchBreakMinutes:           res.data.data.lunchBreakMinutes ?? 30,
          enableLateDeduction:         res.data.data.enableLateDeduction !== false,
          workingHoursType:            res.data.data.workingHoursType || "fixed",
          flexibleMinHoursPerDay:      res.data.data.flexibleMinHoursPerDay ?? 8,
          enableOvertimeBonus:         !!res.data.data.enableOvertimeBonus,
          overtimeThresholdMinutes:    res.data.data.overtimeThresholdMinutes ?? 30,
          overtimeBonusRatePerHour:    res.data.data.overtimeBonusRatePerHour ?? 0,
        });
      }
    } catch (err) {
      setHrSettingsMsg({ error: err.response?.data?.message || "Failed to load settings" });
    } finally { setHrSettingsLoading(false); }
  };

  const saveHrSettings = async () => {
    const dpw = Number(hrSettings.duplicatePunchWindowMinutes);
    const lbm = Number(hrSettings.lunchBreakMinutes);
    const ltt = String(hrSettings.lunchThresholdTime || "");
    const fmhpd = Number(hrSettings.flexibleMinHoursPerDay);
    const otThres = Number(hrSettings.overtimeThresholdMinutes);
    const otRate  = Number(hrSettings.overtimeBonusRatePerHour);
    if (!Number.isFinite(dpw) || dpw < 0 || dpw > 1440) {
      setHrSettingsMsg({ error: "Duplicate-punch window must be 0–1440 minutes." }); return;
    }
    if (!Number.isFinite(lbm) || lbm < 0 || lbm > 240) {
      setHrSettingsMsg({ error: "Lunch break must be 0–240 minutes." }); return;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(ltt)) {
      setHrSettingsMsg({ error: "Lunch threshold time must be HH:MM (24-hour)." }); return;
    }
    if (hrSettings.workingHoursType === "flexible" && (!Number.isFinite(fmhpd) || fmhpd < 1 || fmhpd > 24)) {
      setHrSettingsMsg({ error: "Minimum hours per day must be 1–24." }); return;
    }
    if (hrSettings.enableOvertimeBonus) {
      if (!Number.isFinite(otThres) || otThres < 0 || otThres > 240) {
        setHrSettingsMsg({ error: "Overtime threshold must be 0–240 minutes." }); return;
      }
      if (!Number.isFinite(otRate) || otRate < 0) {
        setHrSettingsMsg({ error: "Overtime bonus rate must be ≥ 0." }); return;
      }
    }
    setHrSettingsSaving(true); setHrSettingsMsg(null);
    try {
      const res = await axios.patch(`${API_URL}/api/shop-admin/hr/settings`,
        {
          shopId,
          duplicatePunchWindowMinutes: dpw,
          lunchThresholdTime: ltt,
          lunchBreakMinutes: lbm,
          enableLateDeduction:      hrSettings.enableLateDeduction,
          workingHoursType:         hrSettings.workingHoursType,
          flexibleMinHoursPerDay:   fmhpd,
          enableOvertimeBonus:      hrSettings.enableOvertimeBonus,
          overtimeThresholdMinutes: otThres,
          overtimeBonusRatePerHour: otRate,
        },
        { headers: headers() });
      if (res.data.success) {
        setHrSettingsMsg({ success: "HR settings saved." });
        // Sync local state with the server's confirmed saved values
        if (res.data.data) {
          setHrSettings({
            duplicatePunchWindowMinutes: res.data.data.duplicatePunchWindowMinutes ?? 180,
            lunchThresholdTime:          res.data.data.lunchThresholdTime ?? "12:00",
            lunchBreakMinutes:           res.data.data.lunchBreakMinutes ?? 30,
            enableLateDeduction:         res.data.data.enableLateDeduction !== false,
            workingHoursType:            res.data.data.workingHoursType || "fixed",
            flexibleMinHoursPerDay:      res.data.data.flexibleMinHoursPerDay ?? 8,
            enableOvertimeBonus:         !!res.data.data.enableOvertimeBonus,
            overtimeThresholdMinutes:    res.data.data.overtimeThresholdMinutes ?? 30,
            overtimeBonusRatePerHour:    res.data.data.overtimeBonusRatePerHour ?? 0,
          });
        }
      } else {
        setHrSettingsMsg({ error: res.data.message || "Save failed. Please try again." });
      }
    } catch (err) {
      setHrSettingsMsg({ error: err.response?.data?.message || "Save failed" });
    } finally { setHrSettingsSaving(false); }
  };;
  // ── Helpers ───────────────────────────────────────────────────────────────────
  const getEmployeeName = (id) => employees.find((e) => e.employeeId === id)?.name || id;

  const fmtTime = (d) =>
    d ? new Date(d).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }) : "—";

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
          <TAB id="settings" label="HR Settings" icon={Settings} />
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
                    {["Employee", "First In", "Last Out", "Status", "Late", "Lunch", "Work Hrs", "Punches"].map((h) => (
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
                          {rec.lunchMinutes > 0 ? (
                            <span className="text-amber-600 text-xs font-semibold">{fmtMin(rec.lunchMinutes)}</span>
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
                                className={`px-1.5 py-0.5 rounded text-xs font-semibold ${PUNCH_STYLE[p.type] || "bg-gray-100 text-gray-700"}`}
                                title={p.type}
                              >
                                {PUNCH_LABEL[p.type] || p.type} {fmtTime(p.time)}
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
              First punch = CHECK IN. After the duplicate window, next punch becomes LUNCH OUT (if after lunch threshold) or CHECK OUT. After lunch break duration, returning punch = LUNCH IN. Final punch of the day = CHECK OUT.
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

            {punchMsg && !punchMsg.error && (() => {
              const t = punchMsg.type;
              const isIn = t === "CHECK_IN" || t === "LUNCH_IN";
              const isOut = t === "CHECK_OUT" || t === "LUNCH_OUT";
              const isDup = t === "DUPLICATE";
              const panelClass = isDup
                ? "bg-gray-50 border-gray-300"
                : isIn
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200";
              const titleClass = isDup ? "text-gray-700" : isIn ? "text-green-700" : "text-red-700";
              return (
                <div className={`mt-4 p-4 rounded-xl border ${panelClass}`}>
                  <div className={`font-bold text-lg flex items-center gap-2 ${titleClass}`}>
                    {isDup ? <AlertCircle className="h-5 w-5" /> : isIn ? <LogIn className="h-5 w-5" /> : <LogOut className="h-5 w-5" />}
                    {PUNCH_LABEL[t] || t?.replace("_", " ")}
                  </div>
                  <p className="text-sm mt-1 text-gray-700">{punchMsg.msg}</p>
                  {punchMsg.isLate && (
                    <div className="mt-2 flex items-center gap-1 text-orange-600 text-sm font-semibold">
                      <AlertCircle className="h-4 w-4" /> Late by {fmtMin(punchMsg.late)}
                      {punchMsg.lateDeduction > 0 && (
                        <span className="ml-2 text-orange-700">(− ₹{punchMsg.lateDeduction})</span>
                      )}
                    </div>
                  )}
                  {punchMsg.lunchMin > 0 && (
                    <div className="mt-1 text-amber-700 text-sm">
                      Lunch break: {fmtMin(punchMsg.lunchMin)}
                    </div>
                  )}
                  {punchMsg.workedMin > 0 && (
                    <div className="mt-1 text-gray-600 text-sm">
                      Worked so far: {fmtMin(punchMsg.workedMin)}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-gray-500">Status: {punchMsg.status}</div>
                </div>
              );
            })()}
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
                { label: "Leave", val: monthlySummary.leave, color: "text-blue-700 bg-blue-50 border-blue-200" },
                { label: "Late Days", val: monthlySummary.lateDays, color: "text-orange-700 bg-orange-50 border-orange-200" },
              ].map(({ label, val, color }) => (
                <div key={label} className={`rounded-xl border p-4 ${color}`}>
                  <div className="text-xs font-medium mb-1">{label}</div>
                  <div className="text-3xl font-bold">{val}</div>
                </div>
              ))}
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-orange-700">
                <div className="text-xs font-medium mb-1">Total Late Time</div>
                <div className="text-2xl font-bold">{fmtMin(monthlySummary.totalLateMinutes)}</div>
              </div>
              <div className="rounded-xl border border-orange-300 bg-orange-50 p-4 text-orange-800">
                <div className="text-xs font-medium mb-1">Total Late Deduction</div>
                <div className="text-2xl font-bold">₹{(monthlySummary.totalLateDeduction || 0).toLocaleString()}</div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-700">
                <div className="text-xs font-medium mb-1">Total Lunch Time</div>
                <div className="text-2xl font-bold">{fmtMin(monthlySummary.totalLunchMinutes)}</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-gray-700">
                <div className="text-xs font-medium mb-1">Total Worked</div>
                <div className="text-2xl font-bold">{fmtMin(monthlySummary.totalWorkedMinutes)}</div>
              </div>
            </div>
          )}

          {monthlyRecords.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["Date", "First In", "Last Out", "Status", "Late", "Lunch", "Work Time", "Punches"].map((h) => (
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
                          {rec.lunchMinutes > 0 ? (
                            <span className="text-amber-600 text-xs">{fmtMin(rec.lunchMinutes)}</span>
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
                      {["Employee", "Department", "Present", "Absent", "Leave", "Late Days", "Late Time", "Late Deduction", "Lunch Time"].map((h) => (
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
                        <td className="px-4 py-3 text-blue-700">{row.leave}</td>
                        <td className="px-4 py-3">
                          {row.lateEntries > 0 ? (
                            <span className="text-orange-600 font-semibold">{row.lateEntries}</span>
                          ) : "0"}
                        </td>
                        <td className="px-4 py-3 text-orange-600 text-xs">{fmtMin(row.totalLateMinutes)}</td>
                        <td className="px-4 py-3 text-orange-700 text-xs">₹{(row.totalLateDeduction || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-amber-600 text-xs">{fmtMin(row.totalLunchMinutes)}</td>
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

      {/* ── HR Settings ─────────────────────────────────────────────────────────────────────── */}
      {activeTab === "settings" && (
        <div className="space-y-4">

          {/* status banners */}
          {hrSettingsMsg?.success && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              <CheckCircle className="h-4 w-4 shrink-0" />{hrSettingsMsg.success}
            </div>
          )}
          {hrSettingsMsg?.error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />{hrSettingsMsg.error}
            </div>
          )}

          {hrSettingsLoading ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto" />
            </div>
          ) : (
            <>
              {/* ──── 1. Working Hours Policy ──────────────────────────────────────────────── */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start gap-3 mb-4">
                  <SlidersHorizontal className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h3 className="text-base font-bold text-gray-800">Working Hours Policy</h3>
                    <p className="text-xs text-gray-500">Choose between a fixed shift schedule or flexible daily hour targets.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setHrSettings(s => ({ ...s, workingHoursType: "fixed" }))}
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 transition text-left ${
                      hrSettings.workingHoursType === "fixed"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <Clock4 className={`h-5 w-5 mt-0.5 shrink-0 ${hrSettings.workingHoursType === "fixed" ? "text-blue-600" : "text-gray-400"}`} />
                    <div>
                      <div className="font-semibold text-sm text-gray-800">Fixed Shift</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Employees have defined start &amp; end times. Lateness is measured against the shift start.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHrSettings(s => ({ ...s, workingHoursType: "flexible" }))}
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 transition text-left ${
                      hrSettings.workingHoursType === "flexible"
                        ? "border-purple-500 bg-purple-50"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <TimerReset className={`h-5 w-5 mt-0.5 shrink-0 ${hrSettings.workingHoursType === "flexible" ? "text-purple-600" : "text-gray-400"}`} />
                    <div>
                      <div className="font-semibold text-sm text-gray-800">Flexible Hours</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Employees can arrive anytime as long as they complete the minimum daily hours.
                      </div>
                    </div>
                  </button>
                </div>

                {hrSettings.workingHoursType === "flexible" && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Hours Per Day</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min={1} max={24}
                        value={hrSettings.flexibleMinHoursPerDay}
                        onChange={(e) => setHrSettings(s => ({ ...s, flexibleMinHoursPerDay: e.target.value }))}
                        className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-500">hours</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Attendance is counted as present only when the employee works at least this many hours.</p>
                  </div>
                )}
              </div>

              {/* ──── 2. Late Deduction Policy ─────────────────────────────────────────────── */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5" />
                    <div>
                      <h3 className="text-base font-bold text-gray-800">Late Entry Salary Deduction</h3>
                      <p className="text-xs text-gray-500">When enabled, late arrivals reduce the employee's net salary based on their per-employee deduction rate.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHrSettings(s => ({ ...s, enableLateDeduction: !s.enableLateDeduction }))}
                    className="shrink-0 ml-4"
                    title={hrSettings.enableLateDeduction ? "Click to disable" : "Click to enable"}
                  >
                    {hrSettings.enableLateDeduction
                      ? <ToggleRight className="h-8 w-8 text-green-500" />
                      : <ToggleLeft  className="h-8 w-8 text-gray-400" />}
                  </button>
                </div>
                {!hrSettings.enableLateDeduction && (
                  <div className="mt-3 flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Late deductions are <strong className="mx-1">disabled</strong>. Lateness is still tracked in reports but will not affect salary calculations.
                  </div>
                )}
                {hrSettings.enableLateDeduction && (
                  <p className="mt-3 text-xs text-gray-500">
                    The deduction amount per hour is configured <strong>per employee</strong> in the Employees tab (Late Policy → Deduction Per Hour). A grace period is also set per employee.
                  </p>
                )}
              </div>

              {/* ──── 3. Overtime Bonus ────────────────────────────────────────────────────── */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <Gift className="h-5 w-5 text-emerald-500 mt-0.5" />
                    <div>
                      <h3 className="text-base font-bold text-gray-800">Overtime Bonus</h3>
                      <p className="text-xs text-gray-500">Pay employees extra when they work beyond their assigned shift hours.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHrSettings(s => ({ ...s, enableOvertimeBonus: !s.enableOvertimeBonus }))}
                    className="shrink-0 ml-4"
                    title={hrSettings.enableOvertimeBonus ? "Click to disable" : "Click to enable"}
                  >
                    {hrSettings.enableOvertimeBonus
                      ? <ToggleRight className="h-8 w-8 text-green-500" />
                      : <ToggleLeft  className="h-8 w-8 text-gray-400" />}
                  </button>
                </div>

                {hrSettings.enableOvertimeBonus && (
                  <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Overtime Threshold (minutes)</label>
                        <input
                          type="number" min={0} max={240}
                          value={hrSettings.overtimeThresholdMinutes}
                          onChange={(e) => setHrSettings(s => ({ ...s, overtimeThresholdMinutes: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Minimum extra minutes beyond shift end before overtime counts. E.g. 30 = need 30 min extra before bonus starts.</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bonus Rate (₹ per hour of overtime)</label>
                        <input
                          type="number" min={0} step={0.5}
                          value={hrSettings.overtimeBonusRatePerHour}
                          onChange={(e) => setHrSettings(s => ({ ...s, overtimeBonusRatePerHour: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Applied to each hour of overtime. Appears as "Overtime Bonus" in the salary slip.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs">
                      <Gift className="h-4 w-4 shrink-0 mt-0.5" />
                      Formula per day: <code className="mx-1 font-mono bg-emerald-100 px-1 rounded">worked_min − shift_min − threshold_min</code> → divided by 60 × rate.
                      Bonus is added to net salary when generating salary records.
                    </div>
                  </div>
                )}
              </div>

              {/* ──── 4. Punch & Lunch Rules ───────────────────────────────────────────────── */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start gap-3 mb-4">
                  <Settings className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <h3 className="text-base font-bold text-gray-800">Punch &amp; Lunch Rules</h3>
                    <p className="text-xs text-gray-500">Controls duplicate-punch protection and lunch-break detection for Software Punch and eSSL devices.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duplicate-Punch Window (minutes)</label>
                    <input
                      type="number" min={0} max={1440}
                      value={hrSettings.duplicatePunchWindowMinutes}
                      onChange={(e) => setHrSettings(s => ({ ...s, duplicatePunchWindowMinutes: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Any punch within this window after the previous accepted punch is treated as a duplicate. Default: 180 (3 hours).</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lunch Threshold Time (HH:MM, 24-hour)</label>
                    <input
                      type="time"
                      value={hrSettings.lunchThresholdTime}
                      onChange={(e) => setHrSettings(s => ({ ...s, lunchThresholdTime: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">A checkout after this time is treated as the start of lunch. Default: 12:00.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lunch Break (minutes)</label>
                    <input
                      type="number" min={0} max={240}
                      value={hrSettings.lunchBreakMinutes}
                      onChange={(e) => setHrSettings(s => ({ ...s, lunchBreakMinutes: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">The first punch after this many minutes from lunch-out is treated as lunch-in. Default: 30.</p>
                  </div>
                </div>
              </div>

              {/* Save button */}
              <div className="flex justify-end">
                <button
                  onClick={saveHrSettings}
                  disabled={hrSettingsSaving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-semibold transition shadow-sm"
                >
                  {hrSettingsSaving
                    ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    : <Save className="h-4 w-4" />}
                  Save HR Settings
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

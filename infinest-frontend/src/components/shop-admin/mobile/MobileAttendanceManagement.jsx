"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Clock, CheckCircle, XCircle, AlertCircle, Calendar,
  User, Users, LogIn, LogOut, RefreshCw,
  Edit2, Settings, Save,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || "http://localhost:8000";

const STATUS_LABELS = {
  PRESENT: { label: "Present", color: "bg-green-100 text-green-700" },
  ABSENT:  { label: "Absent",  color: "bg-red-100 text-red-700" },
  LEAVE:   { label: "Leave",   color: "bg-blue-100 text-blue-700" },
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
  CHECK_IN: "IN", CHECK_OUT: "OUT", LUNCH_OUT: "L-OUT", LUNCH_IN: "L-IN", DUPLICATE: "DUP",
};

export default function MobileAttendanceManagement({ shopId }) {
  const [activeTab, setActiveTab] = useState("daily");
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);

  const [dailyDate, setDailyDate] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
  const [dailyRecords, setDailyRecords] = useState([]);

  const [punchEmployeeId, setPunchEmployeeId] = useState("");
  const [punchMsg, setPunchMsg] = useState(null);
  const [punching, setPunching] = useState(false);

  const [manualEmpId, setManualEmpId] = useState("");
  const [manualDate, setManualDate] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
  const [manualStatus, setManualStatus] = useState("PRESENT");
  const [manualLeaveType, setManualLeaveType] = useState("");
  const [manualMsg, setManualMsg] = useState(null);
  const [savingManual, setSavingManual] = useState(false);

  const [hrSettings, setHrSettings] = useState({ duplicatePunchWindowMinutes: 180, lunchThresholdTime: "12:00", lunchBreakMinutes: 30 });
  const [hrSettingsLoading, setHrSettingsLoading] = useState(false);
  const [hrSettingsSaving, setHrSettingsSaving] = useState(false);
  const [hrSettingsMsg, setHrSettingsMsg] = useState(null);

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("shopAdminToken")}` });

  useEffect(() => { if (shopId) fetchEmployees(); }, [shopId]);
  useEffect(() => { if (shopId && activeTab === "daily") fetchDailyAttendance(); }, [dailyDate, shopId, activeTab]);
  useEffect(() => { if (shopId && activeTab === "settings") fetchHrSettings(); }, [shopId, activeTab]);

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/shop-admin/hr/employees`, { headers: headers(), params: { shopId, isActive: true } });
      if (res.data.success) setEmployees(res.data.data || []);
    } catch {}
  };

  const fetchDailyAttendance = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/shop-admin/hr/attendance/daily`, { headers: headers(), params: { date: dailyDate, shopId } });
      if (res.data.success) setDailyRecords(res.data.data || []);
    } catch { setDailyRecords([]); }
    finally { setLoading(false); }
  };

  const handlePunch = async () => {
    if (!punchEmployeeId) return;
    setPunching(true); setPunchMsg(null);
    try {
      const res = await axios.post(`${API_URL}/api/shop-admin/hr/attendance/punch`,
        { employeeId: punchEmployeeId, source: "SOFTWARE" }, { headers: headers() });
      const d = res.data;
      setPunchMsg({
        type: d.punchType, isLate: d.isLate, late: d.lateMinutes, lateDeduction: d.lateDeduction,
        lunchMin: d.lunchMinutes, workedMin: d.workedMinutes, status: d.status, msg: d.message,
      });
      if (activeTab === "daily") fetchDailyAttendance();
    } catch (err) { setPunchMsg({ error: err.response?.data?.message || "Punch failed" }); }
    finally { setPunching(false); }
  };

  const handleManualMark = async () => {
    if (!manualEmpId || !manualDate || !manualStatus) return;
    setSavingManual(true); setManualMsg(null);
    try {
      await axios.post(`${API_URL}/api/shop-admin/hr/attendance/manual`,
        { employeeId: manualEmpId, date: manualDate, status: manualStatus, leaveType: manualLeaveType },
        { headers: headers() });
      setManualMsg({ success: `Marked as ${manualStatus}` });
      if (activeTab === "daily") fetchDailyAttendance();
    } catch (err) { setManualMsg({ error: err.response?.data?.message || "Failed to mark" }); }
    finally { setSavingManual(false); }
  };

  const fetchHrSettings = async () => {
    setHrSettingsLoading(true); setHrSettingsMsg(null);
    try {
      const res = await axios.get(`${API_URL}/api/shop-admin/hr/settings`, { headers: headers(), params: { shopId } });
      if (res.data.success && res.data.data) {
        setHrSettings({
          duplicatePunchWindowMinutes: res.data.data.duplicatePunchWindowMinutes ?? 180,
          lunchThresholdTime: res.data.data.lunchThresholdTime ?? "12:00",
          lunchBreakMinutes: res.data.data.lunchBreakMinutes ?? 30,
        });
      }
    } catch (err) { setHrSettingsMsg({ error: err.response?.data?.message || "Failed to load settings" }); }
    finally { setHrSettingsLoading(false); }
  };

  const saveHrSettings = async () => {
    const dpw = Number(hrSettings.duplicatePunchWindowMinutes);
    const lbm = Number(hrSettings.lunchBreakMinutes);
    const ltt = String(hrSettings.lunchThresholdTime || "");
    if (!Number.isFinite(dpw) || dpw < 0 || dpw > 1440) { setHrSettingsMsg({ error: "Duplicate window 0–1440 min." }); return; }
    if (!Number.isFinite(lbm) || lbm < 0 || lbm > 240) { setHrSettingsMsg({ error: "Lunch break 0–240 min." }); return; }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(ltt)) { setHrSettingsMsg({ error: "Lunch threshold must be HH:MM." }); return; }
    setHrSettingsSaving(true); setHrSettingsMsg(null);
    try {
      const res = await axios.patch(`${API_URL}/api/shop-admin/hr/settings`,
        { shopId, duplicatePunchWindowMinutes: dpw, lunchThresholdTime: ltt, lunchBreakMinutes: lbm },
        { headers: headers() });
      if (res.data.success) setHrSettingsMsg({ success: "HR settings saved." });
    } catch (err) { setHrSettingsMsg({ error: err.response?.data?.message || "Save failed" }); }
    finally { setHrSettingsSaving(false); }
  };

  const fmtTime = (d) => d ? new Date(d).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }) : "—";
  const fmtMin = (m) => { if (!m) return "0m"; const h = Math.floor(m / 60), mm = m % 60; return h > 0 ? `${h}h ${mm}m` : `${mm}m`; };

  const TABS = [
    { id: "daily",    label: "Daily",  icon: Calendar },
    { id: "punch",    label: "Punch",  icon: LogIn },
    { id: "manual",   label: "Manual", icon: Edit2 },
    { id: "settings", label: "Rules",  icon: Settings },
  ];

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-lg border border-gray-200 p-2">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition ${
                  activeTab === t.id ? "bg-green-600 text-white" : "bg-gray-50 text-gray-600"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Daily */}
      {activeTab === "daily" && (
        <div className="space-y-3">
          <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-2">
            <input
              type="date" value={dailyDate}
              onChange={(e) => setDailyDate(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
              style={{ colorScheme: "light" }}
            />
            <button
              onClick={fetchDailyAttendance}
              className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm flex items-center gap-1"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <div className="bg-white rounded-lg p-10 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto" /></div>
          ) : dailyRecords.length === 0 ? (
            <div className="bg-white rounded-lg p-10 text-center">
              <Clock className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No punch records</p>
            </div>
          ) : (
            <div className="space-y-2">
              {dailyRecords.map((rec) => {
                const s = STATUS_LABELS[rec.status] || STATUS_LABELS.PRESENT;
                return (
                  <div key={rec._id} className="bg-white rounded-lg border border-gray-200 p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">{rec.employee?.name || rec.employeeId}</div>
                        <div className="text-[11px] text-gray-500 font-mono">{rec.employeeId}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.color}`}>{s.label}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-gray-500">In</div>
                        <div className="font-medium text-gray-800">{fmtTime(rec.firstPunchTime)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Out</div>
                        <div className="font-medium text-gray-800">{fmtTime(rec.lastPunchTime)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Work</div>
                        <div className="font-medium text-gray-800">{fmtMin(rec.totalWorkMinutes)}</div>
                      </div>
                    </div>
                    {(rec.isLate || rec.lunchMinutes > 0) && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {rec.isLate && (
                          <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px] font-semibold flex items-center gap-0.5">
                            <AlertCircle className="h-2.5 w-2.5" /> Late {fmtMin(rec.lateMinutes)}
                          </span>
                        )}
                        {rec.lunchMinutes > 0 && (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-semibold">
                            Lunch {fmtMin(rec.lunchMinutes)}
                          </span>
                        )}
                      </div>
                    )}
                    {rec.punches?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {rec.punches.map((p, i) => (
                          <span key={i} className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${PUNCH_STYLE[p.type] || "bg-gray-100 text-gray-700"}`}>
                            {PUNCH_LABEL[p.type] || p.type} {fmtTime(p.time)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Punch */}
      {activeTab === "punch" && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
            <LogIn className="h-4 w-4 text-green-600" />
            Software Punch
          </h3>
          <p className="text-xs text-gray-500">
            First = CHECK IN. After duplicate window, next = LUNCH OUT or CHECK OUT.
          </p>
          <select
            value={punchEmployeeId}
            onChange={(e) => { setPunchEmployeeId(e.target.value); setPunchMsg(null); }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
          >
            <option value="">— Select Employee —</option>
            {employees.map((e) => (
              <option key={e.employeeId} value={e.employeeId}>{e.name} ({e.employeeId})</option>
            ))}
          </select>
          <button
            onClick={handlePunch}
            disabled={!punchEmployeeId || punching}
            className="w-full py-2.5 bg-green-600 disabled:bg-gray-300 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
          >
            {punching ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <><Clock className="h-4 w-4" /> Punch Attendance</>
            )}
          </button>

          {punchMsg && !punchMsg.error && (() => {
            const t = punchMsg.type;
            const isIn = t === "CHECK_IN" || t === "LUNCH_IN";
            const isDup = t === "DUPLICATE";
            const panel = isDup ? "bg-gray-50 border-gray-300" : isIn ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200";
            const title = isDup ? "text-gray-700" : isIn ? "text-green-700" : "text-red-700";
            return (
              <div className={`p-3 rounded-lg border ${panel}`}>
                <div className={`font-bold text-sm flex items-center gap-2 ${title}`}>
                  {isDup ? <AlertCircle className="h-4 w-4" /> : isIn ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                  {PUNCH_LABEL[t] || t}
                </div>
                <p className="text-xs mt-1 text-gray-700">{punchMsg.msg}</p>
                {punchMsg.isLate && (
                  <div className="mt-1 text-orange-600 text-xs font-semibold">
                    Late {fmtMin(punchMsg.late)}{punchMsg.lateDeduction > 0 && ` (− ₹${punchMsg.lateDeduction})`}
                  </div>
                )}
                {punchMsg.lunchMin > 0 && <div className="mt-1 text-amber-700 text-xs">Lunch: {fmtMin(punchMsg.lunchMin)}</div>}
                {punchMsg.workedMin > 0 && <div className="mt-1 text-gray-600 text-xs">Worked: {fmtMin(punchMsg.workedMin)}</div>}
              </div>
            );
          })()}
          {punchMsg?.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> {punchMsg.error}
            </div>
          )}
        </div>
      )}

      {/* Manual */}
      {activeTab === "manual" && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
            <Edit2 className="h-4 w-4 text-green-600" /> Manual Attendance
          </h3>
          <p className="text-xs text-gray-500">Use to mark leave, holiday, or correct a day's status.</p>

          <div>
            <label className="block text-xs text-gray-600 mb-1">Employee</label>
            <select
              value={manualEmpId} onChange={(e) => setManualEmpId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
            >
              <option value="">— Select —</option>
              {employees.map((e) => (
                <option key={e.employeeId} value={e.employeeId}>{e.name} ({e.employeeId})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Date</label>
            <input
              type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
              style={{ colorScheme: "light" }}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Status</label>
            <select
              value={manualStatus} onChange={(e) => setManualStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
            >
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          {manualStatus === "LEAVE" && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">Leave Type</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
                placeholder="Sick, Casual..." value={manualLeaveType}
                onChange={(e) => setManualLeaveType(e.target.value)}
              />
            </div>
          )}
          <button
            onClick={handleManualMark}
            disabled={!manualEmpId || savingManual}
            className="w-full py-2.5 bg-green-600 disabled:bg-gray-300 text-white rounded-lg font-medium text-sm"
          >
            {savingManual ? "Saving…" : "Mark Attendance"}
          </button>
          {manualMsg?.success && (
            <div className="p-2.5 bg-green-50 border border-green-200 rounded-lg text-green-700 text-xs flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> {manualMsg.success}
            </div>
          )}
          {manualMsg?.error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> {manualMsg.error}
            </div>
          )}
        </div>
      )}

      {/* Settings */}
      {activeTab === "settings" && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <Settings className="h-4 w-4 text-green-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-gray-800">Punch & Lunch Rules</h3>
              <p className="text-[11px] text-gray-500">Controls duplicate-punch protection and lunch detection.</p>
            </div>
          </div>

          {hrSettingsMsg?.success && (
            <div className="p-2.5 bg-green-50 border border-green-200 rounded-lg text-green-700 text-xs flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> {hrSettingsMsg.success}
            </div>
          )}
          {hrSettingsMsg?.error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> {hrSettingsMsg.error}
            </div>
          )}

          {hrSettingsLoading ? (
            <div className="p-6 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto" /></div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Duplicate-Punch Window (min)</label>
                <input
                  type="number" min={0} max={1440}
                  value={hrSettings.duplicatePunchWindowMinutes}
                  onChange={(e) => setHrSettings(s => ({ ...s, duplicatePunchWindowMinutes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
                />
                <p className="text-[11px] text-gray-500 mt-0.5">Default: 180 (3 hours).</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Lunch Threshold (HH:MM)</label>
                <input
                  type="time"
                  value={hrSettings.lunchThresholdTime}
                  onChange={(e) => setHrSettings(s => ({ ...s, lunchThresholdTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
                />
                <p className="text-[11px] text-gray-500 mt-0.5">Default: 12:00.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Lunch Break (min)</label>
                <input
                  type="number" min={0} max={240}
                  value={hrSettings.lunchBreakMinutes}
                  onChange={(e) => setHrSettings(s => ({ ...s, lunchBreakMinutes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
                />
                <p className="text-[11px] text-gray-500 mt-0.5">Default: 30.</p>
              </div>
              <button
                onClick={saveHrSettings}
                disabled={hrSettingsSaving}
                className="w-full flex items-center justify-center gap-2 py-2 bg-green-600 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium"
              >
                {hrSettingsSaving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Save className="h-4 w-4" />}
                Save Settings
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";
import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  Fingerprint, Wifi, WifiOff, Clock, CheckCircle, XCircle, AlertCircle,
  RefreshCw, ChevronDown, ChevronUp, User, Info, Zap,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || "http://localhost:8000";

// Mark as duplicate when same employee/PIN repeats within this many minutes
const DUPLICATE_WINDOW_MIN = 60;

export default function MobileEsslDeviceSettings({ shopId, employees = [] }) {
  const [settings, setSettings] = useState({ useEsslAttendance: false, esslDeviceSerial: "", devices: [] });
  const [serialInput, setSerialInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const [punchLogs, setPunchLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(true);

  const [deviceStatus, setDeviceStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  const [showPinManager, setShowPinManager] = useState(false);
  const [pinEdits, setPinEdits] = useState({});
  const [savingPin, setSavingPin] = useState(null);
  const [pinSavedMap, setPinSavedMap] = useState({});

  const getAuthHeaders = () => {
    const token = localStorage.getItem("shopAdminToken");
    return { headers: { Authorization: `Bearer ${token}` }, params: { shop_id: shopId } };
  };

  const fetchSettings = async () => {
    try {
      setLoading(true); setError(null);
      const res = await axios.get(`${API_URL}/api/shop-admin/shop-settings/essl`, getAuthHeaders());
      if (res.data.success) { setSettings(res.data); setSerialInput(res.data.esslDeviceSerial || ""); }
    } catch { setError("Failed to load eSSL settings."); }
    finally { setLoading(false); }
  };

  const fetchPunchLogs = async () => {
    try {
      setLogsLoading(true);
      const res = await axios.get(`${API_URL}/api/shop-admin/essl/punch-logs`,
        { ...getAuthHeaders(), params: { shop_id: shopId, limit: 50 } });
      if (res.data.success) setPunchLogs(res.data.logs);
    } catch (e) { /* noop */ }
    finally { setLogsLoading(false); }
  };

  const fetchDeviceStatus = async () => {
    try {
      setStatusLoading(true);
      const token = localStorage.getItem("shopAdminToken");
      const res = await axios.get(`${API_URL}/api/shop-admin/essl/device-status`, {
        headers: { Authorization: `Bearer ${token}` }, params: { shop_id: shopId },
      });
      if (res.data.success) setDeviceStatus(res.data);
    } catch {} finally { setStatusLoading(false); }
  };

  useEffect(() => { if (shopId) fetchSettings(); }, [shopId]);
  useEffect(() => {
    if (!shopId) return;
    fetchDeviceStatus();
    const interval = setInterval(fetchDeviceStatus, 30_000);
    return () => clearInterval(interval);
  }, [shopId]);
  useEffect(() => { if (showLogs && punchLogs.length === 0) fetchPunchLogs(); }, [showLogs]);

  const handleToggle = async () => {
    const newValue = !settings.useEsslAttendance;
    if (newValue && !serialInput.trim()) { setError("Enter device serial number first."); return; }
    setSaving(true); setError(null); setSuccessMsg(null);
    try {
      const payload = { useEsslAttendance: newValue };
      if (newValue) payload.esslDeviceSerial = serialInput.trim();
      const res = await axios.patch(`${API_URL}/api/shop-admin/shop-settings/essl`, payload, getAuthHeaders());
      if (res.data.success) {
        setSettings((p) => ({ ...p, useEsslAttendance: res.data.useEsslAttendance, esslDeviceSerial: res.data.esslDeviceSerial || "" }));
        setSuccessMsg(res.data.message);
        await fetchSettings();
      }
    } catch (err) { setError(err.response?.data?.message || "Failed to update."); }
    finally { setSaving(false); }
  };

  const handleSavePin = async (employeeId) => {
    const pin = pinEdits[employeeId];
    if (pin === undefined) return;
    setSavingPin(employeeId); setError(null);
    try {
      const res = await axios.patch(`${API_URL}/api/shop-admin/essl/employee-pin`,
        { employee_id: employeeId, device_pin: pin }, getAuthHeaders());
      if (res.data.success) {
        setSuccessMsg(res.data.message || "PIN updated.");
        setPinSavedMap((p) => ({ ...p, [employeeId]: pin }));
        setPinEdits((p) => { const n = { ...p }; delete n[employeeId]; return n; });
        if (res.data.backfilled > 0) fetchPunchLogs();
      }
    } catch (err) { setError(err.response?.data?.message || "Failed to update PIN."); }
    finally { setSavingPin(null); }
  };

  // Duplicate detection: same employee/PIN within DUPLICATE_WINDOW_MIN of earlier accepted punch
  const duplicateIds = useMemo(() => {
    const dups = new Set();
    if (!Array.isArray(punchLogs) || punchLogs.length === 0) return dups;
    const groups = new Map();
    for (const log of punchLogs) {
      const key = log.employee_id?._id || log.employee_id || `pin:${log.device_pin}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(log);
    }
    for (const [, list] of groups) {
      list.sort((a, b) => new Date(a.punch_time).getTime() - new Date(b.punch_time).getTime());
      let last = null;
      for (const log of list) {
        const t = new Date(log.punch_time).getTime();
        if (last !== null && t - last < DUPLICATE_WINDOW_MIN * 60_000) dups.add(log._id);
        else last = t;
      }
    }
    return dups;
  }, [punchLogs]);

  const formatRelativeTime = (d) => {
    if (!d) return "Never";
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "Just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const punchTypeLabel = (t) => ({
    check_in: "Check-In", check_out: "Check-Out", break_out: "Break-Out",
    break_in: "Break-In", overtime_in: "OT-In", overtime_out: "OT-Out", unknown: "Unknown",
  }[t] || t);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-slate-500 text-sm bg-white rounded-lg">
        <RefreshCw className="h-4 w-4 animate-spin" /> Loading eSSL settings…
      </div>
    );
  }

  const isEnabled = settings.useEsslAttendance;

  return (
    <div className="space-y-3">
      {/* Toggle card */}
      <div className={`rounded-lg border-2 p-3 ${isEnabled ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-white"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <div className={`rounded-lg p-1.5 ${isEnabled ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500"}`}>
              <Fingerprint className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">eSSL Biometric</h3>
              <p className="mt-0.5 text-[11px] text-slate-500 leading-snug">
                {isEnabled ? "Punches captured via eSSL device." : "Enable to receive punches from eSSL device."}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggle} disabled={saving}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 disabled:opacity-60 ${
              isEnabled ? "bg-indigo-600" : "bg-slate-300"
            }`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 mt-0.5 ${isEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>

        <div className="mt-3">
          <label className="block text-[11px] font-medium text-slate-600 mb-1">Device Serial (SN)</label>
          <div className="flex gap-2">
            <input
              type="text" value={serialInput}
              onChange={(e) => setSerialInput(e.target.value.trim())}
              placeholder="e.g. ABCD1234567"
              maxLength={64} disabled={isEnabled}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
            />
            {isEnabled && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-green-100 px-2 py-1.5 text-[11px] font-medium text-green-700">
                <CheckCircle className="h-3 w-3" /> Linked
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" /> {error}
          </div>
        )}
        {successMsg && (
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-green-50 p-2 text-xs text-green-700">
            <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" /> {successMsg}
          </div>
        )}
      </div>

      {/* Live status */}
      {(() => {
        const ds = deviceStatus;
        if (!ds) return null;
        const { isOnline, hasEverConnected } = ds;
        const bg = isOnline ? "bg-green-50 border-green-300" : hasEverConnected ? "bg-yellow-50 border-yellow-300" : "bg-slate-50 border-slate-200";
        const dot = isOnline ? "bg-green-500" : hasEverConnected ? "bg-yellow-400" : "bg-slate-400";
        const label = isOnline ? "Online" : hasEverConnected ? "Disconnected" : "Waiting…";
        const lc = isOnline ? "text-green-700" : hasEverConnected ? "text-yellow-700" : "text-slate-500";
        return (
          <div className={`rounded-lg border-2 ${bg} p-3`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  {isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />}
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dot}`} />
                </span>
                <span className={`text-xs font-bold ${lc}`}>{label}</span>
              </div>
              <button onClick={fetchDeviceStatus} disabled={statusLoading} className="flex items-center gap-1 px-2 py-1 text-[11px] text-slate-500 rounded">
                <RefreshCw className={`h-3 w-3 ${statusLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div className="bg-white rounded px-2 py-1.5">
                <div className="text-slate-400">SN</div>
                <div className="font-semibold text-slate-700 truncate">{ds.deviceSerial || "—"}</div>
              </div>
              <div className="bg-white rounded px-2 py-1.5">
                <div className="text-slate-400">Last Seen</div>
                <div className="font-semibold text-slate-700">{ds.lastSeen ? formatRelativeTime(ds.lastSeen) : "Never"}</div>
              </div>
              <div className="bg-white rounded px-2 py-1.5">
                <div className="text-slate-400">Today</div>
                <div className="font-semibold text-slate-700">{ds.todayPunchCount ?? 0}</div>
              </div>
            </div>
            {!isOnline && (
              <div className="mt-2">
                <button onClick={() => setShowDebug((v) => !v)} className="flex items-center gap-1 text-[11px] text-slate-500">
                  <Info className="h-3 w-3" /> {showDebug ? "Hide" : "Show"} setup info
                </button>
                {showDebug && ds.debug && (
                  <div className="mt-2 rounded bg-white border border-slate-200 p-2 space-y-1">
                    <p className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                      <Zap className="h-3 w-3" /> {ds.debug.tip}
                    </p>
                    {Object.entries(ds.debug.requiredConfig || {}).map(([k, v]) => (
                      <div key={k} className="flex justify-between py-0.5 border-b border-slate-50 text-[11px]">
                        <span className="text-slate-500">{k}</span>
                        <code className="font-mono font-semibold text-indigo-700 bg-indigo-50 px-1 rounded">{v}</code>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Devices */}
      {isEnabled && settings.devices?.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <h4 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1">
            <Wifi className="h-3.5 w-3.5 text-indigo-500" /> Registered Devices
          </h4>
          <div className="space-y-1.5">
            {settings.devices.map((d) => {
              const online = d.last_seen && Date.now() - new Date(d.last_seen).getTime() < 5 * 60 * 1000;
              return (
                <div key={d._id} className="flex items-center justify-between rounded bg-slate-50 px-2.5 py-2">
                  <div className="flex items-center gap-2">
                    {online ? <Wifi className="h-3.5 w-3.5 text-green-500" /> : <WifiOff className="h-3.5 w-3.5 text-slate-400" />}
                    <div>
                      <p className="text-xs font-medium text-slate-800">{d.device_name}</p>
                      <p className="text-[10px] text-slate-500">SN: {d.device_serial}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${online ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                    {online ? "Online" : "Offline"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PIN manager */}
      {isEnabled && employees.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <button onClick={() => setShowPinManager((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-3 text-xs font-semibold text-slate-700">
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-indigo-500" /> Employee Device PINs
            </span>
            {showPinManager ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </button>
          {showPinManager && (
            <div className="border-t border-slate-100 px-3 pb-3">
              <p className="py-2 text-[11px] text-slate-500 leading-snug">
                Enter the device PIN (User ID from the eSSL device) for each employee. Unmapped punches will link automatically.
              </p>
              <div className="space-y-1.5">
                {employees.map((emp) => {
                  const savedPin = pinSavedMap[emp._id] ?? emp.device_pin ?? "";
                  const cur = pinEdits[emp._id] !== undefined ? pinEdits[emp._id] : savedPin;
                  const dirty = pinEdits[emp._id] !== undefined;
                  return (
                    <div key={emp._id} className="flex items-center gap-2 rounded bg-slate-50 px-2 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 truncate">{emp.employee_name || emp.name}</p>
                        {savedPin && !dirty && (
                          <p className="text-[10px] text-emerald-700">Saved: {savedPin}</p>
                        )}
                      </div>
                      <input
                        type="text" inputMode="numeric" pattern="\d*" maxLength={10}
                        placeholder={savedPin ? `${savedPin}` : "PIN"}
                        value={cur}
                        onChange={(e) => setPinEdits((p) => ({ ...p, [emp._id]: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                        className="w-16 rounded border border-slate-300 bg-white px-2 py-1 text-center text-xs font-semibold text-slate-900"
                      />
                      <button
                        onClick={() => handleSavePin(emp._id)}
                        disabled={!dirty || savingPin === emp._id}
                        className="rounded bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white disabled:opacity-40"
                      >
                        {savingPin === emp._id ? "…" : "Save"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Punch Logs */}
      {isEnabled && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <button onClick={() => setShowLogs((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-3 text-xs font-semibold text-slate-700">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-indigo-500" /> Recent Punch Logs
            </span>
            {showLogs ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </button>
          {showLogs && (
            <div className="border-t border-slate-100">
              {logsLoading ? (
                <div className="flex items-center gap-2 p-3 text-xs text-slate-500">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Loading…
                </div>
              ) : punchLogs.length === 0 ? (
                <p className="p-3 text-xs text-slate-400">No punch records yet.</p>
              ) : (
                <>
                  {duplicateIds.size > 0 && (
                    <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border-b border-amber-100 text-[11px] text-amber-700">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>{duplicateIds.size}</strong> duplicate punch{duplicateIds.size === 1 ? "" : "es"} detected (same employee within {DUPLICATE_WINDOW_MIN} min) — shown greyed out.
                      </span>
                    </div>
                  )}
                  <div className="divide-y divide-slate-100">
                    {punchLogs.map((log) => {
                      const isDup = duplicateIds.has(log._id);
                      return (
                        <div key={log._id} className={`px-3 py-2 ${isDup ? "bg-slate-50/70 text-slate-400" : ""}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              {log.employee_id ? (
                                <p className={`text-xs font-medium truncate ${isDup ? "text-slate-500 line-through decoration-slate-300" : "text-slate-800"}`}>
                                  {log.employee_id.employee_name}
                                </p>
                              ) : (
                                <p className="text-[11px] italic text-slate-400 truncate">PIN {log.device_pin} (unmapped)</p>
                              )}
                              <p className="text-[10px] text-slate-500">
                                {new Date(log.punch_time).toLocaleString("en-IN", {
                                  timeZone: "Asia/Kolkata", day: "2-digit", month: "short",
                                  hour: "2-digit", minute: "2-digit",
                                })}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                isDup
                                  ? "bg-slate-100 text-slate-400 line-through decoration-slate-300"
                                  : log.punch_type === "check_in" ? "bg-green-100 text-green-700"
                                  : log.punch_type === "check_out" ? "bg-red-100 text-red-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}>
                                {punchTypeLabel(log.punch_type)}
                              </span>
                              {isDup ? (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                                  <AlertCircle className="h-2.5 w-2.5" /> Duplicate
                                </span>
                              ) : log.processed ? (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-green-600">
                                  <CheckCircle className="h-2.5 w-2.5" /> Processed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-500">
                                  <AlertCircle className="h-2.5 w-2.5" /> Pending
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="px-3 py-2 border-t border-slate-100">
                    <button
                      onClick={fetchPunchLogs} disabled={logsLoading}
                      className="flex items-center gap-1 text-[11px] text-indigo-600 disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3 w-3 ${logsLoading ? "animate-spin" : ""}`} /> Refresh
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

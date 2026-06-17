"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import {
  Fingerprint,
  Wifi,
  WifiOff,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  User,
  Activity,
  Info,
  Zap,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || "http://localhost:8000";

/**
 * EsslDeviceSettings
 *
 * Renders a toggle card inside the shop-admin portal allowing the admin to:
 *  1. Enable / disable the eSSL M20 biometric attendance integration.
 *  2. Enter / update the device serial number (SN).
 *  3. View registered devices and their last-seen status.
 *  4. View recent ADMS punch log entries.
 *  5. Assign device PINs to employees.
 *
 * When eSSL mode is ON, the built-in manual attendance section in the
 * regular Fixel app is hidden for the shop's users.
 */
export default function EsslDeviceSettings({ shopId, employees = [] }) {
  const [settings, setSettings] = useState({
    useEsslAttendance: false,
    esslDeviceSerial: "",
    devices: [],
  });
  const [serialInput, setSerialInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Punch log state
  const [punchLogs, setPunchLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  // Live device status (polled every 30s)
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  // Employee PIN mapping state
  const [showPinManager, setShowPinManager] = useState(false);
  const [pinEdits, setPinEdits] = useState({}); // { employeeId: pin }
  const [savingPin, setSavingPin] = useState(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("shopAdminToken");
    return {
      headers: { Authorization: `Bearer ${token}` },
      params: { shop_id: shopId },
    };
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(
        `${API_URL}/api/shop-admin/shop-settings/essl`,
        getAuthHeaders()
      );
      if (res.data.success) {
        setSettings(res.data);
        setSerialInput(res.data.esslDeviceSerial || "");
      }
    } catch (err) {
      setError("Failed to load eSSL settings.");
      console.error("Fetch eSSL settings error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPunchLogs = async () => {
    try {
      setLogsLoading(true);
      const res = await axios.get(
        `${API_URL}/api/shop-admin/essl/punch-logs`,
        { ...getAuthHeaders(), params: { shop_id: shopId, limit: 50 } }
      );
      if (res.data.success) setPunchLogs(res.data.logs);
    } catch (err) {
      console.error("Fetch punch logs error:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (shopId) fetchSettings();
  }, [shopId]);

  // Live device status polling — starts when eSSL is enabled
  const fetchDeviceStatus = async () => {
    try {
      setStatusLoading(true);
      const token = localStorage.getItem("shopAdminToken");
      const res = await axios.get(`${API_URL}/api/shop-admin/essl/device-status`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { shop_id: shopId },
      });
      if (res.data.success) setDeviceStatus(res.data);
    } catch (err) {
      console.error("Fetch device status error:", err);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    if (!shopId) return;
    fetchDeviceStatus();
    // Poll every 30 seconds when the component is mounted
    const interval = setInterval(fetchDeviceStatus, 30_000);
    return () => clearInterval(interval);
  }, [shopId]);

  useEffect(() => {
    if (showLogs && punchLogs.length === 0) fetchPunchLogs();
  }, [showLogs]);

  const handleToggle = async () => {
    const newValue = !settings.useEsslAttendance;

    // If enabling, require a serial number
    if (newValue && !serialInput.trim()) {
      setError("Please enter the device serial number (SN) before enabling.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const payload = { useEsslAttendance: newValue };
      if (newValue) payload.esslDeviceSerial = serialInput.trim();

      const res = await axios.patch(
        `${API_URL}/api/shop-admin/shop-settings/essl`,
        payload,
        getAuthHeaders()
      );
      if (res.data.success) {
        setSettings((prev) => ({
          ...prev,
          useEsslAttendance: res.data.useEsslAttendance,
          esslDeviceSerial: res.data.esslDeviceSerial || "",
        }));
        setSuccessMsg(res.data.message);
        // Refresh device list
        await fetchSettings();
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update eSSL settings.");
      console.error("Toggle eSSL error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePin = async (employeeId) => {
    const pin = pinEdits[employeeId];
    if (pin === undefined) return;
    setSavingPin(employeeId);
    try {
      const res = await axios.patch(
        `${API_URL}/api/shop-admin/essl/employee-pin`,
        { employee_id: employeeId, device_pin: pin },
        getAuthHeaders()
      );
      if (res.data.success) {
        setSuccessMsg(`PIN updated for employee.`);
        // Clear edit state
        setPinEdits((prev) => {
          const next = { ...prev };
          delete next[employeeId];
          return next;
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update PIN.");
    } finally {
      setSavingPin(null);
    }
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return "Never";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const punchTypeLabel = (type) => {
    const map = {
      check_in: "Check-In",
      check_out: "Check-Out",
      break_out: "Break-Out",
      break_in: "Break-In",
      overtime_in: "OT-In",
      overtime_out: "OT-Out",
      unknown: "Unknown",
    };
    return map[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-slate-500 text-sm">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Loading eSSL settings…
      </div>
    );
  }

  const isEnabled = settings.useEsslAttendance;

  return (
    <div className="space-y-5">
      {/* ── Main toggle card ───────────────────────────────────────── */}
      <div
        className={`rounded-xl border-2 p-5 transition-all ${
          isEnabled
            ? "border-indigo-400 bg-indigo-50"
            : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 rounded-lg p-2 ${
                isEnabled ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500"
              }`}
            >
              <Fingerprint className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">eSSL M20 Biometric Attendance</h3>
              <p className="mt-0.5 text-sm text-slate-500">
                {isEnabled
                  ? "Attendance is being captured via the eSSL M20 device. The built-in manual attendance section is hidden from shop users."
                  : "Enable to let the eSSL M20 device push attendance automatically. The built-in manual attendance section will be hidden."}
              </p>
            </div>
          </div>

          {/* Toggle switch */}
          <button
            onClick={handleToggle}
            disabled={saving}
            aria-label={isEnabled ? "Disable eSSL attendance" : "Enable eSSL attendance"}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 ${
              isEnabled ? "bg-indigo-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                isEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Device serial input */}
        <div className="mt-4">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Device Serial Number (SN)
            <span className="ml-1 text-slate-400 font-normal">
              — printed on the device label
            </span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={serialInput}
              onChange={(e) => setSerialInput(e.target.value.trim())}
              placeholder="e.g. ABCD1234567"
              maxLength={64}
              disabled={isEnabled} // lock when already enabled; must disable first to change
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
            />
            {isEnabled && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-green-100 px-3 py-2 text-xs font-medium text-green-700">
                <CheckCircle className="h-3.5 w-3.5" /> Linked
              </span>
            )}
          </div>
          {isEnabled && (
            <p className="mt-1.5 text-xs text-slate-400">
              Disable eSSL mode first to change the serial number.
            </p>
          )}
        </div>

        {/* Feedback messages */}
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            {successMsg}
          </div>
        )}
      </div>

      {/* ── Live Connection Status ─────────────────────────────────── */}
      {(() => {
        const ds = deviceStatus;
        if (!ds) return null;
        const { isOnline, hasEverConnected, deviceRegistered } = ds;
        const bgColor = isOnline
          ? "bg-green-50 border-green-300"
          : hasEverConnected
          ? "bg-yellow-50 border-yellow-300"
          : "bg-slate-50 border-slate-200";
        const dotColor = isOnline ? "bg-green-500" : hasEverConnected ? "bg-yellow-400" : "bg-slate-400";
        const label = isOnline ? "Online" : hasEverConnected ? "Disconnected" : "Waiting for first connection";
        const labelColor = isOnline ? "text-green-700" : hasEverConnected ? "text-yellow-700" : "text-slate-500";
        return (
          <div className={`rounded-xl border-2 ${bgColor} p-4`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                {/* Pulsing dot when online */}
                <span className="relative flex h-3 w-3">
                  {isOnline && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  )}
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${dotColor}`} />
                </span>
                <span className={`text-sm font-bold ${labelColor}`}>{label}</span>
              </div>
              <button
                onClick={fetchDeviceStatus}
                disabled={statusLoading}
                className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:bg-white hover:text-slate-700 rounded-lg transition"
              >
                <RefreshCw className={`h-3 w-3 ${statusLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-white rounded-lg px-3 py-2">
                <div className="text-slate-400 mb-0.5">Device SN</div>
                <div className="font-semibold text-slate-700 truncate">{ds.deviceSerial || "—"}</div>
              </div>
              <div className="bg-white rounded-lg px-3 py-2">
                <div className="text-slate-400 mb-0.5">Last Seen</div>
                <div className="font-semibold text-slate-700">
                  {ds.lastSeen ? formatRelativeTime(ds.lastSeen) : "Never"}
                </div>
              </div>
              <div className="bg-white rounded-lg px-3 py-2">
                <div className="text-slate-400 mb-0.5">Punches Today</div>
                <div className="font-semibold text-slate-700">{ds.todayPunchCount ?? 0}</div>
              </div>
              {ds.lastPunch && (
                <div className="bg-white rounded-lg px-3 py-2 col-span-2">
                  <div className="text-slate-400 mb-0.5">Last Punch</div>
                  <div className="font-semibold text-slate-700">
                    PIN {ds.lastPunch.pin} · {ds.lastPunch.type} ·{" "}
                    {new Date(ds.lastPunch.time).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              )}
            </div>

            {/* Debug / Setup section */}
            {!isOnline && (
              <div className="mt-3">
                <button
                  onClick={() => setShowDebug((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition"
                >
                  <Info className="h-3.5 w-3.5" />
                  {showDebug ? "Hide" : "Show"} setup &amp; debug info
                </button>
                {showDebug && ds.debug && (
                  <div className="mt-2 rounded-lg bg-white border border-slate-200 p-3 space-y-2">
                    <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                      <Zap className="h-3.5 w-3.5" />
                      {ds.debug.tip}
                    </p>
                    <div>
                      <p className="text-xs font-semibold text-slate-600 mb-1">Configure these in the device (ADMS settings):</p>
                      {Object.entries(ds.debug.requiredConfig || {}).map(([k, v]) => (
                        <div key={k} className="flex justify-between py-0.5 border-b border-slate-50 text-xs">
                          <span className="text-slate-500">{k}</span>
                          <code className="font-mono font-semibold text-indigo-700 bg-indigo-50 px-1.5 rounded">{v}</code>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400">
                      On the eSSL M20: <strong>Menu → Cloud Settings → Server Address</strong>. Enter the URL above. Port must be <strong>80 (HTTP)</strong>.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Registered devices ─────────────────────────────────────── */}
      {isEnabled && settings.devices && settings.devices.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Wifi className="h-4 w-4 text-indigo-500" /> Registered Devices
          </h4>
          <div className="space-y-2">
            {settings.devices.map((device) => {
              const isOnline =
                device.last_seen &&
                Date.now() - new Date(device.last_seen).getTime() < 5 * 60 * 1000;
              return (
                <div
                  key={device._id}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    {isOnline ? (
                      <Wifi className="h-4 w-4 text-green-500" />
                    ) : (
                      <WifiOff className="h-4 w-4 text-slate-400" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-slate-800">{device.device_name}</p>
                      <p className="text-xs text-slate-500">SN: {device.device_serial}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        isOnline ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {isOnline ? "Online" : "Offline"}
                    </span>
                    <p className="mt-0.5 text-xs text-slate-400">
                      <Clock className="inline h-3 w-3 mr-0.5" />
                      {formatRelativeTime(device.last_seen)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Employee PIN manager ───────────────────────────────────── */}
      {isEnabled && employees.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <button
            onClick={() => setShowPinManager((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors rounded-xl"
          >
            <span className="flex items-center gap-2">
              <User className="h-4 w-4 text-indigo-500" />
              Employee Device PINs
            </span>
            {showPinManager ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>

          {showPinManager && (
            <div className="border-t border-slate-100 px-5 pb-5">
              <p className="py-3 text-xs text-slate-500">
                Assign each employee the same numeric PIN that is programmed on the eSSL device.
                The PIN links biometric punches to employees in Fixel.
              </p>
              <div className="space-y-2">
                {employees.map((emp) => {
                  const currentPin = pinEdits[emp._id] !== undefined ? pinEdits[emp._id] : (emp.device_pin || "");
                  const isDirty = pinEdits[emp._id] !== undefined;
                  return (
                    <div key={emp._id} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {emp.employee_name || emp.name}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {emp.mobile_number || emp.phone_number}
                        </p>
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="\d*"
                        maxLength={10}
                        placeholder="PIN"
                        value={currentPin}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                          setPinEdits((prev) => ({ ...prev, [emp._id]: val }));
                        }}
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-center text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        onClick={() => handleSavePin(emp._id)}
                        disabled={!isDirty || savingPin === emp._id}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
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

      {/* ── Recent punch logs ──────────────────────────────────────── */}
      {isEnabled && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <button
            onClick={() => setShowLogs((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors rounded-xl"
          >
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-500" />
              Recent Punch Logs
            </span>
            {showLogs ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>

          {showLogs && (
            <div className="border-t border-slate-100">
              {logsLoading ? (
                <div className="flex items-center gap-2 p-5 text-sm text-slate-500">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : punchLogs.length === 0 ? (
                <p className="p-5 text-sm text-slate-400">No punch records received yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-xs font-medium text-slate-500">
                        <th className="px-4 py-2.5 text-left">Employee</th>
                        <th className="px-4 py-2.5 text-left">Type</th>
                        <th className="px-4 py-2.5 text-left">Time</th>
                        <th className="px-4 py-2.5 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {punchLogs.map((log) => (
                        <tr key={log._id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-2.5">
                            {log.employee_id ? (
                              <span className="font-medium text-slate-800">
                                {log.employee_id.employee_name}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-xs">
                                PIN {log.device_pin} (unmapped)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                log.punch_type === "check_in"
                                  ? "bg-green-100 text-green-700"
                                  : log.punch_type === "check_out"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {punchTypeLabel(log.punch_type)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-600 text-xs">
                            {new Date(log.punch_time).toLocaleString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-4 py-2.5">
                            {log.processed ? (
                              <span className="inline-flex items-center gap-1 text-xs text-green-600">
                                <CheckCircle className="h-3 w-3" /> Processed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-amber-500">
                                <AlertCircle className="h-3 w-3" /> Pending
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-4 py-3 border-t border-slate-100">
                    <button
                      onClick={fetchPunchLogs}
                      disabled={logsLoading}
                      className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3 w-3 ${logsLoading ? "animate-spin" : ""}`} />
                      Refresh
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

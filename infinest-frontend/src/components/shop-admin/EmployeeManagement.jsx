"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Users, Plus, Edit2, Save, X, ChevronDown, ChevronUp,
  ToggleLeft, ToggleRight, Clock, DollarSign,
  AlertCircle, CheckCircle,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || "http://localhost:8000";

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const defaultShift = {
  name: "General",
  startTime: "09:00",
  endTime: "18:00",
  gracePeriodMinutes: 15,
};

const defaultLatePolicy = {
  gracePeriodMinutes: 15,
  deductionPerHour: 0,
};

const emptyForm = {
  employeeId: "",
  esslDeviceUserId: "",
  name: "",
  phone: "",
  email: "",
  address: "",
  joiningDate: "",
  department: "",
  designation: "",
  dailySalary: "",
  shift: { ...defaultShift },
  workingDaysPerWeek: 6,
  weeklyOff: ["SUN"],
  latePolicy: { ...defaultLatePolicy },
};

// Auto-derive working hours/day from shift start/end (HH:MM)
function computeWorkingHours(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
}

// ── Extracted to module level so React never remounts them on re-renders ──────
function Section({ id, label, icon: Icon, expanded, onToggle, children }) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition"
      >
        <span className="flex items-center gap-2 font-semibold text-gray-700 text-sm">
          <Icon className="h-4 w-4 text-green-600" />
          {label}
        </span>
        {expanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
      </button>
      {expanded && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
}

function Field({ label, children, half }) {
  return (
    <div className={half ? "col-span-1" : ""}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

export default function EmployeeManagement({ shopId }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedSections, setExpandedSections] = useState({
    personal: true, pay: true, shift: false, policies: false,
  });
  const [showInactive, setShowInactive] = useState(false);
  const [hrSettings, setHrSettings] = useState(null);

  const token = () => localStorage.getItem("shopAdminToken");
  const headers = () => ({ Authorization: `Bearer ${token()}` });

  useEffect(() => {
    if (shopId) {
      fetchEmployees();
      fetchHrSettings();
    }
  }, [shopId]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/shop-admin/hr/employees`, {
        headers: headers(),
        params: { shopId, isActive: showInactive ? undefined : true },
      });
      if (res.data.success) setEmployees(res.data.data || []);
    } catch (err) {
      setError("Failed to fetch employees");
    } finally {
      setLoading(false);
    }
  };

  const fetchHrSettings = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/shop-admin/hr/settings`, {
        headers: headers(),
        params: { shopId },
      });
      if (res.data.success && res.data.data) setHrSettings(res.data.data);
    } catch (_) {}
  };

  useEffect(() => { fetchEmployees(); }, [showInactive]);

  const toggleSection = (key) =>
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const setField = (path, value) => {
    setForm((prev) => {
      const updated = { ...prev };
      const keys = path.split(".");
      let obj = updated;
      for (let i = 0; i < keys.length - 1; i++) {
        obj[keys[i]] = { ...obj[keys[i]] };
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return updated;
    });
  };

  const handleWeeklyOff = (day) => {
    const arr = form.weeklyOff.includes(day)
      ? form.weeklyOff.filter((d) => d !== day)
      : [...form.weeklyOff, day];
    setField("weeklyOff", arr);
  };

  const openCreateForm = () => {
    setForm({
      ...emptyForm,
      shift: { ...defaultShift },
      latePolicy: { ...defaultLatePolicy },
      weeklyOff: ["SUN"],
    });
    setEditingId(null);
    setError("");
    setSuccess("");
    setShowForm(true);
    setExpandedSections({ personal: true, pay: true, shift: true, policies: true });
  };

  const openEditForm = (emp) => {
    setForm({
      employeeId: emp.employeeId || "",
      esslDeviceUserId: emp.esslDeviceUserId || "",
      name: emp.name || "",
      phone: emp.phone || "",
      email: emp.email || "",
      address: emp.address || "",
      joiningDate: emp.joiningDate ? emp.joiningDate.split("T")[0] : "",
      department: emp.department || "",
      designation: emp.designation || "",
      dailySalary: emp.dailySalary ?? "",
      shift: {
        name: emp.shift?.name || "General",
        startTime: emp.shift?.startTime || "09:00",
        endTime: emp.shift?.endTime || "18:00",
        gracePeriodMinutes: emp.shift?.gracePeriodMinutes ?? 15,
      },
      workingDaysPerWeek: emp.workingDaysPerWeek || 6,
      weeklyOff: emp.weeklyOff || ["SUN"],
      latePolicy: {
        gracePeriodMinutes: emp.latePolicy?.gracePeriodMinutes ?? 15,
        deductionPerHour: emp.latePolicy?.deductionPerHour ?? 0,
      },
    });
    setEditingId(emp.employeeId);
    setError("");
    setSuccess("");
    setShowForm(true);
    setExpandedSections({ personal: true, pay: true, shift: true, policies: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const gracePeriod = Number(form.latePolicy.gracePeriodMinutes);
      const payload = {
        ...form,
        dailySalary: Number(form.dailySalary),
        workingDaysPerWeek: Number(form.workingDaysPerWeek),
        shift: {
          name: form.shift.name,
          startTime: form.shift.startTime,
          endTime: form.shift.endTime,
          // Keep shift.gracePeriodMinutes in sync with latePolicy.gracePeriodMinutes
          // so both DB fields agree and buildDailySummary always reads the correct value.
          gracePeriodMinutes: gracePeriod,
        },
        latePolicy: {
          gracePeriodMinutes: gracePeriod,
          deductionPerHour: Number(form.latePolicy.deductionPerHour),
        },
        shopId,
      };

      if (editingId) {
        await axios.put(`${API_URL}/api/shop-admin/hr/employees/${editingId}`, payload, { headers: headers() });
        setSuccess("Employee updated successfully");
      } else {
        await axios.post(`${API_URL}/api/shop-admin/hr/employees`, payload, { headers: headers() });
        setSuccess("Employee created successfully");
      }
      await fetchEmployees();
      setShowForm(false);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save employee");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (emp) => {
    try {
      const endpoint = emp.isActive ? "deactivate" : "reactivate";
      await axios.patch(`${API_URL}/api/shop-admin/hr/employees/${emp.employeeId}/${endpoint}`, {}, { headers: headers() });
      fetchEmployees();
    } catch (err) {
      setError("Failed to update status");
    }
  };

  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500";

  const computedHours = computeWorkingHours(form.shift.startTime, form.shift.endTime);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-800">Employee Management</h2>
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
            {employees.filter((e) => e.isActive).length} Active
          </span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-300"
            />
            Show inactive
          </label>
          <button
            onClick={openCreateForm}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition"
          >
            <Plus className="h-4 w-4" />
            Add Employee
          </button>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          <CheckCircle className="h-4 w-4" /> {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* Employee List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto" /></div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No employees found. Add your first employee.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["ID", "Name", "Department", "Designation", "Shift", "Daily Salary", "Joining Date", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employees.map((emp) => (
                  <tr key={emp._id} className={`hover:bg-gray-50 transition ${!emp.isActive ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{emp.employeeId}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{emp.name}</div>
                      <div className="text-xs text-gray-500">{emp.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{emp.department || "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{emp.designation || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-700">
                        {emp.shift?.startTime} – {emp.shift?.endTime}
                      </div>
                      <div className="text-xs text-gray-500">{emp.shift?.workingHours}h/day</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-green-700">
                      ₹{(emp.dailySalary || 0).toLocaleString()}
                      <span className="block text-[10px] font-normal text-gray-500">per day</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString("en-IN") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${emp.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {emp.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditForm(emp)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleActive(emp)}
                          className={`p-1.5 rounded transition ${emp.isActive ? "text-red-600 hover:bg-red-50" : "text-green-600 hover:bg-green-50"}`}
                          title={emp.isActive ? "Deactivate" : "Reactivate"}
                        >
                          {emp.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-over form */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl overflow-hidden">
            {/* Form header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600">
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                {editingId ? "Edit Employee" : "Add New Employee"}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-white hover:bg-white hover:bg-opacity-20 p-1.5 rounded-lg transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mx-6 mt-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-0">
              {/* Personal Info */}
              <Section id="personal" label="Personal Information" icon={Users} expanded={expandedSections.personal} onToggle={toggleSection}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Employee ID *">
                    <input required className={inp} value={form.employeeId} onChange={(e) => setField("employeeId", e.target.value)} disabled={!!editingId} placeholder="EMP001" />
                  </Field>
                  <Field label="ESSL Device User ID">
                    <input className={inp} value={form.esslDeviceUserId} onChange={(e) => setField("esslDeviceUserId", e.target.value)} placeholder="Device PIN/ID" />
                  </Field>
                  <Field label="Full Name *">
                    <input required className={inp} value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="John Doe" />
                  </Field>
                  <Field label="Phone">
                    <input className={inp} value={form.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="+91 98765 43210" />
                  </Field>
                  <Field label="Email">
                    <input type="email" className={inp} value={form.email} onChange={(e) => setField("email", e.target.value)} placeholder="john@example.com" />
                  </Field>
                  <Field label="Joining Date *">
                    <input required type="date" className={inp} value={form.joiningDate} onChange={(e) => setField("joiningDate", e.target.value)} />
                  </Field>
                  <Field label="Department">
                    <input className={inp} value={form.department} onChange={(e) => setField("department", e.target.value)} placeholder="Sales, Service, etc." />
                  </Field>
                  <Field label="Designation">
                    <input className={inp} value={form.designation} onChange={(e) => setField("designation", e.target.value)} placeholder="Technician, Manager…" />
                  </Field>
                  <div className="col-span-2">
                    <Field label="Address">
                      <input className={inp} value={form.address} onChange={(e) => setField("address", e.target.value)} placeholder="Full address" />
                    </Field>
                  </div>
                </div>
              </Section>

              {/* Pay Details */}
              <Section id="pay" label="Pay Details" icon={DollarSign} expanded={expandedSections.pay} onToggle={toggleSection}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Daily Salary (₹/day) *">
                    <input required type="number" min="0" className={inp} value={form.dailySalary} onChange={(e) => setField("dailySalary", e.target.value)} placeholder="e.g. 1000" />
                  </Field>
                </div>
                <p className="text-xs text-gray-500">
                  Employees earn this amount for each PRESENT day. There is no monthly base salary and no paid leaves.
                </p>
              </Section>

              {/* HR Policy Context — shows what's active shop-wide so admin stays in sync */}
              {hrSettings && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <strong>Hours Policy:</strong>{" "}
                    {hrSettings.workingHoursType === "flexible"
                      ? `Flexible (min ${hrSettings.flexibleMinHoursPerDay ?? 8}h/day)`
                      : "Fixed Shift"}
                  </span>
                  <span className="text-blue-300">|</span>
                  <span><strong>Late Deduction:</strong> {hrSettings.enableLateDeduction ? "Enabled" : "Disabled"}</span>
                  {hrSettings.enableOvertimeBonus && (
                    <>
                      <span className="text-blue-300">|</span>
                      <span><strong>Overtime:</strong> ₹{hrSettings.overtimeBonusRatePerHour}/hr after {hrSettings.overtimeThresholdMinutes}min extra</span>
                    </>
                  )}
                </div>
              )}

              {/* Shift */}
              <Section id="shift" label="Shift & Working Hours" icon={Clock} expanded={expandedSections.shift} onToggle={toggleSection}>
                {hrSettings?.workingHoursType === "flexible" ? (
                  <>
                    <div className="flex items-start gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg text-purple-800 text-xs mb-3">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-purple-500" />
                      <span>
                        Shop uses <strong>Flexible Hours</strong> — employees can arrive at any time as long as they work at least{" "}
                        <strong>{hrSettings.flexibleMinHoursPerDay ?? 8}h/day</strong> (configured in HR Settings). Shift start/end is not used for lateness detection.
                        {hrSettings.enableOvertimeBonus && " Shift times below are used only as a reference label for overtime calculations."}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Working Days / Week">
                        <input type="number" min="1" max="7" className={inp} value={form.workingDaysPerWeek} onChange={(e) => setField("workingDaysPerWeek", e.target.value)} />
                      </Field>
                      <Field label="Shift Label (optional)">
                        <input className={inp} value={form.shift.name} onChange={(e) => setField("shift.name", e.target.value)} placeholder="General" />
                      </Field>
                      {hrSettings.enableOvertimeBonus && (
                        <>
                          <Field label="Shift Start (reference)">
                            <input type="time" className={inp} value={form.shift.startTime} onChange={(e) => setField("shift.startTime", e.target.value)} />
                          </Field>
                          <Field label="Shift End (reference)">
                            <input type="time" className={inp} value={form.shift.endTime} onChange={(e) => setField("shift.endTime", e.target.value)} />
                          </Field>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Shift Name">
                      <input className={inp} value={form.shift.name} onChange={(e) => setField("shift.name", e.target.value)} placeholder="General / Morning / Night" />
                    </Field>
                    <Field label="Working Hours / Day (auto)">
                      <input readOnly className={`${inp} bg-gray-100 cursor-not-allowed`} value={`${computedHours} h`} />
                    </Field>
                    <Field label="Shift Start Time *">
                      <input required type="time" className={inp} value={form.shift.startTime} onChange={(e) => setField("shift.startTime", e.target.value)} />
                    </Field>
                    <Field label="Shift End Time *">
                      <input required type="time" className={inp} value={form.shift.endTime} onChange={(e) => setField("shift.endTime", e.target.value)} />
                    </Field>
                    <Field label="Working Days / Week">
                      <input type="number" min="1" max="7" className={inp} value={form.workingDaysPerWeek} onChange={(e) => setField("workingDaysPerWeek", e.target.value)} />
                    </Field>
                  </div>
                )}
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-600 mb-2">Weekly Off Days</label>
                  <div className="flex gap-2 flex-wrap">
                    {DAYS.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleWeeklyOff(day)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                          form.weeklyOff.includes(day)
                            ? "bg-green-600 text-white border-green-600"
                            : "bg-white text-gray-700 border-gray-300 hover:border-green-400"
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              </Section>

              {/* Late Entry Policy */}
              <Section id="policies" label="Late Entry Policy" icon={AlertCircle} expanded={expandedSections.policies} onToggle={toggleSection}>
                {hrSettings?.workingHoursType === "flexible" ? (
                  <div className="flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-gray-400" />
                    <span>
                      Late entry tracking <strong>does not apply</strong> in Flexible Hours mode — employees have no fixed start time so there is no concept of being late.
                      These fields are ignored during attendance and salary calculations.
                    </span>
                  </div>
                ) : (
                  <>
                    {hrSettings && !hrSettings.enableLateDeduction && (
                      <div className="flex items-start gap-2 p-3 mb-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                        <span>
                          Late deduction is currently <strong>disabled shop-wide</strong> in HR Settings. Lateness will still be
                          recorded in attendance, but it won&apos;t reduce salary until you re-enable the
                          &quot;Late Entry Salary Deduction&quot; toggle in HR Settings → Attendance.
                        </span>
                      </div>
                    )}
                    <div className={`bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-3 transition-opacity ${hrSettings && !hrSettings.enableLateDeduction ? "opacity-60" : ""}`}>
                      <p className="text-xs text-orange-700">
                        Late = check-in after shift start + grace period. Deduction is prorated per minute from the hourly rate below, capped at one day&apos;s salary.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Grace Period (minutes)">
                          <input type="number" min="0" className={inp} value={form.latePolicy.gracePeriodMinutes} onChange={(e) => setField("latePolicy.gracePeriodMinutes", e.target.value)} />
                        </Field>
                        <Field label="Deduction ₹ per hour late">
                          <input
                            type="number" min="0"
                            className={inp}
                            value={form.latePolicy.deductionPerHour}
                            onChange={(e) => setField("latePolicy.deductionPerHour", e.target.value)}
                            placeholder="e.g. 100"
                          />
                        </Field>
                      </div>
                    </div>
                  </>
                )}
              </Section>
            </form>

            {/* Footer buttons */}
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition">
                Cancel
              </button>
              <button
                type="submit"
                form=""
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition"
              >
                {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Save className="h-4 w-4" />}
                {editingId ? "Update Employee" : "Create Employee"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

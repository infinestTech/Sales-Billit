"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Users, Plus, Edit2, Save, X, ChevronDown, ChevronUp,
  ToggleLeft, ToggleRight, Clock, DollarSign,
  AlertCircle, CheckCircle, ChevronLeft,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || "http://localhost:8000";
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const defaultShift = { name: "General", startTime: "09:00", endTime: "18:00", gracePeriodMinutes: 15 };
const defaultLatePolicy = { gracePeriodMinutes: 15, deductionPerHour: 0 };

const emptyForm = {
  employeeId: "", esslDeviceUserId: "", name: "", phone: "", email: "", address: "",
  joiningDate: "", department: "", designation: "", dailySalary: "",
  shift: { ...defaultShift }, workingDaysPerWeek: 6, weeklyOff: ["SUN"],
  latePolicy: { ...defaultLatePolicy },
};

function computeWorkingHours(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
}

function Section({ id, label, icon: Icon, expanded, onToggle, children }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-3 bg-white">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition"
      >
        <span className="flex items-center gap-2 font-semibold text-gray-700 text-sm">
          <Icon className="h-4 w-4 text-green-600" />
          {label}
        </span>
        {expanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
      </button>
      {expanded && <div className="p-3 space-y-3">{children}</div>}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

export default function MobileEmployeeManagement({ shopId }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expanded, setExpanded] = useState({ personal: true, pay: true, shift: false, policies: false });
  const [showInactive, setShowInactive] = useState(false);
  const [expandedCard, setExpandedCard] = useState(null);

  const token = () => localStorage.getItem("shopAdminToken");
  const headers = () => ({ Authorization: `Bearer ${token()}` });

  const fetchEmployees = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/shop-admin/hr/employees`, {
        headers: headers(), params: { shopId, isActive: showInactive ? undefined : true },
      });
      if (res.data.success) setEmployees(res.data.data || []);
    } catch { setError("Failed to fetch employees"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchEmployees(); }, [shopId, showInactive]);

  const toggleSection = (k) => setExpanded((p) => ({ ...p, [k]: !p[k] }));

  const setField = (path, value) => {
    setForm((prev) => {
      const updated = { ...prev };
      const keys = path.split(".");
      let obj = updated;
      for (let i = 0; i < keys.length - 1; i++) { obj[keys[i]] = { ...obj[keys[i]] }; obj = obj[keys[i]]; }
      obj[keys[keys.length - 1]] = value;
      return updated;
    });
  };

  const handleWeeklyOff = (day) => {
    const arr = form.weeklyOff.includes(day) ? form.weeklyOff.filter((d) => d !== day) : [...form.weeklyOff, day];
    setField("weeklyOff", arr);
  };

  const openCreateForm = () => {
    setForm({ ...emptyForm, shift: { ...defaultShift }, latePolicy: { ...defaultLatePolicy }, weeklyOff: ["SUN"] });
    setEditingId(null); setError(""); setSuccess(""); setShowForm(true);
    setExpanded({ personal: true, pay: true, shift: true, policies: true });
  };

  const openEditForm = (emp) => {
    setForm({
      employeeId: emp.employeeId || "",
      esslDeviceUserId: emp.esslDeviceUserId || "",
      name: emp.name || "", phone: emp.phone || "", email: emp.email || "",
      address: emp.address || "",
      joiningDate: emp.joiningDate ? emp.joiningDate.split("T")[0] : "",
      department: emp.department || "", designation: emp.designation || "",
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
    setError(""); setSuccess(""); setShowForm(true);
    setExpanded({ personal: true, pay: true, shift: true, policies: true });
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setSaving(true); setError(""); setSuccess("");
    try {
      const payload = {
        ...form,
        dailySalary: Number(form.dailySalary),
        workingDaysPerWeek: Number(form.workingDaysPerWeek),
        shift: {
          name: form.shift.name,
          startTime: form.shift.startTime,
          endTime: form.shift.endTime,
          gracePeriodMinutes: Number(form.shift.gracePeriodMinutes),
        },
        latePolicy: {
          gracePeriodMinutes: Number(form.latePolicy.gracePeriodMinutes),
          deductionPerHour: Number(form.latePolicy.deductionPerHour),
        },
        shopId,
      };
      if (editingId) {
        await axios.put(`${API_URL}/api/shop-admin/hr/employees/${editingId}`, payload, { headers: headers() });
        setSuccess("Employee updated");
      } else {
        await axios.post(`${API_URL}/api/shop-admin/hr/employees`, payload, { headers: headers() });
        setSuccess("Employee created");
      }
      await fetchEmployees();
      setShowForm(false);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save employee");
    } finally { setSaving(false); }
  };

  const toggleActive = async (emp) => {
    try {
      const endpoint = emp.isActive ? "deactivate" : "reactivate";
      await axios.patch(`${API_URL}/api/shop-admin/hr/employees/${emp.employeeId}/${endpoint}`, {}, { headers: headers() });
      fetchEmployees();
    } catch { setError("Failed to update status"); }
  };

  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500";
  const computedHours = computeWorkingHours(form.shift.startTime, form.shift.endTime);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-gray-800">Employees</h2>
          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
            {employees.filter((e) => e.isActive).length} Active
          </span>
        </div>
        <button
          onClick={openCreateForm}
          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      <label className="flex items-center gap-2 text-xs text-gray-600 px-1">
        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded border-gray-300" />
        Show inactive
      </label>

      {success && (
        <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg text-green-700 text-xs">
          <CheckCircle className="h-4 w-4" /> {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* Employee cards */}
      {loading ? (
        <div className="bg-white rounded-lg p-10 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto" />
        </div>
      ) : employees.length === 0 ? (
        <div className="bg-white rounded-lg p-10 text-center">
          <Users className="h-10 w-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No employees found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {employees.map((emp) => {
            const isOpen = expandedCard === emp._id;
            return (
              <div key={emp._id} className={`bg-white rounded-lg border border-gray-200 ${!emp.isActive ? "opacity-60" : ""}`}>
                <button
                  onClick={() => setExpandedCard(isOpen ? null : emp._id)}
                  className="w-full p-3 text-left flex items-start justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 text-sm truncate">{emp.name}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${emp.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {emp.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 font-mono">{emp.employeeId}{emp.esslDeviceUserId ? ` · eSSL: ${emp.esslDeviceUserId}` : ""}</div>
                    <div className="flex items-center gap-3 text-xs text-gray-600 mt-1">
                      <span>{emp.shift?.startTime}–{emp.shift?.endTime}</span>
                      <span className="font-semibold text-green-700">₹{(emp.dailySalary || 0).toLocaleString()}/day</span>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                </button>
                {isOpen && (
                  <div className="border-t border-gray-100 p-3 space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="text-gray-500">Phone:</span> <span className="text-gray-800">{emp.phone || "—"}</span></div>
                      <div><span className="text-gray-500">Email:</span> <span className="text-gray-800 truncate">{emp.email || "—"}</span></div>
                      <div><span className="text-gray-500">Dept:</span> <span className="text-gray-800">{emp.department || "—"}</span></div>
                      <div><span className="text-gray-500">Role:</span> <span className="text-gray-800">{emp.designation || "—"}</span></div>
                      <div><span className="text-gray-500">Joined:</span> <span className="text-gray-800">{emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString("en-IN") : "—"}</span></div>
                      <div><span className="text-gray-500">Work hrs:</span> <span className="text-gray-800">{emp.shift?.workingHours || "—"}h/day</span></div>
                    </div>
                    {emp.address && <div><span className="text-gray-500">Address:</span> <span className="text-gray-800">{emp.address}</span></div>}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => openEditForm(emp)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium"
                      >
                        <Edit2 className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => toggleActive(emp)}
                        className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium ${emp.isActive ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
                      >
                        {emp.isActive ? <><ToggleRight className="h-3.5 w-3.5" /> Deactivate</> : <><ToggleLeft className="h-3.5 w-3.5" /> Reactivate</>}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Slide-up form */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center">
          <div className="w-full bg-white sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600">
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="text-white"><ChevronLeft className="h-5 w-5" /></button>
                {editingId ? "Edit Employee" : "Add Employee"}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-white p-1 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mx-4 mt-3 flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-3 py-3">
              <Section id="personal" label="Personal" icon={Users} expanded={expanded.personal} onToggle={toggleSection}>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Employee ID *">
                    <input required className={inp} value={form.employeeId} onChange={(e) => setField("employeeId", e.target.value)} disabled={!!editingId} placeholder="EMP001" />
                  </Field>
                  <Field label="eSSL PIN">
                    <input className={inp} value={form.esslDeviceUserId} onChange={(e) => setField("esslDeviceUserId", e.target.value)} placeholder="Device PIN" />
                  </Field>
                  <div className="col-span-2"><Field label="Full Name *">
                    <input required className={inp} value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="John Doe" />
                  </Field></div>
                  <Field label="Phone">
                    <input className={inp} value={form.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="+91 ..." />
                  </Field>
                  <Field label="Joining Date *">
                    <input required type="date" className={inp} value={form.joiningDate} onChange={(e) => setField("joiningDate", e.target.value)} />
                  </Field>
                  <Field label="Department">
                    <input className={inp} value={form.department} onChange={(e) => setField("department", e.target.value)} />
                  </Field>
                  <Field label="Designation">
                    <input className={inp} value={form.designation} onChange={(e) => setField("designation", e.target.value)} />
                  </Field>
                  <div className="col-span-2"><Field label="Email">
                    <input type="email" className={inp} value={form.email} onChange={(e) => setField("email", e.target.value)} />
                  </Field></div>
                  <div className="col-span-2"><Field label="Address">
                    <input className={inp} value={form.address} onChange={(e) => setField("address", e.target.value)} />
                  </Field></div>
                </div>
              </Section>

              <Section id="pay" label="Pay" icon={DollarSign} expanded={expanded.pay} onToggle={toggleSection}>
                <Field label="Daily Salary (₹/day) *">
                  <input required type="number" min="0" className={inp} value={form.dailySalary} onChange={(e) => setField("dailySalary", e.target.value)} />
                </Field>
                <p className="text-[11px] text-gray-500">Employees earn this for each PRESENT day. No paid leaves.</p>
              </Section>

              <Section id="shift" label="Shift" icon={Clock} expanded={expanded.shift} onToggle={toggleSection}>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Shift Name">
                    <input className={inp} value={form.shift.name} onChange={(e) => setField("shift.name", e.target.value)} />
                  </Field>
                  <Field label="Hours/Day">
                    <input readOnly className={`${inp} bg-gray-100`} value={`${computedHours} h`} />
                  </Field>
                  <Field label="Start *">
                    <input required type="time" className={inp} value={form.shift.startTime} onChange={(e) => setField("shift.startTime", e.target.value)} />
                  </Field>
                  <Field label="End *">
                    <input required type="time" className={inp} value={form.shift.endTime} onChange={(e) => setField("shift.endTime", e.target.value)} />
                  </Field>
                  <Field label="Grace (min)">
                    <input type="number" min="0" className={inp} value={form.shift.gracePeriodMinutes} onChange={(e) => setField("shift.gracePeriodMinutes", e.target.value)} />
                  </Field>
                  <Field label="Days/Week">
                    <input type="number" min="1" max="7" className={inp} value={form.workingDaysPerWeek} onChange={(e) => setField("workingDaysPerWeek", e.target.value)} />
                  </Field>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Weekly Off</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {DAYS.map((day) => (
                      <button key={day} type="button" onClick={() => handleWeeklyOff(day)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                          form.weeklyOff.includes(day) ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-700 border-gray-300"
                        }`}>
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              </Section>

              <Section id="policies" label="Late Policy" icon={AlertCircle} expanded={expanded.policies} onToggle={toggleSection}>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-2.5 space-y-2">
                  <p className="text-[11px] text-orange-700">Late = check-in after shift start + grace. Deduction prorated per minute.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Late Grace (min)">
                      <input type="number" min="0" className={inp} value={form.latePolicy.gracePeriodMinutes} onChange={(e) => setField("latePolicy.gracePeriodMinutes", e.target.value)} />
                    </Field>
                    <Field label="₹/hour late *">
                      <input type="number" min="0" className={inp} value={form.latePolicy.deductionPerHour} onChange={(e) => setField("latePolicy.deductionPerHour", e.target.value)} />
                    </Field>
                  </div>
                </div>
              </Section>
            </form>

            <div className="px-3 py-3 border-t border-gray-200 flex gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 disabled:bg-gray-400 text-white rounded-lg font-medium text-sm"
              >
                {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Save className="h-4 w-4" />}
                {editingId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

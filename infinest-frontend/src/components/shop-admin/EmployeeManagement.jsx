"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Users, Plus, Edit2, Save, X, ChevronDown, ChevronUp,
  Trash2, ToggleLeft, ToggleRight, Clock, DollarSign,
  AlertCircle, CheckCircle, Briefcase, Phone, Mail,
  MapPin, Calendar, Fingerprint, Settings
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || "http://localhost:8000";

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const defaultShift = {
  name: "General",
  startTime: "09:00",
  endTime: "18:00",
  workingHours: 8,
  gracePeriodMinutes: 15,
};

const defaultPermissionPolicy = {
  maxHoursPerMonth: 2,
  deductionType: "PROPORTIONAL",
  deductionAmountPerHour: 0,
};

const defaultLatePolicy = {
  gracePeriodMinutes: 15,
  deductionType: "PROPORTIONAL",
  deductionAmountPerLate: 0,
  halfDayAfterNLates: 3,
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
  grossSalary: "",
  payComponents: [],
  shift: { ...defaultShift },
  workingDaysPerWeek: 6,
  weeklyOff: ["SUN"],
  permissionPolicy: { ...defaultPermissionPolicy },
  latePolicy: { ...defaultLatePolicy },
  paidLeavesPerYear: 12,
};

function PayComponentRow({ comp, index, onChange, onRemove }) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200">
      <input
        className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 bg-white"
        placeholder="Name (e.g. Basic, PF)"
        value={comp.name}
        onChange={(e) => onChange(index, "name", e.target.value)}
      />
      <select
        className="px-2 py-1.5 border border-gray-300 rounded text-sm bg-white text-gray-900"
        value={comp.type}
        onChange={(e) => onChange(index, "type", e.target.value)}
      >
        <option value="EARNING">Earning</option>
        <option value="DEDUCTION">Deduction</option>
      </select>
      <select
        className="px-2 py-1.5 border border-gray-300 rounded text-sm bg-white text-gray-900"
        value={comp.calculationType}
        onChange={(e) => onChange(index, "calculationType", e.target.value)}
      >
        <option value="FIXED">Fixed ₹</option>
        <option value="PERCENTAGE">% of Gross</option>
      </select>
      <input
        type="number"
        min="0"
        className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 bg-white"
        placeholder={comp.calculationType === "PERCENTAGE" ? "%" : "₹"}
        value={comp.value}
        onChange={(e) => onChange(index, "value", e.target.value)}
      />
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="text-red-500 hover:text-red-700 p-1"
      >
        <X className="h-4 w-4" />
      </button>
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
    personal: true, pay: true, shift: false, policies: false, payComponents: false,
  });
  const [showInactive, setShowInactive] = useState(false);

  const token = () => localStorage.getItem("shopAdminToken");
  const headers = () => ({ Authorization: `Bearer ${token()}` });

  useEffect(() => {
    if (shopId) fetchEmployees();
  }, [shopId]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/employees`, {
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

  const handlePayCompChange = (index, key, value) => {
    const comps = [...form.payComponents];
    comps[index] = { ...comps[index], [key]: value };
    setForm((prev) => ({ ...prev, payComponents: comps }));
  };

  const addPayComp = () => {
    setForm((prev) => ({
      ...prev,
      payComponents: [
        ...prev.payComponents,
        { name: "", type: "EARNING", calculationType: "FIXED", value: 0, isActive: true },
      ],
    }));
  };

  const removePayComp = (index) => {
    const comps = form.payComponents.filter((_, i) => i !== index);
    setForm((prev) => ({ ...prev, payComponents: comps }));
  };

  const handleWeeklyOff = (day) => {
    const arr = form.weeklyOff.includes(day)
      ? form.weeklyOff.filter((d) => d !== day)
      : [...form.weeklyOff, day];
    setField("weeklyOff", arr);
  };

  const openCreateForm = () => {
    setForm({ ...emptyForm, shift: { ...defaultShift }, permissionPolicy: { ...defaultPermissionPolicy }, latePolicy: { ...defaultLatePolicy }, weeklyOff: ["SUN"], payComponents: [] });
    setEditingId(null);
    setError("");
    setSuccess("");
    setShowForm(true);
    setExpandedSections({ personal: true, pay: true, shift: true, policies: true, payComponents: true });
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
      grossSalary: emp.grossSalary || "",
      payComponents: emp.payComponents || [],
      shift: emp.shift || { ...defaultShift },
      workingDaysPerWeek: emp.workingDaysPerWeek || 6,
      weeklyOff: emp.weeklyOff || ["SUN"],
      permissionPolicy: emp.permissionPolicy || { ...defaultPermissionPolicy },
      latePolicy: emp.latePolicy || { ...defaultLatePolicy },
      paidLeavesPerYear: emp.paidLeavesPerYear || 12,
    });
    setEditingId(emp.employeeId);
    setError("");
    setSuccess("");
    setShowForm(true);
    setExpandedSections({ personal: true, pay: true, shift: true, policies: true, payComponents: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        ...form,
        grossSalary: Number(form.grossSalary),
        workingDaysPerWeek: Number(form.workingDaysPerWeek),
        paidLeavesPerYear: Number(form.paidLeavesPerYear),
        shift: {
          ...form.shift,
          workingHours: Number(form.shift.workingHours),
          gracePeriodMinutes: Number(form.shift.gracePeriodMinutes),
        },
        permissionPolicy: {
          ...form.permissionPolicy,
          maxHoursPerMonth: Number(form.permissionPolicy.maxHoursPerMonth),
          deductionAmountPerHour: Number(form.permissionPolicy.deductionAmountPerHour),
        },
        latePolicy: {
          ...form.latePolicy,
          gracePeriodMinutes: Number(form.latePolicy.gracePeriodMinutes),
          deductionAmountPerLate: Number(form.latePolicy.deductionAmountPerLate),
          halfDayAfterNLates: Number(form.latePolicy.halfDayAfterNLates),
        },
        payComponents: form.payComponents.map((c) => ({ ...c, value: Number(c.value) })),
        shopId,
      };

      if (editingId) {
        await axios.put(`${API_URL}/api/employees/${editingId}`, payload, { headers: headers() });
        setSuccess("Employee updated successfully");
      } else {
        await axios.post(`${API_URL}/api/employees`, payload, { headers: headers() });
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
      await axios.patch(`${API_URL}/api/employees/${emp.employeeId}/${endpoint}`, {}, { headers: headers() });
      fetchEmployees();
    } catch (err) {
      setError("Failed to update status");
    }
  };

  const Section = ({ id, label, icon: Icon, children }) => (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
      <button
        type="button"
        onClick={() => toggleSection(id)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition"
      >
        <span className="flex items-center gap-2 font-semibold text-gray-700 text-sm">
          <Icon className="h-4 w-4 text-green-600" />
          {label}
        </span>
        {expandedSections[id] ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
      </button>
      {expandedSections[id] && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );

  const Field = ({ label, children, half }) => (
    <div className={half ? "col-span-1" : ""}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );

  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500";
  const sel = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500";

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
                  {["ID", "Name", "Department", "Designation", "Shift", "Gross Salary", "Joining Date", "Status", "Actions"].map((h) => (
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
                      ₹{(emp.grossSalary || 0).toLocaleString()}
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
              <Section id="personal" label="Personal Information" icon={Users}>
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
              <Section id="pay" label="Pay Details" icon={DollarSign}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Gross Salary (₹/month) *">
                    <input required type="number" min="0" className={inp} value={form.grossSalary} onChange={(e) => setField("grossSalary", e.target.value)} placeholder="20000" />
                  </Field>
                  <Field label="Paid Leaves Per Year">
                    <input type="number" min="0" className={inp} value={form.paidLeavesPerYear} onChange={(e) => setField("paidLeavesPerYear", e.target.value)} />
                  </Field>
                </div>
              </Section>

              {/* Pay Components */}
              <Section id="payComponents" label="Pay Components (Earnings & Deductions)" icon={Settings}>
                <p className="text-xs text-gray-500 mb-2">Configure individual earnings (Basic, HRA) and deductions (PF, ESI). Leave empty to use gross salary as-is.</p>
                <div className="space-y-2">
                  {form.payComponents.map((comp, i) => (
                    <PayComponentRow key={i} comp={comp} index={i} onChange={handlePayCompChange} onRemove={removePayComp} />
                  ))}
                </div>
                <button type="button" onClick={addPayComp} className="mt-2 flex items-center gap-1 text-sm text-green-600 hover:text-green-800 font-medium">
                  <Plus className="h-4 w-4" /> Add Component
                </button>
              </Section>

              {/* Shift */}
              <Section id="shift" label="Shift & Working Hours" icon={Clock}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Shift Name">
                    <input className={inp} value={form.shift.name} onChange={(e) => setField("shift.name", e.target.value)} placeholder="General / Morning / Night" />
                  </Field>
                  <Field label="Working Hours / Day *">
                    <input required type="number" min="1" max="24" className={inp} value={form.shift.workingHours} onChange={(e) => setField("shift.workingHours", e.target.value)} />
                  </Field>
                  <Field label="Shift Start Time *">
                    <input required type="time" className={inp} value={form.shift.startTime} onChange={(e) => setField("shift.startTime", e.target.value)} />
                  </Field>
                  <Field label="Shift End Time *">
                    <input required type="time" className={inp} value={form.shift.endTime} onChange={(e) => setField("shift.endTime", e.target.value)} />
                  </Field>
                  <Field label="Grace Period (minutes)">
                    <input type="number" min="0" className={inp} value={form.shift.gracePeriodMinutes} onChange={(e) => setField("shift.gracePeriodMinutes", e.target.value)} />
                  </Field>
                  <Field label="Working Days / Week">
                    <input type="number" min="1" max="7" className={inp} value={form.workingDaysPerWeek} onChange={(e) => setField("workingDaysPerWeek", e.target.value)} />
                  </Field>
                </div>
                <div>
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

              {/* Policies */}
              <Section id="policies" label="Permission & Late Entry Policies" icon={AlertCircle}>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                  <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1"><Clock className="h-3 w-3" /> Permission Hours Policy</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Max Permission (hrs/month)">
                      <input type="number" min="0" step="0.5" className={inp} value={form.permissionPolicy.maxHoursPerMonth} onChange={(e) => setField("permissionPolicy.maxHoursPerMonth", e.target.value)} />
                    </Field>
                    <Field label="Deduction Type">
                      <select className={sel} value={form.permissionPolicy.deductionType} onChange={(e) => setField("permissionPolicy.deductionType", e.target.value)}>
                        <option value="PROPORTIONAL">Proportional (auto)</option>
                        <option value="PER_HOUR">Fixed per hour</option>
                        <option value="NONE">No deduction</option>
                      </select>
                    </Field>
                    {form.permissionPolicy.deductionType === "PER_HOUR" && (
                      <Field label="Deduction ₹ per excess hour">
                        <input type="number" min="0" className={inp} value={form.permissionPolicy.deductionAmountPerHour} onChange={(e) => setField("permissionPolicy.deductionAmountPerHour", e.target.value)} />
                      </Field>
                    )}
                  </div>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-orange-700 mb-2 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Late Entry Policy</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Late Grace Period (minutes)">
                      <input type="number" min="0" className={inp} value={form.latePolicy.gracePeriodMinutes} onChange={(e) => setField("latePolicy.gracePeriodMinutes", e.target.value)} />
                    </Field>
                    <Field label="Deduction Type">
                      <select className={sel} value={form.latePolicy.deductionType} onChange={(e) => setField("latePolicy.deductionType", e.target.value)}>
                        <option value="PROPORTIONAL">Proportional (per min)</option>
                        <option value="FIXED_PER_LATE">Fixed per late day</option>
                        <option value="HALF_DAY_AFTER_N">Half-day after N lates</option>
                        <option value="NONE">No deduction</option>
                      </select>
                    </Field>
                    {form.latePolicy.deductionType === "FIXED_PER_LATE" && (
                      <Field label="Deduction ₹ per late">
                        <input type="number" min="0" className={inp} value={form.latePolicy.deductionAmountPerLate} onChange={(e) => setField("latePolicy.deductionAmountPerLate", e.target.value)} />
                      </Field>
                    )}
                    {form.latePolicy.deductionType === "HALF_DAY_AFTER_N" && (
                      <Field label="Convert to half-day after N lates">
                        <input type="number" min="1" className={inp} value={form.latePolicy.halfDayAfterNLates} onChange={(e) => setField("latePolicy.halfDayAfterNLates", e.target.value)} />
                      </Field>
                    )}
                  </div>
                </div>
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

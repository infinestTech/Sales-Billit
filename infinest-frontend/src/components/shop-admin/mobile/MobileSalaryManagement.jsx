"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Users, Calendar, DollarSign, CheckCircle, XCircle,
  AlertCircle, ChevronDown, ChevronUp, Edit, Save, X, Calculator
} from 'lucide-react';
import { getLocalDateString } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || 'http://localhost:8000';

const STATUS_BADGE = {
  DRAFT:     'bg-gray-100 text-gray-700',
  FINALIZED: 'bg-blue-100 text-blue-700',
  PAID:      'bg-green-100 text-green-700',
};

export default function MobileSalaryManagement({ shopId }) {
  const [activeSubTab, setActiveSubTab] = useState('overview');
  const [employees, setEmployees] = useState([]);
  const [salaryRecords, setSalaryRecords] = useState([]);
  const [salarySummary, setSalarySummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => getLocalDateString().slice(0, 7));
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [monthlyDetail, setMonthlyDetail] = useState(null);
  const [expandedRecord, setExpandedRecord] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editingSalary, setEditingSalary] = useState('');
  const [actionMsg, setActionMsg] = useState(null);

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('shopAdminToken')}` });
  const [year, monthStr] = selectedMonth.split('-');
  const month = Number(monthStr);

  useEffect(() => { if (shopId) fetchEmployees(); }, [shopId]);

  useEffect(() => {
    if (!shopId) return;
    if (activeSubTab === 'records') fetchSalaryReport();
    if (activeSubTab === 'overview' && selectedEmployee) fetchMonthlyDetail();
  }, [activeSubTab, shopId, selectedMonth, selectedEmployee]);

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/shop-admin/hr/employees`, {
        headers: headers(), params: { shopId, isActive: true },
      });
      if (res.data.success) {
        const list = res.data.data || [];
        setEmployees(list);
        if (list.length && !selectedEmployee) setSelectedEmployee(list[0].employeeId);
      }
    } catch (_) {}
  };

  const fetchSalaryReport = async () => {
    setLoading(true); setActionMsg(null);
    try {
      const res = await axios.get(`${API_URL}/api/shop-admin/hr/salary/report`, {
        headers: headers(), params: { shopId, month, year: Number(year) },
      });
      if (res.data.success) {
        setSalaryRecords(res.data.data || []);
        setSalarySummary(res.data.summary || null);
      }
    } catch (_) { setSalaryRecords([]); setSalarySummary(null); }
    finally { setLoading(false); }
  };

  const fetchMonthlyDetail = async () => {
    if (!selectedEmployee || !selectedMonth) return;
    setLoading(true);
    try {
      const att = await axios.get(`${API_URL}/api/shop-admin/hr/attendance/monthly`, {
        headers: headers(), params: { employeeId: selectedEmployee, month, year: Number(year) },
      });
      let salary = null;
      try {
        const sal = await axios.get(`${API_URL}/api/shop-admin/hr/salary/${selectedEmployee}`, {
          headers: headers(), params: { month, year: Number(year) },
        });
        if (sal.data.success) salary = sal.data.data;
      } catch (_) {}
      const emp = employees.find(e => e.employeeId === selectedEmployee);
      setMonthlyDetail({
        employee: emp,
        days: att.data.success ? (att.data.data || []) : [],
        summary: att.data.success ? (att.data.summary || null) : null,
        salary,
      });
    } catch (_) { setMonthlyDetail(null); }
    finally { setLoading(false); }
  };

  const handleGenerate = async (employeeId) => {
    try {
      await axios.post(`${API_URL}/api/shop-admin/hr/salary/generate`,
        { employeeId, month, year: Number(year) }, { headers: headers() });
      setActionMsg({ success: 'Salary generated.' });
      fetchSalaryReport();
      if (selectedEmployee === employeeId) fetchMonthlyDetail();
    } catch (err) { setActionMsg({ error: err.response?.data?.message || 'Generate failed' }); }
  };

  const handleFinalize = async (employeeId) => {
    try {
      await axios.patch(`${API_URL}/api/shop-admin/hr/salary/${employeeId}/finalize`,
        { month, year: Number(year) }, { headers: headers() });
      fetchSalaryReport();
      if (selectedEmployee === employeeId) fetchMonthlyDetail();
    } catch (err) { setActionMsg({ error: err.response?.data?.message || 'Finalize failed' }); }
  };

  const handleMarkPaid = async (employeeId) => {
    try {
      await axios.patch(`${API_URL}/api/shop-admin/hr/salary/${employeeId}/mark-paid`,
        { month, year: Number(year) }, { headers: headers() });
      fetchSalaryReport();
      if (selectedEmployee === employeeId) fetchMonthlyDetail();
    } catch (err) { setActionMsg({ error: err.response?.data?.message || 'Mark paid failed' }); }
  };

  const handleUpdateDailySalary = async (employeeId) => {
    const value = parseFloat(editingSalary);
    if (!Number.isFinite(value) || value < 0) {
      setActionMsg({ error: 'Enter a valid daily wage.' }); return;
    }
    try {
      await axios.put(`${API_URL}/api/shop-admin/hr/employees/${employeeId}`,
        { dailySalary: value }, { headers: headers() });
      setActionMsg({ success: 'Daily wage updated.' });
      setEditingEmployee(null); setEditingSalary('');
      fetchEmployees();
    } catch (err) { setActionMsg({ error: err.response?.data?.message || 'Update failed' }); }
  };

  const fmtINR = (n) => `₹${Number(n || 0).toLocaleString()}`;

  const employeeName = (id) => employees.find(e => e.employeeId === id)?.name || id;

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4 rounded-lg mb-4 shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <DollarSign className="h-6 w-6" />
          <h2 className="text-lg font-bold">Salary Management</h2>
        </div>
        <p className="text-green-100 text-xs">Daily wage × present days − late deductions</p>
      </div>

      {actionMsg?.success && (
        <div className="flex items-center gap-2 p-3 mb-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          <CheckCircle className="h-4 w-4 shrink-0" />{actionMsg.success}
        </div>
      )}
      {actionMsg?.error && (
        <div className="flex items-center gap-2 p-3 mb-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />{actionMsg.error}
        </div>
      )}

      {/* Sub Tabs */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { id: 'overview', label: 'Overview', icon: Calendar },
          { id: 'salaries', label: 'Wages',    icon: Users },
          { id: 'records',  label: 'Records',  icon: DollarSign },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSubTab(id)}
            className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
              activeSubTab === id ? 'bg-green-600 text-white border-green-600 shadow-md' : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            <Icon className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Overview ────────────────────────────────────────────────────── */}
      {activeSubTab === 'overview' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Month</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => { setSelectedMonth(e.target.value); setMonthlyDetail(null); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Employee</label>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
              >
                <option value="">— Select Employee —</option>
                {employees.map(e => <option key={e.employeeId} value={e.employeeId}>{e.name}</option>)}
              </select>
            </div>
          </div>

          {loading && (
            <div className="bg-white rounded-lg p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mb-2"></div>
              <p className="text-gray-600 text-sm">Loading…</p>
            </div>
          )}

          {!loading && selectedEmployee && monthlyDetail && (
            <>
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><div className="text-xs text-gray-600 font-medium">Name</div><div className="font-bold text-gray-900">{monthlyDetail.employee?.name}</div></div>
                  <div><div className="text-xs text-gray-600 font-medium">Daily Wage</div><div className="font-bold text-green-600">{fmtINR(monthlyDetail.employee?.dailySalary)}</div></div>
                  <div><div className="text-xs text-gray-600 font-medium">Department</div><div className="font-bold text-gray-900">{monthlyDetail.employee?.department || '—'}</div></div>
                  <div><div className="text-xs text-gray-600 font-medium">Period</div><div className="font-bold text-gray-900">{new Date(`${selectedMonth}-01`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</div></div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-3 bg-gray-50 border-b border-gray-200 font-semibold text-sm text-gray-900">Daily Attendance</div>
                <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                  {monthlyDetail.days.length === 0 ? (
                    <div className="p-6 text-center text-gray-500 text-sm">No attendance for this month</div>
                  ) : monthlyDetail.days.map((d, i) => (
                    <div key={i} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-center w-12">
                          <div className="text-xs text-gray-500">{new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short' })}</div>
                          <div className="text-lg font-bold text-gray-900">{new Date(d.date).getDate()}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-gray-600">{d.date}</div>
                          <div className="flex flex-wrap gap-1">
                            {d.status === 'PRESENT' && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-semibold">Present</span>}
                            {d.status === 'LATE'    && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-semibold">Late {d.lateMinutes || 0}m</span>}
                            {d.status === 'ABSENT'  && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-semibold">Absent</span>}
                            {d.status === 'LEAVE'   && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-semibold">Leave</span>}
                            {d.status === 'HOLIDAY' && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-semibold">Holiday</span>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        {(d.workingHours || 0).toFixed(1)}h
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-300">
                <h4 className="font-semibold text-gray-900 text-sm mb-3">Payment Summary</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-lg p-3 border border-gray-200"><div className="text-xs text-gray-600">Present</div><div className="text-xl font-bold text-green-600">{monthlyDetail.salary?.presentDays ?? monthlyDetail.summary?.presentDays ?? 0}</div></div>
                  <div className="bg-white rounded-lg p-3 border border-gray-200"><div className="text-xs text-gray-600">Absent</div><div className="text-xl font-bold text-red-600">{monthlyDetail.salary?.absentDays ?? monthlyDetail.summary?.absentDays ?? 0}</div></div>
                  <div className="bg-white rounded-lg p-3 border border-gray-200"><div className="text-xs text-gray-600">Late Days</div><div className="text-xl font-bold text-orange-600">{monthlyDetail.salary?.lateDays ?? monthlyDetail.summary?.lateDays ?? 0}</div></div>
                  <div className="bg-white rounded-lg p-3 border border-gray-200"><div className="text-xs text-gray-600">Earned</div><div className="text-xl font-bold text-blue-600">{fmtINR(monthlyDetail.salary?.earnedBase)}</div></div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-gray-200 mt-3">
                  <div className="text-xs text-gray-600 mb-1">Late Deduction</div>
                  <div className="text-xl font-bold text-red-600">−{fmtINR(monthlyDetail.salary?.lateDeduction)}</div>
                </div>
                <div className="bg-green-100 rounded-lg p-4 border-2 border-green-300 mt-3 text-center">
                  <div className="text-xs text-green-700 font-medium mb-1">NET PAYMENT</div>
                  <div className="text-2xl font-bold text-green-700">{fmtINR(monthlyDetail.salary?.netSalary)}</div>
                  {monthlyDetail.salary?.status && (
                    <span className={`mt-2 inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[monthlyDetail.salary.status] || STATUS_BADGE.DRAFT}`}>{monthlyDetail.salary.status}</span>
                  )}
                </div>
                <div className="flex gap-2 mt-3">
                  {!monthlyDetail.salary && (
                    <button onClick={() => handleGenerate(selectedEmployee)} className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1"><Calculator className="h-4 w-4" />Generate</button>
                  )}
                  {monthlyDetail.salary?.status === 'DRAFT' && (
                    <button onClick={() => handleFinalize(selectedEmployee)} className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">Finalize</button>
                  )}
                  {monthlyDetail.salary?.status === 'FINALIZED' && (
                    <button onClick={() => handleMarkPaid(selectedEmployee)} className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">Mark Paid</button>
                  )}
                </div>
              </div>
            </>
          )}

          {!loading && !selectedEmployee && (
            <div className="bg-gray-50 rounded-lg p-8 text-center border-2 border-dashed border-gray-300">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 text-sm">Select an employee to view their monthly attendance</p>
            </div>
          )}
        </div>
      )}

      {/* ── Salaries (daily wage editor) ────────────────────────────────── */}
      {activeSubTab === 'salaries' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <h3 className="font-semibold text-gray-900 text-sm mb-2">Daily Wage Rates</h3>
            <p className="text-xs text-gray-600">Base pay per working day. Salary is calculated as wage × present days, less late-entry deductions.</p>
          </div>

          <div className="space-y-3">
            {employees.map(emp => (
              <div key={emp.employeeId} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 text-sm">{emp.name}</h4>
                    <p className="text-xs text-gray-500">{emp.mobileNumber || emp.employeeId}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Daily Wage:</span>
                    {editingEmployee === emp.employeeId ? (
                      <input
                        type="number"
                        value={editingSalary}
                        onChange={(e) => setEditingSalary(e.target.value)}
                        className="w-32 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                        placeholder="Amount"
                        autoFocus
                      />
                    ) : (
                      <span className="font-semibold text-gray-900">{fmtINR(emp.dailySalary)}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {editingEmployee === emp.employeeId ? (
                      <>
                        <button onClick={() => handleUpdateDailySalary(emp.employeeId)} className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1"><Save className="h-3 w-3" />Save</button>
                        <button onClick={() => { setEditingEmployee(null); setEditingSalary(''); }} className="flex-1 px-3 py-2 bg-gray-300 text-gray-700 rounded-lg text-xs font-medium flex items-center justify-center gap-1"><X className="h-3 w-3" />Cancel</button>
                      </>
                    ) : (
                      <button onClick={() => { setEditingEmployee(emp.employeeId); setEditingSalary(emp.dailySalary || ''); }} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1"><Edit className="h-3 w-3" />Edit Wage</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Records ─────────────────────────────────────────────────────── */}
      {activeSubTab === 'records' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <label className="block text-xs font-medium text-gray-700 mb-2">Month</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
            />
          </div>

          {salarySummary && (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white rounded-lg p-3 border border-gray-200"><div className="text-xs text-gray-600">Employees</div><div className="text-lg font-bold text-gray-900">{salarySummary.totalEmployees}</div></div>
              <div className="bg-white rounded-lg p-3 border border-green-200 bg-green-50"><div className="text-xs text-green-700">Total Earned</div><div className="text-lg font-bold text-green-700">{fmtINR(salarySummary.totalEarned)}</div></div>
              <div className="bg-white rounded-lg p-3 border border-orange-200 bg-orange-50"><div className="text-xs text-orange-700">Late Deductions</div><div className="text-lg font-bold text-orange-700">{fmtINR(salarySummary.totalLateDeduction)}</div></div>
              <div className="bg-white rounded-lg p-3 border border-blue-200 bg-blue-50"><div className="text-xs text-blue-700">Net Payable</div><div className="text-lg font-bold text-blue-700">{fmtINR(salarySummary.totalNetSalary)}</div></div>
            </div>
          )}

          <div className="space-y-3">
            {loading ? (
              <div className="bg-white rounded-lg p-8 text-center text-gray-500 text-sm">Loading…</div>
            ) : salaryRecords.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center text-gray-500 text-sm">No salary records for this month</div>
            ) : salaryRecords.map(rec => {
              const status = rec.status || 'DRAFT';
              return (
                <div key={rec._id || rec.employeeId} className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div
                    onClick={() => setExpandedRecord(expandedRecord === rec.employeeId ? null : rec.employeeId)}
                    className="p-4 cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-gray-900 text-sm">{rec.employee?.name || employeeName(rec.employeeId)}</h4>
                        <p className="text-xs text-gray-500">{rec.month}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-green-600">{fmtINR(rec.netSalary)}</div>
                        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold mt-1 ${STATUS_BADGE[status] || STATUS_BADGE.DRAFT}`}>{status}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>{rec.presentDays || 0} present · {rec.lateDays || 0} late</span>
                      {expandedRecord === rec.employeeId ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>

                  {expandedRecord === rec.employeeId && (
                    <div className="border-t border-gray-200 p-4 space-y-3 bg-gray-50">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div><span className="text-gray-500">Earned:</span><span className="ml-2 font-medium text-gray-900">{fmtINR(rec.earnedBase)}</span></div>
                        <div><span className="text-gray-500">Late Deduction:</span><span className="ml-2 font-medium text-red-600">−{fmtINR(rec.lateDeduction)}</span></div>
                        <div><span className="text-gray-500">Absent Days:</span><span className="ml-2 font-medium text-gray-900">{rec.absentDays || 0}</span></div>
                        <div><span className="text-gray-500">Late Minutes:</span><span className="ml-2 font-medium text-gray-900">{rec.totalLateMinutes || 0}m</span></div>
                      </div>
                      <div className="flex gap-2">
                        {status === 'DRAFT' && <button onClick={() => handleFinalize(rec.employeeId)} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Finalize</button>}
                        {status === 'FINALIZED' && <button onClick={() => handleMarkPaid(rec.employeeId)} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium">Mark Paid</button>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

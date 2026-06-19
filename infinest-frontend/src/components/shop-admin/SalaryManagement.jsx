"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  DollarSign, Calculator, FileText, CheckCircle,
  XCircle, Clock, Users, AlertCircle, RefreshCw,
  Eye
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || "http://localhost:8000";

const STATUS = {
  DRAFT:     { label: "Draft",     color: "bg-gray-100 text-gray-700" },
  FINALIZED: { label: "Finalized", color: "bg-blue-100 text-blue-700" },
  PAID:      { label: "Paid",      color: "bg-green-100 text-green-700" },
};

export default function SalaryManagement({ shopId }) {
  const [activeTab, setActiveTab] = useState("records");
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });
  const [genEmployeeId, setGenEmployeeId] = useState("");
  const [generating, setGenerating] = useState(false);

  const token = () => localStorage.getItem("shopAdminToken");
  const headers = () => ({ Authorization: `Bearer ${token()}` });
  const [month, year] = selectedMonth.split("-").map(Number);

  useEffect(() => { if (shopId) fetchEmployees(); }, [shopId]);
  useEffect(() => { if (shopId && activeTab === "records") fetchSalaryReport(); }, [selectedMonth, shopId, activeTab]);

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/shop-admin/hr/employees`, { headers: headers(), params: { shopId, isActive: true } });
      if (res.data.success) setEmployees(res.data.data || []);
    } catch (_) {}
  };

  const fetchSalaryReport = async () => {
    setLoading(true); setActionMsg(null);
    try {
      const res = await axios.get(`${API_URL}/api/shop-admin/hr/salary/report`, { headers: headers(), params: { shopId, month, year } });
      if (res.data.success) { setRecords(res.data.data || []); setSummary(res.data.summary || null); }
    } catch (_) { setRecords([]); }
    finally { setLoading(false); }
  };

  const handleGenerate = async () => {
    if (!genEmployeeId) return;
    setGenerating(true); setActionMsg(null);
    try {
      const res = await axios.post(`${API_URL}/api/shop-admin/hr/salary/generate`, { employeeId: genEmployeeId, month, year }, { headers: headers() });
      setActionMsg({ success: `Salary generated. Net: ₹${res.data.data?.netSalary?.toLocaleString() || 0}` });
      fetchSalaryReport();
    } catch (err) { setActionMsg({ error: err.response?.data?.message || "Generation failed" }); }
    finally { setGenerating(false); }
  };

  const handleGenerateBulk = async () => {
    setGenerating(true); setActionMsg(null);
    try {
      const res = await axios.post(`${API_URL}/api/shop-admin/hr/salary/generate-bulk`, { shopId, month, year }, { headers: headers() });
      const r = res.data.result;
      setActionMsg({ success: `Bulk generated: ${r.success.length} success, ${r.failed.length} failed` });
      fetchSalaryReport();
    } catch (err) { setActionMsg({ error: err.response?.data?.message || "Bulk generation failed" }); }
    finally { setGenerating(false); }
  };

  const handleFinalize = async (employeeId) => {
    try {
      await axios.patch(`${API_URL}/api/shop-admin/hr/salary/${employeeId}/finalize`, { month, year }, { headers: headers() });
      fetchSalaryReport();
      if (selectedRecord?.employeeId === employeeId) fetchRecord(employeeId);
    } catch (err) { setActionMsg({ error: err.response?.data?.message || "Finalize failed" }); }
  };

  const handleMarkPaid = async (employeeId) => {
    try {
      await axios.patch(`${API_URL}/api/shop-admin/hr/salary/${employeeId}/mark-paid`, { month, year }, { headers: headers() });
      fetchSalaryReport();
      if (selectedRecord?.employeeId === employeeId) fetchRecord(employeeId);
    } catch (err) { setActionMsg({ error: err.response?.data?.message || "Mark paid failed" }); }
  };

  const fetchRecord = async (employeeId) => {
    try {
      const res = await axios.get(`${API_URL}/api/shop-admin/hr/salary/${employeeId}`, { headers: headers(), params: { month, year } });
      if (res.data.success) setSelectedRecord(res.data.data);
    } catch (_) {}
  };

  const TAB = ({ id, label, icon: Icon }) => (
    <button onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab===id?"bg-green-600 text-white":"bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"}`}>
      <Icon className="h-4 w-4"/>{label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-gray-800">Salary Management</h2>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Month</label>
            <input type="month" value={selectedMonth} onChange={(e)=>setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"/>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <TAB id="records" label="Salary Records" icon={FileText}/>
          <TAB id="generate" label="Generate Salary" icon={Calculator}/>
        </div>
      </div>

      {actionMsg?.success && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          <CheckCircle className="h-4 w-4 shrink-0"/>{actionMsg.success}
        </div>
      )}
      {actionMsg?.error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0"/>{actionMsg.error}
        </div>
      )}

      {activeTab==="records" && (
        <div className="space-y-4">
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                {label:"Total Employees", val:summary.totalEmployees, color:"text-gray-700 border-gray-200"},
                {label:"Total Earned", val:`₹${(summary.totalEarned||0).toLocaleString()}`, color:"text-green-700 border-green-200 bg-green-50"},
                {label:"Late Deductions", val:`₹${(summary.totalLateDeduction||0).toLocaleString()}`, color:"text-orange-700 border-orange-200 bg-orange-50"},
                {label:"Total Net Payable", val:`₹${(summary.totalNetSalary||0).toLocaleString()}`, color:"text-blue-700 border-blue-200 bg-blue-50"},
              ].map(({label,val,color})=>(
                <div key={label} className={`rounded-xl border p-4 bg-white ${color}`}>
                  <div className="text-xs font-medium mb-1 opacity-70">{label}</div>
                  <div className="text-2xl font-bold">{val}</div>
                </div>
              ))}
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <span className="text-sm font-semibold text-gray-700">{records.length} records</span>
              <button onClick={fetchSalaryReport} className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50 rounded-lg transition">
                <RefreshCw className="h-3.5 w-3.5"/>Refresh
              </button>
            </div>
            {loading ? (
              <div className="p-12 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"/></div>
            ) : records.length===0 ? (
              <div className="p-12 text-center">
                <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-3"/>
                <p className="text-gray-500 mb-1">No salary records for this month.</p>
                <p className="text-xs text-gray-400">Go to "Generate Salary" to create records.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>{["Employee","Present","Absent","Late","Earned","Late Deduction","Net Pay","Status","Actions"].map(h=>(
                      <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {records.map(rec=>{
                      const st=STATUS[rec.status]||STATUS.DRAFT;
                      return (
                        <tr key={rec._id} className="hover:bg-gray-50 transition">
                          <td className="px-3 py-3"><div className="font-medium text-gray-900">{rec.employee?.name||rec.employeeId}</div><div className="text-xs text-gray-500">{rec.employeeId}</div></td>
                          <td className="px-3 py-3 text-green-700 font-semibold">{rec.presentDays}</td>
                          <td className="px-3 py-3 text-red-700 font-semibold">{rec.absentDays}</td>
                          <td className="px-3 py-3 text-orange-600">{rec.lateDays}</td>
                          <td className="px-3 py-3 text-gray-700">₹{(rec.earnedBase||0).toLocaleString()}</td>
                          <td className="px-3 py-3 text-red-600">−₹{(rec.lateDeduction||0).toLocaleString()}</td>
                          <td className="px-3 py-3 font-bold text-green-700">₹{(rec.netSalary||0).toLocaleString()}</td>
                          <td className="px-3 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.color}`}>{st.label}</span></td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1">
                              <button onClick={()=>fetchRecord(rec.employeeId)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition" title="View slip"><Eye className="h-4 w-4"/></button>
                              {rec.status==="DRAFT" && <button onClick={()=>handleFinalize(rec.employeeId)} className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition">Finalize</button>}
                              {rec.status==="FINALIZED" && <button onClick={()=>handleMarkPaid(rec.employeeId)} className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition">Mark Paid</button>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab==="generate" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2"><Calculator className="h-5 w-5 text-green-600"/>Generate for One Employee</h3>
            <p className="text-sm text-gray-500">Reads attendance for the month and computes salary with all deductions per employee policy.</p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Employee</label>
              <select value={genEmployeeId} onChange={(e)=>setGenEmployeeId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="">— Select Employee —</option>
                {employees.map(e=><option key={e.employeeId} value={e.employeeId}>{e.name} ({e.employeeId})</option>)}
              </select>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
              Month: <span className="font-semibold text-gray-700">{new Date(selectedMonth+"-01").toLocaleString("en-IN",{month:"long",year:"numeric"})}</span>
            </div>
            <button onClick={handleGenerate} disabled={!genEmployeeId||generating}
              className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg font-medium text-sm transition flex items-center justify-center gap-2">
              {generating?<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"/>:<Calculator className="h-4 w-4"/>}
              Calculate & Save
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2"><Users className="h-5 w-5 text-blue-600"/>Bulk Generate (All Employees)</h3>
            <p className="text-sm text-gray-500">Generates salary records for all active employees in one click.</p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
              <p className="font-semibold mb-1">What this does:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Reads each employee's attendance for the month</li>
                <li>Computes net salary with all deductions</li>
                <li>Creates DRAFT records (won't overwrite PAID)</li>
              </ul>
            </div>
            <p className="text-xs text-gray-500">Active employees: <span className="font-semibold text-gray-700">{employees.length}</span></p>
            <button onClick={handleGenerateBulk} disabled={generating||employees.length===0}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-medium text-sm transition flex items-center justify-center gap-2">
              {generating?<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"/>:<Users className="h-4 w-4"/>}
              Generate for All ({employees.length})
            </button>
          </div>
        </div>
      )}

      {selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-white font-bold text-lg">Salary Slip</h3>
              <button onClick={()=>setSelectedRecord(null)} className="text-white hover:bg-white hover:bg-opacity-20 p-1.5 rounded-lg transition"><XCircle className="h-5 w-5"/></button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-xl text-gray-900">{selectedRecord.employee?.name||selectedRecord.employeeId}</div>
                  <div className="text-sm text-gray-500">{selectedRecord.employee?.department} · {selectedRecord.employee?.designation}</div>
                  <div className="text-xs text-gray-400 mt-1">ID: {selectedRecord.employeeId}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">{new Date(selectedRecord.year,selectedRecord.month-1).toLocaleString("en-IN",{month:"long",year:"numeric"})}</div>
                  <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS[selectedRecord.status]?.color}`}>{STATUS[selectedRecord.status]?.label}</span>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-3 gap-3 text-center text-sm">
                <div><div className="text-green-600 font-bold text-xl">{selectedRecord.presentDays}</div><div className="text-gray-500 text-xs">Present</div></div>
                <div><div className="text-red-600 font-bold text-xl">{selectedRecord.absentDays}</div><div className="text-gray-500 text-xs">Absent</div></div>
                <div><div className="text-orange-600 font-bold text-xl">{selectedRecord.lateDays}</div><div className="text-gray-500 text-xs">Late Days</div></div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Earnings</div>
                <div className="space-y-1">
                  {selectedRecord.earnings?.map((e,i)=>(
                    <div key={i} className="flex justify-between text-sm"><span className="text-gray-700">{e.name}</span><span className="font-medium text-green-700">₹{e.amount?.toLocaleString()}</span></div>
                  ))}
                  <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-1 mt-1"><span className="text-gray-800">Total Earnings</span><span className="text-green-700">₹{selectedRecord.totalEarnings?.toLocaleString()}</span></div>
                </div>
              </div>
              {selectedRecord.deductions?.length>0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Deductions</div>
                  <div className="space-y-1">
                    {selectedRecord.deductions?.map((d,i)=>(
                      <div key={i} className="flex justify-between text-sm">
                        <div><span className="text-gray-700">{d.name}</span>{d.reason&&<div className="text-xs text-gray-400">{d.reason}</div>}</div>
                        <span className="font-medium text-red-600">−₹{d.amount?.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-1 mt-1"><span className="text-gray-800">Total Deductions</span><span className="text-red-600">−₹{selectedRecord.totalDeductions?.toLocaleString()}</span></div>
                  </div>
                </div>
              )}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 flex justify-between items-center">
                <span className="font-bold text-gray-800 text-lg">Net Pay</span>
                <span className="font-bold text-green-700 text-2xl">₹{selectedRecord.netSalary?.toLocaleString()}</span>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex gap-2">
              {selectedRecord.status==="DRAFT" && <button onClick={()=>handleFinalize(selectedRecord.employeeId)} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition">Finalize</button>}
              {selectedRecord.status==="FINALIZED" && <button onClick={()=>handleMarkPaid(selectedRecord.employeeId)} className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition">Mark as Paid</button>}
              <button onClick={()=>setSelectedRecord(null)} className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

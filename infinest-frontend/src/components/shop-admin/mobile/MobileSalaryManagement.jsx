"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Users, Calendar, DollarSign, Settings, CheckCircle,
  XCircle, Clock, AlertCircle, ChevronDown, ChevronUp,
  Search, Filter, Download, Edit, Save, X
} from 'lucide-react';
import { getLocalDateString } from '@/lib/utils';

export default function MobileSalaryManagement({ shopId }) {
  const [activeSubTab, setActiveSubTab] = useState('overview');
  const [employees, setEmployees] = useState([]);
  const [salaryRecords, setSalaryRecords] = useState([]);
  const [salaryConfig, setSalaryConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [attendanceData, setAttendanceData] = useState([]);
  const [expandedRecord, setExpandedRecord] = useState(null);
  const [editingConfig, setEditingConfig] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editingSalary, setEditingSalary] = useState('');
  const [configForm, setConfigForm] = useState({
    salary_basis: 'daily_rate',
    hours_per_day: 8
  });

  const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || 'http://localhost:8000';

  useEffect(() => {
    if (shopId) {
      fetchEmployees();
      fetchSalaryConfig();
      const currentMonth = getLocalDateString().slice(0, 7);
      setSelectedMonth(currentMonth);
    }
  }, [shopId]);

  useEffect(() => {
    if (activeSubTab === 'records' && shopId) {
      fetchSalaryRecords();
    } else if (activeSubTab === 'overview' && shopId && selectedEmployee) {
      fetchAttendanceSheet();
    }
  }, [activeSubTab, shopId, selectedMonth, selectedEmployee]);

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('shopAdminToken');
      const response = await axios.get(`${API_URL}/api/shop-admin/employees`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { shop_id: shopId }
      });
      if (response.data.success) {
        setEmployees(response.data.employees);
        if (response.data.employees.length > 0) {
          setSelectedEmployee(response.data.employees[0]._id);
        }
      } else if (response.data.employees) {
        // Handle case where response doesn't have success field
        setEmployees(response.data.employees);
        if (response.data.employees.length > 0) {
          setSelectedEmployee(response.data.employees[0]._id);
        }
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchSalaryConfig = async () => {
    try {
      const token = localStorage.getItem('shopAdminToken');
      const response = await axios.get(`${API_URL}/api/shop-admin/salary/config`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { shop_id: shopId }
      });
      if (response.data.success) {
        setSalaryConfig(response.data.config);
        if (response.data.config) {
          setConfigForm({
            salary_basis: response.data.config.salary_basis,
            hours_per_day: response.data.config.hours_per_day
          });
        }
      }
    } catch (error) {
      console.error('Error fetching config:', error);
    }
  };

  const fetchSalaryRecords = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('shopAdminToken');
      const response = await axios.get(`${API_URL}/api/shop-admin/salary/records`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { 
          shop_id: shopId,
          month: selectedMonth
        }
      });
      if (response.data.success) {
        setSalaryRecords(response.data.records);
      }
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceSheet = async () => {
    if (!selectedEmployee || !selectedMonth) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('shopAdminToken');
      const [year, month] = selectedMonth.split('-');
      const daysInMonth = new Date(year, month, 0).getDate();
      
      const response = await axios.get(`${API_URL}/api/shop-admin/employee-attendance`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { 
          shop_id: shopId,
          employee_id: selectedEmployee,
          from_date: `${selectedMonth}-01`,
          to_date: `${selectedMonth}-${String(daysInMonth).padStart(2, '0')}`
        }
      });
      
      if (response.data.success) {
        // Get employee details
        const employee = employees.find(e => e._id === selectedEmployee);
        
        // Generate daily records
        const dailyRecords = [];
        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
          const attendanceRecord = response.data.attendance.dailyRecords?.find(r => r.date === dateStr);
          const permissionRecord = response.data.attendance.permissions?.find(p => p.date === dateStr);
          
          dailyRecords.push({
            date: dateStr,
            day: day,
            status: attendanceRecord?.status || '-',
            permissionHours: permissionRecord?.duration_hours || 0
          });
        }
        
        // Calculate totals
        const totalPresent = dailyRecords.filter(r => r.status === 'present').length;
        const totalAbsent = dailyRecords.filter(r => r.status === 'absent').length;
        const totalPermissionHours = dailyRecords.reduce((sum, r) => sum + (r.permissionHours || 0), 0);
        
        const baseSalary = totalPresent * (employee?.daily_salary || 0);
        const hourlyRate = (employee?.daily_salary || 0) / (salaryConfig?.hours_per_day || 8);
        const permissionDeduction = totalPermissionHours * hourlyRate * ((salaryConfig?.permission_deduction_percentage || 10) / 100);
        const netSalary = baseSalary - permissionDeduction;
        
        setAttendanceData({
          employee: employee,
          dailyRecords: dailyRecords,
          summary: {
            totalPresent,
            totalAbsent,
            totalPermissionHours: totalPermissionHours.toFixed(2),
            baseSalary: baseSalary.toFixed(2),
            permissionDeduction: permissionDeduction.toFixed(2),
            netSalary: netSalary.toFixed(2)
          }
        });
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setAttendanceData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateSalary = async (employeeId) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('shopAdminToken');
      const response = await axios.post(
        `${API_URL}/api/shop-admin/salary/calculate`,
        {
          shop_id: shopId,
          employee_id: employeeId,
          month: selectedMonth
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        alert('Salary calculated successfully');
        fetchSalaryRecords();
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Error calculating salary');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async (recordId, netSalary) => {
    try {
      const token = localStorage.getItem('shopAdminToken');
      const response = await axios.put(
        `${API_URL}/api/shop-admin/salary/record/${recordId}/payment`,
        { 
          payment_status: 'paid',
          paid_amount: netSalary
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        alert('Salary marked as paid');
        fetchSalaryRecords();
      }
    } catch (error) {
      alert('Error marking salary as paid');
    }
  };

  const handleUpdateEmployeeSalary = async (employeeId) => {
    try {
      const token = localStorage.getItem('shopAdminToken');
      const response = await axios.put(
        `${API_URL}/api/shop-admin/salary/employee/${employeeId}/daily-salary`,
        { 
          daily_salary: parseFloat(editingSalary) 
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        alert('Daily salary updated successfully');
        setEditingEmployee(null);
        setEditingSalary('');
        fetchEmployees();
      }
    } catch (error) {
      alert('Error updating salary');
    }
  };

  const handleSaveConfig = async () => {
    try {
      const token = localStorage.getItem('shopAdminToken');
      const response = await axios.put(
        `${API_URL}/api/shop-admin/salary/config`,
        { shop_id: shopId, ...configForm },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        setSalaryConfig(response.data.config);
        setEditingConfig(false);
        alert('Configuration saved successfully');
      }
    } catch (error) {
      alert('Error saving configuration');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      paid: 'bg-green-100 text-green-700',
      partial: 'bg-yellow-100 text-yellow-700',
      unpaid: 'bg-red-100 text-red-700'
    };
    return badges[status] || badges.unpaid;
  };

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4 rounded-lg mb-4 shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <DollarSign className="h-6 w-6" />
          <h2 className="text-lg font-bold">Salary Management</h2>
        </div>
        <p className="text-green-100 text-xs">Manage employee salaries and attendance</p>
      </div>

      {/* Sub Tabs */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
            activeSubTab === 'overview'
              ? 'bg-green-600 text-white border-green-600 shadow-md'
              : 'bg-white text-gray-600 border-gray-200'
          }`}
        >
          <Calendar className="h-5 w-5 mb-1" />
          <span className="text-xs font-medium">Overview</span>
        </button>
        <button
          onClick={() => setActiveSubTab('salaries')}
          className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
            activeSubTab === 'salaries'
              ? 'bg-green-600 text-white border-green-600 shadow-md'
              : 'bg-white text-gray-600 border-gray-200'
          }`}
        >
          <Users className="h-5 w-5 mb-1" />
          <span className="text-xs font-medium">Salaries</span>
        </button>
        <button
          onClick={() => setActiveSubTab('records')}
          className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
            activeSubTab === 'records'
              ? 'bg-green-600 text-white border-green-600 shadow-md'
              : 'bg-white text-gray-600 border-gray-200'
          }`}
        >
          <DollarSign className="h-5 w-5 mb-1" />
          <span className="text-xs font-medium">Records</span>
        </button>
        <button
          onClick={() => setActiveSubTab('settings')}
          className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
            activeSubTab === 'settings'
              ? 'bg-green-600 text-white border-green-600 shadow-md'
              : 'bg-white text-gray-600 border-gray-200'
          }`}
        >
          <Settings className="h-5 w-5 mb-1" />
          <span className="text-xs font-medium">Settings</span>
        </button>
      </div>

      {/* Overview Tab */}
      {activeSubTab === 'overview' && (
        <div className="space-y-4">
          {/* Month & Employee Filters */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Select Month</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setSelectedEmployee('');
                    setAttendanceData(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Select Employee</label>
                <select
                  value={selectedEmployee}
                  onChange={(e) => {
                    setSelectedEmployee(e.target.value);
                    if (e.target.value) {
                      fetchAttendanceSheet();
                    } else {
                      setAttendanceData(null);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                >
                  <option value="">-- Select Employee --</option>
                  {employees.map(emp => (
                    <option key={emp._id} value={emp._id}>{emp.employee_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loading && (
            <div className="bg-white rounded-lg p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mb-2"></div>
              <p className="text-gray-600 text-sm">Loading...</p>
            </div>
          )}

          {!loading && selectedEmployee && attendanceData && (
            <>
              {/* Employee Info Card */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-600 font-medium">Employee Name</div>
                    <div className="text-sm font-bold text-gray-900">{attendanceData.employee?.employee_name}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 font-medium">Mobile Number</div>
                    <div className="text-sm font-bold text-gray-900">{attendanceData.employee?.mobile_number}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 font-medium">Daily Wage</div>
                    <div className="text-sm font-bold text-green-600">₹{attendanceData.employee?.daily_salary || 0}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 font-medium">Period</div>
                    <div className="text-sm font-bold text-gray-900">
                      {new Date(selectedMonth + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Attendance Sheet */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <h3 className="font-semibold text-gray-900 text-sm">Attendance Sheet</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {attendanceData.dailyRecords && attendanceData.dailyRecords.map((record, index) => (
                    <div 
                      key={index} 
                      className={`p-3 ${
                        record.status === 'present' ? 'bg-green-50/30' : 
                        record.status === 'absent' ? 'bg-red-50/30' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-center">
                            <div className="text-xs text-gray-500">
                              {new Date(record.date).toLocaleDateString('en-IN', { weekday: 'short' })}
                            </div>
                            <div className="text-lg font-bold text-gray-900">
                              {new Date(record.date).getDate()}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {new Date(record.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {record.status === 'present' && (
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  Present
                                </span>
                              )}
                              {record.status === 'absent' && (
                                <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold flex items-center gap-1">
                                  <XCircle className="h-3 w-3" />
                                  Absent
                                </span>
                              )}
                              {record.status === '-' && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-semibold">
                                  No Record
                                </span>
                              )}
                              {record.permissionHours > 0 && (
                                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-semibold flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {record.permissionHours}h
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          {record.status === 'present' ? (
                            <span className="text-sm font-bold text-green-600">₹{attendanceData.employee?.daily_salary || 0}</span>
                          ) : (
                            <span className="text-sm text-gray-400">₹0</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary Section */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-300">
                <h4 className="font-semibold text-gray-900 text-sm mb-3">Payment Summary</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="text-xs text-gray-600">Present Days</div>
                      <div className="text-xl font-bold text-green-600">{attendanceData.summary?.totalPresent || 0}</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="text-xs text-gray-600">Absent Days</div>
                      <div className="text-xl font-bold text-red-600">{attendanceData.summary?.totalAbsent || 0}</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="text-xs text-gray-600">Permission Hours</div>
                      <div className="text-xl font-bold text-orange-600">{attendanceData.summary?.totalPermissionHours || 0}h</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="text-xs text-gray-600">Base Payment</div>
                      <div className="text-xl font-bold text-blue-600">₹{attendanceData.summary?.baseSalary || 0}</div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">Permission Deduction</div>
                    <div className="text-xl font-bold text-red-600">-₹{attendanceData.summary?.permissionDeduction || 0}</div>
                  </div>
                  <div className="bg-green-100 rounded-lg p-4 border-2 border-green-300">
                    <div className="text-center">
                      <div className="text-xs text-green-700 font-medium mb-1">NET PAYMENT</div>
                      <div className="text-2xl font-bold text-green-700">₹{attendanceData.summary?.netSalary || 0}</div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {!loading && !selectedEmployee && (
            <div className="bg-gray-50 rounded-lg p-8 text-center border-2 border-dashed border-gray-300">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 text-sm">Please select an employee to view their attendance sheet</p>
            </div>
          )}
        </div>
      )}

      {/* Employee Salaries Tab */}
      {activeSubTab === 'salaries' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <h3 className="font-semibold text-gray-900 text-sm mb-2">Set Daily Wage Rates</h3>
            <p className="text-xs text-gray-600">Configure daily wage for each employee. This is the base pay per working day.</p>
          </div>

          <div className="space-y-3">
            {employees.map(employee => (
              <div key={employee._id} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 text-sm">{employee.employee_name}</h4>
                    <p className="text-xs text-gray-500">{employee.mobile_number}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Daily Wage:</span>
                    {editingEmployee === employee._id ? (
                      <input
                        type="number"
                        value={editingSalary}
                        onChange={(e) => setEditingSalary(e.target.value)}
                        className="w-32 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                        placeholder="Enter amount"
                        autoFocus
                      />
                    ) : (
                      <span className="font-semibold text-gray-900">₹{employee.daily_salary || 0}</span>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    {editingEmployee === employee._id ? (
                      <>
                        <button
                          onClick={() => handleUpdateEmployeeSalary(employee._id)}
                          className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1"
                        >
                          <Save className="h-3 w-3" />
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingEmployee(null);
                            setEditingSalary('');
                          }}
                          className="flex-1 px-3 py-2 bg-gray-300 text-gray-700 rounded-lg text-xs font-medium flex items-center justify-center gap-1"
                        >
                          <X className="h-3 w-3" />
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingEmployee(employee._id);
                          setEditingSalary(employee.daily_salary || '');
                        }}
                        className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1"
                      >
                        <Edit className="h-3 w-3" />
                        Edit Wage
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Salary Records Tab */}
      {activeSubTab === 'records' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <label className="block text-xs font-medium text-gray-700 mb-2">Filter by Month</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
            />
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="bg-white rounded-lg p-8 text-center text-gray-500 text-sm">Loading...</div>
            ) : salaryRecords.length > 0 ? (
              salaryRecords.map(record => (
                <div key={record._id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div
                    onClick={() => setExpandedRecord(expandedRecord === record._id ? null : record._id)}
                    className="p-4 cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-gray-900 text-sm">
                          {employees.find(e => e._id === record.employee_id)?.name || 'Unknown'}
                        </h4>
                        <p className="text-xs text-gray-500">{record.month}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-green-600">
                          ₹{(record.net_salary || 0).toLocaleString()}
                        </div>
                        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold mt-1 ${getStatusBadge(record.payment_status)}`}>
                          {record.payment_status?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>{record.present_days} days present</span>
                      {expandedRecord === record._id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>

                  {expandedRecord === record._id && (
                    <div className="border-t border-gray-200 p-4 space-y-3 bg-gray-50">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-gray-500">Base Salary:</span>
                          <span className="ml-2 font-medium text-gray-900">₹{record.base_salary}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Deductions:</span>
                          <span className="ml-2 font-medium text-red-600">-₹{record.total_deductions}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Absent Days:</span>
                          <span className="ml-2 font-medium text-gray-900">{record.absent_days}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Permission Hrs:</span>
                          <span className="ml-2 font-medium text-gray-900">{record.total_permission_hours}h</span>
                        </div>
                      </div>
                      {record.payment_status !== 'paid' && (
                        <button
                          onClick={() => handleMarkPaid(record._id, record.net_salary)}
                          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium"
                        >
                          Mark as Paid
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="bg-white rounded-lg p-8 text-center text-gray-500 text-sm">
                No salary records found
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeSubTab === 'settings' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 text-sm">Salary Configuration</h3>
              {!editingConfig ? (
                <button
                  onClick={() => setEditingConfig(true)}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                >
                  <Edit className="h-4 w-4" />
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingConfig(false)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleSaveConfig}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                  >
                    <Save className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Salary Basis</label>
                <select
                  value={configForm.salary_basis}
                  onChange={(e) => setConfigForm({ ...configForm, salary_basis: e.target.value })}
                  disabled={!editingConfig}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white disabled:bg-gray-100"
                >
                  <option value="daily_rate">Daily Rate</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Hours Per Day</label>
                <input
                  type="number"
                  value={configForm.hours_per_day}
                  onChange={(e) => setConfigForm({ ...configForm, hours_per_day: parseInt(e.target.value) })}
                  disabled={!editingConfig}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white disabled:bg-gray-100"
                  min="1"
                  max="24"
                />
                <p className="text-xs text-gray-500 mt-1">Used for permission hour calculations</p>
              </div>
            </div>
          </div>

          {salaryConfig && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-800">
                  <p className="font-medium mb-1">Current Configuration</p>
                  <p>Basis: {salaryConfig.salary_basis}</p>
                  <p>Hours/Day: {salaryConfig.hours_per_day}</p>
                  <p className="mt-2 text-blue-600">Last updated: {new Date(salaryConfig.updated_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

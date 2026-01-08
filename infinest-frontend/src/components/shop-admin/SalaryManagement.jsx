"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  DollarSign,
  Settings,
  Calculator,
  FileText,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  Edit2,
  Save,
  X,
  Users,
} from "lucide-react";

const SalaryManagement = ({ shopId }) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [employees, setEmployees] = useState([]);
  const [salaryConfig, setSalaryConfig] = useState(null);
  const [salaryRecords, setSalaryRecords] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editingSalary, setEditingSalary] = useState("");
  const [editingConfig, setEditingConfig] = useState(false);
  const [configForm, setConfigForm] = useState({
    permission_deduction_percentage: 10,
    hours_per_day: 8,
  });
  // Attendance sheet filters
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [attendanceData, setAttendanceData] = useState(null);

  // Initialize current month
  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    setSelectedMonth(`${year}-${month}`);
  }, []);

  // Fetch salary configuration
  useEffect(() => {
    if (shopId) {
      fetchSalaryConfig();
      fetchEmployees();
    }
  }, [shopId]);

  // Fetch salary records when month changes
  useEffect(() => {
    if (selectedMonth && shopId) {
      fetchSalaryRecords();
    }
  }, [selectedMonth, shopId]);

  const fetchSalaryConfig = async () => {
    try {
      const token = localStorage.getItem("shopAdminToken");
      const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || 'http://localhost:8000';
      const response = await axios.get(
        `${API_URL}/api/shop-admin/salary/config`,
        {
          params: { shop_id: shopId },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.data.success) {
        setSalaryConfig(response.data.config);
        setConfigForm({
          permission_deduction_percentage:
            response.data.config.permission_deduction_percentage,
          hours_per_day: response.data.config.hours_per_day || 8,
        });
      }
    } catch (error) {
      console.error("Error fetching salary config:", error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem("shopAdminToken");
      const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || 'http://localhost:8000';
      const response = await axios.get(
        `${API_URL}/api/shop-admin/employees`,
        {
          params: { shop_id: shopId },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.data.success) {
        setEmployees(response.data.employees);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const fetchSalaryRecords = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("shopAdminToken");
      const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || 'http://localhost:8000';
      const response = await axios.get(
        `${API_URL}/api/shop-admin/salary/records`,
        {
          params: { shop_id: shopId, month: selectedMonth },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.data.success) {
        setSalaryRecords(response.data.records);
      }
    } catch (error) {
      console.error("Error fetching salary records:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceSheet = async (employeeId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("shopAdminToken");
      const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || 'http://localhost:8000';
      
      if (!selectedMonth) return;
      
      const [year, month] = selectedMonth.split('-');
      const daysInMonth = new Date(year, month, 0).getDate();
      
      // Fetch attendance for the month
      const response = await axios.get(
        `${API_URL}/api/shop-admin/employee-attendance`,
        {
          params: { 
            shop_id: shopId, 
            employee_id: employeeId,
            from_date: `${selectedMonth}-01`,
            to_date: `${selectedMonth}-${String(daysInMonth).padStart(2, '0')}`
          },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      if (response.data.success) {
        // Get employee details
        const employee = employees.find(e => e._id === employeeId);
        
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
      console.error("Error fetching attendance sheet:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateConfig = async () => {
    try {
      const token = localStorage.getItem("shopAdminToken");
      const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || 'http://localhost:8000';
      const response = await axios.put(
        `${API_URL}/api/shop-admin/salary/config`,
        {
          shop_id: shopId,
          ...configForm,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.data.success) {
        setSalaryConfig(response.data.config);
        setEditingConfig(false);
        alert("Configuration updated successfully!");
      }
    } catch (error) {
      console.error("Error updating config:", error);
      alert("Failed to update configuration");
    }
  };

  const handleUpdateEmployeeSalary = async (employeeId) => {
    try {
      const token = localStorage.getItem("shopAdminToken");
      const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || 'http://localhost:8000';
      const response = await axios.put(
        `${API_URL}/api/shop-admin/salary/employee/${employeeId}/daily-salary`,
        {
          daily_salary: parseFloat(editingSalary),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.data.success) {
        setEmployees((prev) =>
          prev.map((emp) =>
            emp._id === employeeId
              ? { ...emp, daily_salary: parseFloat(editingSalary) }
              : emp
          )
        );
        setEditingEmployee(null);
        setEditingSalary("");
        alert("Daily salary updated successfully!");
      }
    } catch (error) {
      console.error("Error updating salary:", error);
      alert("Failed to update salary");
    }
  };

  const handleCalculateSalary = async (employeeId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("shopAdminToken");
      const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || 'http://localhost:8000';
      const response = await axios.post(
        `${API_URL}/api/shop-admin/salary/calculate`,
        {
          shop_id: shopId,
          employee_id: employeeId,
          month: selectedMonth,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.data.success) {
        alert(`Salary calculated successfully! Net: ₹${response.data.calculation.netSalary}`);
        fetchSalaryRecords();
      }
    } catch (error) {
      console.error("Error calculating salary:", error);
      alert(error.response?.data?.message || "Failed to calculate salary");
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateAllSalaries = async () => {
    if (!confirm("Calculate salaries for all employees this month?")) return;

    try {
      setLoading(true);
      const token = localStorage.getItem("shopAdminToken");
      const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || 'http://localhost:8000';
      const response = await axios.post(
        `${API_URL}/api/shop-admin/salary/calculate-all`,
        {
          shop_id: shopId,
          month: selectedMonth,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.data.success) {
        alert(response.data.message);
        fetchSalaryRecords();
      }
    } catch (error) {
      console.error("Error calculating salaries:", error);
      alert("Failed to calculate salaries");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePaymentStatus = async (recordId, status, paidAmount) => {
    try {
      const token = localStorage.getItem("shopAdminToken");
      const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || 'http://localhost:8000';
      const response = await axios.put(
        `${API_URL}/api/shop-admin/salary/record/${recordId}/payment`,
        {
          payment_status: status,
          paid_amount: paidAmount,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.data.success) {
        fetchSalaryRecords();
        alert("Payment status updated!");
      }
    } catch (error) {
      console.error("Error updating payment:", error);
      alert("Failed to update payment");
    }
  };

  const getPaymentStatusBadge = (status) => {
    const styles = {
      paid: "bg-green-100 text-green-800 border-green-200",
      partial: "bg-yellow-100 text-yellow-800 border-yellow-200",
      unpaid: "bg-red-100 text-red-800 border-red-200",
    };
    const icons = {
      paid: <CheckCircle className="w-3 h-3" />,
      partial: <Clock className="w-3 h-3" />,
      unpaid: <XCircle className="w-3 h-3" />,
    };
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${styles[status]}`}
      >
        {icons[status]}
        {status.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="w-full bg-white rounded-lg shadow-md">
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-blue-600" />
          Salary Management
        </h2>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4 px-6">
          {[
            { id: "overview", label: "Overview", icon: FileText },
            { id: "employees", label: "Employee Salaries", icon: DollarSign },
            { id: "records", label: "Salary Records", icon: Calculator },
            { id: "settings", label: "Settings", icon: Settings },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                activeTab === tab.id
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Overview Tab - Attendance Sheet */}
        {activeTab === "overview" && (
          <div>
            <div className="mb-6 flex items-center gap-4 flex-wrap">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Month
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setSelectedEmployee("");
                    setAttendanceData(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Employee
                </label>
                <select
                  value={selectedEmployee}
                  onChange={(e) => {
                    setSelectedEmployee(e.target.value);
                    if (e.target.value) {
                      fetchAttendanceSheet(e.target.value);
                    } else {
                      setAttendanceData(null);
                    }
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white min-w-[200px]"
                >
                  <option value="">-- Select Employee --</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.employee_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1"></div>
              
              <button
                onClick={handleCalculateAllSalaries}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                <Calculator className="w-4 h-4" />
                Calculate All Salaries
              </button>
            </div>

            {loading && (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="text-gray-600 mt-2">Loading...</p>
              </div>
            )}

            {!loading && selectedEmployee && attendanceData && (
              <div>
                {/* Employee Info Header */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-6 border border-blue-200">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-gray-600 font-medium">Employee Name</div>
                      <div className="text-lg font-bold text-gray-900">{attendanceData.employee?.employee_name}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 font-medium">Mobile Number</div>
                      <div className="text-lg font-bold text-gray-900">{attendanceData.employee?.mobile_number}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 font-medium">Daily Wage</div>
                      <div className="text-lg font-bold text-green-600">₹{attendanceData.employee?.daily_salary || 0}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 font-medium">Period</div>
                      <div className="text-lg font-bold text-gray-900">
                        {new Date(selectedMonth + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Attendance Sheet Table */}
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Day</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Status</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Permission (Hrs)</th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Wage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {attendanceData.dailyRecords.map((record, idx) => (
                          <tr key={idx} className={`hover:bg-gray-50 ${record.status === 'present' ? 'bg-green-50/30' : record.status === 'absent' ? 'bg-red-50/30' : ''}`}>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {new Date(record.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {new Date(record.date).toLocaleDateString('en-IN', { weekday: 'short' })}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {record.status === 'present' && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Present
                                </span>
                              )}
                              {record.status === 'absent' && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Absent
                                </span>
                              )}
                              {record.status === '-' && (
                                <span className="text-gray-400 text-sm">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {record.permissionHours > 0 ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {record.permissionHours}h
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-medium">
                              {record.status === 'present' ? (
                                <span className="text-green-600">₹{attendanceData.employee?.daily_salary || 0}</span>
                              ) : (
                                <span className="text-gray-400">₹0</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Summary Section */}
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-6 border border-gray-300">
                  <h4 className="text-lg font-bold text-gray-800 mb-4">Payment Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Total Present Days:</span>
                          <span className="text-lg font-bold text-green-600">{attendanceData.summary.totalPresent}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Total Absent Days:</span>
                          <span className="text-lg font-bold text-red-600">{attendanceData.summary.totalAbsent}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Permission Hours:</span>
                          <span className="text-lg font-bold text-orange-600">{attendanceData.summary.totalPermissionHours}h</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Base Payment:</span>
                          <span className="text-lg font-bold text-blue-600">₹{attendanceData.summary.baseSalary}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Permission Deduction:</span>
                          <span className="text-lg font-bold text-red-600">-₹{attendanceData.summary.permissionDeduction}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-green-100 rounded-lg p-4 border-2 border-green-300">
                      <div className="text-center">
                        <div className="text-sm text-green-700 font-medium mb-1">NET PAYMENT</div>
                        <div className="text-3xl font-bold text-green-700">₹{attendanceData.summary.netSalary}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!loading && !selectedEmployee && (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 text-lg">Please select an employee to view their attendance sheet</p>
              </div>
            )}
          </div>
        )}

        {/* Employee Salaries Tab */}
        {activeTab === "employees" && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Set Daily Wage Rates
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Configure daily wage for each employee. This is the base pay per working day.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Employee Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Mobile
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Daily Wage (₹/day)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {employees.map((employee) => (
                    <tr key={employee._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {employee.employee_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {employee.mobile_number}
                      </td>
                      <td className="px-4 py-3">
                        {editingEmployee === employee._id ? (
                          <input
                            type="number"
                            value={editingSalary}
                            onChange={(e) => setEditingSalary(e.target.value)}
                            className="w-32 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                            placeholder="Enter amount"
                            autoFocus
                          />
                        ) : (
                          <span className="font-semibold text-gray-900">
                            ₹{employee.daily_salary || 0}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingEmployee === employee._id ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                handleUpdateEmployeeSalary(employee._id)
                              }
                              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
                            >
                              <Save className="w-3 h-3" />
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingEmployee(null);
                                setEditingSalary("");
                              }}
                              className="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 flex items-center gap-1"
                            >
                              <X className="w-3 h-3" />
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingEmployee(employee._id);
                              setEditingSalary(employee.daily_salary || "");
                            }}
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                          >
                            <Edit2 className="w-3 h-3" />
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Salary Records Tab */}
        {activeTab === "records" && (
          <div>
            <div className="mb-6 flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filter by Month
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Employee
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Attendance
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Permission Hrs
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Base Salary
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Deductions
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Net Salary
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Payment Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {salaryRecords.map((record) => (
                    <tr key={record._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {record.employee_id?.employee_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          Daily: ₹{record.daily_salary_rate}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="text-green-600 font-medium">
                          {record.present_days} Present
                        </div>
                        <div className="text-red-600 text-xs">
                          {record.absent_days} Absent
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {record.total_permission_hours.toFixed(1)} hrs
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        ₹{record.base_salary.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-red-600 font-medium">
                        -₹{record.total_deductions.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-green-600">
                        ₹{record.net_salary.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        {getPaymentStatusBadge(record.payment_status)}
                      </td>
                      <td className="px-4 py-3">
                        {record.payment_status !== "paid" && (
                          <button
                            onClick={() =>
                              handleUpdatePaymentStatus(
                                record._id,
                                "paid",
                                record.net_salary
                              )
                            }
                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs flex items-center gap-1"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Mark Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Daily Wage Configuration
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Configure settings for daily wage calculations and permission hour deductions
            </p>
            <div className="max-w-2xl">
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Permission Deduction Percentage (%)
                  </label>
                  {editingConfig ? (
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={configForm.permission_deduction_percentage}
                      onChange={(e) =>
                        setConfigForm({
                          ...configForm,
                          permission_deduction_percentage: parseFloat(
                            e.target.value
                          ),
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  ) : (
                    <div className="text-2xl font-bold text-blue-600">
                      {salaryConfig?.permission_deduction_percentage || 0}%
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Percentage of hourly salary to deduct for permission hours
                  </p>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hours Per Day
                  </label>
                  {editingConfig ? (
                    <input
                      type="number"
                      min="6"
                      max="12"
                      step="0.5"
                      value={configForm.hours_per_day}
                      onChange={(e) =>
                        setConfigForm({
                          ...configForm,
                          hours_per_day: parseFloat(e.target.value),
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  ) : (
                    <div className="text-2xl font-bold text-blue-600">
                      {salaryConfig?.hours_per_day || 8} hours
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Standard working hours per day (used for hourly rate calculation)
                  </p>
                </div>

                <div className="flex gap-2">
                  {editingConfig ? (
                    <>
                      <button
                        onClick={handleUpdateConfig}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        Save Changes
                      </button>
                      <button
                        onClick={() => {
                          setEditingConfig(false);
                          setConfigForm({
                            permission_deduction_percentage:
                              salaryConfig?.permission_deduction_percentage || 10,
                          hours_per_day:
                            salaryConfig?.hours_per_day || 8,
                          });
                        }}
                        className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 flex items-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setEditingConfig(true)}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit Configuration
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-2">
                  💡 Daily Wage Calculation Method
                </h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• <strong>Daily Wage System:</strong> Employees are paid based on daily rates</li>
                  <li>• Base Payment = Days Worked × Daily Wage Rate</li>
                  <li>
                    • Hourly Rate = Daily Wage ÷ Hours Per Day ({salaryConfig?.hours_per_day || 8} hours)
                  </li>
                  <li>
                    • Permission Deduction = Permission Hours × Hourly Rate ×
                    (Deduction % ÷ 100)
                  </li>
                  <li>• Net Payment = Base Payment - Total Deductions</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalaryManagement;

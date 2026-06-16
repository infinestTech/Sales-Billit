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
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Calendar,
} from "lucide-react";

const MobileSalaryManagement = ({ shopId }) => {
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
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [attendanceData, setAttendanceData] = useState(null);
  const [expandedRecord, setExpandedRecord] = useState(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || 'http://localhost:8000';

  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    setSelectedMonth(`${year}-${month}`);
  }, []);

  useEffect(() => {
    if (shopId) {
      fetchSalaryConfig();
      fetchEmployees();
    }
  }, [shopId]);

  useEffect(() => {
    if (selectedMonth && shopId) {
      fetchSalaryRecords();
    }
  }, [selectedMonth, shopId]);

  const fetchSalaryConfig = async () => {
    try {
      const token = localStorage.getItem("shopAdminToken");
      const response = await axios.get(`${API_URL}/api/shop-admin/salary/config`, {
        params: { shop_id: shopId },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setSalaryConfig(response.data.config);
        setConfigForm({
          permission_deduction_percentage: response.data.config.permission_deduction_percentage,
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
      const response = await axios.get(`${API_URL}/api/shop-admin/employees`, {
        params: { shop_id: shopId },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setEmployees(response.data.employees);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const fetchSalaryRecords = async () => {
    try {
      const token = localStorage.getItem("shopAdminToken");
      const response = await axios.get(`${API_URL}/api/shop-admin/salary/records`, {
        params: { shop_id: shopId, month: selectedMonth },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setSalaryRecords(response.data.records);
      }
    } catch (error) {
      console.error("Error fetching salary records:", error);
    }
  };

  const fetchAttendanceSheet = async () => {
    if (!selectedEmployee || !selectedMonth) return;

    try {
      setLoading(true);
      const token = localStorage.getItem("shopAdminToken");
      const [year, month] = selectedMonth.split("-");
      const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
      const firstDay = `${year}-${month}-01`;
      const lastDay = `${year}-${month}-${String(daysInMonth).padStart(2, "0")}`;

      const response = await axios.get(`${API_URL}/api/shop-admin/employees/attendance`, {
        params: {
          shop_id: shopId,
          employee_id: selectedEmployee,
          from_date: firstDay,
          to_date: lastDay,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setAttendanceData(response.data);
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedEmployee && selectedMonth && activeTab === "overview") {
      fetchAttendanceSheet();
    }
  }, [selectedEmployee, selectedMonth, activeTab]);

  const handleCalculateSalary = async (employeeId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("shopAdminToken");
      const response = await axios.post(
        `${API_URL}/api/shop-admin/salary/calculate`,
        { shop_id: shopId, employee_id: employeeId, month: selectedMonth },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert("Salary calculated successfully!");
        fetchSalaryRecords();
      }
    } catch (error) {
      console.error("Error calculating salary:", error);
      alert(error.response?.data?.message || "Error calculating salary");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async (recordId, paidAmount) => {
    try {
      const token = localStorage.getItem("shopAdminToken");
      const response = await axios.put(
        `${API_URL}/api/shop-admin/salary/records/${recordId}/pay`,
        { paid_amount: paidAmount, payment_method: "cash" },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert("Salary marked as paid!");
        fetchSalaryRecords();
      }
    } catch (error) {
      console.error("Error marking salary as paid:", error);
      alert("Error marking salary as paid");
    }
  };

  const handleUpdateSalary = async (employeeId, newSalary) => {
    try {
      const token = localStorage.getItem("shopAdminToken");
      const response = await axios.put(
        `${API_URL}/api/shop-admin/employees/${employeeId}`,
        { daily_salary: parseFloat(newSalary) },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert("Salary updated successfully!");
        fetchEmployees();
        setEditingEmployee(null);
      }
    } catch (error) {
      console.error("Error updating salary:", error);
      alert("Error updating salary");
    }
  };

  const handleUpdateConfig = async () => {
    try {
      const token = localStorage.getItem("shopAdminToken");
      const response = await axios.post(
        `${API_URL}/api/shop-admin/salary/config`,
        {
          shop_id: shopId,
          permission_deduction_percentage: parseFloat(configForm.permission_deduction_percentage),
          hours_per_day: parseFloat(configForm.hours_per_day),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert("Configuration updated successfully!");
        fetchSalaryConfig();
        setEditingConfig(false);
      }
    } catch (error) {
      console.error("Error updating config:", error);
      alert("Error updating configuration");
    }
  };

  const getPaymentStatusBadge = (status) => {
    const styles = {
      paid: "bg-green-100 text-green-700",
      partial: "bg-yellow-100 text-yellow-700",
      unpaid: "bg-red-100 text-red-700",
    };
    const icons = {
      paid: <CheckCircle className="h-3 w-3" />,
      partial: <Clock className="h-3 w-3" />,
      unpaid: <XCircle className="h-3 w-3" />,
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {icons[status]}
        {status.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-500 p-4 rounded-t-xl">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Salary Management
        </h2>
        <p className="text-green-50 text-xs mt-1">Manage employee salaries and payroll</p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {[
            { id: "overview", label: "Overview", icon: FileText },
            { id: "employees", label: "Employees", icon: Users },
            { id: "records", label: "Records", icon: Calculator },
            { id: "settings", label: "Settings", icon: Settings },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-green-600 text-green-600"
                  : "border-transparent text-gray-600"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-b-xl">
        {/* Overview Tab - Attendance Sheet */}
        {activeTab === "overview" && (
          <div className="p-4 space-y-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Select Employee
                </label>
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                >
                  <option value="">Choose an employee</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.name} - ₹{emp.daily_salary}/day
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Select Month
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                />
              </div>
            </div>

            {attendanceData && (
              <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-white rounded-lg p-2 text-center">
                    <div className="text-gray-600">Present</div>
                    <div className="text-lg font-bold text-green-600">
                      {attendanceData.summary?.presentDays || 0}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-2 text-center">
                    <div className="text-gray-600">Absent</div>
                    <div className="text-lg font-bold text-red-600">
                      {attendanceData.summary?.absentDays || 0}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-2 text-center">
                    <div className="text-gray-600">Rate</div>
                    <div className="text-lg font-bold text-blue-600">
                      {attendanceData.summary?.attendanceRate || 0}%
                    </div>
                  </div>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {attendanceData.dailyRecords?.map((record) => (
                    <div
                      key={record.date}
                      className="bg-white rounded-lg p-3 flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">{record.date}</div>
                        <div className="text-xs text-gray-500">{record.dayOfWeek}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {record.status === "present" ? (
                          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium">
                            Present
                          </span>
                        ) : (
                          <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-medium">
                            Absent
                          </span>
                        )}
                        {record.permissionHours > 0 && (
                          <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-semibold">
                            {record.permissionHours}h
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!selectedEmployee && (
              <div className="text-center py-8 text-gray-500 text-sm">
                <Users className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                Select an employee to view attendance
              </div>
            )}
          </div>
        )}

        {/* Employee Salaries Tab */}
        {activeTab === "employees" && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">Employee List</h3>
              <span className="text-xs text-gray-600">{employees.length} employees</span>
            </div>

            <div className="space-y-2">
              {employees.map((emp) => (
                <div key={emp._id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 text-sm">{emp.name}</div>
                      <div className="text-xs text-gray-600">{emp.phone || "N/A"}</div>
                    </div>
                    {editingEmployee === emp._id ? (
                      <button
                        onClick={() => handleUpdateSalary(emp._id, editingSalary)}
                        className="p-1.5 bg-green-600 text-white rounded-lg"
                      >
                        <Save className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingEmployee(emp._id);
                          setEditingSalary(emp.daily_salary);
                        }}
                        className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {editingEmployee === emp._id ? (
                    <div className="space-y-2">
                      <input
                        type="number"
                        value={editingSalary}
                        onChange={(e) => setEditingSalary(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                        placeholder="Daily Salary"
                      />
                      <button
                        onClick={() => setEditingEmployee(null)}
                        className="w-full py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-gray-600">Daily Wage</div>
                        <div className="text-lg font-bold text-green-600">₹{emp.daily_salary}</div>
                      </div>
                      <button
                        onClick={() => handleCalculateSalary(emp._id)}
                        disabled={loading}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:bg-gray-400"
                      >
                        Calculate
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Salary Records Tab */}
        {activeTab === "records" && (
          <div className="p-4 space-y-3">
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">Filter by Month</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
              />
            </div>

            <div className="space-y-2">
              {salaryRecords.map((record) => {
                const employee = employees.find((e) => e._id === record.employee_id);
                const isExpanded = expandedRecord === record._id;

                return (
                  <div key={record._id} className="bg-gray-50 rounded-lg overflow-hidden">
                    <div
                      onClick={() => setExpandedRecord(isExpanded ? null : record._id)}
                      className="p-3 cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 text-sm">
                            {employee?.name || "Unknown"}
                          </div>
                          <div className="text-xs text-gray-600">{record.month}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getPaymentStatusBadge(record.payment_status)}
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-600">Net Salary:</span>
                          <span className="font-bold text-green-600 ml-1">₹{record.net_salary}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Paid:</span>
                          <span className="font-bold text-blue-600 ml-1">₹{record.paid_amount}</span>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-2 border-t border-gray-200 pt-2">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-white rounded p-2">
                            <div className="text-gray-600">Present Days</div>
                            <div className="font-bold text-green-600">{record.present_days}</div>
                          </div>
                          <div className="bg-white rounded p-2">
                            <div className="text-gray-600">Absent Days</div>
                            <div className="font-bold text-red-600">{record.absent_days}</div>
                          </div>
                          <div className="bg-white rounded p-2">
                            <div className="text-gray-600">Base Salary</div>
                            <div className="font-bold text-gray-900">₹{record.base_salary}</div>
                          </div>
                          <div className="bg-white rounded p-2">
                            <div className="text-gray-600">Deductions</div>
                            <div className="font-bold text-orange-600">₹{record.total_deductions}</div>
                          </div>
                        </div>

                        {record.payment_status !== "paid" && (
                          <button
                            onClick={() => handleMarkPaid(record._id, record.net_salary)}
                            className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium"
                          >
                            Mark as Paid
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {salaryRecords.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">
                <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                No salary records for this month
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="p-4 space-y-4">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900">
                  <p className="font-medium mb-1">Salary Configuration</p>
                  <p>These settings affect how salaries are calculated for all employees.</p>
                </div>
              </div>
            </div>

            {salaryConfig && (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Permission Deduction %
                    </label>
                    <input
                      type="number"
                      value={configForm.permission_deduction_percentage}
                      onChange={(e) =>
                        setConfigForm({
                          ...configForm,
                          permission_deduction_percentage: e.target.value,
                        })
                      }
                      disabled={!editingConfig}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white disabled:bg-gray-100"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Percentage deducted per permission hour
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Hours Per Day
                    </label>
                    <input
                      type="number"
                      value={configForm.hours_per_day}
                      onChange={(e) =>
                        setConfigForm({ ...configForm, hours_per_day: e.target.value })
                      }
                      disabled={!editingConfig}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white disabled:bg-gray-100"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Standard working hours per day
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  {editingConfig ? (
                    <>
                      <button
                        onClick={handleUpdateConfig}
                        className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={() => {
                          setEditingConfig(false);
                          setConfigForm({
                            permission_deduction_percentage:
                              salaryConfig.permission_deduction_percentage,
                            hours_per_day: salaryConfig.hours_per_day || 8,
                          });
                        }}
                        className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setEditingConfig(true)}
                      className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
                    >
                      Edit Configuration
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileSalaryManagement;

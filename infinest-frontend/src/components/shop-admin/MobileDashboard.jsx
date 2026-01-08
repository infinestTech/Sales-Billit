"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Users, Phone, Calendar, Filter, Search, ChevronDown,
  TrendingUp, Package, Wrench, DollarSign, CheckCircle,
  XCircle, Truck, AlertCircle, Menu, X, Home,
  BarChart3, FileText, LogOut, ChevronLeft, ChevronRight, Wallet
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import MobileSalaryManagement from './mobile/MobileSalaryManagement';

export default function MobileDashboard({
  shopAdmin,
  shops,
  currentShopId,
  setCurrentShopId,
  overview,
  employees,
  analytics,
  customerDetails,
  filteredCustomers,
  setFilteredCustomers,
  selectedEmployee,
  setSelectedEmployee,
  employeeAttendance,
  reportData,
  loading,
  fetchDashboardData,
  fetchEmployeeAttendance,
  fetchFinancialReport,
  handleLogout,
  handleSwitchShop
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showShopSelector, setShowShopSelector] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null);
  const [localEmployeeAttendance, setLocalEmployeeAttendance] = useState(null);

  // Customer filters
  const [customerFilters, setCustomerFilters] = useState({
    name: '',
    mobileNumber: '',
    billNumber: '',
    fromDate: '',
    toDate: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);

  // Employee filters
  const [attendanceFilters, setAttendanceFilters] = useState({
    fromDate: '',
    toDate: ''
  });

  // Revenue filters
  const [revenueFilters, setRevenueFilters] = useState({
    period: '1',
    fromDate: '',
    toDate: ''
  });

  // Report filters
  const [reportFilters, setReportFilters] = useState({
    period: '1',
    fromDate: '',
    toDate: ''
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [localAnalytics, setLocalAnalytics] = useState(null);
  const [localReportData, setLocalReportData] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || 'http://localhost:8000';

  // Fetch analytics for revenue tab
  const fetchLocalAnalytics = async () => {
    if (!currentShopId) return;
    
    try {
      const token = localStorage.getItem('shopAdminToken');
      if (!token) return;

      const authConfig = {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { shop_id: currentShopId }
      };

      // Build query params for revenue based on filters
      let revenueQuery = `period=${revenueFilters.period}`;
      if (revenueFilters.fromDate && revenueFilters.toDate) {
        revenueQuery = `fromDate=${revenueFilters.fromDate}&toDate=${revenueFilters.toDate}`;
      }

      const [revenueRes] = await Promise.all([
        axios.get(`${API_URL}/api/shop-admin/analytics/revenue?${revenueQuery}`, authConfig).catch(err => ({ data: { revenue: null } }))
      ]);

      const revenueData = revenueRes.data.analytics || {};

      // Calculate revenue by date
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const revenueByDate = {};
      const countByDate = {};
      const supplierPaymentsByDate = {};
      const operatingExpensesByDate = {};
      const dailyWageExpensesByDate = {};
      
      (revenueData.mobileRevenue || []).forEach(item => {
        const date = item._id?.date || item.date;
        if (date) {
          revenueByDate[date] = (revenueByDate[date] || 0) + (item.revenue || 0);
          countByDate[date] = (countByDate[date] || 0) + (item.count || 1);
        }
      });
      (revenueData.salesRevenue || []).forEach(item => {
        const date = item._id?.date || item.date;
        if (date) {
          revenueByDate[date] = (revenueByDate[date] || 0) + (item.revenue || 0);
          countByDate[date] = (countByDate[date] || 0) + (item.count || 1);
        }
      });
      
      (revenueData.supplierPayments || []).forEach(item => {
        const date = item._id?.date || item.date;
        if (date) {
          supplierPaymentsByDate[date] = (supplierPaymentsByDate[date] || 0) + (item.amount || 0);
        }
      });
      
      (revenueData.operatingExpenses || []).forEach(item => {
        const date = item._id?.date || item.date;
        if (date) {
          operatingExpensesByDate[date] = (operatingExpensesByDate[date] || 0) + (item.amount || 0);
        }
      });
      
      (revenueData.dailyWageExpenses || []).forEach(item => {
        const date = item._id?.date || item.date;
        if (date) {
          dailyWageExpensesByDate[date] = (dailyWageExpensesByDate[date] || 0) + (item.amount || 0);
        }
      });

      const todayRevenue = revenueByDate[today] || 0;
      const weekRevenue = Object.entries(revenueByDate)
        .filter(([date]) => date >= weekAgo)
        .reduce((sum, [, amount]) => sum + amount, 0);
      const monthRevenue = Object.entries(revenueByDate)
        .filter(([date]) => date >= monthAgo)
        .reduce((sum, [, amount]) => sum + amount, 0);

      // Generate dates for chart
      let startDateForChart, endDateForChart;
      
      if (revenueFilters.fromDate && revenueFilters.toDate) {
        const [startY, startM, startD] = revenueFilters.fromDate.split('-').map(Number);
        const [endY, endM, endD] = revenueFilters.toDate.split('-').map(Number);
        startDateForChart = new Date(startY, startM - 1, startD, 0, 0, 0);
        endDateForChart = new Date(endY, endM - 1, endD, 23, 59, 59);
      } else {
        const now = new Date();
        const period = parseInt(revenueFilters.period || 1);
        endDateForChart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        startDateForChart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        if (period > 1) {
          startDateForChart.setDate(startDateForChart.getDate() - (period - 1));
        }
      }
      
      const dailyData = [];
      const currentDate = new Date(startDateForChart);
      
      while (currentDate <= endDateForChart) {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        const revenue = Math.round(revenueByDate[dateStr] || 0);
        const supplierPayments = Math.round(supplierPaymentsByDate[dateStr] || 0);
        const operatingExpenses = Math.round(operatingExpensesByDate[dateStr] || 0);
        const dailyWageExpenses = Math.round(dailyWageExpensesByDate[dateStr] || 0);
        const totalExpenses = supplierPayments + operatingExpenses + dailyWageExpenses;
        const netProfit = revenue - totalExpenses;
        
        dailyData.push({
          date: dateStr,
          revenue,
          supplierPayments,
          operatingExpenses,
          dailyWageExpenses,
          netProfit,
          count: countByDate[dateStr] || 0
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }

      setLocalAnalytics({
        revenue: {
          today: todayRevenue,
          thisWeek: weekRevenue,
          thisMonth: monthRevenue,
          dailyData,
          total: revenueData.totalRevenue || 0,
          totalExpenses: revenueData.totalExpenses || 0,
          totalSupplierPayments: revenueData.totalSupplierPayments || 0,
          totalOperatingExpenses: revenueData.totalOperatingExpenses || 0,
          totalDailyWageExpenses: revenueData.totalDailyWageExpenses || 0,
          netProfit: revenueData.netProfit || 0
        }
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  // Fetch financial report
  const fetchLocalFinancialReport = async () => {
    if (!currentShopId) return;
    
    setLoadingReport(true);
    try {
      const token = localStorage.getItem('shopAdminToken');
      if (!token) return;

      const authConfig = {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { shop_id: currentShopId }
      };

      let query = `period=${reportFilters.period}`;
      if (reportFilters.fromDate && reportFilters.toDate) {
        query = `fromDate=${reportFilters.fromDate}&toDate=${reportFilters.toDate}`;
      }

      const response = await axios.get(`${API_URL}/api/shop-admin/reports/financial?${query}`, authConfig);
      
      if (response.data.success) {
        setLocalReportData(response.data.report);
      }
    } catch (error) {
      console.error('Error fetching financial report:', error);
    } finally {
      setLoadingReport(false);
    }
  };

  // Handle print report - creates a printable PDF window
  const handlePrintReport = () => {
    const reportToUse = localReportData || reportData;
    if (!reportToUse) return;
    
    const printWindow = window.open('', '_blank');
    const currentShop = shops.find(s => s.id === currentShopId);
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Financial Report - ${currentShop?.name || 'Shop'}</title>
        <style>
          @page { size: A4; margin: 1.5cm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #000; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; }
          .header h1 { font-size: 24px; margin-bottom: 8px; }
          .header h2 { font-size: 18px; margin-bottom: 4px; }
          .header p { font-size: 11px; color: #555; }
          .section { margin-bottom: 25px; }
          .section-title { font-size: 14px; font-weight: bold; background: #f0f0f0; padding: 8px; margin-bottom: 10px; border-left: 4px solid #16a34a; }
          .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
          .summary-box { border: 1px solid #ddd; padding: 10px; text-align: center; }
          .summary-box .label { font-size: 10px; color: #666; margin-bottom: 4px; }
          .summary-box .value { font-size: 16px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
          th { background: #f5f5f5; border: 1px solid #000; padding: 8px; text-align: left; font-weight: bold; font-size: 11px; }
          td { border: 1px solid #ddd; padding: 6px 8px; font-size: 11px; }
          tr:nth-child(even) { background: #fafafa; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          tfoot td { font-weight: bold; background: #f0f0f0; border-top: 2px solid #000; }
          .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #666; border-top: 1px solid #ddd; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>FINANCIAL REPORT</h1>
          <h2>${currentShop?.name || 'Shop Name'}</h2>
          <p>${currentShop?.location || 'Location'}</p>
          <p style="margin-top: 10px;">
            <strong>Report Period:</strong> ${reportToUse.periodStart} to ${reportToUse.periodEnd}<br/>
            <strong>Generated On:</strong> ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>

        <div class="section">
          <div class="section-title">FINANCIAL SUMMARY</div>
          <div class="summary-grid">
            <div class="summary-box">
              <div class="label">Total Revenue</div>
              <div class="value" style="color: #16a34a;">₹${reportToUse.summary?.totalRevenue?.toLocaleString() || 0}</div>
            </div>
            <div class="summary-box">
              <div class="label">Total Expenses</div>
              <div class="value" style="color: #dc2626;">₹${reportToUse.summary?.totalExpenses?.toLocaleString() || 0}</div>
            </div>
            <div class="summary-box">
              <div class="label">Net Profit</div>
              <div class="value" style="color: #2563eb;">₹${reportToUse.summary?.netProfit?.toLocaleString() || 0}</div>
            </div>
            <div class="summary-box">
              <div class="label">Profit Margin</div>
              <div class="value" style="color: #7c3aed;">${reportToUse.summary?.profitMargin?.toFixed(1) || 0}%</div>
            </div>
          </div>
        </div>

        ${reportToUse.customerPayments && reportToUse.customerPayments.length > 0 ? `
        <div class="section">
          <div class="section-title">CUSTOMER PAYMENTS</div>
          <table>
            <thead>
              <tr>
                <th style="width: 40px;">S.No</th>
                <th style="width: 80px;">Date</th>
                <th>Customer Name</th>
                <th>Mobile/Device</th>
                <th>Payment Method</th>
                <th class="text-right" style="width: 100px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${reportToUse.customerPayments.map((payment, idx) => `
                <tr>
                  <td class="text-center">${idx + 1}</td>
                  <td>${new Date(payment.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td>${payment.customerName}</td>
                  <td>${payment.mobileName}</td>
                  <td>${payment.paymentMethod || 'N/A'}</td>
                  <td class="text-right">₹${payment.amount?.toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="5" class="text-right">TOTAL:</td>
                <td class="text-right">₹${reportToUse.summary?.totalCustomerPayments?.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        ` : ''}

        <div class="footer">
          <p>This is a computer-generated report.</p>
          <p>For queries: ${currentShop?.phone || 'N/A'}</p>
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  // Fetch analytics when revenue tab becomes active
  useEffect(() => {
    if (activeTab === 'revenue' && currentShopId) {
      fetchLocalAnalytics();
    }
  }, [activeTab, currentShopId]);

  // Local fetch function for employee attendance with filters
  const fetchLocalEmployeeAttendance = async (employeeId) => {
    try {
      const token = localStorage.getItem('shopAdminToken');
      const params = {
        shop_id: currentShopId,
        employee_id: employeeId,
        _t: Date.now()
      };

      if (attendanceFilters.fromDate) params.from_date = attendanceFilters.fromDate;
      if (attendanceFilters.toDate) params.to_date = attendanceFilters.toDate;

      const response = await axios.get(
        `${API_URL}/api/shop-admin/employee-attendance`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
          params
        }
      );

      if (response.data.success) {
        setLocalEmployeeAttendance(response.data.attendance);
      } else {
        setLocalEmployeeAttendance(null);
      }
    } catch (error) {
      console.error('Error fetching employee attendance:', error);
      setLocalEmployeeAttendance(null);
    }
  };

  // Use local attendance if available, otherwise use prop
  const displayAttendance = localEmployeeAttendance || employeeAttendance;

  const getCurrentShop = () => {
    if (!shops || shops.length === 0) return null;
    return shops.find(shop => shop.id === currentShopId) || shops[0];
  };

  const currentShop = getCurrentShop();

  // Handle customer filter
  const handleCustomerFilter = async () => {
    try {
      const token = localStorage.getItem('shopAdminToken');
      const authConfig = {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { shop_id: currentShopId }
      };

      if (customerFilters.billNumber) {
        authConfig.params.billNumber = customerFilters.billNumber;
      }

      const customerDetailsRes = await axios.get(
        `${API_URL}/api/shop-admin/customer-details`,
        authConfig
      );

      if (customerDetailsRes.data.success) {
        let filtered = customerDetailsRes.data.customerDetails || [];

        if (customerFilters.name) {
          filtered = filtered.filter(c =>
            c.client_name.toLowerCase().includes(customerFilters.name.toLowerCase())
          );
        }

        if (customerFilters.mobileNumber) {
          filtered = filtered.filter(c =>
            c.mobile_number.includes(customerFilters.mobileNumber)
          );
        }

        if (customerFilters.fromDate) {
          filtered = filtered.filter(c => {
            const date = new Date(c.latest_mobile_date);
            return date >= new Date(customerFilters.fromDate);
          });
        }

        if (customerFilters.toDate) {
          filtered = filtered.filter(c => {
            const date = new Date(c.latest_mobile_date);
            return date <= new Date(customerFilters.toDate);
          });
        }

        setFilteredCustomers(filtered);
        setCurrentPage(1);
        setShowFilters(false);
      }
    } catch (error) {
      console.error('Error filtering customers:', error);
    }
  };

  const handleClearFilters = () => {
    setCustomerFilters({
      name: '',
      mobileNumber: '',
      billNumber: '',
      fromDate: '',
      toDate: ''
    });
    setFilteredCustomers(customerDetails);
    setCurrentPage(1);
    setShowFilters(false);
  };

  const handleDeleteEmployee = async (employeeId) => {
    try {
      const token = localStorage.getItem('shopAdminToken');
      await axios.delete(
        `${API_URL}/api/shop-admin/employees/${employeeId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
          params: { shop_id: currentShopId }
        }
      );

      await fetchDashboardData();
      setShowDeleteModal(false);
      setEmployeeToDelete(null);
      if (selectedEmployee?._id === employeeId) {
        setSelectedEmployee(null);
      }
    } catch (error) {
      console.error('Error deleting employee:', error);
      alert('Failed to delete employee');
    }
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCustomers = filteredCustomers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Mobile Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white sticky top-0 z-40 shadow-lg">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="p-2 hover:bg-white/10 rounded-lg transition"
              >
                {showMobileMenu ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
              <div>
                <h1 className="font-bold text-lg">{currentShop?.name || 'Shop'}</h1>
                <p className="text-green-100 text-xs">{currentShop?.location || 'Location'}</p>
              </div>
            </div>
            {shops.length > 1 && (
              <button
                onClick={() => setShowShopSelector(!showShopSelector)}
                className="p-2 hover:bg-white/10 rounded-lg transition"
              >
                <ChevronDown className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Quick Stats Bar */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-white/10 rounded-lg p-2">
              <div className="text-green-100 text-xs">Today's Revenue</div>
              <div className="font-bold">₹{(overview?.todayRevenue || 0).toLocaleString()}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-2">
              <div className="text-green-100 text-xs">Pending Repairs</div>
              <div className="font-bold">{overview?.pendingRepairs || 0}</div>
            </div>
          </div>
        </div>

        {/* Shop Selector Dropdown */}
        {showShopSelector && shops.length > 1 && (
          <div className="bg-gray-800 border-t border-green-700">
            {shops.map((shop) => (
              <button
                key={shop.id}
                onClick={() => {
                  handleSwitchShop(shop.id);
                  setShowShopSelector(false);
                }}
                className={`w-full px-4 py-3 text-left transition ${
                  shop.id === currentShopId
                    ? 'bg-green-600 border-l-4 border-green-400'
                    : 'hover:bg-gray-700 border-l-4 border-transparent'
                }`}
              >
                <p className="text-sm font-medium text-white">{shop.name}</p>
                <p className="text-xs text-gray-400">{shop.location}</p>
              </button>
            ))}
          </div>
        )}

        {/* Mobile Menu Dropdown */}
        {showMobileMenu && (
          <div className="bg-gray-800 border-t border-green-700">
            <div className="p-4">
              <div className="mb-3">
                <div className="text-green-100 text-xs mb-1">Admin</div>
                <div className="font-semibold">{shopAdmin?.username}</div>
              </div>
              <div className="text-green-100 text-xs mb-1">Owner</div>
              <div className="text-sm">{currentShop?.owner_name || 'N/A'}</div>
              <div className="text-xs text-gray-400 mt-1">{currentShop?.phone || 'N/A'}</div>
              <button
                onClick={() => {
                  handleLogout();
                  setShowMobileMenu(false);
                }}
                className="mt-4 w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="p-4">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-purple-600" />
                  <div className="text-xs text-gray-600">Total Mobiles</div>
                </div>
                <div className="text-2xl font-bold text-gray-900">{overview?.totalMobiles || 0}</div>
              </div>

              <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <Wrench className="h-4 w-4 text-green-600" />
                  <div className="text-xs text-gray-600">Today's Services</div>
                </div>
                <div className="text-2xl font-bold text-gray-900">{overview?.todayMobiles || 0}</div>
              </div>

              <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-green-600" />
                  <div className="text-xs text-gray-600">Employees</div>
                </div>
                <div className="text-2xl font-bold text-gray-900">{overview?.totalEmployees || 0}</div>
              </div>

              <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-green-600" />
                  <div className="text-xs text-gray-600">Customers</div>
                </div>
                <div className="text-2xl font-bold text-gray-900">{overview?.totalCustomers || 0}</div>
              </div>
            </div>

            {/* Customer Records */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-3 flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm">Customer Records</h3>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="p-1.5 bg-white/20 rounded-lg"
                >
                  <Filter className="h-4 w-4 text-white" />
                </button>
              </div>

              {/* Filters */}
              {showFilters && (
                <div className="p-3 bg-gray-50 border-b border-gray-200 space-y-2">
                  <input
                    type="text"
                    placeholder="Customer Name"
                    value={customerFilters.name}
                    onChange={(e) => setCustomerFilters({...customerFilters, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Mobile Number"
                    value={customerFilters.mobileNumber}
                    onChange={(e) => setCustomerFilters({...customerFilters, mobileNumber: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Bill Number"
                    value={customerFilters.billNumber}
                    onChange={(e) => setCustomerFilters({...customerFilters, billNumber: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={customerFilters.fromDate}
                      onChange={(e) => setCustomerFilters({...customerFilters, fromDate: e.target.value})}
                      className="w-full px-2 py-2 border border-gray-300 rounded-lg text-xs"
                    />
                    <input
                      type="date"
                      value={customerFilters.toDate}
                      onChange={(e) => setCustomerFilters({...customerFilters, toDate: e.target.value})}
                      className="w-full px-2 py-2 border border-gray-300 rounded-lg text-xs"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCustomerFilter}
                      className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium"
                    >
                      Apply
                    </button>
                    <button
                      onClick={handleClearFilters}
                      className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {/* Customer List */}
              <div className="divide-y divide-gray-200">
                {currentCustomers.length > 0 ? (
                  currentCustomers.map((customer, index) => (
                    <div key={customer._id || index} className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 text-sm">{customer.client_name}</div>
                          <div className="text-xs text-gray-600 mt-0.5">{customer.mobile_number || 'N/A'}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {customer.customer_type === 'Customer' ? 'Customer' : 'Dealer'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-600">
                            ₹{(customer.total_paid || 0).toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {customer.total_mobiles || 0} mobiles
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">
                          Ready: {customer.ready_count || 0}
                        </span>
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold">
                          Pending: {customer.not_ready_count || 0}
                        </span>
                        <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-semibold">
                          Delivered: {customer.delivered_count || 0}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center">
                    <Package className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No customers found</p>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {filteredCustomers.length > 0 && (
                <div className="p-3 bg-gray-50 border-t border-gray-200">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                    <span>
                      {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredCustomers.length)} of {filteredCustomers.length}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="p-1.5 bg-white border border-gray-300 rounded disabled:opacity-50"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="p-1.5 bg-white border border-gray-300 rounded disabled:opacity-50"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Employees Tab */}
        {activeTab === 'employees' && (
          <div className="space-y-4">
            {!selectedEmployee ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-800">Employees ({employees?.length || 0})</h2>
                  <button
                    onClick={() => fetchDashboardData()}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium"
                  >
                    Refresh
                  </button>
                </div>

                {employees && employees.length > 0 ? (
                  employees.map((emp) => (
                    <div
                      key={emp._id}
                      onClick={() => {
                        setSelectedEmployee(emp);
                        fetchLocalEmployeeAttendance(emp._id);
                      }}
                      className="bg-white rounded-lg p-4 shadow-sm border border-gray-200"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900">{emp.name || 'No Name'}</div>
                          <div className="text-xs text-gray-600 mt-0.5">{emp.phone_number || 'N/A'}</div>
                          <div className="text-sm font-semibold text-green-600 mt-1">
                            ₹{(emp.salary || 0).toLocaleString()}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEmployeeToDelete(emp);
                            setShowDeleteModal(true);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <XCircle className="h-5 w-5" />
                        </button>
                      </div>
                      {emp.stats && (
                        <div className="flex gap-2 mt-2">
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">
                            Present: {emp.stats.presentDays}
                          </span>
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold">
                            Absent: {emp.stats.absentDays}
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="bg-white rounded-lg p-12 text-center">
                    <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600">No employees found</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  onClick={() => setSelectedEmployee(null)}
                  className="flex items-center gap-2 text-green-600 font-medium text-sm"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back to List
                </button>

                {/* Employee Info */}
                <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{selectedEmployee.name}</h3>
                      <p className="text-sm text-gray-600">{selectedEmployee.phone_number}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-600">Salary</div>
                      <div className="text-lg font-bold text-green-600">
                        ₹{(selectedEmployee.salary || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-50 rounded p-2">
                      <div className="text-gray-600">Address</div>
                      <div className="text-gray-900 font-medium mt-0.5">
                        {selectedEmployee.address || 'N/A'}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <div className="text-gray-600">Aadhar</div>
                      <div className="text-gray-900 font-medium mt-0.5">
                        {selectedEmployee.aadhar_number || 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Date Filters */}
                <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-3 text-sm">Attendance Filters</h4>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-600">From Date</label>
                        <input
                          type="date"
                          value={attendanceFilters.fromDate}
                          onChange={(e) => setAttendanceFilters({...attendanceFilters, fromDate: e.target.value})}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">To Date</label>
                        <input
                          type="date"
                          value={attendanceFilters.toDate}
                          onChange={(e) => setAttendanceFilters({...attendanceFilters, toDate: e.target.value})}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => fetchLocalEmployeeAttendance(selectedEmployee._id)}
                        className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => {
                          setAttendanceFilters({ fromDate: '', toDate: '' });
                          fetchLocalEmployeeAttendance(selectedEmployee._id);
                        }}
                        className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>

                {/* Attendance Stats */}
                {displayAttendance && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                        <CheckCircle className="h-5 w-5 text-green-600 mb-1" />
                        <div className="text-xs text-gray-600">Present</div>
                        <div className="text-xl font-bold text-gray-900">{displayAttendance.presentDays}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                        <XCircle className="h-5 w-5 text-red-600 mb-1" />
                        <div className="text-xs text-gray-600">Absent</div>
                        <div className="text-xl font-bold text-gray-900">{displayAttendance.absentDays}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                        <AlertCircle className="h-5 w-5 text-orange-600 mb-1" />
                        <div className="text-xs text-gray-600">Permission</div>
                        <div className="text-xl font-bold text-gray-900">{displayAttendance.totalPermissionHours}h</div>
                      </div>
                    </div>

                    {/* Daily Records */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                      <div className="bg-gray-100 p-3">
                        <h4 className="font-semibold text-gray-900 text-sm">Daily Attendance</h4>
                      </div>
                      <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                        {displayAttendance.dailyRecords && displayAttendance.dailyRecords.length > 0 ? (
                          displayAttendance.dailyRecords.map((record, idx) => (
                            <div key={idx} className="p-3 flex items-center justify-between">
                              <div className="text-sm text-gray-700 font-medium">{record.date}</div>
                              <div className="flex items-center gap-2">
                                {record.status === 'present' ? (
                                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">
                                    Present
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold">
                                    Absent
                                  </span>
                                )}
                                {record.permissionHours > 0 && (
                                  <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-semibold">
                                    {record.permissionHours}h
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-8 text-center text-gray-500 text-sm">No attendance records</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Revenue Tab */}
        {activeTab === 'revenue' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">Filter Period</h3>
              <div className="space-y-2">
                <select
                  value={revenueFilters.period}
                  onChange={(e) => setRevenueFilters({ period: e.target.value, fromDate: '', toDate: '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="1">Today</option>
                  <option value="7">Last 7 Days</option>
                  <option value="30">Last 30 Days</option>
                </select>
                <div className="text-xs text-gray-500 text-center my-2">OR</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={revenueFilters.fromDate}
                    onChange={(e) => setRevenueFilters({ ...revenueFilters, fromDate: e.target.value, period: '' })}
                    className="w-full px-2 py-2 border border-gray-300 rounded-lg text-xs"
                  />
                  <input
                    type="date"
                    value={revenueFilters.toDate}
                    onChange={(e) => setRevenueFilters({ ...revenueFilters, toDate: e.target.value, period: '' })}
                    className="w-full px-2 py-2 border border-gray-300 rounded-lg text-xs"
                  />
                </div>
                <button
                  onClick={fetchLocalAnalytics}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium"
                >
                  Apply Filters
                </button>
              </div>
            </div>

            {(localAnalytics || analytics) ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <div className="text-xs text-gray-600">Revenue</div>
                    </div>
                    <div className="text-xl font-bold text-gray-900">
                      ₹{((localAnalytics || analytics)?.revenue?.total || 0).toLocaleString()}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Truck className="h-4 w-4 text-red-600" />
                      <div className="text-xs text-gray-600">Supplier Payments</div>
                    </div>
                    <div className="text-xl font-bold text-gray-900">
                      ₹{((localAnalytics || analytics)?.revenue?.totalSupplierPayments || 0).toLocaleString()}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                      <div className="text-xs text-gray-600">Operating Expenses</div>
                    </div>
                    <div className="text-xl font-bold text-gray-900">
                      ₹{((localAnalytics || analytics)?.revenue?.totalOperatingExpenses || 0).toLocaleString()}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-purple-600" />
                      <div className="text-xs text-gray-600">Paid Salaries</div>
                    </div>
                    <div className="text-xl font-bold text-gray-900">
                      ₹{((localAnalytics || analytics)?.revenue?.totalDailyWageExpenses || 0).toLocaleString()}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-4 w-4 text-blue-600" />
                      <div className="text-xs text-gray-600">Net Profit</div>
                    </div>
                    <div className="text-xl font-bold text-gray-900">
                      ₹{((localAnalytics || analytics)?.revenue?.netProfit || 0).toLocaleString()}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="h-4 w-4 text-gray-600" />
                      <div className="text-xs text-gray-600">Profit Margin</div>
                    </div>
                    <div className="text-xl font-bold text-gray-900">
                      {(localAnalytics || analytics)?.revenue?.total > 0 
                        ? Math.round(((localAnalytics || analytics).revenue.netProfit / (localAnalytics || analytics).revenue.total) * 100) 
                        : 0}%
                    </div>
                  </div>
                </div>

                {/* Chart */}
                <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-3 text-sm">Revenue Analysis</h4>
                  {(localAnalytics || analytics)?.revenue?.dailyData && (localAnalytics || analytics).revenue.dailyData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={(localAnalytics || analytics).revenue.dailyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" fontSize={9} angle={-45} textAnchor="end" height={60} />
                        <YAxis fontSize={10} />
                        <Tooltip 
                          contentStyle={{ fontSize: '11px', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                          formatter={(value, name) => {
                            const label = name === 'Wages' ? 'Paid Salary' : name;
                            return [`₹${value?.toLocaleString()}`, label];
                          }}
                          labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                        <Bar dataKey="revenue" fill="#10B981" name="Revenue" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="netProfit" fill="#3B82F6" name="Profit" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="supplierPayments" fill="#EF4444" name="Supplier Payments" radius={[4, 4, 0, 0]} stackId="expenses" />
                        <Bar dataKey="operatingExpenses" fill="#F97316" name="Operating Costs" radius={[4, 4, 0, 0]} stackId="expenses" />
                        <Bar dataKey="dailyWageExpenses" fill="#8B5CF6" name="Paid Salary" radius={[4, 4, 0, 0]} stackId="expenses" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
                      No data available
                    </div>
                  )}
                </div>

                {/* Financial Components */}
                <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-3 text-sm">Financial Breakdown</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                      <div className="w-3 h-3 bg-green-500 rounded"></div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">Revenue</div>
                        <div className="text-gray-600">Customer & dealer payments</div>
                      </div>
                      <div className="font-semibold text-gray-900">
                        ₹{((localAnalytics || analytics)?.revenue?.total || 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-red-50 rounded">
                      <div className="w-3 h-3 bg-red-500 rounded"></div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">Supplier Payments</div>
                        <div className="text-gray-600">Parts & materials</div>
                      </div>
                      <div className="font-semibold text-gray-900">
                        ₹{((localAnalytics || analytics)?.revenue?.totalSupplierPayments || 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-orange-50 rounded">
                      <div className="w-3 h-3 bg-orange-500 rounded"></div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">Operating Expenses</div>
                        <div className="text-gray-600">Rent, utilities, misc.</div>
                      </div>
                      <div className="font-semibold text-gray-900">
                        ₹{((localAnalytics || analytics)?.revenue?.totalOperatingExpenses || 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-purple-50 rounded">
                      <div className="w-3 h-3 bg-purple-500 rounded"></div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">Paid Salary Expenses</div>
                        <div className="text-gray-600">Employee wages (paid only)</div>
                      </div>
                      <div className="font-semibold text-gray-900">
                        ₹{((localAnalytics || analytics)?.revenue?.totalDailyWageExpenses || 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-blue-50 rounded border-t-2 border-blue-200 mt-2">
                      <div className="w-3 h-3 bg-blue-500 rounded"></div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">Net Profit</div>
                        <div className="text-gray-600">After all expenses</div>
                      </div>
                      <div className="font-semibold text-gray-900">
                        ₹{((localAnalytics || analytics)?.revenue?.netProfit || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-lg p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                <p className="text-gray-600 text-sm">Loading financial data...</p>
              </div>
            )}
          </div>
        )}

        {/* Salary Tab */}
        {activeTab === 'salary' && (
          <div className="space-y-4">
            <MobileSalaryManagement shopId={currentShopId} />
          </div>
        )}

        {/* Report Tab */}
        {activeTab === 'report' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">Report Period</h3>
              <div className="space-y-2">
                <select
                  value={reportFilters.period}
                  onChange={(e) => setReportFilters({ period: e.target.value, fromDate: '', toDate: '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="1">Today</option>
                  <option value="7">Last 7 Days</option>
                  <option value="30">Last 30 Days</option>
                </select>
                <div className="text-xs text-gray-500 text-center my-2">OR</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={reportFilters.fromDate}
                    onChange={(e) => setReportFilters({ ...reportFilters, fromDate: e.target.value, period: '' })}
                    className="w-full px-2 py-2 border border-gray-300 rounded-lg text-xs"
                  />
                  <input
                    type="date"
                    value={reportFilters.toDate}
                    onChange={(e) => setReportFilters({ ...reportFilters, toDate: e.target.value, period: '' })}
                    className="w-full px-2 py-2 border border-gray-300 rounded-lg text-xs"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={fetchLocalFinancialReport}
                    disabled={loadingReport}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:bg-gray-400"
                  >
                    {loadingReport ? 'Loading...' : 'Generate'}
                  </button>
                  {(localReportData || reportData) && (
                    <button
                      onClick={handlePrintReport}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center gap-1"
                      title="Print/Save as PDF"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 6 2 18 2 18 9"></polyline>
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                        <rect x="6" y="14" width="12" height="8"></rect>
                      </svg>
                      PDF
                    </button>
                  )}
                </div>
              </div>
            </div>

            {(localReportData || reportData) ? (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <div className="text-xs text-green-700 font-medium">Total Revenue</div>
                    <div className="text-lg font-bold text-green-900">
                      ₹{(localReportData || reportData).summary?.totalRevenue?.toLocaleString() || 0}
                    </div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                    <div className="text-xs text-red-700 font-medium">Total Expenses</div>
                    <div className="text-lg font-bold text-red-900">
                      ₹{(localReportData || reportData).summary?.totalExpenses?.toLocaleString() || 0}
                    </div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <div className="text-xs text-blue-700 font-medium">Net Profit</div>
                    <div className="text-lg font-bold text-blue-900">
                      ₹{(localReportData || reportData).summary?.netProfit?.toLocaleString() || 0}
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                    <div className="text-xs text-purple-700 font-medium">Profit Margin</div>
                    <div className="text-lg font-bold text-purple-900">
                      {(localReportData || reportData).summary?.profitMargin?.toFixed(1) || 0}%
                    </div>
                  </div>
                </div>

                {/* Collapsible Sections */}
                {(localReportData || reportData).customerPayments && (localReportData || reportData).customerPayments.length > 0 && (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => setExpandedSection(expandedSection === 'customer' ? null : 'customer')}
                      className="w-full p-3 bg-gray-100 flex items-center justify-between"
                    >
                      <span className="font-semibold text-gray-900 text-sm">Customer Payments</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${expandedSection === 'customer' ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedSection === 'customer' && (
                      <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                        {(localReportData || reportData).customerPayments.slice(0, 20).map((payment, idx) => (
                          <div key={idx} className="p-3">
                            <div className="flex items-start justify-between mb-1">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 text-sm">{payment.customerName}</div>
                                <div className="text-xs text-gray-600">{payment.mobileName}</div>
                                <div className="text-xs text-gray-500">
                                  {new Date(payment.date).toLocaleDateString('en-IN')}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-green-700">₹{payment.amount?.toLocaleString()}</div>
                                <div className="text-xs text-gray-500">{payment.paymentMethod || 'N/A'}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Similar sections for other payment types */}
                {(localReportData || reportData).dealerPayments && (localReportData || reportData).dealerPayments.length > 0 && (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => setExpandedSection(expandedSection === 'dealer' ? null : 'dealer')}
                      className="w-full p-3 bg-gray-100 flex items-center justify-between"
                    >
                      <span className="font-semibold text-gray-900 text-sm">Dealer Payments</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${expandedSection === 'dealer' ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedSection === 'dealer' && (
                      <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                        {(localReportData || reportData).dealerPayments.slice(0, 20).map((payment, idx) => (
                          <div key={idx} className="p-3">
                            <div className="flex items-start justify-between mb-1">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 text-sm">{payment.dealerName}</div>
                                <div className="text-xs text-gray-600">{payment.mobileName}</div>
                                <div className="text-xs text-gray-500">
                                  {new Date(payment.date).toLocaleDateString('en-IN')}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-blue-700">₹{payment.amount?.toLocaleString()}</div>
                                <div className="text-xs text-gray-500">{payment.paymentMethod || 'N/A'}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg p-12 text-center">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 text-sm">No report generated</p>
                <p className="text-gray-500 text-xs mt-1">Select period and generate</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="grid grid-cols-5 gap-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex flex-col items-center justify-center py-3 ${
              activeTab === 'overview' ? 'text-green-600' : 'text-gray-600'
            }`}
          >
            <Home className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">Overview</span>
          </button>
          <button
            onClick={() => setActiveTab('employees')}
            className={`flex flex-col items-center justify-center py-3 ${
              activeTab === 'employees' ? 'text-green-600' : 'text-gray-600'
            }`}
          >
            <Users className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">Employees</span>
          </button>
          <button
            onClick={() => setActiveTab('revenue')}
            className={`flex flex-col items-center justify-center py-3 ${
              activeTab === 'revenue' ? 'text-green-600' : 'text-gray-600'
            }`}
          >
            <DollarSign className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">Revenue</span>
          </button>
          <button
            onClick={() => setActiveTab('salary')}
            className={`flex flex-col items-center justify-center py-3 ${
              activeTab === 'salary' ? 'text-green-600' : 'text-gray-600'
            }`}
          >
            <Wallet className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">Salary</span>
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`flex flex-col items-center justify-center py-3 ${
              activeTab === 'report' ? 'text-green-600' : 'text-gray-600'
            }`}
          >
            <FileText className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">Report</span>
          </button>
        </div>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && employeeToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">Delete Employee</h3>
            </div>
            <p className="text-gray-600 text-sm mb-6">
              Are you sure you want to delete <strong>{employeeToDelete.name}</strong>? 
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setEmployeeToDelete(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteEmployee(employeeToDelete._id)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

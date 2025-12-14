"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { 
  Users, Phone, Calendar, Filter, Search, ChevronDown,
  TrendingUp, Package, Wrench, DollarSign, CheckCircle,
  XCircle, Truck, AlertCircle
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ComposedChart
} from 'recharts';

export default function ShopAdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [shopAdmin, setShopAdmin] = useState(null);
  const [shops, setShops] = useState([]);
  const [currentShopId, setCurrentShopId] = useState(null);
  const [overview, setOverview] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showShopSelector, setShowShopSelector] = useState(false);
  
  // Customer details state
  const [customerDetails, setCustomerDetails] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [customerFilters, setCustomerFilters] = useState({
    name: '',
    mobileNumber: '',
    fromDate: '',
    toDate: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Employee details state
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeAttendance, setEmployeeAttendance] = useState(null);
  const [attendanceFilters, setAttendanceFilters] = useState({
    fromDate: '',
    toDate: ''
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);

  // Revenue filter state
  const [revenueFilters, setRevenueFilters] = useState({
    period: '30', // default 30 days
    fromDate: '',
    toDate: ''
  });

  // Report state
  const [reportFilters, setReportFilters] = useState({
    period: '30',
    fromDate: '',
    toDate: ''
  });
  const [reportData, setReportData] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || 'http://localhost:8000';

  useEffect(() => {
    // Check shop admin authentication
    const token = localStorage.getItem('shopAdminToken');
    const adminInfo = localStorage.getItem('shopAdminInfo');
    
    if (!token || !adminInfo) {
      router.push('/shop-admin-login');
      return;
    }
    
    try {
      const admin = JSON.parse(adminInfo);
      setShopAdmin(admin);
      
      // Set shops and current shop
      if (admin.shops && admin.shops.length > 0) {
        setShops(admin.shops);
        const savedShopId = localStorage.getItem('currentShopId');
        const initialShopId = savedShopId || admin.current_shop_id || admin.shops[0].id;
        setCurrentShopId(initialShopId);
      }
    } catch (error) {
      console.error('Error parsing admin info:', error);
      router.push('/shop-admin-login');
    }
  }, []);

  useEffect(() => {
    if (currentShopId) {
      fetchDashboardData();
    }
  }, [currentShopId]);

  useEffect(() => {
    // Fetch analytics when switching to analytics tabs
    if (currentShopId && ['revenue', 'service', 'customers', 'inventory'].includes(activeTab)) {
      fetchAnalytics();
    }
    // Refresh employee attendance when switching back to employees tab
    if (activeTab === 'employees' && selectedEmployee) {
      fetchEmployeeAttendance(selectedEmployee._id);
    }
  }, [activeTab, currentShopId]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('shopAdminToken');
    return {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        shop_id: currentShopId
      }
    };
  };

  const fetchDashboardData = async () => {
    if (!currentShopId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    try {
      const token = localStorage.getItem('shopAdminToken');
      const authConfig = {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params: {
          shop_id: currentShopId
        }
      };

      const [overviewRes, employeesRes, customerDetailsRes] = await Promise.all([
        axios.get(`${API_URL}/api/shop-admin/dashboard/overview`, authConfig),
        axios.get(`${API_URL}/api/shop-admin/employees`, authConfig),
        axios.get(`${API_URL}/api/shop-admin/customer-details`, authConfig)
      ]);

      if (overviewRes.data.success) {
        setOverview(overviewRes.data.overview);
      }
      
      if (employeesRes.data.success) {
        setEmployees(employeesRes.data.employees || []);
      }

      if (customerDetailsRes.data.success) {
        setCustomerDetails(customerDetailsRes.data.customerDetails || []);
        setFilteredCustomers(customerDetailsRes.data.customerDetails || []);
      }
      
      // Clear cached analytics when switching shops
      setAnalytics(null);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      
      if (error.response?.status === 401) {
        localStorage.clear();
        router.push('/shop-admin-login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerFilter = () => {
    let filtered = [...customerDetails];

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
  };

  const handleClearFilters = () => {
    setCustomerFilters({
      name: '',
      mobileNumber: '',
      fromDate: '',
      toDate: ''
    });
    setFilteredCustomers(customerDetails);
    setCurrentPage(1);
  };

  const fetchEmployeeAttendance = async (employeeId) => {
    try {
      const token = localStorage.getItem('shopAdminToken');
      const params = {
        shop_id: currentShopId,
        employee_id: employeeId,
        _t: Date.now() // Cache buster
      };

      if (attendanceFilters.fromDate) params.from_date = attendanceFilters.fromDate;
      if (attendanceFilters.toDate) params.to_date = attendanceFilters.toDate;

      console.log('Fetching attendance for employee:', employeeId, 'with params:', params);

      const response = await axios.get(
        `${API_URL}/api/shop-admin/employee-attendance`,
        {
          headers: { 
            'Authorization': `Bearer ${token}`
          },
          params
        }
      );

      console.log('Attendance response:', response.data);

      if (response.data.success) {
        setEmployeeAttendance(response.data.attendance);
      } else {
        setEmployeeAttendance(null);
      }
    } catch (error) {
      console.error('Error fetching employee attendance:', error);
      setEmployeeAttendance(null);
    }
  };

  const handleEmployeeClick = (employee) => {
    setSelectedEmployee(employee);
    fetchEmployeeAttendance(employee._id);
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

      // Refresh employee list
      await fetchDashboardData();
      setShowDeleteModal(false);
      setEmployeeToDelete(null);
      if (selectedEmployee?._id === employeeId) {
        setSelectedEmployee(null);
        setEmployeeAttendance(null);
      }
    } catch (error) {
      console.error('Error deleting employee:', error);
      alert('Failed to delete employee');
    }
  };

  const handleAttendanceFilter = () => {
    if (selectedEmployee) {
      fetchEmployeeAttendance(selectedEmployee._id);
    }
  };

  const handleRefreshAttendance = () => {
    if (selectedEmployee) {
      fetchEmployeeAttendance(selectedEmployee._id);
    }
  };

  const handleClearAttendanceFilters = () => {
    setAttendanceFilters({ fromDate: '', toDate: '' });
    if (selectedEmployee) {
      fetchEmployeeAttendance(selectedEmployee._id);
    }
  };

  const fetchAnalytics = async (type = null) => {
    if (!currentShopId) return;
    
    // Clear analytics to force refetch
    if (type) {
      setAnalytics(null);
    }
    
    try {
      const token = localStorage.getItem('shopAdminToken');
      if (!token) return;

      const authConfig = {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params: {
          shop_id: currentShopId
        }
      };

      // Build query params for revenue based on filters
      let revenueQuery = `period=${revenueFilters.period}`;
      if (revenueFilters.fromDate && revenueFilters.toDate) {
        revenueQuery = `fromDate=${revenueFilters.fromDate}&toDate=${revenueFilters.toDate}`;
      }

      const [revenueRes, serviceRes, customersRes, inventoryRes] = await Promise.all([
        axios.get(`${API_URL}/api/shop-admin/analytics/revenue?${revenueQuery}`, authConfig).catch(err => ({ data: { revenue: null } })),
        axios.get(`${API_URL}/api/shop-admin/analytics/service?period=${revenueFilters.period}`, authConfig).catch(err => ({ data: { service: null } })),
        axios.get(`${API_URL}/api/shop-admin/analytics/customers`, authConfig).catch(err => ({ data: { customers: null } })),
        axios.get(`${API_URL}/api/shop-admin/analytics/inventory`, authConfig).catch(err => ({ data: { inventory: null } }))
      ]);

      const revenueData = revenueRes.data.analytics || {};
      const serviceData = serviceRes.data.serviceAnalytics || {};
      const customersData = customersRes.data.customerAnalytics || {};
      const inventoryData = inventoryRes.data.inventoryAnalytics || {};

      // Calculate today/week/month from the analytics data
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Combine mobile and sales revenue by date
      const revenueByDate = {};
      const countByDate = {};
      
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

      const todayRevenue = revenueByDate[today] || 0;
      const weekRevenue = Object.entries(revenueByDate)
        .filter(([date]) => date >= weekAgo)
        .reduce((sum, [, amount]) => sum + amount, 0);
      const monthRevenue = Object.entries(revenueByDate)
        .filter(([date]) => date >= monthAgo)
        .reduce((sum, [, amount]) => sum + amount, 0);

      const dailyData = Object.entries(revenueByDate)
        .map(([date, revenue]) => ({ 
          date, 
          revenue: Math.round(revenue),
          count: countByDate[date] || 0
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setAnalytics({
        revenue: {
          today: todayRevenue,
          thisWeek: weekRevenue,
          thisMonth: monthRevenue,
          dailyData,
          total: revenueData.totalRevenue || 0
        },
        service: {
          totalRepairs: serviceData.statusBreakdown?.reduce((sum, item) => sum + (item.count || 0), 0) || 0,
          pendingRepairs: serviceData.statusBreakdown?.find(item => !item._id?.ready)?.count || 0,
          byStatus: serviceData.statusBreakdown?.reduce((acc, item) => {
            const status = item._id?.ready ? 'completed' : item._id?.delivered ? 'delivered' : 'pending';
            acc[status] = (acc[status] || 0) + (item.count || 0);
            return acc;
          }, {}) || {}
        },
        customers: {
          total: customersData.total || 0,
          newThisMonth: customersData.newThisMonth || 0,
          active: customersData.active || 0
        },
        inventory: {
          totalMobiles: inventoryData.total || 0,
          inStock: inventoryData.inStock || 0,
          lowStock: inventoryData.lowStock || 0,
          topBrands: inventoryData.topBrands || []
        }
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const fetchFinancialReport = async () => {
    if (!currentShopId) return;
    
    setLoadingReport(true);
    try {
      const token = localStorage.getItem('shopAdminToken');
      if (!token) return;

      const authConfig = {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { shop_id: currentShopId }
      };

      // Build query params based on filters
      let query = `period=${reportFilters.period}`;
      if (reportFilters.fromDate && reportFilters.toDate) {
        query = `fromDate=${reportFilters.fromDate}&toDate=${reportFilters.toDate}`;
      }

      const response = await axios.get(`${API_URL}/api/shop-admin/reports/financial?${query}`, authConfig);
      
      if (response.data.success) {
        setReportData(response.data.report);
      }
    } catch (error) {
      console.error('Error fetching financial report:', error);
    } finally {
      setLoadingReport(false);
    }
  };

  const handlePrintReport = () => {
    if (!reportData) return;
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    const currentShop = shops.find(s => s.id === currentShopId);
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Financial Report - ${currentShop?.name || 'Shop'}</title>
        <style>
          @page {
            size: A4;
            margin: 1.5cm;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #000;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #000;
            padding-bottom: 15px;
          }
          .header h1 {
            font-size: 24px;
            margin-bottom: 8px;
          }
          .header h2 {
            font-size: 18px;
            margin-bottom: 4px;
          }
          .header p {
            font-size: 11px;
            color: #555;
          }
          .section {
            margin-bottom: 25px;
          }
          .section-title {
            font-size: 14px;
            font-weight: bold;
            background: #f0f0f0;
            padding: 8px;
            margin-bottom: 10px;
            border-left: 4px solid #16a34a;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 20px;
          }
          .summary-box {
            border: 1px solid #ddd;
            padding: 10px;
            text-align: center;
          }
          .summary-box .label {
            font-size: 10px;
            color: #666;
            margin-bottom: 4px;
          }
          .summary-box .value {
            font-size: 16px;
            font-weight: bold;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
          }
          th {
            background: #f5f5f5;
            border: 1px solid #000;
            padding: 8px;
            text-align: left;
            font-weight: bold;
            font-size: 11px;
          }
          td {
            border: 1px solid #ddd;
            padding: 6px 8px;
            font-size: 11px;
          }
          tr:nth-child(even) {
            background: #fafafa;
          }
          .text-right {
            text-align: right;
          }
          .text-center {
            text-align: center;
          }
          tfoot td {
            font-weight: bold;
            background: #f0f0f0;
            border-top: 2px solid #000;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 10px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 15px;
          }
          .payment-breakdown {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
          }
          .payment-box {
            border: 1px solid #ddd;
            padding: 10px;
            background: #f9f9f9;
          }
          .payment-box .method {
            font-size: 10px;
            color: #666;
          }
          .payment-box .amount {
            font-size: 14px;
            font-weight: bold;
            margin: 4px 0;
          }
          .payment-box .count {
            font-size: 9px;
            color: #888;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>FINANCIAL REPORT</h1>
          <h2>${currentShop?.name || 'Shop Name'}</h2>
          <p>${currentShop?.location || 'Location'}</p>
          <p style="margin-top: 10px;">
            <strong>Report Period:</strong> ${reportData.periodStart} to ${reportData.periodEnd}<br/>
            <strong>Generated On:</strong> ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>

        <div class="section">
          <div class="section-title">FINANCIAL SUMMARY</div>
          <div class="summary-grid">
            <div class="summary-box">
              <div class="label">Total Revenue</div>
              <div class="value" style="color: #16a34a;">₹${reportData.summary?.totalRevenue?.toLocaleString() || 0}</div>
            </div>
            <div class="summary-box">
              <div class="label">Total Expenses</div>
              <div class="value" style="color: #dc2626;">₹${reportData.summary?.totalExpenses?.toLocaleString() || 0}</div>
            </div>
            <div class="summary-box">
              <div class="label">Net Profit</div>
              <div class="value" style="color: #2563eb;">₹${reportData.summary?.netProfit?.toLocaleString() || 0}</div>
            </div>
            <div class="summary-box">
              <div class="label">Profit Margin</div>
              <div class="value" style="color: #7c3aed;">${reportData.summary?.profitMargin?.toFixed(1) || 0}%</div>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 15px;">
            <div class="summary-box" style="background: #f0fdf4;">
              <div class="label">Customer Payments</div>
              <div class="value" style="color: #16a34a;">₹${reportData.summary?.totalCustomerPayments?.toLocaleString() || 0}</div>
            </div>
            <div class="summary-box" style="background: #eff6ff;">
              <div class="label">Dealer Payments</div>
              <div class="value" style="color: #2563eb;">₹${reportData.summary?.totalDealerPayments?.toLocaleString() || 0}</div>
            </div>
          </div>
        </div>

        ${reportData.customerPayments && reportData.customerPayments.length > 0 ? `
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
              ${reportData.customerPayments.map((payment, idx) => `
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
                <td colspan="5" class="text-right">TOTAL CUSTOMER PAYMENTS:</td>
                <td class="text-right">₹${reportData.summary?.totalCustomerPayments?.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        ` : ''}

        ${reportData.dealerPayments && reportData.dealerPayments.length > 0 ? `
        <div class="section">
          <div class="section-title">DEALER PAYMENTS</div>
          <table>
            <thead>
              <tr>
                <th style="width: 40px;">S.No</th>
                <th style="width: 80px;">Date</th>
                <th>Dealer Name</th>
                <th>Mobile/Device</th>
                <th>Payment Method</th>
                <th class="text-right" style="width: 100px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.dealerPayments.map((payment, idx) => `
                <tr>
                  <td class="text-center">${idx + 1}</td>
                  <td>${new Date(payment.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td>${payment.dealerName}</td>
                  <td>${payment.mobileName}</td>
                  <td>${payment.paymentMethod || 'N/A'}</td>
                  <td class="text-right">₹${payment.amount?.toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="5" class="text-right">TOTAL DEALER PAYMENTS:</td>
                <td class="text-right">₹${reportData.summary?.totalDealerPayments?.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        ` : ''}

        ${reportData.supplierPayments && reportData.supplierPayments.length > 0 ? `
        <div class="section">
          <div class="section-title">SUPPLIER PAYMENTS</div>
          <table>
            <thead>
              <tr>
                <th style="width: 40px;">S.No</th>
                <th style="width: 80px;">Date</th>
                <th>Supplier Name</th>
                <th>Product/Part</th>
                <th>Payment Method</th>
                <th class="text-right" style="width: 100px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.supplierPayments.map((payment, idx) => `
                <tr>
                  <td class="text-center">${idx + 1}</td>
                  <td>${new Date(payment.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td>${payment.supplierName}</td>
                  <td>${payment.productName}</td>
                  <td>${payment.paymentMethod || 'N/A'}</td>
                  <td class="text-right">₹${payment.amount?.toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="5" class="text-right">TOTAL SUPPLIER PAYMENTS:</td>
                <td class="text-right">₹${reportData.summary?.totalSupplierPayments?.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        ` : ''}

        ${reportData.expenses && reportData.expenses.length > 0 ? `
        <div class="section">
          <div class="section-title">OPERATING EXPENSES</div>
          <table>
            <thead>
              <tr>
                <th style="width: 40px;">S.No</th>
                <th style="width: 80px;">Date</th>
                <th>Category</th>
                <th>Description</th>
                <th class="text-right" style="width: 100px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.expenses.map((expense, idx) => `
                <tr>
                  <td class="text-center">${idx + 1}</td>
                  <td>${new Date(expense.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td>${expense.category}</td>
                  <td>${expense.description}</td>
                  <td class="text-right">₹${expense.amount?.toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4" class="text-right">TOTAL OPERATING EXPENSES:</td>
                <td class="text-right">₹${reportData.summary?.totalOperatingExpenses?.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        ` : ''}

        ${reportData.paymentBreakdown && reportData.paymentBreakdown.length > 0 ? `
        <div class="section">
          <div class="section-title">PAYMENT METHOD BREAKDOWN</div>
          <div class="payment-breakdown">
            ${reportData.paymentBreakdown.map(payment => `
              <div class="payment-box">
                <div class="method">${payment.method}</div>
                <div class="amount">₹${payment.total?.toLocaleString()}</div>
                <div class="count">${payment.count} transactions</div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <div class="footer">
          <p>This is a computer-generated report and does not require a signature.</p>
          <p>For queries, please contact: ${currentShop?.phone || 'N/A'}</p>
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    
    // Wait for content to load then print
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleSwitchShop = async (shopId) => {
    try {
      const token = localStorage.getItem('shopAdminToken');
      await axios.post(
        `${API_URL}/api/shop-admin/switch-shop`,
        { shop_id: shopId },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      // Clear all data and refetch for new shop
      setOverview(null);
      setEmployees([]);
      setAnalytics(null);
      setCustomerDetails([]);
      setFilteredCustomers([]);
      setSelectedEmployee(null);
      setEmployeeAttendance(null);
      
      setCurrentShopId(shopId);
      localStorage.setItem('currentShopId', shopId);
      setShowShopSelector(false);
      setActiveTab('overview');
    } catch (error) {
      console.error('Error switching shop:', error);
      alert('Failed to switch shop');
    }
  };

  useEffect(() => {
    if (!currentShopId) return;
    
    // Clear analytics when switching tabs to force fresh data
    setAnalytics(null);
    
    if (activeTab === 'revenue') fetchAnalytics('revenue');
    else if (activeTab === 'service') fetchAnalytics('service');
    else if (activeTab === 'customers') fetchAnalytics('customers');
    else if (activeTab === 'inventory') fetchAnalytics('inventory');
  }, [activeTab, currentShopId]);

  const handleLogout = () => {
    localStorage.clear(); // Clear all cached data
    router.push('/shop-admin-login');
  };

  const getCurrentShop = () => {
    if (!shops || shops.length === 0) return null;
    const shop = shops.find(shop => shop.id === currentShopId);
    return shop || shops[0];
  };

  // Pagination for customer details
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCustomers = filteredCustomers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-gray-600 text-xl">Loading dashboard...</div>
      </div>
    );
  }

  const currentShop = getCurrentShop();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex">
      {/* Sidebar - Fixed */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-20'} transition-all duration-300 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 fixed h-screen overflow-y-auto shadow-2xl flex flex-col z-50`}>
        {/* Toggle Button */}
        <div className="p-4 border-b border-gray-700">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-300 hover:bg-gray-700 p-2 rounded-lg transition-all hover:text-white"
          >
            {sidebarOpen ? '←' : '→'}
          </button>
        </div>

        {sidebarOpen && (
          <>
            {/* Shop Details Card */}
            <div className="p-6 border-b border-gray-700">
              <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-xl p-4 shadow-lg">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h2 className="text-white font-bold text-xl mb-1">{currentShop?.name || 'Shop Name'}</h2>
                    <div className="flex items-center text-green-100 text-xs mb-2">
                      <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                      </svg>
                      {currentShop?.location || 'Location Not Set'}
                    </div>
                  </div>
                  {shops.length > 1 && (
                    <button
                      onClick={() => setShowShopSelector(!showShopSelector)}
                      className="bg-white bg-opacity-20 hover:bg-opacity-30 p-2 rounded-lg transition-all"
                    >
                      <ChevronDown className="h-4 w-4 text-white" />
                    </button>
                  )}
                </div>

                {/* Shop Info Grid */}
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="bg-white bg-opacity-10 rounded-lg p-2">
                    <div className="text-green-100 text-xs">Owner</div>
                    <div className="text-white text-sm font-semibold truncate">{currentShop?.owner_name || 'N/A'}</div>
                  </div>
                  <div className="bg-white bg-opacity-10 rounded-lg p-2">
                    <div className="text-green-100 text-xs">Phone</div>
                    <div className="text-white text-sm font-semibold truncate">{currentShop?.phone || 'N/A'}</div>
                  </div>
                </div>

                {/* Admin Info */}
                <div className="mt-3 pt-3 border-t border-green-400 border-opacity-30">
                  <div className="flex items-center">
                    <div className="bg-white bg-opacity-20 rounded-full p-2 mr-2">
                      <Users className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <div className="text-green-100 text-xs">Admin</div>
                      <div className="text-white text-sm font-semibold">{shopAdmin?.username}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Shop Selector Dropdown */}
              {showShopSelector && shops.length > 1 && (
                <div className="mt-3 bg-gray-800 rounded-lg border border-gray-700 shadow-xl overflow-hidden">
                  {shops.map((shop) => (
                    <button
                      key={shop.id}
                      onClick={() => handleSwitchShop(shop.id)}
                      className={`w-full px-4 py-3 text-left transition-all ${
                        shop.id === currentShopId 
                          ? 'bg-green-600 border-l-4 border-green-400' 
                          : 'hover:bg-gray-700 border-l-4 border-transparent'
                      }`}
                    >
                      <p className="text-sm font-medium text-white truncate">{shop.name}</p>
                      <p className="text-xs text-gray-400 truncate">{shop.location}</p>
                    </button>
                  ))}
                </div>
              )}

              {(!shops || shops.length === 0) && (
                <div className="mt-3 p-3 bg-red-900 bg-opacity-30 border border-red-700 rounded-lg">
                  <p className="text-red-300 text-xs">⚠️ No shops assigned</p>
                </div>
              )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-2">
              {[
                { id: 'overview', label: 'Overview', icon: TrendingUp },
                { id: 'employees', label: 'Employees', icon: Users },
                { id: 'revenue', label: 'Revenue', icon: DollarSign },
                { id: 'report', label: 'Financial Report', icon: AlertCircle }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center group ${
                      activeTab === tab.id
                        ? 'bg-green-600 text-white shadow-lg shadow-green-900/50'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    <Icon className={`h-5 w-5 mr-3 ${activeTab === tab.id ? 'text-white' : 'text-gray-400 group-hover:text-green-400'}`} />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Logout */}
            <div className="p-4 border-t border-gray-700">
              <button
                onClick={handleLogout}
                className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all font-medium shadow-lg flex items-center justify-center"
              >
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          </>
        )}

        {/* Collapsed State */}
        {!sidebarOpen && (
          <nav className="flex-1 px-2 py-6 space-y-3">
            {[
              { id: 'overview', icon: TrendingUp },
              { id: 'employees', icon: Users },
              { id: 'revenue', icon: DollarSign },
              { id: 'report', icon: AlertCircle }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full p-3 rounded-lg transition-all flex items-center justify-center ${
                    activeTab === tab.id
                      ? 'bg-green-600 text-white shadow-lg'
                      : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}
                  title={tab.id}
                >
                  <Icon className="h-5 w-5" />
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {/* Main Content - Add left margin to account for fixed sidebar */}
      <div className={`flex-1 ${sidebarOpen ? 'ml-80' : 'ml-20'} transition-all duration-300 p-8 overflow-y-auto bg-gray-50`}>

        {/* Content based on active tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-gray-600 text-sm font-medium">Today's Revenue</div>
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div className="text-gray-900 text-3xl font-bold">₹{(overview?.todayRevenue || 0).toLocaleString()}</div>
                <div className="text-gray-500 text-xs mt-1">Today's earnings</div>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-gray-600 text-sm font-medium">Pending Repairs</div>
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                </div>
                <div className="text-gray-900 text-3xl font-bold">{overview?.pendingRepairs || 0}</div>
                <div className="text-gray-500 text-xs mt-1">Need attention</div>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-gray-600 text-sm font-medium">Total Mobiles</div>
                  <Package className="h-5 w-5 text-purple-600" />
                </div>
                <div className="text-gray-900 text-3xl font-bold">{overview?.totalMobiles || 0}</div>
                <div className="text-gray-500 text-xs mt-1">All records</div>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-gray-600 text-sm font-medium">Today's Services</div>
                  <Wrench className="h-5 w-5 text-green-600" />
                </div>
                <div className="text-gray-900 text-3xl font-bold">{overview?.todayMobiles || 0}</div>
                <div className="text-gray-500 text-xs mt-1">Added today</div>
              </div>
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Users className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <div className="text-gray-600 text-sm">Employees</div>
                    <div className="text-gray-900 text-2xl font-bold">{overview?.totalEmployees || 0}</div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Users className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <div className="text-gray-600 text-sm">Customers</div>
                    <div className="text-gray-900 text-2xl font-bold">{overview?.totalCustomers || 0}</div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <Wrench className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-gray-600 text-sm">Technicians</div>
                    <div className="text-gray-900 text-2xl font-bold">{overview?.totalTechnicians || 0}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Details Table */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              {/* Table Header */}
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
                <h3 className="text-xl font-bold text-white flex items-center">
                  <Users className="h-6 w-6 mr-2" />
                  Customer Mobile Records
                </h3>
                <p className="text-green-100 text-sm mt-1">Track customer devices and payment status</p>
              </div>

              {/* Filters */}
              <div className="bg-gray-50 p-6 border-b border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                      <Users className="h-4 w-4 mr-1 text-gray-500" />
                      Customer Name
                    </label>
                    <input
                      type="text"
                      placeholder="Search by name..."
                      value={customerFilters.name}
                      onChange={(e) => setCustomerFilters({...customerFilters, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                      <Phone className="h-4 w-4 mr-1 text-gray-500" />
                      Mobile Number
                    </label>
                    <input
                      type="text"
                      placeholder="Search by mobile..."
                      value={customerFilters.mobileNumber}
                      onChange={(e) => setCustomerFilters({...customerFilters, mobileNumber: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                      <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                      From Date
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={customerFilters.fromDate}
                        onChange={(e) => setCustomerFilters({...customerFilters, fromDate: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-gray-900 bg-white"
                        style={{ colorScheme: 'light' }}
                      />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                      <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                      To Date
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={customerFilters.toDate}
                        onChange={(e) => setCustomerFilters({...customerFilters, toDate: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-gray-900 bg-white"
                        style={{ colorScheme: 'light' }}
                      />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleCustomerFilter}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition flex items-center"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Apply Filters
                  </button>
                  <button
                    onClick={handleClearFilters}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Table */}
              {filteredCustomers.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-200">
                            S.No
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-200">
                            <div className="flex items-center">
                              <Users className="h-4 w-4 mr-2 text-green-600" />
                              Customer/Dealer Name
                            </div>
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-200">
                            <div className="flex items-center">
                              <Phone className="h-4 w-4 mr-2 text-green-600" />
                              Mobile Number
                            </div>
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-200">
                            <div className="flex items-center">
                              <Package className="h-4 w-4 mr-2 text-purple-600" />
                              Total Mobiles
                            </div>
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-200">
                            <div className="flex items-center">
                              <DollarSign className="h-4 w-4 mr-2 text-emerald-600" />
                              Paid Amount
                            </div>
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-200">
                            <div className="flex items-center">
                              <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                              Ready
                            </div>
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-200">
                            <div className="flex items-center">
                              <XCircle className="h-4 w-4 mr-2 text-red-600" />
                              Not Ready
                            </div>
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-200">
                            <div className="flex items-center">
                              <Truck className="h-4 w-4 mr-2 text-indigo-600" />
                              Delivered
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentCustomers.map((customer, index) => (
                          <tr
                            key={customer._id || index}
                            className={`hover:bg-green-50 transition-colors ${
                              index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                            }`}
                          >
                            <td className="px-6 py-4 border-b border-gray-200">
                              <span className="inline-flex items-center justify-center w-8 h-8 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                                {indexOfFirstItem + index + 1}
                              </span>
                            </td>
                            <td className="px-6 py-4 border-b border-gray-200">
                              <div className="font-semibold text-gray-800">{customer.client_name}</div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {customer.customer_type === 'Customer' ? 'Customer' : 'Dealer'}
                              </div>
                            </td>
                            <td className="px-6 py-4 border-b border-gray-200">
                              <span className="text-sm text-gray-700">{customer.mobile_number || 'N/A'}</span>
                            </td>
                            <td className="px-6 py-4 border-b border-gray-200">
                              <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold">
                                {customer.total_mobiles || 0}
                              </span>
                            </td>
                            <td className="px-6 py-4 border-b border-gray-200">
                              <span className="text-lg font-bold text-green-600">
                                ₹{(customer.total_paid || 0).toLocaleString()}
                              </span>
                            </td>
                            <td className="px-6 py-4 border-b border-gray-200">
                              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                                {customer.ready_count || 0}
                              </span>
                            </td>
                            <td className="px-6 py-4 border-b border-gray-200">
                              <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold">
                                {customer.not_ready_count || 0}
                              </span>
                            </td>
                            <td className="px-6 py-4 border-b border-gray-200">
                              <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-semibold">
                                {customer.delivered_count || 0}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredCustomers.length)} of {filteredCustomers.length} customers
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <div className="flex items-center gap-1">
                        {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                          const pageNum = i + 1;
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`px-3 py-2 rounded-lg text-sm font-medium ${
                                currentPage === pageNum
                                  ? 'bg-green-600 text-white'
                                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center">
                  <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">No customer records found</p>
                  <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
                </div>
              )}
            </div>

            {!overview && !loading && (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <p className="text-gray-600">No overview data available</p>
                <button 
                  onClick={fetchDashboardData}
                  className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                >
                  Refresh Data
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'employees' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">Employees ({employees?.length || 0})</h2>
              <button 
                onClick={() => {
                  fetchDashboardData();
                  setSelectedEmployee(null);
                  setEmployeeAttendance(null);
                }}
                className="px-4 py-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg text-sm font-medium transition"
              >
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Employee List */}
              <div className="lg:col-span-1">
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-lg">
                  <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3">
                    <h3 className="text-white font-semibold">Employee List</h3>
                  </div>
                  {employees && employees.length > 0 ? (
                    <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
                      {employees.map((emp) => (
                        <div
                          key={emp._id}
                          onClick={() => handleEmployeeClick(emp)}
                          className={`p-4 cursor-pointer transition ${
                            selectedEmployee?._id === emp._id
                              ? 'bg-green-50 border-l-4 border-green-600'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="text-gray-800 font-medium">{emp.name || 'No Name'}</div>
                              <div className="text-gray-500 text-xs mt-1">{emp.phone_number || 'N/A'}</div>
                              {emp.salary && (
                                <div className="text-gray-600 text-sm mt-1">₹{emp.salary.toLocaleString()}</div>
                              )}
                              {emp.stats && (
                                <div className="mt-2 flex gap-2">
                                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                                    {emp.stats.presentDays}P
                                  </span>
                                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                                    {emp.stats.absentDays}A
                                  </span>
                                </div>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEmployeeToDelete(emp);
                                setShowDeleteModal(true);
                              }}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded transition"
                              title="Delete Employee"
                            >
                              <XCircle className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-12 text-center">
                      <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-600 text-sm">No employees found</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Employee Details & Analytics */}
              <div className="lg:col-span-2">
                {selectedEmployee ? (
                  <div className="space-y-4">
                    {/* Employee Info Card */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-2xl font-bold text-gray-800">{selectedEmployee.name}</h3>
                          <p className="text-gray-600 mt-1">{selectedEmployee.phone_number}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600">Monthly Salary</div>
                          <div className="text-2xl font-bold text-green-600">
                            ₹{(selectedEmployee.salary || 0).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mt-4">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="text-gray-600 text-xs">Address</div>
                          <div className="text-gray-800 text-sm font-medium mt-1">
                            {selectedEmployee.address || 'N/A'}
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="text-gray-600 text-xs">Aadhar</div>
                          <div className="text-gray-800 text-sm font-medium mt-1">
                            {selectedEmployee.aadhar_number || 'N/A'}
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="text-gray-600 text-xs">Blood Group</div>
                          <div className="text-gray-800 text-sm font-medium mt-1">
                            {selectedEmployee.blood_group || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Date Filter */}
                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-gray-800 font-bold">Attendance Filters</h4>
                        <button
                          onClick={handleRefreshAttendance}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-1"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                          </svg>
                          Refresh
                        </button>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                          <div className="relative">
                            <input
                              type="date"
                              value={attendanceFilters.fromDate}
                              onChange={(e) => setAttendanceFilters({...attendanceFilters, fromDate: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-gray-900 bg-white"
                              style={{ colorScheme: 'light' }}
                            />
                            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                          <div className="relative">
                            <input
                              type="date"
                              value={attendanceFilters.toDate}
                              onChange={(e) => setAttendanceFilters({...attendanceFilters, toDate: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-gray-900 bg-white"
                              style={{ colorScheme: 'light' }}
                            />
                            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                          </div>
                        </div>
                        <div className="flex gap-2 items-end">
                          <button
                            onClick={handleAttendanceFilter}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition"
                          >
                            Apply
                          </button>
                          <button
                            onClick={handleClearAttendanceFilters}
                            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Attendance Analytics */}
                    {employeeAttendance ? (
                      <div className="space-y-4">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-gray-600 text-sm font-medium">Present Days</div>
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            </div>
                            <div className="text-gray-900 text-3xl font-bold">{employeeAttendance.presentDays}</div>
                            <div className="text-green-600 text-xs mt-1">{employeeAttendance.attendanceRate}% attendance</div>
                          </div>
                          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-gray-600 text-sm font-medium">Absent Days</div>
                              <XCircle className="h-5 w-5 text-red-600" />
                            </div>
                            <div className="text-gray-900 text-3xl font-bold">{employeeAttendance.absentDays}</div>
                            <div className="text-gray-500 text-xs mt-1">Out of {employeeAttendance.totalDays} days</div>
                          </div>
                          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-gray-600 text-sm font-medium">Permission Hours</div>
                              <AlertCircle className="h-5 w-5 text-orange-600" />
                            </div>
                            <div className="text-gray-900 text-3xl font-bold">{employeeAttendance.totalPermissionHours}</div>
                            <div className="text-gray-500 text-xs mt-1">{employeeAttendance.permissionCount} permissions</div>
                          </div>
                        </div>

                        {/* Attendance Chart */}
                        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg">
                          <h4 className="text-gray-800 font-bold mb-4">Daily Attendance</h4>
                          <div className="space-y-2 max-h-96 overflow-y-auto">
                            {employeeAttendance.dailyRecords && employeeAttendance.dailyRecords.length > 0 ? (
                              employeeAttendance.dailyRecords.map((record, idx) => (
                                <div key={idx} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                                  <div className="text-gray-600 text-sm font-medium w-24">{record.date}</div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      {record.status === 'present' ? (
                                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                                          Present
                                        </span>
                                      ) : (
                                        <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                                          Absent
                                        </span>
                                      )}
                                      {record.permissionHours > 0 && (
                                        <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">
                                          Permission: {record.permissionHours}h
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="w-32">
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                      <div 
                                        className={`h-2 rounded-full ${
                                          record.status === 'present' ? 'bg-green-500' : 'bg-red-500'
                                        }`}
                                        style={{ width: record.status === 'present' ? '100%' : '0%' }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-8 text-gray-500">No attendance records found</div>
                            )}
                          </div>
                        </div>

                        {/* Permission Details */}
                        {employeeAttendance.permissions && employeeAttendance.permissions.length > 0 && (
                          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg">
                            <h4 className="text-gray-800 font-bold mb-4">Permission Details</h4>
                            <div className="space-y-2">
                              {employeeAttendance.permissions.map((perm, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                                  <div>
                                    <div className="text-gray-800 font-medium">{perm.date}</div>
                                    <div className="text-gray-600 text-xs mt-1">
                                      {perm.start_time} - {perm.end_time || 'Ongoing'}
                                    </div>
                                  </div>
                                  <div className="text-orange-700 font-bold">{perm.duration_hours}h</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-lg">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading attendance data...</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-lg h-full flex items-center justify-center">
                    <div>
                      <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600 text-lg mb-2">Select an Employee</p>
                      <p className="text-gray-500 text-sm">Click on an employee to view their attendance details</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteModal && employeeToDelete && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-red-100 rounded-full">
                      <AlertCircle className="h-6 w-6 text-red-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800">Delete Employee</h3>
                  </div>
                  <p className="text-gray-600 mb-6">
                    Are you sure you want to delete <strong>{employeeToDelete.name}</strong>? 
                    This action cannot be undone and will remove all attendance records.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowDeleteModal(false);
                        setEmployeeToDelete(null);
                      }}
                      className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDeleteEmployee(employeeToDelete._id)}
                      className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'revenue' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                    <DollarSign className="h-7 w-7 mr-3 text-green-600" />
                    Financial Analytics
                  </h2>
                  <p className="text-gray-600 text-sm mt-1">Revenue, Expenses & Profit Overview</p>
                </div>
                <button 
                  onClick={() => fetchAnalytics('revenue')}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                  </svg>
                  Refresh
                </button>
              </div>

              {/* Date Filters */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Quick Select</label>
                    <select
                      value={revenueFilters.period}
                      onChange={(e) => {
                        setRevenueFilters({ period: e.target.value, fromDate: '', toDate: '' });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    >
                      <option value="7" className="text-gray-900">Last 7 Days</option>
                      <option value="30" className="text-gray-900">Last 30 Days</option>
                      <option value="60" className="text-gray-900">Last 60 Days</option>
                      <option value="90" className="text-gray-900">Last 90 Days</option>
                      <option value="180" className="text-gray-900">Last 6 Months</option>
                      <option value="365" className="text-gray-900">Last Year</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                      From Date
                    </label>
                    <input
                      type="date"
                      value={revenueFilters.fromDate}
                      onChange={(e) => setRevenueFilters({ ...revenueFilters, fromDate: e.target.value, period: '' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-gray-900 bg-white"
                      style={{ colorScheme: 'light' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                      To Date
                    </label>
                    <input
                      type="date"
                      value={revenueFilters.toDate}
                      onChange={(e) => setRevenueFilters({ ...revenueFilters, toDate: e.target.value, period: '' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-gray-900 bg-white"
                      style={{ colorScheme: 'light' }}
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      onClick={() => fetchAnalytics('revenue')}
                      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                    >
                      <Filter className="h-4 w-4" />
                      Apply
                    </button>
                    <button
                      onClick={() => {
                        setRevenueFilters({ period: '30', fromDate: '', toDate: '' });
                        setTimeout(() => fetchAnalytics('revenue'), 100);
                      }}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {!analytics ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-lg">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
                <p className="text-gray-600 text-lg">Loading financial data...</p>
              </div>
            ) : (
              <>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition group">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-gray-600 text-sm font-medium">Total Revenue</div>
                  <div className="bg-gradient-to-r from-green-400 to-emerald-500 p-2 rounded-lg">
                    <TrendingUp className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="text-gray-900 text-3xl font-bold group-hover:scale-105 transition">
                  ₹{analytics?.revenue?.thisMonth?.toLocaleString() || 0}
                </div>
                <div className="mt-2 flex items-center text-sm">
                  <span className="text-green-600 text-xs">Customer & Dealer Payments</span>
                </div>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition group">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-gray-600 text-sm font-medium">Total Expenses</div>
                  <div className="bg-gradient-to-r from-red-400 to-red-600 p-2 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="text-gray-900 text-3xl font-bold group-hover:scale-105 transition">
                  ₹{((analytics?.revenue?.thisMonth || 0) * 0.6).toLocaleString()}
                </div>
                <div className="mt-2 flex items-center text-sm">
                  <span className="text-red-600 text-xs">Supplier Payments & Expenses</span>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition group">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-gray-600 text-sm font-medium">Net Profit</div>
                  <div className="bg-gradient-to-r from-green-400 to-green-600 p-2 rounded-lg">
                    <DollarSign className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="text-gray-900 text-3xl font-bold group-hover:scale-105 transition">
                  ₹{((analytics?.revenue?.thisMonth || 0) * 0.4).toLocaleString()}
                </div>
                <div className="mt-2 flex items-center text-sm">
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-green-600 font-semibold">40% Margin</span>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition group">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-gray-600 text-sm font-medium">Today's Revenue</div>
                  <div className="bg-gradient-to-r from-purple-400 to-purple-600 p-2 rounded-lg">
                    <Calendar className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="text-gray-900 text-3xl font-bold group-hover:scale-105 transition">
                  ₹{overview?.todayRevenue?.toLocaleString() || 0}
                </div>
                <div className="mt-2 flex items-center text-sm">
                  <span className="text-purple-600 text-xs">From {overview?.todayMobiles || 0} services</span>
                </div>
              </div>
            </div>

            {/* Main Histogram Chart */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-800 mb-2 flex items-center">
                  <div className="bg-gradient-to-r from-green-400 to-blue-500 p-2 rounded-lg mr-3">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  Revenue, Expense & Profit Analysis
                </h3>
                <p className="text-gray-600 text-sm ml-14">Daily financial breakdown with customer payments, supplier costs, and operating expenses</p>
              </div>
              
              {analytics?.revenue?.dailyData && analytics.revenue.dailyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={500}>
                  <BarChart 
                    data={analytics.revenue.dailyData.map(day => ({
                      date: day.date,
                      'Customer Payments': day.revenue || 0,
                      'Supplier Payments': ((day.revenue || 0) * 0.35),
                      'Operating Expenses': ((day.revenue || 0) * 0.25),
                      'Net Profit': ((day.revenue || 0) * 0.4)
                    }))}
                    margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#6b7280" 
                      fontSize={11}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tick={{ fill: '#374151' }}
                    />
                    <YAxis 
                      stroke="#6b7280" 
                      fontSize={12}
                      tick={{ fill: '#374151' }}
                      label={{ value: 'Amount (₹)', angle: -90, position: 'insideLeft', style: { fill: '#374151' } }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                        padding: '12px'
                      }}
                      formatter={(value) => `₹${value?.toLocaleString()}`}
                      labelStyle={{ fontWeight: 'bold', marginBottom: '8px' }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      iconType="rect"
                    />
                    <Bar 
                      dataKey="Customer Payments" 
                      fill="#10B981" 
                      name="Revenue (Customer/Dealer Payments)" 
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar 
                      dataKey="Supplier Payments" 
                      fill="#EF4444" 
                      name="Expenses (Supplier Payments)" 
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar 
                      dataKey="Operating Expenses" 
                      fill="#F59E0B" 
                      name="Expenses (Operating Costs)" 
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar 
                      dataKey="Net Profit" 
                      fill="#3B82F6" 
                      name="Net Profit" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[500px] flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <DollarSign className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <p>No financial data available for the selected period</p>
                  </div>
                </div>
              )}
            </div>

            {/* Financial Breakdown Legend */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-6 shadow-sm">
              <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <AlertCircle className="h-5 w-5 mr-2 text-gray-600" />
                Financial Components Breakdown
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4 border-l-4 border-green-500">
                  <div className="flex items-center mb-2">
                    <div className="w-4 h-4 bg-green-500 rounded mr-2"></div>
                    <span className="font-semibold text-gray-800">Revenue (Customer/Dealer Payments)</span>
                  </div>
                  <p className="text-gray-600 text-sm">Total income from customer payments and dealer transactions for repairs and services</p>
                </div>
                <div className="bg-white rounded-lg p-4 border-l-4 border-red-500">
                  <div className="flex items-center mb-2">
                    <div className="w-4 h-4 bg-red-500 rounded mr-2"></div>
                    <span className="font-semibold text-gray-800">Supplier Payments</span>
                  </div>
                  <p className="text-gray-600 text-sm">Payments made to suppliers for parts, materials, and inventory purchases</p>
                </div>
                <div className="bg-white rounded-lg p-4 border-l-4 border-orange-500">
                  <div className="flex items-center mb-2">
                    <div className="w-4 h-4 bg-orange-500 rounded mr-2"></div>
                    <span className="font-semibold text-gray-800">Operating Expenses</span>
                  </div>
                  <p className="text-gray-600 text-sm">Daily operational costs including rent, utilities, salaries, and other business expenses</p>
                </div>
                <div className="bg-white rounded-lg p-4 border-l-4 border-green-500">
                  <div className="flex items-center mb-2">
                    <div className="w-4 h-4 bg-green-500 rounded mr-2"></div>
                    <span className="font-semibold text-gray-800">Net Profit</span>
                  </div>
                  <p className="text-gray-600 text-sm">Final profit after deducting all expenses from total revenue</p>
                </div>
              </div>
            </div>
            </>
            )}
          </div>
        )}

        {activeTab === 'report' && (
          <div className="space-y-6">
            {/* Filter Section - Not printed */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 print:hidden">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                    <AlertCircle className="h-7 w-7 mr-3 text-green-600" />
                    Financial Report
                  </h2>
                  <p className="text-gray-600 text-sm mt-1">Comprehensive financial analysis and report</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={handlePrintReport}
                    disabled={!reportData}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 6 2 18 2 18 9"></polyline>
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                      <rect x="6" y="14" width="12" height="8"></rect>
                    </svg>
                    Print Report
                  </button>
                </div>
              </div>

              {/* Date Filters */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Report Period</label>
                    <select
                      value={reportFilters.period}
                      onChange={(e) => setReportFilters({ period: e.target.value, fromDate: '', toDate: '' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    >
                      <option value="7" className="text-gray-900">Last 7 Days</option>
                      <option value="30" className="text-gray-900">Last 30 Days</option>
                      <option value="60" className="text-gray-900">Last 60 Days</option>
                      <option value="90" className="text-gray-900">Last 90 Days</option>
                      <option value="180" className="text-gray-900">Last 6 Months</option>
                      <option value="365" className="text-gray-900">Last Year</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                      From Date
                    </label>
                    <input
                      type="date"
                      value={reportFilters.fromDate}
                      onChange={(e) => setReportFilters({ ...reportFilters, fromDate: e.target.value, period: '' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      style={{ colorScheme: 'light' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                      To Date
                    </label>
                    <input
                      type="date"
                      value={reportFilters.toDate}
                      onChange={(e) => setReportFilters({ ...reportFilters, toDate: e.target.value, period: '' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      style={{ colorScheme: 'light' }}
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      onClick={fetchFinancialReport}
                      disabled={loadingReport}
                      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition"
                    >
                      {loadingReport ? 'Loading...' : 'Generate'}
                    </button>
                    <button
                      onClick={() => {
                        setReportFilters({ period: '30', fromDate: '', toDate: '' });
                        setReportData(null);
                      }}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Report Content - Will be printed */}
            {reportData && (
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 print:shadow-none print:border-0">
                {/* Report Header */}
                <div className="p-8 border-b border-gray-200">
                  <div className="text-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">FINANCIAL REPORT</h1>
                    <h2 className="text-xl font-semibold text-gray-700">{currentShop?.name}</h2>
                    <p className="text-gray-600 mt-1">{currentShop?.location}</p>
                    <div className="mt-4 text-sm text-gray-600">
                      <p>Report Period: <span className="font-semibold">{reportData.periodStart} to {reportData.periodEnd}</span></p>
                      <p>Generated On: <span className="font-semibold">{new Date().toLocaleDateString('en-IN')}</span></p>
                    </div>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="p-8 border-b border-gray-200">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">FINANCIAL SUMMARY</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="text-sm text-green-700 font-medium">Total Revenue</div>
                      <div className="text-2xl font-bold text-green-900 mt-1">₹{reportData.summary?.totalRevenue?.toLocaleString() || 0}</div>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                      <div className="text-sm text-red-700 font-medium">Total Expenses</div>
                      <div className="text-2xl font-bold text-red-900 mt-1">₹{reportData.summary?.totalExpenses?.toLocaleString() || 0}</div>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="text-sm text-green-700 font-medium">Net Profit</div>
                      <div className="text-2xl font-bold text-green-900 mt-1">₹{reportData.summary?.netProfit?.toLocaleString() || 0}</div>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="text-sm text-purple-700 font-medium">Profit Margin</div>
                      <div className="text-2xl font-bold text-purple-900 mt-1">{reportData.summary?.profitMargin?.toFixed(1) || 0}%</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                      <div className="text-sm text-emerald-700 font-medium">Customer Payments</div>
                      <div className="text-xl font-bold text-emerald-900 mt-1">₹{reportData.summary?.totalCustomerPayments?.toLocaleString() || 0}</div>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="text-sm text-blue-700 font-medium">Dealer Payments</div>
                      <div className="text-xl font-bold text-blue-900 mt-1">₹{reportData.summary?.totalDealerPayments?.toLocaleString() || 0}</div>
                    </div>
                  </div>
                </div>

                {/* Customer Payments */}
                {reportData.customerPayments && reportData.customerPayments.length > 0 && (
                  <div className="p-8 border-b border-gray-200">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">CUSTOMER PAYMENTS</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100 border-b border-gray-300">
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">S.No</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Customer Name</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Mobile/Device</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Payment Method</th>
                            <th className="px-4 py-3 text-right font-semibold text-gray-700">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.customerPayments.map((payment, idx) => (
                            <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                              <td className="px-4 py-3 text-gray-900">{idx + 1}</td>
                              <td className="px-4 py-3 text-gray-900">{new Date(payment.date).toLocaleDateString('en-IN')}</td>
                              <td className="px-4 py-3 font-medium text-gray-900">{payment.customerName}</td>
                              <td className="px-4 py-3 text-gray-900">{payment.mobileName}</td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                                  {payment.paymentMethod || 'N/A'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-green-700">₹{payment.amount?.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-100 font-bold">
                            <td colSpan="5" className="px-4 py-3 text-right text-gray-900">TOTAL CUSTOMER PAYMENTS:</td>
                            <td className="px-4 py-3 text-right text-green-700">₹{reportData.summary?.totalCustomerPayments?.toLocaleString()}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Dealer Payments */}
                {reportData.dealerPayments && reportData.dealerPayments.length > 0 && (
                  <div className="p-8 border-b border-gray-200">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">DEALER PAYMENTS</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100 border-b border-gray-300">
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">S.No</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Dealer Name</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Mobile/Device</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Payment Method</th>
                            <th className="px-4 py-3 text-right font-semibold text-gray-700">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.dealerPayments.map((payment, idx) => (
                            <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                              <td className="px-4 py-3 text-gray-900">{idx + 1}</td>
                              <td className="px-4 py-3 text-gray-900">{new Date(payment.date).toLocaleDateString('en-IN')}</td>
                              <td className="px-4 py-3 font-medium text-gray-900">{payment.dealerName}</td>
                              <td className="px-4 py-3 text-gray-900">{payment.mobileName}</td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                  {payment.paymentMethod || 'N/A'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-blue-700">₹{payment.amount?.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-100 font-bold">
                            <td colSpan="5" className="px-4 py-3 text-right text-gray-900">TOTAL DEALER PAYMENTS:</td>
                            <td className="px-4 py-3 text-right text-blue-700">₹{reportData.summary?.totalDealerPayments?.toLocaleString()}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Supplier Payments */}
                {reportData.supplierPayments && reportData.supplierPayments.length > 0 && (
                  <div className="p-8 border-b border-gray-200">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">SUPPLIER PAYMENTS</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100 border-b border-gray-300">
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">S.No</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Supplier Name</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Product/Part</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Payment Method</th>
                            <th className="px-4 py-3 text-right font-semibold text-gray-700">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.supplierPayments.map((payment, idx) => (
                            <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                              <td className="px-4 py-3 text-gray-900">{idx + 1}</td>
                              <td className="px-4 py-3 text-gray-900">{new Date(payment.date).toLocaleDateString('en-IN')}</td>
                              <td className="px-4 py-3 font-medium text-gray-900">{payment.supplierName}</td>
                              <td className="px-4 py-3 text-gray-900">{payment.productName}</td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">
                                  {payment.paymentMethod || 'N/A'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-red-700">₹{payment.amount?.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-100 font-bold">
                            <td colSpan="5" className="px-4 py-3 text-right text-gray-900">TOTAL SUPPLIER PAYMENTS:</td>
                            <td className="px-4 py-3 text-right text-red-700">₹{reportData.summary?.totalSupplierPayments?.toLocaleString()}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Operating Expenses */}
                {reportData.expenses && reportData.expenses.length > 0 && (
                  <div className="p-8 border-b border-gray-200">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">OPERATING EXPENSES</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100 border-b border-gray-300">
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">S.No</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Category</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Description</th>
                            <th className="px-4 py-3 text-right font-semibold text-gray-700">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.expenses.map((expense, idx) => (
                            <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                              <td className="px-4 py-3 text-gray-900">{idx + 1}</td>
                              <td className="px-4 py-3 text-gray-900">{new Date(expense.date).toLocaleDateString('en-IN')}</td>
                              <td className="px-4 py-3 font-medium text-gray-900">{expense.category}</td>
                              <td className="px-4 py-3 text-gray-900">{expense.description}</td>
                              <td className="px-4 py-3 text-right font-semibold text-red-700">₹{expense.amount?.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-100 font-bold">
                            <td colSpan="4" className="px-4 py-3 text-right text-gray-900">TOTAL OPERATING EXPENSES:</td>
                            <td className="px-4 py-3 text-right text-red-700">₹{reportData.summary?.totalOperatingExpenses?.toLocaleString()}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Payment Method Breakdown */}
                <div className="p-8">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">PAYMENT METHOD BREAKDOWN</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {reportData.paymentBreakdown?.map((payment, idx) => (
                      <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="text-sm text-gray-600 font-medium">{payment.method}</div>
                        <div className="text-xl font-bold text-gray-900 mt-1">₹{payment.total?.toLocaleString()}</div>
                        <div className="text-xs text-gray-500 mt-1">{payment.count} transactions</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="p-8 bg-gray-50 border-t border-gray-200 text-center text-sm text-gray-600">
                  <p>This is a computer-generated report and does not require a signature.</p>
                  <p className="mt-1">For queries, please contact: {currentShop?.phone || 'N/A'}</p>
                </div>
              </div>
            )}

            {!reportData && !loadingReport && (
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-12 text-center">
                <AlertCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-lg">No report generated yet</p>
                <p className="text-gray-500 text-sm mt-2">Select a time period and click "Generate" to create your financial report</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

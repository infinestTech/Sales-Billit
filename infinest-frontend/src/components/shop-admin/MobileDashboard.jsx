"use client";

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import axios from 'axios';
import {
  Users, Phone, Calendar, Filter, Search, ChevronDown,
  TrendingUp, Package, Wrench, DollarSign, CheckCircle,
  XCircle, Truck, AlertCircle, Menu, X, Home,
  BarChart3, FileText, LogOut, ChevronLeft, ChevronRight, Wallet,
  ShoppingBag, Settings, Store, ArrowLeft, Fingerprint, UserPlus, Send, MapPin
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import * as XLSX from 'xlsx';
import { buildVisibleNav, isTabAllowed, findNavEntry } from './shopAdminNav';

const SalesOverview = dynamic(() => import('./sales/SalesOverview'), { ssr: false });
const SalesWorkspace = dynamic(() => import('./sales/SalesWorkspace'), { ssr: false });
const BusinessAnalytics = dynamic(() => import('./BusinessAnalytics'), { ssr: false });
const EmployeeManagement = dynamic(() => import('./EmployeeManagement'), { ssr: false });
const AttendanceManagement = dynamic(() => import('./AttendanceManagement'), { ssr: false });
const SalaryManagement = dynamic(() => import('./SalaryManagement'), { ssr: false });
const EmployeePerformance = dynamic(() => import('./EmployeePerformance'), { ssr: false });
const AllRecordsPanel = dynamic(() => import('./panels/AllRecordsPanel'), { ssr: false });
const CreateCustomerPanel = dynamic(() => import('./panels/CreateCustomerPanel'), { ssr: false });
const CreateDealerPanel = dynamic(() => import('./panels/CreateDealerPanel'), { ssr: false });
const SuppliersPanel = dynamic(() => import('./panels/SuppliersPanel'), { ssr: false });
const ReceiptTermsImages = dynamic(() => import('./ReceiptTermsImages'), { ssr: false });
const EsslDeviceSettings = dynamic(() => import('./EsslDeviceSettings'), { ssr: false });

// Mobile-only screens layered on top of the shared desktop tab ids
const HUBS = {
  'hub-service': { title: 'Service', subtitle: 'Repairs, records, suppliers & reports', groups: ['records', 'suppliers', 'reports'] },
  'hub-sales': { title: 'Sales', subtitle: 'Inventory, branches & finance', groups: ['sales-inventory', 'sales-branches', 'sales-finance'] },
  'hub-hr': { title: 'HR', subtitle: 'Staff, attendance, payroll & performance', groups: ['hr'] },
};
const HR_TABS = ['hr-employees', 'hr-attendance', 'salary', 'hr-performance'];

// Bottom-tab "home" for any screen, used for the back button and active-tab highlight
function rootOf(tab) {
  if (HUBS[tab] || tab === 'overview') return tab;
  const found = findNavEntry(tab);
  if (!found?.group) return 'overview';
  if (found.group.key === 'hr') return 'hub-hr';
  return found.group.product === 'sales' ? 'hub-sales' : 'hub-service';
}

const ACCENTS = {
  green: { tile: 'bg-emerald-50 text-emerald-700', ring: 'focus-visible:ring-emerald-500', text: 'text-emerald-700' },
  indigo: { tile: 'bg-indigo-50 text-indigo-700', ring: 'focus-visible:ring-indigo-500', text: 'text-indigo-700' },
  amber: { tile: 'bg-amber-50 text-amber-700', ring: 'focus-visible:ring-amber-500', text: 'text-amber-700' },
};

function SectionTitle({ icon: Icon, title, accent = 'green', action, onAction }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${ACCENTS[accent].tile}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        {title}
      </h2>
      {action && (
        <button
          type="button"
          onClick={onAction}
          className={`flex items-center gap-0.5 rounded-lg px-2 py-1.5 text-sm font-medium ${ACCENTS[accent].text} focus:outline-none focus-visible:ring-2 ${ACCENTS[accent].ring}`}
        >
          {action} <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function NavTile({ item, accent = 'green', onClick }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[88px] flex-col items-start gap-2 rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 ${ACCENTS[accent].ring}`}
    >
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${ACCENTS[accent].tile}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span>
        <span className="block text-sm font-semibold leading-tight text-gray-900">{item.label}</span>
        {item.desc && <span className="mt-0.5 block text-xs leading-snug text-gray-500">{item.desc}</span>}
      </span>
    </button>
  );
}

function StatTile({ label, value, hint, icon: Icon, iconClass, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="rounded-xl border border-gray-200 bg-white p-3.5 text-left shadow-sm transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:active:scale-100"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <Icon className={`h-4 w-4 ${iconClass}`} aria-hidden="true" />
      </div>
      <div className="mt-1.5 text-2xl font-bold text-gray-900">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-gray-500">{hint}</div>}
    </button>
  );
}

function Toggle({ checked, disabled, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
        checked ? 'bg-emerald-500' : 'bg-gray-300'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

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
  customerTotalCount: initialTotalCount = 0,
  setCustomerTotalCount: setParentTotalCount,
  selectedEmployee,
  setSelectedEmployee,
  employeeAttendance,
  reportData,
  loading,
  fetchDashboardData,
  fetchEmployeeAttendance,
  fetchFinancialReport,
  handleLogout,
  handleSwitchShop,
  productAccess,
  salesSession,
  settings = {}
}) {
  const hasService = productAccess ? !!productAccess.service : true;
  const hasSales = !!productAccess?.sales;
  const isCombo = hasService && hasSales;
  const visibleNav = useMemo(() => buildVisibleNav(productAccess || { service: true, sales: false }), [productAccess]);
  const [activeTab, setActiveTab] = useState('overview');
  const [hrUnit, setHrUnit] = useState('all');
  const effectiveHrUnit = isCombo ? hrUnit : (hasSales ? 'sales' : 'service');

  const isMobileTabAllowed = (tab) => {
    if (tab === 'settings' || tab === 'hub-hr') return true;
    if (tab === 'hub-service') return hasService;
    if (tab === 'hub-sales') return hasSales;
    return isTabAllowed(tab, visibleNav);
  };

  // Never leave the admin on a screen their plan doesn't include (e.g. after switching shops)
  useEffect(() => {
    if (!isMobileTabAllowed(activeTab)) setActiveTab('overview');
  }, [visibleNav, activeTab]);

  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showShopSelector, setShowShopSelector] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null);

  const navigate = (tab) => {
    if (!isMobileTabAllowed(tab)) return;
    setActiveTab(tab);
    setShowMobileMenu(false);
    setShowShopSelector(false);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  };

  // Lock page scroll behind the open drawer
  useEffect(() => {
    if (!showMobileMenu) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setShowMobileMenu(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [showMobileMenu]);

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
  const [customerTotalCount, setCustomerTotalCount] = useState(initialTotalCount);

  useEffect(() => { setCustomerTotalCount(initialTotalCount); }, [initialTotalCount]);

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

  const [localAnalytics, setLocalAnalytics] = useState(null);
  const [localReportData, setLocalReportData] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportFormat, setReportFormat] = useState('pdf');

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
      // Use local date formatting (IST) to match server-side IST date keys
      const getLocalDateKey = (d) => {
        const dt = new Date(d);
        return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
      };
      const today = getLocalDateKey(new Date());
      const weekAgo = getLocalDateKey(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
      const monthAgo = getLocalDateKey(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

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

  const handleExcelReport = () => {
    const reportToUse = localReportData || reportData;
    if (!reportToUse) return;
    const currentShop = shops.find(s => s.id === currentShopId);
    const shopName = (currentShop?.name || 'Shop').toUpperCase();

    const periodStart = reportToUse.periodStart || '';
    const periodEnd = reportToUse.periodEnd || '';
    const dateLabel = periodStart === periodEnd
      ? `DAILY SHEET FOR ${periodStart}`
      : `SHEET FOR ${periodStart} TO ${periodEnd}`;

    // Payment method breakdown helper
    const getPaymentColumns = (method, amount) => {
      const m = (method || '').toLowerCase().trim();
      const amt = amount || 0;
      const half = Math.round(amt / 2);
      const otherHalf = amt - half;

      if (m === 'cash') return { cash: amt, gpay: '', card: '' };
      if (m === 'upi' || m === 'upi-h' || m === 'upi-s' || m === 'gpay' || m === 'gpay-h' || m === 'gpay-s') return { cash: '', gpay: amt, card: '' };
      if (m === 'card') return { cash: '', gpay: '', card: amt };
      if (m === 'cash + card') return { cash: half, gpay: '', card: otherHalf };
      if (m === 'upi h + cash' || m === 'upi s + cash' || m === 'gpay h + cash' || m === 'gpay s + cash') return { cash: otherHalf, gpay: half, card: '' };
      if (m === 'upi h + card' || m === 'upi s + card' || m === 'gpay h + card' || m === 'gpay s + card') return { cash: '', gpay: half, card: otherHalf };
      return { cash: amt, gpay: '', card: '' };
    };

    const headers = ['S.No.', 'Customer Name', 'Contact No', 'BRAND', 'MODEL', 'COMPLIENT', 'TOTAL', 'CASH', 'G PAY', 'CARD', 'Supplier', 'cost'];

    // Admin sheet
    const adminRows = [];
    adminRows.push([shopName]);
    adminRows.push([]);
    adminRows.push([dateLabel]);
    adminRows.push(headers);

    if (reportToUse.customerPayments && reportToUse.customerPayments.length > 0) {
      reportToUse.customerPayments.forEach((payment, idx) => {
        const brand = payment.brand || '';
        const model = payment.model || '';
        const { cash, gpay, card } = getPaymentColumns(payment.paymentMethod, payment.amount);
        adminRows.push([
          idx + 1,
          payment.customerName || '',
          payment.customerPhone || '',
          brand,
          model,
          payment.issue || '',
          payment.amount || 0,
          cash,
          gpay,
          card,
          '',
          ''
        ]);
      });
    }

    const dataRows = reportToUse.customerPayments?.length || 0;
    for (let i = dataRows; i < 20; i++) {
      adminRows.push(['', '', '', '', '', '', '', '', '', '', '', '']);
    }

    adminRows.push([]);
    adminRows.push(['EXPENSES PAID']);
    adminRows.push(['S.No.', 'Description', 'Category', '', 'Amount']);
    if (reportToUse.expenses && reportToUse.expenses.length > 0) {
      reportToUse.expenses.forEach((expense, idx) => {
        adminRows.push([idx + 1, expense.description || '', expense.category || '', '', expense.amount || 0]);
      });
    } else {
      for (let i = 0; i < 5; i++) {
        adminRows.push(['', '', '', '', '']);
      }
    }

    // User sheet
    const userRows = [];
    userRows.push([shopName]);
    userRows.push([]);
    userRows.push([dateLabel]);
    userRows.push(headers);

    if (reportToUse.dealerPayments && reportToUse.dealerPayments.length > 0) {
      reportToUse.dealerPayments.forEach((payment, idx) => {
        const brand = payment.brand || '';
        const model = payment.model || '';
        const { cash, gpay, card } = getPaymentColumns(payment.paymentMethod, payment.amount);
        userRows.push([
          idx + 1,
          payment.dealerName || '',
          payment.dealerPhone || '',
          brand,
          model,
          payment.issue || '',
          payment.amount || 0,
          cash,
          gpay,
          card,
          payment.supplierName || '',
          payment.supplierAmount || ''
        ]);
      });
    }

    const dealerDataRows = reportToUse.dealerPayments?.length || 0;
    for (let i = dealerDataRows; i < 20; i++) {
      userRows.push(['', '', '', '', '', '', '', '', '', '', '', '']);
    }

    userRows.push([]);
    userRows.push(['SUPPLIER PAYMENTS']);
    userRows.push(['S.No.', 'Supplier Name', 'Product/Part', '', 'Amount']);
    if (reportToUse.supplierPayments && reportToUse.supplierPayments.length > 0) {
      reportToUse.supplierPayments.forEach((payment, idx) => {
        userRows.push([idx + 1, payment.supplierName || '', payment.productName || '', '', payment.amount || 0]);
      });
    } else {
      for (let i = 0; i < 5; i++) {
        userRows.push(['', '', '', '', '']);
      }
    }

    const wb = XLSX.utils.book_new();
    const colCount = headers.length;

    const ws1 = XLSX.utils.aoa_to_sheet(adminRows);
    ws1['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: colCount - 1 } },
    ];
    ws1['!cols'] = [
      { wch: 6 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
      { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 10 },
    ];
    XLSX.utils.book_append_sheet(wb, ws1, 'admin');

    const ws2 = XLSX.utils.aoa_to_sheet(userRows);
    ws2['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: colCount - 1 } },
    ];
    ws2['!cols'] = ws1['!cols'];
    XLSX.utils.book_append_sheet(wb, ws2, 'user');

    const fileName = `${shopName.replace(/\s+/g, '_')}_Report_${periodStart.replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handleExportReport = () => {
    if (reportFormat === 'excel') {
      handleExcelReport();
    } else {
      handlePrintReport();
    }
  };

  // Fetch analytics when revenue tab becomes active
  useEffect(() => {
    if (activeTab === 'revenue' && currentShopId) {
      fetchLocalAnalytics();
    }
  }, [activeTab, currentShopId]);

  const getCurrentShop = () => {
    if (!shops || shops.length === 0) return null;
    return shops.find(shop => shop.id === currentShopId) || shops[0];
  };

  const currentShop = getCurrentShop();

  const fetchCustomerPage = async (page, filters = customerFilters) => {
    try {
      const token = localStorage.getItem('shopAdminToken');
      const params = { shop_id: currentShopId, page, limit: itemsPerPage };
      if (filters.billNumber) params.billNumber = filters.billNumber;
      if (filters.name) params.name = filters.name;
      if (filters.mobileNumber) params.mobileNumber = filters.mobileNumber;
      if (filters.fromDate) params.fromDate = filters.fromDate;
      if (filters.toDate) params.toDate = filters.toDate;

      const res = await axios.get(
        `${API_URL}/api/shop-admin/customer-details`,
        { headers: { 'Authorization': `Bearer ${token}` }, params }
      );

      if (res.data.success) {
        setFilteredCustomers(res.data.customerDetails || []);
        setCustomerTotalCount(res.data.totalCount || 0);
        if (setParentTotalCount) setParentTotalCount(res.data.totalCount || 0);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error('Error fetching customer page:', error);
    }
  };

  // Handle customer filter
  const handleCustomerFilter = async () => {
    await fetchCustomerPage(1);
    setShowFilters(false);
  };

  const handleClearFilters = async () => {
    const cleared = { name: '', mobileNumber: '', billNumber: '', fromDate: '', toDate: '' };
    setCustomerFilters(cleared);
    await fetchCustomerPage(1, cleared);
    setShowFilters(false);
  };

  // Pagination (server-side)
  const indexOfFirstItem = (currentPage - 1) * itemsPerPage;
  const currentCustomers = filteredCustomers; // server returns the current page only
  const totalPages = Math.ceil(customerTotalCount / itemsPerPage);

  const planLabel = isCombo ? 'Service + Sales' : hasSales ? 'Sales' : 'Service';
  const rootTab = rootOf(activeTab);
  const isRootScreen = activeTab === rootTab;
  const navEntry = findNavEntry(activeTab);
  const pageTitle = HUBS[activeTab]?.title
    || (activeTab === 'settings' ? 'Shop Settings' : navEntry?.entry?.label || 'Overview');
  const pageSubtitle = HUBS[activeTab]?.subtitle
    || (activeTab === 'settings' ? 'Receipts, visibility & devices' : navEntry?.group?.label || '');
  const hubAccent = activeTab === 'hub-sales' ? 'indigo' : activeTab === 'hub-hr' ? 'amber' : 'green';
  const hubGroups = HUBS[activeTab]
    ? HUBS[activeTab].groups
      .map((key) => visibleNav.find((n) => n.type === 'group' && n.key === key))
      .filter(Boolean)
    : [];

  const quickActions = [
    hasService && { id: 'customer-create', label: 'New Customer', icon: UserPlus, tone: 'bg-emerald-50 text-emerald-600' },
    hasService && { id: 'all-records', label: 'All Records', icon: Phone, tone: 'bg-sky-50 text-sky-600' },
    hasSales && { id: 'sales-inventory', label: 'Inventory', icon: Package, tone: 'bg-indigo-50 text-indigo-600' },
    hasSales && { id: 'sales-branch-supply', label: 'Branch Supply', icon: Send, tone: 'bg-violet-50 text-violet-600' },
    hasService && { id: 'revenue', label: 'Revenue', icon: DollarSign, tone: 'bg-green-50 text-green-600' },
    hasSales && { id: 'sales-branch-sales', label: 'Branch Sales', icon: BarChart3, tone: 'bg-blue-50 text-blue-600' },
    { id: 'hr-attendance', label: 'Attendance', icon: CheckCircle, tone: 'bg-amber-50 text-amber-600' },
    { id: 'business-analytics', label: 'Analytics', icon: TrendingUp, tone: 'bg-rose-50 text-rose-600' },
    // Fill-ins for single-product plans so the grid stays two full rows
    hasService && { id: 'report', label: 'Report', icon: FileText, tone: 'bg-gray-100 text-gray-700' },
    hasService && { id: 'suppliers', label: 'Suppliers', icon: Truck, tone: 'bg-orange-50 text-orange-600' },
    hasSales && { id: 'sales-supplier-credits', label: 'Supplier Dues', icon: Wallet, tone: 'bg-orange-50 text-orange-600' },
    hasSales && { id: 'sales-expenses', label: 'Expenses', icon: Wallet, tone: 'bg-gray-100 text-gray-700' },
    { id: 'salary', label: 'Salary', icon: DollarSign, tone: 'bg-teal-50 text-teal-600' },
  ].filter(Boolean).slice(0, 8);

  const bottomTabs = [
    { id: 'overview', label: 'Home', icon: Home },
    hasService && { id: 'hub-service', label: 'Service', icon: Wrench },
    hasSales && { id: 'hub-sales', label: 'Sales', icon: ShoppingBag },
    { id: 'hub-hr', label: 'HR', icon: Users },
  ].filter(Boolean);

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
    <div className="min-h-screen bg-gray-50 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      {/* App bar */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-1 px-2">
          {isRootScreen ? (
            <button
              type="button"
              onClick={() => setShowMobileMenu(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Open menu"
              aria-expanded={showMobileMenu}
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate(rootTab)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Back"
            >
              <ArrowLeft className="h-6 w-6" aria-hidden="true" />
            </button>
          )}
          <div className="min-w-0 flex-1 px-1">
            {activeTab === 'overview' ? (
              <>
                <h1 className="truncate text-base font-bold leading-tight">{currentShop?.name || 'Shop'}</h1>
                <p className="flex items-center gap-1 truncate text-xs text-green-100">
                  <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {currentShop?.location || 'Location not set'}
                </p>
              </>
            ) : (
              <>
                <h1 className="truncate text-base font-bold leading-tight">{pageTitle}</h1>
                {pageSubtitle && <p className="truncate text-xs text-green-100">{pageSubtitle}</p>}
              </>
            )}
          </div>
          {shops.length > 1 && (
            <button
              type="button"
              onClick={() => setShowShopSelector(!showShopSelector)}
              className="inline-flex h-11 items-center gap-1 rounded-lg px-2 text-xs font-semibold hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Switch shop"
              aria-expanded={showShopSelector}
            >
              <Store className="h-5 w-5" aria-hidden="true" />
              <ChevronDown className={`h-4 w-4 transition-transform ${showShopSelector ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
          )}
        </div>

        {showShopSelector && shops.length > 1 && (
          <div className="max-h-[60vh] overflow-y-auto border-t border-white/20 bg-white text-gray-900 shadow-lg">
            <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Switch shop</p>
            {shops.map((shop) => (
              <button
                key={shop.id}
                type="button"
                onClick={() => {
                  handleSwitchShop(shop.id);
                  setShowShopSelector(false);
                }}
                aria-current={shop.id === currentShopId ? 'true' : undefined}
                className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left ${
                  shop.id === currentShopId ? 'bg-emerald-50' : 'hover:bg-gray-50'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{shop.name}</span>
                  <span className="block truncate text-xs text-gray-500">{shop.location || 'Location not set'}</span>
                </span>
                {shop.id === currentShopId && <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />}
              </button>
            ))}
          </div>
        )}
      </header>
      {/* Main Content */}
      <main className="mx-auto max-w-3xl px-4 pt-4">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Shop summary */}
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Welcome back{shopAdmin?.username ? `, ${shopAdmin.username}` : ''}</p>
                  <h2 className="mt-0.5 truncate text-lg font-bold text-gray-900">{currentShop?.name || 'Your shop'}</h2>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{planLabel}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <StatTile label="Employees" value={overview?.totalEmployees || 0} icon={Users} iconClass="text-emerald-600" onClick={() => navigate('hr-employees')} />
                {hasService ? (
                  <StatTile label="Customers" value={overview?.totalCustomers || 0} icon={Users} iconClass="text-sky-600" onClick={() => navigate('all-records')} />
                ) : (
                  <StatTile label="Analytics" value="View" icon={BarChart3} iconClass="text-indigo-600" onClick={() => navigate('business-analytics')} />
                )}
              </div>
            </div>

            {/* Quick actions */}
            <section aria-labelledby="sa-quick-actions" className="space-y-3">
              <h2 id="sa-quick-actions" className="text-base font-semibold text-gray-900">Quick actions</h2>
              <div className="grid grid-cols-4 gap-2">
                {quickActions.map(({ id, label, icon: Icon, tone }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => navigate(id)}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-1 py-3 text-center shadow-sm transition active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${tone}`}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-[11px] font-medium leading-tight text-gray-700">{label}</span>
                  </button>
                ))}
              </div>
            </section>

            {hasService && (
              <section aria-label="Service summary" className="space-y-3">
                <SectionTitle icon={Wrench} title="Service" action="Manage" onAction={() => navigate('hub-service')} />
                <div className="grid grid-cols-2 gap-2">
                  <StatTile label="Today's Revenue" value={`₹${(overview?.todayRevenue || 0).toLocaleString('en-IN')}`} hint="Today's earnings" icon={DollarSign} iconClass="text-emerald-600" onClick={() => navigate('revenue')} />
                  <StatTile label="Pending Repairs" value={overview?.pendingRepairs || 0} hint="Need attention" icon={AlertCircle} iconClass="text-orange-500" onClick={() => navigate('all-records')} />
                  <StatTile label="Total Mobiles" value={overview?.totalMobiles || 0} hint="All records" icon={Package} iconClass="text-purple-600" onClick={() => navigate('all-records')} />
                  <StatTile label="Today's Services" value={overview?.todayMobiles || 0} hint="Added today" icon={Wrench} iconClass="text-emerald-600" onClick={() => navigate('all-records')} />
                </div>
              </section>
            )}

            {hasSales && (
              <section aria-label="Sales summary" className="space-y-3">
                <SectionTitle icon={ShoppingBag} title="Sales" accent="indigo" action="Manage" onAction={() => navigate('hub-sales')} />
                <div className="sa-sales-summary">
                  <SalesOverview session={salesSession} compact showTitle={false} onNavigate={navigate} />
                </div>
              </section>
            )}

            {/* Settings shortcut */}
            <button
              type="button"
              onClick={() => navigate('settings')}
              className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
                <Settings className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-gray-900">Shop settings</span>
                <span className="block truncate text-xs text-gray-500">
                  {hasService
                    ? `Revenue ${settings.revenueVisibleToUsers ? 'visible' : 'hidden'} to users · Receipt terms · Biometric`
                    : 'Biometric attendance device'}
                </span>
              </span>
              <ChevronRight className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </button>

            {hasService && (<>
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
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-semibold">
                          Processing: {customer.processing_count || 0}
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
              {customerTotalCount > 0 && (
                <div className="p-3 bg-gray-50 border-t border-gray-200">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                    <span>
                      {indexOfFirstItem + 1}–{Math.min(indexOfFirstItem + itemsPerPage, customerTotalCount)} of {customerTotalCount}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => fetchCustomerPage(Math.max(currentPage - 1, 1))}
                        disabled={currentPage === 1}
                        className="p-1.5 bg-white border border-gray-300 rounded disabled:opacity-50"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => fetchCustomerPage(Math.min(currentPage + 1, totalPages))}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="p-1.5 bg-white border border-gray-300 rounded disabled:opacity-50"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            </>)}
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
                      onClick={handleExportReport}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center gap-1"
                      title={reportFormat === 'excel' ? 'Export Excel' : 'Print/Save as PDF'}
                    >
                      {reportFormat === 'excel' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                          <line x1="16" y1="13" x2="8" y2="13"></line>
                          <line x1="16" y1="17" x2="8" y2="17"></line>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="6 9 6 2 18 2 18 9"></polyline>
                          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                          <rect x="6" y="14" width="12" height="8"></rect>
                        </svg>
                      )}
                      {reportFormat === 'excel' ? 'Excel' : 'PDF'}
                    </button>
                  )}
                </div>
                {/* Format selector */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Export Format</label>
                  <select
                    value={reportFormat}
                    onChange={(e) => setReportFormat(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="pdf">PDF</option>
                    <option value="excel">Excel</option>
                  </select>
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

        {/* Section hubs: Service / Sales / HR */}
        {HUBS[activeTab] && (
          <div className="space-y-6">
            {activeTab === 'hub-service' && (
              <div className="grid grid-cols-2 gap-2">
                <StatTile label="Pending Repairs" value={overview?.pendingRepairs || 0} hint="Need attention" icon={AlertCircle} iconClass="text-orange-500" onClick={() => navigate('all-records')} />
                <StatTile label="Today's Revenue" value={`₹${(overview?.todayRevenue || 0).toLocaleString('en-IN')}`} hint="Today's earnings" icon={DollarSign} iconClass="text-emerald-600" onClick={() => navigate('revenue')} />
              </div>
            )}
            {activeTab === 'hub-sales' && (
              <SalesOverview session={salesSession} compact showTitle={false} onNavigate={navigate} />
            )}
            {activeTab === 'hub-hr' && isCombo && (
              <p className="rounded-xl bg-white p-3 text-xs text-gray-600 shadow-sm border border-gray-200">
                Your plan includes Service and Sales — HR screens let you filter staff by unit.
              </p>
            )}
            {hubGroups.map((group) => (
              <section key={group.key} aria-labelledby={`hub-${group.key}`} className="space-y-3">
                <h2 id={`hub-${group.key}`} className="text-xs font-bold uppercase tracking-wider text-gray-500">{group.label}</h2>
                <div className="grid grid-cols-2 gap-2">
                  {group.children.map((child) => (
                    <NavTile key={child.id} item={child} accent={hubAccent} onClick={() => navigate(child.id)} />
                  ))}
                </div>
              </section>
            ))}
            {activeTab === 'hub-service' && (
              <section aria-labelledby="hub-insights" className="space-y-3">
                <h2 id="hub-insights" className="text-xs font-bold uppercase tracking-wider text-gray-500">Insights</h2>
                <div className="grid grid-cols-2 gap-2">
                  <NavTile item={{ label: 'Business Analytics', desc: 'Sales + service P&L', icon: BarChart3 }} onClick={() => navigate('business-analytics')} />
                </div>
              </section>
            )}
          </div>
        )}

        {/* Business / unit filter shared by the HR screens on combo plans */}
        {HR_TABS.includes(activeTab) && isCombo && (
          <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
            <span className="text-xs font-medium text-gray-600">Staff from</span>
            <div role="radiogroup" aria-label="Business unit" className="inline-flex rounded-lg bg-gray-100 p-1">
              {[{ id: 'all', label: 'All' }, { id: 'service', label: 'Service' }, { id: 'sales', label: 'Sales' }].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={hrUnit === opt.id}
                  onClick={() => setHrUnit(opt.id)}
                  className={`min-w-[60px] rounded-md px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    hrUnit === opt.id ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Full-feature screens shared with the desktop dashboard */}
        <div className="sa-mobile-panel min-w-0 overflow-x-auto">
          {activeTab === 'business-analytics' && productAccess && (
            <BusinessAnalytics shopId={currentShopId} access={productAccess} onNavigate={navigate} />
          )}
          {activeTab === 'hr-employees' && (
            <EmployeeManagement shopId={currentShopId} unit={effectiveHrUnit} allowUnitChoice={isCombo} />
          )}
          {activeTab === 'hr-attendance' && (
            <AttendanceManagement shopId={currentShopId} unit={effectiveHrUnit} />
          )}
          {activeTab === 'salary' && (
            <SalaryManagement shopId={currentShopId} unit={effectiveHrUnit} />
          )}
          {activeTab === 'hr-performance' && productAccess && (
            <EmployeePerformance shopId={currentShopId} unit={effectiveHrUnit} access={productAccess} />
          )}
          {activeTab === 'all-records' && <AllRecordsPanel currentShopId={currentShopId} />}
          {activeTab === 'customer-create' && <CreateCustomerPanel currentShopId={currentShopId} />}
          {activeTab === 'dealer-create' && <CreateDealerPanel currentShopId={currentShopId} />}
          {activeTab === 'suppliers' && <SuppliersPanel currentShopId={currentShopId} />}
          {activeTab.startsWith('sales-') && hasSales && (
            <SalesWorkspace
              view={activeTab.slice('sales-'.length)}
              session={salesSession}
              shopId={currentShopId}
              onNavigate={navigate}
              compact
            />
          )}
        </div>

        {/* Shop settings (on desktop these live on the Overview page) */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            {hasService && (
              <>
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${settings.revenueVisibleToUsers ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      <DollarSign className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 id="sa-revenue-visibility" className="text-sm font-semibold text-gray-900">Revenue visibility for users</h3>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {settings.revenueVisibleToUsers
                          ? "Users can see Today's Revenue & the Analytics dashboard"
                          : "Today's Revenue & the Analytics dashboard are hidden from users"}
                      </p>
                    </div>
                    <Toggle
                      checked={!!settings.revenueVisibleToUsers}
                      disabled={settings.togglingRevenue || !settings.toggleRevenueVisibility}
                      onChange={settings.toggleRevenueVisibility}
                      label="Revenue visibility for users"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <FileText className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900">Receipt terms &amp; conditions</h3>
                      <p className="mt-0.5 text-xs text-gray-500">Printed at the bottom of the A4 invoice/receipt. Leave blank to use the default terms.</p>
                    </div>
                  </div>
                  <label htmlFor="sa-terms" className="sr-only">Receipt terms and conditions</label>
                  <textarea
                    id="sa-terms"
                    value={settings.termsDraft || ''}
                    onChange={(e) => settings.setTermsDraft?.(e.target.value)}
                    placeholder={"e.g.\n1. No guarantee for liquid / water damage.\n2. Collect your device within 30 days of completion.\n3. We are not responsible for any data loss."}
                    rows={8}
                    maxLength={2000}
                    className="mt-3 w-full resize-y rounded-lg border border-gray-300 p-3 text-base leading-relaxed text-gray-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                  />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-400">{(settings.termsDraft || '').length}/2000</span>
                    <div className="flex items-center gap-3">
                      {settings.termsSaved && (
                        <span role="status" className="flex items-center gap-1 text-sm font-medium text-emerald-600">
                          <CheckCircle className="h-4 w-4" aria-hidden="true" /> Saved
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={settings.saveTermsAndConditions}
                        disabled={settings.savingTerms || settings.termsDraft === settings.termsAndConditions}
                        className="min-h-[40px] rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {settings.savingTerms ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="sa-mobile-panel min-w-0 overflow-x-auto">
                  <ReceiptTermsImages shopId={currentShopId} />
                </div>
              </>
            )}

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Fingerprint className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900">Biometric attendance device</h3>
                  <p className="mt-0.5 text-xs text-gray-500">Connect an eSSL M20 to capture attendance by fingerprint / face.</p>
                </div>
              </div>
              <div className="sa-mobile-panel min-w-0 overflow-x-auto">
                <EsslDeviceSettings shopId={currentShopId} employees={employees} />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom tab bar */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] backdrop-blur"
      >
        <div className="mx-auto flex max-w-3xl">
          {bottomTabs.map(({ id, label, icon: Icon }) => {
            const active = rootTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => navigate(id)}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold focus:outline-none focus-visible:bg-gray-100 ${
                  active ? 'text-emerald-700' : 'text-gray-500'
                }`}
              >
                <span className={`flex h-7 w-12 items-center justify-center rounded-full transition ${active ? 'bg-emerald-100' : ''}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                {label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setShowMobileMenu(true)}
            aria-label="Open full menu"
            aria-expanded={showMobileMenu}
            className="flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-gray-500 focus:outline-none focus-visible:bg-gray-100"
          >
            <span className="flex h-7 w-12 items-center justify-center rounded-full">
              <Menu className="h-5 w-5" aria-hidden="true" />
            </span>
            Menu
          </button>
        </div>
      </nav>

      {/* Slide-in menu: mirrors the desktop sidebar */}
      <div
        className={`fixed inset-0 z-[60] ${showMobileMenu ? '' : 'pointer-events-none'}`}
        aria-hidden={!showMobileMenu}
      >
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${showMobileMenu ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setShowMobileMenu(false)}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className={`absolute inset-y-0 left-0 flex w-[85%] max-w-xs flex-col bg-white shadow-2xl transition-transform duration-200 ${
            showMobileMenu ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="bg-gradient-to-br from-green-600 to-emerald-700 p-4 pt-[calc(1rem+env(safe-area-inset-top))] text-white">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-lg font-bold">{currentShop?.name || 'Shop'}</p>
                <p className="truncate text-xs text-green-100">{currentShop?.location || 'Location not set'}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileMenu(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Close menu"
                tabIndex={showMobileMenu ? 0 : -1}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-white/10 p-2">
                <dt className="text-green-100">Owner</dt>
                <dd className="truncate font-semibold">{currentShop?.owner_name || 'N/A'}</dd>
              </div>
              <div className="rounded-lg bg-white/10 p-2">
                <dt className="text-green-100">Phone</dt>
                <dd className="truncate font-semibold">{currentShop?.phone || 'N/A'}</dd>
              </div>
              <div className="rounded-lg bg-white/10 p-2">
                <dt className="text-green-100">Plan</dt>
                <dd className="truncate font-semibold">{planLabel}</dd>
              </div>
              <div className="rounded-lg bg-white/10 p-2">
                <dt className="text-green-100">Admin</dt>
                <dd className="truncate font-semibold">{shopAdmin?.username || '—'}</dd>
              </div>
            </dl>
          </div>

          <nav aria-label="All sections" className="flex-1 overflow-y-auto px-3 py-3">
            {visibleNav.map((node) => {
              if (node.type === 'heading') {
                return (
                  <p key={node.key} className={`mt-4 mb-1 px-3 text-[11px] font-bold uppercase tracking-widest ${node.product === 'sales' ? 'text-indigo-600' : 'text-emerald-700'}`}>
                    {node.label}
                  </p>
                );
              }
              const items = node.type === 'item' ? [node] : node.children;
              return (
                <div key={node.key || node.id} className="mb-1">
                  {node.type === 'group' && (
                    <p className="mt-2 px-3 pb-1 text-xs font-semibold text-gray-500">{node.label}</p>
                  )}
                  {items.map((item) => {
                    const Icon = item.icon;
                    const active = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigate(item.id)}
                        tabIndex={showMobileMenu ? 0 : -1}
                        aria-current={active ? 'page' : undefined}
                        className={`flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                          active ? 'bg-emerald-50 text-emerald-700' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-emerald-600' : 'text-gray-400'}`} aria-hidden="true" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              );
            })}
            <div className="mt-3 border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={() => navigate('settings')}
                tabIndex={showMobileMenu ? 0 : -1}
                aria-current={activeTab === 'settings' ? 'page' : undefined}
                className={`flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  activeTab === 'settings' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Settings className={`h-5 w-5 ${activeTab === 'settings' ? 'text-emerald-600' : 'text-gray-400'}`} aria-hidden="true" />
                Shop Settings
              </button>
            </div>
          </nav>

          <div className="border-t border-gray-100 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => {
                setShowMobileMenu(false);
                handleLogout();
              }}
              tabIndex={showMobileMenu ? 0 : -1}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-red-50 text-sm font-semibold text-red-600 hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Logout
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

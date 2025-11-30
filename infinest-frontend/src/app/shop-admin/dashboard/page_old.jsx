"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function ShopAdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [shopAdmin, setShopAdmin] = useState(null);
  const [overview, setOverview] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [revenueAnalytics, setRevenueAnalytics] = useState(null);
  const [serviceAnalytics, setServiceAnalytics] = useState(null);
  const [customerAnalytics, setCustomerAnalytics] = useState(null);
  const [inventoryAnalytics, setInventoryAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || 'http://localhost:8000';

  useEffect(() => {
    // Check shop admin authentication
    const token = localStorage.getItem('shopAdminToken');
    const adminInfo = localStorage.getItem('shopAdminInfo');
    
    if (!token || !adminInfo) {
      router.push('/shop-admin-login');
      return;
    }
    
    setShopAdmin(JSON.parse(adminInfo));
    fetchDashboardData();
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('shopAdminToken');
    return {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [overviewRes, employeesRes] = await Promise.all([
        axios.get(`${API_URL}/api/shop-admin/dashboard/overview`, getAuthHeaders()),
        axios.get(`${API_URL}/api/shop-admin/employees`, getAuthHeaders())
      ]);

      setOverview(overviewRes.data.overview);
      setEmployees(employeesRes.data.employees);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      if (error.response?.status === 401) {
        router.push('/shop-admin-login');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async (type) => {
    try {
      if (type === 'revenue' && !revenueAnalytics) {
        const res = await axios.get(`${API_URL}/api/shop-admin/analytics/revenue?period=30`, getAuthHeaders());
        setRevenueAnalytics(res.data.analytics);
      } else if (type === 'service' && !serviceAnalytics) {
        const res = await axios.get(`${API_URL}/api/shop-admin/analytics/service?period=30`, getAuthHeaders());
        setServiceAnalytics(res.data.serviceAnalytics);
      } else if (type === 'customers' && !customerAnalytics) {
        const res = await axios.get(`${API_URL}/api/shop-admin/analytics/customers`, getAuthHeaders());
        setCustomerAnalytics(res.data.customerAnalytics);
      } else if (type === 'inventory' && !inventoryAnalytics) {
        const res = await axios.get(`${API_URL}/api/shop-admin/analytics/inventory`, getAuthHeaders());
        setInventoryAnalytics(res.data.inventoryAnalytics);
      }
    } catch (error) {
      console.error(`Error fetching ${type} analytics:`, error);
    }
  };

  useEffect(() => {
    if (activeTab === 'revenue') fetchAnalytics('revenue');
    else if (activeTab === 'service') fetchAnalytics('service');
    else if (activeTab === 'customers') fetchAnalytics('customers');
    else if (activeTab === 'inventory') fetchAnalytics('inventory');
  }, [activeTab]);

  const handleLogout = () => {
    localStorage.removeItem('shopAdminToken');
    localStorage.removeItem('shopAdminInfo');
    router.push('/shop-admin-login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mb-4"></div>
          <p className="text-white text-xl font-semibold">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full bg-gray-900/95 backdrop-blur-xl border-r border-white/10 transition-all duration-300 z-50 ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              {sidebarOpen && (
                <div>
                  <h2 className="text-white font-bold text-lg">Shop Admin</h2>
                  <p className="text-gray-400 text-xs">Dashboard</p>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {[
              { id: 'overview', label: 'Overview', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
              { id: 'employees', label: 'Employees', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
              { id: 'revenue', label: 'Revenue', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
              { id: 'service', label: 'Service Analytics', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z' },
              { id: 'customers', label: 'Customers', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
              { id: 'inventory', label: 'Inventory', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  activeTab === item.id
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                {sidebarOpen && <span className="font-medium">{item.label}</span>}
              </button>
            ))}
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-white/10">
            {sidebarOpen && shopAdmin && (
              <div className="mb-3 p-3 bg-white/5 rounded-xl">
                <p className="text-white font-semibold text-sm truncate">{shopAdmin.full_name || shopAdmin.username}</p>
                <p className="text-gray-400 text-xs truncate">{shopAdmin.shop?.name}</p>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {sidebarOpen && <span>Logout</span>}
            </button>
          </div>
        </div>

        {/* Toggle Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-8 bg-gray-800 border border-white/10 rounded-full p-1.5 hover:bg-gray-700 transition"
        >
          <svg className={`w-4 h-4 text-white transition-transform ${!sidebarOpen && 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </aside>

      {/* Main Content */}
      <main className={`transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        {/* Header */}
        <header className="bg-gray-900/50 backdrop-blur-xl border-b border-white/10 p-6 sticky top-0 z-40">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">
                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </h1>
              <p className="text-gray-400">
                {shopAdmin?.shop?.name} - {shopAdmin?.shop?.location}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-400">Last updated</p>
                <p className="text-white font-semibold">{new Date().toLocaleTimeString()}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-6">
          {activeTab === 'overview' && <OverviewTab overview={overview} />}
          {activeTab === 'employees' && <EmployeesTab employees={employees} />}
          {activeTab === 'revenue' && <RevenueTab analytics={revenueAnalytics} />}
          {activeTab === 'service' && <ServiceTab analytics={serviceAnalytics} />}
          {activeTab === 'customers' && <CustomersTab analytics={customerAnalytics} />}
          {activeTab === 'inventory' && <InventoryTab analytics={inventoryAnalytics} />}
        </div>
      </main>
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ overview }) {
  if (!overview) return <LoadingState />;

  const stats = [
    { label: 'Total Employees', value: overview.totalEmployees, icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', color: 'from-blue-500 to-cyan-500' },
    { label: 'Total Customers', value: overview.totalCustomers, icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', color: 'from-purple-500 to-pink-500' },
    { label: 'Pending Repairs', value: overview.pendingRepairs, icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'from-orange-500 to-red-500' },
    { label: 'Today\'s Revenue', value: `₹${overview.todayRevenue.toLocaleString()}`, icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'from-green-500 to-emerald-500' },
    { label: 'Total Mobiles', value: overview.totalMobiles, icon: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z', color: 'from-indigo-500 to-purple-500' },
    { label: 'Today\'s Mobiles', value: overview.todayMobiles, icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', color: 'from-yellow-500 to-orange-500' }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 hover:border-white/40 transition-all hover:scale-105 transform">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 bg-gradient-to-br ${stat.color} rounded-xl`}>
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                </svg>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
            <p className="text-white text-3xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Employees Tab Component
function EmployeesTab({ employees }) {
  if (!employees) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-2xl font-bold text-white">Employee Directory</h2>
          <p className="text-gray-400 mt-1">Total: {employees.length} employees</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Mobile</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Address</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Blood Group</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Attendance Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {employees.map((employee) => (
                <tr key={employee._id} className="hover:bg-white/5 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold">{employee.employee_name.charAt(0)}</span>
                      </div>
                      <span className="text-white font-medium">{employee.employee_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-300">{employee.mobile_number}</td>
                  <td className="px-6 py-4 text-gray-300">{employee.address || 'N/A'}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-red-500/20 text-red-300 rounded-full text-sm font-medium">
                      {employee.blood_group || 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full"
                          style={{ width: `${employee.stats?.attendanceRate || 0}%` }}
                        ></div>
                      </div>
                      <span className="text-white font-semibold">{employee.stats?.attendanceRate || 0}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Revenue Tab Component
function RevenueTab({ analytics }) {
  if (!analytics) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Revenue', value: `₹${analytics.totalRevenue.toLocaleString()}`, color: 'from-green-500 to-emerald-500' },
          { label: 'Service Revenue', value: `₹${analytics.totalServiceRevenue.toLocaleString()}`, color: 'from-blue-500 to-cyan-500' },
          { label: 'Total Expenses', value: `₹${analytics.totalExpenses.toLocaleString()}`, color: 'from-red-500 to-orange-500' },
          { label: 'Net Profit', value: `₹${analytics.netProfit.toLocaleString()}`, color: 'from-purple-500 to-pink-500' }
        ].map((item, index) => (
          <div key={index} className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
            <p className="text-gray-400 text-sm mb-2">{item.label}</p>
            <p className={`text-3xl font-bold bg-gradient-to-r ${item.color} bg-clip-text text-transparent`}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
        <h3 className="text-xl font-bold text-white mb-4">Payment Method Breakdown</h3>
        <div className="space-y-3">
          {analytics.paymentBreakdown.map((payment, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
              <span className="text-white font-medium">{payment._id || 'Not Specified'}</span>
              <div className="text-right">
                <p className="text-white font-bold">₹{payment.total.toLocaleString()}</p>
                <p className="text-gray-400 text-sm">{payment.count} transactions</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Service Tab Component
function ServiceTab({ analytics }) {
  if (!analytics) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
        <h3 className="text-xl font-bold text-white mb-4">Top Technicians</h3>
        <div className="space-y-3">
          {analytics.topTechnicians.map((tech, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">#{index + 1}</span>
                </div>
                <span className="text-white font-medium">{tech._id}</span>
              </div>
              <div className="text-right">
                <p className="text-white font-bold">{tech.completed} / {tech.total} completed</p>
                <p className="text-gray-400 text-sm">₹{tech.totalRevenue.toLocaleString()} revenue</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
        <h3 className="text-xl font-bold text-white mb-4">Common Issues</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {analytics.commonIssues.map((issue, index) => (
            <div key={index} className="p-4 bg-white/5 rounded-xl">
              <p className="text-white font-medium mb-1">{issue._id}</p>
              <p className="text-gray-400 text-sm">{issue.count} occurrences</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Customers Tab Component
function CustomersTab({ analytics }) {
  if (!analytics) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
        <h3 className="text-xl font-bold text-white mb-4">Top Customers</h3>
        <div className="space-y-3">
          {analytics.topCustomers.slice(0, 10).map((customer, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
              <div>
                <p className="text-white font-medium">{customer.customer.client_name}</p>
                <p className="text-gray-400 text-sm">{customer.customer.mobile_number}</p>
              </div>
              <div className="text-right">
                <p className="text-white font-bold">₹{customer.totalSpent.toLocaleString()}</p>
                <p className="text-gray-400 text-sm">{customer.visitCount} visits</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Inventory Tab Component
function InventoryTab({ analytics }) {
  if (!analytics) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
          <p className="text-gray-400 text-sm mb-2">Total Inventory Value</p>
          <p className="text-3xl font-bold text-white">₹{analytics.inventoryValue.totalValue.toLocaleString()}</p>
        </div>
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
          <p className="text-gray-400 text-sm mb-2">Total Products</p>
          <p className="text-3xl font-bold text-white">{analytics.inventoryValue.totalProducts}</p>
        </div>
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
          <p className="text-gray-400 text-sm mb-2">Total Quantity</p>
          <p className="text-3xl font-bold text-white">{analytics.inventoryValue.totalQuantity}</p>
        </div>
      </div>

      <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
        <h3 className="text-xl font-bold text-white mb-4 text-red-400">⚠️ Low Stock Alert</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Product</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Category</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Quantity</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Cost Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {analytics.lowStockProducts.map((product) => (
                <tr key={product._id} className="hover:bg-white/5 transition">
                  <td className="px-4 py-3 text-white font-medium">{product.name}</td>
                  <td className="px-4 py-3 text-gray-300">{product.category || 'N/A'}</td>
                  <td className="px-4 py-3">
                    <span className="px-3 py-1 bg-red-500/20 text-red-300 rounded-full text-sm font-bold">
                      {product.quantity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">₹{product.costPrice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Loading State Component
function LoadingState() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500 mb-4"></div>
        <p className="text-white text-lg">Loading data...</p>
      </div>
    </div>
  );
}

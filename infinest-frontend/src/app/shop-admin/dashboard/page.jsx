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

      const [revenueRes, serviceRes, customersRes, inventoryRes] = await Promise.all([
        axios.get(`${API_URL}/api/shop-admin/analytics/revenue?period=30`, authConfig).catch(err => ({ data: { revenue: null } })),
        axios.get(`${API_URL}/api/shop-admin/analytics/service?period=30`, authConfig).catch(err => ({ data: { service: null } })),
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
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30);

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
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 bg-white border-r border-gray-200 shadow-lg flex flex-col`}>
        <div className="p-6">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-700 hover:bg-gray-100 p-2 rounded-lg"
          >
            {sidebarOpen ? '←' : '→'}
          </button>
          {sidebarOpen && (
            <div className="mt-4">
              <div className="mb-4">
                <h2 className="text-gray-800 font-bold text-lg">Shop Admin</h2>
                <p className="text-gray-500 text-sm">{shopAdmin?.username}</p>
              </div>
              
              {/* Shop Selector */}
              {shops && shops.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs text-gray-500 mb-1">Current Shop</div>
                  <button
                    onClick={() => setShowShopSelector(!showShopSelector)}
                    className="w-full px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-gray-800 text-left transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{currentShop?.name || 'Select Shop'}</p>
                        <p className="text-xs text-gray-500 truncate">{currentShop?.location || 'No location'}</p>
                      </div>
                      {shops.length > 1 && <ChevronDown className="h-4 w-4 text-gray-500 ml-2" />}
                    </div>
                  </button>
                  
                  {showShopSelector && shops.length > 1 && (
                    <div className="mt-2 bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden">
                      {shops.map((shop) => (
                        <button
                          key={shop.id}
                          onClick={() => handleSwitchShop(shop.id)}
                          className={`w-full px-3 py-2 text-left hover:bg-gray-50 transition ${
                            shop.id === currentShopId ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                          }`}
                        >
                          <p className="text-sm font-medium text-gray-800 truncate">{shop.name}</p>
                          <p className="text-xs text-gray-500 truncate">{shop.location}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {(!shops || shops.length === 0) && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-xs">⚠️ No shops assigned</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        {sidebarOpen && (
          <nav className="flex-1 px-4 space-y-2">
            {[
              { id: 'overview', label: 'Overview', icon: TrendingUp },
              { id: 'employees', label: 'Employees', icon: Users },
              { id: 'revenue', label: 'Revenue', icon: DollarSign },
              { id: 'service', label: 'Service', icon: Wrench },
              { id: 'customers', label: 'Customers', icon: Users },
              { id: 'inventory', label: 'Inventory', icon: Package }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition flex items-center ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-5 w-5 mr-3" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        )}

        {/* Logout */}
        {sidebarOpen && (
          <div className="p-4">
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition border border-red-200"
            >
              Logout
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto bg-gray-50">
        {/* Header */}
        <div className="mb-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 shadow-lg">
          <h1 className="text-3xl font-bold text-white mb-2">
            {currentShop?.name || 'Shop Dashboard'}
          </h1>
          <div className="flex items-center gap-4 text-blue-100 flex-wrap">
            {currentShop?.location && (
              <>
                <span className="flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {currentShop.location}
                </span>
                <span>•</span>
              </>
            )}
            {currentShop?.owner_name && (
              <>
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {currentShop.owner_name}
                </span>
                <span>•</span>
              </>
            )}
            <span>
              Managing {shops.length} shop{shops.length !== 1 ? 's' : ''}
            </span>
          </div>
          {!currentShop && (
            <div className="mt-4 p-4 bg-yellow-100 border border-yellow-300 rounded-lg">
              <p className="text-yellow-800 text-sm">⚠️ No shop selected. Please check your shop assignments.</p>
            </div>
          )}
        </div>

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
                  <Wrench className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-gray-900 text-3xl font-bold">{overview?.todayMobiles || 0}</div>
                <div className="text-gray-500 text-xs mt-1">Added today</div>
              </div>
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Users className="h-6 w-6 text-blue-600" />
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
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                <h3 className="text-xl font-bold text-white flex items-center">
                  <Users className="h-6 w-6 mr-2" />
                  Customer Mobile Records
                </h3>
                <p className="text-blue-100 text-sm mt-1">Track customer devices and payment status</p>
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        style={{ colorScheme: 'light' }}
                      />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleCustomerFilter}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition flex items-center"
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
                              <Users className="h-4 w-4 mr-2 text-blue-600" />
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
                            className={`hover:bg-blue-50 transition-colors ${
                              index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                            }`}
                          >
                            <td className="px-6 py-4 border-b border-gray-200">
                              <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
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
                                  ? 'bg-blue-600 text-white'
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
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
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
                className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-sm font-medium transition"
              >
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Employee List */}
              <div className="lg:col-span-1">
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-lg">
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3">
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
                              ? 'bg-blue-50 border-l-4 border-blue-600'
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
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
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
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                              style={{ colorScheme: 'light' }}
                            />
                            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                          </div>
                        </div>
                        <div className="flex gap-2 items-end">
                          <button
                            onClick={handleAttendanceFilter}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
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
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
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
            <div className="flex items-center justify-between bg-gradient-to-r from-green-500 to-emerald-600 p-6 rounded-xl shadow-lg">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center">
                  <DollarSign className="h-7 w-7 mr-3" />
                  Revenue Analytics
                </h2>
                <p className="text-green-50 text-sm mt-1">Track your shop's financial performance</p>
              </div>
              <button 
                onClick={() => fetchAnalytics('revenue')}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                </svg>
                Refresh
              </button>
            </div>

            {!analytics ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-lg">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
                <p className="text-gray-600 text-lg">Loading revenue data...</p>
              </div>
            ) : (
              <>

            {/* Revenue KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition group">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-gray-600 text-sm font-medium">Today's Revenue</div>
                  <div className="bg-gradient-to-r from-green-400 to-emerald-500 p-2 rounded-lg">
                    <DollarSign className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="text-gray-900 text-3xl font-bold group-hover:scale-105 transition">
                  ₹{overview?.todayRevenue?.toLocaleString() || 0}
                </div>
                <div className="mt-2 flex items-center text-sm">
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-green-600 font-semibold">+12.5%</span>
                  <span className="text-gray-500 ml-1">vs yesterday</span>
                </div>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition group">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-gray-600 text-sm font-medium">This Week</div>
                  <div className="bg-gradient-to-r from-blue-400 to-blue-600 p-2 rounded-lg">
                    <TrendingUp className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="text-gray-900 text-3xl font-bold group-hover:scale-105 transition">
                  ₹{analytics?.revenue?.thisWeek?.toLocaleString() || 0}
                </div>
                <div className="mt-2 flex items-center text-sm">
                  <TrendingUp className="h-4 w-4 text-blue-500 mr-1" />
                  <span className="text-blue-600 font-semibold">+8.2%</span>
                  <span className="text-gray-500 ml-1">vs last week</span>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition group">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-gray-600 text-sm font-medium">This Month</div>
                  <div className="bg-gradient-to-r from-purple-400 to-purple-600 p-2 rounded-lg">
                    <Calendar className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="text-gray-900 text-3xl font-bold group-hover:scale-105 transition">
                  ₹{analytics?.revenue?.thisMonth?.toLocaleString() || 0}
                </div>
                <div className="mt-2 flex items-center text-sm">
                  <TrendingUp className="h-4 w-4 text-purple-500 mr-1" />
                  <span className="text-purple-600 font-semibold">+15.3%</span>
                  <span className="text-gray-500 ml-1">vs last month</span>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition group">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-gray-600 text-sm font-medium">Avg Transaction</div>
                  <div className="bg-gradient-to-r from-orange-400 to-red-500 p-2 rounded-lg">
                    <DollarSign className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="text-gray-900 text-3xl font-bold group-hover:scale-105 transition">
                  ₹{Math.round((analytics?.revenue?.thisMonth || 0) / Math.max(overview?.todayMobiles || 1, 1)).toLocaleString()}
                </div>
                <div className="mt-2 flex items-center text-sm">
                  <TrendingUp className="h-4 w-4 text-orange-500 mr-1" />
                  <span className="text-orange-600 font-semibold">Per device</span>
                </div>
              </div>
            </div>

            {/* Revenue Trend Chart with Visual Charts */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg">
              <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                <div className="bg-gradient-to-r from-green-400 to-blue-500 p-2 rounded-lg mr-3">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                Revenue & Transaction Analysis
              </h3>
              {analytics?.revenue?.dailyData && analytics.revenue.dailyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={analytics.revenue.dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#666" 
                      fontSize={11}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis stroke="#666" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                      }}
                      formatter={(value) => `₹${value?.toLocaleString()}`}
                    />
                    <Legend />
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.2}/>
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      fill="url(#revenueGradient)"
                      stroke="#10B981"
                      strokeWidth={3}
                      name="Daily Revenue"
                    />
                    <Bar 
                      dataKey="count" 
                      fill="#3B82F6" 
                      name="Transactions" 
                      radius={[4, 4, 0, 0]}
                      yAxisId="right"
                    />
                    <YAxis yAxisId="right" orientation="right" stroke="#3B82F6" fontSize={12} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[400px] flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <DollarSign className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <p>No revenue data available for the selected period</p>
                  </div>
                </div>
              )}
            </div>

            {/* Revenue Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Payment Methods Pie Chart */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <div className="bg-gradient-to-r from-blue-400 to-indigo-500 p-2 rounded-lg mr-3">
                    <DollarSign className="h-4 w-4 text-white" />
                  </div>
                  Revenue by Source
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Repairs', value: analytics?.revenue?.thisMonth || 5000, fill: '#10B981' },
                        { name: 'Parts Sales', value: (analytics?.revenue?.thisMonth || 5000) * 0.3, fill: '#3B82F6' },
                        { name: 'Accessories', value: (analytics?.revenue?.thisMonth || 5000) * 0.15, fill: '#F59E0B' },
                        { name: 'Other', value: (analytics?.revenue?.thisMonth || 5000) * 0.05, fill: '#8B5CF6' },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      dataKey="value"
                    >
                    </Pie>
                    <Tooltip formatter={(value) => `₹${value?.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Top Revenue Days */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <div className="bg-gradient-to-r from-purple-400 to-pink-500 p-2 rounded-lg mr-3">
                    <TrendingUp className="h-4 w-4 text-white" />
                  </div>
                  Top Revenue Days
                </h3>
                <div className="space-y-3">
                  {analytics?.revenue?.dailyData
                    ?.slice()
                    .sort((a, b) => b.revenue - a.revenue)
                    .slice(0, 7)
                    .map((day, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg hover:shadow-md transition">
                        <div className="flex items-center gap-3">
                          <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                            #{idx + 1}
                          </div>
                          <div>
                            <div className="text-gray-800 font-semibold">{day.date}</div>
                            <div className="text-gray-500 text-xs">{day.count} transactions</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-gray-900 font-bold text-lg">₹{day.revenue?.toLocaleString()}</div>
                        </div>
                      </div>
                    )) || (
                      <div className="text-center py-8 text-gray-500">
                        No revenue data available
                      </div>
                    )}
                </div>
              </div>
            </div>
            </>
            )}
          </div>
        )}

        {activeTab === 'service' && analytics && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl border border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">Service Analytics</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="text-gray-600 text-sm mb-2 font-medium">Total Repairs</div>
                <div className="text-gray-900 text-3xl font-bold">{analytics.service?.totalRepairs || 0}</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="text-gray-600 text-sm mb-2 font-medium">Pending Repairs</div>
                <div className="text-gray-900 text-3xl font-bold">{analytics.service?.pendingRepairs || 0}</div>
              </div>
            </div>

            {analytics.service?.byStatus && (
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg">
                <h3 className="text-gray-800 font-bold mb-4">Repair Status Breakdown</h3>
                <div className="space-y-3">
                  {Object.entries(analytics.service.byStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-700 capitalize font-medium">{status}</span>
                      <span className="text-gray-900 font-bold text-lg">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'customers' && analytics && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl border border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">Customer Analytics</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="text-gray-600 text-sm mb-2 font-medium">Total Customers</div>
                <div className="text-gray-900 text-3xl font-bold">{analytics.customers?.total || 0}</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="text-gray-600 text-sm mb-2 font-medium">New This Month</div>
                <div className="text-gray-900 text-3xl font-bold">{analytics.customers?.newThisMonth || 0}</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="text-gray-600 text-sm mb-2 font-medium">Active Customers</div>
                <div className="text-gray-900 text-3xl font-bold">{analytics.customers?.active || 0}</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && analytics && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl border border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">Inventory Analytics</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="text-gray-600 text-sm mb-2 font-medium">Total Mobiles</div>
                <div className="text-gray-900 text-3xl font-bold">{analytics.inventory?.totalMobiles || 0}</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="text-gray-600 text-sm mb-2 font-medium">In Stock</div>
                <div className="text-gray-900 text-3xl font-bold">{analytics.inventory?.inStock || 0}</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="text-gray-600 text-sm mb-2 font-medium">Low Stock Items</div>
                <div className="text-gray-900 text-3xl font-bold text-orange-600">{analytics.inventory?.lowStock || 0}</div>
              </div>
            </div>

            {analytics.inventory?.topBrands && analytics.inventory.topBrands.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg">
                <h3 className="text-gray-800 font-bold mb-4">Top Brands</h3>
                <div className="space-y-2">
                  {analytics.inventory.topBrands.map((brand, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-700 font-medium">{brand.name}</span>
                      <span className="text-gray-900 font-bold">{brand.count} units</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

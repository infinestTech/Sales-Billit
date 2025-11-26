"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

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

  const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || 'http://localhost:8000';

  useEffect(() => {
    // Check shop admin authentication
    const token = localStorage.getItem('shopAdminToken');
    const adminInfo = localStorage.getItem('shopAdminInfo');
    
    console.log('🔐 Checking authentication...');
    console.log('Token exists:', !!token);
    console.log('Admin info exists:', !!adminInfo);
    
    if (!token || !adminInfo) {
      console.warn('⚠️ No authentication found, redirecting to login');
      router.push('/shop-admin-login');
      return;
    }
    
    try {
      const admin = JSON.parse(adminInfo);
      console.log('👤 Parsed admin info:', admin);
      console.log('📊 Admin info structure:', {
        id: admin.id,
        username: admin.username,
        shops: admin.shops,
        current_shop_id: admin.current_shop_id
      });
      setShopAdmin(admin);
      
      // Set shops and current shop
      if (admin.shops && admin.shops.length > 0) {
        console.log('🏪 Setting shops:', admin.shops);
        console.log('🏪 Shop IDs:', admin.shops.map(s => s.id));
        setShops(admin.shops);
        
        const savedShopId = localStorage.getItem('currentShopId');
        console.log('💾 Saved shop ID from localStorage:', savedShopId);
        console.log('🎯 Admin current_shop_id:', admin.current_shop_id);
        console.log('🎯 First shop ID:', admin.shops[0].id);
        
        const initialShopId = savedShopId || admin.current_shop_id || admin.shops[0].id;
        console.log('✅ Final initial shop ID:', initialShopId);
        setCurrentShopId(initialShopId);
      } else {
        console.warn('⚠️ No shops found in admin info');
        console.log('Admin object:', admin);
      }
    } catch (error) {
      console.error('❌ Error parsing admin info:', error);
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
      console.warn('⚠️ No shop ID selected');
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log('📡 Fetching dashboard data for shop:', currentShopId);
    
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
      
      console.log('🔑 Making request with config:', {
        url: `${API_URL}/api/shop-admin/dashboard/overview`,
        params: authConfig.params,
        hasToken: !!token
      });

      const [overviewRes, employeesRes] = await Promise.all([
        axios.get(`${API_URL}/api/shop-admin/dashboard/overview`, authConfig),
        axios.get(`${API_URL}/api/shop-admin/employees`, authConfig)
      ]);

      console.log('✅ Overview response:', overviewRes.data);
      console.log('✅ Employees response:', employeesRes.data);

      if (overviewRes.data.success) {
        setOverview(overviewRes.data.overview);
      }
      
      if (employeesRes.data.success) {
        setEmployees(employeesRes.data.employees || []);
      }
      
      // Clear cached analytics when switching shops
      setAnalytics(null);
    } catch (error) {
      console.error('❌ Error fetching dashboard data:', error);
      console.error('❌ Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      if (error.response?.status === 401) {
        localStorage.clear();
        router.push('/shop-admin-login');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    if (!currentShopId || analytics) return;
    
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

      console.log('📊 Fetching analytics for shop:', currentShopId);

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
      (revenueData.mobileRevenue || []).forEach(item => {
        const date = item._id?.date || item.date;
        if (date) {
          revenueByDate[date] = (revenueByDate[date] || 0) + (item.revenue || 0);
        }
      });
      (revenueData.salesRevenue || []).forEach(item => {
        const date = item._id?.date || item.date;
        if (date) {
          revenueByDate[date] = (revenueByDate[date] || 0) + (item.revenue || 0);
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
        .map(([date, revenue]) => ({ date, revenue }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 7);

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

      console.log('✅ Analytics fetched successfully');
    } catch (error) {
      console.error('❌ Error fetching analytics:', error);
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
    if (activeTab === 'revenue') fetchAnalytics('revenue');
    else if (activeTab === 'service') fetchAnalytics('service');
    else if (activeTab === 'customers') fetchAnalytics('customers');
    else if (activeTab === 'inventory') fetchAnalytics('inventory');
  }, [activeTab]);

  const handleLogout = () => {
    localStorage.clear(); // Clear all cached data
    router.push('/shop-admin-login');
  };

  const getCurrentShop = () => {
    if (!shops || shops.length === 0) return null;
    const shop = shops.find(shop => shop.id === currentShopId);
    console.log('🔍 Finding shop with ID:', currentShopId);
    console.log('🔍 Available shops:', shops);
    console.log('🔍 Found shop:', shop);
    return shop || shops[0];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading dashboard...</div>
      </div>
    );
  }

  const currentShop = getCurrentShop();
  console.log('🏪 Current shop being displayed:', currentShop);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 bg-gray-800/50 backdrop-blur-lg border-r border-gray-700 flex flex-col`}>
        <div className="p-6">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-white hover:bg-gray-700 p-2 rounded-lg"
          >
            {sidebarOpen ? '←' : '→'}
          </button>
          {sidebarOpen && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-white font-bold text-lg">Shop Admin</h2>
                  <p className="text-gray-400 text-sm">{shopAdmin?.username}</p>
                </div>
                <button
                  onClick={() => {
                    localStorage.clear();
                    window.location.href = '/shop-admin-login';
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300"
                  title="Clear cache and re-login"
                >
                  🔄
                </button>
              </div>
              
              {/* Shop Selector */}
              {shops && shops.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs text-gray-400 mb-1">Current Shop</div>
                  <button
                    onClick={() => setShowShopSelector(!showShopSelector)}
                    className="w-full px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-white text-left transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{currentShop?.name || 'Select Shop'}</p>
                        <p className="text-xs text-purple-300 truncate">{currentShop?.location || 'No location'}</p>
                      </div>
                      {shops.length > 1 && <span className="ml-2 text-xs">▼</span>}
                    </div>
                  </button>
                  
                  {showShopSelector && shops.length > 1 && (
                    <div className="mt-2 bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
                      {shops.map((shop) => (
                        <button
                          key={shop.id}
                          onClick={() => handleSwitchShop(shop.id)}
                          className={`w-full px-3 py-2 text-left hover:bg-gray-700 transition ${
                            shop.id === currentShopId ? 'bg-purple-500/20' : ''
                          }`}
                        >
                          <p className="text-sm font-medium text-white truncate">{shop.name}</p>
                          <p className="text-xs text-gray-400 truncate">{shop.location}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {(!shops || shops.length === 0) && (
                <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                  <p className="text-red-300 text-xs">⚠️ No shops assigned</p>
                </div>
              )}
              
              {/* Debug Info */}
              <div className="mt-4 p-2 bg-gray-900 rounded text-xs text-gray-400">
                <div>Shops: {shops?.length || 0}</div>
                <div>Current ID: {currentShopId?.substring(0, 8)}...</div>
                <div className="max-h-20 overflow-auto mt-1">
                  {JSON.stringify(currentShop, null, 2)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        {sidebarOpen && (
          <nav className="flex-1 px-4 space-y-2">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'employees', label: 'Employees', icon: '👥' },
              { id: 'revenue', label: 'Revenue', icon: '💰' },
              { id: 'service', label: 'Service', icon: '🔧' },
              { id: 'customers', label: 'Customers', icon: '👤' },
              { id: 'inventory', label: 'Inventory', icon: '📦' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-4 py-3 rounded-lg transition ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        )}

        {/* Logout */}
        {sidebarOpen && (
          <div className="p-4">
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition"
            >
              Logout
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            {currentShop?.name || 'Shop Dashboard'}
          </h1>
          <div className="flex items-center gap-4 text-gray-300 flex-wrap">
            {currentShop?.location && (
              <>
                <span>📍 {currentShop.location}</span>
                <span>•</span>
              </>
            )}
            {currentShop?.owner_name && (
              <>
                <span>👤 {currentShop.owner_name}</span>
                <span>•</span>
              </>
            )}
            <span className={`${shops.length > 1 ? 'text-purple-400' : 'text-gray-400'}`}>
              Managing {shops.length} shop{shops.length !== 1 ? 's' : ''}
            </span>
          </div>
          {!currentShop && (
            <div className="mt-4 p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-300 text-sm">⚠️ No shop selected. Please check your shop assignments.</p>
            </div>
          )}
        </div>

        {/* Content based on active tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 backdrop-blur-lg border border-blue-500/30 rounded-xl p-6">
                <div className="text-blue-300 text-sm mb-2">Today's Revenue</div>
                <div className="text-white text-3xl font-bold">₹{(overview?.todayRevenue || 0).toLocaleString()}</div>
                <div className="text-blue-300 text-xs mt-2">Today's earnings</div>
              </div>
              
              <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 backdrop-blur-lg border border-green-500/30 rounded-xl p-6">
                <div className="text-green-300 text-sm mb-2">Pending Repairs</div>
                <div className="text-white text-3xl font-bold">{overview?.pendingRepairs || 0}</div>
                <div className="text-green-300 text-xs mt-2">Need attention</div>
              </div>
              
              <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 backdrop-blur-lg border border-purple-500/30 rounded-xl p-6">
                <div className="text-purple-300 text-sm mb-2">Total Mobiles</div>
                <div className="text-white text-3xl font-bold">{overview?.totalMobiles || 0}</div>
                <div className="text-purple-300 text-xs mt-2">All records</div>
              </div>
              
              <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 backdrop-blur-lg border border-orange-500/30 rounded-xl p-6">
                <div className="text-orange-300 text-sm mb-2">Today's Services</div>
                <div className="text-white text-3xl font-bold">{overview?.todayMobiles || 0}</div>
                <div className="text-orange-300 text-xs mt-2">Added today</div>
              </div>
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-xl p-6">
                <div className="flex items-center gap-4">
                  <div className="text-4xl">👥</div>
                  <div>
                    <div className="text-gray-400 text-sm">Employees</div>
                    <div className="text-white text-2xl font-bold">{overview?.totalEmployees || 0}</div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-xl p-6">
                <div className="flex items-center gap-4">
                  <div className="text-4xl">👤</div>
                  <div>
                    <div className="text-gray-400 text-sm">Customers</div>
                    <div className="text-white text-2xl font-bold">{overview?.totalCustomers || 0}</div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-xl p-6">
                <div className="flex items-center gap-4">
                  <div className="text-4xl">🔧</div>
                  <div>
                    <div className="text-gray-400 text-sm">Technicians</div>
                    <div className="text-white text-2xl font-bold">{overview?.totalTechnicians || 0}</div>
                  </div>
                </div>
              </div>
            </div>

            {!overview && !loading && (
              <div className="text-center py-12 bg-gray-800/30 rounded-xl border border-gray-700">
                <p className="text-gray-400">No overview data available</p>
                <button 
                  onClick={fetchDashboardData}
                  className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                >
                  Refresh Data
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'employees' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Employees ({employees?.length || 0})</h2>
              <button 
                onClick={fetchDashboardData}
                className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm"
              >
                Refresh
              </button>
            </div>

            {employees && employees.length > 0 ? (
              <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-900">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Name</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Phone</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Salary</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Attendance (30d)</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {employees.map((emp) => (
                      <tr key={emp._id} className="hover:bg-gray-700/50 transition">
                        <td className="px-6 py-4">
                          <div className="text-white font-medium">{emp.name || 'No Name'}</div>
                          <div className="text-gray-400 text-xs">{emp.employee_id || 'No ID'}</div>
                        </td>
                        <td className="px-6 py-4 text-gray-300">{emp.phone_number || 'N/A'}</td>
                        <td className="px-6 py-4 text-gray-300">
                          {emp.salary ? `₹${emp.salary.toLocaleString()}` : 'N/A'}
                        </td>
                        <td className="px-6 py-4">
                          {emp.stats ? (
                            <div className="text-sm">
                              <div className="text-green-400">{emp.stats.presentDays} present</div>
                              <div className="text-red-400">{emp.stats.absentDays} absent</div>
                              <div className="text-gray-400">{emp.stats.attendanceRate}% rate</div>
                            </div>
                          ) : (
                            <span className="text-gray-500">No data</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-semibold">
                            Active
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-gray-800/30 rounded-xl border border-gray-700 p-12 text-center">
                <div className="text-6xl mb-4">👥</div>
                <p className="text-gray-400 text-lg mb-2">No employees found</p>
                <p className="text-gray-500 text-sm">Add employees to this shop to see them here</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'revenue' && analytics && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Revenue Analytics</h2>
              <button 
                onClick={fetchAnalytics}
                className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm"
              >
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-6">
                <div className="text-green-400 text-sm mb-2">Today's Revenue</div>
                <div className="text-white text-3xl font-bold">₹{analytics.revenue?.today?.toLocaleString() || 0}</div>
              </div>
              <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-xl p-6">
                <div className="text-blue-400 text-sm mb-2">This Week</div>
                <div className="text-white text-3xl font-bold">₹{analytics.revenue?.thisWeek?.toLocaleString() || 0}</div>
              </div>
              <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-6">
                <div className="text-purple-400 text-sm mb-2">This Month</div>
                <div className="text-white text-3xl font-bold">₹{analytics.revenue?.thisMonth?.toLocaleString() || 0}</div>
              </div>
            </div>

            {analytics.revenue?.dailyData && analytics.revenue.dailyData.length > 0 && (
              <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-4">Daily Revenue Trend (Last 7 Days)</h3>
                <div className="space-y-2">
                  {analytics.revenue.dailyData.slice(0, 7).map((day, idx) => (
                    <div key={idx} className="flex items-center gap-4">
                      <div className="text-gray-400 text-sm w-24">{day.date}</div>
                      <div className="flex-1 bg-gray-700 rounded-full h-8 relative overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-green-500 to-emerald-500 h-full flex items-center px-3 rounded-full"
                          style={{ width: `${(day.revenue / Math.max(...analytics.revenue.dailyData.map(d => d.revenue))) * 100}%` }}
                        >
                          <span className="text-white text-xs font-semibold">₹{day.revenue?.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'service' && analytics && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">Service Analytics</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-xl p-6">
                <div className="text-gray-400 text-sm mb-2">Total Repairs</div>
                <div className="text-white text-3xl font-bold">{analytics.service?.totalRepairs || 0}</div>
              </div>
              <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-xl p-6">
                <div className="text-gray-400 text-sm mb-2">Pending Repairs</div>
                <div className="text-white text-3xl font-bold">{analytics.service?.pendingRepairs || 0}</div>
              </div>
            </div>

            {analytics.service?.byStatus && (
              <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-4">Repair Status Breakdown</h3>
                <div className="space-y-3">
                  {Object.entries(analytics.service.byStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <span className="text-gray-300 capitalize">{status}</span>
                      <span className="text-white font-bold">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'customers' && analytics && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">Customer Analytics</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-xl p-6">
                <div className="text-gray-400 text-sm mb-2">Total Customers</div>
                <div className="text-white text-3xl font-bold">{analytics.customers?.total || 0}</div>
              </div>
              <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-xl p-6">
                <div className="text-gray-400 text-sm mb-2">New This Month</div>
                <div className="text-white text-3xl font-bold">{analytics.customers?.newThisMonth || 0}</div>
              </div>
              <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-xl p-6">
                <div className="text-gray-400 text-sm mb-2">Active Customers</div>
                <div className="text-white text-3xl font-bold">{analytics.customers?.active || 0}</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && analytics && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">Inventory Analytics</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-xl p-6">
                <div className="text-gray-400 text-sm mb-2">Total Mobiles</div>
                <div className="text-white text-3xl font-bold">{analytics.inventory?.totalMobiles || 0}</div>
              </div>
              <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-xl p-6">
                <div className="text-gray-400 text-sm mb-2">In Stock</div>
                <div className="text-white text-3xl font-bold">{analytics.inventory?.inStock || 0}</div>
              </div>
              <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-xl p-6">
                <div className="text-gray-400 text-sm mb-2">Low Stock Items</div>
                <div className="text-white text-3xl font-bold text-orange-400">{analytics.inventory?.lowStock || 0}</div>
              </div>
            </div>

            {analytics.inventory?.topBrands && analytics.inventory.topBrands.length > 0 && (
              <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-4">Top Brands</h3>
                <div className="space-y-2">
                  {analytics.inventory.topBrands.map((brand, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-gray-300">{brand.name}</span>
                      <span className="text-white font-bold">{brand.count} units</span>
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

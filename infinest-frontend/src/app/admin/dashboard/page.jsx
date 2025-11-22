"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [subscriptionLogs, setSubscriptionLogs] = useState([]);
  const [payments, setPayments] = useState([]);
  const [userAnalytics, setUserAnalytics] = useState([]);
  const [overallAnalytics, setOverallAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [adminEmail, setAdminEmail] = useState('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL_AUTH || 'http://localhost:7000';

  useEffect(() => {
    // Check admin authentication
    const token = localStorage.getItem('adminToken');
    const email = localStorage.getItem('adminEmail');
    
    if (!token) {
      router.push('/admin-login');
      return;
    }
    
    setAdminEmail(email);
    fetchData();
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('adminToken');
    return {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all data in parallel
      const [statsRes, usersRes, activeUsersRes, logsRes, paymentsRes, analyticsRes, overallRes] = await Promise.all([
        axios.get(`${API_URL}/admin/stats`, getAuthHeaders()),
        axios.get(`${API_URL}/admin/users?limit=100`, getAuthHeaders()),
        axios.get(`${API_URL}/admin/users/active?days=30`, getAuthHeaders()),
        axios.get(`${API_URL}/admin/subscription-logs?limit=100`, getAuthHeaders()),
        axios.get(`${API_URL}/admin/payments?limit=100`, getAuthHeaders()),
        axios.get(`${API_URL}/admin/analytics/user-records`, getAuthHeaders()),
        axios.get(`${API_URL}/admin/analytics/overall?period=30`, getAuthHeaders())
      ]);

      setStats(statsRes.data.stats);
      setUsers(usersRes.data.users);
      setActiveUsers(activeUsersRes.data.activeUsers);
      setSubscriptionLogs(logsRes.data.logs);
      setPayments(paymentsRes.data.payments);
      setUserAnalytics(analyticsRes.data.userAnalytics);
      setOverallAnalytics(overallRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        router.push('/admin-login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminEmail');
    router.push('/admin-login');
  };

  const handleDeleteUser = async (userId) => {
    if (!deleteConfirm || deleteConfirm !== userId) {
      setDeleteConfirm(userId);
      setTimeout(() => setDeleteConfirm(null), 5000);
      return;
    }

    try {
      await axios.delete(`${API_URL}/admin/user/${userId}`, getAuthHeaders());
      alert('User deleted successfully!');
      setDeleteConfirm(null);
      fetchData(); // Refresh data
    } catch (error) {
      alert('Failed to delete user: ' + (error.response?.data?.message || error.message));
    }
  };

  const viewUserDetails = async (userId) => {
    try {
      const response = await axios.get(`${API_URL}/admin/user/${userId}`, getAuthHeaders());
      setSelectedUser(response.data);
    } catch (error) {
      alert('Failed to load user details');
    }
  };

  const filteredUsers = users.filter(user => 
    searchQuery === '' ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
                <p className="text-sm text-gray-400">Fixel Management Portal</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-400">Logged in as</p>
                <p className="text-white font-medium">{adminEmail}</p>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-6">
          <div className="flex space-x-1 overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'users', label: 'Users', icon: '👥' },
              { id: 'active-users', label: 'Active Users', icon: '🟢' },
              { id: 'subscriptions', label: 'Subscriptions', icon: '📝' },
              { id: 'payments', label: 'Payments', icon: '💰' },
              { id: 'analytics', label: 'Analytics', icon: '📈' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 font-medium transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-white border-b-2 border-purple-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-8">
        {activeTab === 'overview' && <OverviewTab stats={stats} overallAnalytics={overallAnalytics} />}
        {activeTab === 'users' && (
          <UsersTab 
            users={filteredUsers} 
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onViewDetails={viewUserDetails}
            onDeleteUser={handleDeleteUser}
            deleteConfirm={deleteConfirm}
          />
        )}
        {activeTab === 'active-users' && <ActiveUsersTab activeUsers={activeUsers} />}
        {activeTab === 'subscriptions' && <SubscriptionsTab logs={subscriptionLogs} />}
        {activeTab === 'payments' && <PaymentsTab payments={payments} />}
        {activeTab === 'analytics' && <AnalyticsTab userAnalytics={userAnalytics} overallAnalytics={overallAnalytics} />}
      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <UserDetailsModal user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ stats, overallAnalytics }) {
  if (!stats) return null;

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: '👥', color: 'from-blue-500 to-blue-600' },
    { label: 'Active Subscriptions', value: stats.activeSubscriptions, icon: '✅', color: 'from-green-500 to-green-600' },
    { label: 'Recent Sign-ups (7d)', value: stats.recentSignUps, icon: '🆕', color: 'from-purple-500 to-purple-600' },
    { label: 'Total Revenue', value: `₹${parseFloat(stats.revenue).toFixed(2)}`, icon: '💰', color: 'from-yellow-500 to-yellow-600' },
    { label: 'Total Payments', value: stats.totalPayments, icon: '💳', color: 'from-pink-500 to-pink-600' },
    { label: 'Completed Payments', value: stats.completedPayments, icon: '✔️', color: 'from-indigo-500 to-indigo-600' }
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, idx) => (
          <div key={idx} className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">{stat.label}</p>
                <p className="text-3xl font-bold text-white mt-2">{stat.value}</p>
              </div>
              <div className={`p-4 rounded-xl bg-gradient-to-br ${stat.color}`}>
                <span className="text-3xl">{stat.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Subscription Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-xl font-bold text-white mb-4">Subscription Status</h3>
          <div className="space-y-3">
            {stats.subscriptionBreakdown?.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                <span className="text-gray-300">{item.status}</span>
                <span className="text-white font-bold">{item._count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-xl font-bold text-white mb-4">Product Distribution</h3>
          <div className="space-y-3">
            {stats.productDistribution?.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                <span className="text-gray-300">{item.product}</span>
                <span className="text-white font-bold">{item._count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MongoDB Stats */}
      {overallAnalytics?.mongodb?.totals && (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-xl font-bold text-white mb-4">MongoDB Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-gray-700 rounded-lg">
              <p className="text-gray-400 text-sm">Shops</p>
              <p className="text-2xl font-bold text-white">{overallAnalytics.mongodb.totals.shops}</p>
            </div>
            <div className="text-center p-4 bg-gray-700 rounded-lg">
              <p className="text-gray-400 text-sm">Mobiles</p>
              <p className="text-2xl font-bold text-white">{overallAnalytics.mongodb.totals.mobiles}</p>
            </div>
            <div className="text-center p-4 bg-gray-700 rounded-lg">
              <p className="text-gray-400 text-sm">Customers</p>
              <p className="text-2xl font-bold text-white">{overallAnalytics.mongodb.totals.customers}</p>
            </div>
            <div className="text-center p-4 bg-gray-700 rounded-lg">
              <p className="text-gray-400 text-sm">Dealers</p>
              <p className="text-2xl font-bold text-white">{overallAnalytics.mongodb.totals.dealers}</p>
            </div>
            <div className="text-center p-4 bg-gray-700 rounded-lg">
              <p className="text-gray-400 text-sm">Products</p>
              <p className="text-2xl font-bold text-white">{overallAnalytics.mongodb.totals.products}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Users Tab Component
function UsersTab({ users, searchQuery, setSearchQuery, onViewDetails, onDeleteUser, deleteConfirm }) {
  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <input
          type="text"
          placeholder="Search users by email, username, or name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* Users Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">User</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">Contact</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">Subscription</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">Created</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-750">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-white font-medium">{user.name || user.username}</p>
                      <p className="text-gray-400 text-sm">{user.username}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-white text-sm">{user.email}</p>
                      {user.phone && <p className="text-gray-400 text-sm">{user.phone}</p>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {user.subscription ? (
                      <div>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          user.subscription.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {user.subscription.status}
                        </span>
                        <p className="text-gray-400 text-xs mt-1">
                          {user.subscription.plan?.name || 'Unknown Plan'}
                        </p>
                      </div>
                    ) : (
                      <span className="text-gray-500 text-sm">No subscription</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-gray-400 text-sm">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => onViewDetails(user.id)}
                        className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition"
                      >
                        View
                      </button>
                      <button
                        onClick={() => onDeleteUser(user.id)}
                        className={`px-3 py-1 text-white text-sm rounded transition ${
                          deleteConfirm === user.id
                            ? 'bg-red-700 hover:bg-red-800'
                            : 'bg-red-500 hover:bg-red-600'
                        }`}
                      >
                        {deleteConfirm === user.id ? 'Confirm?' : 'Delete'}
                      </button>
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

// Active Users Tab Component
function ActiveUsersTab({ activeUsers }) {
  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-4">
          Active Users (Last 30 Days) - {activeUsers.length} users
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">User</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">Email</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">Records Created</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">Last Activity</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">Subscription</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {activeUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-750">
                  <td className="px-6 py-4">
                    <p className="text-white font-medium">{user.name || user.username}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-gray-300">{user.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm font-medium">
                      {user.mongoActivity?.recordCount || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-gray-400 text-sm">
                      {new Date(user.mongoActivity?.lastActivity).toLocaleString()}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    {user.subscription && (
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        user.subscription.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {user.subscription.plan?.name || 'Unknown Plan'}
                      </span>
                    )}
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

// Subscriptions Tab Component
function SubscriptionsTab({ logs }) {
  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-xl font-bold text-white">Subscription Logs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">Date</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">User</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">Action</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">Message</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">Plan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-750">
                  <td className="px-6 py-4">
                    <p className="text-gray-400 text-sm">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-white font-medium">{log.user?.name || log.user?.username}</p>
                      <p className="text-gray-400 text-sm">{log.user?.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      log.action.includes('COMPLETED') || log.action.includes('STARTED')
                        ? 'bg-green-500/20 text-green-400'
                        : log.action.includes('FAILED') || log.action.includes('CANCELLED')
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-gray-300 text-sm">{log.message}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-gray-400 text-sm">
                      {log.subscription?.plan?.name || 'N/A'}
                    </p>
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

// Payments Tab Component
function PaymentsTab({ payments }) {
  const totalRevenue = payments
    .filter(p => p.status === 'COMPLETED')
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);

  return (
    <div className="space-y-6">
      {/* Payment Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <p className="text-gray-400 text-sm">Total Revenue</p>
          <p className="text-3xl font-bold text-white mt-2">₹{totalRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <p className="text-gray-400 text-sm">Total Payments</p>
          <p className="text-3xl font-bold text-white mt-2">{payments.length}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <p className="text-gray-400 text-sm">Completed Payments</p>
          <p className="text-3xl font-bold text-white mt-2">
            {payments.filter(p => p.status === 'COMPLETED').length}
          </p>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">Date</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">User</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">Amount</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">Payment ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-750">
                  <td className="px-6 py-4">
                    <p className="text-gray-400 text-sm">
                      {new Date(payment.createdAt).toLocaleString()}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-white font-medium">{payment.user?.name || payment.user?.username}</p>
                      <p className="text-gray-400 text-sm">{payment.user?.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-white font-bold">₹{parseFloat(payment.amount).toFixed(2)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      payment.status === 'COMPLETED'
                        ? 'bg-green-500/20 text-green-400'
                        : payment.status === 'PENDING'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-gray-400 text-xs font-mono">{payment.id}</p>
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

// Analytics Tab Component
function AnalyticsTab({ userAnalytics, overallAnalytics }) {
  // Sort by total records
  const sortedAnalytics = [...userAnalytics].sort(
    (a, b) => b.analytics.totalRecords - a.analytics.totalRecords
  );

  return (
    <div className="space-y-6">
      {/* Top Users */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-4">Top Active Users by Record Creation</h3>
        <div className="space-y-3">
          {sortedAnalytics.slice(0, 10).map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full text-white font-bold">
                  {idx + 1}
                </div>
                <div>
                  <p className="text-white font-medium">{item.user.name || item.user.username}</p>
                  <p className="text-gray-400 text-sm">{item.user.email}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">{item.analytics.totalRecords}</p>
                <p className="text-gray-400 text-sm">records</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Record Type Distribution */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-4">User Record Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">User</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">Mobiles</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">Products</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">Customers</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">Dealers</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {sortedAnalytics.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-750">
                  <td className="px-6 py-4">
                    <p className="text-white font-medium">{item.user.name || item.user.username}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-gray-300">{item.analytics.recordsByType.mobiles?.total || 0}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-gray-300">{item.analytics.recordsByType.products?.total || 0}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-gray-300">{item.analytics.recordsByType.customers?.total || 0}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-gray-300">{item.analytics.recordsByType.dealers?.total || 0}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-white font-bold">{item.analytics.totalRecords}</p>
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

// User Details Modal Component
function UserDetailsModal({ user, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">User Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition"
          >
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="bg-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-bold text-white mb-4">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-400 text-sm">Name</p>
                <p className="text-white">{user.user.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Username</p>
                <p className="text-white">{user.user.username}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Email</p>
                <p className="text-white">{user.user.email}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Phone</p>
                <p className="text-white">{user.user.phone || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Created At</p>
                <p className="text-white">{new Date(user.user.createdAt).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Subscription Info */}
          {user.user.subscription && (
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-bold text-white mb-4">Subscription</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Plan</p>
                  <p className="text-white">
                    {user.user.subscription.plan?.name || 'Unknown Plan'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Status</p>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    user.user.subscription.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {user.user.subscription.status}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* MongoDB Data */}
          {user.mongoData && (
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-bold text-white mb-4">MongoDB Data</h3>
              <div className="space-y-4">
                {user.mongoData.shops?.map((shop, idx) => (
                  <div key={idx} className="bg-gray-800 rounded-lg p-4">
                    <h4 className="text-white font-medium mb-2">{shop.shop_name}</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">Mobiles</p>
                        <p className="text-white font-bold">{shop.stats.mobiles}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Customers</p>
                        <p className="text-white font-bold">{shop.stats.customers}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Dealers</p>
                        <p className="text-white font-bold">{shop.stats.dealers}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {user.mongoData.products && (
                  <div>
                    <p className="text-gray-400 text-sm">Total Products</p>
                    <p className="text-white font-bold">{user.mongoData.products.count}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payment History */}
          {user.user.payments && user.user.payments.length > 0 && (
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-bold text-white mb-4">Recent Payments</h3>
              <div className="space-y-2">
                {user.user.payments.map((payment, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                    <div>
                      <p className="text-white font-medium">₹{parseFloat(payment.amount).toFixed(2)}</p>
                      <p className="text-gray-400 text-xs">{new Date(payment.createdAt).toLocaleString()}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      payment.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {payment.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

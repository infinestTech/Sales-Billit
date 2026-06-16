"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function ShopAdminLoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('📤 Login request:', formData);
      
      // Clear any old cached data before login
      console.log('🧹 Clearing old cached data...');
      localStorage.removeItem('shopAdminToken');
      localStorage.removeItem('shopAdminInfo');
      localStorage.removeItem('currentShopId');
      
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL_BILLIT || 'http://localhost:8000'}/api/shop-admin/login`,
        formData
      );

      console.log('✅ Login response:', response.data);

      if (response.data.success) {
        const shopAdmin = response.data.shopAdmin;
        console.log('👤 Shop admin data:', shopAdmin);
        console.log('🏪 Available shops:', shopAdmin.shops);
        
        // Store fresh shop admin token and data
        localStorage.setItem('shopAdminToken', response.data.token);
        localStorage.setItem('shopAdminInfo', JSON.stringify(shopAdmin));
        
        // Set initial shop if available
        if (shopAdmin.shops && shopAdmin.shops.length > 0) {
          const initialShopId = shopAdmin.current_shop_id || shopAdmin.shops[0].id;
          localStorage.setItem('currentShopId', initialShopId);
          console.log('🎯 Initial shop ID set:', initialShopId);
        }
        
        console.log('✅ Fresh data stored to localStorage');
        
        // Redirect to shop admin dashboard
        router.push('/shop-admin/dashboard');
      }
    } catch (err) {
      console.error('❌ Login error:', err.response?.data || err.message);
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-indigo-950 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-green-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-green-600/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(34,197,94,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,197,94,0.03)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none z-0"></div>
      
      <div className="relative z-20 w-full max-w-md">
        {/* Main login card */}
        <div className="backdrop-blur-xl bg-gray-900/40 border border-gray-700/50 rounded-2xl shadow-2xl p-8 relative overflow-hidden">
          {/* Card glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-transparent to-emerald-500/10 rounded-2xl pointer-events-none"></div>

          {/* Header */}
          <div className="relative z-30 text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-green-600 to-emerald-600 rounded-full mb-4 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent mb-2">
              Shop Admin Portal
            </h2>
            <p className="text-gray-400 text-sm">Centralized Shop Management & Monitoring</p>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-6 backdrop-blur-sm">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-red-400 text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              {/* Username input */}
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400 group-focus-within:text-green-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  type="text"
                  name="username"
                  placeholder="Shop Username"
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all duration-200 backdrop-blur-sm"
                  required
                />
              </div>

              {/* Password input */}
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400 group-focus-within:text-green-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all duration-200 backdrop-blur-sm"
                  required
                />
              </div>
            </div>

            {/* Sign in button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full relative overflow-hidden bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-green-400/20 to-emerald-400/20 opacity-0 hover:opacity-100 transition-opacity duration-200"></div>
              <span className="relative flex items-center justify-center">
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Authenticating...
                  </>
                ) : (
                  "Sign In as Admin"
                )}
              </span>
            </button>
          </form>

          {/* Admin Access Notice */}
          <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg backdrop-blur-sm relative z-30">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-green-300 text-sm font-medium">Shop Admin Access Only</p>
                <p className="text-green-400/70 text-xs mt-1">
                  This portal is exclusively for authorized shop administrators to manage and monitor their shops. All access attempts are logged and monitored.
                </p>
              </div>
            </div>
          </div>

          {/* Footer links */}
          <div className="mt-6 text-center relative z-30">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-600/50 to-transparent"></div>
              <span className="text-gray-500 text-xs">🔒 SECURE ACCESS</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-600/50 to-transparent"></div>
            </div>
            <p className="text-gray-400 text-sm">
              Need help?{" "}
              <span className="text-green-400 font-medium">Contact Infinest Support</span>
            </p>
          </div>
        </div>

        {/* Bottom accent */}
        <div className="mt-4 text-center">
          <div className="inline-flex items-center text-gray-500 text-xs">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
            Secured by Fixel Shop Admin System
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .delay-1000 {
          animation-delay: 1s;
        }
        .delay-500 {
          animation-delay: 0.5s;
        }
      `}</style>
    </div>
  );
}

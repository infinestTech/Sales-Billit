"use client"

import { useState } from "react"
import Link from "next/link"
import { 
  Smartphone, 
  ShoppingCart, 
  Wrench, 
  BarChart3, 
  Shield, 
  Zap,
  CheckCircle,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Users,
  Clock,
  Wallet,
  Package
} from "lucide-react"

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState("service")

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-slate-950 relative overflow-hidden">
      {/* Animated background elements - Scattered gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Top section orbs */}
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-20 left-1/4 w-64 h-64 bg-purple-500/8 rounded-full blur-3xl animate-pulse delay-700"></div>
        <div className="absolute top-1/3 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/4 right-1/3 w-48 h-48 bg-cyan-500/8 rounded-full blur-2xl animate-pulse delay-300"></div>
        
        {/* Middle section orbs */}
        <div className="absolute top-1/2 left-1/5 w-80 h-80 bg-indigo-500/9 rounded-full blur-3xl animate-pulse delay-1500"></div>
        <div className="absolute top-1/2 right-1/4 w-72 h-72 bg-pink-500/8 rounded-full blur-3xl animate-pulse delay-800"></div>
        <div className="absolute top-2/3 left-1/2 w-56 h-56 bg-blue-400/7 rounded-full blur-2xl animate-pulse delay-1200"></div>
        
        {/* Bottom section orbs */}
        <div className="absolute -bottom-40 right-1/3 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-teal-500/8 rounded-full blur-3xl animate-pulse delay-900"></div>
        <div className="absolute -bottom-20 -left-32 w-80 h-80 bg-green-500/9 rounded-full blur-3xl animate-pulse delay-1100"></div>
        <div className="absolute bottom-1/3 right-1/5 w-48 h-48 bg-violet-500/7 rounded-full blur-2xl animate-pulse delay-400"></div>
        
        {/* Extra scattered orbs */}
        <div className="absolute top-3/4 -right-20 w-56 h-56 bg-blue-300/6 rounded-full blur-2xl animate-pulse delay-600"></div>
        <div className="absolute top-1/5 left-2/3 w-40 h-40 bg-emerald-400/7 rounded-full blur-xl animate-pulse delay-1300"></div>
        <div className="absolute bottom-1/2 -left-16 w-52 h-52 bg-purple-400/6 rounded-full blur-2xl animate-pulse delay-200"></div>
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none"></div>

      <div className="relative z-10">
        {/* Header Section - Two Column Hero */}
        <div className="container mx-auto px-4 sm:px-6 md:px-12 lg:px-16 pt-12 sm:pt-16 md:pt-20 pb-8 md:pb-12">
          <div className="grid md:grid-cols-2 gap-8 sm:gap-12 md:gap-16 lg:gap-24 items-center mb-12 md:mb-16 min-h-[auto] md:min-h-[70vh] max-w-7xl mx-auto">
            {/* Left Column - Content */}
            <div className="space-y-6 md:space-y-8 px-0 md:px-6 lg:px-8">
              {/* Logo/Brand */}
              <div className="flex items-center gap-3 md:gap-4">
                <div className="flex items-center justify-center w-12 h-12 md:w-16 md:h-16 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 rounded-2xl shadow-2xl">
                  <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent">
                  Fixel
                </h1>
              </div>
              
              <div className="space-y-4">
                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight">
                  Transform Your Business Operations
                </h2>
                
                <p className="text-base sm:text-lg md:text-xl text-gray-400 leading-relaxed">
                  Comprehensive solutions for mobile service centers and retail businesses. 
                  Streamline your workflow, boost productivity, and grow with confidence.
                </p>
              </div>

              {/* Key Benefits */}
              <div className="grid grid-cols-1 gap-4">
                {[
                  { icon: Zap, text: "Lightning-fast performance", color: "from-blue-500 to-indigo-500" },
                  { icon: Shield, text: "Secure & reliable platform", color: "from-indigo-500 to-purple-500" },
                  { icon: TrendingUp, text: "Grow your business 3x faster", color: "from-emerald-500 to-green-500" }
                ].map((benefit, idx) => (
                  <div key={idx} className="flex items-center gap-3 group">
                    <div className={`p-2 bg-gradient-to-r ${benefit.color} rounded-lg group-hover:scale-110 transition-transform`}>
                      <benefit.icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-gray-300 font-medium">{benefit.text}</span>
                  </div>
                ))}
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col gap-4 pt-4">
                <div className="flex flex-wrap gap-4">
                  <Link 
                    href="/pricing"
                    className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold px-8 py-4 rounded-xl transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-lg"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-indigo-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                    <span className="relative flex items-center gap-2">
                      View Pricing
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </Link>

                  <Link 
                    href="/login"
                    className="group relative overflow-hidden bg-gray-800/50 hover:bg-gray-700/50 border border-gray-600/50 text-white font-semibold px-8 py-4 rounded-xl transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-500/50 backdrop-blur-sm shadow-lg"
                  >
                    <span className="relative flex items-center gap-2">
                      Sign In
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </Link>
                </div>

                {/* Quick Access Login Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <div className="text-xs text-gray-400 flex items-center">
                    <span className="hidden sm:inline mr-3">Quick access:</span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link 
                      href="/billit-login"
                      className="group relative overflow-hidden bg-blue-900/30 hover:bg-blue-800/40 border border-blue-500/40 hover:border-blue-400/60 text-blue-300 hover:text-blue-200 font-medium px-4 py-2 rounded-lg transition-all duration-200 backdrop-blur-sm text-sm"
                    >
                      <span className="relative flex items-center gap-2">
                        <Wrench className="w-4 h-4" />
                        Service Login
                      </span>
                    </Link>

                    <a 
                      href={`${process.env.NEXT_PUBLIC_SALES_FRONTEND_URL || 'http://localhost:3020'}#bank`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative overflow-hidden bg-emerald-900/30 hover:bg-emerald-800/40 border border-emerald-500/40 hover:border-emerald-400/60 text-emerald-300 hover:text-emerald-200 font-medium px-4 py-2 rounded-lg transition-all duration-200 backdrop-blur-sm text-sm"
                    >
                      <span className="relative flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4" />
                        Sales Login
                      </span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 sm:gap-6 pt-8 border-t border-gray-800/50">
                <div>
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                    10K+
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500">Active Users</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    99.9%
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500">Uptime</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">
                    24/7
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500">Support</div>
                </div>
              </div>
            </div>

            {/* Right Column - Visual Elements */}
            <div className="hidden md:block relative h-full min-h-[500px] px-4 md:px-6">
              {/* Floating gradient points */}
              <div className="absolute inset-0">
                {/* Large center card */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-96 backdrop-blur-xl bg-gradient-to-br from-blue-900/40 via-indigo-900/40 to-purple-900/40 border border-blue-500/30 rounded-3xl shadow-2xl p-6 animate-float">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl">
                      <BarChart3 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold">Dashboard</h3>
                      <p className="text-gray-400 text-sm">Real-time analytics</p>
                    </div>
                  </div>
                  
                  {/* Mock chart bars */}
                  <div className="space-y-4 mt-8">
                    {[60, 85, 45, 90, 70].map((height, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-800/50 rounded-lg overflow-hidden h-8">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg transition-all duration-1000"
                            style={{ width: `${height}%` }}
                          />
                        </div>
                        <span className="text-gray-400 text-sm w-12">{height}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Floating point badges */}
                <div className="absolute top-10 right-10 backdrop-blur-lg bg-emerald-900/40 border border-emerald-500/30 rounded-2xl p-4 shadow-xl animate-float-delayed-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                    <div>
                      <div className="text-white font-bold text-sm">Sales Up</div>
                      <div className="text-emerald-400 text-xs">+32% this month</div>
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-20 left-10 backdrop-blur-lg bg-purple-900/40 border border-purple-500/30 rounded-2xl p-4 shadow-xl animate-float-delayed-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-400" />
                    <div>
                      <div className="text-white font-bold text-sm">Customers</div>
                      <div className="text-purple-400 text-xs">1,234 active</div>
                    </div>
                  </div>
                </div>

                <div className="absolute top-1/3 -left-4 backdrop-blur-lg bg-blue-900/40 border border-blue-500/30 rounded-2xl p-4 shadow-xl animate-float-delayed-3">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-blue-400" />
                    <div>
                      <div className="text-white font-bold text-sm">Revenue</div>
                      <div className="text-blue-400 text-xs">₹89,450</div>
                    </div>
                  </div>
                </div>

                {/* Gradient orbs */}
                <div className="absolute top-20 left-20 w-32 h-32 bg-gradient-to-r from-blue-500/30 to-indigo-500/30 rounded-full blur-2xl animate-pulse"></div>
                <div className="absolute bottom-32 right-16 w-40 h-40 bg-gradient-to-r from-emerald-500/30 to-green-500/30 rounded-full blur-2xl animate-pulse delay-1000"></div>
                <div className="absolute top-1/2 right-8 w-24 h-24 bg-gradient-to-r from-purple-500/30 to-pink-500/30 rounded-full blur-2xl animate-pulse delay-500"></div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex justify-center mb-8 md:mb-12 px-4">
            <div className="inline-flex flex-col sm:flex-row w-full sm:w-auto bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-2 gap-2 sm:gap-0">
              <button
                onClick={() => setActiveTab("service")}
                className={`px-4 sm:px-6 md:px-8 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 text-sm sm:text-base ${
                  activeTab === "service"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Smartphone className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="whitespace-nowrap">Service Management</span>
              </button>
              <button
                onClick={() => setActiveTab("sales")}
                className={`px-4 sm:px-6 md:px-8 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 text-sm sm:text-base ${
                  activeTab === "sales"
                    ? "bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="whitespace-nowrap">Sales & Retail</span>
              </button>
            </div>
          </div>

          {/* Service Management Content */}
          {activeTab === "service" && (
            <div className="max-w-6xl mx-auto animate-fadeIn px-4">
              <div className="backdrop-blur-xl bg-gradient-to-br from-blue-900/30 via-indigo-900/30 to-purple-900/30 border border-blue-500/30 rounded-2xl md:rounded-3xl shadow-2xl p-6 sm:p-8 md:p-12 mb-8 md:mb-12">
                <div className="text-center mb-8 md:mb-10">
                  <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 mb-3 sm:mb-4">
                    <Wrench className="w-3 h-3 sm:w-4 sm:h-4 text-blue-400" />
                    <span className="text-xs sm:text-sm text-blue-300">For Mobile Repair Shops</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent mb-3 md:mb-4">
                    Professional Service Management
                  </h2>
                  <p className="text-gray-400 text-lg">
                    Everything you need to manage your mobile repair business efficiently
                  </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {[
                    {
                      icon: Smartphone,
                      title: "Service Tracking",
                      description: "Track every repair from intake to delivery with detailed status updates"
                    },
                    {
                      icon: BarChart3,
                      title: "Analytics Dashboard",
                      description: "Real-time insights into your business performance and trends"
                    },
                    {
                      icon: Wallet,
                      title: "Smart Billing",
                      description: "WhatsApp integration for instant professional billing"
                    },
                    {
                      icon: Package,
                      title: "Inventory Control",
                      description: "Manage parts, accessories, and stock levels effortlessly"
                    },
                    {
                      icon: Users,
                      title: "Customer Management",
                      description: "Maintain detailed customer records and service history"
                    },
                    {
                      icon: TrendingUp,
                      title: "Expense Tracking",
                      description: "Monitor business expenses and profitability in real-time"
                    }
                  ].map((feature, idx) => (
                    <div 
                      key={idx}
                      className="group bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl md:rounded-2xl p-4 sm:p-6 hover:border-blue-500/50 transition-all duration-300 hover:scale-105"
                    >
                      <div className="p-2 sm:p-3 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-lg sm:rounded-xl w-fit mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                        <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold text-white mb-2">{feature.title}</h3>
                      <p className="text-sm sm:text-base text-gray-400">{feature.description}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl md:rounded-2xl p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                    <div className="p-2 bg-blue-500/20 rounded-lg flex-shrink-0">
                      <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-base sm:text-lg font-semibold text-white mb-2">Why Choose Fixel Service?</h4>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                        {[
                          "Unlimited service records",
                          "Multi-device support",
                          "No advertisements",
                          "Regular updates & support",
                          "Secure data backup",
                          "Priority customer support"
                        ].map((item, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-sm sm:text-base text-gray-300">
                            <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-blue-400 flex-shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sales & Retail Content */}
          {activeTab === "sales" && (
            <div className="max-w-6xl mx-auto animate-fadeIn px-4">
              <div className="backdrop-blur-xl bg-gradient-to-br from-emerald-900/30 via-green-900/30 to-teal-900/30 border border-emerald-500/30 rounded-2xl md:rounded-3xl shadow-2xl p-6 sm:p-8 md:p-12 mb-8 md:mb-12">
                <div className="text-center mb-8 md:mb-10">
                  <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 mb-3 sm:mb-4">
                    <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-400" />
                    <span className="text-xs sm:text-sm text-emerald-300">For Retail Businesses</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent mb-3 md:mb-4">
                    Complete Sales Solution
                  </h2>
                  <p className="text-sm sm:text-base md:text-lg text-gray-400">
                    Power your retail operations with comprehensive sales management tools
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
                  {[
                    {
                      icon: ShoppingCart,
                      title: "POS System",
                      description: "Fast and intuitive point of sale for seamless transactions"
                    },
                    {
                      icon: Package,
                      title: "Product Management",
                      description: "Organize and manage your entire product catalog"
                    },
                    {
                      icon: BarChart3,
                      title: "Sales Analytics",
                      description: "Track sales trends, revenue, and business growth"
                    },
                    {
                      icon: Users,
                      title: "Customer Database",
                      description: "Build and manage customer relationships effectively"
                    },
                    {
                      icon: TrendingUp,
                      title: "Revenue Insights",
                      description: "Detailed reports on profits, expenses, and margins"
                    },
                    {
                      icon: Clock,
                      title: "Quick Checkout",
                      description: "Speed up sales with optimized checkout process"
                    }
                  ].map((feature, idx) => (
                    <div 
                      key={idx}
                      className="group bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl md:rounded-2xl p-4 sm:p-6 hover:border-emerald-500/50 transition-all duration-300 hover:scale-105"
                    >
                      <div className="p-2 sm:p-3 bg-gradient-to-r from-emerald-500/20 to-green-500/20 rounded-lg sm:rounded-xl w-fit mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                        <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold text-white mb-2">{feature.title}</h3>
                      <p className="text-sm sm:text-base text-gray-400">{feature.description}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl md:rounded-2xl p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                    <div className="p-2 bg-emerald-500/20 rounded-lg flex-shrink-0">
                      <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-base sm:text-lg font-semibold text-white mb-2">Why Choose Fixel Sales?</h4>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                        {[
                          "Unlimited transactions",
                          "Real-time inventory sync",
                          "Advanced reporting",
                          "Multi-user support",
                          "Cloud-based security",
                          "24/7 customer support"
                        ].map((item, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-sm sm:text-base text-gray-300">
                            <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-400 flex-shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom CTA */}
          <div className="max-w-4xl mx-auto text-center mt-12 md:mt-16 px-4">
            <div className="backdrop-blur-xl bg-gradient-to-r from-blue-900/30 via-indigo-900/30 to-emerald-900/30 border border-gray-700/50 rounded-2xl md:rounded-3xl shadow-2xl p-6 sm:p-8 md:p-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 md:mb-4">
                Ready to Transform Your Business?
              </h2>
              <p className="text-sm sm:text-base md:text-lg text-gray-400 mb-6 md:mb-8">
                Join thousands of businesses already using Fixel to streamline operations and boost growth
              </p>
              <Link 
                href="/pricing"
                className="inline-flex items-center gap-2 sm:gap-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 hover:from-blue-700 hover:via-indigo-700 hover:to-emerald-700 text-white font-bold px-6 sm:px-8 md:px-10 py-3 sm:py-4 md:py-5 rounded-xl transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-2xl text-base sm:text-lg"
              >
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
                View All Plans
                <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800/50 mt-12 md:mt-20">
          <div className="container mx-auto px-4 py-6 md:py-8">
            <div className="text-center text-gray-500 text-sm">
              <p>&copy; 2026 Fixel. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translate(-50%, -50%) translateY(0px);
          }
          50% {
            transform: translate(-50%, -50%) translateY(-20px);
          }
        }

        @keyframes float-delayed-1 {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-15px) rotate(2deg);
          }
        }

        @keyframes float-delayed-2 {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-12px) rotate(-2deg);
          }
        }

        @keyframes float-delayed-3 {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-18px) rotate(1deg);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }

        .animate-float {
          animation: float 6s ease-in-out infinite;
        }

        .animate-float-delayed-1 {
          animation: float-delayed-1 5s ease-in-out infinite;
          animation-delay: 0.5s;
        }

        .animate-float-delayed-2 {
          animation: float-delayed-2 7s ease-in-out infinite;
          animation-delay: 1s;
        }

        .animate-float-delayed-3 {
          animation: float-delayed-3 6s ease-in-out infinite;
          animation-delay: 1.5s;
        }

        .delay-1000 {
          animation-delay: 1s;
        }

        .delay-200 {
          animation-delay: 0.2s;
        }

        .delay-300 {
          animation-delay: 0.3s;
        }

        .delay-400 {
          animation-delay: 0.4s;
        }

        .delay-500 {
          animation-delay: 0.5s;
        }

        .delay-600 {
          animation-delay: 0.6s;
        }

        .delay-700 {
          animation-delay: 0.7s;
        }

        .delay-800 {
          animation-delay: 0.8s;
        }

        .delay-900 {
          animation-delay: 0.9s;
        }

        .delay-1100 {
          animation-delay: 1.1s;
        }

        .delay-1200 {
          animation-delay: 1.2s;
        }

        .delay-1300 {
          animation-delay: 1.3s;
        }

        .delay-1500 {
          animation-delay: 1.5s;
        }
      `}</style>
    </div>
  )
}

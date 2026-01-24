"use client";

import { useRouter } from "next/navigation";
import { Sparkles, Package, ArrowRight, Zap } from "lucide-react";

export default function PricingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-indigo-950 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>

      <div className="relative z-10 container mx-auto px-4 py-20">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent mb-6">
            Choose Your Product
          </h1>
          <p className="text-gray-400 text-xl max-w-2xl mx-auto">
            Select the perfect solution for your business needs
          </p>
        </div>

        {/* Product Selection Cards */}
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
          {/* Service Plan Card */}
          <div
            onClick={() => router.push('/pricing/service')}
            className="group relative backdrop-blur-xl bg-gradient-to-br from-blue-900/40 via-indigo-900/40 to-purple-900/40 border-2 border-blue-500/50 rounded-3xl shadow-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-blue-500/20"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-transparent to-indigo-500/20 rounded-3xl"></div>
            
            <div className="relative z-10 p-10">
              <div className="flex items-center justify-center mb-6">
                <div className="p-6 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-3xl shadow-xl">
                  <Sparkles className="w-16 h-16 text-white" />
                </div>
              </div>

              <h2 className="text-4xl font-bold text-white text-center mb-4">
                Service Plans
              </h2>
              
              <p className="text-gray-300 text-center mb-8 text-lg">
                Professional service management for mobile repair shops and service centers
              </p>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-2 text-gray-300">
                  <Zap className="w-5 h-5 text-blue-400" />
                  <span>Customer Management</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Zap className="w-5 h-5 text-blue-400" />
                  <span>WhatsApp Billing</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Zap className="w-5 h-5 text-blue-400" />
                  <span>Analytics & Reports</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-blue-400 group-hover:text-blue-300 transition-colors">
                <span className="font-semibold">View Service Plans</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>

          {/* Sales Plan Card */}
          <div
            onClick={() => router.push('/pricing/sales')}
            className="group relative backdrop-blur-xl bg-gradient-to-br from-emerald-900/40 via-green-900/40 to-teal-900/40 border-2 border-emerald-500/50 rounded-3xl shadow-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-emerald-500/20"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-transparent to-green-500/20 rounded-3xl"></div>
            
            <div className="relative z-10 p-10">
              <div className="flex items-center justify-center mb-6">
                <div className="p-6 bg-gradient-to-r from-emerald-500 to-green-600 rounded-3xl shadow-xl">
                  <Package className="w-16 h-16 text-white" />
                </div>
              </div>

              <h2 className="text-4xl font-bold text-white text-center mb-4">
                Sales Plans
              </h2>
              
              <p className="text-gray-300 text-center mb-8 text-lg">
                Powerful inventory and billing solutions for retail businesses
              </p>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-2 text-gray-300">
                  <Zap className="w-5 h-5 text-emerald-400" />
                  <span>Inventory Management</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Zap className="w-5 h-5 text-emerald-400" />
                  <span>GST Calculator</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Zap className="w-5 h-5 text-emerald-400" />
                  <span>Supplier Management</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-emerald-400 group-hover:text-emerald-300 transition-colors">
                <span className="font-semibold">View Sales Plans</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <p className="text-gray-400 text-sm">
            Not sure which plan is right for you? <a href="/contact" className="text-blue-400 hover:text-blue-300 underline">Contact us</a>
          </p>
        </div>
      </div>
    </div>
  );
}

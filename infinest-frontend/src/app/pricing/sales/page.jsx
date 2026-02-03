"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { Check, Sparkles, Crown, Shield, Zap, Star, Gift, Package, TrendingUp, DollarSign } from "lucide-react";
import { logAndNotify, logError, logSuccess } from "@/utils/logger";

export default function SalesPricingPage() {
  const [userId, setUserId] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [hasUsedTrial, setHasUsedTrial] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/login");
      return;
    }
    try {
      const decoded = jwtDecode(token);
      if (!decoded.userId) throw new Error("Invalid token payload");
      setUserId(decoded.userId);
    } catch (err) {
      logError("Invalid or expired token", err);
      localStorage.removeItem("token");
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    const checkTrialStatus = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/check-trial-status`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setHasUsedTrial(response.data.hasUsedTrial || false);
      } catch (error) {
        console.error("Failed to check trial status:", error);
      }
    };

    if (userId) {
      checkTrialStatus();
    }
  }, [userId]);

  const handlePlanSelect = async (plan) => {
    if (!userId) {
      logAndNotify("Please log in to continue.", "warning");
      return;
    }

    const { name, price, mongoPlanId, mongoCategoryId } = plan;

    try {
      setLoadingPlan(name);

      // For Basic plan (free)
      if (name === "Basic" && price === 0) {
        const token = localStorage.getItem("token");
        if (!token) {
          logAndNotify("Authentication token missing. Please login again.", "error");
          router.replace("/login");
          return;
        }

        try {
          const response = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/subscribe`,
            { planId: mongoPlanId, categoryId: mongoCategoryId, isPaidPlan: false },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (response.data.success) {
            if (response.data.noNewSubscription && response.data.alreadySubscribed) {
              const activePlanName = response.data.activePlan?.planName || "active plan";
              logAndNotify(`You already have an active subscription: ${activePlanName}.`, "warning");
              return;
            } else if (response.data.newSubscriptionCreated || !response.data.alreadySubscribed) {
              logSuccess("Welcome to Fixel Sales! Enjoy your premium trial!");
              // Redirect to sales login
              const salesUrl = process.env.NEXT_PUBLIC_SALES_FRONTEND_URL || "http://localhost:3020";
              window.location.href = `${salesUrl}#login`;
            }
          }
        } catch (error) {
          logError("Subscription failed", error);
          logAndNotify(error.response?.data?.message || "Failed to subscribe. Please try again.", "error");
        }
        setLoadingPlan(null);
        return;
      }

      // For Premium/Gold plan (paid)
      const token = localStorage.getItem("token");
      if (!token) {
        logAndNotify("Authentication token missing. Please login again.", "error");
        router.replace("/login");
        return;
      }

      try {
        const res = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/subscribe`,
          { planId: mongoPlanId, categoryId: mongoCategoryId, isPaidPlan: true },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const { orderId, amount: razorpayAmount, razorpayKeyId } = res.data;

        const options = {
          key: razorpayKeyId,
          amount: razorpayAmount,
          currency: "INR",
          name: "Fixel Sales",
          description: `Subscription for ${name}`,
          order_id: orderId,
          handler: async function (response) {
            try {
              await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/create-subscription`,
                {
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                  amount: razorpayAmount / 100,
                },
                { headers: { Authorization: `Bearer ${token}` } }
              );

              logSuccess("Sales subscription activated successfully!");
              const salesUrl = process.env.NEXT_PUBLIC_SALES_FRONTEND_URL || "http://localhost:3020";
              window.location.href = salesUrl;
            } catch (err) {
              logError("Payment verification failed", err);
              logAndNotify("Payment verification failed. Please contact support.", "error");
            }
          },
          prefill: {
            email: userId,
          },
          theme: {
            color: "#3B82F6",
          },
        };

        const razorpay = new window.Razorpay(options);
        razorpay.open();
      } catch (error) {
        logError("Failed to create payment order", error);
        logAndNotify("Failed to initiate payment. Please try again.", "error");
      } finally {
        setLoadingPlan(null);
      }
    } catch (err) {
      console.error("Plan selection error:", err);
      setLoadingPlan(null);
    }
  };

  const premiumPlan = {
    name: "Premium",
    price: 499,
    originalPrice: "₹1999",
    savePercentage: 75,
    term: "Monthly",
    mongoPlanId: "sales-premium",
    mongoCategoryId: "Sales",
    description: "Complete sales suite for high-volume retailers",
    features: [
      { label: "Unlimited Products", icon: Package },
      { label: "30 Bank Accounts", icon: DollarSign },
      { label: "100 Suppliers", icon: TrendingUp },
      { label: "GST Calculator", icon: Check },
      { label: "Advanced Analytics", icon: Check },
      { label: "Priority Support", icon: Check },
      { label: "WhatsApp Integration", icon: Check },
      { label: "Multi-Device Sync", icon: Check },
      { label: "Custom Reports", icon: Check },
      { label: "No Advertisements", icon: Check },
    ],
  };

  const basicPlan = {
    name: "Basic",
    price: 0,
    mongoPlanId: "sales-basic",
    mongoCategoryId: "Sales",
    description: "Try all features free",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-indigo-950 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-green-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal-600/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>

      <div className="relative z-10 container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/30 rounded-full px-4 py-2 mb-6">
            <Package className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-emerald-300">Sales & Inventory Management</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400 bg-clip-text text-transparent mb-4">
            Sales Plans
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Powerful inventory and billing solutions for retail businesses
          </p>
        </div>

        {/* Premium & Basic Plans Side by Side */}
        <div className={`max-w-6xl mx-auto mb-8 ${hasUsedTrial ? 'flex justify-center' : 'grid md:grid-cols-2 gap-6'}`}>
          {/* Premium Plan */}
          <div className={`relative backdrop-blur-xl bg-gradient-to-br from-emerald-900/40 via-green-900/40 to-teal-900/40 border-2 border-emerald-500/50 rounded-3xl shadow-2xl overflow-hidden ${hasUsedTrial ? 'max-w-xl' : ''}`}>
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-transparent to-green-500/20 rounded-3xl"></div>
            
            <div className="absolute top-6 right-6 z-20">
              <div className="flex items-center gap-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-4 py-1.5 rounded-full text-sm font-semibold shadow-lg">
                <Crown className="w-4 h-4" />
                MOST POPULAR
              </div>
            </div>

            <div className="relative z-10 p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl">
                  <Package className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white">Premium</h2>
                  <p className="text-emerald-300 text-sm">Professional Plan</p>
                </div>
              </div>

              <p className="text-gray-300 mb-6">{premiumPlan.description}</p>

              <div className="flex items-baseline gap-3 mb-6">
                <span className="text-5xl font-bold text-white">₹{premiumPlan.price}</span>
                <div>
                  <span className="text-gray-400 line-through text-lg">{premiumPlan.originalPrice}</span>
                  <span className="ml-2 bg-green-500/20 text-green-400 px-2 py-1 rounded text-sm font-semibold">
                    Save {premiumPlan.savePercentage}%
                  </span>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                {premiumPlan.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <div className="p-1 bg-green-500/20 rounded-full">
                      <Check className="w-3 h-3 text-green-400" />
                    </div>
                    <span className="text-gray-300">{feature.label}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handlePlanSelect(premiumPlan)}
                disabled={loadingPlan === "Premium"}
                className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loadingPlan === "Premium" ? "Processing..." : (
                  <>
                    <Zap className="w-5 h-5" />
                    Get Premium
                  </>
                )}
              </button>

              <p className="text-gray-400 text-sm mt-4 text-center">
                ₹{premiumPlan.price}/month • Cancel anytime
              </p>
            </div>
          </div>

          {/* Basic Plan - Try Premium Free */}
          {!hasUsedTrial && (
          <div className="relative backdrop-blur-xl bg-gradient-to-br from-blue-900/40 via-indigo-900/40 to-purple-900/40 border-2 border-blue-500/50 rounded-3xl shadow-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-transparent to-indigo-500/20 rounded-3xl"></div>
            
            <div className="absolute top-6 right-6 z-20">
              <div className="flex items-center gap-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-1.5 rounded-full text-sm font-semibold shadow-lg">
                <Star className="w-4 h-4" />
                FREE TRIAL
              </div>
            </div>

            <div className="relative z-10 p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl">
                  <Gift className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white">Start Free</h2>
                  <p className="text-green-300 text-sm">Try Premium Features Free</p>
                </div>
              </div>

              <p className="text-gray-300 mb-6">Get full access to all premium features with no credit card required</p>

              <div className="flex items-baseline gap-3 mb-6">
                <span className="text-5xl font-bold text-white">₹0</span>
                <span className="text-gray-400 text-lg">Free to start</span>
              </div>

              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <div className="p-1 bg-green-500/20 rounded-full">
                    <Check className="w-3 h-3 text-green-400" />
                  </div>
                  <span className="text-gray-300">All Premium Features Included</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="p-1 bg-green-500/20 rounded-full">
                    <Check className="w-3 h-3 text-green-400" />
                  </div>
                  <span className="text-gray-300">No Credit Card Required</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="p-1 bg-green-500/20 rounded-full">
                    <Check className="w-3 h-3 text-green-400" />
                  </div>
                  <span className="text-gray-300">Start Immediately</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="p-1 bg-green-500/20 rounded-full">
                    <Check className="w-3 h-3 text-green-400" />
                  </div>
                  <span className="text-gray-300">Unlimited Products</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="p-1 bg-green-500/20 rounded-full">
                    <Check className="w-3 h-3 text-green-400" />
                  </div>
                  <span className="text-gray-300">GST Calculator & Reports</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="p-1 bg-green-500/20 rounded-full">
                    <Check className="w-3 h-3 text-green-400" />
                  </div>
                  <span className="text-gray-300">Full Inventory Management</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="p-1 bg-green-500/20 rounded-full">
                    <Check className="w-3 h-3 text-green-400" />
                  </div>
                  <span className="text-gray-300">Upgrade Anytime</span>
                </div>
              </div>

              <button
                onClick={() => handlePlanSelect(basicPlan)}
                disabled={loadingPlan === "Basic"}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loadingPlan === "Basic" ? "Processing..." : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Start Free Trial
                  </>
                )}
              </button>

              <p className="text-gray-400 text-sm mt-4 text-center">
                No payment required • Instant access
              </p>
            </div>
          </div>
          )}
        </div>

        {/* Trust badges */}
        <div className="mt-16 text-center">
          <div className="flex flex-wrap items-center justify-center gap-8 text-gray-500">
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              <span className="text-sm">Secure Payment</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              <span className="text-sm">Cancel Anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              <span className="text-sm">Instant Activation</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

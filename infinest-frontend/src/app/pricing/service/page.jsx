"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { Check, Sparkles, Crown, Shield, Zap, Star, Gift } from "lucide-react";
import { logAndNotify, logError, logSuccess } from "@/utils/logger";

export default function PricingPage() {
  const [userId, setUserId] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [billingPeriod, setBillingPeriod] = useState("monthly");
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

  const handlePlanSelect = async (plan) => {
    if (!userId) {
      logAndNotify("Please log in to continue.", "warning");
      return;
    }

    const { name, price, mongoPlanId, mongoCategoryId } = plan;

    try {
      setLoadingPlan(name);

      // All plans (Trial and Premium) go through Razorpay payment flow
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

        if (res.data.alreadySubscribed) {
          const activePlanName = res.data.activePlan?.planName || "active plan";
          logAndNotify(`You already have an active subscription: ${activePlanName}.`, "warning");
          setLoadingPlan(null);
          return;
        }

        const { orderId, amount: razorpayAmount, razorpayKeyId } = res.data;

        const options = {
          key: razorpayKeyId,
          amount: razorpayAmount,
          currency: "INR",
          name: "Fixel Premium",
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

              logSuccess("Subscription activated successfully!");
              router.replace("/billit-login");
            } catch (err) {
              logError("Payment verification failed", err);
              logAndNotify("Payment verification failed. Please contact support.", "error");
            } finally {
              setLoadingPlan(null);
            }
          },
          modal: {
            ondismiss: function() {
              logAndNotify("Payment cancelled. You can try again anytime.", "info");
              setLoadingPlan(null);
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
        razorpay.on('payment.failed', function (response){
          logError("Payment failed", response.error);
          logAndNotify(`Payment failed: ${response.error.description}`, "error");
          setLoadingPlan(null);
        });
        razorpay.open();
      } catch (error) {
        logError("Failed to create payment order", error);
        logAndNotify(error.response?.data?.message || "Failed to initiate payment. Please try again.", "error");
      } finally {
        setLoadingPlan(null);
      }
    } catch (err) {
      console.error("Plan selection error:", err);
      setLoadingPlan(null);
    }
  };

  const serviceFeatures = [
    { label: "Unlimited Service Records", icon: Check },
    { label: "Advanced Dashboard & Analytics", icon: Check },
    { label: "WhatsApp Billing Integration", icon: Check },
    { label: "Inventory Management", icon: Check },
    { label: "Expense Tracker", icon: Check },
    { label: "Customer Management", icon: Check },
    { label: "Multi-Device Support", icon: Check },
    { label: "Priority Support", icon: Check },
    { label: "No Advertisements", icon: Check },
    { label: "Regular Updates", icon: Check },
  ];

  const premiumPlan = billingPeriod === "yearly" ? {
    name: "Premium",
    price: 4990,
    originalPrice: "₹5,988",
    savePercentage: 17,
    term: "Yearly",
    mongoPlanId: "service-premium-yearly",
    mongoCategoryId: "Service",
    description: "Everything you need to run your business professionally",
    features: serviceFeatures,
  } : {
    name: "Premium",
    price: 499,
    originalPrice: "₹1,999",
    savePercentage: 75,
    term: "Monthly",
    mongoPlanId: "service-premium",
    mongoCategoryId: "Service",
    description: "Everything you need to run your business professionally",
    features: serviceFeatures,
  };

  const basicPlan = {
    name: "Trial",
    price: 99,
    mongoPlanId: "service-basic",
    mongoCategoryId: "Service",
    description: "Try all premium features for just ₹99/month",
  };

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

      <div className="relative z-10 container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border border-blue-500/30 rounded-full px-4 py-2 mb-6">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-300">Professional Service Management</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent mb-4">
            Choose Your Plan
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Elevate your mobile repair business with powerful tools and premium features
          </p>
        </div>

        {/* Billing Period Toggle */}
        <div className="flex items-center justify-center mb-8">
          <div className="bg-white/5 border border-white/10 rounded-full p-1 flex items-center gap-1">
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                billingPeriod === "monthly" ? "bg-white text-gray-900 shadow" : "text-gray-400 hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod("yearly")}
              className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
                billingPeriod === "yearly" ? "bg-white text-gray-900 shadow" : "text-gray-400 hover:text-white"
              }`}
            >
              Yearly
              <span className="bg-green-500 text-white px-2 py-0.5 rounded-full text-xs font-bold">2 months free</span>
            </button>
          </div>
        </div>

        {/* Premium & Trial Plans Side by Side */}
        <div className="max-w-6xl mx-auto mb-8 grid md:grid-cols-2 gap-6">
          {/* Premium Plan */}
          <div className="relative backdrop-blur-xl bg-gradient-to-br from-blue-900/40 via-indigo-900/40 to-purple-900/40 border-2 border-blue-500/50 rounded-3xl shadow-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-transparent to-indigo-500/20 rounded-3xl"></div>
            
            <div className="absolute top-6 right-6 z-20">
              <div className="flex items-center gap-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-4 py-1.5 rounded-full text-sm font-semibold shadow-lg">
                <Crown className="w-4 h-4" />
                MOST POPULAR
              </div>
            </div>

            <div className="relative z-10 p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white">Premium</h2>
                  <p className="text-blue-300 text-sm">Professional Plan</p>
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
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loadingPlan === "Premium" ? "Processing..." : (
                  <>
                    <Zap className="w-5 h-5" />
                    Get Premium
                  </>
                )}
              </button>

              <p className="text-gray-400 text-sm mt-4 text-center">
                ₹{premiumPlan.price}/{billingPeriod === "yearly" ? "year" : "month"} • Cancel anytime
              </p>
            </div>
          </div>

          {/* Trial Plan */}
          <div className="relative backdrop-blur-xl bg-gradient-to-br from-green-900/40 via-emerald-900/40 to-teal-900/40 border-2 border-green-500/50 rounded-3xl shadow-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 via-transparent to-emerald-500/20 rounded-3xl"></div>
            
            <div className="absolute top-6 right-6 z-20">
              <div className="flex items-center gap-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-1.5 rounded-full text-sm font-semibold shadow-lg">
                <Star className="w-4 h-4" />
                TRIAL PLAN
              </div>
            </div>

            <div className="relative z-10 p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl">
                  <Gift className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white">Trial Plan</h2>
                  <p className="text-green-300 text-sm">Try All Premium Features</p>
                </div>
              </div>

              <p className="text-gray-300 mb-6">Get full access to all premium features at an introductory price</p>

              <div className="flex items-baseline gap-3 mb-6">
                <span className="text-5xl font-bold text-white">₹99</span>
                <span className="text-gray-400 text-lg">/month</span>
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
                  <span className="text-gray-300">1 Month Full Access</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="p-1 bg-green-500/20 rounded-full">
                    <Check className="w-3 h-3 text-green-400" />
                  </div>
                  <span className="text-gray-300">Full WhatsApp Integration</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="p-1 bg-green-500/20 rounded-full">
                    <Check className="w-3 h-3 text-green-400" />
                  </div>
                  <span className="text-gray-300">Advanced Analytics & Reports</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="p-1 bg-green-500/20 rounded-full">
                    <Check className="w-3 h-3 text-green-400" />
                  </div>
                  <span className="text-gray-300">Unlimited Service Records</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="p-1 bg-green-500/20 rounded-full">
                    <Check className="w-3 h-3 text-green-400" />
                  </div>
                  <span className="text-gray-300">Upgrade to Premium Anytime</span>
                </div>
              </div>

              <button
                onClick={() => handlePlanSelect(basicPlan)}
                disabled={loadingPlan === "Trial"}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loadingPlan === "Trial" ? "Processing..." : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Start Trial — ₹99/month
                  </>
                )}
              </button>

              <p className="text-gray-400 text-sm mt-4 text-center">
                ₹99/month • Secure Payment • Instant Access
              </p>
            </div>
          </div>
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

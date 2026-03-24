"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { Check, Sparkles, Crown, Zap, Package, Layers } from "lucide-react";
import { logAndNotify, logError, logSuccess } from "@/utils/logger";

export default function ComboPricingPage() {
  const [userId, setUserId] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(null);
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

  const handlePlanSelect = async () => {
    if (!userId) {
      logAndNotify("Please log in to continue.", "warning");
      return;
    }

    try {
      setLoadingPlan("Combo");

      const token = localStorage.getItem("token");
      if (!token) {
        logAndNotify("Authentication token missing. Please login again.", "error");
        router.replace("/login");
        return;
      }

      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/subscribe`,
        { planId: "combo-premium", categoryId: "Sales_Service", isPaidPlan: true },
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
        name: "Fixel Combo",
        description: "Combo Plan — Sales + Service",
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

            logSuccess("Combo subscription activated successfully!");
            router.replace("/");
          } catch (err) {
            logError("Payment verification failed", err);
            logAndNotify("Payment verification failed. Please contact support.", "error");
          } finally {
            setLoadingPlan(null);
          }
        },
        modal: {
          ondismiss: function () {
            logAndNotify("Payment cancelled. You can try again anytime.", "info");
            setLoadingPlan(null);
          },
        },
        prefill: { email: userId },
        theme: { color: "#8B5CF6" },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on("payment.failed", function (response) {
        logError("Payment failed", response.error);
        logAndNotify(`Payment failed: ${response.error.description}`, "error");
        setLoadingPlan(null);
      });
      razorpay.open();
    } catch (error) {
      logError("Failed to create payment order", error);
      logAndNotify(
        error.response?.data?.message || "Failed to initiate payment. Please try again.",
        "error"
      );
    } finally {
      setLoadingPlan(null);
    }
  };

  const serviceFeatures = [
    "Unlimited Service Records",
    "Advanced Dashboard & Analytics",
    "WhatsApp Billing Integration",
    "Expense Tracker",
    "Customer Management",
    "No Advertisements",
  ];

  const salesFeatures = [
    "Unlimited Products & Inventory",
    "GST Calculator",
    "Supplier Management (100+)",
    "Sales Analytics",
    "Multi-Branch Support (5)",
    "Priority Support",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-indigo-950 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-violet-600/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>

      <div className="relative z-10 container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-full px-4 py-2 mb-6">
            <Layers className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-purple-300">Best Value — Sales + Service</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent mb-4">
            Combo Plan
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Get full access to both Sales and Service with a single subscription — one email, two powerful apps
          </p>
        </div>

        {/* Combo Plan Card */}
        <div className="max-w-3xl mx-auto mb-8">
          <div className="relative backdrop-blur-xl bg-gradient-to-br from-purple-900/40 via-violet-900/40 to-indigo-900/40 border-2 border-purple-500/50 rounded-3xl shadow-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-transparent to-pink-500/20 rounded-3xl"></div>

            <div className="absolute top-6 right-6 z-20">
              <div className="flex items-center gap-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-1.5 rounded-full text-sm font-semibold shadow-lg">
                <Crown className="w-4 h-4" />
                BEST VALUE
              </div>
            </div>

            <div className="relative z-10 p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl">
                  <Layers className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white">Combo Plan</h2>
                  <p className="text-purple-300 text-sm">Sales + Service Bundle</p>
                </div>
              </div>

              <p className="text-gray-300 mb-6">
                Everything from both Sales Premium (₹399) and Service Premium (₹499) — bundled together at a special price
              </p>

              <div className="flex items-baseline gap-3 mb-8">
                <span className="text-5xl font-bold text-white">₹899</span>
                <div>
                  <span className="text-gray-400 line-through text-lg">₹898</span>
                  <span className="ml-2 bg-purple-500/20 text-purple-300 px-2 py-1 rounded text-sm font-semibold">
                    Both Apps Included
                  </span>
                </div>
              </div>

              {/* Two-column feature list */}
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {/* Service features */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-blue-500/20 rounded-lg">
                      <Sparkles className="w-4 h-4 text-blue-400" />
                    </div>
                    <span className="font-semibold text-blue-300">Service Features</span>
                  </div>
                  <div className="space-y-2">
                    {serviceFeatures.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <div className="p-1 bg-green-500/20 rounded-full">
                          <Check className="w-3 h-3 text-green-400" />
                        </div>
                        <span className="text-gray-300">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sales features */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-emerald-500/20 rounded-lg">
                      <Package className="w-4 h-4 text-emerald-400" />
                    </div>
                    <span className="font-semibold text-emerald-300">Sales Features</span>
                  </div>
                  <div className="space-y-2">
                    {salesFeatures.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <div className="p-1 bg-green-500/20 rounded-full">
                          <Check className="w-3 h-3 text-green-400" />
                        </div>
                        <span className="text-gray-300">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Key benefit */}
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 mb-8">
                <div className="flex items-center gap-2 text-purple-300">
                  <Zap className="w-5 h-5" />
                  <span className="font-semibold">Single email login for both Sales & Service apps</span>
                </div>
              </div>

              <button
                onClick={handlePlanSelect}
                disabled={loadingPlan === "Combo"}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loadingPlan === "Combo" ? (
                  "Processing..."
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Get Combo Plan — ₹899/month
                  </>
                )}
              </button>

              <p className="text-gray-400 text-sm mt-4 text-center">
                ₹899/month • Cancel anytime • Instant access to both apps
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
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              <span className="text-sm">Both Apps Included</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

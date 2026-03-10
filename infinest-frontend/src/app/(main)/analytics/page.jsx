"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import EnhancedAnalyticsDashboard from "@/components/dashboard/EnhancedAnalyticsDashboard";
import { PlanFeatureProvider } from "@/context/PlanFeatureContext";

export default function AnalyticsPage() {
  const [shopId, setShopId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [revenueVisible, setRevenueVisible] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const decoded = jwtDecode(token);
      setShopId(decoded.shop_id || decoded.id);

      // Check if revenue/analytics is visible for this user's shop
      fetch(`${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/dashboard/revenue-visibility`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.revenueVisible === false) {
            setRevenueVisible(false);
          }
        })
        .catch(err => console.error("Revenue visibility check failed:", err));
    } catch (error) {
      console.error("Invalid token:", error);
      router.push("/login");
      return;
    }

    setLoading(false);
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!revenueVisible) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h2>
          <p className="text-gray-600">Analytics Dashboard has been disabled by the shop administrator. Please contact your admin for access.</p>
        </div>
      </div>
    );
  }

  return (
    <PlanFeatureProvider>
      <EnhancedAnalyticsDashboard shopId={shopId} />
    </PlanFeatureProvider>
  );
}

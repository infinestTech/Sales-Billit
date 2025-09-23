"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import PricingSection from "@/components/pricing/pricing-section";
import { logAndNotify, logError, logSuccess, logSystem } from "@/utils/logger";
import Head from 'next/head';

// SEO will be handled by the main layout
// Client component for interactive pricing functionality

export default function Home() {
  const [userId, setUserId] = useState(null);
  const [activeCategory, setActiveCategory] = useState("SERVICE"); // SERVICE | SALES | ENTERPRISE
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [dynamicPlans, setDynamicPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlanError] = useState(null);
  const router = useRouter();

  // Resolve sales frontend login URL from env (fall back to localhost for dev)
  const SALES_LOGIN_URL = (process.env.NEXT_PUBLIC_SALES_FRONTEND_URL
    ? `${process.env.NEXT_PUBLIC_SALES_FRONTEND_URL.replace(/\/$/, "")}/#login`
    : "http://localhost:3020/#login");

  // Helper to ensure Razorpay script has loaded and window.Razorpay is available
  const ensureRazorpay = () => {
    return new Promise((resolve, reject) => {
      if (typeof window === "undefined") return reject(new Error("No window object"));
      if (window.Razorpay) return resolve(window.Razorpay);

      // If script already appended, wait for it
      const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (existing) {
        if (existing.getAttribute("data-loaded") === "true") {
          return resolve(window.Razorpay);
        }
        existing.addEventListener("load", () => resolve(window.Razorpay));
        existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay script")));
        return;
      }

      // Fallback: create script here (should normally be created in useEffect)
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.addEventListener("load", () => {
        script.setAttribute("data-loaded", "true");
        resolve(window.Razorpay);
      });
      script.addEventListener("error", () => reject(new Error("Failed to load Razorpay script")));
      document.body.appendChild(script);
    });
  };

  
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

  // Fetch plans when category changes
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setPlansLoading(true);
        setPlanError(null);
        
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/plans/${activeCategory === "SERVICE" ? "Service" : activeCategory === "SALES" ? "Sales" : activeCategory}`
        );
        
        if (response.data && Array.isArray(response.data)) {
          // Transform the data to match the expected format
          const transformedPlans = response.data.map((plan) => ({
            name: plan.name,
            price: parseInt(plan.price) || 0,
            originalPrice: plan.originalPrice ? `₹${plan.originalPrice}` : null,
            savePercentage: plan.savePercentage || null,
            term: plan.term || "Plan",
            bonusOffer: plan.bonusOffer,
            renewalPrice: plan.renewalPrice ? `₹${plan.renewalPrice}` : null,
            renewalTerm: plan.renewalTerm || "",
            mongoPlanId: plan._id,
            mongoCategoryId: plan.category_id,
            description: plan.description || "",
            features: plan.features?.map(feature => ({
              label: feature.description,
              key: feature.feature_key,
              value: feature.enabled !== undefined ? feature.enabled : true
            })) || [],
            isPopular: plan.isPopular || false,
            buttonText: loadingPlan === plan.name ? "Processing..." : `Choose ${plan.name}`,
            onSelect: () => handlePlanSelect({
              name: plan.name,
              price: parseInt(plan.price) || 0,
              mongoPlanId: plan._id,
              mongoCategoryId: plan.category_id
            })
          }));
          
          setDynamicPlans(transformedPlans);
        } else {
          throw new Error("Invalid response format");
        }
      } catch (error) {
        console.error("Error fetching plans:", error);
        setPlanError(error.response?.data?.message || "Failed to load plans");
        logError("Failed to fetch dynamic plans", error);
        
        // Fall back to hardcoded plans if API fails
        setDynamicPlans(activeCategory === "SERVICE" ? staticServicePlans : staticSalesPlans);
      } finally {
        setPlansLoading(false);
      }
    };

    fetchPlans();
  }, [activeCategory, loadingPlan]);

  // Client-side function to handle plan selection
  const handlePlanSelect = async (plan) => {
    console.debug("handlePlanSelect called for plan:", plan);
    if (!userId) {
      logAndNotify("Please log in to continue.", "warning");
      return;
    }

    const { name, price, mongoPlanId, mongoCategoryId } = plan;

    try {
      setLoadingPlan(name);

      // For Basic plan (free), use the unified subscribe endpoint (isPaidPlan=false)
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

          // Handle the response based on the flags
          if (response.data.success) {
            if (response.data.noNewSubscription && response.data.alreadySubscribed) {
              // User already has an active PAID subscription and trying to downgrade to Basic
              const activePlanName = response.data.activePlan?.planName || "active plan";
              logAndNotify(`You already have an active paid subscription: ${activePlanName}. Please wait until your current plan expires before switching to the Basic plan.`, "warning");
              return;
            } else if (response.data.newSubscriptionCreated || !response.data.alreadySubscribed) {
              // Subscription was successful
              logSuccess("You've successfully subscribed to the Basic plan!");
              // Redirect to different login pages depending on selected category
              // If user was on SALES plans, send them to the sales login (external URL/hash)
              if (mongoCategoryId === "Sales" || activeCategory === "SALES") {
                // Use env-driven URL to force navigation to the sales frontend
                window.location.href = SALES_LOGIN_URL;
              } else {
                router.replace("/billit-login");
              }
              
            }
          } else {
            // Handle unexpected response format
            logError("Failed to subscribe to Basic plan. Please try again.", new Error(response.data.message || "Unknown error"));
          }
        } catch (error) {
          logError("Basic plan subscription failed", error);
          
          // Handle old-style errors (in case some endpoints still return 400)
          if (error.response?.status === 400) {
            const errorMessage = (error.response?.data?.message || "").toLowerCase();
            const errorData = error.response?.data || {};
            
            // Log the full error response for debugging
            logSystem("Full error response for Basic plan subscription", "ERROR", error.response?.data);
            
            // Check for common messages indicating active paid plan
            if (errorMessage.includes("active") || 
                errorMessage.includes("subscription") ||
                errorMessage.includes("plan") ||
                errorMessage.includes("paid") ||
                errorMessage.includes("already") ||
                errorMessage.includes("existing") ||
                errorMessage.includes("current") ||
                errorData.code === "ACTIVE_SUBSCRIPTION" ||
                errorData.type === "SUBSCRIPTION_EXISTS") {
              logAndNotify("You currently have an active paid subscription. Please wait until your current plan expires before switching to the Basic plan.", "warning");
              return;
            }
            
            // If it's a 400 error but not about active subscription, show specific message
            logAndNotify("Cannot subscribe to Basic plan at this time. You may have an active subscription. Please contact support if this persists.", "error");
            return;
          }
          
          logAndNotify(error.response?.data?.message || "Failed to subscribe to Basic plan. Please try again.", "error");
        }

        return;
      }

      // For paid plans, get order via unified subscribe (server calculates amount)
      const token = localStorage.getItem("token");
      if (!token) {
        logAndNotify("Authentication token missing. Please login again.", "error");
        router.replace("/login");
        return;
      }

      const orderRes = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/subscribe`,
        { planId: mongoPlanId, categoryId: mongoCategoryId, isPaidPlan: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const { order } = orderRes.data;

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: "INR",
        name: "Billit",
        description: `${name} Subscription`,
        order_id: order.id,
        handler: async (response) => {
          const token = localStorage.getItem("token");
          if (!token) {
            logAndNotify("Authentication token missing. Please login again.", "error");
            router.replace("/login");
            return;
          }

          try {
            await axios.post(
              `${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/create-subscription`,
              {
                amount: price,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            logSuccess(`Subscribed to ${name} successfully!`);
            // Redirect depending on the category the user selected
            // Prefer server-provided category if available, otherwise fallback to local activeCategory
            const targetCategory = mongoCategoryId || (activeCategory === "SALES" ? "Sales" : activeCategory);
            if (targetCategory === "Sales" || activeCategory === "SALES") {
              window.location.href = SALES_LOGIN_URL;
            } else {
              router.replace("/billit-login");
            }
          } catch (error) {
            logError(`Failed to complete ${name} subscription`, error);
          }
        },
        prefill: {
          name: "Test User",
          email: "user@example.com",
          contact: "9999999999",
        },
        theme: { color: "#0f172a" },
      };

      // Ensure razorpay script is loaded
      try {
        await ensureRazorpay();
        const rzp = new window.Razorpay(options);
        rzp.open();
      } catch (loadErr) {
        logError("Razorpay failed to initialize", loadErr);
        logAndNotify("Payment provider failed to load. Please try again later.", "error");
      }
    } catch (err) {
      logError("Payment processing failed", err);
      
      // Check if user has active subscription preventing new subscription
      if (err.response?.status === 400) {
        const errorMessage = (err.response?.data?.message || "").toLowerCase();
        const errorData = err.response?.data || {};
        
        // Log the full error response for debugging
        logSystem("Full error response for paid plan subscription", "ERROR", err.response?.data);
        
        // Check for common messages indicating active paid plan
        if (errorMessage.includes("active") || 
            errorMessage.includes("subscription") ||
            errorMessage.includes("plan") ||
            errorMessage.includes("already") ||
            errorMessage.includes("existing") ||
            errorMessage.includes("current") ||
            errorData.code === "ACTIVE_SUBSCRIPTION" ||
            errorData.type === "SUBSCRIPTION_EXISTS") {
          logAndNotify("You currently have an active subscription. Please wait until your current plan expires before subscribing to a new plan.", "warning");
          return;
        }
        
        // If it's a 400 error but not about active subscription, show specific message
        logAndNotify("Cannot process subscription at this time. You may have an active subscription. Please contact support if this persists.", "error");
        return;
      }
      
      logAndNotify(err.response?.data?.message || "Something went wrong. Please try again.", "error");
    } finally {
      setLoadingPlan(null);
    }
  };

  // STATIC SERVICE plans (fallback)
  const staticServicePlans = [
    {
      name: "Basic",
      price: 0,
      originalPrice: "₹199",
      savePercentage: 100,
      term: "Free Forever",  // Changed from "Free Plan" to "Free Forever"
      bonusOffer: "No credit card required", // Added to emphasize it's truly free
      renewalPrice: "Always Free",  // Changed from "Free with ads" for clarity
      renewalTerm: "No Expiration",  // Changed from "Lifetime" to "No Expiration"
      mongoPlanId: "service-basic",
      mongoCategoryId: "Service",
      description: "Ideal for new mobile repair shops starting out with basic restrictions and ads.",
      features: [
        { label: "Entry Limit: 30 pages × 15 records", key: "entry_limit" },
        { label: "Dealer mobile create limit: 5 per creation", key: "dealer_mobile_create_limit" },
        { label: "Paper billing allowed", key: "allow_paper_billing", value: true },
        { label: "WhatsApp billing not allowed", key: "allow_whatsapp_billing", value: false },
        { label: "Dashboard disabled", key: "dashboard_enabled", value: false },
        { label: "Expense tracker disabled", key: "expense_tracker_enabled", value: false },
        { label: "Product inventory disabled", key: "product_inventory_enabled", value: false },
        { label: "Ads shown", key: "show_ads", value: true },
        { label: "Never expires", key: "no_expiration", value: true },  // Added new feature to highlight
      ],
      isPopular: false,
    },
    {
      name: "Gold",
      price: 399,
      originalPrice: "₹999",
      savePercentage: 60,
      term: "Monthly plan",
      bonusOffer: null,
      renewalPrice: "₹399",
      renewalTerm: "Monthly",
      mongoPlanId: "service-gold",
      mongoCategoryId: "Service",
      description: "For growing shops needing smart workflow tools with advanced features.",
      features: [
        { label: "Entry Limit: 40 pages × 15 records", key: "entry_limit" },
        { label: "Dealer mobile create limit: 10 per creation", key: "dealer_mobile_create_limit" },
        { label: "Paper billing allowed", key: "allow_paper_billing", value: true },
        { label: "WhatsApp billing allowed", key: "allow_whatsapp_billing", value: true },
        { label: "Dashboard enabled", key: "dashboard_enabled", value: true },
        { label: "Expense tracker enabled", key: "expense_tracker_enabled", value: true },
        { label: "Product inventory enabled", key: "product_inventory_enabled", value: true },
        { label: "Notifications enabled", key: "notifications_enabled", value: true },
        { label: "Ads removed", key: "show_ads", value: false },
      ],
      isPopular: true,
    },
    {
      name: "Premium",
      price: 499,
      originalPrice: "₹1999",
      savePercentage: 70,
      term: "MOnthly plan",
      bonusOffer: null,
      renewalPrice: "₹499",
      renewalTerm: "Monthly",
      mongoPlanId: "service-premium",
      mongoCategoryId: "Service",
      description: "Best for high-volume service centers or chains with premium features.",
      features: [
        { label: "Entry Limit: 60 pages × 15 records", key: "entry_limit" },
        { label: "Dealer mobile create limit: 30 per creation", key: "dealer_mobile_create_limit" },
        { label: "Paper billing allowed", key: "allow_paper_billing", value: true },
        { label: "WhatsApp billing allowed", key: "allow_whatsapp_billing", value: true },
        { label: "Dashboard enabled", key: "dashboard_enabled", value: true },
        { label: "Expense tracker enabled", key: "expense_tracker_enabled", value: true },
        { label: "Product inventory enabled", key: "product_inventory_enabled", value: true },
        { label: "Notifications enabled", key: "notifications_enabled", value: true },
        { label: "Ads removed", key: "show_ads", value: false },
      ],
      isPopular: false,
    },
  ].map((plan) => ({
    ...plan,
    buttonText: loadingPlan === plan.name ? "Processing..." : `Choose ${plan.name}`,
    onSelect: () => handlePlanSelect(plan),
  }));

  // STATIC SALES plans (fallback)
  const staticSalesPlans = [
    {
      name: "Basic",
      price: 0,
      originalPrice: "₹199",
      savePercentage: 100,
      term: "Free Forever",
      bonusOffer: "No credit card required",
      renewalPrice: "Always Free",
      renewalTerm: "No Expiration",
      mongoPlanId: "sales-basic",
      mongoCategoryId: "Sales",
      description: "Starter sales tools for small shops (demo)",
      features: [
        { label: "5 products", key: "sales_products_limit" },
        { label: "No analytics", key: "sales_analytics", value: false },
        { label: "Ads shown", key: "show_ads", value: true }
      ],
      isPopular: false,
    },
    {
      name: "Gold",
      price: 299,
      originalPrice: "₹899",
      savePercentage: 65,
      term: "Monthly plan",
      bonusOffer: null,
      renewalPrice: "₹299",
      renewalTerm: "Monthly",
      mongoPlanId: "sales-gold",
      mongoCategoryId: "Sales",
      description: "Advanced sales inventory and billing (demo)",
      features: [
        { label: "100 products", key: "sales_products_limit" },
        { label: "Basic analytics", key: "sales_analytics", value: true },
        { label: "Ads removed", key: "show_ads", value: false }
      ],
      isPopular: true,
    },
    {
      name: "Premium",
      price: 399,
      originalPrice: "₹1499",
      savePercentage: 70,
      term: "Monthly plan",
      bonusOffer: null,
      renewalPrice: "₹399",
      renewalTerm: "Monthly",
      mongoPlanId: "sales-premium",
      mongoCategoryId: "Sales",
      description: "Full sales suite for high volume (demo)",
      features: [
        { label: "Unlimited products", key: "sales_products_limit" },
        { label: "Advanced analytics", key: "sales_analytics", value: true },
        { label: "Priority support", key: "priority_support", value: true }
      ],
      isPopular: false,
    },
  ].map((plan) => ({
    ...plan,
    buttonText: loadingPlan === plan.name ? "Processing..." : `Choose ${plan.name}`,
    onSelect: () => handlePlanSelect(plan),
  }));

  // Use dynamic plans if available, otherwise fall back to static plans
  const pricingPlans = plansLoading 
    ? [] // Show empty while loading 
    : dynamicPlans.length > 0 
      ? dynamicPlans
      : activeCategory === "SERVICE"
        ? staticServicePlans
        : activeCategory === "SALES"
        ? staticSalesPlans
        : [];

  return (
    <div className="min-h-screen bg-black">
      <Head>
        <title>{activeCategory === "SERVICE" 
          ? "Choose the Best Service Plan for Your Mobile Shop | BillIt" 
          : "Choose the Best Sales Plan for Your Business | BillIt"
        }</title>
        <meta name="description" content={activeCategory === "SERVICE"
          ? "Affordable pricing plans for mobile repair shops. Choose from Basic (Free), Gold (₹399/month), or Premium (₹499/month) with advanced features."
          : "Complete retail management solutions for growing businesses. Choose from Basic (Free), Gold (₹299/month), or Premium (₹399/month) with advanced sales features."
        } />
        <meta name="keywords" content={activeCategory === "SERVICE"
          ? "mobile repair software pricing, service management plans, repair shop subscription, billing software cost"
          : "retail management software pricing, sales inventory system, point of sale subscription, business management cost"
        } />
        
        {/* Structured Data for Pricing */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Product",
              "name": "BillIt Service Management Software",
              "description": "Professional mobile service management platform",
              "brand": {
                "@type": "Brand",
                "name": "BillIt"
              },
              "offers": [
                {
                  "@type": "Offer",
                  "name": "Basic Plan",
                  "price": "0",
                  "priceCurrency": "INR",
                  "description": "Perfect for individual technicians and small shops",
                  "availability": "https://schema.org/InStock"
                },
                {
                  "@type": "Offer", 
                  "name": "Gold Plan",
                  "price": "399",
                  "priceCurrency": "INR",
                  "description": "For growing shops needing smart workflow tools",
                  "availability": "https://schema.org/InStock"
                },
                {
                  "@type": "Offer",
                  "name": "Premium Plan", 
                  "price": "499",
                  "priceCurrency": "INR",
                  "description": "Best for high-volume service centers",
                  "availability": "https://schema.org/InStock"
                }
              ]
            })
          }}
        />
      </Head>
      {/* Category Toggle */}
      <div className="w-full flex items-center justify-center pt-8 mb-4">
        <div className="inline-flex rounded-xl border border-slate-600 bg-slate-900/70 p-1.5 backdrop-blur-sm">
          {["SERVICE", "SALES"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveCategory(tab)}
              className={`px-6 py-3 text-sm font-medium rounded-lg transition-all duration-300 ${
                activeCategory === tab 
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg transform scale-105" 
                  : "text-slate-300 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              {tab === "SERVICE" ? "🔧 Service Plans" : "💼 Sales Plans"}
            </button>
          ))}
        </div>
      </div>

      <PricingSection
        title={activeCategory === "SERVICE" 
          ? "Choose the Best Service Plan for Your Mobile Shop" 
          : activeCategory === "SALES"
          ? "Choose the Best Sales Plan for Your Business"
          : "Enterprise Solutions"
        }
        subtitle={activeCategory === "SERVICE"
          ? "Flexible plans tailored for every stage of your service business"
          : activeCategory === "SALES"
          ? "Complete retail management solutions for growing businesses"
          : "Custom solutions for large organizations"
        }
        plans={pricingPlans}
        isLoading={plansLoading}
        error={plansError}
      />
    </div>
  );
}

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


  // Client-side function to handle plan selection
  const handlePlanSelect = async (plan) => {
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
                // Use full URL to force navigation to the sales frontend
                window.location.href = "http://localhost:3020/#login";
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
              window.location.href = "http://localhost:3020/#login";
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


      const rzp = new window.Razorpay(options);
      rzp.open();
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


  // SERVICE plans (live)
  const servicePlans = [
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


  // SALES plans (dummy)
  const salesPlans = [
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


  // ENTERPRISE plans (dummy)


  
  const enterprisePlans = [
    {
      name: "Basic",
      price: 0,
      originalPrice: "₹499",
      savePercentage: 100,
      term: "Free trial",
      bonusOffer: "Contact sales",
      renewalPrice: "Custom",
      renewalTerm: "Annual",
      mongoPlanId: "enterprise-basic",
      mongoCategoryId: "Enterprise",
      description: "Multi-branch foundations (demo)",
      features: [
        { label: "2 branches", key: "branch_limit" },
        { label: "Basic roles", key: "roles", value: true },
        { label: "Email support", key: "support", value: true }
      ],
      isPopular: false,
    },
    {
      name: "Gold",
      price: 999,
      originalPrice: "₹2499",
      savePercentage: 60,
      term: "Monthly plan",
      bonusOffer: null,
      renewalPrice: "₹999",
      renewalTerm: "Monthly",
      mongoPlanId: "enterprise-gold",
      mongoCategoryId: "Enterprise",
      description: "Multi-branch with SSO and audit (demo)",
      features: [
        { label: "10 branches", key: "branch_limit" },
        { label: "SSO & audit logs", key: "security", value: true },
        { label: "Priority support", key: "support", value: true }
      ],
      isPopular: true,
    },
    {
      name: "Premium",
      price: 1499,
      originalPrice: "₹3999",
      savePercentage: 62,
      term: "Monthly plan",
      bonusOffer: null,
      renewalPrice: "₹1499",
      renewalTerm: "Monthly",
      mongoPlanId: "enterprise-premium",
      mongoCategoryId: "Enterprise",
      description: "Full enterprise suite (demo)",
      features: [
        { label: "Unlimited branches", key: "branch_limit" },
        { label: "SLA + dedicated manager", key: "sla", value: true },
        { label: "Custom integrations", key: "integrations", value: true }
      ],
      isPopular: false,
    },
  ].map((plan) => ({
    ...plan,
    buttonText: loadingPlan === plan.name ? "Processing..." : `Choose ${plan.name}`,
    onSelect: () => handlePlanSelect(plan),
  }));


  const pricingPlans = activeCategory === "SERVICE"
    ? servicePlans
    : activeCategory === "SALES"
      ? salesPlans
      : enterprisePlans;


  return (
    <div className="min-h-screen bg-black">
      <Head>
        <title>Choose the Best Service Plan for Your Mobile Shop | BillIt</title>
        <meta name="description" content="Affordable pricing plans for mobile repair shops. Choose from Basic (Free), Gold (₹399/month), or Premium (₹499/month) with advanced features." />
        <meta name="keywords" content="mobile repair software pricing, service management plans, repair shop subscription, billing software cost" />
        
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
      <div className="w-full flex items-center justify-center mt-2">
        <div className="inline-flex rounded-lg border border-slate-700 bg-slate-800/50 p-1">
          {(["SERVICE", "SALES"]).map((tab) => (
            //,"ENTERPRISE"
            <button
              key={tab}
              onClick={() => setActiveCategory(tab)}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${activeCategory === tab ? "bg-slate-900 text-white" : "text-slate-300 hover:text-white"}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>


      <PricingSection
        title="Choose the Best Service Plan for Your Mobile Shop"
        subtitle="Flexible plans tailored for every stage of your service business"
        plans={pricingPlans}
      />
    </div>
  );
}



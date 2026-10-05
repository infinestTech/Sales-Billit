"use client";
import React, { useEffect, useState } from "react";
import { Store, Package, Truck, CreditCard, ShoppingCart, AlertCircle } from "lucide-react";
import { SALES_API_URL } from "./salesConfig";

const currency = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

async function getJson(path, token) {
  const res = await fetch(`${SALES_API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export default function SalesOverview({ session, onNavigate, compact = false }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const token = session?.token;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setError("");
      const today = todayIST();
      const [branches, suppliers, stock, credits, sales] = await Promise.allSettled([
        getJson("/api/branches", token),
        getJson("/api/suppliers", token),
        getJson("/api/in-stock", token),
        getJson("/api/supplier-credits/summary", token),
        getJson(`/api/sales?pageSize=100&from=${today}&to=${today}`, token),
      ]);
      if (cancelled) return;
      const val = (r) => (r.status === "fulfilled" ? r.value : null);
      const entries = val(stock)?.entries || [];
      let stockUnits = 0;
      let stockValue = 0;
      entries.forEach((e) => (e.items || []).forEach((it) => {
        const qty = Number(it.quantity) || 0;
        stockUnits += qty;
        stockValue += qty * (Number(it.costPrice) || 0);
      }));
      const todaySales = val(sales)?.sales || [];
      setStats({
        branches: (val(branches)?.branches || []).length,
        suppliers: (val(suppliers)?.suppliers || []).length,
        stockUnits,
        stockValue,
        outstanding: (val(credits)?.summary || []).reduce((s, c) => s + (Number(c.outstanding) || 0), 0),
        todaySalesCount: val(sales)?.total ?? todaySales.length,
        todaySalesAmount: todaySales.reduce((s, sale) => s + (Number(sale.totalAmount) || 0), 0),
      });
      if ([branches, suppliers, stock, credits, sales].every((r) => r.status === "rejected")) {
        setError("Could not load sales data");
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const cards = [
    { key: "today", label: "Today's Sales", value: stats ? currency(stats.todaySalesAmount) : "—", sub: stats ? `${stats.todaySalesCount} bill(s) across branches` : "", icon: ShoppingCart, color: "text-indigo-600", tab: "sales-branch-sales" },
    { key: "stock", label: "Stock in Hand", value: stats ? stats.stockUnits.toLocaleString("en-IN") : "—", sub: stats ? `Worth ${currency(stats.stockValue)} at cost` : "", icon: Package, color: "text-purple-600", tab: "sales-inventory" },
    { key: "branches", label: "Branches", value: stats ? stats.branches : "—", sub: "Active locations", icon: Store, color: "text-emerald-600", tab: "sales-branches" },
    { key: "credits", label: "Supplier Dues", value: stats ? currency(stats.outstanding) : "—", sub: stats ? `${stats.suppliers} dealer(s)` : "", icon: CreditCard, color: "text-orange-600", tab: "sales-supplier-credits" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Truck className="h-5 w-5 text-indigo-600" />
        <h3 className="text-gray-900 font-semibold text-lg">Sales</h3>
      </div>

      {!token ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm text-sm text-gray-600 flex items-center gap-2">
          {session?.error ? (
            <>
              <AlertCircle className="h-4 w-4 text-red-500" /> {session.error}
              <button onClick={session.refresh} className="ml-2 text-indigo-600 font-medium underline">Retry</button>
            </>
          ) : "Connecting to the Sales server…"}
        </div>
      ) : (
        <>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className={`grid gap-4 ${compact ? "grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"}`}>
            {cards.map(({ key, label, value, sub, icon: Icon, color, tab }) => (
              <button
                key={key}
                type="button"
                onClick={() => onNavigate?.(tab)}
                disabled={!onNavigate}
                className={`text-left bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition ${compact ? "p-4" : "p-6"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-gray-600 text-sm font-medium">{label}</div>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div className={`text-gray-900 font-bold ${compact ? "text-xl" : "text-3xl"}`}>{value}</div>
                {sub && <div className="text-gray-500 text-xs mt-1">{sub}</div>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

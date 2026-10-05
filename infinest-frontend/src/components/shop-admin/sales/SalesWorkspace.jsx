"use client";
import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import "./salesScope.css";
import { SALES_API_URL } from "./salesConfig";
import { SalesFeatureProvider } from "./SalesFeatures";
import BranchNewExpense from "./BranchNewExpense";
import GstCalculatorView from "./GstCalculatorView";
import CreateSupplier from "./CreateSupplier";
import InStockView from "./InStockView";
import StockHistory from "./StockHistory";
import SupplierCredits from "./SupplierCredits";
import CreateBranch from "./CreateBranch";
import BranchSupply from "./BranchSupply";
import BranchSupplyHistory from "./BranchSupplyHistory";
import BranchSalesReport from "./BranchSalesReport";

// Sales admin screens moved over from the standalone sales-frontend admin portal.
// Tab ids in the shop-admin sidebar are `sales-<key>`.
export const SALES_VIEWS = {
  expenses: { title: "Expenses", subtitle: "Record branch expenses and costs" },
  gst: { title: "GST Calculator", subtitle: "GST on supplier purchases and sales" },
  dealers: { title: "Dealers", subtitle: "Manage your suppliers and vendors" },
  inventory: { title: "Master Inventory", subtitle: "Track and manage your complete inventory" },
  "stock-history": { title: "Stock History", subtitle: "Stock supplied to branches over time" },
  "supplier-credits": { title: "Supplier Credits", subtitle: "Manage supplier credit accounts and balances" },
  branches: { title: "Branch Management", subtitle: "Create and manage branch locations" },
  "branch-supply": { title: "Branch Supply", subtitle: "Send stock from master inventory to branches" },
  "supply-history": { title: "Supply History", subtitle: "All supplies sent to branches" },
  "branch-sales": { title: "Branch Sales", subtitle: "View sales details across all branches" },
};

function renderView(view, { token, planId, branchLimit, onNavigate }) {
  const common = { salesUrl: SALES_API_URL, token };
  switch (view) {
    case "expenses": return <BranchNewExpense {...common} branchUser={null} />;
    case "gst": return <GstCalculatorView {...common} />;
    case "dealers": return <CreateSupplier {...common} />;
    case "inventory": return <InStockView {...common} />;
    case "stock-history": return <StockHistory {...common} branchUser={null} onNavigate={(v) => onNavigate?.(`sales-${v}`)} />;
    case "supplier-credits": return <SupplierCredits {...common} />;
    case "branches": return <CreateBranch {...common} planId={planId} branchLimit={branchLimit} />;
    case "branch-supply": return <BranchSupply {...common} />;
    case "supply-history": return <BranchSupplyHistory {...common} />;
    case "branch-sales": return <BranchSalesReport {...common} />;
    default: return null;
  }
}

export default function SalesWorkspace({ view, session, shopId, onNavigate }) {
  const meta = SALES_VIEWS[view];
  if (!meta) return null;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl px-6 py-4 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{meta.title}</h2>
          <p className="text-sm text-gray-500">{meta.subtitle}</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">Sales</span>
      </div>

      {!session.token ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center shadow-sm">
          {session.error ? (
            <>
              <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
              <p className="text-gray-700 font-medium">{session.error}</p>
              <button
                onClick={session.refresh}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
              >
                <RefreshCw className="h-4 w-4" /> Retry
              </button>
            </>
          ) : (
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto" />
          )}
        </div>
      ) : (
        <div className="sales-scope rounded-xl border border-gray-200">
          <div className="content">
            <SalesFeatureProvider salesUrl={SALES_API_URL} token={session.token}>
              <React.Fragment key={`${shopId}:${view}`}>
                {renderView(view, { token: session.token, planId: session.planId, branchLimit: session.branchLimit, onNavigate })}
              </React.Fragment>
            </SalesFeatureProvider>
          </div>
        </div>
      )}
    </div>
  );
}

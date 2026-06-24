"use client";
// Centralized control-panel design system tokens shared across all shop-admin panels.
// Each panel renders a header, optional toolbar, and content area for consistency.
import { useState } from "react";

export function PanelHeader({ icon: Icon, title, subtitle, accent = "emerald", actions }) {
  const gradients = {
    emerald: "from-emerald-600 to-teal-700",
    blue: "from-blue-600 to-indigo-700",
    purple: "from-purple-600 to-pink-600",
    orange: "from-orange-500 to-red-600",
    slate: "from-slate-700 to-slate-900",
  };
  return (
    <div className={`bg-gradient-to-r ${gradients[accent] || gradients.emerald} rounded-2xl shadow-lg p-5 mb-6`}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="p-3 bg-white/15 rounded-xl backdrop-blur-sm">
              <Icon className="h-7 w-7 text-white" />
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold text-white">{title}</h2>
            {subtitle && <p className="text-white/80 text-sm mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function PanelCard({ children, className = "" }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-2xl shadow-sm ${className}`}>{children}</div>
  );
}

export function Btn({ children, variant = "primary", className = "", icon: Icon, ...rest }) {
  const variants = {
    primary: "bg-emerald-600 hover:bg-emerald-700 text-white",
    secondary: "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200",
    danger: "bg-red-500 hover:bg-red-600 text-white",
    ghost: "text-slate-600 hover:bg-slate-100",
    outline: "border border-emerald-600 text-emerald-700 hover:bg-emerald-50",
  };
  return (
    <button
      {...rest}
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function Field({ label, children, required, hint }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide block mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="text-xs text-slate-500 mt-1 block">{hint}</span>}
    </label>
  );
}

export function Input(props) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm ${props.className || ""}`}
    />
  );
}

export function Select({ children, ...rest }) {
  return (
    <select
      {...rest}
      className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm bg-white ${rest.className || ""}`}
    >
      {children}
    </select>
  );
}

export function Modal({ open, onClose, title, children, maxWidth = "max-w-lg" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
          <h3 className="font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">&times;</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Toast({ message, type = "success", onClose }) {
  const colors = type === "success" ? "bg-emerald-600" : type === "error" ? "bg-red-600" : "bg-slate-700";
  return (
    <div className={`fixed bottom-6 right-6 z-[200] ${colors} text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3`}>
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="text-white/80 hover:text-white text-lg leading-none">&times;</button>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState(null);
  const show = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  return { toast, show, clear: () => setToast(null) };
}

export function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="text-center py-16 text-slate-500">
      {Icon && <Icon className="h-12 w-12 mx-auto mb-3 text-slate-300" />}
      <p className="font-semibold text-slate-700">{title}</p>
      {hint && <p className="text-sm mt-1">{hint}</p>}
    </div>
  );
}

export function LoadingRow({ colSpan = 5 }) {
  return (
    <tr><td colSpan={colSpan} className="text-center py-8 text-slate-400 text-sm">Loading...</td></tr>
  );
}

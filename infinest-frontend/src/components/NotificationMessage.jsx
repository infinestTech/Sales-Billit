"use client";


import { useEffect } from "react";
import { X } from "lucide-react";


export default function NotificationMessage({
  message,
  type = "success",
  onClose,
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000); // auto-close after 3 sec
    return () => clearTimeout(timer);
  }, [onClose]);


  return (
    <div
      className={`fixed top-5 right-5 z-50 flex items-start max-w-xs p-4 rounded-xl shadow-xl text-white animate-slideIn
      ${type === "success" ? "bg-green-600"
        : type === "error" ? "bg-red-600"
        : type === "warning" ? "bg-purple-600"
        : "bg-blue-600"}`}
    >
      <div className="flex-1 pr-2">
        <p className="text-sm font-medium">{message}</p>
      </div>
      <button
        onClick={onClose}
        className="text-white opacity-80 hover:opacity-100 transition"
        aria-label="Close"
      >
        <X size={18} />
      </button>


      <style jsx>{`
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(50%); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}





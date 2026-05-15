"use client"

import { useEffect } from "react"
import { X } from "lucide-react"

/**
 * Lightweight bottom-sheet primitive (no extra dependencies).
 * - Locks body scroll while open.
 * - ESC key closes.
 * - Drag handle is decorative; tap-X dismiss is always available.
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxHeight = "90vh",
}) {
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKey)
    }
  }, [open, onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        className={`fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-white shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ maxHeight }}
      >
        <div className="flex flex-col">
          <div className="flex justify-center pt-2">
            <span className="h-1.5 w-12 rounded-full bg-gray-300" />
          </div>
          <div className="flex items-start justify-between px-5 pb-3 pt-2">
            <div className="min-w-0 pr-3">
              {title && (
                <h3 className="truncate text-lg font-semibold text-gray-900">{title}</h3>
              )}
              {subtitle && (
                <p className="mt-0.5 truncate text-sm text-gray-500">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-1 -mt-1 rounded-full p-2 text-gray-500 hover:bg-gray-100"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
          {children}
        </div>

        {footer && (
          <div className="border-t border-gray-100 bg-white px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
            {footer}
          </div>
        )}
      </div>
    </>
  )
}

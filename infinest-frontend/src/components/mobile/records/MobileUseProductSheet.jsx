"use client"

import { useEffect, useRef, useState } from "react"
import {
  Loader2,
  PackageSearch,
  ChevronDown,
  CheckCircle2,
  ShieldCheck,
  ShieldOff,
  User,
  Box,
} from "lucide-react"
import api from "@/components/api"
import { logError, logSuccess } from "@/utils/logger"
import {
  DEFAULT_PAYMENT_METHOD,
  PAYMENT_METHOD_OPTIONS,
} from "@/constants/paymentMethods"
import BottomSheet from "./BottomSheet"

/**
 * Mobile bottom-sheet for "Use Product" — mirrors the desktop MobileNameTable
 * sell-modal experience with mobile-friendly UI.
 *
 * Props:
 *   open, onClose, mobile (the mobile record object), shopId, onUpdated()
 */
export default function MobileUseProductSheet({
  open,
  onClose,
  mobile,
  shopId,
  onUpdated,
}) {
  // ── data ──────────────────────────────────────────────────────────────────
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loadingData, setLoadingData] = useState(false)

  // ── product search ─────────────────────────────────────────────────────────
  const [productInput, setProductInput] = useState("")
  const [selectedProductId, setSelectedProductId] = useState("")
  const [showProductDrop, setShowProductDrop] = useState(false)
  const productRef = useRef(null)

  // ── supplier search ────────────────────────────────────────────────────────
  const [supplierQuery, setSupplierQuery] = useState("")
  const [selectedSupplierId, setSelectedSupplierId] = useState("")
  const [showSupplierDrop, setShowSupplierDrop] = useState(false)
  const supplierRef = useRef(null)

  // ── form fields ────────────────────────────────────────────────────────────
  const [qty, setQty] = useState(1)
  const [supplierAmount, setSupplierAmount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState("")
  const [warranty, setWarranty] = useState("")
  const [sellDate, setSellDate] = useState(
    () => new Date().toISOString().split("T")[0]
  )

  // ── submit state ───────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false)

  // ── load data when sheet opens ─────────────────────────────────────────────
  useEffect(() => {
    if (!open || !shopId) return
    setLoadingData(true)
    const token = localStorage.getItem("token")
    const headers = { Authorization: `Bearer ${token}` }
    Promise.all([
      api.post("/api/products/list", { shop_id: shopId }, { headers }),
      api.post("/api/suppliers/list", { shop_id: shopId }, { headers }),
    ])
      .then(([pRes, sRes]) => {
        setProducts(pRes?.data?.products || [])
        setSuppliers(sRes?.data?.suppliers || [])
      })
      .catch((err) => logError("Failed to load data", err, shopId))
      .finally(() => setLoadingData(false))
  }, [open, shopId])

  // ── reset when sheet closes ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setProductInput("")
      setSelectedProductId("")
      setShowProductDrop(false)
      setSupplierQuery("")
      setSelectedSupplierId("")
      setShowSupplierDrop(false)
      setQty(1)
      setSupplierAmount(0)
      setPaymentMethod("")
      setWarranty("")
      setSellDate(new Date().toISOString().split("T")[0])
    }
  }, [open])

  // ── close dropdowns on outside tap ────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (productRef.current && !productRef.current.contains(e.target))
        setShowProductDrop(false)
      if (supplierRef.current && !supplierRef.current.contains(e.target))
        setShowSupplierDrop(false)
    }
    document.addEventListener("mousedown", handler)
    document.addEventListener("touchstart", handler)
    return () => {
      document.removeEventListener("mousedown", handler)
      document.removeEventListener("touchstart", handler)
    }
  }, [])

  if (!mobile) return null

  const headers = {
    Authorization: `Bearer ${
      typeof window !== "undefined" ? localStorage.getItem("token") : ""
    }`,
  }

  // ── filtered lists ─────────────────────────────────────────────────────────
  const filteredProducts = products.filter((p) =>
    (p.name || "").toLowerCase().includes(productInput.toLowerCase())
  )
  const filteredSuppliers = suppliers.filter((s) => {
    const q = supplierQuery.toLowerCase()
    return (
      (s.supplierName || "").toLowerCase().includes(q) ||
      (s.agencyName || "").toLowerCase().includes(q)
    )
  })

  // ── submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!qty || Number(qty) < 1) {
      logError("Quantity must be at least 1", null, shopId)
      return
    }
    if (!selectedSupplierId) {
      logError("Please select a supplier", null, shopId)
      return
    }
    if (!selectedProductId && !paymentMethod) {
      logError("Please select a payment method", null, shopId)
      return
    }

    setSubmitting(true)
    try {
      const selectedDate = new Date(sellDate + "T12:00:00").toISOString()

      // 1 — reduce stock if an inventory product was selected
      const matchingProduct = selectedProductId
        ? products.find((p) => p._id === selectedProductId)
        : products.find(
            (p) =>
              (p.name || "").toLowerCase() ===
              (productInput || "").toLowerCase()
          )
      if (matchingProduct) {
        await api.post(
          "/api/products/sell",
          {
            productId: matchingProduct._id,
            quantitySold: Number(qty),
            paidAmount: Number(supplierAmount || 0),
            sellDate: selectedDate,
          },
          { headers }
        )
      }

      // 2 — update supplier total & history
      const currentSupplier = suppliers.find(
        (s) => String(s._id) === String(selectedSupplierId)
      )
      const newTotal =
        Number(currentSupplier?.totalAmount || 0) + Number(supplierAmount || 0)
      await api.post(
        "/api/suppliers/update",
        {
          shop_id: shopId,
          supplierId: selectedSupplierId,
          totalAmount: newTotal,
          lastPaymentMethod: paymentMethod || DEFAULT_PAYMENT_METHOD,
          message: `Added: ${productInput} x${qty} - ₹${supplierAmount || 0}`,
          changeDate: selectedDate,
        },
        { headers }
      )

      // 3 — save product/supplier info on the mobile record
      await api.post(
        "/api/update-paid-amount",
        {
          id: mobile._id,
          paidAmount: Number(mobile.paid_amount || 0),
          updateDate: selectedDate,
          supplierId: selectedSupplierId,
          supplierName: supplierQuery,
          productName: productInput,
          quantity: qty,
          supplierAmount: Number(supplierAmount || 0),
          paymentMethod: paymentMethod || DEFAULT_PAYMENT_METHOD,
          warranty: warranty,
        },
        { headers }
      )

      logSuccess("Product used & inventory updated.", shopId)
      onUpdated?.()
      onClose?.()
    } catch (err) {
      logError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Failed to use product",
        err,
        shopId
      )
    } finally {
      setSubmitting(false)
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Use Product"
      subtitle={`${mobile.mobile_name || "Mobile"}${
        mobile.model ? ` • ${mobile.model}` : ""
      }`}
      maxHeight="92vh"
      footer={
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || loadingData}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-base font-semibold text-white disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Submitting…
            </>
          ) : (
            <>
              <PackageSearch className="h-5 w-5" /> Submit
            </>
          )}
        </button>
      }
    >
      {loadingData ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm text-gray-500">Loading inventory…</p>
        </div>
      ) : (
        <div className="space-y-4 pb-2">
          {/* ── Supplier ── */}
          <div ref={supplierRef} className="relative">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Supplier <span className="text-red-500">*</span>
            </label>
            <div
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm"
              onClick={() => setShowSupplierDrop((v) => !v)}
            >
              <User className="h-4 w-4 shrink-0 text-gray-400" />
              <input
                type="text"
                className="flex-1 bg-transparent outline-none placeholder:text-gray-400"
                placeholder="Search supplier…"
                value={supplierQuery}
                onChange={(e) => {
                  setSupplierQuery(e.target.value)
                  setSelectedSupplierId("")
                  setShowSupplierDrop(true)
                }}
                onFocus={() => setShowSupplierDrop(true)}
              />
              <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
            </div>
            {showSupplierDrop && (
              <div className="absolute z-50 mt-1 max-h-44 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                {filteredSuppliers.length === 0 ? (
                  <p className="px-3 py-2.5 text-sm text-gray-500">
                    No suppliers found
                  </p>
                ) : (
                  filteredSuppliers.map((s) => (
                    <div
                      key={s._id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSupplierQuery(
                          s.supplierName +
                            (s.agencyName ? ` - ${s.agencyName}` : "")
                        )
                        setSelectedSupplierId(s._id)
                        setShowSupplierDrop(false)
                      }}
                      className={`flex cursor-pointer items-center justify-between px-3 py-2.5 text-sm hover:bg-indigo-50 ${
                        selectedSupplierId === s._id
                          ? "bg-indigo-50 font-medium text-indigo-700"
                          : "text-gray-800"
                      }`}
                    >
                      <span>
                        {s.supplierName}
                        {s.agencyName && (
                          <span className="ml-1 text-gray-400">
                            — {s.agencyName}
                          </span>
                        )}
                      </span>
                      {selectedSupplierId === s._id && (
                        <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* ── Product / Inventory search ── */}
          <div ref={productRef} className="relative">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Product
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm">
              <Box className="h-4 w-4 shrink-0 text-gray-400" />
              <input
                type="text"
                className="flex-1 bg-transparent outline-none placeholder:text-gray-400"
                placeholder="Search inventory or type product name…"
                value={productInput}
                onChange={(e) => {
                  setProductInput(e.target.value)
                  setSelectedProductId("")
                  setShowProductDrop(true)
                }}
                onFocus={() => setShowProductDrop(true)}
              />
              {selectedProductId && (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              )}
            </div>
            {showProductDrop && productInput && (
              <div className="absolute z-50 mt-1 max-h-44 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                {filteredProducts.length === 0 ? (
                  <p className="px-3 py-2.5 text-sm text-gray-500">
                    No inventory match — will save as custom product
                  </p>
                ) : (
                  filteredProducts.map((p) => (
                    <div
                      key={p._id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setProductInput(p.name)
                        setSelectedProductId(p._id)
                        if (p.paymentMethod) setPaymentMethod(p.paymentMethod)
                        setShowProductDrop(false)
                      }}
                      className="flex cursor-pointer items-center justify-between px-3 py-2.5 text-sm hover:bg-indigo-50"
                    >
                      <span className="text-gray-800">
                        {p.name}
                        {p.category && (
                          <span className="ml-1 text-gray-400">
                            ({p.category})
                          </span>
                        )}
                      </span>
                      <span
                        className={`ml-2 text-xs font-semibold ${
                          p.quantity <= 5
                            ? "text-red-500"
                            : "text-emerald-600"
                        }`}
                      >
                        Stock: {p.quantity}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* ── Quantity & Supplier amount ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Quantity
              </label>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Supplier Amount
                <span className="ml-1 text-xs font-normal text-gray-400">
                  (cost)
                </span>
              </label>
              <input
                type="number"
                min={0}
                inputMode="decimal"
                value={supplierAmount}
                onChange={(e) => setSupplierAmount(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none"
              />
            </div>
          </div>

          {/* ── Payment method ── */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Payment Method
              {selectedProductId ? (
                <span className="ml-2 text-xs font-normal text-emerald-600">
                  (auto-filled from inventory)
                </span>
              ) : (
                <span className="ml-1 text-red-500">*</span>
              )}
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className={`w-full rounded-xl border px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none ${
                !selectedProductId && !paymentMethod
                  ? "border-red-300"
                  : "border-gray-300"
              }`}
            >
              {PAYMENT_METHOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* ── Warranty ── */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Warranty
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "", label: "None", Icon: null },
                { value: "warranty", label: "Warranty", Icon: ShieldCheck },
                { value: "no-warranty", label: "No Warranty", Icon: ShieldOff },
              ].map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setWarranty(value)}
                  className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-medium transition-colors ${
                    warranty === value
                      ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 bg-white text-gray-600"
                  }`}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Date ── */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Date
            </label>
            <input
              type="date"
              value={sellDate}
              onChange={(e) => setSellDate(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none"
            />
          </div>
        </div>
      )}
    </BottomSheet>
  )
}

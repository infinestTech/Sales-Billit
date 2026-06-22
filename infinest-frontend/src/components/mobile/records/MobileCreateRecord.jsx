"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Hash,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  User,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react"
import api from "@/components/api"
import { usePlanFeatures } from "@/context/PlanFeatureContext"
import { logAndNotify, logError, logSuccess } from "@/utils/logger"
import BottomSheet from "./BottomSheet"
import MobileEntryCards from "./MobileEntryCards"
import { todayIST } from "./utils"

const blankRow = () => ({
  description: "",
  model: "",
  imei: "",
  descriptionIssue: "",
  date: todayIST(),
  ready: false,
  delivered: false,
  return: false,
})

/**
 * Mobile-native Create Record flow.
 * - Customer & Dealer toggle (large segmented control)
 * - Auto-generated bill number (CUST-/DEAL-) with regenerate + duplicate check
 * - Inline dealer search + quick-create
 * - Stepped flow (Type → Details → Mobiles → Submit) on a single scrollable page
 * - Sticky CTA at bottom
 *
 * APIs used:
 *   POST /api/next-bill-number, /api/check-bill-number
 *   POST /api/dealers, /api/createdealer
 *   POST /api/createcustomer, /api/updatedealer
 *   GET/POST /api/mobile-brands & /api/mobile-issues (via MobileEntryCards)
 */
export default function MobileCreateRecord({
  shopId,
  isLimitReached,
  onCreated,
}) {
  const { features } = usePlanFeatures()
  const [customerType, setCustomerType] = useState("Customer")
  const [formData, setFormData] = useState({
    clientName: "",
    mobileNumber: "",
    noOfMobile: 1,
    billNo: "",
    technician: "",
    selectedDealer: "",
    vendorName: "",
    vendorNumber: "",
  })
  const [dealers, setDealers] = useState([])
  const [rows, setRows] = useState([blankRow()])
  const [billLoading, setBillLoading] = useState(false)
  const [billDuplicate, setBillDuplicate] = useState(false)
  const [billCheckTimeout, setBillCheckTimeout] = useState(null)

  const [submitting, setSubmitting] = useState(false)
  // Existing-customer search
  const [customerSuggestions, setCustomerSuggestions] = useState([])
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [selectedExistingCustomer, setSelectedExistingCustomer] = useState(null)
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false)
  const mobileSearchDebounce = useRef(null)

  const [showDealerPicker, setShowDealerPicker] = useState(false)
  const [showCreateDealer, setShowCreateDealer] = useState(false)
  const [creatingDealer, setCreatingDealer] = useState(false)
  const [newDealer, setNewDealer] = useState({ name: "", phone: "" })
  const [dealerQuery, setDealerQuery] = useState("")

  const dealerMobileLimit =
    features?.dealer_mobile_create_limit?.maxPerCreation ?? 30

  // Initial load
  useEffect(() => {
    generateBillNumber("CUST")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (customerType === "Dealer") fetchDealers()
    generateBillNumber(customerType === "Customer" ? "CUST" : "DEAL")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerType])

  // Resize rows array when noOfMobile changes
  useEffect(() => {
    const n = Math.max(1, Math.min(30, Number(formData.noOfMobile) || 1))
    setRows((prev) => {
      if (prev.length === n) return prev
      if (prev.length < n) {
        return [...prev, ...Array.from({ length: n - prev.length }, blankRow)]
      }
      return prev.slice(0, n)
    })
  }, [formData.noOfMobile])

  const searchExistingCustomers = async (phone) => {
    if (!shopId || phone.trim().length < 3) {
      setCustomerSuggestions([])
      setShowCustomerPicker(false)
      return
    }
    setCustomerSearchLoading(true)
    try {
      const res = await api.post(
        "/api/search-customers-by-mobile",
        { mobileNumber: phone.trim(), userId: shopId },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      )
      const list = res.data?.customers || []
      setCustomerSuggestions(list)
      if (list.length > 0) setShowCustomerPicker(true)
    } catch (err) {
      logError("Customer search failed", err)
      setCustomerSuggestions([])
    } finally {
      setCustomerSearchLoading(false)
    }
  }

  const handlePhoneChange = (value) => {
    setSelectedExistingCustomer(null)
    setFormData((p) => {
      const { existingCustomerId: _dropped, ...rest } = p
      return { ...rest, mobileNumber: value }
    })
    clearTimeout(mobileSearchDebounce.current)
    mobileSearchDebounce.current = setTimeout(() => searchExistingCustomers(value), 400)
  }

  const handleSelectExistingCustomer = (c) => {
    setSelectedExistingCustomer(c)
    setFormData((p) => ({ ...p, clientName: c.clientName, mobileNumber: c.mobileNumber, existingCustomerId: c.id }))
    setShowCustomerPicker(false)
  }

  const fetchDealers = async () => {
    if (!shopId) return
    try {
      const res = await api.post(
        "/api/dealers",
        { shop_id: shopId },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      )
      setDealers(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      logError("Failed to fetch dealers", err)
    }
  }

  const generateBillNumber = async (prefix) => {
    if (!shopId) return
    setBillLoading(true)
    try {
      const res = await api.post(
        "/api/next-bill-number",
        { prefix, userId: shopId },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      )
      if (res.data?.billNumber) {
        setFormData((p) => ({ ...p, billNo: res.data.billNumber }))
        setBillDuplicate(false)
      }
    } catch (err) {
      logError("Failed to generate bill number", err)
    } finally {
      setBillLoading(false)
    }
  }

  const handleBillEdit = (value) => {
    setFormData((p) => ({ ...p, billNo: value }))
    if (billCheckTimeout) clearTimeout(billCheckTimeout)
    if (!value) return
    const t = setTimeout(async () => {
      try {
        const res = await api.post(
          "/api/check-bill-number",
          { billNumber: value, userId: shopId },
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        )
        setBillDuplicate(!!res.data?.exists)
      } catch (err) {
        logError("Bill number check failed", err)
      }
    }, 700)
    setBillCheckTimeout(t)
  }

  const handleCreateDealer = async () => {
    if (!newDealer.name.trim() || !newDealer.phone.trim()) {
      logAndNotify("Dealer name and phone are required.", "warning", shopId)
      return
    }
    setCreatingDealer(true)
    try {
      await api.post(
        "/api/createdealer",
        {
          clientName: newDealer.name.trim(),
          mobileNumber: newDealer.phone.trim(),
          userId: shopId,
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      )
      logSuccess(`Dealer "${newDealer.name}" created.`, shopId)
      setShowCreateDealer(false)
      setNewDealer({ name: "", phone: "" })
      await fetchDealers()
      setFormData((p) => ({ ...p, selectedDealer: newDealer.name.trim() }))
      setShowDealerPicker(false)
    } catch (err) {
      logError(
        err.response?.data?.error || "Failed to create dealer",
        err,
        shopId
      )
    } finally {
      setCreatingDealer(false)
    }
  }

  // Validation
  const validationError = useMemo(() => {
    if (isLimitReached) return "Plan record-limit reached. Upgrade to create more records."
    if (!formData.existingCustomerId && !formData.billNo?.trim()) return "Bill number is required."
    if (!formData.existingCustomerId && billDuplicate) return "This bill number already exists."
    if (customerType === "Customer") {
      if (!formData.clientName.trim()) return "Customer name is required."
      if (!formData.mobileNumber.trim()) return "Mobile number is required."
    } else {
      if (!formData.selectedDealer) return "Select or create a dealer."
      if (formData.noOfMobile > dealerMobileLimit)
        return `Plan allows max ${dealerMobileLimit} mobiles per dealer record.`
    }
    if (rows.some((r) => !r.description))
      return "Every mobile entry needs a brand."
    return null
  }, [
    isLimitReached,
    customerType,
    formData,
    rows,
    billDuplicate,
    dealerMobileLimit,
  ])

  const handleSubmit = async () => {
    if (validationError) {
      logAndNotify(validationError, "warning", shopId)
      return
    }
    setSubmitting(true)
    try {
      const mobileNamePayload = rows.map((r) => ({
        mobileName: r.description,
        model: r.model,
        imei: r.imei,
        issues: r.descriptionIssue,
        date: r.date,
        ready: false,
        delivered: false,
        return: false,
      }))
      const headers = {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      }

      if (customerType === "Customer") {
        await api.post(
          "/api/createcustomer",
          {
            clientName: formData.clientName.trim(),
            mobileNumber: formData.mobileNumber.trim(),
            customerType: "Customer",
            noOfMobile: rows.length,
            billNo: formData.billNo?.trim() || undefined,
            balanceAmount: 0,
            estimatedCost: Number(formData.estimatedCost) || 0,
            MobileName: mobileNamePayload,
            userId: shopId,
            technician: formData.technician?.trim() || undefined,
            existingCustomerId: formData.existingCustomerId || undefined,
          },
          { headers }
        )
      } else {
        const dealer = dealers.find(
          (d) => d.clientName === formData.selectedDealer
        )
        if (!dealer) {
          logAndNotify("Selected dealer not found.", "error", shopId)
          setSubmitting(false)
          return
        }
        await api.post(
          "/api/updatedealer",
          {
            dealerId: dealer.id,
            noOfMobile: rows.length,
            billNo: formData.billNo.trim(),
            MobileName: mobileNamePayload,
            technicianname: formData.technician?.trim() || undefined,
            vendorName: formData.vendorName?.trim() || undefined,
            vendorNumber: formData.vendorNumber?.trim() || undefined,
          },
          { headers }
        )
      }

      logSuccess(
        `${customerType} record ${formData.billNo} created.`,
        shopId
      )

      // Reset
      setFormData({
        clientName: "",
        mobileNumber: "",
        noOfMobile: 1,
        billNo: "",
        technician: "",
        selectedDealer: "",
        vendorName: "",
        vendorNumber: "",
      })
      setRows([blankRow()])
      generateBillNumber(customerType === "Customer" ? "CUST" : "DEAL")
      onCreated?.()
    } catch (err) {
      logError(
        err.response?.data?.error || "Failed to create record",
        err,
        shopId
      )
    } finally {
      setSubmitting(false)
    }
  }

  const filteredDealers = useMemo(() => {
    const q = dealerQuery.trim().toLowerCase()
    if (!q) return dealers
    return dealers.filter(
      (d) =>
        d.clientName?.toLowerCase().includes(q) ||
        d.mobileNumber?.toString().includes(q)
    )
  }, [dealerQuery, dealers])

  const isCustomer = customerType === "Customer"

  return (
    <div className="space-y-4 px-4 pb-32 pt-4">
      {/* Limit banner */}
      {isLimitReached && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>
            You’ve reached your plan’s record-creation limit. Upgrade to add
            more.
          </p>
        </div>
      )}

      {/* Type segmented control */}
      <Section title="Record type" icon={<UserCog className="h-4 w-4" />}>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
          {[
            { value: "Customer", icon: User, label: "Customer" },
            { value: "Dealer", icon: Building2, label: "Dealer" },
          ].map((opt) => {
            const Icon = opt.icon
            const active = customerType === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setCustomerType(opt.value)}
                disabled={isLimitReached}
                className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
                  active
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-gray-500"
                } disabled:opacity-50`}
              >
                <Icon className="h-4 w-4" /> {opt.label}
              </button>
            )
          })}
        </div>
      </Section>

      {/* Customer / Dealer details */}
      {isCustomer ? (
        <Section
          title="Customer information"
          icon={<User className="h-4 w-4" />}
        >
          <Field label="Customer name" required>
            <input
              type="text"
              value={formData.clientName}
              onChange={(e) =>
                setFormData((p) => ({ ...p, clientName: e.target.value }))
              }
              placeholder="Enter customer name"
              disabled={isLimitReached}
              className="input-base"
            />
            {selectedExistingCustomer && (
              <p className="mt-1 flex items-center gap-1 text-xs text-green-600">
                <UserCheck className="h-3 w-3" /> Existing customer selected
              </p>
            )}
          </Field>
          <Field label="Phone number" required>
            <div className="relative">
              <input
                type="tel"
                inputMode="tel"
                value={formData.mobileNumber}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="Enter phone number"
                disabled={isLimitReached}
                autoComplete="off"
                className="input-base pr-10"
              />
              {customerSearchLoading && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
              )}
            </div>
          </Field>
          <Field label="Technician (optional)">
            <input
              type="text"
              value={formData.technician}
              onChange={(e) =>
                setFormData((p) => ({ ...p, technician: e.target.value }))
              }
              placeholder="Assigned technician"
              disabled={isLimitReached}
              className="input-base"
            />
          </Field>
        </Section>
      ) : (
        <Section
          title="Dealer information"
          icon={<Building2 className="h-4 w-4" />}
        >
          <Field label="Select dealer" required>
            <button
              type="button"
              onClick={() => setShowDealerPicker(true)}
              disabled={isLimitReached}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left text-sm ${
                formData.selectedDealer
                  ? "border-gray-300 bg-white text-gray-900"
                  : "border-gray-300 bg-white text-gray-400"
              }`}
            >
              <span className="truncate">
                {formData.selectedDealer || "Choose dealer or add new"}
              </span>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </button>
          </Field>
          <Field label="Vendor name (optional)">
            <input
              type="text"
              value={formData.vendorName}
              onChange={(e) =>
                setFormData((p) => ({ ...p, vendorName: e.target.value }))
              }
              placeholder="Vendor name"
              disabled={isLimitReached}
              className="input-base"
            />
          </Field>
          <Field label="Vendor number (optional)">
            <input
              type="tel"
              value={formData.vendorNumber}
              onChange={(e) =>
                setFormData((p) => ({ ...p, vendorNumber: e.target.value }))
              }
              placeholder="Vendor phone"
              disabled={isLimitReached}
              className="input-base"
            />
          </Field>
          <Field label="Technician (optional)">
            <input
              type="text"
              value={formData.technician}
              onChange={(e) =>
                setFormData((p) => ({ ...p, technician: e.target.value }))
              }
              placeholder="Assigned technician"
              disabled={isLimitReached}
              className="input-base"
            />
          </Field>
        </Section>
      )}

      {/* Bill + count */}
      <Section title="Bill & count" icon={<Hash className="h-4 w-4" />}>
        <Field label="Bill number" required>
          <div className="flex gap-2">
            <input
              type="text"
              value={formData.billNo}
              onChange={(e) => handleBillEdit(e.target.value)}
              placeholder={billLoading ? "Generating…" : "Bill no"}
              disabled={isLimitReached || billLoading}
              className={`input-base flex-1 ${
                billDuplicate ? "border-red-400" : ""
              }`}
            />
            <button
              type="button"
              onClick={() =>
                generateBillNumber(isCustomer ? "CUST" : "DEAL")
              }
              disabled={isLimitReached || billLoading}
              className="rounded-lg border border-gray-300 bg-white px-3 text-gray-600 disabled:opacity-50"
              aria-label="Regenerate"
            >
              <RefreshCw
                className={`h-4 w-4 ${billLoading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
          {billDuplicate && (
            <p className="mt-1 text-xs text-red-600">
              This bill number already exists.
            </p>
          )}
        </Field>
        <Field label="Number of mobiles" required>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setFormData((p) => ({
                  ...p,
                  noOfMobile: Math.max(1, Number(p.noOfMobile || 1) - 1),
                }))
              }
              disabled={isLimitReached || formData.noOfMobile <= 1}
              className="h-11 w-11 rounded-lg border border-gray-300 bg-white text-lg font-semibold text-gray-700 disabled:opacity-40"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              max={isCustomer ? 15 : dealerMobileLimit}
              value={formData.noOfMobile}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  noOfMobile: Math.max(
                    1,
                    Math.min(
                      isCustomer ? 15 : dealerMobileLimit,
                      Number(e.target.value) || 1
                    )
                  ),
                }))
              }
              disabled={isLimitReached}
              className="input-base flex-1 text-center"
            />
            <button
              type="button"
              onClick={() =>
                setFormData((p) => ({
                  ...p,
                  noOfMobile: Math.min(
                    isCustomer ? 15 : dealerMobileLimit,
                    Number(p.noOfMobile || 1) + 1
                  ),
                }))
              }
              disabled={
                isLimitReached ||
                formData.noOfMobile >= (isCustomer ? 15 : dealerMobileLimit)
              }
              className="h-11 w-11 rounded-lg border border-gray-300 bg-white text-lg font-semibold text-gray-700 disabled:opacity-40"
            >
              +
            </button>
          </div>
          {!isCustomer && (
            <p className="mt-1 text-xs text-gray-500">
              Plan limit: {dealerMobileLimit} mobiles per dealer record.
            </p>
          )}
        </Field>
        {isCustomer && (
          <Field label="Estimated cost">
            <input
              type="number"
              min={0}
              placeholder="₹"
              value={formData.estimatedCost ?? ""}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  estimatedCost: e.target.value,
                }))
              }
              disabled={isLimitReached}
              className="input-base w-full"
            />
          </Field>
        )}
      </Section>

      {/* Mobile entries */}
      <Section
        title={`Mobile entries (${rows.length})`}
        icon={<CreditCard className="h-4 w-4" />}
      >
        <MobileEntryCards rows={rows} setRows={setRows} />
      </Section>

      {/* Sticky CTA */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-gray-100 bg-white/95 px-4 py-3 backdrop-blur">
        {validationError && (
          <p className="mb-2 flex items-center gap-1 text-xs text-amber-700">
            <AlertTriangle className="h-3 w-3" />
            {validationError}
          </p>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || isLimitReached || !!validationError}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-base font-semibold text-white shadow-sm transition-all active:scale-[0.99] disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Submitting…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5" /> Submit record
            </>
          )}
        </button>
      </div>

      {/* Existing customer picker sheet */}
      <BottomSheet
        open={showCustomerPicker}
        onClose={() => setShowCustomerPicker(false)}
        title="Existing customers found"
        subtitle={`${customerSuggestions.length} match${customerSuggestions.length !== 1 ? "es" : ""}`}
      >
        <div className="space-y-2">
          {customerSuggestions.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handleSelectExistingCustomer(c)}
              className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-left active:bg-blue-50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{c.clientName}</p>
                <p className="truncate text-xs text-gray-500">
                  {c.mobileNumber}{c.lastBillNo ? ` · Last: ${c.lastBillNo}` : ""}
                </p>
              </div>
              <UserCheck className="h-4 w-4 text-blue-500 flex-shrink-0" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setSelectedExistingCustomer(null)
              setShowCustomerPicker(false)
              setFormData((p) => {
                const { existingCustomerId: _dropped, ...rest } = p
                return { ...rest, clientName: "" }
              })
            }}
            className="flex w-full items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-3 text-left text-green-700 active:bg-green-100"
          >
            <UserPlus className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm font-medium">Create as new customer</span>
          </button>
        </div>
      </BottomSheet>

      {/* Dealer picker sheet */}
      <BottomSheet
        open={showDealerPicker}
        onClose={() => setShowDealerPicker(false)}
        title="Choose dealer"
        subtitle={`${dealers.length} saved`}
      >
        <div className="sticky top-0 -mx-5 mb-3 bg-white px-5 pb-3 pt-1">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={dealerQuery}
                onChange={(e) => setDealerQuery(e.target.value)}
                placeholder="Search dealer…"
                className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setShowCreateDealer(true)
              }}
              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" /> New
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {filteredDealers.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                setFormData((p) => ({ ...p, selectedDealer: d.clientName }))
                setShowDealerPicker(false)
              }}
              className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-left"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">
                  {d.clientName}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {d.mobileNumber}
                </p>
              </div>
              <Users className="h-4 w-4 text-gray-400" />
            </button>
          ))}
          {filteredDealers.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-500">
              No dealers match. Tap “New” to create one.
            </p>
          )}
        </div>
      </BottomSheet>

      {/* Create dealer sheet */}
      <BottomSheet
        open={showCreateDealer}
        onClose={() => setShowCreateDealer(false)}
        title="Create new dealer"
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowCreateDealer(false)}
              className="flex-1 rounded-lg border border-gray-300 bg-white py-3 text-sm font-medium text-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateDealer}
              disabled={creatingDealer}
              className="flex-1 rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {creatingDealer ? "Saving…" : "Save dealer"}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="Dealer name" required>
            <input
              autoFocus
              value={newDealer.name}
              onChange={(e) =>
                setNewDealer((p) => ({ ...p, name: e.target.value }))
              }
              placeholder="e.g. ABC Mobiles"
              className="input-base"
            />
          </Field>
          <Field label="Dealer phone" required>
            <input
              type="tel"
              value={newDealer.phone}
              onChange={(e) =>
                setNewDealer((p) => ({ ...p, phone: e.target.value }))
              }
              placeholder="Phone number"
              className="input-base"
            />
          </Field>
        </div>
      </BottomSheet>

      {/* Local utility classes via inline style block */}
      <style jsx>{`
        :global(.input-base) {
          width: 100%;
          padding: 0.75rem 0.875rem;
          border-radius: 0.5rem;
          border: 1px solid #d1d5db;
          background: white;
          font-size: 0.875rem;
          color: #111827;
        }
        :global(.input-base:focus) {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
          outline: none;
        }
        :global(.input-base:disabled) {
          background: #f9fafb;
          opacity: 0.6;
        }
      `}</style>
    </div>
  )
}

function Section({ title, icon, children }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
        <span className="text-indigo-600">{icon}</span>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="space-y-3 p-4">{children}</div>
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

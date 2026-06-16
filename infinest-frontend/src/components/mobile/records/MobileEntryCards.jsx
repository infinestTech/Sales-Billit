"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Wrench,
  Hash,
  Type,
  Search,
} from "lucide-react"
import api from "@/components/api"
import { logError } from "@/utils/logger"
import BottomSheet from "./BottomSheet"
import { getShopIdFromToken, todayIST } from "./utils"

/**
 * Mobile-native replacement for MobileEntryTable.
 * Renders one stacked card per mobile entry with large touch targets,
 * inline searchable selectors for Brand & Issue, IMEI/Model inputs, and
 * "+ Add new" support for both brand and issue (mirrors desktop features).
 *
 * Props:
 *  - rows: same shape as MobileEntryTable (array of entry objects)
 *  - setRows: setter
 */
export default function MobileEntryCards({ rows, setRows }) {
  const [mobileBrands, setMobileBrands] = useState([])
  const [mobileIssues, setMobileIssues] = useState([])
  const [previousModels, setPreviousModels] = useState([])
  const [loading, setLoading] = useState(true)

  // Pickers
  const [brandPickerIndex, setBrandPickerIndex] = useState(null)
  const [issuePickerIndex, setIssuePickerIndex] = useState(null)
  const [modelPickerIndex, setModelPickerIndex] = useState(null)
  const [collapsed, setCollapsed] = useState({}) // index -> bool

  // Add new modals
  const [showBrandModal, setShowBrandModal] = useState(false)
  const [showIssueModal, setShowIssueModal] = useState(false)
  const [newBrandName, setNewBrandName] = useState("")
  const [newIssueName, setNewIssueName] = useState("")
  const [newIssueCategory, setNewIssueCategory] = useState("General")
  const [savingPick, setSavingPick] = useState(false)

  const shopId = getShopIdFromToken()

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      await Promise.all([loadMobileBrands(), loadMobileIssues()])
    } finally {
      setLoading(false)
    }
    loadPreviousModels()
  }

  const loadMobileBrands = async () => {
    if (!shopId) return
    try {
      const res = await api.get(`/api/mobile-brands/${shopId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })
      setMobileBrands(res.data?.brands || [])
    } catch (err) {
      logError("Failed to load mobile brands", err)
    }
  }

  const loadMobileIssues = async () => {
    if (!shopId) return
    try {
      const res = await api.get(`/api/mobile-issues/${shopId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })
      setMobileIssues(res.data?.issues || [])
    } catch (err) {
      logError("Failed to load mobile issues", err)
    }
  }

  const loadPreviousModels = () => {
    if (!shopId) return
    try {
      const stored = localStorage.getItem(`mobile_models_${shopId}`)
      if (stored) setPreviousModels(JSON.parse(stored))
    } catch {
      /* noop */
    }
  }

  const saveModelToHistory = (model) => {
    const v = (model || "").trim()
    if (!v || !shopId) return
    setPreviousModels((prev) => {
      const next = prev.includes(v) ? prev : [v, ...prev].slice(0, 50)
      try {
        localStorage.setItem(`mobile_models_${shopId}`, JSON.stringify(next))
      } catch {
        /* ignore quota */
      }
      return next
    })
  }

  const updateRow = (index, patch) => {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r))
    setRows(next)
  }

  const handlePickBrand = (brandName) => {
    if (brandPickerIndex === null) return
    updateRow(brandPickerIndex, {
      description: brandName,
      date: rows[brandPickerIndex]?.date || todayIST(),
    })
    setBrandPickerIndex(null)
  }

  const handlePickIssue = (issueName) => {
    if (issuePickerIndex === null) return
    updateRow(issuePickerIndex, {
      descriptionIssue: issueName,
      date: rows[issuePickerIndex]?.date || todayIST(),
    })
    setIssuePickerIndex(null)
  }

  const handleAddBrand = async () => {
    const name = newBrandName.trim()
    if (!name || !shopId) return
    setSavingPick(true)
    try {
      const res = await api.post(
        "/api/mobile-brands",
        { shopId, brandName: name },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      )
      const created = res.data?.brand
      if (created) setMobileBrands((prev) => [...prev, created])
      setShowBrandModal(false)
      setNewBrandName("")
      if (brandPickerIndex !== null) handlePickBrand(name)
    } catch (err) {
      logError(err.response?.data?.error || "Failed to add brand", err)
    } finally {
      setSavingPick(false)
    }
  }

  const handleAddIssue = async () => {
    const name = newIssueName.trim()
    if (!name || !shopId) return
    setSavingPick(true)
    try {
      const res = await api.post(
        "/api/mobile-issues",
        {
          shopId,
          issueName: name,
          issueCategory: newIssueCategory || "General",
          estimatedRepairTime: 1,
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      )
      const created = res.data?.issue
      if (created) setMobileIssues((prev) => [...prev, created])
      setShowIssueModal(false)
      setNewIssueName("")
      setNewIssueCategory("General")
      if (issuePickerIndex !== null) handlePickIssue(name)
    } catch (err) {
      logError(err.response?.data?.error || "Failed to add issue", err)
    } finally {
      setSavingPick(false)
    }
  }

  // Picker search state
  const [brandQuery, setBrandQuery] = useState("")
  const [issueQuery, setIssueQuery] = useState("")
  const [modelQuery, setModelQuery] = useState("")

  const filteredBrands = useMemo(() => {
    const q = brandQuery.trim().toLowerCase()
    if (!q) return mobileBrands
    return mobileBrands.filter((b) => b.brand_name?.toLowerCase().includes(q))
  }, [brandQuery, mobileBrands])

  const groupedIssues = useMemo(() => {
    const q = issueQuery.trim().toLowerCase()
    const list = q
      ? mobileIssues.filter((i) => i.issue_name?.toLowerCase().includes(q))
      : mobileIssues
    return list.reduce((acc, i) => {
      const cat = i.issue_category || "General"
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(i)
      return acc
    }, {})
  }, [issueQuery, mobileIssues])

  const filteredModels = useMemo(() => {
    const q = modelQuery.trim().toLowerCase()
    if (!q) return previousModels
    return previousModels.filter((m) => m.toLowerCase().includes(q))
  }, [modelQuery, previousModels])

  return (
    <div className="space-y-3">
      {loading && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">
          Loading brands & issues…
        </div>
      )}

      {rows.map((row, index) => {
        const isCollapsed = collapsed[index]
        const filled = !!row.description
        return (
          <div
            key={index}
            className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-all ${
              filled ? "border-indigo-200" : "border-gray-200"
            }`}
          >
            {/* Card header */}
            <button
              type="button"
              onClick={() =>
                setCollapsed((c) => ({ ...c, [index]: !c[index] }))
              }
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    filled
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {row.description || `Mobile #${index + 1}`}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {row.descriptionIssue || "Tap to fill details"}
                  </p>
                </div>
              </div>
              {isCollapsed ? (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              )}
            </button>

            {!isCollapsed && (
              <div className="space-y-3 border-t border-gray-100 px-4 pb-4 pt-3">
                {/* Brand */}
                <FieldShell
                  icon={<Smartphone className="h-4 w-4" />}
                  label="Mobile brand"
                  required
                >
                  <button
                    type="button"
                    onClick={() => {
                      setBrandQuery("")
                      setBrandPickerIndex(index)
                    }}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm ${
                      row.description
                        ? "border-gray-300 bg-white text-gray-900"
                        : "border-gray-300 bg-white text-gray-400"
                    }`}
                  >
                    <span className="truncate">
                      {row.description || "Select brand"}
                    </span>
                    <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  </button>
                </FieldShell>

                {/* Model */}
                <FieldShell icon={<Type className="h-4 w-4" />} label="Model">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={row.model || ""}
                      onChange={(e) =>
                        updateRow(index, { model: e.target.value })
                      }
                      onBlur={() => row.model && saveModelToHistory(row.model)}
                      placeholder="e.g. A2631"
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    />
                    {previousModels.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setModelQuery("")
                          setModelPickerIndex(index)
                        }}
                        className="rounded-lg border border-gray-300 bg-white px-3 text-gray-500 hover:bg-gray-50"
                        aria-label="Pick from history"
                      >
                        <Search className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </FieldShell>

                {/* IMEI */}
                <FieldShell icon={<Hash className="h-4 w-4" />} label="IMEI">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={row.imei || ""}
                    onChange={(e) =>
                      updateRow(index, { imei: e.target.value })
                    }
                    placeholder="15-digit IMEI (optional)"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                  />
                </FieldShell>

                {/* Issue */}
                <FieldShell
                  icon={<Wrench className="h-4 w-4" />}
                  label="Issue"
                  required
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIssueQuery("")
                      setIssuePickerIndex(index)
                    }}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm ${
                      row.descriptionIssue
                        ? "border-gray-300 bg-white text-gray-900"
                        : "border-gray-300 bg-white text-gray-400"
                    }`}
                  >
                    <span className="truncate">
                      {row.descriptionIssue || "Select issue"}
                    </span>
                    <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  </button>
                </FieldShell>

                {row.date && (
                  <p className="text-xs text-gray-500">
                    Added on {row.date}
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Brand Picker Sheet */}
      <BottomSheet
        open={brandPickerIndex !== null}
        onClose={() => setBrandPickerIndex(null)}
        title="Choose a brand"
        subtitle={`${mobileBrands.length} available`}
      >
        <div className="sticky top-0 -mx-5 mb-3 bg-white px-5 pb-3 pt-1">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={brandQuery}
                onChange={(e) => setBrandQuery(e.target.value)}
                placeholder="Search brand…"
                className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setNewBrandName(brandQuery)
                setShowBrandModal(true)
              }}
              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {filteredBrands.map((b) => (
            <button
              key={b._id || b.brand_name}
              type="button"
              onClick={() => handlePickBrand(b.brand_name)}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-left text-sm font-medium text-gray-800 hover:border-indigo-300 hover:bg-indigo-50"
            >
              {b.brand_name}
              {b.is_custom && (
                <span className="ml-1 text-[10px] uppercase text-indigo-500">
                  custom
                </span>
              )}
            </button>
          ))}
          {filteredBrands.length === 0 && (
            <p className="col-span-2 py-8 text-center text-sm text-gray-500">
              No brands match. Tap “Add” to create one.
            </p>
          )}
        </div>
      </BottomSheet>

      {/* Issue Picker Sheet */}
      <BottomSheet
        open={issuePickerIndex !== null}
        onClose={() => setIssuePickerIndex(null)}
        title="Choose an issue"
        subtitle={`${mobileIssues.length} available`}
      >
        <div className="sticky top-0 -mx-5 mb-3 bg-white px-5 pb-3 pt-1">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={issueQuery}
                onChange={(e) => setIssueQuery(e.target.value)}
                placeholder="Search issue…"
                className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setNewIssueName(issueQuery)
                setShowIssueModal(true)
              }}
              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </div>
        <div className="space-y-3">
          {Object.keys(groupedIssues).length === 0 && (
            <p className="py-8 text-center text-sm text-gray-500">
              No issues match. Tap “Add” to create one.
            </p>
          )}
          {Object.entries(groupedIssues).map(([cat, list]) => (
            <div key={cat}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {cat}
              </p>
              <div className="grid grid-cols-1 gap-2">
                {list.map((i) => (
                  <button
                    key={i._id || i.issue_name}
                    type="button"
                    onClick={() => handlePickIssue(i.issue_name)}
                    className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-left text-sm font-medium text-gray-800 hover:border-indigo-300 hover:bg-indigo-50"
                  >
                    {i.issue_name}
                    {i.is_custom && (
                      <span className="ml-1 text-[10px] uppercase text-indigo-500">
                        custom
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </BottomSheet>

      {/* Model history sheet */}
      <BottomSheet
        open={modelPickerIndex !== null}
        onClose={() => setModelPickerIndex(null)}
        title="Recent models"
        subtitle={`${previousModels.length} saved`}
      >
        <div className="sticky top-0 -mx-5 mb-3 bg-white px-5 pb-3 pt-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              value={modelQuery}
              onChange={(e) => setModelQuery(e.target.value)}
              placeholder="Filter models…"
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {filteredModels.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                if (modelPickerIndex !== null)
                  updateRow(modelPickerIndex, { model: m })
                setModelPickerIndex(null)
              }}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-left text-sm font-medium text-gray-800"
            >
              {m}
            </button>
          ))}
          {filteredModels.length === 0 && (
            <p className="col-span-2 py-8 text-center text-sm text-gray-500">
              No saved models match.
            </p>
          )}
        </div>
      </BottomSheet>

      {/* Add Brand Modal */}
      <BottomSheet
        open={showBrandModal}
        onClose={() => setShowBrandModal(false)}
        title="Add new brand"
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowBrandModal(false)}
              className="flex-1 rounded-lg border border-gray-300 bg-white py-3 text-sm font-medium text-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddBrand}
              disabled={savingPick || !newBrandName.trim()}
              className="flex-1 rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {savingPick ? "Saving…" : "Save brand"}
            </button>
          </div>
        }
      >
        <input
          autoFocus
          value={newBrandName}
          onChange={(e) => setNewBrandName(e.target.value)}
          placeholder="e.g. OnePlus"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
        />
      </BottomSheet>

      {/* Add Issue Modal */}
      <BottomSheet
        open={showIssueModal}
        onClose={() => setShowIssueModal(false)}
        title="Add new issue"
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowIssueModal(false)}
              className="flex-1 rounded-lg border border-gray-300 bg-white py-3 text-sm font-medium text-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddIssue}
              disabled={savingPick || !newIssueName.trim()}
              className="flex-1 rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {savingPick ? "Saving…" : "Save issue"}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <input
            autoFocus
            value={newIssueName}
            onChange={(e) => setNewIssueName(e.target.value)}
            placeholder="e.g. Liquid damage"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={newIssueCategory}
            onChange={(e) => setNewIssueCategory(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
          >
            {[
              "General",
              "Display",
              "Battery",
              "Charging",
              "Audio",
              "Camera",
              "Hardware",
              "Software",
              "Connectivity",
              "Body",
            ].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </BottomSheet>
    </div>
  )
}

function FieldShell({ icon, label, required, children }) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-600">
        <span className="text-gray-400">{icon}</span>
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

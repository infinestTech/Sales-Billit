"use client"

import { useState } from "react"
import { Plus, Eye } from "lucide-react"
import MobileCreateRecord from "./records/MobileCreateRecord"
import MobileRecordsList from "./records/MobileRecordsList"

/**
 * Mobile-native Service Application screen.
 *
 * Two tabs:
 *   - Create: full-featured create record flow (parity with desktop CreateRecordForm)
 *   - View:   filterable, actionable records list (parity with desktop AllRecordTable)
 *
 * Note: This component intentionally lives at the same path as the previous
 * implementation so that MobileLayout.jsx requires no changes.
 */
export default function MobileRecordForm({
  shopId,
  isLimitReached,
  setIsLimitReached, // eslint-disable-line no-unused-vars
}) {
  const [tab, setTab] = useState("create")
  const [refreshKey, setRefreshKey] = useState(0)

  const handleCreated = () => {
    setRefreshKey((k) => k + 1)
    setTab("view")
  }

  return (
    <div className="min-h-[calc(100vh-7rem)] bg-gray-50">
      {/* Tab bar */}
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-white">
        <div className="grid grid-cols-2">
          {[
            { id: "create", label: "Create", icon: Plus },
            { id: "view", label: "View Records", icon: Eye },
          ].map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "border-b-2 border-blue-600 text-indigo-700"
                    : "border-b-2 border-transparent text-gray-500"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {tab === "create" ? (
        <MobileCreateRecord
          shopId={shopId}
          isLimitReached={isLimitReached}
          onCreated={handleCreated}
        />
      ) : (
        <MobileRecordsList shopId={shopId} refreshKey={refreshKey} />
      )}
    </div>
  )
}

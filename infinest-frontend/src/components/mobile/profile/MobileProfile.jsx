"use client"

import { useEffect, useRef, useState } from "react"
import {
  User,
  Camera,
  Edit3,
  Check,
  LogOut,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  ShieldCheck,
  Bell,
  ChevronRight,
  Calendar,
  X,
} from "lucide-react"
import authApi from "@/components/authApi"
import BottomSheet from "../records/BottomSheet"
import { formatDate, getShopIdFromToken } from "../records/utils"
import { logAndNotify, logError } from "@/utils/logger"

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "subscription", label: "Plans", icon: CreditCard },
  { id: "settings", label: "Settings", icon: ShieldCheck },
]

const PLACEHOLDER =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM0Qjc2ODgiLz4KPGNpcmNsZSBjeD0iMjAiIGN5PSIxNiIgcj0iNiIgZmlsbD0iI0Y5RkFGQiIvPgo8cGF0aCBkPSJNMTAgMzJjMC02IDQtMTAgMTAtMTBzMTAgNCAxMCAxMCIgZmlsbD0iI0Y5RkFGQiIvPgo8L3N2Zz4K"

function fixImage(url) {
  if (!url || !url.startsWith("http")) return url || PLACEHOLDER
  let v = url.replace(
    /https?:\/\/(localhost|127\.0\.0\.1):\d+/,
    process.env.NEXT_PUBLIC_API_URL_AUTH || ""
  )
  return `${v}?t=${Date.now()}`
}

export default function MobileProfile({ shopId: shopIdProp }) {
  const shopId = shopIdProp || getShopIdFromToken()
  const [tab, setTab] = useState("profile")
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: "", phone: "", address: "" })
  const [subs, setSubs] = useState(null)
  const [showLogout, setShowLogout] = useState(false)
  const fileRef = useRef(null)

  const load = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      const res = await authApi.get("/profile/get", {
        headers: { Authorization: `Bearer ${token}` },
      })
      setProfile({ ...res.data, imageUrl: fixImage(res.data.imageUrl) })
      setForm({
        name: res.data.name || "",
        phone: res.data.phone || "",
        address: res.data.address || "",
      })
    } catch (err) {
      logError("Failed to load profile", err, shopId)
    } finally {
      setLoading(false)
    }
  }

  const loadSubs = async () => {
    if (subs !== null) return
    try {
      const token = localStorage.getItem("token")
      const res = await authApi.get("/profile/subscription/get", {
        headers: { Authorization: `Bearer ${token}` },
        params: { shopId },
      })
      setSubs(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      logError("Failed to load subscriptions", err, shopId)
      setSubs([])
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (tab === "subscription") loadSubs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const save = async () => {
    setSaving(true)
    try {
      const token = localStorage.getItem("token")
      await authApi.patch(
        "/profile/update",
        { name: form.name, phone: form.phone, address: form.address },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      logAndNotify("Profile updated", "success", shopId)
      setEditing(false)
      load()
    } catch (err) {
      logError("Failed to update profile", err, shopId)
      logAndNotify("Failed to update profile", "error", shopId)
    } finally {
      setSaving(false)
    }
  }

  const handleImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append("profileImage", file)
    try {
      const token = localStorage.getItem("token")
      const upRes = await authApi.post("/upload/profile-image", fd, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      })
      const imageUrl = upRes.data?.imageUrl
      if (imageUrl) {
        await authApi.patch(
          "/profile/update",
          { imageUrl },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        logAndNotify("Profile photo updated", "success", shopId)
        load()
      }
    } catch (err) {
      logError("Failed to upload photo", err, shopId)
      logAndNotify("Failed to upload photo", "error", shopId)
    }
  }

  const logout = () => {
    ["token", "authToken", "userRole", "profileImage", "profileName"].forEach((k) =>
      localStorage.removeItem(k)
    )
    window.location.href = "/billit-login"
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 px-4 pb-8 pt-6 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <div className="relative">
            <img
              src={profile?.imageUrl || PLACEHOLDER}
              alt={profile?.name || "Profile"}
              className="h-20 w-20 rounded-full border-4 border-white/30 object-cover"
              onError={(e) => {
                e.currentTarget.onerror = null
                e.currentTarget.src = PLACEHOLDER
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 rounded-full bg-white p-1.5 text-indigo-600 shadow-md"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImage}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-bold">{profile?.name || "—"}</h2>
            <p className="truncate text-sm opacity-90">
              {profile?.email || "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="-mt-4 px-3">
        <div className="rounded-2xl bg-white p-1 shadow-md">
          <div className="grid grid-cols-3 gap-1">
            {TABS.map((t) => {
              const Icon = t.icon
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 text-xs font-medium transition-colors ${
                    active
                      ? "bg-indigo-600 text-white"
                      : "text-gray-600"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="space-y-3 p-3 pb-24">
        {tab === "profile" && (
          <ProfileTab
            loading={loading}
            profile={profile}
            form={form}
            setForm={setForm}
            editing={editing}
            setEditing={setEditing}
            save={save}
            saving={saving}
          />
        )}
        {tab === "subscription" && <SubscriptionTab subs={subs} />}
        {tab === "settings" && (
          <SettingsTab onLogout={() => setShowLogout(true)} />
        )}
      </div>

      {showLogout && (
        <BottomSheet
          open
          onClose={() => setShowLogout(false)}
          title="Sign out?"
          footer={
            <div className="flex gap-2">
              <button
                onClick={() => setShowLogout(false)}
                className="flex-1 rounded-xl bg-gray-100 py-3 text-sm font-semibold text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={logout}
                className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white"
              >
                Sign out
              </button>
            </div>
          }
        >
          <p className="py-2 text-sm text-gray-600">
            You'll need to sign in again to access your account.
          </p>
        </BottomSheet>
      )}
    </div>
  )
}

function ProfileTab({ loading, profile, form, setForm, editing, setEditing, save, saving }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-white" />
        ))}
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Personal info</h3>
          {editing ? (
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
            </button>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white"
            >
              <Edit3 className="h-3.5 w-3.5" /> Edit
            </button>
          )}
        </div>
        <div className="space-y-3">
          <Row label="Name" icon={User}>
            {editing ? (
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
              />
            ) : (
              <p className="text-sm text-gray-900">{profile?.name || "—"}</p>
            )}
          </Row>
          <Row label="Email" icon={Mail}>
            <p className="text-sm text-gray-500">{profile?.email || "—"}</p>
          </Row>
          <Row label="Phone" icon={Phone}>
            {editing ? (
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                inputMode="tel"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
              />
            ) : (
              <p className="text-sm text-gray-900">{profile?.phone || "—"}</p>
            )}
          </Row>
          <Row label="Address" icon={MapPin}>
            {editing ? (
              <textarea
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                rows={2}
                className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
              />
            ) : (
              <p className="whitespace-pre-line text-sm text-gray-900">
                {profile?.address || "—"}
              </p>
            )}
          </Row>
        </div>
        {editing && (
          <button
            onClick={() => setEditing(false)}
            className="mt-3 w-full rounded-lg bg-gray-100 py-2 text-sm font-semibold text-gray-700"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

function Row({ label, icon: Icon, children }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      {children}
    </div>
  )
}

function SubscriptionTab({ subs }) {
  if (subs === null) {
    return (
      <div className="space-y-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-white" />
        ))}
      </div>
    )
  }
  if (!subs.length) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center">
        <CreditCard className="mx-auto mb-3 h-10 w-10 text-gray-300" />
        <p className="text-sm font-medium text-gray-700">No subscriptions yet</p>
        <p className="text-xs text-gray-500">Upgrade from the Pricing page.</p>
      </div>
    )
  }
  const counts = subs.reduce(
    (acc, s) => {
      const k = (s.status || "").toLowerCase()
      if (k === "active") acc.active++
      else if (k === "queued" || k === "pending") acc.queued++
      else acc.cancelled++
      return acc
    },
    { active: 0, queued: 0, cancelled: 0 }
  )
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-emerald-50 p-3 text-center">
          <p className="text-xs font-medium text-emerald-700">Active</p>
          <p className="text-xl font-bold text-emerald-700">{counts.active}</p>
        </div>
        <div className="rounded-xl bg-amber-50 p-3 text-center">
          <p className="text-xs font-medium text-amber-700">Queued</p>
          <p className="text-xl font-bold text-amber-700">{counts.queued}</p>
        </div>
        <div className="rounded-xl bg-gray-100 p-3 text-center">
          <p className="text-xs font-medium text-gray-600">Other</p>
          <p className="text-xl font-bold text-gray-700">{counts.cancelled}</p>
        </div>
      </div>
      <ul className="space-y-2">
        {subs.map((s, i) => {
          const status = (s.status || "").toUpperCase()
          const tone =
            status === "ACTIVE"
              ? "bg-emerald-100 text-emerald-700"
              : status === "QUEUED" || status === "PENDING"
              ? "bg-amber-100 text-amber-700"
              : "bg-gray-100 text-gray-600"
          return (
            <li
              key={i}
              className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {s.planName || s.product || "Plan"}
                  </p>
                  <p className="text-xs text-gray-500">{s.planType || "—"}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}`}
                >
                  {status || "—"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(s.startDate)} → {formatDate(s.endDate)}
                </span>
                {s.amount != null && (
                  <span className="font-semibold text-gray-700">
                    ₹{Number(s.amount).toLocaleString("en-IN")}
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function SettingsTab({ onLogout }) {
  const items = [
    { label: "Security", icon: ShieldCheck, sub: "Password & sessions" },
    { label: "Notifications", icon: Bell, sub: "Manage alerts" },
  ]
  return (
    <div className="space-y-2">
      <ul className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        {items.map((it, i) => {
          const Icon = it.icon
          return (
            <li key={i}>
              <button className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-gray-50">
                <div className="rounded-lg bg-gray-100 p-2 text-gray-700">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{it.label}</p>
                  <p className="text-xs text-gray-500">{it.sub}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300" />
              </button>
            </li>
          )
        })}
      </ul>
      <button
        onClick={onLogout}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-600 active:bg-red-100"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  )
}

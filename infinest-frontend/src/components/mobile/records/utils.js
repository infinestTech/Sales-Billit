// Shared helpers for the mobile Records experience.
// Keep this file dependency-free so it can be imported by any subcomponent.

export const getShopIdFromToken = () => {
  if (typeof window === "undefined") return null
  try {
    const token = localStorage.getItem("token")
    if (!token) return null
    const payload = JSON.parse(atob(token.split(".")[1]))
    return payload.shop_id || payload.id || null
  } catch {
    return null
  }
}

export const formatINR = (value) => {
  const n = Number(value || 0)
  if (Number.isNaN(n)) return "₹0"
  return `₹${n.toLocaleString("en-IN")}`
}

export const formatDate = (value) => {
  if (!value) return "—"
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  } catch {
    return "—"
  }
}

export const formatDateTime = (value) => {
  if (!value) return "—"
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return "—"
  }
}

export const todayIST = () => {
  // Returns YYYY-MM-DD in IST
  const now = new Date()
  const istOffsetMs = 5.5 * 60 * 60 * 1000
  const ist = new Date(now.getTime() + istOffsetMs - now.getTimezoneOffset() * 60 * 1000)
  return ist.toISOString().slice(0, 10)
}

// Compute summary status for a client-row, given the array of mobiles.
export const summarizeMobiles = (mobiles = []) => {
  let ready = 0
  let delivered = 0
  let returned = 0
  let pending = 0
  let totalPaid = 0
  for (const m of mobiles) {
    if (m.returned) returned += 1
    else if (m.delivered) delivered += 1
    else if (m.ready) ready += 1
    else pending += 1
    totalPaid += Number(m.total_paid || m.paid_amount || 0)
  }
  return {
    ready,
    delivered,
    returned,
    pending,
    totalPaid,
    total: mobiles.length,
    isComplete: mobiles.length > 0 && pending === 0 && returned === mobiles.length ? false : delivered === mobiles.length,
  }
}

// Aggregate payments-by-method across an array of mobiles for the breakdown chip.
export const aggregatePaymentsByMethod = (mobiles = []) => {
  const map = new Map()
  for (const m of mobiles) {
    const payments = Array.isArray(m.payments) ? m.payments : []
    if (payments.length > 0) {
      for (const p of payments) {
        const key = p.method || "Other"
        map.set(key, (map.get(key) || 0) + Number(p.amount || 0))
      }
    } else if (m.paid_amount) {
      const key = m.payment || "Other"
      map.set(key, (map.get(key) || 0) + Number(m.paid_amount || 0))
    }
  }
  return Array.from(map.entries()).map(([method, amount]) => ({ method, amount }))
}

export const truncate = (s, n = 24) => {
  if (!s) return ""
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

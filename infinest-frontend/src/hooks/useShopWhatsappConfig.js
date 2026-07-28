"use client"

import { useEffect, useState } from "react"
import api from "@/components/api"

// Module-level cache: keyed by token so different sessions don't clash
const _cache = {}

/**
 * Returns whether WhatsApp automation is enabled for the current shop.
 *   null  → still loading (treat as disabled to avoid flashing dialog)
 *   true  → enabled  → show WA confirmation dialog on status toggles
 *   false → disabled → skip dialog, just update status silently
 */
export function useShopWhatsappConfig() {
  const [waEnabled, setWaEnabled] = useState(null)

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!token) {
      setWaEnabled(false)
      return
    }

    // Return cached result immediately if available
    if (_cache[token] !== undefined) {
      setWaEnabled(_cache[token])
      return
    }

    api
      .get("/api/shop/whatsapp-config", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const enabled = !!res.data?.enabled
        _cache[token] = enabled
        setWaEnabled(enabled)
      })
      .catch(() => {
        // Fail open: if the request fails, show the dialog so WA is still opt-in
        _cache[token] = true
        setWaEnabled(true)
      })
  }, [])

  return waEnabled
}

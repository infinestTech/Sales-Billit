"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2 } from "lucide-react"

// Landing page for "Switch to Service" in the Sales branch portal (combo plans).
// ?code=<one-time code from SalesServer> is swapped for the normal Service session, then the app opens.
export default function ServiceSsoPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const code = new URLSearchParams(window.location.search).get("code") || ""
    // Take the one-time code out of the address bar right away
    window.history.replaceState(null, "", window.location.pathname)
    if (!code) {
      setError("This link is missing its sign-in code. Please use Switch to Service again.")
      return
    }
    ;(async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/service-sso`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.token) throw new Error(data.message || "Could not open Service")
        localStorage.setItem("token", data.token)
        router.replace("/application")
      } catch (e) {
        setError(e.message || "Could not open Service")
      }
    })()
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur">
        {error ? (
          <>
            <h1 className="text-lg font-semibold text-white">Couldn&apos;t open Service</h1>
            <p className="mt-2 text-sm text-slate-300">{error}</p>
            <Link href="/billit-login" className="mt-6 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">
              Sign in to Service
            </Link>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-400" />
            <h1 className="mt-4 text-lg font-semibold text-white">Opening Service…</h1>
            <p className="mt-1 text-sm text-slate-400">Signing you in from the Sales portal</p>
          </>
        )}
      </div>
    </div>
  )
}

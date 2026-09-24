"use client"
import { useEffect, useState } from "react"
import { X, ImageOff } from "lucide-react"
import { fetchMobileImages } from "@/utils/mobileImagesApi"

// Shows the front/back photos captured for a mobile entry, fetched on demand via
// short-lived signed R2 URLs (never stored/cached beyond this modal's lifetime).
export default function MobileImagesModal({ mobileId, onClose }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [images, setImages] = useState([])

  useEffect(() => {
    if (!mobileId) return
    let cancelled = false
    setLoading(true)
    setError("")
    fetchMobileImages(mobileId)
      .then(({ images }) => {
        if (!cancelled) setImages(images)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load images")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [mobileId])

  if (!mobileId) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="text-base font-semibold text-gray-900">Mobile Photos</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-gray-500">Loading photos...</div>
          ) : error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-sm text-gray-500">
              <ImageOff className="h-8 w-8 text-gray-300" />
              No photos were captured for this entry.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {images.map((img) => (
                <div key={img.side}>
                  <p className="mb-1 text-xs font-semibold uppercase text-gray-600">{img.side}</p>
                  <a href={img.url} target="_blank" rel="noreferrer">
                    <img src={img.url} alt={img.side} className="w-full rounded-md border object-contain" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

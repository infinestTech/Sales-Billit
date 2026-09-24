"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import { X, RotateCcw, Check, Camera } from "lucide-react"

const SIDES = ["front", "back"]
const MAX_WIDTH = 1280

function describeCameraError(err) {
  switch (err?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera permission was denied. Allow camera access in your browser's site settings, then press Try Again."
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No camera was found on this device."
    case "NotReadableError":
    case "TrackStartError":
      return "The camera is already in use by another app or tab. Close it and press Try Again."
    default:
      return "Unable to open the camera. Press Try Again."
  }
}

export default function CameraCaptureModal({ open, onClose, onDone, title }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  const [step, setStep] = useState(0) // 0 = front, 1 = back, 2 = review
  const [shots, setShots] = useState({})
  const [flash, setFlash] = useState(false)
  const [retryToken, setRetryToken] = useState(0)

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setStep(0)
    setShots({})
    setError("")
    setReady(false)

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera is not supported in this browser (a secure https connection is required).")
      return
    }

    const start = (constraints) =>
      navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play()
            setReady(true)
          }
        }
      })

    // Prefer the rear camera; laptops without one can throw OverconstrainedError, so fall back to any camera
    start({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }).catch((err) => {
      if (cancelled) return
      if (err?.name === "OverconstrainedError" || err?.name === "ConstraintNotSatisfiedError") {
        return start({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }).catch((err2) => {
          if (!cancelled) setError(describeCameraError(err2))
        })
      }
      setError(describeCameraError(err))
    })

    return () => {
      cancelled = true
      stopStream()
    }
  }, [open, retryToken])

  const capture = useCallback(() => {
    const video = videoRef.current
    if (!video || !ready || step > 1) return
    const scale = Math.min(1, MAX_WIDTH / (video.videoWidth || MAX_WIDTH))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height)
    const side = SIDES[step]
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        setShots((prev) => ({ ...prev, [side]: { blob, url: URL.createObjectURL(blob) } }))
        setStep((s) => s + 1)
      },
      "image/jpeg",
      0.85
    )
    setFlash(true)
    setTimeout(() => setFlash(false), 150)
  }, [ready, step])

  useEffect(() => {
    if (!open || step > 1) return
    const onKey = (e) => {
      if (e.repeat) return
      e.preventDefault()
      e.stopPropagation()
      capture()
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [open, step, capture])

  const discardShots = () => Object.values(shots).forEach((s) => s?.url && URL.revokeObjectURL(s.url))

  const handleRetake = () => {
    discardShots()
    setShots({})
    setStep(0)
  }

  const handleClose = () => {
    discardShots()
    stopStream()
    onClose()
  }

  const handleSave = () => {
    stopStream()
    onDone(shots)
  }

  if (!open) return null

  const sideLabel = step === 0 ? "FRONT" : "BACK"

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
          <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <Camera className="h-5 w-5" /> {title || "Capture Mobile Photos"}
          </h3>
          <button onClick={handleClose} className="rounded-md p-1 hover:bg-gray-200" title="Cancel">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p>{error}</p>
              <button
                onClick={() => setRetryToken((t) => t + 1)}
                className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
              >
                Try Again
              </button>
            </div>
          )}
          {/* Video stays mounted so the stream survives a retake */}
          <div className={error || step === 2 ? "hidden" : ""}>
            <div className="relative overflow-hidden rounded-md bg-black" onClick={capture}>
              <video ref={videoRef} playsInline muted className="h-auto max-h-[60vh] w-full object-contain" />
              {flash && <div className="absolute inset-0 bg-white/80" />}
              <div className="absolute left-3 top-3 rounded bg-black/60 px-2 py-1 text-xs font-semibold text-white">
                {Math.min(step + 1, 2)}/2 · {sideLabel}
              </div>
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-white">Starting camera...</div>
              )}
            </div>
            <p className="mt-3 text-center text-sm font-medium text-gray-800">
              {ready ? `Show the ${sideLabel} of the mobile and press any key to capture` : "Waiting for camera..."}
            </p>
            {shots.front && (
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                <img src={shots.front.url} alt="Front" className="h-12 w-12 rounded border object-cover" />
                Front captured
              </div>
            )}
          </div>
          {!error && step === 2 && (
            <div className="grid grid-cols-2 gap-4">
              {SIDES.map((side) => (
                <div key={side}>
                  <p className="mb-1 text-xs font-semibold uppercase text-gray-600">{side}</p>
                  <img src={shots[side]?.url} alt={side} className="w-full rounded-md border object-contain" />
                </div>
              ))}
            </div>
          )}
        </div>

        {step === 2 && (
          <div className="flex justify-end gap-3 border-t border-gray-200 px-4 py-3">
            <button
              onClick={handleRetake}
              className="flex items-center gap-2 rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              <RotateCcw className="h-4 w-4" /> Retake
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              <Check className="h-4 w-4" /> Use Photos
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

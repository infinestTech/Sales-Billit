const API = process.env.NEXT_PUBLIC_API_URL_BILLIT

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` })

// Gets a short-lived presigned URL from BillitServer, then PUTs the file straight to R2
export async function uploadMobilePhoto(blob, side) {
  const contentType = blob.type || "image/jpeg"
  const presignRes = await fetch(`${API}/api/mobile-images/presign-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ side, contentType, size: blob.size }),
  })
  const presign = await presignRes.json().catch(() => ({}))
  if (!presignRes.ok) throw new Error(presign.error || "Could not prepare upload")

  const putRes = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  })
  if (!putRes.ok) throw new Error(`Storage rejected the upload (${putRes.status})`)

  return { key: presign.key, side }
}

// Returns [{ side, url, uploaded_at }] with temporary signed URLs; re-fetch after `expiresIn` seconds
export async function fetchMobileImages(mobileId) {
  const res = await fetch(`${API}/api/mobile-images/${mobileId}`, { headers: authHeader() })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || "Could not load images")
  return { images: data.images || [], expiresIn: data.expiresIn }
}

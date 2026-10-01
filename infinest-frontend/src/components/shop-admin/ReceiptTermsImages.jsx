"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Image as ImageIcon, Trash2, Upload, Plus } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || "http://localhost:8000";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 1 * 1024 * 1024;
const TITLE_MAX = 100;

// The PDF generator can only embed JPEG/PNG, so WEBP is re-encoded to JPEG before upload.
const webpToJpeg = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not convert image"))), "image/jpeg", 0.9);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The selected file is not a valid image"));
    };
    img.src = url;
  });

export default function ReceiptTermsImages({ shopId }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [permitted, setPermitted] = useState(false);
  const fileInputRef = useRef(null);

  const authConfig = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("shopAdminToken")}` },
    params: { shop_id: shopId },
  });

  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;
    setLoading(true);
    setPermitted(false);
    axios
      .get(`${API_URL}/api/shop-admin/shop-settings/terms-images`, authConfig())
      .then((res) => {
        if (!cancelled && res.data.success) {
          setImages(res.data.images || []);
          setPermitted(true);
        }
      })
      .catch((err) => {
        if (err.response?.status !== 403) console.error("Error fetching receipt terms images:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const resetForm = () => {
    setFile(null);
    setTitle("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e) => {
    setError(null);
    const selected = e.target.files?.[0] || null;
    if (!selected) {
      setFile(null);
      return;
    }
    if (!ALLOWED_TYPES.includes(selected.type)) {
      setError("Only JPG, JPEG, PNG or WEBP images are allowed.");
      e.target.value = "";
      setFile(null);
      return;
    }
    if (selected.size > MAX_BYTES) {
      setError("Image must be 1MB or smaller.");
      e.target.value = "";
      setFile(null);
      return;
    }
    setFile(selected);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (adding) return;
    setError(null);
    const trimmedTitle = title.trim();
    if (!file) {
      setError("Please select an image.");
      return;
    }
    if (!trimmedTitle) {
      setError("Please enter an image title.");
      return;
    }

    setAdding(true);
    try {
      let uploadBlob = file;
      let fileName = file.name;
      if (file.type === "image/webp") {
        uploadBlob = await webpToJpeg(file);
        fileName = fileName.replace(/\.webp$/i, "") + ".jpg";
        if (uploadBlob.size > MAX_BYTES) throw new Error("Image must be 1MB or smaller.");
      }
      const form = new FormData();
      form.append("title", trimmedTitle);
      form.append("image", uploadBlob, fileName);
      const res = await axios.post(`${API_URL}/api/shop-admin/shop-settings/terms-images`, form, authConfig());
      if (res.data.success && res.data.image) {
        setImages((prev) => [...prev, res.data.image]);
        resetForm();
      }
    } catch (err) {
      console.error("Error uploading receipt terms image:", err);
      setError(err.response?.data?.message || err.message || "Failed to upload image.");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (image) => {
    if (!confirm(`Delete image "${image.title}"?`)) return;
    setDeletingId(image.id);
    setError(null);
    try {
      const res = await axios.delete(
        `${API_URL}/api/shop-admin/shop-settings/terms-images/${image.id}`,
        authConfig()
      );
      if (res.data.success) setImages((prev) => prev.filter((img) => img.id !== image.id));
    } catch (err) {
      console.error("Error deleting receipt terms image:", err);
      setError(err.response?.data?.message || "Failed to delete image.");
    } finally {
      setDeletingId(null);
    }
  };

  // Section is only for shop admins granted access by the infinest admin
  if (!permitted) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-3 rounded-lg bg-blue-100 flex-shrink-0">
          <ImageIcon className="h-6 w-6 text-blue-600" />
        </div>
        <div className="min-w-0">
          <h3 className="text-gray-900 font-semibold text-lg">Receipt Terms &amp; Conditions Images</h3>
          <p className="text-gray-500 text-sm">
            Upload images with a title. They appear on the second page of the A4 invoice/receipt, after the Terms &amp; Conditions list.
          </p>
        </div>
      </div>

      <form onSubmit={handleAdd} className="mt-3 flex flex-col md:flex-row md:items-end gap-3">
        <label className="flex items-center gap-3 border border-dashed border-gray-300 rounded-lg p-3 cursor-pointer hover:border-blue-400 transition md:w-72 min-w-0">
          <div className="h-12 w-16 flex-shrink-0 rounded border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
            {previewUrl ? (
              <img src={previewUrl} alt="Selected" className="h-full w-full object-contain" />
            ) : (
              <Upload className="h-5 w-5 text-gray-400" />
            )}
          </div>
          <span className="text-sm text-gray-600 truncate min-w-0">
            {file ? file.name : "Choose image (JPG, PNG, WEBP · max 1MB)"}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        <div className="flex-1 min-w-0">
          <label htmlFor="receipt-terms-image-title" className="block text-sm font-medium text-gray-700 mb-1">
            Image Title
          </label>
          <input
            id="receipt-terms-image-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter image title"
            maxLength={TITLE_MAX}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <button
          type="submit"
          disabled={adding}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-1"
        >
          <Plus className="h-4 w-4" />
          {adding ? "Adding..." : "Add"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-gray-400">Loading images...</p>
        ) : images.length === 0 ? (
          <p className="text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg p-4 text-center">
            No receipt terms &amp; conditions images added yet.
          </p>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-24 sm:w-28" />
                <col />
                <col className="w-20" />
              </colgroup>
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Image</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Title</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {images.map((image) => (
                  <tr key={image.id} className="h-20">
                    <td className="px-3 py-2 align-middle">
                      <div className="h-14 w-16 sm:w-20 rounded border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
                        {image.url ? (
                          <img src={image.url} alt={image.title} className="h-full w-full object-contain" />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-gray-300" />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-middle text-gray-800 break-words">{image.title}</td>
                    <td className="px-3 py-2 align-middle text-center">
                      <button
                        type="button"
                        onClick={() => handleDelete(image)}
                        disabled={deletingId === image.id}
                        title="Delete image"
                        className="inline-flex items-center justify-center p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

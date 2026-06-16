"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { User, Mail, Phone, MapPin, Camera, Edit3, Save, X, CreditCard } from "lucide-react"
import authApi from "../authApi"
import { logAndNotify, logError, logSystem } from "@/utils/logger"

export default function ProfilePage() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)
  const router = useRouter()

  // Fetch profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("token")
        if (!token) {
          console.warn('You are not logged in');
          router.push("/login")
          return
        }
        const res = await authApi.get("/profile/get", {
          headers: { Authorization: `Bearer ${token}` },
        })
        
        // Fix imageUrl protocol issues
        const profileData = res.data
        if (profileData.imageUrl && profileData.imageUrl.startsWith('http')) {
          // Replace any https://localhost or https://127.0.0.1 with the correct auth API base URL
          profileData.imageUrl = profileData.imageUrl.replace(/https?:\/\/(localhost|127\.0\.0\.1):\d+/, process.env.NEXT_PUBLIC_API_URL_AUTH)
        }
        
        setProfile(profileData)
      } catch (err) {
        logError("Error fetching profile", err)
        logSystem("Failed to fetch profile", "WARN");
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [router])

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setProfile((prev) => ({ ...prev, [name]: value }))
  }

  // Handle image upload
  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const formData = new FormData()
    formData.append("profileImage", file)
    setUploading(true)

    try {
      const res = await authApi.post("/upload/profile-image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      let newImageUrl = res.data.imageUrl
      
      // Fix imageUrl protocol issues
      if (newImageUrl && newImageUrl.startsWith('http')) {
        newImageUrl = newImageUrl.replace(/https?:\/\/(localhost|127\.0\.0\.1):\d+/, process.env.NEXT_PUBLIC_API_URL_AUTH)
      }

      const token = localStorage.getItem("token")
      await authApi.patch(
        "/profile/update",
        { imageUrl: newImageUrl },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      )

      setProfile((prev) => ({ ...prev, imageUrl: newImageUrl }))
      logSystem("Profile image updated", "INFO");
    } catch (err) {
      logError("Image upload or update failed", err)
      logSystem("Failed to update profile image", "WARN");
    } finally {
      setUploading(false)
    }
  }

  // Save profile updates
  const handleSave = async () => {
    setSaving(true)
    try {
      const token = localStorage.getItem("token")
      await authApi.patch("/profile/update", profile, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      logAndNotify("Profile updated successfully", "success");
      setEditMode(false)
    } catch (err) {
      logError("Profile update failed", err)
      logSystem("Failed to update profile", "WARN");
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-8">
          <div className="container mx-auto px-6">
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 p-3 rounded-xl">
                <User className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Profile</h1>
                <p className="text-blue-100">Manage your account information</p>
              </div>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading profile...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-8">
          <div className="container mx-auto px-6">
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 p-3 rounded-xl">
                <User className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Profile</h1>
                <p className="text-blue-100">Manage your account information</p>
              </div>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-6 py-8">
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <p className="text-red-500 text-lg">Profile not found.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-8">
        <div className="container mx-auto px-6">
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 p-3 rounded-xl">
              <User className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Profile</h1>
              <p className="text-blue-100">Manage your account information</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Profile Header */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-8 py-6 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-6">
                  {/* Profile Image */}
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg">
                      <img
                        src={profile.imageUrl || "/placeholder.svg?height=96&width=96"}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {editMode && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute -bottom-2 -right-2 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-lg transition-colors"
                        disabled={uploading}
                      >
                        {uploading ? (
                          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                        ) : (
                          <Camera className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>

                  {/* Profile Info */}
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{profile.name || "User Name"}</h2>
                    <p className="text-gray-600">{profile.email}</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  {editMode ? (
                    <>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        <span>{saving ? "Saving..." : "Save"}</span>
                      </button>
                      <button
                        onClick={() => setEditMode(false)}
                        className="flex items-center space-x-2 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                        <span>Cancel</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setEditMode(true)}
                        className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>Edit Profile</span>
                      </button>
                      <button
                        onClick={() => router.push("/profile/subscription")}
                        className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Subscription</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Profile Details */}
            <div className="p-8">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Name Field */}
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <User className="w-4 h-4 text-blue-600" />
                    <span>Full Name</span>
                  </label>
                  {editMode ? (
                    <input
                      type="text"
                      name="name"
                      value={profile.name || ""}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Enter your full name"
                    />
                  ) : (
                    <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">{profile.name || "Not set"}</div>
                  )}
                </div>

                {/* Email Field */}
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <Mail className="w-4 h-4 text-blue-600" />
                    <span>Email Address</span>
                  </label>
                  <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">{profile.email || "Not set"}</div>
                </div>

                {/* Phone Field */}
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <Phone className="w-4 h-4 text-blue-600" />
                    <span>Phone Number</span>
                  </label>
                  {editMode ? (
                    <input
                      type="text"
                      name="phone"
                      value={profile.phone || ""}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Enter your phone number"
                    />
                  ) : (
                    <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">{profile.phone || "Not set"}</div>
                  )}
                </div>

                {/* Address Field */}
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <span>Address</span>
                  </label>
                  {editMode ? (
                    <input
                      type="text"
                      name="address"
                      value={profile.address || ""}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Enter your address"
                    />
                  ) : (
                    <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">{profile.address || "Not set"}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

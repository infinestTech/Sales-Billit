"use client"

import { useState, useEffect, useRef } from "react"
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Camera, 
  Edit3, 
  Save, 
  X, 
  CreditCard,
  Settings,
  LogOut,
  Shield,
  Bell,
  ChevronRight
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import authApi from "../authApi"
import { logAndNotify, logError, logSystem } from "@/utils/logger"

export default function MobileProfile({ shopId }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState("profile") // profile, subscription, settings
  const [subscriptions, setSubscriptions] = useState([])
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false)
  const fileInputRef = useRef(null)

  // Fetch profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("token")
        if (!token) {
          console.warn('You are not logged in');
          return
        }
        const res = await authApi.get("/profile/get", {
          headers: { Authorization: `Bearer ${token}` },
        })
        
        // Add cache busting to profile image like in MobileLayout
        const profileData = res.data
        if (profileData.imageUrl) {
          // Fix imageUrl to use correct protocol/domain if it's an absolute URL
          let correctedImageUrl = profileData.imageUrl
          if (profileData.imageUrl.startsWith('http')) {
            // Replace any https://localhost or https://127.0.0.1 with the correct auth API base URL
            correctedImageUrl = profileData.imageUrl.replace(/https?:\/\/(localhost|127\.0\.0\.1):\d+/, process.env.NEXT_PUBLIC_API_URL_AUTH)
            // Only add cache busting to HTTP URLs
            correctedImageUrl = `${correctedImageUrl}?t=${Date.now()}`
          }
          profileData.imageUrl = correctedImageUrl
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
  }, [])

  // Fetch subscriptions when subscription tab is active
  useEffect(() => {
    if (activeTab === "subscription" && !loadingSubscriptions && subscriptions.length === 0) {
      fetchSubscriptions()
    }
  }, [activeTab])

  const fetchSubscriptions = async () => {
    setLoadingSubscriptions(true)
    try {
      const token = localStorage.getItem("token")
      if (!token) return

      const res = await authApi.get("/profile/subscription/get", {
        headers: { Authorization: `Bearer ${token}` },
        params: { shopId },
      })

      setSubscriptions(res.data || [])
    } catch (err) {
      console.error("Error fetching subscriptions:", err)
      logError("Error fetching subscriptions", err)
    } finally {
      setLoadingSubscriptions(false)
    }
  }

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

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem("token")
    window.location.href = "/login"
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading profile...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-red-500 text-lg">Profile not found.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const tabButtons = [
    { id: "profile", label: "Profile", icon: User },
    { id: "subscription", label: "Subscription", icon: CreditCard },
    { id: "settings", label: "Settings", icon: Settings }
  ]

  const renderProfileTab = () => (
    <div className="space-y-4">
      {/* Profile Header Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            {/* Profile Image */}
            <div className="relative">
              <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-gray-200">
                <img
                  src={profile.imageUrl || "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM0Qjc2ODgiLz4KPGNpcmNsZSBjeD0iMjAiIGN5PSIxNiIgcj0iNiIgZmlsbD0iI0Y5RkFGQiIvPgo8cGF0aCBkPSJNMTAgMzJjMC02IDQtMTAgMTAtMTBzMTAgNCAxMCAxMCIgZmlsbD0iI0Y5RkFGQiIvPgo8L3N2Zz4K"}
                  alt="Profile"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.onerror = null; // Prevent infinite loop
                    e.target.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM0Qjc2ODgiLz4KPGNpcmNsZSBjeD0iMjAiIGN5PSIxNiIgcj0iNiIgZmlsbD0iI0Y5RkFGQiIvPgo8cGF0aCBkPSJNMTAgMzJjMC02IDQtMTAgMTAtMTBzMTAgNCAxMCAxMCIgZmlsbD0iI0Y5RkFGQiIvPgo8L3N2Zz4K"
                  }}
                />
              </div>
              {editMode && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-lg"
                  disabled={uploading}
                >
                  {uploading ? (
                    <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full"></div>
                  ) : (
                    <Camera className="w-3 h-3" />
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
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">{profile.name || "User Name"}</h2>
              <p className="text-gray-600 text-sm">{profile.email}</p>
              
              {/* Action Buttons */}
              <div className="flex space-x-2 mt-3">
                {editMode ? (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center space-x-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      <Save className="w-3 h-3" />
                      <span>{saving ? "Saving..." : "Save"}</span>
                    </button>
                    <button
                      onClick={() => setEditMode(false)}
                      className="flex items-center space-x-1 bg-gray-500 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
                    >
                      <X className="w-3 h-3" />
                      <span>Cancel</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditMode(true)}
                    className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Details */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
          
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your address"
              />
            ) : (
              <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">{profile.address || "Not set"}</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const renderSubscriptionTab = () => (
    <div className="space-y-4">
      {loadingSubscriptions ? (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading subscriptions...</p>
          </CardContent>
        </Card>
      ) : subscriptions.length > 0 ? (
        subscriptions.map((subscription, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{subscription.planName || "Subscription Plan"}</h3>
                  <p className="text-sm text-gray-600">{subscription.planType || "Plan"}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  subscription.status === 'active' 
                    ? 'bg-green-100 text-green-800' 
                    : subscription.status === 'expired'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {subscription.status || 'Unknown'}
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Start Date:</span>
                  <span className="text-sm font-medium">{subscription.startDate ? new Date(subscription.startDate).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">End Date:</span>
                  <span className="text-sm font-medium">{subscription.endDate ? new Date(subscription.endDate).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Amount:</span>
                  <span className="text-sm font-medium">₹{subscription.amount || 'N/A'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Subscriptions</h3>
            <p className="text-gray-600 mb-4">You don't have any active subscriptions</p>
            <button
              onClick={() => window.location.href = "/pricing"}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
            >
              View Plans
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  )

  const renderSettingsTab = () => (
    <div className="space-y-4">
      {/* Account Settings */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Settings</h3>
          <div className="space-y-3">
            <button className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center space-x-3">
                <Shield className="w-5 h-5 text-blue-600" />
                <span className="text-gray-900">Security & Privacy</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
            
            <button className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center space-x-3">
                <Bell className="w-5 h-5 text-blue-600" />
                <span className="text-gray-900">Notifications</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Logout */}
      <Card>
        <CardContent className="p-6">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 p-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="p-4 space-y-4">
      {/* Tab Navigation */}
      <div className="flex bg-gray-100 rounded-lg p-1">
        {tabButtons.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-md transition-colors ${
                isActive
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "profile" && renderProfileTab()}
      {activeTab === "subscription" && renderSubscriptionTab()}
      {activeTab === "settings" && renderSettingsTab()}
    </div>
  )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { User, Mail, Phone, Lock, UserPlus } from "lucide-react"

// Force dynamic rendering to avoid SSR issues with browser APIs
export const dynamic = 'force-dynamic'

export default function SignUpPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [successMsg, setSuccessMsg] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState("")

  const handleSocialSignUp = (provider) => {
    setSocialLoading(provider)
    setErrorMsg("")
    if (provider === "google") {
      if (typeof window !== "undefined") {
        window.location.href = `${process.env.NEXT_PUBLIC_API_URL_AUTH}/auth/google`
      }
    }
  }

  const validateInputs = () => {
    if (!email || !password || !confirmPassword || !fullName || !phone) {
      setErrorMsg("All fields are required.")
      return false
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.")
      return false
    }
    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.")
      return false
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setErrorMsg("Invalid email format.")
      return false
    }
    const phoneRegex = /^[0-9]{10}$/
    if (!phoneRegex.test(phone)) {
      setErrorMsg("Enter a valid 10-digit phone number.")
      return false
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg("")
    setSuccessMsg("")
    setIsLoading(true)

    if (!validateInputs()) {
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL_AUTH}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: fullName,
          username: email.split("@")[0],
          phone,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Signup failed")
      }

      // ✅ Store JWT in localStorage
      localStorage.setItem("token", data.token)

      // ✅ Redirect to home page
      setTimeout(() => {
        router.push("/")
      }, 100)
    } catch (err) {
      console.error("Signup error:", err.message)
      setErrorMsg(err.message)
    }

    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-purple-950 flex items-center justify-center px-4 relative overflow-hidden py-8">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-fuchsia-600/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(168,85,247,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(168,85,247,0.03)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none z-0"></div>

      <div className="relative z-20 w-full max-w-2xl">
        {/* Main signup card */}
        <div className="backdrop-blur-xl bg-gray-900/40 border border-gray-700/50 rounded-2xl shadow-2xl p-8 relative overflow-hidden">
          {/* Card glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-transparent to-pink-500/10 rounded-2xl pointer-events-none"></div>

          {/* Header */}
          <div className="relative z-30 text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full mb-4 shadow-lg">
              <UserPlus className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
              Join Us Today
            </h2>
            <p className="text-gray-400 text-sm">Create your account and get started</p>
          </div>

          {/* Error/Success Messages */}
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-6 backdrop-blur-sm">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-red-400 text-sm">{errorMsg}</span>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 mb-6 backdrop-blur-sm">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-green-400 text-sm">{successMsg}</span>
              </div>
            </div>
          )}

          {/* Signup Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Row 1: Full Name & Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none mt-8">
                  <User className="h-5 w-5 text-gray-400 group-focus-within:text-purple-400 transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200 backdrop-blur-sm"
                  required
                />
              </div>

              <div className="relative group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none mt-8">
                  <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-purple-400 transition-colors" />
                </div>
                <input
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200 backdrop-blur-sm"
                  required
                />
              </div>
            </div>

            {/* Row 2: Phone & Password */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number</label>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none mt-8">
                  <Phone className="h-5 w-5 text-gray-400 group-focus-within:text-purple-400 transition-colors" />
                </div>
                <input
                  type="tel"
                  placeholder="Enter your phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200 backdrop-blur-sm"
                  required
                />
              </div>

              <div className="relative group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none mt-8">
                  <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-purple-400 transition-colors" />
                </div>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200 backdrop-blur-sm"
                  required
                />
              </div>
            </div>

            {/* Row 3: Confirm Password */}
            <div className="relative group">
              <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none mt-8">
                <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-purple-400 transition-colors" />
              </div>
              <input
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200 backdrop-blur-sm"
                required
              />
            </div>

            {/* Create Account button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full relative overflow-hidden bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg mt-6"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-pink-400/20 opacity-0 hover:opacity-100 transition-opacity duration-200"></div>
              <span className="relative flex items-center justify-center">
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </span>
            </button>
          </form>
        </div>

        {/* Login Link & Legal */}
        <div className="text-center mt-6">
          <p className="text-gray-400 text-sm">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-purple-400 hover:text-pink-400 font-semibold transition-all duration-300 hover:underline"
            >
              Sign in here
            </Link>
          </p>
          
          {/* Legal Links */}
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-gray-500">
            <Link href="/terms" className="hover:text-purple-400 transition-colors">
              Terms & Conditions
            </Link>
            <span>•</span>
            <Link href="/privacy" className="hover:text-purple-400 transition-colors">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link href="/cancellation-refund" className="hover:text-purple-400 transition-colors">
              Cancellation & Refund
            </Link>
          </div>
          
          {/* Agreement Text */}
          <p className="mt-3 text-xs text-gray-500 max-w-md mx-auto">
            By signing up, you agree to our Terms & Conditions and Privacy Policy. 
            Please note our strict no-refund policy.
          </p>
        </div>
      </div>
    </div>
  )
}

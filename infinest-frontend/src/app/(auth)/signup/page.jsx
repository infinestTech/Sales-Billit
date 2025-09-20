"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { User, Mail, Phone, Lock, Chrome, UserPlus } from "lucide-react"

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

      // ✅ Redirect after success (adjust route if needed)
      setTimeout(() => {
        router.push("/pricing")
      }, 100)
    } catch (err) {
      console.error("Signup error:", err.message)
      setErrorMsg(err.message)
    }

    setIsLoading(false)
  }

  return (
    <div className="relative h-screen bg-black overflow-hidden flex items-center justify-center">
      {/* Animated Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px] animate-pulse" />

      {/* Gradient Orbs */}
      <div className="absolute top-10 left-10 w-80 h-80 bg-gradient-to-r from-white/5 to-transparent rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-gradient-to-l from-white/5 to-transparent rounded-full blur-3xl animate-pulse delay-1000" />
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-56 h-56 bg-gradient-to-r from-white/3 to-transparent rounded-full blur-2xl animate-pulse delay-500" />

      <div className="relative z-10 w-full max-w-2xl px-6 h-full flex flex-col justify-center">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm mb-4">
            <UserPlus className="w-4 h-4 text-white" />
            <span className="text-white/80 text-sm font-medium">CREATE ACCOUNT</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent mb-3 leading-tight">
            Join Us Today
          </h1>
          <p className="text-white/60 text-base">Create your account and get started</p>
        </div>

        {/* Signup Form */}
        <div className="relative backdrop-blur-xl bg-gradient-to-b from-white/10 to-white/5 p-6 rounded-3xl border border-white/20 shadow-2xl shadow-white/10">
          {/* Glow Effect */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-white/5 to-transparent opacity-50" />

          <div className="relative z-10">
            {/* Error/Success Messages */}
            {errorMsg && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-2xl backdrop-blur-sm">
                <p className="text-center text-sm text-red-300">{errorMsg}</p>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-2xl backdrop-blur-sm">
                <p className="text-center text-sm text-green-300">{successMsg}</p>
              </div>
            )}

            {/* Google Signup */}
            {/* <div className="mb-6">
              <button
                onClick={() => handleSocialSignUp("google")}
                disabled={socialLoading === "google"}
                className="w-full flex items-center justify-center px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-2xl border border-white/20 hover:border-white/30 transition-all duration-300 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed backdrop-blur-sm"
              >
                {socialLoading === "google" ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3"></div>
                ) : (
                  <Chrome className="w-5 h-5 mr-3" />
                )}
                Sign up with Google
              </button>
            </div> */}
	

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-gradient-to-r from-transparent via-black to-transparent text-white/60">
                  sign up with email
                </span>
              </div>
            </div>

            {/* Signup Form - Two Column Layout */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Row 1: Full Name & Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField label="Full Name" value={fullName} onChange={setFullName} type="text" icon={User} />
                <InputField label="Email Address" value={email} onChange={setEmail} type="email" icon={Mail} />
              </div>

              {/* Row 2: Phone & Password */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField label="Phone Number" value={phone} onChange={setPhone} type="tel" icon={Phone} />
                <InputField label="Password" value={password} onChange={setPassword} type="password" icon={Lock} />
              </div>

              {/* Row 3: Confirm Password (Full Width) */}
              <div className="grid grid-cols-1">
                <InputField
                  label="Confirm Password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  type="password"
                  icon={Lock}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-white hover:bg-white/90 disabled:bg-white/50 text-black font-semibold rounded-2xl shadow-lg shadow-white/20 transition-all duration-300 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed text-base mt-6"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin mr-3"></div>
                    Creating account...
                  </div>
                ) : (
                  "Create Account"
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Login Link */}
        <div className="text-center mt-4">
          <p className="text-white/60 text-sm">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-white hover:text-white/80 font-semibold transition-all duration-300 hover:underline"
            >
              Sign in here
            </Link>
          </p>
          
          {/* Legal Links */}
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-white/50">
            <Link href="/terms" className="hover:text-white/70 transition-colors">
              Terms & Conditions
            </Link>
            <span>•</span>
            <Link href="/privacy" className="hover:text-white/70 transition-colors">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link href="/cancellation-refund" className="hover:text-white/70 transition-colors">
              Cancellation & Refund
            </Link>
          </div>
          
          {/* Agreement Text */}
          <p className="mt-3 text-xs text-white/40 max-w-md mx-auto">
            By signing up, you agree to our Terms & Conditions and Privacy Policy. 
            Please note our strict no-refund policy.
          </p>
        </div>
      </div>
    </div>
  )
}

function InputField({ label, value, onChange, type, icon: Icon }) {
  const [isFocused, setIsFocused] = useState(false)

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-white/80">{label}</label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Icon className="h-5 w-5 text-white/40" />
        </div>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={`Enter your ${label.toLowerCase()}`}
          className={`
            w-full pl-12 pr-4 py-3 rounded-2xl bg-white/5 border text-white placeholder-white/40 
            focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30 
            transition-all duration-300 backdrop-blur-sm
            ${isFocused ? "border-white/30 bg-white/10 shadow-lg shadow-white/5" : "border-white/10"}
          `}
          required
        />
      </div>
    </div>
  )
}

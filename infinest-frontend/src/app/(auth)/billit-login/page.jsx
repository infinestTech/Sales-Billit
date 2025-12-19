"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link";
import { jwtDecode } from "jwt-decode";


function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // ✅ Check for session expiration message
  useEffect(() => {
    const expired = searchParams.get('expired')
    const reason = searchParams.get('reason')
    
    if (expired === 'true' && reason) {
      setError(decodeURIComponent(reason))
    }
  }, [searchParams])

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/billit-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Custom error handling for user not found
        if (data.message && (data.message.toLowerCase().includes("user not found") || data.message.toLowerCase().includes("no user"))) {
          setError("Please sign up first to continue.");
        } else if (data.message && (data.message.toLowerCase().includes("invalid credentials") || data.message.toLowerCase().includes("wrong password"))) {
          setError("Incorrect email or password.");
        } else {
          setError("Login failed. Please check your credentials or sign up first.");
        }
        setIsLoading(false);
        return;
      }

      localStorage.setItem("token", data.token);

      const token = data.token || localStorage.getItem("token");
      let shopId = null;

      if (token) {
        const decoded = jwtDecode(token);
        shopId = decoded?.shop_id;
      }

      if (!shopId) {
        console.error("shop_id missing, cannot save notification.");
      } else {
        // ✅ Add notification to DB
        await fetch(`${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/notifications/add`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            shop_id: shopId,
            type: "success",
            message: "Login successful, welcome to Fixel 👋",
          }),
        });
      }

      // ✅ Trigger global toast + refresh inbox
      window.dispatchEvent(new CustomEvent("show-notification-toast", {
        detail: {
          message: "Login successful, welcome to Fixel 👋",
          type: "success",
        }
      }));

      // ✅ Navigate after short delay for consistency
      setTimeout(() => {
        router.replace("/");
      }, 1000);
    } catch (err) {
      console.error("Login Error:", err);
      setError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };


  const handleGoogleLogin = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/auth/google`
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-indigo-950 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>


      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none z-0"></div>






      <div className="relative z-20 w-full max-w-md">
        {/* Main login card */}
        <div className="backdrop-blur-xl bg-gray-900/40 border border-gray-700/50 rounded-2xl shadow-2xl p-8 relative overflow-hidden">
          {/* Card glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-transparent to-indigo-500/10 rounded-2xl pointer-events-none"></div>


          {/* Header */}
          <div className="relative z-30 text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full mb-4 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent mb-2">
              Welcome Back
            </h2>
            <p className="text-gray-400 text-sm">Sign in to your Fixel account</p>
          </div>


          {/* Error message */}
          {error && (
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
                <span className="text-red-400 text-sm">{error}</span>
              </div>
            </div>
          )}


          {/* Login form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              {/* Email input */}
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400 group-focus-within:text-blue-400 transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                    />
                  </svg>
                </div>
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 backdrop-blur-sm"
                  required
                />
              </div>


              {/* Password input */}
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400 group-focus-within:text-blue-400 transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 backdrop-blur-sm"
                  required
                />
              </div>
            </div>


            {/* Sign in button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-indigo-400/20 opacity-0 hover:opacity-100 transition-opacity duration-200"></div>
              <span className="relative flex items-center justify-center">
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Signing In...
                  </>
                ) : (
                  "Sign In"
                )}
              </span>
            </button>
          </form>


          {/* Divider */}
          <div className="my-6 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600/50"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-gray-900/40 text-gray-400 backdrop-blur-sm">OR</span>
            </div>
          </div>


          {/* Google login button */}
          {/* <button
            onClick={handleGoogleLogin}
            className="w-full relative overflow-hidden bg-gray-800/50 hover:bg-gray-700/50 border border-gray-600/50 hover:border-gray-500/50 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-gray-500/50 backdrop-blur-sm shadow-lg group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-gray-400/10 to-gray-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
            <span className="relative flex items-center justify-center">
              <img src="https://www.svgrepo.com/show/355037/google.svg" alt="Google" className="w-5 h-5 mr-3" />
              Continue with Google
            </span>
          </button> */}


          {/* Footer links */}
          <div className="mt-6 text-center relative z-30">
            <p className="text-gray-400 text-sm">
              Don&apos;t have an account?{" "}
              <Link 
                href="/signup" 
                className="text-blue-400 hover:text-blue-300 transition-colors font-medium relative z-50 cursor-pointer inline-block underline-offset-2 hover:underline"
                style={{ pointerEvents: 'auto' }}
              >
                Sign up
              </Link>
            </p>
            
            {/* Legal Links */}
            <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-gray-500">
              <Link 
                href="/terms" 
                className="hover:text-gray-300 transition-colors relative z-50 cursor-pointer inline-block hover:underline"
                style={{ pointerEvents: 'auto' }}
              >
                Terms & Conditions
              </Link>
              <span>•</span>
              <Link 
                href="/privacy" 
                className="hover:text-gray-300 transition-colors relative z-50 cursor-pointer inline-block hover:underline"
                style={{ pointerEvents: 'auto' }}
              >
                Privacy Policy
              </Link>
              <span>•</span>
              <Link 
                href="/cancellation-refund" 
                className="hover:text-gray-300 transition-colors relative z-50 cursor-pointer inline-block hover:underline"
                style={{ pointerEvents: 'auto' }}
              >
                Cancellation & Refund
              </Link>
            </div>
          </div>
        </div>


        {/* Bottom accent */}
        <div className="mt-4 text-center">
          <div className="inline-flex items-center text-gray-500 text-xs">
            <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></div>
            Secured by Fixel
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-indigo-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  )
}

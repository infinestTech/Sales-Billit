'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // Wait for component to mount before accessing window
    const timer = setTimeout(() => {
      try {
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          const token = urlParams.get("token");
          const error = urlParams.get("error");
          const redirectTo = urlParams.get("redirect") || "/";

          console.log('Callback params:', { token: !!token, error, redirectTo }); // Debug log

          if (error) {
            console.error("Login failed:", error);
            router.replace(`/login?error=${encodeURIComponent(error)}`);
            return;
          }

          if (!token) {
            console.error("Token missing in callback.");
            router.replace("/login?error=auth_failed");
            return;
          }

          // Store JWT token in localStorage
          localStorage.setItem("token", token);
          console.log("Token stored successfully");

          // Redirect to target page or home
          router.replace(redirectTo);
        }
      } catch (err) {
        console.error("Error in callback:", err);
        router.replace("/login?error=callback_error");
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-black transition-all duration-500">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h2 className="text-2xl font-bold text-white mb-2">Completing Sign In</h2>
        <p className="text-gray-300">Please wait while we redirect you...</p>
      </div>
    </div>
  );
}
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProfilePage from '@/components/Profile/ProfilePage';
import { jwtDecode } from 'jwt-decode';

export default function AllRecordPage() {
  const [shopId, setShopId] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      // If mobile, redirect to main page - mobile profile is handled in MobileLayout
      if (mobile) {
        router.push('/');
        return;
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, [router]);

  useEffect(() => {
    // Skip token check if mobile (will redirect anyway)
    if (isMobile) return;
    
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        if (decoded?.shop_id) {
          setShopId(decoded.shop_id);
        } else {
          console.warn("No shop_id in token");
          window.location.href = "/billit-login";
        }
      } catch (err) {
        console.error("Token decode failed:", err);
        localStorage.removeItem("token");
        window.location.href = "/billit-login";
      }
    } else {
      window.location.href = "/billit-login";
    }
  }, [isMobile]);

  // Don't render anything for mobile users (they get redirected)
  if (isMobile) {
    return null;
  }




  return (
    <div>
      {shopId ? (
        <ProfilePage shopId={shopId} />
      ) : (
        <p className="text-center text-gray-500">Loading...</p>
      )}
    </div>
  );
}













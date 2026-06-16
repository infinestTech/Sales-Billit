'use client';




import { useEffect, useState } from 'react';
import ProfileSubscriptionPage from '@/components/Profile/ProfileSubscriptionPage';
import { jwtDecode } from 'jwt-decode';




export default function AllRecordPage() {
  const [shopId, setShopId] = useState(null);




  useEffect(() => {
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
  }, []);




  return (
    <div>
      {shopId ? (
        <ProfileSubscriptionPage shopId={shopId} />
      ) : (
        <p className="text-center text-gray-500">Loading...</p>
      )}
    </div>
  );
}
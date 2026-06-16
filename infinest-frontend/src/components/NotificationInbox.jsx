"use client";


import { useEffect, useState } from "react";
import { FaBell, FaTimes, FaTrash } from "react-icons/fa";
import { logSystem } from "@/utils/logger";


export default function NotificationInbox({ shopId, token }) {
  const [notifications, setNotifications] = useState([]);
  const [showInbox, setShowInbox] = useState(false);
  const [loading, setLoading] = useState(false);


  const fetchNotifications = async () => {
    if (!shopId || !token) {
      console.warn("Shop ID or token missing for NotificationInbox fetch.");
      return;
    }


    try {
      setLoading(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/notifications?shop_id=${shopId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications);
      } else {
        logSystem("Fetch notifications failed", "ERROR", data.error);
      }
    } catch (err) {
      logSystem("Error fetching notifications", "ERROR", err);
    } finally {
      setLoading(false);
    }
  };

  // Listen for refresh notifications event
  useEffect(() => {
    const handleRefresh = () => {
      fetchNotifications();
    };

    window.addEventListener("refresh-notifications", handleRefresh);
    return () => window.removeEventListener("refresh-notifications", handleRefresh);
  }, [shopId, token]);


  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [shopId, token]);


  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/notifications/delete`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notification_id: id }),
      });
      const data = await res.json();
      if (data.success) {
        setNotifications((prev) => prev.filter((n) => n._id !== id));
      } else {
        logSystem("Delete notification failed", "ERROR", data.error);
      }
    } catch (err) {
      logSystem("Error deleting notification", "ERROR", err);
    }
  };


  const handleClearAll = async () => {
    // Show confirmation via notification instead of browser confirm
    const shouldClear = window.confirm("Are you sure you want to clear all notifications?");
    if (!shouldClear) return;
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL_BILLIT}/api/notifications/clear`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ shop_id: shopId }),
      });      const data = await res.json();
      if (data.success) {
        setNotifications([]);
        // Trigger refresh event for any listeners
        window.dispatchEvent(new Event("refresh-notifications"));
      } else {
        logSystem("Clear all notifications failed", "ERROR", data.error);
      }
    } catch (err) {
      logSystem("Error clearing notifications", "ERROR", err);
    }
  };

  return (
    <>
      {/* Floating Bell */}
      <div
        className="fixed bottom-6 right-6 z-50 bg-blue-600 text-white rounded-full p-4 shadow-lg cursor-pointer hover:bg-blue-500 transition-all duration-300"
        onClick={() => setShowInbox(!showInbox)}
      >
        <FaBell className="h-6 w-6" />
        {notifications.length > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 rounded-full h-5 w-5 text-xs flex items-center justify-center animate-pulse">
            {notifications.length}
          </span>
        )}
      </div>


      {/* Inbox Panel */}
      {showInbox && (
        <div className="fixed bottom-20 right-6 z-50 bg-white w-80 max-h-96 shadow-2xl rounded-xl overflow-hidden border border-gray-300 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-blue-600 text-white">
            <h3 className="font-semibold">Inbox</h3>
            <div className="flex items-center space-x-2">
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs bg-red-500 hover:bg-red-600 px-2 py-1 rounded"
                >
                  Clear All
                </button>
              )}
              <FaTimes
                className="cursor-pointer"
                onClick={() => setShowInbox(false)}
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {loading && (
              <div className="p-4 text-center text-gray-500">Loading...</div>
            )}
            {!loading && notifications.length === 0 && (
              <div className="p-4 text-center text-gray-500">No notifications</div>
            )}
            {notifications.map((notification) => (
              <div
                key={notification._id}
                className={`p-3 border-b flex items-center justify-between ${
                  notification.type === "success"
                    ? "bg-green-50 text-green-800"
                    : notification.type === "error"
                    ? "bg-red-50 text-red-800"
                    : notification.type === "warning"
                    ? "bg-purple-50 text-purple-800"
                    : "bg-blue-50 text-blue-800"
                }`}
              >
                <span className="text-sm">{notification.message}</span>
                <button onClick={() => handleDelete(notification._id)} aria-label="Delete">
                  <FaTrash className="text-gray-500 hover:text-gray-700 w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}





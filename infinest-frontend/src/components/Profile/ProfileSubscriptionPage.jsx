"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CreditCard, ArrowLeft, Calendar, Package, CheckCircle, XCircle, Clock } from "lucide-react"
import authApi from "../authApi"

export default function ProfileSubscriptionPage({ shopId }) {
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    
    const fetchSubscriptions = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.warn('You are not logged in');
          window.location.href = '/billit-login';
          return;
        }


        const res = await authApi.get('/profile/subscription/get', {
          headers: { Authorization: `Bearer ${token}` },
          params: { shopId },
        });


        const fetchedSubscriptions = res.data;
        setSubscriptions(fetchedSubscriptions);


        const now = new Date();
        const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);


        const hasRecentlyExpired = fetchedSubscriptions.some(sub => {
          const endDate = new Date(sub.endDate);
          return endDate < now && endDate >= fiveDaysAgo;
        });


        if (hasRecentlyExpired) {
          const todayKey = `expired-sub-notif-${now.toISOString().slice(0, 10)}`;
          const shownCount = parseInt(localStorage.getItem(todayKey) || '0', 10);


          if (shownCount < 2) {
            // ✅ Show toast
            window.dispatchEvent(new CustomEvent("show-notification-toast", {
              detail: {
                message: "Your subscription expired recently, please renew to continue using Billit.",
                type: "warning",
              },
            }));


            // ✅ Add to inbox
            await authApi.post('/notifications/add', {
              shop_id: shopId,
              type: "warning",
              message: "Your subscription expired recently, please renew to continue using Billit.",
            }, {
              headers: { Authorization: `Bearer ${token}` },
            });


            // ✅ Refresh inbox immediately
            window.dispatchEvent(new Event("refresh-notifications"));


            // ✅ Increment count for the day
            localStorage.setItem(todayKey, (shownCount + 1).toString());
          }
        }


      } catch (err) {
        console.error('❌ Failed to fetch subscriptions:', err.response?.data || err.message);
        console.warn('❌ Failed to fetch subscriptions');
      } finally {
        setLoading(false);
      }
    };


    if (shopId) {
      fetchSubscriptions();
    }
  }, [shopId]);


  const getStatusIcon = (status) => {
    switch (status) {
      case "ACTIVE":
        return <CheckCircle className="w-4 h-4" />
      case "CANCELLED":
      case "EXPIRED":
        return <XCircle className="w-4 h-4" />
      case "QUEUED":
        return <Clock className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800 border-green-200"
      case "CANCELLED":
      case "EXPIRED":
        return "bg-gray-100 text-gray-800 border-gray-200"
      case "QUEUED":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      default:
        return "bg-blue-100 text-blue-800 border-blue-200"
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-8">
          <div className="container mx-auto px-6">
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 p-3 rounded-xl">
                <CreditCard className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Subscriptions</h1>
                <p className="text-blue-100">Manage your subscription plans</p>
              </div>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading subscriptions...</p>
            </div>
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
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 p-3 rounded-xl">
                <CreditCard className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Subscriptions</h1>
                <p className="text-blue-100">Manage your subscription plans</p>
              </div>
            </div>
            <button
              onClick={() => router.back()}
              className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Profile</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {subscriptions.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Package className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Subscriptions Found</h3>
              <p className="text-gray-600 mb-6">You don't have any active subscriptions yet.</p>
              <button
                onClick={() => router.back()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
              >
                Back to Profile
              </button>
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center space-x-4">
                    <div className="bg-green-100 p-3 rounded-xl">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Active</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {subscriptions.filter((sub) => sub.status === "ACTIVE").length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center space-x-4">
                    <div className="bg-yellow-100 p-3 rounded-xl">
                      <Clock className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Pending</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {subscriptions.filter((sub) => sub.status === "QUEUED").length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center space-x-4">
                    <div className="bg-gray-100 p-3 rounded-xl">
                      <XCircle className="w-6 h-6 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Cancelled</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {subscriptions.filter((sub) => {
                          // Count both CANCELLED and EXPIRED subscriptions as cancelled
                          if (sub.status === "CANCELLED" || sub.status === "EXPIRED") {
                            return true;
                          }
                          // Also count subscriptions that have ended (past end date) as cancelled
                          const endDate = new Date(sub.endDate);
                          const now = new Date();
                          return endDate < now && sub.status !== "ACTIVE";
                        }).length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Subscriptions Table */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Subscription Details</h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          S.No
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center space-x-2">
                            <Package className="w-4 h-4" />
                            <span>Product</span>
                          </div>
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4" />
                            <span>Start Date</span>
                          </div>
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4" />
                            <span>End Date</span>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {subscriptions.map((sub, index) => (
                        <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{index + 1}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{sub.product}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(sub.status)}`}
                            >
                              {getStatusIcon(sub.status)}
                              <span>{sub.status}</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(sub.startDate).toLocaleDateString("en-IN")}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(sub.endDate).toLocaleDateString("en-IN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

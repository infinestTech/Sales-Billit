"use client";
import { useEffect, useState } from "react";
import api from "@/components/api";


export default function Dashboard({ shopId }) {
  const [data, setData] = useState(null);


  useEffect(() => {
    const fetchDashboardData = async () => {
      const token = localStorage.getItem("token");
      const res = await api.post("/api/dashboard/summary", { shop_id: shopId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    };


    if (shopId) fetchDashboardData();
  }, [shopId]);


  if (!data) return <p>Loading...</p>;


  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Dashboard Overview</h1>
      <p><b>Today Revenue:</b> ₹{data.todayRevenue}</p>
      <p><b>Today Expense:</b> ₹{data.todayExpenseAmount}</p>
      <p><b>Total Mobiles:</b> {data.mobiles.length}</p>
      <p><b>Total Customers:</b> {data.customers.length}</p>
      <p><b>Total Dealers:</b> {data.dealers.length}</p>


      {/* Later you can add charts */}
    </div>
  );
}





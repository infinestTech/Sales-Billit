"use client"


import { useEffect, useState } from "react"
import api from "../../components/api"
import { Plus, Calendar, Receipt, TrendingUp, TrendingDown, DollarSign, Clock, Hash, Smartphone, Package, Coins } from "lucide-react"


const TodayExpenses = ({ shopId }) => {
  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [expenses, setExpenses] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  const [totalExpense, setTotalExpense] = useState(0)
  const [dailyRevenue, setDailyRevenue] = useState(0)
  const [serviceRevenue, setServiceRevenue] = useState(0)
  const [stockRevenue, setStockRevenue] = useState(0)
  const [isLoading, setIsLoading] = useState(false)


  const fetchExpenses = async (date = selectedDate) => {
    try {
      const token = localStorage.getItem("token")
      const res = await api.post(
        "/api/expenses/today",
        { shop_id: shopId, date },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      setExpenses(res.data.expenses || [])
      setTotalExpense(res.data.totalAmount || 0)
    } catch (err) {
      console.error("Failed to fetch expenses", err)
    }
  }


  const fetchDailyRevenue = async (date = selectedDate) => {
    try {
      const token = localStorage.getItem("token")
      const res = await api.post(
        "/api/daily-summary",
        { shop_id: shopId, date },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      setDailyRevenue(res.data.totalRevenue || 0)
      setServiceRevenue(res.data.serviceRevenue || 0)
      setStockRevenue(res.data.stockRevenue || 0)
    } catch (err) {
      console.error("Failed to fetch daily revenue", err)
    }
  }


  const handleAdd = async () => {
    if (!shopId || !title.trim() || !amount) {
      console.warn("Please fill all fields.");
      return
    }


    try {
      setIsLoading(true)
      const token = localStorage.getItem("token")
     
      // Create a proper date object with current time for the selected date
      const now = new Date()
      let expenseDate
     
      if (selectedDate === new Date().toISOString().split("T")[0]) {
        // If it's today, use the current time
        expenseDate = now
      } else {
        // If it's a different date, use the selected date with current time
        const [year, month, day] = selectedDate.split('-')
        expenseDate = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds())
      }
     
      await api.post(
        "/api/expenses/add",
        {
          shop_id: shopId,
          title,
          amount: Number.parseInt(amount, 10),
          paymentMethod,
          createdAt: expenseDate.toISOString(),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      )
      setTitle("")
      setAmount("")
      setPaymentMethod("cash")
      fetchExpenses()
      fetchDailyRevenue()
    } catch (err) {
      console.error("Failed to add expense", err)
    } finally {
      setIsLoading(false)
    }
  }


  useEffect(() => {
    fetchExpenses()
    fetchDailyRevenue()
  }, [selectedDate])


  const netRevenue = dailyRevenue - totalExpense


  return (
    <div className="h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-white/20 rounded-xl">
            <Receipt className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Daily Expenses</h2>
            <p className="text-blue-100">Track your daily expenses and revenue</p>
          </div>
        </div>
      </div>


      {/* Add Expense Form */}
      <div className="px-8 py-6 bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-200 flex-shrink-0">
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <Plus className="h-5 w-5 mr-2 text-blue-600" />
            Add New Expense
          </h3>


          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Title Input */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center">
                <Receipt className="h-4 w-4 mr-2 text-blue-600" />
                Expense Title
              </label>
              <input
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                placeholder="Enter expense title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>


            {/* Amount Input */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center">
                <DollarSign className="h-4 w-4 mr-2 text-green-600" />
                Amount
              </label>
              <input
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                placeholder="₹0"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>


            {/* Payment Method */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center">
                <DollarSign className="h-4 w-4 mr-2 text-emerald-600" />
                Payment Method
              </label>
              <select
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                title="Choose payment method"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
              </select>
            </div>


            {/* Date Input */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-indigo-600" />
                Date
              </label>
              <input
                type="date"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                title="Select date for entry (Default: Today)"
              />
            </div>


            {/* Add Button */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 opacity-0">Action</label>
              <button
                onClick={handleAdd}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
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
                    <span>Adding...</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5" />
                    <span>Add Expense</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>


      {/* Summary Cards */}
      <div className="px-8 py-6 bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-200 flex-shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Service Revenue Card */}
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-600 mb-1">Service Revenue</p>
                <p className="text-2xl font-bold text-indigo-700">₹{serviceRevenue.toLocaleString("en-IN")}</p>
              </div>
              <div className="p-3 bg-indigo-100 rounded-xl">
                <Smartphone className="h-8 w-8 text-indigo-600" />
              </div>
            </div>
          </div>


          {/* Stock Revenue Card */}
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-600 mb-1">Stock Revenue</p>
                <p className="text-2xl font-bold text-purple-700">₹{stockRevenue.toLocaleString("en-IN")}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl">
                <Package className="h-8 w-8 text-purple-600" />
              </div>
            </div>
          </div>


          {/* Total Revenue Card */}
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-600 mb-1">Total Revenue</p>
                <p className="text-2xl font-bold text-blue-700">₹{dailyRevenue.toLocaleString("en-IN")}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <TrendingUp className="h-8 w-8 text-blue-600" />
              </div>
            </div>
          </div>


          {/* Total Expense Card */}
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-600 mb-1">Total Expense</p>
                <p className="text-2xl font-bold text-red-700">₹{totalExpense.toLocaleString("en-IN")}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-xl">
                <TrendingDown className="h-8 w-8 text-red-600" />
              </div>
            </div>
          </div>


          {/* Net Revenue Card */}
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-600 mb-1">Net Revenue</p>
                <p className={`text-2xl font-bold ${netRevenue >= 0 ? "text-green-700" : "text-red-700"}`}>
                  ₹{netRevenue.toLocaleString("en-IN")}
                </p>
              </div>
              <div className={`p-3 rounded-xl ${netRevenue >= 0 ? "bg-green-100" : "bg-red-100"}`}>
                <DollarSign className={`h-8 w-8 ${netRevenue >= 0 ? "text-green-600" : "text-red-600"}`} />
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Expenses Table */}
      <div className="flex-1 px-8 py-6 overflow-auto bg-white">
        <div className="bg-white border border-gray-200 overflow-hidden shadow-lg rounded-xl">
          {expenses.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full mb-6">
                <Receipt className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No Expenses Found</h3>
              <p className="text-gray-600">No expenses recorded for the selected date.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gradient-to-r from-gray-100 to-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                      <div className="flex items-center">
                        <Hash className="h-4 w-4 mr-2 text-blue-600" />
                        S.No
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                      <div className="flex items-center">
                        <Receipt className="h-4 w-4 mr-2 text-indigo-600" />
                        Title
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-2 text-green-600" />
                        Amount
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                      <div className="flex items-center">
                        <Coins className="h-4 w-4 mr-2 text-orange-600" />
                        Payment Method
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-orange-600" />
                        Time
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp, i) => (
                    <tr
                      key={exp.id || i}
                      className={`hover:bg-blue-50 transition-colors duration-200 ${
                        i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                      }`}
                    >
                      <td className="px-6 py-4 border-b border-gray-200">
                        <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-6 py-4 border-b border-gray-200">
                        <div className="font-semibold text-gray-800">{exp.title}</div>
                      </td>
                      <td className="px-6 py-4 border-b border-gray-200">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800">
                          ₹{exp.amount}
                        </span>
                      </td>
                       <td className="px-6 py-4 border-b border-gray-200">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800">
                          {exp.paymentMethod}
                        </span>
                      </td>
                      <td className="px-6 py-4 border-b border-gray-200">
                        <span className="text-sm text-gray-600 font-medium">
                          {new Date(exp.createdAt).toLocaleTimeString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            hour12: true,
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


export default TodayExpenses





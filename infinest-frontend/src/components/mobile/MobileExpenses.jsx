"use client"

import { useState, useEffect } from "react"
import api from "../api"
import { 
  Plus, 
  Search, 
  Calendar, 
  DollarSign,
  Save,
  X,
  Clock
} from "lucide-react"
import { getLocalDateString } from "@/lib/utils"

export default function MobileExpenses({ shopId }) {
  const [expenses, setExpenses] = useState([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(false)
  
  // Date filter states (similar to analytics)
  const [dateFilters, setDateFilters] = useState({
    fromDate: getLocalDateString(),
    toDate: getLocalDateString(),
    specificDate: getLocalDateString()
  })
  const [filterType, setFilterType] = useState("today") // today, range, specific
  
  const [newExpense, setNewExpense] = useState({
    title: "",
    amount: "",
    date: getLocalDateString()
  })

  // Remove categories since desktop version doesn't have them
  // const categories = [...]

  // Sample data - replace with API call
  const sampleExpenses = [
    {
      id: 1,
      description: "Office rent",
      amount: 5000,
      category: "Utilities",
      date: "2024-12-15",
      createdAt: "2024-12-15T10:00:00Z"
    },
    {
      id: 2,
      description: "Marketing campaign",
      amount: 2500,
      category: "Marketing",
      date: "2024-12-14",
      createdAt: "2024-12-14T14:30:00Z"
    },
    {
      id: 3,
      description: "Software subscription",
      amount: 99,
      category: "Software",
      date: "2024-12-13",
      createdAt: "2024-12-13T09:15:00Z"
    }
  ]

  useEffect(() => {
    fetchExpenses()
  }, [shopId, dateFilters, filterType])

  const getDateParams = () => {
    switch (filterType) {
      case "today":
        return { date: getLocalDateString() }
      case "specific":
        return { date: dateFilters.specificDate }
      case "range":
        return { 
          fromDate: dateFilters.fromDate, 
          toDate: dateFilters.toDate 
        }
      default:
        return { date: getLocalDateString() }
    }
  }

  const fetchExpenses = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      const dateParams = getDateParams()
      
      if (filterType === "range") {
        // For date range, we'll need to fetch expenses for each day and combine
        const startDate = new Date(dateFilters.fromDate)
        const endDate = new Date(dateFilters.toDate)
        const allExpenses = []
        
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const dateStr = getLocalDateString(d)
          try {
            const response = await api.post(
              "/api/expenses/today",
              { shop_id: shopId, date: dateStr },
              { headers: { Authorization: `Bearer ${token}` } }
            )
            if (response.data.expenses) {
              allExpenses.push(...response.data.expenses)
            }
          } catch (error) {
            console.error(`Error fetching expenses for ${dateStr}:`, error)
          }
        }
        setExpenses(allExpenses)
      } else {
        // For single date (today or specific)
        const response = await api.post(
          "/api/expenses/today",
          { shop_id: shopId, date: dateParams.date },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        setExpenses(response.data.expenses || [])
      }
      
      setLoading(false)
    } catch (error) {
      console.error("Error fetching expenses:", error)
      setExpenses([])
      setLoading(false)
    }
  }

  const handleAddExpense = async () => {
    if (!newExpense.title || !newExpense.amount) {
      alert("Please fill in all required fields")
      return
    }

    try {
      setLoading(true)
      const token = localStorage.getItem("token")
      
      // Use the date from the current filter type for adding expense
      let expenseDate
      if (filterType === "today") {
        expenseDate = new Date().toISOString()
      } else if (filterType === "specific") {
        expenseDate = new Date(dateFilters.specificDate).toISOString()
      } else {
        // For range, use the fromDate
        expenseDate = new Date(dateFilters.fromDate).toISOString()
      }
      
      await api.post(
        "/api/expenses/add",
        {
          shop_id: shopId,
          title: newExpense.title,
          amount: parseInt(newExpense.amount, 10),
          createdAt: expenseDate,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      
      setNewExpense({
        title: "",
        amount: "",
        date: getLocalDateString()
      })
      setIsAddModalOpen(false)
      fetchExpenses()
      setLoading(false)
    } catch (error) {
      console.error("Error adding expense:", error)
      setLoading(false)
    }
  }

  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = expense.title.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0)

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-600">Track and manage your business expenses</p>
          {/* Show current date context for adding expenses */}
          <div className="mt-2 flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <p className="text-sm text-blue-600 font-medium">
              Adding expenses for: {
                filterType === "today" 
                  ? "Today" 
                  : filterType === "specific" 
                    ? new Date(dateFilters.specificDate).toLocaleDateString()
                    : `${new Date(dateFilters.fromDate).toLocaleDateString()}`
              }
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-6 rounded-xl shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-red-100 text-sm">Total Expenses</p>
            <p className="text-3xl font-bold">₹{totalExpenses.toLocaleString()}</p>
            <p className="text-red-100 text-sm">
              {filteredExpenses.length} transactions
              {filterType === "range" && (
                <span className="block">
                  {new Date(dateFilters.fromDate).toLocaleDateString()} - {new Date(dateFilters.toDate).toLocaleDateString()}
                </span>
              )}
              {filterType === "specific" && (
                <span className="block">
                  on {new Date(dateFilters.specificDate).toLocaleDateString()}
                </span>
              )}
              {filterType === "today" && (
                <span className="block">for today</span>
              )}
            </p>
          </div>
          <Clock className="w-12 h-12 text-red-200" />
        </div>
      </div>

      {/* Date Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Date Filter</h3>
        
        {/* Filter Type Selection */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { id: "today", label: "Today", icon: Calendar },
            { id: "specific", label: "Specific Date", icon: Calendar },
            { id: "range", label: "Date Range", icon: Calendar }
          ].map(type => {
            const Icon = type.icon
            return (
              <button
                key={type.id}
                onClick={() => setFilterType(type.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterType === type.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{type.label}</span>
              </button>
            )
          })}
        </div>

        {/* Date Inputs */}
        {filterType === "specific" && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Date
              </label>
              <input
                type="date"
                value={dateFilters.specificDate}
                onChange={(e) => setDateFilters(prev => ({ ...prev, specificDate: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

        {filterType === "range" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From Date
              </label>
              <input
                type="date"
                value={dateFilters.fromDate}
                onChange={(e) => setDateFilters(prev => ({ ...prev, fromDate: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To Date
              </label>
              <input
                type="date"
                value={dateFilters.toDate}
                onChange={(e) => setDateFilters(prev => ({ ...prev, toDate: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

        {filterType === "today" && (
          <div className="text-center py-3">
            <p className="text-gray-600">Showing expenses for today</p>
            <p className="text-sm text-gray-500">{new Date().toLocaleDateString()}</p>
          </div>
        )}
      </div>

      {/* Search Filter */}
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search expenses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Expenses List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading expenses...</p>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No expenses found</p>
            <p className="text-gray-400 text-sm">Add your first expense to get started</p>
          </div>
        ) : (
          filteredExpenses.map((expense) => (
            <div key={expense._id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 mb-2">{expense.title}</h3>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(expense.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {new Date(expense.createdAt).toLocaleTimeString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        hour12: true,
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800">
                    ₹{expense.amount}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Expense Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Add Expense</h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={newExpense.title}
                  onChange={(e) => setNewExpense({ ...newExpense, title: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter expense title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount *
                </label>
                <input
                  type="number"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter amount"
                />
              </div>

              {/* Date Display */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      Expense will be added for:
                    </p>
                    <p className="text-lg font-semibold text-blue-800">
                      {filterType === "today" 
                        ? `Today (${new Date().toLocaleDateString()})`
                        : filterType === "specific" 
                          ? new Date(dateFilters.specificDate).toLocaleDateString()
                          : new Date(dateFilters.fromDate).toLocaleDateString()
                      }
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleAddExpense}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                {loading ? "Adding..." : "Add Expense"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

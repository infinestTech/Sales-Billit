"use client";
import { useEffect, useState } from "react";
import { Plus, Calendar, Receipt, DollarSign, Clock, Hash, Coins, Edit2, Trash2, Save, Settings2 } from "lucide-react";
import shopAdminApi from "../shopAdminApi";
import { Btn, Field, Input, Select, Modal, Toast, useToast } from "./_ui";
import { PAYMENT_METHOD_OPTIONS, DEFAULT_PAYMENT_METHOD, formatPaymentMethodLabel } from "@/constants/paymentMethods";
import { getLocalDateString } from "@/lib/utils";

const METHOD_OPTIONS = PAYMENT_METHOD_OPTIONS.filter((o) => o.value);
const inputCls = "w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white text-gray-900 placeholder-gray-400";

// Shop-admin copy of the user-portal "Daily Expenses" page (TodayExpensesTable/TodayExpenses.jsx),
// backed by the shop-admin /expenses endpoints, with edit/delete for the admin.
export default function ExpensesPanel({ currentShopId }) {
  const { toast, show, clear } = useToast();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(DEFAULT_PAYMENT_METHOD);
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchExpenses = async (date = selectedDate) => {
    setLoading(true);
    try {
      const r = await shopAdminApi.listExpenses({ date });
      setExpenses(r.expenses || []);
      setTotal(r.total || 0);
    } catch (e) {
      show("Failed to load expenses", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (currentShopId) fetchExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentShopId, selectedDate]);

  const handleAdd = async () => {
    if (!title.trim() || !amount || Number(amount) <= 0) {
      show("Enter an expense title and amount", "error");
      return;
    }
    setIsAdding(true);
    try {
      // Today keeps the current time; other dates use the selected day with the current time of day
      const now = new Date();
      let expenseDate = now;
      if (selectedDate !== getLocalDateString()) {
        const [year, month, day] = selectedDate.split("-");
        expenseDate = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());
      }
      await shopAdminApi.createExpense({
        title: title.trim(),
        amount: Number(amount),
        paymentMethod,
        createdAt: expenseDate.toISOString(),
      });
      setTitle("");
      setAmount("");
      setPaymentMethod(DEFAULT_PAYMENT_METHOD);
      show("Expense added");
      fetchExpenses();
    } catch (e) {
      show(e?.response?.data?.message || "Failed to add expense", "error");
    }
    setIsAdding(false);
  };

  const openEdit = (e) => setEditing({ _id: e._id, title: e.title, amount: e.amount, paymentMethod: e.paymentMethod || DEFAULT_PAYMENT_METHOD });

  const saveEdit = async () => {
    if (!editing.title.trim() || !editing.amount || Number(editing.amount) <= 0) {
      show("Title and amount required", "error");
      return;
    }
    setSaving(true);
    try {
      await shopAdminApi.updateExpense(editing._id, {
        title: editing.title.trim(),
        amount: Number(editing.amount),
        paymentMethod: editing.paymentMethod,
      });
      show("Expense updated");
      setEditing(null);
      fetchExpenses();
    } catch (e) {
      show(e?.response?.data?.message || "Failed to update expense", "error");
    }
    setSaving(false);
  };

  const remove = async (id) => {
    if (!confirm("Delete this expense?")) return;
    try {
      await shopAdminApi.deleteExpense(id);
      show("Expense deleted");
      fetchExpenses();
    } catch (e) {
      show("Failed to delete expense", "error");
    }
  };

  // Legacy rows may store lowercase / UPI values; keep them selectable when editing
  const editOptions = editing && !METHOD_OPTIONS.some((o) => o.value === editing.paymentMethod)
    ? [{ value: editing.paymentMethod, label: formatPaymentMethodLabel(editing.paymentMethod) }, ...METHOD_OPTIONS]
    : METHOD_OPTIONS;

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 sm:px-8 py-6">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-white/20 rounded-xl">
            <Receipt className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Daily Expenses</h2>
            <p className="text-blue-100">Track your daily service expenses</p>
          </div>
        </div>
      </div>

      {/* Add Expense Form */}
      <div className="px-4 sm:px-8 py-6 bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-200">
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <Plus className="h-5 w-5 mr-2 text-blue-600" />
            Add New Expense
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center">
                <Receipt className="h-4 w-4 mr-2 text-blue-600" />
                Expense Title
              </label>
              <input
                className={`${inputCls} focus:ring-blue-500`}
                placeholder="Enter expense title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center">
                <DollarSign className="h-4 w-4 mr-2 text-green-600" />
                Amount
              </label>
              <input
                className={`${inputCls} focus:ring-green-500`}
                placeholder="₹0"
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center">
                <DollarSign className="h-4 w-4 mr-2 text-emerald-600" />
                Payment Method
              </label>
              <select
                className={`${inputCls} focus:ring-emerald-500`}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                title="Choose payment method"
              >
                {METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-indigo-600" />
                Date
              </label>
              <input
                type="date"
                className={`${inputCls} focus:ring-indigo-500`}
                value={selectedDate}
                max={getLocalDateString()}
                onChange={(e) => setSelectedDate(e.target.value || getLocalDateString())}
                title="Select date for entry (Default: Today)"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 opacity-0 hidden xl:block">Action</label>
              <button
                onClick={handleAdd}
                disabled={isAdding}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
              >
                {isAdding ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
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

      {/* Expenses Table */}
      <div className="px-4 sm:px-8 py-6 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <p className="text-sm text-gray-600">
            Showing expenses for{" "}
            <span className="font-semibold text-gray-800">
              {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          </p>
          <span className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold bg-red-50 text-red-700 border border-red-100">
            Total: ₹{Number(total || 0).toLocaleString("en-IN")} · {expenses.length} {expenses.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        <div className="bg-white border border-gray-200 overflow-hidden shadow-lg rounded-xl">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading expenses...</div>
          ) : expenses.length === 0 ? (
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
                    {[
                      [Hash, "S.No", "text-blue-600"],
                      [Receipt, "Title", "text-indigo-600"],
                      [DollarSign, "Amount", "text-green-600"],
                      [Coins, "Payment Method", "text-orange-600"],
                      [Clock, "Time", "text-orange-600"],
                      [Settings2, "Actions", "text-gray-500"],
                    ].map(([Icon, label, tone]) => (
                      <th key={label} className="px-6 py-4 text-left text-sm font-bold text-gray-700 border-b border-gray-300 whitespace-nowrap">
                        <div className="flex items-center">
                          <Icon className={`h-4 w-4 mr-2 ${tone}`} />
                          {label}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp, i) => (
                    <tr key={exp._id || i} className={`hover:bg-blue-50 transition-colors duration-200 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                      <td className="px-6 py-4 border-b border-gray-200">
                        <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">{i + 1}</span>
                      </td>
                      <td className="px-6 py-4 border-b border-gray-200">
                        <div className="font-semibold text-gray-800">{exp.title}</div>
                      </td>
                      <td className="px-6 py-4 border-b border-gray-200">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800">₹{exp.amount}</span>
                      </td>
                      <td className="px-6 py-4 border-b border-gray-200">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800">
                          {formatPaymentMethodLabel(exp.paymentMethod) || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4 border-b border-gray-200">
                        <span className="text-sm text-gray-600 font-medium whitespace-nowrap">
                          {new Date(exp.createdAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: true, hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </td>
                      <td className="px-6 py-4 border-b border-gray-200">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(exp)} title="Edit" className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="h-4 w-4" /></button>
                          <button onClick={() => remove(exp._id)} title="Delete" className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Expense">
        {editing && (
          <div className="space-y-3">
            <Field label="Title" required><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
            <Field label="Amount (₹)" required><Input type="number" min="0" value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} /></Field>
            <Field label="Payment Method">
              <Select value={editing.paymentMethod} onChange={(e) => setEditing({ ...editing, paymentMethod: e.target.value })}>
                {editOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>
            <div className="flex justify-end gap-2 pt-3">
              <Btn variant="secondary" onClick={() => setEditing(null)}>Cancel</Btn>
              <Btn icon={Save} onClick={saveEdit} disabled={saving}>{saving ? "Saving..." : "Save"}</Btn>
            </div>
          </div>
        )}
      </Modal>

      {toast && <Toast {...toast} onClose={clear} />}
    </div>
  );
}

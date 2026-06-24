"use client";
import { useEffect, useState } from "react";
import { Receipt, Plus, Edit2, Trash2, Save } from "lucide-react";
import shopAdminApi from "../shopAdminApi";
import { PanelHeader, PanelCard, Btn, Field, Input, Select, Modal, Toast, useToast, EmptyState, LoadingRow } from "./_ui";

const EMPTY = { title: "", amount: 0, paymentMethod: "Cash" };
const METHODS = ["Cash", "UPI", "Card", "Bank Transfer", "Cheque", "Other"];

export default function ExpensesPanel({ currentShopId }) {
  const { toast, show, clear } = useToast();
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ fromDate: "", toDate: "" });
  const [modal, setModal] = useState(null); // { mode, expense? }
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.fromDate) params.fromDate = new Date(filters.fromDate).toISOString();
      if (filters.toDate) { const d = new Date(filters.toDate); d.setHours(23, 59, 59, 999); params.toDate = d.toISOString(); }
      const r = await shopAdminApi.listExpenses(params);
      setList(r.expenses || []); setTotal(r.total || 0);
    } catch (e) { show("Failed", "error"); }
    setLoading(false);
  };
  useEffect(() => { if (currentShopId) fetch(); /* eslint-disable-next-line */ }, [currentShopId, filters.fromDate, filters.toDate]);

  const openCreate = () => { setForm(EMPTY); setModal({ mode: "create" }); };
  const openEdit = (e) => { setForm({ title: e.title, amount: e.amount, paymentMethod: e.paymentMethod || "Cash" }); setModal({ mode: "edit", expense: e }); };

  const save = async () => {
    if (!form.title.trim() || !form.amount) { show("Title and amount required", "error"); return; }
    setSaving(true);
    try {
      if (modal.mode === "create") { await shopAdminApi.createExpense(form); show("Expense added"); }
      else { await shopAdminApi.updateExpense(modal.expense._id, form); show("Expense updated"); }
      setModal(null); fetch();
    } catch (e) { show(e?.response?.data?.message || "Failed", "error"); }
    setSaving(false);
  };
  const remove = async (id) => { if (!confirm("Delete this expense?")) return; try { await shopAdminApi.deleteExpense(id); show("Deleted"); fetch(); } catch (e) { show("Failed", "error"); } };

  return (
    <div>
      <PanelHeader icon={Receipt} title="Expenses" subtitle="Track and manage shop expenses" accent="orange"
        actions={<Btn icon={Plus} onClick={openCreate}>Add Expense</Btn>} />

      <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-5 shadow-md text-white mb-6">
        <div className="text-white/80 text-sm font-medium">Total in Range</div>
        <div className="text-3xl font-bold mt-1">₹{total.toLocaleString()}</div>
        <div className="text-white/80 text-xs mt-1">{list.length} entries</div>
      </div>

      <PanelCard className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <Field label="From Date"><Input type="date" value={filters.fromDate} onChange={e => setFilters({ ...filters, fromDate: e.target.value })} /></Field>
          <Field label="To Date"><Input type="date" value={filters.toDate} onChange={e => setFilters({ ...filters, toDate: e.target.value })} /></Field>
          <Btn variant="secondary" onClick={() => setFilters({ fromDate: "", toDate: "" })}>Clear Filter</Btn>
        </div>
      </PanelCard>

      <PanelCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Title</th>
                <th className="text-left px-4 py-3">Method</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="text-center px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <LoadingRow colSpan={5} />}
              {!loading && list.length === 0 && (
                <tr><td colSpan={5}><EmptyState icon={Receipt} title="No expenses" /></td></tr>
              )}
              {list.map(e => (
                <tr key={e._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{e.title}</td>
                  <td className="px-4 py-3 text-slate-600">{e.paymentMethod}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-semibold text-orange-700">₹{(e.amount || 0).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(e)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="h-4 w-4" /></button>
                      <button onClick={() => remove(e._id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelCard>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === "create" ? "Add Expense" : "Edit Expense"}>
        <div className="space-y-3">
          <Field label="Title" required><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Amount (₹)" required><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></Field>
          <Field label="Payment Method">
            <Select value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })}>
              {METHODS.map(m => <option key={m}>{m}</option>)}
            </Select>
          </Field>
          <div className="flex justify-end gap-2 pt-3">
            <Btn variant="secondary" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn icon={Save} onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Btn>
          </div>
        </div>
      </Modal>

      {toast && <Toast {...toast} onClose={clear} />}
    </div>
  );
}

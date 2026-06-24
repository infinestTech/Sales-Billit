"use client";
import { useEffect, useState } from "react";
import { Truck, Plus, Edit2, Trash2, Search, Save } from "lucide-react";
import shopAdminApi from "../shopAdminApi";
import { PanelHeader, PanelCard, Btn, Field, Input, Modal, Toast, useToast, EmptyState, LoadingRow } from "./_ui";

const EMPTY = { supplierName: "", agencyName: "", phoneNumber: "", address: "" };

export default function SuppliersPanel({ currentShopId }) {
  const { toast, show, clear } = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try { const r = await shopAdminApi.listSuppliers(); setList(r.suppliers || []); }
    catch (e) { show("Failed to load suppliers", "error"); }
    setLoading(false);
  };
  useEffect(() => { if (currentShopId) fetch(); /* eslint-disable-next-line */ }, [currentShopId]);

  const openCreate = () => { setEditId(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (s) => { setEditId(s._id); setForm({ supplierName: s.supplierName, agencyName: s.agencyName || "", phoneNumber: s.phoneNumber || "", address: s.address || "" }); setModalOpen(true); };

  const save = async () => {
    if (!form.supplierName.trim()) { show("Supplier name required", "error"); return; }
    setSaving(true);
    try {
      if (editId) { await shopAdminApi.updateSupplier(editId, form); show("Supplier updated"); }
      else { await shopAdminApi.createSupplier(form); show("Supplier created"); }
      setModalOpen(false); fetch();
    } catch (e) { show(e?.response?.data?.message || "Failed", "error"); }
    setSaving(false);
  };

  const remove = async (id) => {
    if (!confirm("Delete this supplier?")) return;
    try { await shopAdminApi.deleteSupplier(id); show("Supplier deleted"); fetch(); }
    catch (e) { show("Failed to delete", "error"); }
  };

  const filtered = list.filter(s => !q || (s.supplierName?.toLowerCase().includes(q.toLowerCase()) || s.agencyName?.toLowerCase().includes(q.toLowerCase()) || s.phoneNumber?.includes(q)));

  return (
    <div>
      <PanelHeader icon={Truck} title="Suppliers" subtitle="Manage supplier relationships" accent="blue"
        actions={<Btn icon={Plus} onClick={openCreate}>Add Supplier</Btn>} />

      <PanelCard className="p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Search by name, agency or phone..." value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </PanelCard>

      <PanelCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Agency</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-left px-4 py-3">Address</th>
                <th className="text-right px-4 py-3">Total (₹)</th>
                <th className="text-center px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <LoadingRow colSpan={6} />}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6}><EmptyState icon={Truck} title="No suppliers" hint="Click Add Supplier to create one" /></td></tr>
              )}
              {filtered.map(s => (
                <tr key={s._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{s.supplierName}</td>
                  <td className="px-4 py-3 text-slate-600">{s.agencyName || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{s.phoneNumber || "—"}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{s.address || "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">₹{(s.totalAmount || 0).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(s)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="h-4 w-4" /></button>
                      <button onClick={() => remove(s._id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelCard>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? "Edit Supplier" : "New Supplier"}>
        <div className="space-y-3">
          <Field label="Supplier Name" required><Input value={form.supplierName} onChange={e => setForm({ ...form, supplierName: e.target.value })} /></Field>
          <Field label="Agency Name"><Input value={form.agencyName} onChange={e => setForm({ ...form, agencyName: e.target.value })} /></Field>
          <Field label="Phone Number"><Input value={form.phoneNumber} onChange={e => setForm({ ...form, phoneNumber: e.target.value })} /></Field>
          <Field label="Address"><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-3">
            <Btn variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn icon={Save} onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Btn>
          </div>
        </div>
      </Modal>

      {toast && <Toast {...toast} onClose={clear} />}
    </div>
  );
}

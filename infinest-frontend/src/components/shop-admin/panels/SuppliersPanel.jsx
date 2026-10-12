"use client";
import { useEffect, useState } from "react";
import { Truck, Plus, Edit2, Trash2, Search, Save, Eye, Wallet, AlertCircle, IndianRupee } from "lucide-react";
import shopAdminApi from "../shopAdminApi";
import { PanelHeader, PanelCard, Btn, Field, Input, Modal, Toast, useToast, EmptyState, LoadingRow } from "./_ui";
import { getLocalDateString } from "@/lib/utils";
import SupplierItemsEditor, { newItemRow, itemsTotal, itemsPayload, validateItems, inr, toPaise } from "./supplier/SupplierItemsEditor";
import SupplierDetailModal from "./supplier/SupplierDetailModal";

const EMPTY = { supplierName: "", agencyName: "", phoneNumber: "", address: "", openingCredit: "", openingDate: getLocalDateString() };

export default function SuppliersPanel({ currentShopId }) {
  const { toast, show, clear } = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [rows, setRows] = useState([newItemRow()]);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null); // { id, action }

  const fetch = async () => {
    setLoading(true);
    try { const r = await shopAdminApi.listSuppliers(); setList(r.suppliers || []); }
    catch (e) { show("Failed to load suppliers", "error"); }
    setLoading(false);
  };
  useEffect(() => { if (currentShopId) fetch(); /* eslint-disable-next-line */ }, [currentShopId]);

  const openCreate = () => { setEditId(null); setForm({ ...EMPTY, openingDate: getLocalDateString() }); setRows([newItemRow()]); setModalOpen(true); };
  const openEdit = (s) => {
    setEditId(s._id);
    setForm({ ...EMPTY, supplierName: s.supplierName, agencyName: s.agencyName || "", phoneNumber: s.phoneNumber || "", address: s.address || "" });
    setModalOpen(true);
  };

  const opening = Number(form.openingCredit) || 0;

  const save = async () => {
    if (!form.supplierName.trim()) { show("Supplier name required", "error"); return; }
    const { openingCredit, openingDate, ...details } = form;
    let payload = details;
    if (!editId && opening > 0) {
      const err = validateItems(rows);
      if (err) { show(err, "error"); return; }
      if (toPaise(itemsTotal(rows)) !== toPaise(opening)) {
        show(`Products total ${inr(itemsTotal(rows))} must equal the opening credit ${inr(opening)}`, "error");
        return;
      }
      payload = { ...details, openingCredit: opening, openingDate, items: itemsPayload(rows) };
    } else if (!editId && openingCredit !== "" && opening < 0) {
      show("Opening credit can't be negative", "error"); return;
    }
    setSaving(true);
    try {
      if (editId) { await shopAdminApi.updateSupplier(editId, details); show("Supplier updated"); }
      else { await shopAdminApi.createSupplier(payload); show(opening > 0 ? "Supplier added with opening stock" : "Supplier created"); }
      setModalOpen(false); fetch();
    } catch (e) { show(e?.response?.data?.message || "Failed", "error"); }
    setSaving(false);
  };

  const remove = async (s) => {
    const owed = Number(s.totalAmount) || 0;
    const msg = owed > 0
      ? `${s.supplierName} still has ${inr(owed)} unpaid credit. Delete this supplier anyway?`
      : "Delete this supplier?";
    if (!confirm(msg)) return;
    try { await shopAdminApi.deleteSupplier(s._id); show("Supplier deleted"); fetch(); }
    catch (e) { show("Failed to delete", "error"); }
  };

  const filtered = list.filter(s => !q || (s.supplierName?.toLowerCase().includes(q.toLowerCase()) || s.agencyName?.toLowerCase().includes(q.toLowerCase()) || s.phoneNumber?.includes(q)));
  const totalOwed = list.reduce((sum, s) => sum + Math.max(0, Number(s.totalAmount) || 0), 0);
  const owingCount = list.filter((s) => Number(s.totalAmount) > 0).length;
  const totalOpening = list.reduce((sum, s) => sum + (Number(s.openingCredit) || 0), 0);

  return (
    <div>
      <PanelHeader icon={Truck} title="Suppliers" subtitle="Credit balances, stock purchases and payments" accent="blue"
        actions={<Btn icon={Plus} onClick={openCreate}>Add Supplier</Btn>} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-red-700"><IndianRupee className="h-3.5 w-3.5" /> Total credit owed</div>
          <div className="text-2xl font-bold text-red-800 mt-1">{inr(totalOwed)}</div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700"><AlertCircle className="h-3.5 w-3.5" /> Suppliers with credit</div>
          <div className="text-2xl font-bold text-amber-800 mt-1">{owingCount} <span className="text-sm font-medium text-amber-700">of {list.length}</span></div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Opening credit (all suppliers)</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{inr(totalOpening)}</div>
        </div>
      </div>

      <PanelCard className="p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" placeholder="Search by name, agency or phone..." value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </PanelCard>

      <PanelCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Supplier</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-right px-4 py-3">Opening credit</th>
                <th className="text-right px-4 py-3">Credit balance</th>
                <th className="text-right px-4 py-3">Stock in hand</th>
                <th className="text-center px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <LoadingRow colSpan={6} />}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6}><EmptyState icon={Truck} title="No suppliers" hint="Click Add Supplier to create one" /></td></tr>
              )}
              {filtered.map(s => {
                const owed = Number(s.totalAmount) || 0;
                return (
                  <tr key={s._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <button onClick={() => setDetail({ id: s._id })} className="text-left">
                        <div className="font-semibold text-slate-800 hover:text-blue-700">{s.supplierName}</div>
                        <div className="text-xs text-slate-500">{s.agencyName || "—"}{s.address ? ` · ${s.address}` : ""}</div>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{s.phoneNumber || "—"}</td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {Number(s.openingCredit) > 0 ? (
                        <>
                          <div className="font-medium">{inr(s.openingCredit)}</div>
                          {s.openingCreditDate && <div className="text-[11px] text-slate-400">{new Date(s.openingCreditDate).toLocaleDateString("en-IN")}</div>}
                        </>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-block px-2.5 py-1 rounded-lg font-bold ${owed > 0 ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                        {owed > 0 ? inr(owed) : "Cleared"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {s.spareCount > 0 ? (
                        <>
                          <div className="font-medium">{s.stockInHand} pcs</div>
                          <div className="text-[11px] text-slate-400">{inr(s.stockValue)} · {s.spareCount} spare{s.spareCount === 1 ? "" : "s"}</div>
                        </>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setDetail({ id: s._id })} title="View purchases, stock & payments" className="p-2 text-slate-700 hover:bg-slate-100 rounded-lg"><Eye className="h-4 w-4" /></button>
                        <button onClick={() => setDetail({ id: s._id, action: "pay" })} disabled={owed <= 0} title="Pay credit"
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"><Wallet className="h-4 w-4" /></button>
                        <button onClick={() => setDetail({ id: s._id, action: "purchase" })} title="Add purchase / restock" className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg"><Plus className="h-4 w-4" /></button>
                        <button onClick={() => openEdit(s)} title="Edit" className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="h-4 w-4" /></button>
                        <button onClick={() => remove(s)} title="Delete" className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PanelCard>

      <Modal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title={editId ? "Edit Supplier" : "New Supplier"} maxWidth={!editId && opening > 0 ? "max-w-3xl" : "max-w-lg"}>
        <div className="space-y-3">
          <Field label="Supplier Name" required><Input value={form.supplierName} onChange={e => setForm({ ...form, supplierName: e.target.value })} /></Field>
          <Field label="Agency Name"><Input value={form.agencyName} onChange={e => setForm({ ...form, agencyName: e.target.value })} /></Field>
          <Field label="Phone Number"><Input value={form.phoneNumber} onChange={e => setForm({ ...form, phoneNumber: e.target.value })} /></Field>
          <Field label="Address"><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></Field>

          {!editId && (
            <div className="border-t border-slate-200 pt-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Opening credit (₹)" hint="Optional — amount you already owe this supplier">
                  <Input type="number" min="0" step="0.01" placeholder="0" value={form.openingCredit} onChange={e => setForm({ ...form, openingCredit: e.target.value })} />
                </Field>
                {opening > 0 && (
                  <Field label="As of date" required>
                    <Input type="date" max={getLocalDateString()} value={form.openingDate} onChange={e => setForm({ ...form, openingDate: e.target.value })} />
                  </Field>
                )}
              </div>
              {opening > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">Products received for this credit <span className="text-red-500">*</span></div>
                  <p className="text-xs text-slate-500 mb-2">These are added to the service spares inventory. The total must equal the opening credit.</p>
                  <SupplierItemsEditor rows={rows} onChange={setRows} target={opening} />
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3">
            <Btn variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Btn>
            <Btn icon={Save} onClick={save} disabled={saving || (!editId && opening > 0 && toPaise(itemsTotal(rows)) !== toPaise(opening))}>
              {saving ? "Saving..." : "Save"}
            </Btn>
          </div>
        </div>
      </Modal>

      {detail && (
        <SupplierDetailModal
          key={`${detail.id}-${detail.action || "view"}`}
          supplierId={detail.id}
          initialAction={detail.action}
          onClose={() => setDetail(null)}
          onChanged={fetch}
          notify={show}
        />
      )}

      {toast && <Toast {...toast} onClose={clear} />}
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { Package, Plus, Edit2, Trash2, Search, Save, ShoppingCart, ArrowUp } from "lucide-react";
import shopAdminApi from "../shopAdminApi";
import { PanelHeader, PanelCard, Btn, Field, Input, Select, Modal, Toast, useToast, EmptyState, LoadingRow } from "./_ui";

const EMPTY = { name: "", category: "", costPrice: 0, sellingPrice: 0, quantity: 0, supplierId: "", paymentMethod: "Cash" };

export default function InventoryPanel({ currentShopId }) {
  const { toast, show, clear } = useToast();
  const [list, setList] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null); // { mode: 'create'|'edit'|'sell'|'restock', product? }
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([shopAdminApi.listProducts(), shopAdminApi.listSuppliers()]);
      setList(p.products || []); setSuppliers(s.suppliers || []);
    } catch (e) { show("Failed to load", "error"); }
    setLoading(false);
  };
  useEffect(() => { if (currentShopId) fetch(); /* eslint-disable-next-line */ }, [currentShopId]);

  const openCreate = () => { setForm(EMPTY); setModal({ mode: "create" }); };
  const openEdit = (p) => { setForm({ name: p.name, category: p.category || "", costPrice: p.costPrice, sellingPrice: p.sellingPrice, quantity: p.quantity, supplierId: p.supplierId || "", paymentMethod: p.paymentMethod || "Cash" }); setModal({ mode: "edit", product: p }); };
  const openSell = (p) => { setForm({ quantitySold: 1, sellingPrice: p.sellingPrice }); setModal({ mode: "sell", product: p }); };
  const openRestock = (p) => { setForm({ quantityToAdd: 1 }); setModal({ mode: "restock", product: p }); };

  const save = async () => {
    setSaving(true);
    try {
      const { mode, product } = modal;
      if (mode === "create") { await shopAdminApi.createProduct(form); show("Product added"); }
      else if (mode === "edit") { await shopAdminApi.updateProduct(product._id, form); show("Product updated"); }
      else if (mode === "sell") { await shopAdminApi.sellProduct(product._id, Number(form.quantitySold), Number(form.sellingPrice)); show("Sale recorded"); }
      else if (mode === "restock") { await shopAdminApi.restockProduct(product._id, Number(form.quantityToAdd)); show("Restocked"); }
      setModal(null); fetch();
    } catch (e) { show(e?.response?.data?.message || "Failed", "error"); }
    setSaving(false);
  };

  const remove = async (id) => {
    if (!confirm("Delete this product?")) return;
    try { await shopAdminApi.deleteProduct(id); show("Deleted"); fetch(); }
    catch (e) { show("Failed", "error"); }
  };

  const filtered = list.filter(p => !q || p.name?.toLowerCase().includes(q.toLowerCase()) || p.category?.toLowerCase().includes(q.toLowerCase()));
  const totalValue = list.reduce((s, p) => s + (Number(p.costPrice) || 0) * (Number(p.quantity) || 0), 0);
  const lowStock = list.filter(p => p.quantity <= 5).length;

  return (
    <div>
      <PanelHeader icon={Package} title="Service Inventory" subtitle="Manage products, stock and supplier links" accent="purple"
        actions={<Btn icon={Plus} onClick={openCreate}>Add Product</Btn>} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Products" value={list.length} />
        <StatCard label="Inventory Value" value={`₹${totalValue.toLocaleString()}`} />
        <StatCard label="Low Stock (≤5)" value={lowStock} highlight={lowStock > 0} />
      </div>

      <PanelCard className="p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Search products..." value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </PanelCard>

      <PanelCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Product</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-right px-4 py-3">Cost</th>
                <th className="text-right px-4 py-3">Sell</th>
                <th className="text-right px-4 py-3">Qty</th>
                <th className="text-center px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <LoadingRow colSpan={6} />}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6}><EmptyState icon={Package} title="No products" /></td></tr>
              )}
              {filtered.map(p => (
                <tr key={p._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-3 text-slate-600">{p.category || "—"}</td>
                  <td className="px-4 py-3 text-right text-slate-600">₹{p.costPrice}</td>
                  <td className="px-4 py-3 text-right text-emerald-700 font-semibold">₹{p.sellingPrice}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold ${p.quantity <= 5 ? "text-red-600" : "text-slate-700"}`}>{p.quantity}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openSell(p)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Sell"><ShoppingCart className="h-4 w-4" /></button>
                      <button onClick={() => openRestock(p)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg" title="Restock"><ArrowUp className="h-4 w-4" /></button>
                      <button onClick={() => openEdit(p)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="h-4 w-4" /></button>
                      <button onClick={() => remove(p._id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelCard>

      <Modal open={!!modal} onClose={() => setModal(null)} title={
        modal?.mode === "create" ? "Add Product" :
        modal?.mode === "edit" ? "Edit Product" :
        modal?.mode === "sell" ? `Sell — ${modal.product?.name}` :
        modal?.mode === "restock" ? `Restock — ${modal.product?.name}` : ""
      }>
        {modal && (modal.mode === "create" || modal.mode === "edit") && (
          <div className="space-y-3">
            <Field label="Name" required><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Category"><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cost Price (₹)" required><Input type="number" value={form.costPrice} onChange={e => setForm({ ...form, costPrice: e.target.value })} /></Field>
              <Field label="Selling Price (₹)"><Input type="number" value={form.sellingPrice} onChange={e => setForm({ ...form, sellingPrice: e.target.value })} /></Field>
              <Field label="Quantity" required><Input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></Field>
              <Field label="Payment Method">
                <Select value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })}>
                  {["Cash", "UPI", "Card", "Bank Transfer", "Cheque"].map(m => <option key={m}>{m}</option>)}
                </Select>
              </Field>
            </div>
            {modal.mode === "create" && (
              <Field label="Supplier">
                <Select value={form.supplierId} onChange={e => setForm({ ...form, supplierId: e.target.value })}>
                  <option value="">— None —</option>
                  {suppliers.map(s => <option key={s._id} value={s._id}>{s.supplierName}</option>)}
                </Select>
              </Field>
            )}
            <div className="flex justify-end gap-2 pt-3">
              <Btn variant="secondary" onClick={() => setModal(null)}>Cancel</Btn>
              <Btn icon={Save} onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Btn>
            </div>
          </div>
        )}
        {modal?.mode === "sell" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">In stock: {modal.product.quantity}</p>
            <Field label="Quantity to Sell" required><Input type="number" value={form.quantitySold} onChange={e => setForm({ ...form, quantitySold: e.target.value })} /></Field>
            <Field label="Selling Price (₹)"><Input type="number" value={form.sellingPrice} onChange={e => setForm({ ...form, sellingPrice: e.target.value })} /></Field>
            <div className="flex justify-end gap-2 pt-3">
              <Btn variant="secondary" onClick={() => setModal(null)}>Cancel</Btn>
              <Btn icon={ShoppingCart} onClick={save} disabled={saving}>{saving ? "..." : "Record Sale"}</Btn>
            </div>
          </div>
        )}
        {modal?.mode === "restock" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Current stock: {modal.product.quantity}</p>
            <Field label="Quantity to Add" required><Input type="number" value={form.quantityToAdd} onChange={e => setForm({ ...form, quantityToAdd: e.target.value })} /></Field>
            <div className="flex justify-end gap-2 pt-3">
              <Btn variant="secondary" onClick={() => setModal(null)}>Cancel</Btn>
              <Btn icon={ArrowUp} onClick={save} disabled={saving}>{saving ? "..." : "Restock"}</Btn>
            </div>
          </div>
        )}
      </Modal>

      {toast && <Toast {...toast} onClose={clear} />}
    </div>
  );
}

function StatCard({ label, value, highlight }) {
  return (
    <div className={`bg-white border ${highlight ? "border-red-200" : "border-gray-200"} rounded-2xl p-5 shadow-sm`}>
      <div className="text-slate-500 text-sm">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${highlight ? "text-red-600" : "text-slate-800"}`}>{value}</div>
    </div>
  );
}

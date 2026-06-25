"use client";
import { useEffect, useState, useRef } from "react";
import { Database, Trash2, CheckCircle, Truck, RotateCcw, Search, Plus, Minus, ChevronLeft, ChevronRight } from "lucide-react";
import shopAdminApi from "../shopAdminApi";
import { PanelHeader, PanelCard, Btn, Input, Select, Modal, Field, Toast, useToast, EmptyState } from "./_ui";

const PAGE_SIZE = 20;

export default function AllRecordsPanel({ currentShopId }) {
  const { toast, show, clear } = useToast();
  const [clients, setClients] = useState([]);
  const [mobiles, setMobiles] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [tab, setTab] = useState("customers");
  const [page, setPage] = useState(1);
  const [paymentModal, setPaymentModal] = useState(null);
  const [payForm, setPayForm] = useState({ amount: 0, method: "Cash" });
  const debounceRef = useRef(null);

  const fetchPage = async (tabVal, pageVal, qVal) => {
    setLoading(true);
    try {
      const r = await shopAdminApi.listRecords({ tab: tabVal, page: pageVal, limit: PAGE_SIZE, q: qVal });
      setClients(r[tabVal] || []);
      setMobiles(r.mobiles || []);
      setTotal(r.total || 0);
      setTotalPages(r.totalPages || 0);
    } catch (e) { show("Failed to load records", "error"); }
    setLoading(false);
  };

  useEffect(() => { if (currentShopId) fetchPage(tab, page, debouncedQ); }, [currentShopId, tab, page, debouncedQ]);

  const handleSearchChange = (val) => {
    setQ(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setPage(1); setDebouncedQ(val); }, 400);
  };

  const handleTabChange = (t) => { setTab(t); setPage(1); };

  const refetch = () => fetchPage(tab, page, debouncedQ);

  const toggle = async (mobileId, status, value) => {
    try { await shopAdminApi.toggleMobileStatus(mobileId, status, value); show(`Marked ${status}`); refetch(); }
    catch (e) { show("Failed", "error"); }
  };
  const delMobile = async (id) => {
    if (!confirm("Delete mobile entry?")) return;
    try { await shopAdminApi.deleteMobile(id); show("Deleted"); refetch(); }
    catch (e) { show("Failed", "error"); }
  };
  const delClient = async (type, id) => {
    if (!confirm(`Delete this ${type} and all linked mobiles?`)) return;
    try {
      type === "customer" ? await shopAdminApi.deleteCustomer(id) : await shopAdminApi.deleteDealer(id);
      show("Deleted"); refetch();
    } catch (e) { show("Failed", "error"); }
  };

  const openPayment = (mobile) => { setPaymentModal(mobile); setPayForm({ amount: 0, method: "Cash" }); };
  const submitPayment = async () => {
    try {
      await shopAdminApi.addPayment(paymentModal._id, Number(payForm.amount), payForm.method);
      show("Payment added"); setPaymentModal(null); refetch();
    } catch (e) { show("Failed", "error"); }
  };
  const delPayment = async (mobileId, idx) => {
    if (!confirm("Remove this payment?")) return;
    try { await shopAdminApi.removePayment(mobileId, idx); show("Removed"); refetch(); }
    catch (e) { show("Failed", "error"); }
  };

  const mobilesFor = (clientId) => mobiles.filter(m => String(m.customer_id) === String(clientId) || String(m.dealer_id) === String(clientId));

  const pagePills = () => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 3) return [1, 2, 3, 4, 5];
    if (page >= totalPages - 2) return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [page - 2, page - 1, page, page + 1, page + 2];
  };

  return (
    <div>
      <PanelHeader icon={Database} title="All Records" subtitle="View, manage, and update customer & dealer records" accent="slate" />

      <PanelCard className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 rounded-lg p-1">
            {["customers", "dealers"].map(t => (
              <button key={t} onClick={() => handleTabChange(t)} className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize ${tab === t ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600"}`}>
                {t} {tab === t ? `(${total})` : ""}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400"
              placeholder="Search by name, phone, bill no..."
              value={q}
              onChange={e => handleSearchChange(e.target.value)}
            />
          </div>
        </div>
      </PanelCard>

      <PanelCard>
        {loading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
          <div className="divide-y divide-slate-100">
            {clients.length === 0 && <EmptyState icon={Database} title={`No ${tab} found`} />}
            {clients.map(c => (
              <ClientRow key={c._id} client={c} type={tab === "customers" ? "customer" : "dealer"}
                mobiles={mobilesFor(c._id)} onToggle={toggle} onDelMobile={delMobile} onDelClient={delClient}
                onAddPay={openPayment} onDelPay={delPayment} />
            ))}
          </div>
        )}

        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">{total} total • Page {page} of {totalPages}</p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {pagePills().map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium border ${p === page ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </PanelCard>

      <Modal open={!!paymentModal} onClose={() => setPaymentModal(null)} title="Add Payment Entry">
        {paymentModal && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Mobile: <span className="font-semibold">{paymentModal.mobile_name}</span></p>
            <Field label="Amount (₹)" required><Input type="number" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} /></Field>
            <Field label="Method"><Select value={payForm.method} onChange={e => setPayForm({ ...payForm, method: e.target.value })}>
              {["Cash", "UPI", "Card", "Bank Transfer", "Cheque"].map(m => <option key={m}>{m}</option>)}
            </Select></Field>
            <div className="flex justify-end gap-2 pt-3">
              <Btn variant="secondary" onClick={() => setPaymentModal(null)}>Cancel</Btn>
              <Btn icon={Plus} onClick={submitPayment}>Add Payment</Btn>
            </div>
          </div>
        )}
      </Modal>

      {toast && <Toast {...toast} onClose={clear} />}
    </div>
  );
}

function ClientRow({ client, type, mobiles, onToggle, onDelMobile, onDelClient, onAddPay, onDelPay }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <button onClick={() => setOpen(o => !o)} className="text-left">
            <div className="font-semibold text-slate-800">{client.client_name}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {client.mobile_number} • Bill: {client.bill_no || "—"} • {mobiles.length} mobiles
            </div>
          </button>
        </div>
        <div className="flex items-center gap-2">
          {client.balance_amount > 0 && (
            <span className="px-2 py-1 bg-orange-50 text-orange-700 text-xs font-semibold rounded">Balance ₹{client.balance_amount.toLocaleString()}</span>
          )}
          <Btn variant="ghost" onClick={() => setOpen(o => !o)}>{open ? "Hide" : "Details"}</Btn>
          <button onClick={() => onDelClient(type, client._id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      {open && (
        <div className="mt-3 ml-2 space-y-2">
          {mobiles.length === 0 && <p className="text-xs text-slate-400 italic">No mobiles linked</p>}
          {mobiles.map(m => (
            <div key={m._id} className="bg-slate-50 rounded-lg p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-medium text-slate-800 text-sm">{m.mobile_name} {m.model && <span className="text-slate-500">— {m.model}</span>}</div>
                  <div className="text-xs text-slate-500">IMEI: {m.imei || "—"} • Issue: {m.issue || "—"}</div>
                  <div className="text-xs text-emerald-700 mt-1">Paid ₹{(m.total_paid || m.paid_amount || 0).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <StatusBtn label="Ready" active={m.ready} icon={CheckCircle} onClick={() => onToggle(m._id, "ready", !m.ready)} />
                  <StatusBtn label="Delivered" active={m.delivered} icon={Truck} onClick={() => onToggle(m._id, "delivered", !m.delivered)} />
                  <StatusBtn label="Returned" active={m.returned} icon={RotateCcw} onClick={() => onToggle(m._id, "returned", !m.returned)} />
                  <Btn variant="outline" icon={Plus} onClick={() => onAddPay(m)}>Pay</Btn>
                  <button onClick={() => onDelMobile(m._id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              {m.payments?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {m.payments.map((p, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded text-xs">
                      ₹{p.amount} • {p.method}
                      <button onClick={() => onDelPay(m._id, idx)} className="text-red-400 hover:text-red-600"><Minus className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBtn({ label, active, icon: Icon, onClick }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}>
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}

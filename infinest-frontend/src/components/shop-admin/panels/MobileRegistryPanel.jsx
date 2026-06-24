"use client";
import { useEffect, useState } from "react";
import { Smartphone, Search } from "lucide-react";
import shopAdminApi from "../shopAdminApi";
import { PanelHeader, PanelCard, EmptyState, LoadingRow, Toast, useToast } from "./_ui";

export default function MobileRegistryPanel({ currentShopId }) {
  const { toast, show, clear } = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

  const fetch = async () => {
    setLoading(true);
    try { const r = await shopAdminApi.mobileRegistry(); setList(r.mobiles || []); }
    catch (e) { show("Failed to load", "error"); }
    setLoading(false);
  };
  useEffect(() => { if (currentShopId) fetch(); /* eslint-disable-next-line */ }, [currentShopId]);

  const filtered = list.filter(m => {
    if (filter === "pending" && (m.ready || m.delivered)) return false;
    if (filter === "ready" && !m.ready) return false;
    if (filter === "delivered" && !m.delivered) return false;
    if (filter === "returned" && !m.returned) return false;
    if (q) {
      const t = q.toLowerCase();
      return m.mobile_name?.toLowerCase().includes(t) || m.imei?.includes(q) || m.customer_id?.client_name?.toLowerCase().includes(t) || m.dealer_id?.client_name?.toLowerCase().includes(t);
    }
    return true;
  });

  const counts = {
    all: list.length,
    pending: list.filter(m => !m.ready && !m.delivered).length,
    ready: list.filter(m => m.ready).length,
    delivered: list.filter(m => m.delivered).length,
    returned: list.filter(m => m.returned).length,
  };

  return (
    <div>
      <PanelHeader icon={Smartphone} title="Mobile Registry" subtitle="All mobile records across customers and dealers" accent="blue" />

      <PanelCard className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 rounded-lg p-1 flex-wrap">
            {["all", "pending", "ready", "delivered", "returned"].map(t => (
              <button key={t} onClick={() => setFilter(t)} className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize ${filter === t ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600"}`}>
                {t} ({counts[t]})
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Search by mobile name, IMEI, customer..." value={q} onChange={e => setQ(e.target.value)} />
          </div>
        </div>
      </PanelCard>

      <PanelCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Mobile</th>
                <th className="text-left px-4 py-3">Owner</th>
                <th className="text-left px-4 py-3">IMEI</th>
                <th className="text-left px-4 py-3">Issue</th>
                <th className="text-right px-4 py-3">Paid (₹)</th>
                <th className="text-center px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <LoadingRow colSpan={6} />}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6}><EmptyState icon={Smartphone} title="No mobiles" /></td></tr>
              )}
              {filtered.map(m => (
                <tr key={m._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{m.mobile_name}</div>
                    {m.model && <div className="text-xs text-slate-500">{m.model}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {m.customer_id ? <>{m.customer_id.client_name}<div className="text-xs text-slate-400">Customer</div></> :
                     m.dealer_id ? <>{m.dealer_id.client_name}<div className="text-xs text-slate-400">Dealer</div></> : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">{m.imei || "—"}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{m.issue || "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">₹{(m.total_paid || m.paid_amount || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-1 flex-wrap">
                      {m.ready && <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded">Ready</span>}
                      {m.delivered && <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded">Delivered</span>}
                      {m.returned && <span className="px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded">Returned</span>}
                      {!m.ready && !m.delivered && !m.returned && <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">Pending</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelCard>

      {toast && <Toast {...toast} onClose={clear} />}
    </div>
  );
}

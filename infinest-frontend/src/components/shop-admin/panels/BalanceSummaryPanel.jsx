"use client";
import { useEffect, useState } from "react";
import { Wallet, Edit2, Save, X } from "lucide-react";
import shopAdminApi from "../shopAdminApi";
import { PanelHeader, PanelCard, Btn, EmptyState, LoadingRow, Toast, useToast } from "./_ui";

export default function BalanceSummaryPanel({ currentShopId }) {
  const { toast, show, clear } = useToast();
  const [data, setData] = useState({ customers: [], dealers: [], totalCustomerBalance: 0, totalDealerBalance: 0, grandTotal: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("customers");
  const [editing, setEditing] = useState(null); // { id, type, value }

  const fetch = async () => {
    setLoading(true);
    try { const r = await shopAdminApi.balanceSummary(); setData(r); }
    catch (e) { show("Failed to load", "error"); }
    setLoading(false);
  };
  useEffect(() => { if (currentShopId) fetch(); /* eslint-disable-next-line */ }, [currentShopId]);

  const saveEdit = async () => {
    try {
      await shopAdminApi.updateBalance(editing.id, Number(editing.value) || 0, editing.type);
      show("Balance updated");
      setEditing(null); fetch();
    } catch (e) { show("Failed", "error"); }
  };

  const rows = tab === "customers" ? data.customers : data.dealers;
  const type = tab === "customers" ? "Customer" : "Dealer";

  return (
    <div>
      <PanelHeader icon={Wallet} title="Balance Summary" subtitle="Pending balances across customers and dealers" accent="orange" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <SummaryCard label="Customer Balance" value={data.totalCustomerBalance} color="emerald" />
        <SummaryCard label="Dealer Balance" value={data.totalDealerBalance} color="blue" />
        <SummaryCard label="Grand Total" value={data.grandTotal} color="orange" />
      </div>

      <PanelCard className="p-4 mb-4">
        <div className="flex bg-slate-100 rounded-lg p-1 w-fit">
          {["customers", "dealers"].map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize ${tab === t ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600"}`}>
              {t} ({t === "customers" ? data.customers.length : data.dealers.length})
            </button>
          ))}
        </div>
      </PanelCard>

      <PanelCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-left px-4 py-3">Bill No</th>
                <th className="text-right px-4 py-3">Balance (₹)</th>
                <th className="text-center px-4 py-3">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <LoadingRow colSpan={5} />}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={5}><EmptyState icon={Wallet} title="No pending balances" /></td></tr>
              )}
              {rows.map(r => (
                <tr key={r._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{r.client_name}</td>
                  <td className="px-4 py-3 text-slate-600">{r.mobile_number}</td>
                  <td className="px-4 py-3 text-slate-600">{r.bill_no || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {editing?.id === r._id ? (
                      <input type="number" value={editing.value} onChange={e => setEditing({ ...editing, value: e.target.value })}
                        className="w-28 px-2 py-1 border border-slate-300 rounded text-right" autoFocus />
                    ) : (
                      <span className="font-semibold text-orange-700">₹{(r.balance_amount || 0).toLocaleString()}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editing?.id === r._id ? (
                      <div className="flex justify-center gap-1">
                        <button onClick={saveEdit} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"><Save className="h-4 w-4" /></button>
                        <button onClick={() => setEditing(null)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded"><X className="h-4 w-4" /></button>
                      </div>
                    ) : (
                      <div className="flex justify-center">
                        <button onClick={() => setEditing({ id: r._id, type, value: r.balance_amount || 0 })} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="h-4 w-4" /></button>
                      </div>
                    )}
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

function SummaryCard({ label, value, color }) {
  const colors = {
    emerald: "from-emerald-500 to-teal-600",
    blue: "from-blue-500 to-indigo-600",
    orange: "from-orange-500 to-red-500",
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} rounded-2xl p-5 shadow-md text-white`}>
      <div className="text-white/80 text-sm font-medium">{label}</div>
      <div className="text-3xl font-bold mt-1">₹{(value || 0).toLocaleString()}</div>
    </div>
  );
}

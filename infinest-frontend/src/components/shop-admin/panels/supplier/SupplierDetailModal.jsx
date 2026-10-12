"use client";
import { useEffect, useState } from "react";
import { Plus, Wallet, Package, Receipt, History, ChevronDown, Save, AlertTriangle } from "lucide-react";
import shopAdminApi from "../../shopAdminApi";
import { Modal, Btn, Field, Input, Select } from "../_ui";
import { PAYMENT_METHOD_OPTIONS, DEFAULT_PAYMENT_METHOD, formatPaymentMethodLabel } from "@/constants/paymentMethods";
import { getLocalDateString } from "@/lib/utils";
import SupplierItemsEditor, { newItemRow, itemsTotal, itemsPayload, validateItems, inr, toPaise } from "./SupplierItemsEditor";

const METHODS = PAYMENT_METHOD_OPTIONS.filter((o) => o.value);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const SOURCE_LABEL = { opening: "Opening stock", purchase: "Stock purchase", spare: "Spare (Service Inventory)", repair: "Spare for a repair" };

function StatusBadge({ entry }) {
  if (entry.purchaseType === "cash") return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">Paid in cash</span>;
  if (entry.status === "paid") return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Paid</span>;
  if (entry.status === "partial") return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Partly paid · {inr(entry.unpaid)} due</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Unpaid</span>;
}

function Stat({ label, value, tone = "slate", hint }) {
  const tones = {
    slate: "bg-slate-50 border-slate-200 text-slate-900",
    red: "bg-red-50 border-red-200 text-red-800",
    green: "bg-emerald-50 border-emerald-200 text-emerald-800",
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
  };
  return (
    <div className={`rounded-xl border p-3 ${tones[tone]}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-lg font-bold mt-0.5">{value}</div>
      {hint && <div className="text-[11px] opacity-75 mt-0.5">{hint}</div>}
    </div>
  );
}

export default function SupplierDetailModal({ supplierId, onClose, onChanged, notify, initialAction = null }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("purchases");
  const [openUsage, setOpenUsage] = useState(null);

  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchase, setPurchase] = useState({ purchaseType: "credit", paymentMethod: DEFAULT_PAYMENT_METHOD, billNo: "", date: getLocalDateString(), notes: "" });
  const [rows, setRows] = useState([newItemRow()]);

  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState({ amount: "", paymentMethod: DEFAULT_PAYMENT_METHOD, date: getLocalDateString(), note: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setData(await shopAdminApi.supplierLedger(supplierId));
    } catch (e) {
      notify(e?.response?.data?.message || "Failed to load supplier", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!supplierId) return;
    load().then(() => {
      if (initialAction === "pay") openPay();
      if (initialAction === "purchase") openPurchase();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  const openPurchase = () => {
    setPurchase({ purchaseType: "credit", paymentMethod: DEFAULT_PAYMENT_METHOD, billNo: "", date: getLocalDateString(), notes: "" });
    setRows([newItemRow()]);
    setPurchaseOpen(true);
  };
  const openPay = () => {
    setPay({ amount: "", paymentMethod: DEFAULT_PAYMENT_METHOD, date: getLocalDateString(), note: "" });
    setPayOpen(true);
  };

  const savePurchase = async () => {
    const err = validateItems(rows);
    if (err) return notify(err, "error");
    if (itemsTotal(rows) <= 0) return notify("Purchase total must be above 0", "error");
    setSaving(true);
    try {
      await shopAdminApi.addSupplierPurchase(supplierId, {
        ...purchase,
        paymentMethod: purchase.purchaseType === "cash" ? purchase.paymentMethod : undefined,
        items: itemsPayload(rows),
      });
      notify(purchase.purchaseType === "credit" ? "Credit purchase added" : "Cash purchase added");
      setPurchaseOpen(false);
      await load();
      onChanged?.();
    } catch (e) {
      notify(e?.response?.data?.message || "Failed to save purchase", "error");
    }
    setSaving(false);
  };

  const savePay = async () => {
    const amt = Number(pay.amount);
    const due = data?.summary?.outstanding || 0;
    if (!(amt > 0)) return notify("Enter a valid amount", "error");
    if (toPaise(amt) > toPaise(due)) return notify(`Amount is more than the outstanding credit (${inr(due)})`, "error");
    setSaving(true);
    try {
      await shopAdminApi.paySupplier(supplierId, pay);
      notify("Payment recorded");
      setPayOpen(false);
      await load();
      onChanged?.();
    } catch (e) {
      notify(e?.response?.data?.message || "Failed to record payment", "error");
    }
    setSaving(false);
  };

  const s = data?.summary;
  const sup = data?.supplier;
  const spares = (data?.stock || []).map((it) => ({ productId: it.productId, name: it.name, costPrice: it.costPrice }));
  const tabs = [
    { id: "purchases", label: "Purchases", icon: Receipt, count: data?.purchases?.length },
    { id: "stock", label: "Stock", icon: Package, count: data?.stock?.length },
    { id: "payments", label: "Payments", icon: History, count: data?.payments?.length },
  ];

  return (
    <>
      <Modal open onClose={onClose} title={sup ? `${sup.supplierName}${sup.agencyName ? ` — ${sup.agencyName}` : ""}` : "Supplier"} maxWidth="max-w-5xl">
        {loading && !data ? (
          <div className="py-16 text-center text-slate-400 text-sm">Loading...</div>
        ) : !data ? (
          <div className="py-16 text-center text-slate-500 text-sm">Could not load this supplier.</div>
        ) : (
          <div className="space-y-5 text-slate-900">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Stat label="Credit balance" value={inr(s.outstanding)} tone={s.outstanding > 0 ? "red" : "green"}
                hint={s.unpaidPurchases ? `${s.unpaidPurchases} purchase${s.unpaidPurchases === 1 ? "" : "s"} not fully paid` : "All purchases settled"} />
              <Stat label="Opening credit" value={inr(s.openingCredit)} tone="amber" hint={sup.openingCreditDate ? `as of ${fmtDate(sup.openingCreditDate)}` : "None"} />
              <Stat label="Bought on credit" value={inr(s.totalCreditPurchased)} tone="blue" hint="Incl. opening credit" />
              <Stat label="Paid to supplier" value={inr(s.totalPaid)} tone="green" />
              <Stat label="Stock in hand" value={inr(s.stockValue)} hint="At purchase price" />
            </div>

            {s.untrackedBalance > 0 && (
              <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                {inr(s.untrackedBalance)} of the balance isn&apos;t linked to any recorded purchase (for example a manual balance edit).
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                {tabs.map((t) => (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium ${tab === t.id ? "bg-white shadow text-slate-900" : "text-slate-600 hover:text-slate-900"}`}>
                    <t.icon className="h-4 w-4" /> {t.label}
                    <span className="text-xs text-slate-400">{t.count || 0}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Btn variant="outline" icon={Plus} onClick={openPurchase}>Add purchase / restock</Btn>
                <Btn variant="danger" icon={Wallet} onClick={openPay} disabled={!(s.outstanding > 0)}>Pay credit</Btn>
              </div>
            </div>

            {tab === "purchases" && (
              <div className="space-y-3">
                {data.purchases.length === 0 && <div className="text-center text-sm text-slate-500 py-10">No purchases recorded for this supplier yet.</div>}
                {data.purchases.map((p) => (
                  <div key={p.id} className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-50">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold text-slate-800">{SOURCE_LABEL[p.source] || "Purchase"}</span>
                        <span className="text-slate-500">{fmtDate(p.date)}</span>
                        {p.billNo && <span className="text-xs text-slate-600 bg-white border border-slate-200 rounded px-1.5 py-0.5">Bill {p.billNo}</span>}
                        <span className={`text-xs font-medium rounded px-1.5 py-0.5 ${p.purchaseType === "credit" ? "bg-orange-50 text-orange-700" : "bg-slate-100 text-slate-600"}`}>
                          {p.purchaseType === "credit" ? "Credit" : `Cash · ${formatPaymentMethodLabel(p.paymentMethod)}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge entry={p} />
                        <span className="font-bold text-slate-900">{inr(p.total)}</span>
                      </div>
                    </div>
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100">
                        {p.items.map((it, i) => (
                          <tr key={i}>
                            <td className="px-4 py-2 text-slate-800">{it.name}</td>
                            <td className="px-4 py-2 text-slate-600 text-right whitespace-nowrap">{it.quantity} × {it.costPrice != null ? inr(it.costPrice) : "—"}</td>
                            <td className="px-4 py-2 text-right font-medium text-slate-800 w-32">{inr(it.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {p.status === "partial" && (
                      <div className="px-4 py-1.5 text-xs text-slate-500 border-t border-slate-100">Paid {inr(p.paid)} of {inr(p.total)}</div>
                    )}
                  </div>
                ))}
                {data.purchases.some((p) => p.purchaseType === "credit") && (
                  <p className="text-xs text-slate-500">Payments (from either portal) are applied to the oldest purchase first.</p>
                )}
              </div>
            )}

            {tab === "stock" && (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-2.5">Spare</th>
                      <th className="text-right px-3 py-2.5">Bought</th>
                      <th className="text-right px-3 py-2.5">Used in service</th>
                      <th className="text-right px-3 py-2.5">Returned</th>
                      <th className="text-right px-3 py-2.5">In stock</th>
                      <th className="text-right px-4 py-2.5">Price / unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.stock.length === 0 && (
                      <tr><td colSpan={6} className="text-center text-slate-500 py-10">No spares from this supplier in the service inventory.</td></tr>
                    )}
                    {data.stock.map((it) => (
                      <FragmentRow key={it.productId} item={it} open={openUsage === it.productId}
                        onToggle={() => setOpenUsage(openUsage === it.productId ? null : it.productId)} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "payments" && (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-2.5">Date</th>
                      <th className="text-right px-3 py-2.5">Amount</th>
                      <th className="text-left px-3 py-2.5">Method</th>
                      <th className="text-right px-3 py-2.5">Balance after</th>
                      <th className="text-left px-4 py-2.5">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.payments.length === 0 && (
                      <tr><td colSpan={5} className="text-center text-slate-500 py-10">No payments made to this supplier yet.</td></tr>
                    )}
                    {data.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-2 text-slate-700">{fmtDate(p.date)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-emerald-700">{inr(p.amount)}</td>
                        <td className="px-3 py-2 text-slate-600">{formatPaymentMethodLabel(p.paymentMethod) || "—"}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{p.balanceAfter != null ? inr(p.balanceAfter) : "—"}</td>
                        <td className="px-4 py-2 text-slate-500">{p.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={purchaseOpen} onClose={() => !saving && setPurchaseOpen(false)} title="Add purchase / restock" maxWidth="max-w-3xl">
        <div className="space-y-4 text-slate-900">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Purchase type" required>
              <Select value={purchase.purchaseType} onChange={(e) => setPurchase({ ...purchase, purchaseType: e.target.value })}>
                <option value="credit">On credit (adds to supplier balance)</option>
                <option value="cash">Paid now</option>
              </Select>
            </Field>
            {purchase.purchaseType === "cash" ? (
              <Field label="Paid by" required>
                <Select value={purchase.paymentMethod} onChange={(e) => setPurchase({ ...purchase, paymentMethod: e.target.value })}>
                  {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </Select>
              </Field>
            ) : <div className="hidden sm:block" />}
            <Field label="Bill / invoice no."><Input value={purchase.billNo} onChange={(e) => setPurchase({ ...purchase, billNo: e.target.value })} /></Field>
            <Field label="Date" required>
              <Input type="date" max={getLocalDateString()} value={purchase.date} onChange={(e) => setPurchase({ ...purchase, date: e.target.value })} />
            </Field>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Products</div>
            <SupplierItemsEditor rows={rows} onChange={setRows} spares={spares} />
            {spares.length > 0 && <p className="text-xs text-slate-500 mt-2">Type an existing spare&apos;s name to restock it; new names are added as new spares.</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="secondary" onClick={() => setPurchaseOpen(false)} disabled={saving}>Cancel</Btn>
            <Btn icon={Save} onClick={savePurchase} disabled={saving}>{saving ? "Saving..." : `Save ${inr(itemsTotal(rows))}`}</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={payOpen} onClose={() => !saving && setPayOpen(false)} title="Pay supplier credit">
        <div className="space-y-3 text-slate-900">
          <div className="text-sm text-slate-600">Outstanding: <span className="font-bold text-red-700">{inr(s?.outstanding || 0)}</span></div>
          <Field label="Amount (₹)" required>
            <Input type="number" min="0" step="0.01" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
          </Field>
          <Field label="Payment method" required>
            <Select value={pay.paymentMethod} onChange={(e) => setPay({ ...pay, paymentMethod: e.target.value })}>
              {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Select>
          </Field>
          <Field label="Date" required>
            <Input type="date" max={getLocalDateString()} value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} />
          </Field>
          <Field label="Note"><Input placeholder="Optional" value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="secondary" onClick={() => setPayOpen(false)} disabled={saving}>Cancel</Btn>
            <Btn icon={Save} onClick={savePay} disabled={saving}>{saving ? "Saving..." : "Record payment"}</Btn>
          </div>
        </div>
      </Modal>
    </>
  );
}

function FragmentRow({ item, open, onToggle }) {
  return (
    <>
      <tr className="hover:bg-slate-50">
        <td className="px-4 py-2.5">
          <div className="font-medium text-slate-800">{item.name}</div>
          {item.usedOn.length > 0 && (
            <button onClick={onToggle} className="mt-0.5 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
              Used on {item.usedOn.length} repair{item.usedOn.length === 1 ? "" : "s"}
              <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          )}
        </td>
        <td className="px-3 py-2.5 text-right text-slate-700">{item.purchasedQty}</td>
        <td className="px-3 py-2.5 text-right text-slate-700">{item.usedQty}</td>
        <td className="px-3 py-2.5 text-right text-slate-700">{item.returnedQty}</td>
        <td className="px-3 py-2.5 text-right">
          <span className={`font-semibold ${item.inStock > 0 ? "text-emerald-700" : "text-slate-400"}`}>{item.inStock}</span>
        </td>
        <td className="px-4 py-2.5 text-right text-slate-700">{inr(item.costPrice)}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} className="bg-blue-50/40 px-4 py-2">
            <div className="space-y-1">
              {item.usedOn.map((u) => (
                <div key={u.mobileId} className="flex flex-wrap justify-between gap-2 text-xs text-slate-700">
                  <span><span className="font-medium">{u.device || "Device"}</span>{u.client ? ` — ${u.client}` : ""}</span>
                  <span className="text-slate-500">{u.quantity} pc · {fmtDate(u.date)}</span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

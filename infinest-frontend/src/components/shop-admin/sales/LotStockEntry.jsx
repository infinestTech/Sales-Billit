"use client";
// Master inventory stock-in for pouches and tempered glass bought as lots (lotStock.js): one supplier bill,
// one line per price category (e.g. tempered glass D8 × 1000 for ₹15,000 → ₹15 per piece). Saved through
// POST /api/in-stock; SalesServer names each line from its category (TEMPER-D8) so it is supplied, labelled
// and scanned like any other stock. Categories are managed in LotCategoryManager.
import React from "react";
import * as LS from "./lotStock";
import LotCategoryManager from "./LotCategoryManager";

const LSE_CSS = `
.lse-overlay{position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;z-index:1050;padding:20px}
.lse-modal{background:#f8fafc;border-radius:16px;width:100%;max-width:860px;max-height:94vh;display:flex;flex-direction:column;box-shadow:0 30px 60px rgba(15,23,42,.3);overflow:hidden}
.lse-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 22px;background:#fff;border-bottom:1px solid #e2e8f0}
.lse-head h2{margin:0;font-size:19px;font-weight:700;color:#0f172a}
.lse-head p{margin:2px 0 0;font-size:13px;color:#64748b}
.lse-x{border:none;background:#f1f5f9;color:#475569;width:34px;height:34px;border-radius:9px;font-size:16px;cursor:pointer}
.lse-body{flex:1;overflow-y:auto;padding:18px 22px 24px}
.lse-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;margin-bottom:14px}
.lse-grid{display:grid;gap:12px}
.lse-g-bill{grid-template-columns:2fr 1fr 1fr}
.lse-g-pay{grid-template-columns:1fr 1fr;margin-top:12px}
.lse-g-line{grid-template-columns:1fr 1fr 1.4fr 0.8fr 1fr auto;align-items:start}
.lse-f label{display:block;font-size:12px;font-weight:600;color:#475569;margin-bottom:5px}
.lse-f label .req{color:#ef4444}
.lse-in{width:100%;box-sizing:border-box;height:40px;padding:0 10px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:14px;color:#0f172a;background:#fff;outline:none}
.lse-in:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.15)}
.lse-in.bad{border-color:#f87171}
.lse-hint{font-size:11.5px;margin-top:4px;min-height:14px;color:#64748b}
.lse-hint.bad{color:#dc2626}
.lse-seg{display:inline-flex;background:#f1f5f9;border-radius:10px;padding:3px;gap:2px}
.lse-seg button{border:none;background:transparent;padding:7px 14px;border-radius:8px;font-size:13px;font-weight:600;color:#475569;cursor:pointer}
.lse-seg button.on{background:#fff;color:#4338ca;box-shadow:0 1px 3px rgba(15,23,42,.12)}
.lse-link{border:none;background:none;color:#4f46e5;font-size:12px;font-weight:600;cursor:pointer;padding:0;margin-left:6px}
.lse-del{border:none;background:#f1f5f9;color:#475569;height:40px;width:40px;border-radius:9px;cursor:pointer;margin-top:22px}
.lse-del:hover{background:#fee2e2;color:#dc2626}
.lse-add{width:100%;border:2px dashed #cbd5e1;background:#fff;border-radius:12px;padding:12px;font-size:14px;font-weight:600;color:#334155;cursor:pointer}
.lse-add:hover{border-color:#6366f1;color:#4338ca;background:#eef2ff}
.lse-foot{background:#fff;border-top:1px solid #e2e8f0;padding:12px 22px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
.lse-sum{display:flex;gap:20px;font-size:12px;color:#64748b}
.lse-sum b{display:block;font-size:16px;color:#0f172a}
.lse-btn{height:42px;padding:0 18px;border-radius:10px;border:none;font-size:14px;font-weight:700;cursor:pointer}
.lse-btn.ghost{background:#f1f5f9;color:#475569}
.lse-btn.primary{background:linear-gradient(135deg,#6366f1,#7c3aed);color:#fff}
.lse-btn:disabled{opacity:.6;cursor:wait}
.lse-alert{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;border-radius:10px;padding:10px 14px;font-size:13px;margin-bottom:14px}
@media (max-width:760px){
  .lse-overlay{padding:0;align-items:stretch}
  .lse-modal{max-height:none;height:100%;border-radius:0}
  .lse-g-bill,.lse-g-pay{grid-template-columns:1fr}
  .lse-g-line{grid-template-columns:1fr 1fr}
  .lse-del{margin-top:0}
}
`;

let lseSeq = 0;
const newLine = (lotType) => ({ key: "l" + ++lseSeq, lotType: lotType || "temper", lotCategory: "", productNo: "", qty: "", amount: "" });
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const money = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(num(n));
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export default function LotStockEntry({ salesUrl, token, suppliers = [], onClose, onSaved }) {
  const [categories, setCategories] = React.useState([]);
  const [manage, setManage] = React.useState(null);
  const [supplierId, setSupplierId] = React.useState("");
  const [billNo, setBillNo] = React.useState("");
  const [billDate, setBillDate] = React.useState(today());
  const [payType, setPayType] = React.useState("normal");
  const [gstAmount, setGstAmount] = React.useState("");
  const [lines, setLines] = React.useState([newLine()]);
  const [showErrors, setShowErrors] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  const loadCategories = () => LS.fetchLotCategories(salesUrl, token).then(setCategories).catch((e) => setError(e.message));
  React.useEffect(() => { loadCategories(); }, []);

  const patch = (key, fields) => setLines((l) => l.map((x) => (x.key === key ? { ...x, ...fields } : x)));
  const lineErrors = (l) => {
    const e = {};
    if (!l.lotCategory) e.lotCategory = "Select a category";
    if (!(Math.floor(num(l.qty)) >= 1)) e.qty = "At least 1";
    if (!(num(l.amount) > 0)) e.amount = "Enter what you paid";
    return e;
  };
  const total = lines.reduce((s, l) => s + num(l.amount), 0);
  const units = lines.reduce((s, l) => s + Math.max(0, Math.floor(num(l.qty))), 0);

  const save = async () => {
    setShowErrors(true);
    setError("");
    if (!supplierId || lines.some((l) => Object.keys(lineErrors(l)).length)) return;
    setSaving(true);
    try {
      const res = await fetch(salesUrl + "/api/in-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          supplier_id: supplierId,
          supplierAmount: total,
          gstAmount: num(gstAmount),
          purchaseType: payType,
          creditAmount: payType === "credit" ? total : 0,
          billNo: billNo.trim(),
          billDate: billDate || undefined,
          category: "Accessories",
          items: lines.map((l) => {
            const qty = Math.floor(num(l.qty));
            return { lotType: l.lotType, lotCategory: l.lotCategory, productNo: String(l.productNo || "").trim(), quantity: qty, costPrice: LS.lotUnitCost(l.amount, qty), imes: [] };
          }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || "Could not save the stock");
      onSaved && onSaved(data);
    } catch (e) {
      setError(e.message || "Could not save the stock");
      setSaving(false);
    }
  };

  const requestClose = () => {
    if (saving) return;
    const dirty = supplierId || billNo || lines.some((l) => l.lotCategory || l.qty || l.amount);
    if (dirty && !window.confirm("Discard this stock entry?")) return;
    onClose();
  };

  return (
    <div className="lse-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) requestClose(); }}>
      <style>{LSE_CSS}</style>
      <div className="lse-modal" role="dialog" aria-modal="true" aria-labelledby="lse-title"
        onKeyDown={(e) => { if (e.key === "Escape" && !manage) requestClose(); }}>
        <div className="lse-head">
          <div>
            <h2 id="lse-title">Add pouch / tempered lot</h2>
            <p>Stock by price category — the quantity and what you paid set the cost per piece</p>
          </div>
          <button type="button" className="lse-x" onClick={requestClose} aria-label="Close">✕</button>
        </div>

        <div className="lse-body">
          {error && <div className="lse-alert" role="alert">{error}</div>}

          <div className="lse-card">
            <div className="lse-grid lse-g-bill">
              <div className="lse-f">
                <label htmlFor="lse-supplier">Supplier <span className="req">*</span></label>
                <select id="lse-supplier" className={"lse-in" + (showErrors && !supplierId ? " bad" : "")} value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)} autoFocus>
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => <option key={s._id} value={s._id}>{s.supplierName || s.agencyName || s._id}</option>)}
                </select>
                <div className="lse-hint bad">{showErrors && !supplierId ? "Select the supplier" : ""}</div>
              </div>
              <div className="lse-f">
                <label htmlFor="lse-billno">Bill no.</label>
                <input id="lse-billno" className="lse-in" value={billNo} maxLength={60} onChange={(e) => setBillNo(e.target.value)} placeholder="Optional" />
              </div>
              <div className="lse-f">
                <label htmlFor="lse-billdate">Bill date</label>
                <input id="lse-billdate" className="lse-in" type="date" value={billDate} max={today()} onChange={(e) => setBillDate(e.target.value)} />
              </div>
            </div>
            <div className="lse-grid lse-g-pay">
              <div className="lse-f">
                <label>Payment</label>
                <div className="lse-seg" role="radiogroup" aria-label="Payment">
                  <button type="button" role="radio" aria-checked={payType === "normal"} className={payType === "normal" ? "on" : ""} onClick={() => setPayType("normal")}>💵 Paid</button>
                  <button type="button" role="radio" aria-checked={payType === "credit"} className={payType === "credit" ? "on" : ""} onClick={() => setPayType("credit")}>🧾 On credit</button>
                </div>
                <div className="lse-hint">{payType === "credit" ? "Adds " + money(total) + " to the supplier's credit" : ""}</div>
              </div>
              <div className="lse-f">
                <label htmlFor="lse-gst">GST amount</label>
                <input id="lse-gst" className="lse-in" type="number" min="0" step="0.01" value={gstAmount} placeholder="Optional"
                  onChange={(e) => setGstAmount(e.target.value)} onWheel={(e) => e.currentTarget.blur()} />
              </div>
            </div>
          </div>

          {lines.map((l, idx) => {
            const le = showErrors ? lineErrors(l) : {};
            const cats = categories.filter((c) => c.type === l.lotType);
            const cat = cats.find((c) => c.name === l.lotCategory);
            const unit = LS.lotUnitCost(l.amount, l.qty);
            return (
              <div key={l.key} className="lse-card">
                <div className="lse-grid lse-g-line">
                  <div className="lse-f">
                    <label htmlFor={"lt-" + l.key}>#{idx + 1} Type</label>
                    <select id={"lt-" + l.key} className="lse-in" value={l.lotType} onChange={(e) => patch(l.key, { lotType: e.target.value, lotCategory: "" })}>
                      {LS.LOT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="lse-f">
                    <label htmlFor={"lp-" + l.key}>Product Code</label>
                    <input id={"lp-" + l.key} className="lse-in" value={l.productNo} maxLength={60}
                      placeholder={cat ? cat.productNo : "Optional"}
                      onChange={(e) => patch(l.key, { productNo: e.target.value })} />
                    <div className="lse-hint">{l.productNo.trim() ? "" : "Blank = category code"}</div>
                  </div>
                  <div className="lse-f">
                    <label htmlFor={"lc-" + l.key}>Category <span className="req">*</span>
                      <button type="button" className="lse-link" onClick={() => setManage(l.lotType)}>Manage</button>
                    </label>
                    <select id={"lc-" + l.key} className={"lse-in" + (le.lotCategory ? " bad" : "")} value={l.lotCategory}
                      onChange={(e) => patch(l.key, { lotCategory: e.target.value })}>
                      <option value="">{cats.length ? "Select category" : "No categories yet — use Manage"}</option>
                      {cats.map((c) => <option key={c.id} value={c.name}>{c.name} · {LS.formatPriceRange(c.minPrice, c.maxPrice)}</option>)}
                    </select>
                    <div className="lse-hint bad">{le.lotCategory || ""}</div>
                  </div>
                  <div className="lse-f">
                    <label htmlFor={"lq-" + l.key}>Quantity <span className="req">*</span></label>
                    <input id={"lq-" + l.key} className={"lse-in" + (le.qty ? " bad" : "")} type="number" min="1" step="1" value={l.qty} placeholder="1000"
                      onChange={(e) => patch(l.key, { qty: e.target.value })} onWheel={(e) => e.currentTarget.blur()} />
                    <div className="lse-hint bad">{le.qty || ""}</div>
                  </div>
                  <div className="lse-f">
                    <label htmlFor={"la-" + l.key}>Amount paid ₹ <span className="req">*</span></label>
                    <input id={"la-" + l.key} className={"lse-in" + (le.amount ? " bad" : "")} type="number" min="0" step="0.01" value={l.amount} placeholder="15000"
                      onChange={(e) => patch(l.key, { amount: e.target.value })} onWheel={(e) => e.currentTarget.blur()} />
                    <div className={"lse-hint" + (le.amount ? " bad" : "")}>
                      {le.amount || (unit > 0 ? money(unit) + " per piece" + (cat ? " · sells " + LS.formatPriceRange(cat.minPrice, cat.maxPrice) : "") : "")}
                    </div>
                  </div>
                  <button type="button" className="lse-del" aria-label={"Remove line " + (idx + 1)}
                    onClick={() => setLines((ls) => (ls.length === 1 ? [newLine(l.lotType)] : ls.filter((x) => x.key !== l.key)))}>🗑</button>
                </div>
              </div>
            );
          })}
          <button type="button" className="lse-add" onClick={() => setLines((ls) => [...ls, newLine(ls[ls.length - 1]?.lotType)])}>＋ Add another category</button>
        </div>

        <div className="lse-foot">
          <div className="lse-sum" aria-live="polite">
            <div>Lines<b>{lines.length}</b></div>
            <div>Pieces<b>{units}</b></div>
            <div>Bill total<b>{money(total)}</b></div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="lse-btn ghost" onClick={requestClose} disabled={saving}>Cancel</button>
            <button type="button" className="lse-btn primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save stock"}</button>
          </div>
        </div>
      </div>
      {manage && (
        <LotCategoryManager salesUrl={salesUrl} getToken={() => token} initialType={manage}
          onClose={() => setManage(null)} onChanged={loadCategories} />
      )}
    </div>
  );
}

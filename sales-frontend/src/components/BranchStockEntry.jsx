// Branch "Add Purchase" form: one supplier bill -> branch stock (POST /api/branch-supply, source "manual").
// Every item is a card that is a Mobile (tracked by IMEI; quantity = number of IMEIs scanned), an
// Accessory (plain quantity) or a pouch / tempered glass lot (a price category such as "D8", a quantity and
// what was paid for the whole lot; cost per piece = amount / quantity). Enter moves to the next field (barcode scanners send Enter), Ctrl+Enter saves,
// Esc closes. Used by BranchInStock on desktop and mobile.

const BSE_LAST_TYPE_KEY = 'branchStockEntry.lastType';
let bseKeySeq = 0;

function bseNewItem(type) {
  return {
    key: 'it' + (++bseKeySeq),
    type: type === 'accessory' || type === 'lot' ? type : 'mobile',
    productName: '', productNo: '',
    qty: 1, costPrice: '',
    warrantyMonths: '', warrantyDetails: '',
    imeis: [], imeiDraft: '', imeiNote: '',
    lotType: 'temper', lotCategory: '', lotAmount: ''
  };
}

function bseToday() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const bseMoney = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(n) || 0);
const bseNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const bseCleanImei = (s) => String(s || '').replace(/\s+/g, '').trim();

// A0..Z9, then AA0.. — same scheme the branch has always used for auto product codes
function bseNextProductNo(used) {
  const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', D = '0123456789';
  for (const a of L) for (const d of D) if (!used.has(a + d)) return a + d;
  for (const a of L) for (const b of L) for (const d of D) if (!used.has(a + b + d)) return a + b + d;
  let r; do { r = Math.random().toString(36).slice(2, 6).toUpperCase(); } while (used.has(r));
  return r;
}

const BSE_CSS = `
.bse-overlay{position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px}
.bse-modal{background:#f8fafc;border-radius:18px;width:100%;max-width:1040px;max-height:94vh;display:flex;flex-direction:column;box-shadow:0 30px 60px rgba(15,23,42,.3);overflow:hidden}
.bse-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 24px;background:#fff;border-bottom:1px solid #e2e8f0}
.bse-head h2{margin:0;font-size:20px;font-weight:700;color:#0f172a}
.bse-head p{margin:2px 0 0;font-size:13px;color:#64748b}
.bse-x{border:none;background:#f1f5f9;color:#475569;width:36px;height:36px;border-radius:10px;font-size:18px;cursor:pointer;flex-shrink:0}
.bse-x:hover{background:#e2e8f0}
.bse-body{flex:1;overflow-y:auto;padding:20px 24px 28px}
.bse-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px;margin-bottom:16px}
.bse-card.bse-err{border-color:#fca5a5;box-shadow:0 0 0 3px rgba(239,68,68,.08)}
.bse-sec{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 14px}
.bse-sec h3{margin:0;font-size:15px;font-weight:700;color:#0f172a}
.bse-grid{display:grid;gap:14px}
.bse-g-bill{grid-template-columns:2fr 1fr 1fr}
.bse-g-bill2{grid-template-columns:1fr 1fr 1fr;margin-top:14px}
.bse-g-name{grid-template-columns:2fr 1fr}
.bse-g-price{grid-template-columns:repeat(3,1fr);margin-top:14px}
.bse-f label{display:block;font-size:12px;font-weight:600;color:#475569;margin-bottom:6px}
.bse-f label .req{color:#ef4444}
.bse-f label .opt{color:#94a3b8;font-weight:400}
.bse-in{width:100%;box-sizing:border-box;height:42px;padding:0 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;color:#0f172a;background:#fff;outline:none;transition:border-color .15s,box-shadow .15s}
.bse-in:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.15)}
.bse-in.bse-bad{border-color:#f87171}
.bse-money{position:relative}
.bse-money span{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#94a3b8;font-size:14px;pointer-events:none}
.bse-money .bse-in{padding-left:26px}
.bse-hint{font-size:11.5px;margin-top:5px;min-height:14px;color:#64748b}
.bse-hint.bad{color:#dc2626}.bse-hint.warn{color:#b45309}.bse-hint.good{color:#15803d}
.bse-seg{display:inline-flex;background:#f1f5f9;border-radius:10px;padding:3px;gap:2px}
.bse-seg button{border:none;background:transparent;padding:7px 14px;border-radius:8px;font-size:13px;font-weight:600;color:#475569;cursor:pointer;white-space:nowrap}
.bse-seg button.on{background:#fff;color:#4338ca;box-shadow:0 1px 3px rgba(15,23,42,.12)}
.bse-seg button:focus-visible,.bse-btn:focus-visible,.bse-icon:focus-visible{outline:2px solid #6366f1;outline-offset:2px}
.bse-itemhead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.bse-num{font-size:13px;font-weight:700;color:#64748b;margin-right:10px}
.bse-icon{border:none;background:#f1f5f9;color:#475569;height:34px;padding:0 12px;border-radius:9px;font-size:13px;cursor:pointer}
.bse-icon:hover{background:#e2e8f0}
.bse-icon.del:hover{background:#fee2e2;color:#dc2626}
.bse-step{display:flex;height:42px;border:1.5px solid #e2e8f0;border-radius:10px;overflow:hidden;background:#fff}
.bse-step button{width:38px;border:none;background:#f8fafc;font-size:18px;color:#475569;cursor:pointer}
.bse-step button:hover{background:#eef2ff}
.bse-step input{flex:1;min-width:0;border:none;text-align:center;font-size:14px;font-weight:600;outline:none}
.bse-imei{margin-top:14px;background:#f8fafc;border:1.5px dashed #c7d2fe;border-radius:12px;padding:14px}
.bse-imei.bse-bad{border-color:#f87171;background:#fef2f2}
.bse-imeirow{display:flex;gap:8px}
.bse-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.bse-chip{display:inline-flex;align-items:center;gap:6px;background:#eef2ff;color:#3730a3;border:1px solid #c7d2fe;border-radius:999px;padding:5px 6px 5px 12px;font-size:13px;font-family:ui-monospace,Menlo,Consolas,monospace}
.bse-chip.warn{background:#fffbeb;color:#92400e;border-color:#fcd34d}
.bse-chip button{border:none;background:rgba(15,23,42,.08);width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:12px;line-height:20px;color:inherit;padding:0}
.bse-adds{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.bse-g-lot{grid-template-columns:1fr 1fr 1.4fr 1fr 1fr}
.bse-link{border:none;background:none;color:#4f46e5;font-size:12px;font-weight:600;cursor:pointer;padding:0;margin-left:6px}
.bse-add{border:2px dashed #cbd5e1;background:#fff;border-radius:14px;padding:16px;font-size:14px;font-weight:600;color:#334155;cursor:pointer;transition:all .15s}
.bse-add:hover{border-color:#6366f1;color:#4338ca;background:#eef2ff}
.bse-foot{background:#fff;border-top:1px solid #e2e8f0;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.bse-sum{display:flex;gap:22px;flex-wrap:wrap}
.bse-sum div{font-size:12px;color:#64748b}
.bse-sum b{display:block;font-size:16px;color:#0f172a}
.bse-actions{display:flex;gap:10px;align-items:center;margin-left:auto}
.bse-btn{height:44px;padding:0 20px;border-radius:11px;border:none;font-size:14px;font-weight:700;cursor:pointer}
.bse-btn.ghost{background:#f1f5f9;color:#475569}
.bse-btn.primary{background:linear-gradient(135deg,#6366f1,#7c3aed);color:#fff;box-shadow:0 6px 16px rgba(99,102,241,.3)}
.bse-btn.primary:disabled{opacity:.6;cursor:wait}
.bse-alert{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;border-radius:10px;padding:10px 14px;font-size:13px;margin-bottom:16px}
.bse-kbd{font-size:11px;color:#94a3b8}
.bse-row{display:flex;align-items:center;gap:8px}
.bse-qtyfixed{display:flex;align-items:center;background:#f8fafc;color:#475569;font-weight:600}
/* The app's global mobile CSS forces 44px/100%-wide buttons; keep this form's own sizing */
@media (max-width:768px){
  .bse-modal button{min-width:0 !important;min-height:0 !important;margin-bottom:0 !important}
  .bse-modal .bse-seg button{padding:9px 12px !important;font-size:13px !important}
  .bse-modal .bse-icon{padding:0 10px !important;font-size:13px !important;height:38px}
  .bse-modal .bse-x{padding:0 !important;font-size:18px !important;width:40px;height:40px}
  .bse-modal .bse-step button{padding:0 !important;font-size:20px !important;width:44px}
  .bse-modal .bse-chip button{padding:0 !important;font-size:12px !important}
  .bse-modal .bse-btn{padding:0 16px !important;font-size:15px !important}
  .bse-modal .bse-add{padding:14px 10px !important;font-size:14px !important}
  .bse-modal .bse-in{font-size:16px}
}
@media (max-width:760px){
  .bse-overlay{padding:0;align-items:stretch}
  .bse-modal{max-height:none;height:100%;border-radius:0}
  .bse-head,.bse-body,.bse-foot{padding-left:14px;padding-right:14px}
  .bse-g-bill,.bse-g-bill2,.bse-g-name{grid-template-columns:1fr}
  .bse-g-price,.bse-g-lot{grid-template-columns:1fr 1fr}
  .bse-adds{grid-template-columns:1fr}
  .bse-kbd{display:none}
  .bse-actions{width:100%}
  .bse-actions .bse-btn{flex:1}
}
`;

function BranchStockEntry({ salesUrl, getToken, suppliers, branchEntries, onClose, onSaved }) {
  const [supplierId, setSupplierId] = React.useState('');
  const [billNo, setBillNo] = React.useState('');
  const [billDate, setBillDate] = React.useState(bseToday());
  const [payType, setPayType] = React.useState('normal'); // normal (cash/paid) | credit
  const [billAmount, setBillAmount] = React.useState('');
  const [gstAmount, setGstAmount] = React.useState('');
  const [items, setItems] = React.useState(() => {
    let t = 'mobile';
    try { t = localStorage.getItem(BSE_LAST_TYPE_KEY) || 'mobile'; } catch (_) {}
    return [bseNewItem(t)];
  });
  const [showErrors, setShowErrors] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState('');
  const focusKey = React.useRef(null); // item whose name box gets focus after it is added
  const modalRef = React.useRef(null);
  const LS = window.LotStock;

  // Pouch / tempered price categories (shop-wide list, managed in LotCategoryManager)
  const [lotCategories, setLotCategories] = React.useState([]);
  const [manageLots, setManageLots] = React.useState(null); // lot type the category manager opens on
  const loadLotCategories = () => LS.fetchLotCategories(salesUrl, getToken()).then(setLotCategories).catch(() => {});
  React.useEffect(() => { loadLotCategories(); }, []);
  const lotCategoryOf = (it) => lotCategories.find(c => c.type === it.lotType && c.name === it.lotCategory) || null;

  // IMEIs already held by this branch, to stop the same handset being stocked twice
  const stockedImeis = React.useMemo(() => {
    const s = new Set();
    (branchEntries || []).forEach(r => (Array.isArray(r.imes) ? r.imes : []).forEach(x => { const c = bseCleanImei(x); if (c) s.add(c); }));
    return s;
  }, [branchEntries]);

  // ---- item helpers ----
  const patch = (key, fields) => setItems(list => list.map(it => it.key === key ? { ...it, ...fields } : it));
  const rememberType = (t) => { try { localStorage.setItem(BSE_LAST_TYPE_KEY, t); } catch (_) {} };
  const addItem = (type) => { const it = bseNewItem(type); focusKey.current = it.key; rememberType(type); setItems(l => [...l, it]); };
  const duplicateItem = (it) => {
    const copy = { ...bseNewItem(it.type), productName: it.productName, costPrice: it.costPrice, warrantyMonths: it.warrantyMonths, warrantyDetails: it.warrantyDetails, qty: it.type === 'mobile' ? 1 : it.qty, lotType: it.lotType, lotCategory: it.lotCategory, productNo: it.type === 'lot' ? it.productNo : '' };
    focusKey.current = copy.key;
    setItems(l => { const i = l.findIndex(x => x.key === it.key); const n = l.slice(); n.splice(i + 1, 0, copy); return n; });
  };
  const removeItem = (key) => setItems(l => (l.length === 1 ? [bseNewItem(l[0].type)] : l.filter(x => x.key !== key)));
  const setType = (it, type) => { rememberType(type); patch(it.key, { type, imeiNote: '' }); };

  // Adds one or many IMEIs (pasted lists split on spaces, commas or new lines)
  const addImeis = (it, raw) => {
    const parts = String(raw || '').split(/[\s,;]+/).map(bseCleanImei).filter(Boolean);
    if (!parts.length) return;
    const inForm = new Set();
    items.forEach(x => x.imeis.forEach(i => inForm.add(i)));
    const added = [], dup = [];
    parts.forEach(p => {
      if (inForm.has(p) || added.includes(p)) dup.push(p + ' (already in this bill)');
      else if (stockedImeis.has(p)) dup.push(p + ' (already in stock)');
      else added.push(p);
    });
    patch(it.key, { imeis: [...it.imeis, ...added], imeiDraft: '', imeiNote: dup.length ? 'Skipped ' + dup.join(', ') : '' });
  };

  // ---- derived values & validation ----
  const qtyOf = (it) => it.type === 'mobile' ? it.imeis.length : Math.max(0, Math.floor(bseNum(it.qty)));
  const totals = React.useMemo(() => {
    let units = 0, cost = 0;
    items.forEach(it => { const q = qtyOf(it); units += q; cost += it.type === 'lot' ? bseNum(it.lotAmount) : q * bseNum(it.costPrice); });
    return { units, cost };
  }, [items]);
  const creditAmount = bseNum(billAmount) > 0 ? bseNum(billAmount) : totals.cost;

  const itemErrors = (it) => {
    const e = {};
    if (it.type === 'lot') {
      if (!it.lotCategory) e.lotCategory = 'Select a category';
      if (!(qtyOf(it) > 0)) e.qty = 'Quantity must be at least 1';
      if (!(bseNum(it.lotAmount) > 0)) e.lotAmount = 'Enter what you paid for this lot';
      return e;
    }
    if (!it.productName.trim()) e.productName = 'Enter the product name';
    if (it.type === 'mobile' && it.imeis.length === 0 && !bseCleanImei(it.imeiDraft)) e.imeis = 'Scan or type at least one IMEI';
    if (it.type === 'accessory' && !(qtyOf(it) > 0)) e.qty = 'Quantity must be at least 1';
    if (!(bseNum(it.costPrice) > 0)) e.costPrice = 'Enter the cost price';
    return e;
  };
  const errors = React.useMemo(() => {
    const top = {};
    if (!supplierId) top.supplier = 'Select the supplier';
    if (payType === 'credit' && !(creditAmount > 0)) top.credit = 'Enter the bill amount for a credit purchase';
    const perItem = {};
    items.forEach(it => { const e = itemErrors(it); if (Object.keys(e).length) perItem[it.key] = e; });
    return { top, perItem, count: Object.keys(top).length + Object.keys(perItem).length };
  }, [supplierId, payType, creditAmount, items]);
  const err = (key, field) => showErrors && errors.perItem[key] && errors.perItem[key][field];

  const dirty = items.some(it => it.productName || it.imeis.length || it.costPrice || it.lotCategory || it.lotAmount) || supplierId || billNo || billAmount;
  const requestClose = () => { if (saving) return; if (dirty && !window.confirm('Discard this purchase entry?')) return; onClose(); };

  // ---- save ----
  const save = async () => {
    // Commit IMEIs still sitting in the input boxes
    const finalItems = items.map(it => {
      const d = bseCleanImei(it.imeiDraft);
      return it.type === 'mobile' && d && !it.imeis.includes(d) ? { ...it, imeis: [...it.imeis, d], imeiDraft: '' } : it;
    });
    if (finalItems.some((it, i) => it !== items[i])) setItems(finalItems);
    setShowErrors(true);
    setSaveError('');
    const hasErr = !supplierId || (payType === 'credit' && !(creditAmount > 0)) || finalItems.some(it => Object.keys(itemErrors(it)).length);
    if (hasErr) {
      setTimeout(() => { const el = modalRef.current && modalRef.current.querySelector('.bse-err, .bse-bad'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 30);
      return;
    }

    const used = new Set((branchEntries || []).map(r => String(r.productNo || '').trim()).filter(Boolean));
    finalItems.forEach(it => { if (it.productNo.trim()) used.add(it.productNo.trim()); });
    const payloadItems = finalItems.map(it => {
      // Lots: the server names the item from the category; the code is the one typed, else TEMPER-D8
      if (it.type === 'lot') {
        return { lotType: it.lotType, lotCategory: it.lotCategory, productNo: String(it.productNo || '').trim(), qty: qtyOf(it), costPrice: LS.lotUnitCost(it.lotAmount, qtyOf(it)), imes: [] };
      }
      let productNo = it.productNo.trim();
      if (!productNo) { productNo = bseNextProductNo(used); used.add(productNo); }
      return {
        productNo,
        productName: it.productName.trim(),
        category: it.type === 'mobile' ? 'Mobile' : 'Accessories',
        qty: qtyOf(it),
        costPrice: bseNum(it.costPrice),
        warrantyMonths: Math.max(0, Math.floor(bseNum(it.warrantyMonths))),
        warrantyDetails: it.warrantyDetails.trim(),
        imes: it.type === 'mobile' ? it.imeis : []
      };
    });
    const types = new Set(finalItems.map(it => it.type));
    const body = {
      supplier_id: supplierId,
      billNo: billNo.trim(),
      billDate: billDate || undefined,
      purchaseType: payType,
      creditAmount: payType === 'credit' ? creditAmount : 0,
      supplierAmount: bseNum(billAmount),
      gstAmount: bseNum(gstAmount),
      category: types.size === 1 && !types.has('lot') ? (types.has('mobile') ? 'Mobile' : 'Accessories') : undefined,
      items: payloadItems
    };

    setSaving(true);
    try {
      const res = await fetch((salesUrl || '') + '/api/branch-supply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || 'Could not save the purchase');
      onSaved && onSaved(data);
    } catch (e) {
      setSaveError(e.message || 'Could not save the purchase');
      setSaving(false);
    }
  };

  // ---- keyboard & focus ----
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  React.useEffect(() => {
    if (!focusKey.current || !modalRef.current) return;
    const el = modalRef.current.querySelector('[data-focus="' + focusKey.current + '"]');
    focusKey.current = null;
    if (el) { el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }, [items.length]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); requestClose(); return; }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); return; }
    // Enter jumps to the next field instead of doing nothing (IMEI boxes handle Enter themselves)
    const t = e.target;
    if (e.key === 'Enter' && t.tagName === 'INPUT' && !t.dataset.imei) {
      e.preventDefault();
      const fields = Array.from(modalRef.current.querySelectorAll('input.bse-in, select.bse-in, .bse-step input')).filter(x => !x.disabled && x.offsetParent !== null);
      const i = fields.indexOf(t);
      if (i >= 0 && fields[i + 1]) fields[i + 1].focus();
    }
  };

  // ---- render helpers ----
  const Money = ({ value, onChange, bad, focusAttr, label }) => (
    <div className="bse-money">
      <span>₹</span>
      <input className={'bse-in' + (bad ? ' bse-bad' : '')} type="number" inputMode="decimal" min="0" step="0.01"
        value={value} onChange={onChange} placeholder="0.00" aria-label={label} data-focus={focusAttr}
        onWheel={e => e.currentTarget.blur()} />
    </div>
  );

  const selectedSupplier = suppliers.find(s => s._id === supplierId);

  return (
    <div className="bse-overlay" onMouseDown={e => { if (e.target === e.currentTarget) requestClose(); }}>
      <style>{BSE_CSS}</style>
      <div className="bse-modal" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="bse-title" onKeyDown={onKeyDown}>
        <div className="bse-head">
          <div>
            <h2 id="bse-title">Add Purchase</h2>
            <p>Enter a supplier bill — mobiles by IMEI, accessories by quantity, pouches &amp; tempered glass by category</p>
          </div>
          <button type="button" className="bse-x" onClick={requestClose} aria-label="Close">✕</button>
        </div>

        <div className="bse-body">
          {saveError && <div className="bse-alert" role="alert">{saveError}</div>}

          {/* Bill details */}
          <div className={'bse-card' + (showErrors && Object.keys(errors.top).length ? ' bse-err' : '')}>
            <div className="bse-sec"><h3>Bill details</h3></div>
            <div className="bse-grid bse-g-bill">
              <div className="bse-f">
                <label htmlFor="bse-supplier">Supplier <span className="req">*</span></label>
                <select id="bse-supplier" className={'bse-in' + (showErrors && errors.top.supplier ? ' bse-bad' : '')}
                  value={supplierId} onChange={e => setSupplierId(e.target.value)} autoFocus>
                  <option value="">Select supplier</option>
                  {suppliers.map(s => <option key={s._id} value={s._id}>{s.supplierName || s.agencyName || s._id}</option>)}
                </select>
                <div className={'bse-hint' + (showErrors && errors.top.supplier ? ' bad' : '')}>
                  {showErrors && errors.top.supplier ? errors.top.supplier : (selectedSupplier && selectedSupplier.mobileNumber ? '📞 ' + selectedSupplier.mobileNumber : (suppliers.length ? '' : 'No suppliers yet — add one under Dealers'))}
                </div>
              </div>
              <div className="bse-f">
                <label htmlFor="bse-billno">Bill no. <span className="opt">(optional)</span></label>
                <input id="bse-billno" className="bse-in" value={billNo} onChange={e => setBillNo(e.target.value)} placeholder="e.g. INV-1042" maxLength={60} />
              </div>
              <div className="bse-f">
                <label htmlFor="bse-billdate">Bill date</label>
                <input id="bse-billdate" className="bse-in" type="date" value={billDate} max={bseToday()} onChange={e => setBillDate(e.target.value)} />
              </div>
            </div>
            <div className="bse-grid bse-g-bill2">
              <div className="bse-f">
                <label>Payment</label>
                <div className="bse-seg" role="radiogroup" aria-label="Payment">
                  <button type="button" role="radio" aria-checked={payType === 'normal'} className={payType === 'normal' ? 'on' : ''} onClick={() => setPayType('normal')}>💵 Paid</button>
                  <button type="button" role="radio" aria-checked={payType === 'credit'} className={payType === 'credit' ? 'on' : ''} onClick={() => setPayType('credit')}>🧾 On credit</button>
                </div>
                <div className={'bse-hint' + (showErrors && errors.top.credit ? ' bad' : '')}>
                  {payType === 'credit' ? (showErrors && errors.top.credit ? errors.top.credit : 'Adds ' + bseMoney(creditAmount) + ' to the supplier\'s credit') : ''}
                </div>
              </div>
              <div className="bse-f">
                <label htmlFor="bse-billamt">Bill amount <span className="opt">(optional)</span></label>
                <div className="bse-money"><span>₹</span>
                  <input id="bse-billamt" className="bse-in" type="number" inputMode="decimal" min="0" step="0.01" value={billAmount}
                    onChange={e => setBillAmount(e.target.value)} placeholder={totals.cost ? totals.cost.toFixed(2) : '0.00'} onWheel={e => e.currentTarget.blur()} />
                </div>
                <div className="bse-hint">{billAmount === '' && totals.cost ? 'Defaults to the items total' : ''}</div>
              </div>
              <div className="bse-f">
                <label htmlFor="bse-gst">GST amount <span className="opt">(optional)</span></label>
                <div className="bse-money"><span>₹</span>
                  <input id="bse-gst" className="bse-in" type="number" inputMode="decimal" min="0" step="0.01" value={gstAmount}
                    onChange={e => setGstAmount(e.target.value)} placeholder="0.00" onWheel={e => e.currentTarget.blur()} />
                </div>
              </div>
            </div>
          </div>

          {/* Items */}
          {items.map((it, idx) => {
            const ie = showErrors ? (errors.perItem[it.key] || {}) : {};
            const isMobile = it.type === 'mobile';
            const isLot = it.type === 'lot';
            return (
              <div key={it.key} className={'bse-card' + (Object.keys(ie).length ? ' bse-err' : '')}>
                <div className="bse-itemhead">
                  <div className="bse-row">
                    <span className="bse-num">#{idx + 1}</span>
                    <div className="bse-seg" role="radiogroup" aria-label={'Item ' + (idx + 1) + ' type'}>
                      <button type="button" role="radio" aria-checked={isMobile} className={isMobile ? 'on' : ''} onClick={() => setType(it, 'mobile')}>📱 Mobile</button>
                      <button type="button" role="radio" aria-checked={it.type === 'accessory'} className={it.type === 'accessory' ? 'on' : ''} onClick={() => setType(it, 'accessory')}>🎧 Accessory</button>
                      <button type="button" role="radio" aria-checked={isLot} className={isLot ? 'on' : ''} onClick={() => setType(it, 'lot')}>🧩 Pouch / Tempered</button>
                    </div>
                  </div>
                  <div className="bse-row">
                    <button type="button" className="bse-icon" onClick={() => duplicateItem(it)} title="Add another item with the same name and prices">⧉ Duplicate</button>
                    <button type="button" className="bse-icon del" onClick={() => removeItem(it.key)} aria-label={'Remove item ' + (idx + 1)}>🗑 Remove</button>
                  </div>
                </div>

                {isLot ? (() => {
                  const cats = lotCategories.filter(c => c.type === it.lotType);
                  const cat = lotCategoryOf(it);
                  const unit = LS.lotUnitCost(it.lotAmount, qtyOf(it));
                  return (
                    <div className="bse-grid bse-g-lot">
                      <div className="bse-f">
                        <label htmlFor={'lt-' + it.key}>Type</label>
                        <select id={'lt-' + it.key} className="bse-in" value={it.lotType} data-focus={it.key}
                          onChange={e => patch(it.key, { lotType: e.target.value, lotCategory: '' })}>
                          {LS.LOT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                        </select>
                      </div>
                      <div className="bse-f">
                        <label htmlFor={'lp-' + it.key}>Product Code</label>
                        <input id={'lp-' + it.key} className="bse-in" value={it.productNo} maxLength={60}
                          placeholder={cat ? cat.productNo : 'Optional'}
                          onChange={e => patch(it.key, { productNo: e.target.value })} />
                        <div className="bse-hint">{it.productNo.trim() ? '' : 'Blank = category code'}</div>
                      </div>
                      <div className="bse-f">
                        <label htmlFor={'lc-' + it.key}>Category <span className="req">*</span>
                          <button type="button" className="bse-link" onClick={() => setManageLots(it.lotType)}>Manage</button>
                        </label>
                        <select id={'lc-' + it.key} className={'bse-in' + (ie.lotCategory ? ' bse-bad' : '')} value={it.lotCategory}
                          onChange={e => patch(it.key, { lotCategory: e.target.value })}>
                          <option value="">{cats.length ? 'Select category' : 'No categories yet — use Manage'}</option>
                          {cats.map(c => <option key={c.id} value={c.name}>{c.name} · {LS.formatPriceRange(c.minPrice, c.maxPrice)}</option>)}
                        </select>
                        <div className="bse-hint bad">{ie.lotCategory || ''}</div>
                      </div>
                      <div className="bse-f">
                        <label>Quantity <span className="req">*</span></label>
                        <div className="bse-step" style={ie.qty ? { borderColor: '#f87171' } : null}>
                          <button type="button" aria-label="Decrease quantity" onClick={() => patch(it.key, { qty: Math.max(1, Math.floor(bseNum(it.qty)) - 1) })}>−</button>
                          <input type="number" inputMode="numeric" min="1" value={it.qty} aria-label="Quantity"
                            onChange={e => patch(it.key, { qty: e.target.value })} onWheel={e => e.currentTarget.blur()} />
                          <button type="button" aria-label="Increase quantity" onClick={() => patch(it.key, { qty: Math.floor(bseNum(it.qty)) + 1 })}>+</button>
                        </div>
                        <div className="bse-hint bad">{ie.qty || ''}</div>
                      </div>
                      <div className="bse-f">
                        <label>Amount paid for lot <span className="req">*</span></label>
                        {Money({ value: it.lotAmount, onChange: e => patch(it.key, { lotAmount: e.target.value }), bad: ie.lotAmount, label: 'Amount paid for this lot' })}
                        <div className={'bse-hint' + (ie.lotAmount ? ' bad' : '')}>
                          {ie.lotAmount || (unit > 0 ? bseMoney(unit) + ' per piece' + (cat ? ' · sells ' + LS.formatPriceRange(cat.minPrice, cat.maxPrice) : '') : '')}
                        </div>
                      </div>
                    </div>
                  );
                })() : (<>
                <div className="bse-grid bse-g-name">
                  <div className="bse-f">
                    <label htmlFor={'n-' + it.key}>Product name <span className="req">*</span></label>
                    <input id={'n-' + it.key} data-focus={it.key} className={'bse-in' + (ie.productName ? ' bse-bad' : '')}
                      value={it.productName} onChange={e => patch(it.key, { productName: e.target.value })}
                      placeholder={isMobile ? 'e.g. Redmi Note 13 5G 8/128 Black' : 'e.g. Boat Airdopes 141'} />
                    <div className="bse-hint bad">{ie.productName || ''}</div>
                  </div>
                  <div className="bse-f">
                    <label htmlFor={'c-' + it.key}>Product code <span className="opt">(optional)</span></label>
                    <input id={'c-' + it.key} className="bse-in" value={it.productNo} onChange={e => patch(it.key, { productNo: e.target.value })} placeholder="Auto" />
                  </div>
                </div>

                <div className="bse-grid bse-g-price">
                  <div className="bse-f">
                    <label>Quantity</label>
                    {isMobile ? (
                      <div className="bse-in bse-qtyfixed" aria-live="polite">
                        {it.imeis.length} <span style={{ fontWeight: 400, marginLeft: 6, fontSize: 12 }}>from IMEIs</span>
                      </div>
                    ) : (
                      <div className="bse-step" style={ie.qty ? { borderColor: '#f87171' } : null}>
                        <button type="button" aria-label="Decrease quantity" onClick={() => patch(it.key, { qty: Math.max(1, Math.floor(bseNum(it.qty)) - 1) })}>−</button>
                        <input type="number" inputMode="numeric" min="1" value={it.qty} aria-label="Quantity"
                          onChange={e => patch(it.key, { qty: e.target.value })} onWheel={e => e.currentTarget.blur()} />
                        <button type="button" aria-label="Increase quantity" onClick={() => patch(it.key, { qty: Math.floor(bseNum(it.qty)) + 1 })}>+</button>
                      </div>
                    )}
                    <div className="bse-hint bad">{ie.qty || ''}</div>
                  </div>
                  <div className="bse-f">
                    <label>Cost price <span className="req">*</span></label>
                    {Money({ value: it.costPrice, onChange: e => patch(it.key, { costPrice: e.target.value }), bad: ie.costPrice, label: 'Cost price' })}
                    <div className="bse-hint bad">{ie.costPrice || ''}</div>
                  </div>
                  <div className="bse-f">
                    <label htmlFor={'w-' + it.key}>Warranty <span className="opt">(months)</span></label>
                    <input id={'w-' + it.key} className="bse-in" type="number" inputMode="numeric" min="0" value={it.warrantyMonths}
                      onChange={e => patch(it.key, { warrantyMonths: e.target.value })} placeholder="0" onWheel={e => e.currentTarget.blur()} />
                  </div>
                </div>

                {bseNum(it.warrantyMonths) > 0 && (
                  <div className="bse-f" style={{ marginTop: 4 }}>
                    <label htmlFor={'wd-' + it.key}>Warranty details <span className="opt">(optional)</span></label>
                    <input id={'wd-' + it.key} className="bse-in" value={it.warrantyDetails} maxLength={300}
                      onChange={e => patch(it.key, { warrantyDetails: e.target.value })} placeholder="e.g. Brand warranty, bill required" />
                  </div>
                )}

                </>)}

                {isMobile && (
                  <div className={'bse-imei' + (ie.imeis ? ' bse-bad' : '')}>
                    <label htmlFor={'i-' + it.key} style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                      IMEI numbers <span className="req" style={{ color: '#ef4444' }}>*</span>
                      <span style={{ fontWeight: 400, color: '#94a3b8' }}> — scan each handset, or paste a list</span>
                    </label>
                    <div className="bse-imeirow">
                      <input id={'i-' + it.key} data-imei="1" className="bse-in" inputMode="numeric" autoComplete="off"
                        value={it.imeiDraft} placeholder="Scan or type IMEI, then Enter"
                        onChange={e => patch(it.key, { imeiDraft: e.target.value, imeiNote: '' })}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); addImeis(it, it.imeiDraft); } }}
                        onPaste={e => { const txt = e.clipboardData.getData('text'); if (/[\s,;]/.test(txt.trim())) { e.preventDefault(); addImeis(it, txt); } }} />
                      <button type="button" className="bse-icon" style={{ height: 42 }} onClick={() => addImeis(it, it.imeiDraft)}>Add</button>
                    </div>
                    {it.imeiNote && <div className="bse-hint warn">{it.imeiNote}</div>}
                    {ie.imeis && <div className="bse-hint bad">{ie.imeis}</div>}
                    {it.imeis.length > 0 && (
                      <div className="bse-chips">
                        {it.imeis.map(im => {
                          const odd = !/^\d{15}$/.test(im);
                          return (
                            <span key={im} className={'bse-chip' + (odd ? ' warn' : '')} title={odd ? 'An IMEI is usually 15 digits — please double-check' : ''}>
                              {im}{odd ? ' ⚠' : ''}
                              <button type="button" aria-label={'Remove IMEI ' + im} onClick={() => patch(it.key, { imeis: it.imeis.filter(x => x !== im) })}>✕</button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="bse-adds">
            <button type="button" className="bse-add" onClick={() => addItem('mobile')}>＋ Add mobile</button>
            <button type="button" className="bse-add" onClick={() => addItem('accessory')}>＋ Add accessory</button>
            <button type="button" className="bse-add" onClick={() => addItem('lot')}>＋ Add pouch / tempered</button>
          </div>
        </div>

        <div className="bse-foot">
          <div className="bse-sum" aria-live="polite">
            <div>Items<b>{items.length}</b></div>
            <div>Units<b>{totals.units}</b></div>
            <div>Cost total<b>{bseMoney(totals.cost)}</b></div>
          </div>
          <div className="bse-actions">
            {showErrors && errors.count > 0 && <span style={{ color: '#dc2626', fontSize: 13, fontWeight: 600 }}>Fix {errors.count} highlighted {errors.count === 1 ? 'section' : 'sections'}</span>}
            <span className="bse-kbd">Ctrl+Enter to save</span>
            <button type="button" className="bse-btn ghost" onClick={requestClose} disabled={saving}>Cancel</button>
            <button type="button" className="bse-btn primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save purchase'}</button>
          </div>
        </div>
      </div>
      {manageLots && window.LotCategoryManager && (
        <window.LotCategoryManager salesUrl={salesUrl} getToken={getToken} initialType={manageLots}
          onClose={() => setManageLots(null)} onChanged={loadLotCategories} />
      )}
    </div>
  );
}

window.BranchStockEntry = BranchStockEntry;

// Pouch / tempered glass price categories (e.g. tempered glass "D8" = ₹18–50), shop-wide and shared with
// shop-admin. Add a category, change its price range, or delete it. The name is fixed once created
// because it is part of the printed barcode (TEMPER-D8). Opened from the Add Purchase form.

const LCM_CSS = `
.lcm-overlay{position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;z-index:1100;padding:20px}
.lcm-modal{background:#fff;border-radius:16px;width:100%;max-width:620px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 30px 60px rgba(15,23,42,.3);overflow:hidden}
.lcm-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid #e2e8f0}
.lcm-head h2{margin:0;font-size:18px;font-weight:700;color:#0f172a}
.lcm-head p{margin:2px 0 0;font-size:12.5px;color:#64748b}
.lcm-x{border:none;background:#f1f5f9;color:#475569;width:34px;height:34px;border-radius:9px;font-size:16px;cursor:pointer;flex-shrink:0}
.lcm-body{overflow-y:auto;padding:16px 20px 20px}
.lcm-seg{display:inline-flex;background:#f1f5f9;border-radius:10px;padding:3px;gap:2px;margin-bottom:14px}
.lcm-seg button{border:none;background:transparent;padding:7px 14px;border-radius:8px;font-size:13px;font-weight:600;color:#475569;cursor:pointer}
.lcm-seg button.on{background:#fff;color:#4338ca;box-shadow:0 1px 3px rgba(15,23,42,.12)}
.lcm-add{display:grid;grid-template-columns:1.2fr 1fr 1fr auto;gap:8px;align-items:end;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-bottom:14px}
.lcm-add label{display:block;font-size:11.5px;font-weight:600;color:#475569;margin-bottom:4px}
.lcm-in{width:100%;box-sizing:border-box;height:38px;padding:0 10px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:14px;color:#0f172a;background:#fff;outline:none}
.lcm-in:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.15)}
.lcm-btn{height:38px;padding:0 14px;border-radius:9px;border:none;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap}
.lcm-btn.primary{background:#4f46e5;color:#fff}
.lcm-btn.ghost{background:#f1f5f9;color:#475569}
.lcm-btn.del{background:#fff;color:#dc2626;border:1px solid #fecaca}
.lcm-btn:disabled{opacity:.6;cursor:wait}
.lcm-row{display:flex;align-items:center;gap:10px;padding:10px 4px;border-bottom:1px solid #f1f5f9;flex-wrap:wrap}
.lcm-name{font-weight:700;color:#0f172a;min-width:70px}
.lcm-code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;color:#64748b}
.lcm-range{margin-left:auto;font-size:14px;font-weight:600;color:#334155}
.lcm-edit{display:flex;gap:6px;align-items:center;margin-left:auto}
.lcm-edit .lcm-in{width:90px}
.lcm-alert{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;border-radius:9px;padding:8px 12px;font-size:13px;margin-bottom:12px}
.lcm-empty{padding:18px;text-align:center;color:#94a3b8;font-size:13px}
@media (max-width:768px){
  .lcm-modal button{min-width:0 !important;min-height:0 !important;margin-bottom:0 !important}
  .lcm-add{grid-template-columns:1fr 1fr}
  .lcm-add .lcm-f-name{grid-column:1 / -1}
  .lcm-add .lcm-btn{grid-column:1 / -1}
  .lcm-overlay{padding:0;align-items:stretch}
  .lcm-modal{max-height:none;height:100%;border-radius:0}
}
`;

function LotCategoryManager({ salesUrl, getToken, initialType, onClose, onChanged }) {
  const LS = window.LotStock;
  const [type, setType] = React.useState(initialType || 'temper');
  const [list, setList] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [draft, setDraft] = React.useState({ name: '', minPrice: '', maxPrice: '' });
  const [editing, setEditing] = React.useState(null); // { id, minPrice, maxPrice }

  const token = () => (getToken ? getToken() : localStorage.getItem('branch_token') || '');
  const load = async () => {
    try { setList(await LS.fetchLotCategories(salesUrl, token())); setError(''); }
    catch (e) { setError(e.message || 'Could not load categories'); }
    finally { setLoading(false); }
  };
  React.useEffect(() => { load(); }, []);

  const run = async (fn) => {
    setBusy(true); setError('');
    try { await fn(); await load(); onChanged && onChanged(); }
    catch (e) { setError(e.message || 'Something went wrong'); }
    finally { setBusy(false); }
  };

  const add = () => run(async () => {
    await LS.createLotCategory(salesUrl, token(), { type, name: draft.name, minPrice: draft.minPrice, maxPrice: draft.maxPrice });
    setDraft({ name: '', minPrice: '', maxPrice: '' });
  });
  const saveRange = () => run(async () => {
    await LS.updateLotCategory(salesUrl, token(), editing.id, { minPrice: editing.minPrice, maxPrice: editing.maxPrice });
    setEditing(null);
  });
  const remove = (c) => {
    if (!window.confirm(`Delete ${c.typeLabel} category ${c.name}? Stock already held stays, but the POS will no longer show its price range.`)) return;
    run(() => LS.deleteLotCategory(salesUrl, token(), c.id));
  };

  const shown = list.filter(c => c.type === type);
  const typeInfo = LS.lotTypeOf(type);

  return (
    <div className="lcm-overlay" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <style>{LCM_CSS}</style>
      <div className="lcm-modal" role="dialog" aria-modal="true" aria-labelledby="lcm-title"
        onKeyDown={e => { if (e.key === 'Escape' && !busy) { e.stopPropagation(); onClose(); } }}>
        <div className="lcm-head">
          <div>
            <h2 id="lcm-title">Pouch &amp; tempered categories</h2>
            <p>Group lots by price range. Labels print the category, the POS shows its range.</p>
          </div>
          <button type="button" className="lcm-x" onClick={onClose} aria-label="Close" disabled={busy}>✕</button>
        </div>
        <div className="lcm-body">
          {error && <div className="lcm-alert" role="alert">{error}</div>}
          <div className="lcm-seg" role="radiogroup" aria-label="Lot type">
            {LS.LOT_TYPES.map(t => (
              <button key={t.key} type="button" role="radio" aria-checked={type === t.key} className={type === t.key ? 'on' : ''}
                onClick={() => { setType(t.key); setEditing(null); }}>{t.icon} {t.label}</button>
            ))}
          </div>

          <div className="lcm-add">
            <div className="lcm-f-name">
              <label htmlFor="lcm-name">New {typeInfo.label.toLowerCase()} category</label>
              <input id="lcm-name" className="lcm-in" value={draft.name} maxLength={60} placeholder="e.g. D8, D+"
                onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="lcm-min">Min price ₹</label>
              <input id="lcm-min" className="lcm-in" type="number" min="0" step="0.01" value={draft.minPrice} placeholder="18"
                onChange={e => setDraft(d => ({ ...d, minPrice: e.target.value }))} onWheel={e => e.currentTarget.blur()} />
            </div>
            <div>
              <label htmlFor="lcm-max">Max price ₹</label>
              <input id="lcm-max" className="lcm-in" type="number" min="0" step="0.01" value={draft.maxPrice} placeholder="50"
                onChange={e => setDraft(d => ({ ...d, maxPrice: e.target.value }))} onWheel={e => e.currentTarget.blur()} />
            </div>
            <button type="button" className="lcm-btn primary" onClick={add}
              disabled={busy || !draft.name.trim() || draft.minPrice === '' || draft.maxPrice === ''}>＋ Add</button>
          </div>

          {loading ? <div className="lcm-empty">Loading…</div> : shown.length === 0 ? (
            <div className="lcm-empty">No {typeInfo.label.toLowerCase()} categories yet — add one above.</div>
          ) : shown.map(c => (
            <div key={c.id} className="lcm-row">
              <span className="lcm-name">{c.name}</span>
              <span className="lcm-code">{c.productNo}</span>
              {editing && editing.id === c.id ? (
                <div className="lcm-edit">
                  <input className="lcm-in" type="number" min="0" step="0.01" value={editing.minPrice} aria-label="Min price"
                    onChange={e => setEditing(x => ({ ...x, minPrice: e.target.value }))} />
                  <span>–</span>
                  <input className="lcm-in" type="number" min="0" step="0.01" value={editing.maxPrice} aria-label="Max price"
                    onChange={e => setEditing(x => ({ ...x, maxPrice: e.target.value }))} />
                  <button type="button" className="lcm-btn primary" onClick={saveRange} disabled={busy}>Save</button>
                  <button type="button" className="lcm-btn ghost" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
                </div>
              ) : (
                <>
                  <span className="lcm-range">{LS.formatPriceRange(c.minPrice, c.maxPrice)}</span>
                  <button type="button" className="lcm-btn ghost" onClick={() => setEditing({ id: c.id, minPrice: c.minPrice, maxPrice: c.maxPrice })} disabled={busy}>Edit range</button>
                  <button type="button" className="lcm-btn del" onClick={() => remove(c)} disabled={busy}>Delete</button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

window.LotCategoryManager = LotCategoryManager;

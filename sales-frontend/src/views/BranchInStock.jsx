// Branch "Purchase Inventory" (#instock): branch stock list with search, status filters, sorting,
// stock value breakdown, and entry points to Add Purchase / bill import / barcode labels.
// Look matches the Dealers screens (same palette as src/utils/dealerUi.js); classes are prefixed `bi-`.

// Line icons come from the shared set in src/components/LineIcon.jsx
function BiIcon({ name, size = 18 }) {
  return window.LineIcon ? <window.LineIcon name={name} size={size} /> : null;
}

const BI_CSS = [
  '.bi{--ac:#4f46e5;--ac2:#6366f1;--acs:#eef2ff;--tx:#0f172a;--mu:#64748b;--ln:#e2e8f0;--bg:#f8fafc;--ok:#16a34a;--oks:#dcfce7;--wa:#b45309;--was:#fef3c7;--er:#dc2626;--ers:#fee2e2;color:var(--tx);font-family:Inter,system-ui,sans-serif;padding:24px;background:var(--bg);min-height:100%}',
  '.bi *{box-sizing:border-box}',
  '.bi-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:14px;margin-bottom:20px}',
  '.bi-head h1{margin:0;font-size:26px;font-weight:800;letter-spacing:-.02em}',
  '.bi-head p{margin:4px 0 0;color:var(--mu);font-size:14px}',
  '.bi-actions{display:flex;flex-wrap:wrap;gap:8px}',
  '.bi-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:40px;padding:0 16px;border-radius:10px;border:1px solid transparent;font:600 14px Inter,system-ui,sans-serif;cursor:pointer;transition:background .15s,box-shadow .15s;white-space:nowrap}',
  '.bi-btn:disabled{opacity:.5;cursor:not-allowed}',
  '.bi-btn.pri{background:var(--ac);color:#fff;box-shadow:0 4px 12px rgba(79,70,229,.22)}.bi-btn.pri:hover:not(:disabled){background:#4338ca}',
  '.bi-btn.sec{background:#fff;color:var(--tx);border-color:var(--ln)}.bi-btn.sec:hover:not(:disabled){background:#f1f5f9}',
  '.bi-btn.icon{width:40px;padding:0}',
  '.bi-btn.link{height:auto;padding:0;background:none;color:var(--ac);font-size:12.5px}.bi-btn.link:hover{text-decoration:underline}',
  '.bi-btn.sm{height:34px;padding:0 12px;font-size:13px}',
  '.bi-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}',
  '.bi-stat{display:flex;gap:14px;align-items:flex-start;background:#fff;border:1px solid var(--ln);border-radius:14px;padding:16px;text-align:left;font:inherit;color:inherit}',
  'button.bi-stat{cursor:pointer;transition:border-color .15s,box-shadow .15s}button.bi-stat:hover{border-color:#c7d2fe}button.bi-stat.on{border-color:var(--ac);box-shadow:0 0 0 3px var(--acs)}',
  '.bi-stat .ic{flex:0 0 40px;height:40px;border-radius:11px;display:flex;align-items:center;justify-content:center;background:var(--acs);color:var(--ac)}',
  '.bi-stat .ic.ok{background:var(--oks);color:var(--ok)}.bi-stat .ic.wa{background:var(--was);color:var(--wa)}.bi-stat .ic.er{background:var(--ers);color:var(--er)}',
  '.bi-stat .k{font-size:12px;font-weight:600;color:var(--mu);text-transform:uppercase;letter-spacing:.04em}',
  '.bi-stat .v{margin-top:4px;font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.2}',
  '.bi-stat .s{margin-top:2px;font-size:12px;color:var(--mu)}',
  '.bi-card{background:#fff;border:1px solid var(--ln);border-radius:14px;overflow:hidden}',
  '.bi-toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:14px;border-bottom:1px solid var(--ln)}',
  '.bi-search{position:relative;flex:1 1 280px;min-width:0}',
  '.bi-search input{width:100%;height:40px;padding:0 36px;border:1px solid var(--ln);border-radius:10px;font-size:14px;outline:none;background:var(--bg);font-family:inherit}',
  '.bi-search input:focus{border-color:var(--ac2);background:#fff;box-shadow:0 0 0 3px var(--acs)}',
  '.bi-search .lead{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--mu);display:flex;pointer-events:none}',
  '.bi-search .clr{position:absolute;right:6px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:var(--mu);width:28px;height:28px;border-radius:7px;cursor:pointer;display:flex;align-items:center;justify-content:center}.bi-search .clr:hover{background:#f1f5f9}',
  '.bi-chips{display:inline-flex;background:var(--bg);border:1px solid var(--ln);border-radius:10px;padding:3px;flex-wrap:wrap}',
  '.bi-chips button{border:0;background:transparent;height:32px;padding:0 12px;border-radius:7px;font:600 13px Inter,system-ui,sans-serif;color:var(--mu);cursor:pointer;display:inline-flex;align-items:center;gap:6px}',
  '.bi-chips button.on{background:#fff;color:var(--tx);box-shadow:0 1px 3px rgba(15,23,42,.12)}',
  '.bi-chips .n{font-size:11.5px;font-weight:700;background:#e2e8f0;color:#475569;border-radius:999px;padding:1px 7px}',
  '.bi-select{height:40px;border:1px solid var(--ln);border-radius:10px;padding:0 10px;font:500 13px Inter,system-ui,sans-serif;background:#fff;color:var(--tx);width:auto;max-width:220px}',
  '.bi-meta{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 16px;font-size:13px;color:var(--mu);border-bottom:1px solid var(--ln);background:#fcfdff}',
  '.bi-scroll{overflow-x:auto}',
  '.bi-table{width:100%;border-collapse:collapse;font-size:13.5px}',
  '.bi-table th{position:sticky;top:0;text-align:left;font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--mu);background:var(--bg);padding:10px 14px;font-weight:700;white-space:nowrap;border-bottom:1px solid var(--ln)}',
  '.bi-table th.sort{cursor:pointer;user-select:none}.bi-table th.sort:hover{color:var(--tx)}.bi-table th .arr{margin-left:4px;color:var(--ac)}',
  '.bi-table td{padding:12px 14px;border-bottom:1px solid #eef2f6;vertical-align:middle}',
  '.bi-table tbody tr:hover{background:#fafaff}',
  '.bi-table .r{text-align:right}.bi-table .c{text-align:center}',
  '.bi-prod{display:flex;flex-direction:column;gap:3px;min-width:200px}',
  '.bi-prod b{font-weight:700;font-size:14px;color:var(--tx)}',
  '.bi-prod .sub{font-size:12.5px;color:var(--mu)}',
  '.bi-code{display:inline-block;font:600 12px ui-monospace,Menlo,Consolas,monospace;color:#334155;background:#f1f5f9;border-radius:6px;padding:2px 7px;white-space:nowrap}',
  '.bi-imei{font:500 11.5px ui-monospace,Menlo,Consolas,monospace;color:var(--ac);background:var(--acs);border-radius:6px;padding:2px 6px;align-self:flex-start}',
  '.bi-num{font-variant-numeric:tabular-nums;font-weight:700;white-space:nowrap}',
  '.bi-pc{display:inline-block;margin-top:4px;font:700 11.5px ui-monospace,Menlo,Consolas,monospace;letter-spacing:1px;color:#4338ca;background:var(--acs);border:1px solid #c7d2fe;border-radius:6px;padding:1px 7px}',
  '.bi-badge{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700;white-space:nowrap}',
  '.bi-badge.ok{background:var(--oks);color:var(--ok)}.bi-badge.wa{background:var(--was);color:var(--wa)}.bi-badge.er{background:var(--ers);color:var(--er)}.bi-badge.mu{background:#f1f5f9;color:var(--mu)}',
  '.bi-dot{width:6px;height:6px;border-radius:50%;background:currentColor}',
  '.bi-sm{font-size:12.5px;color:var(--mu);white-space:nowrap}',
  '.bi-pager{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:12px 16px;font-size:13px;color:var(--mu)}',
  '.bi-pager .pg{display:flex;align-items:center;gap:6px}',
  '.bi-empty{text-align:center;padding:56px 20px;color:var(--mu)}',
  '.bi-empty .i{width:56px;height:56px;margin:0 auto 12px;border-radius:16px;background:var(--acs);color:var(--ac);display:flex;align-items:center;justify-content:center}',
  '.bi-empty b{display:block;color:var(--tx);font-size:16px;margin-bottom:4px}',
  '.bi-empty .a{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:16px}',
  '.bi-err{display:flex;align-items:center;gap:10px;justify-content:space-between;flex-wrap:wrap;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;padding:10px 14px;border-radius:12px;margin-bottom:16px;font-size:14px}',
  '.bi-skel{height:14px;border-radius:6px;background:linear-gradient(90deg,#eef2f6,#f8fafc,#eef2f6);background-size:200% 100%;animation:biSk 1.2s infinite}',
  '@keyframes biSk{from{background-position:200% 0}to{background-position:-200% 0}}',
  '.bi-overlay{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:9000;display:flex;justify-content:flex-end}',
  '.bi-drawer{width:min(560px,100%);height:100%;background:#fff;display:flex;flex-direction:column;box-shadow:-12px 0 40px rgba(15,23,42,.2);animation:biIn .18s ease-out}',
  '@keyframes biIn{from{transform:translateX(24px);opacity:.6}to{transform:none;opacity:1}}',
  '.bi-dh{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 20px;border-bottom:1px solid var(--ln)}',
  '.bi-dh h2{margin:0;font-size:18px}.bi-dh p{margin:2px 0 0;font-size:13px;color:var(--mu)}',
  '.bi-db{flex:1;overflow:auto}',
  '.bi-df{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;border-top:1px solid var(--ln);background:var(--bg);font-weight:700}',
  '.bi-df .t{font-size:20px;color:var(--ok);font-variant-numeric:tabular-nums}',
  '.bi-cards{display:none}',
  '@media (max-width:1100px){.bi-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}',
  '@media (max-width:760px){.bi{padding:14px}.bi-head h1{font-size:22px}.bi-actions{width:100%}.bi-actions .bi-btn.pri{flex:1 1 100%}.bi-actions .bi-btn.sec:not(.icon){flex:1 1 0}',
  '.bi-stat{padding:12px;gap:10px}.bi-stat .ic{flex-basis:34px;height:34px}.bi-stat .v{font-size:18px}',
  '.bi-toolbar{padding:10px}.bi-chips{width:100%}.bi-chips button{flex:1 1 auto;justify-content:center}.bi-select{flex:1 1 0;max-width:none}',
  '.bi-scroll{display:none}.bi-cards{display:block}',
  '.bi-mc{padding:14px 16px;border-bottom:1px solid #eef2f6}.bi-mc .top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}',
  '.bi-mc .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;margin-top:10px;font-size:13px}.bi-mc .grid .lb{display:block;font-size:11px;color:var(--mu);text-transform:uppercase;letter-spacing:.04em;font-weight:600}',
  '.bi-chips{flex-wrap:nowrap}.bi-chips button{padding:0 6px}.bi-select.sup{flex:1 1 100%}}',
  // styles.css forces 44px / 16px / 12px 16px padding on every <button> below 768px; keep this page's own sizes
  '@media (max-width:768px){.bi .bi-btn{font-size:14px!important;padding:0 14px!important;min-height:40px!important}.bi .bi-btn.icon{padding:0!important;min-width:40px!important}',
  '.bi .bi-btn.sm{min-height:34px!important;font-size:13px!important}',
  '.bi .bi-btn.link{min-height:0!important;min-width:0!important;padding:0!important;font-size:12.5px!important}',
  '.bi .bi-chips button{min-height:34px!important;min-width:0!important;padding:0 6px!important;font-size:13px!important}',
  '.bi .bi-search .clr{min-height:28px!important;min-width:28px!important;padding:0!important}',
  '.bi .bi-select{height:44px;padding:0 10px!important;font-size:15px!important}}',
  '@media (max-width:480px){.bi-stat .ic{display:none}.bi-stat .k{font-size:11px}}',
].join('\n');

const BI_PAGE_SIZE = 50;
const BI_LOW_STOCK = 2; // qty at or below this (and above 0) counts as low stock

function biToNumber(val) {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  const f = parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
  return isNaN(f) ? 0 : f;
}
const biQty = (it) => biToNumber(it.branchQty ?? it.qty ?? 0);
const biStatus = (it) => { const q = biQty(it); return q <= 0 ? 'out' : q <= BI_LOW_STOCK ? 'low' : 'in'; };
// Calendar days since the latest supply of this product
function biDaysInStock(it) {
  if (!it.productCreatedAt) return null;
  const created = new Date(it.productCreatedAt);
  if (isNaN(created.getTime())) return null;
  const now = new Date();
  const d = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(created.getFullYear(), created.getMonth(), created.getDate())) / 86400000);
  return d >= 0 ? d : null;
}
// Unit cost shown to the branch. Central refs ('<docId>_<idx>') carry no branch cost, so they show '-'.
function biUnitCost(it) {
  if (/^[0-9a-fA-F]{24}_[0-9]+$/.test(String(it.productId || ''))) return null;
  const raw = it.costPrice ?? it.cost ?? null;
  if (raw != null) return biToNumber(raw);
  const q = biQty(it);
  return it.totalCostPrice != null && q > 0 ? biToNumber(it.totalCostPrice) / q : null;
}
const biImes = (it) => {
  const central = Array.isArray(it.centralOnlyImes) && it.centralOnlyImes.length ? it.centralOnlyImes : (Array.isArray(it.centralImes) ? it.centralImes : []);
  return [...(Array.isArray(it.imes) ? it.imes : []), ...central].map(String).filter(Boolean);
};
const biDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

function BranchInStock({ salesUrl, token }) {
  const [entries, setEntries] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState('all'); // all | in | low | out
  const [supplierFilter, setSupplierFilter] = React.useState('');
  const [sort, setSort] = React.useState({ key: 'added', dir: 'desc' });
  const [page, setPage] = React.useState(1);
  const [showBreakdown, setShowBreakdown] = React.useState(false);
  const [showBarcodeSheet, setShowBarcodeSheet] = React.useState(false);
  const [showImport, setShowImport] = React.useState(false);
  const getAuthToken = () => token || (typeof window !== 'undefined' ? (localStorage.getItem('branch_token') || '') : '');

  const loadEntries = async () => {
    try {
      setError('');
      const storedBranchToken = typeof window !== 'undefined' ? (localStorage.getItem('branch_token') || '') : '';
      const effectiveToken = token || storedBranchToken || '';
      const url = new URL(salesUrl + '/api/branch-stock');
      url.searchParams.set('only_branch', '1');
      let res = await fetch(url, { headers: { Authorization: 'Bearer ' + effectiveToken } });
      if (res.status === 401 && storedBranchToken && storedBranchToken !== effectiveToken) {
        res = await fetch(url, { headers: { Authorization: 'Bearer ' + storedBranchToken } });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load');
      let rows = Array.isArray(data.rows) ? data.rows : [];

      // Also fetch branch supplies to discover supplierName and supply createdAt per product
      try {
        const supUrl = new URL((salesUrl || '') + '/api/branch-supplies');
        let supRes = await fetch(supUrl, { headers: { Authorization: 'Bearer ' + effectiveToken } });
        if (supRes.status === 401 && storedBranchToken && storedBranchToken !== effectiveToken) {
          supRes = await fetch(supUrl, { headers: { Authorization: 'Bearer ' + storedBranchToken } });
        }
        const supData = await supRes.json();
        const supplies = (supData && Array.isArray(supData.supplies)) ? supData.supplies : [];
        // Build a map productId -> { supplierName, createdAt } taking latest createdAt when multiple
        const supplyMap = {};
        supplies.forEach(s => {
          const sName = s.supplierName || s.supplier || '';
          const sCreated = s.createdAt || s.created_at || s.updatedAt || s.updated_at || null;
          (Array.isArray(s.items) ? s.items : []).forEach(it => {
            const pid = String(it.productId || it._id || '');
            if (!pid) return;
            const prev = supplyMap[pid];
            const prevTime = prev && prev.createdAt ? new Date(prev.createdAt).getTime() : 0;
            const curTime = sCreated ? new Date(sCreated).getTime() : 0;
            if (!prev || curTime > prevTime) supplyMap[pid] = { supplierName: sName, createdAt: sCreated };
          });
        });

        // Annotate rows with supplierName and productCreatedAt from the latest matching supply
        rows = rows.map(r => {
          const info = supplyMap[String(r.productId || '')] || null;
          return { ...r, supplierName: info ? info.supplierName : (r.supplierName || ''), productCreatedAt: info ? info.createdAt : (r.createdAt || null) };
        });
      } catch (e) {
        // ignore supply mapping errors and proceed with rows as-is
      }

      setEntries(rows);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  // Suppliers for the Add Purchase form
  const [suppliers, setSuppliers] = React.useState([]);

  // Price code cipher (branch Price Code setting) -> encoded cost price shown under the cost column
  const [priceCipher, setPriceCipher] = React.useState('');
  React.useEffect(() => {
    const tk = getAuthToken();
    if (!salesUrl || !tk || !window.BarcodeLabels) return undefined;
    let alive = true;
    fetch(salesUrl + '/api/shop-info', { headers: { Authorization: 'Bearer ' + tk } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d) setPriceCipher(window.BarcodeLabels.normalizePriceCipher(d.priceCipher)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [salesUrl, token]);
  const priceCodeOf = (row) => (window.BarcodeLabels && priceCipher)
    ? window.BarcodeLabels.encodePriceCode(row.costPrice ?? row.cost ?? 0, priceCipher) : '';

  const loadSuppliers = async () => {
    try {
      const storedBranchToken = typeof window !== 'undefined' ? (localStorage.getItem('branch_token') || '') : '';
      const effectiveToken = token || storedBranchToken || '';
      let res = await fetch((salesUrl || '') + '/api/suppliers', { headers: { Authorization: 'Bearer ' + effectiveToken } });
      if (res.status === 401 && storedBranchToken && storedBranchToken !== effectiveToken) {
        res = await fetch((salesUrl || '') + '/api/suppliers', { headers: { Authorization: 'Bearer ' + storedBranchToken } });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load suppliers');
      setSuppliers(Array.isArray(data.suppliers) ? data.suppliers : []);
    } catch (e) { /* ignore */ }
  };

  // Add Purchase form (src/components/BranchStockEntry.jsx)
  const [openAdd, setOpenAdd] = React.useState(false);

  React.useEffect(() => { loadEntries(); loadSuppliers(); }, [token]);
  React.useEffect(() => {
    const onUpdated = () => loadEntries();
    window.addEventListener('branch-stock-updated', onUpdated);
    return () => window.removeEventListener('branch-stock-updated', onUpdated);
  }, [token]);
  React.useEffect(() => {
    if (!showBreakdown) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setShowBreakdown(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showBreakdown]);
  React.useEffect(() => { setPage(1); }, [query, status, supplierFilter, sort]);

  const currency = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

  const supplierNames = React.useMemo(
    () => Array.from(new Set(entries.map(it => (it.supplierName || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [entries]
  );

  // Search + supplier filter (status chips are applied after, so their counts follow the search)
  const searched = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter(it => {
      if (supplierFilter && (it.supplierName || '').trim() !== supplierFilter) return false;
      if (!q) return true;
      return [it.productNo, it.productName, it.brand, it.model, it.supplierName].some(v => String(v || '').toLowerCase().includes(q))
        || biImes(it).some(m => m.toLowerCase().includes(q));
    });
  }, [entries, query, supplierFilter]);

  const counts = React.useMemo(() => {
    const c = { all: searched.length, in: 0, low: 0, out: 0 };
    searched.forEach(it => { c[biStatus(it)] += 1; });
    return c;
  }, [searched]);

  const filteredEntries = React.useMemo(() => {
    const rows = status === 'all' ? searched : searched.filter(it => biStatus(it) === status);
    const val = (it) => {
      switch (sort.key) {
        case 'name': return String(it.productName || it.productNo || '').toLowerCase();
        case 'qty': return biQty(it);
        case 'cost': return biUnitCost(it) ?? -1;
        case 'value': return biQty(it) * (biUnitCost(it) || 0);
        case 'supplier': return String(it.supplierName || '').toLowerCase();
        default: { const t = it.productCreatedAt ? new Date(it.productCreatedAt).getTime() : 0; return isNaN(t) ? 0 : t; }
      }
    };
    const dir = sort.dir === 'asc' ? 1 : -1;
    return rows.slice().sort((a, b) => { const x = val(a), y = val(b); return x < y ? -dir : x > y ? dir : 0; });
  }, [searched, status, sort]);

  // Stock value (Qty * Cost Price) for the rows on screen; there is no fixed selling price
  const branchStockBreakdown = React.useMemo(() => {
    const items = filteredEntries.map(it => {
      const qty = biQty(it);
      const cost = biToNumber(it.costPrice ?? 0);
      return { productNo: it.productNo || String(it.productId || ''), productName: it.productName || '-', qty, cost, amount: qty * cost };
    }).filter(i => i.qty !== 0 && i.amount !== 0).sort((a, b) => b.amount - a.amount);
    return { items, total: items.reduce((s, it) => s + it.amount, 0) };
  }, [filteredEntries]);
  const totalUnits = React.useMemo(() => filteredEntries.reduce((s, it) => s + biQty(it), 0), [filteredEntries]);

  const pageCount = Math.max(1, Math.ceil(filteredEntries.length / BI_PAGE_SIZE));
  const pageRows = filteredEntries.slice((page - 1) * BI_PAGE_SIZE, page * BI_PAGE_SIZE);
  const filtersOn = !!(query || supplierFilter || status !== 'all');
  const clearFilters = () => { setQuery(''); setSupplierFilter(''); setStatus('all'); };
  const qLower = query.trim().toLowerCase();

  // Transform branch entries for BarcodeSheet component (grouped by category, InStock entry shape)
  const barcodeEntries = React.useMemo(() => {
    const grouped = {};
    entries.forEach(row => {
      const category = row.category || 'Uncategorized';
      if (!grouped[category]) grouped[category] = { category, items: [] };
      grouped[category].items.push({
        productNo: row.productNo || row.productId || '',
        productName: row.productName || '',
        brand: row.brand || '',
        model: row.model || '',
        costPrice: row.costPrice ?? row.cost ?? 0,
        quantity: row.branchQty ?? row.qty ?? 0,
        imes: Array.isArray(row.imes) ? row.imes : (row.imei ? [row.imei] : [])
      });
    });
    return Object.values(grouped);
  }, [entries]);

  const exportCsv = () => {
    const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const head = ['Product No', 'Product Name', 'Brand', 'Model', 'Qty', 'Unit Cost', 'Stock Value', 'Supplier', 'Added On', 'Days in Stock', 'IMEIs', 'Warranty (months)', 'Validity'];
    const lines = filteredEntries.map(it => {
      const cost = biUnitCost(it);
      return [it.productNo, it.productName, it.brand, it.model, biQty(it), cost ?? '', cost != null ? (biQty(it) * cost).toFixed(2) : '',
        it.supplierName, biDate(it.productCreatedAt), biDaysInStock(it) ?? '', biImes(it).join(' '), it.warrantyMonths || '', it.validity ? biDate(it.validity) : '']
        .map(esc).join(',');
    });
    const blob = new Blob(['﻿' + [head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'branch-inventory-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const setSortKey = (key) => setSort(s => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' || key === 'supplier' ? 'asc' : 'desc' }));
  const Th = ({ k, children, className }) => (
    <th className={'sort ' + (className || '')} onClick={() => setSortKey(k)} aria-sort={sort.key === k ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      {children}{sort.key === k ? <span className="arr">{sort.dir === 'asc' ? '↑' : '↓'}</span> : null}
    </th>
  );

  const qtyBadge = (it) => {
    const st = biStatus(it);
    const cls = st === 'out' ? 'er' : st === 'low' ? 'wa' : 'ok';
    return <span className={'bi-badge ' + cls}><span className="bi-dot" />{biQty(it)}</span>;
  };
  const ageBadge = (it) => {
    const d = biDaysInStock(it);
    if (d == null) return <span className="bi-sm">—</span>;
    const cls = d > 90 ? 'er' : d > 45 ? 'wa' : 'mu';
    return <span className={'bi-badge ' + cls} title="Days since the latest purchase of this product">{d} day{d === 1 ? '' : 's'}</span>;
  };
  const costCell = (it) => {
    const cost = biUnitCost(it);
    const pc = priceCodeOf(it);
    return (
      <>
        <div className="bi-num">{cost != null ? currency(cost) : '—'}</div>
        {pc ? <span className="bi-pc" title="Price code (encoded cost price)">{pc}</span> : null}
      </>
    );
  };
  const warrantyText = (it) => {
    const months = Number(it.warrantyMonths) || 0;
    const parts = [];
    if (months) parts.push(months + ' month' + (months > 1 ? 's' : ''));
    if (it.warrantyDetails) parts.push(it.warrantyDetails);
    return parts.join(' · ');
  };
  const matchedImei = (it) => (qLower.length >= 3 ? biImes(it).find(m => m.toLowerCase().includes(qLower)) : null);

  const statTiles = [
    { key: 'all', icon: 'box', cls: '', label: 'Products', value: counts.all, sub: filtersOn ? 'Matching your filters' : 'In branch inventory' },
    { key: 'units', icon: 'layers', cls: 'ok', label: 'Units in stock', value: totalUnits.toLocaleString('en-IN'), sub: 'Across shown products' },
    { key: 'value', icon: 'wallet', cls: '', label: 'Stock value', value: '₹' + Math.round(branchStockBreakdown.total).toLocaleString('en-IN'), sub: 'At cost price' },
    { key: 'attention', icon: 'alert', cls: counts.out ? 'er' : 'wa', label: 'Needs restock', value: counts.low + counts.out, sub: counts.out + ' out · ' + counts.low + ' low (≤' + BI_LOW_STOCK + ')' },
  ];

  return (
    <div className="bi">
      <style>{BI_CSS}</style>

      <div className="bi-head">
        <div>
          <h1>Purchase Inventory</h1>
          <p>Stock held by this branch, valued at cost. Add a purchase, import a supplier bill, or print barcode labels.</p>
        </div>
        <div className="bi-actions">
          <button type="button" className="bi-btn sec icon" title="Refresh" aria-label="Refresh" onClick={() => { setLoading(true); loadEntries(); }}><BiIcon name="refresh" /></button>
          <button type="button" className="bi-btn sec" onClick={() => setShowBarcodeSheet(true)} disabled={entries.length === 0}><BiIcon name="barcode" />Barcode labels</button>
          <button type="button" className="bi-btn sec" onClick={() => setShowImport(true)}><BiIcon name="upload" />Import bill</button>
          <button type="button" className="bi-btn pri" onClick={() => setOpenAdd(true)}><BiIcon name="plus" />Add purchase</button>
        </div>
      </div>

      {error && (
        <div className="bi-err" role="alert">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><BiIcon name="alert" />{error}</span>
          <button type="button" className="bi-btn sec sm" onClick={() => { setLoading(true); loadEntries(); }}>Try again</button>
        </div>
      )}

      <div className="bi-stats">
        {statTiles.map(t => {
          const body = (
            <>
              <div className={'ic ' + t.cls}><BiIcon name={t.icon} size={20} /></div>
              <div style={{ minWidth: 0 }}>
                <div className="k">{t.label}</div>
                <div className="v">{loading ? <div className="bi-skel" style={{ width: 80, height: 22 }} /> : t.value}</div>
                <div className="s">{t.sub}</div>
                {t.key === 'value' && !loading && (
                  <button type="button" className="bi-btn link" onClick={() => setShowBreakdown(true)}>View breakdown</button>
                )}
              </div>
            </>
          );
          return t.key === 'attention'
            ? <button key={t.key} type="button" className={'bi-stat' + (status === 'low' || status === 'out' ? ' on' : '')}
                title="Show low and out-of-stock products" onClick={() => setStatus(counts.out ? 'out' : 'low')}>{body}</button>
            : <div key={t.key} className="bi-stat">{body}</div>;
        })}
      </div>

      <div className="bi-card">
        <div className="bi-toolbar">
          <div className="bi-search">
            <span className="lead"><BiIcon name="search" size={16} /></span>
            <input type="search" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search product, code, brand, model, supplier or IMEI" aria-label="Search inventory" />
            {query && <button type="button" className="clr" aria-label="Clear search" onClick={() => setQuery('')}><BiIcon name="x" size={14} /></button>}
          </div>
          <div className="bi-chips" role="tablist" aria-label="Stock status">
            {[['all', 'All'], ['in', 'In stock'], ['low', 'Low'], ['out', 'Out']].map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={status === k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>
                {label}<span className="n">{counts[k]}</span>
              </button>
            ))}
          </div>
          <select className="bi-select sup" value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)} aria-label="Filter by supplier">
            <option value="">All suppliers</option>
            {supplierNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <select className="bi-select" value={sort.key + ':' + sort.dir} aria-label="Sort"
            onChange={e => { const [key, dir] = e.target.value.split(':'); setSort({ key, dir }); }}>
            <option value="added:desc">Newest purchase first</option>
            <option value="added:asc">Oldest stock first</option>
            <option value="name:asc">Name A–Z</option>
            <option value="qty:asc">Quantity: low to high</option>
            <option value="qty:desc">Quantity: high to low</option>
            <option value="value:desc">Stock value: high to low</option>
          </select>
          <button type="button" className="bi-btn sec icon" title="Export CSV" aria-label="Export CSV" onClick={exportCsv} disabled={!filteredEntries.length}><BiIcon name="download" /></button>
        </div>

        {!loading && entries.length > 0 && (
          <div className="bi-meta">
            <span>Showing <b>{filteredEntries.length}</b> of {entries.length} product{entries.length === 1 ? '' : 's'}</span>
            {filtersOn && <button type="button" className="bi-btn link" onClick={clearFilters}>Clear filters</button>}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 16, display: 'grid', gap: 14 }}>
            {[0, 1, 2, 3, 4].map(i => <div key={i} className="bi-skel" style={{ width: (90 - i * 8) + '%' }} />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="bi-empty">
            <div className="i"><BiIcon name="box" size={26} /></div>
            <b>No stock in this branch yet</b>
            Record a purchase or import a supplier bill to start tracking inventory.
            <div className="a">
              <button type="button" className="bi-btn sec" onClick={() => setShowImport(true)}><BiIcon name="upload" />Import bill</button>
              <button type="button" className="bi-btn pri" onClick={() => setOpenAdd(true)}><BiIcon name="plus" />Add purchase</button>
            </div>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="bi-empty">
            <div className="i"><BiIcon name="search" size={24} /></div>
            <b>No products match</b>
            Try a different search, status or supplier.
            <div className="a"><button type="button" className="bi-btn sec" onClick={clearFilters}>Clear filters</button></div>
          </div>
        ) : (
          <>
            <div className="bi-scroll">
              <table className="bi-table">
                <thead>
                  <tr>
                    <Th k="name">Product</Th>
                    <Th k="qty" className="c">Qty</Th>
                    <Th k="cost" className="r">Unit cost</Th>
                    <Th k="value" className="r">Stock value</Th>
                    <Th k="supplier">Supplier</Th>
                    <Th k="added">Purchased</Th>
                    <th>Warranty / validity</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((it, idx) => {
                    const cost = biUnitCost(it);
                    const imei = matchedImei(it);
                    const sub = [it.brand, it.model].filter(Boolean).join(' · ');
                    const warranty = warrantyText(it);
                    return (
                      <tr key={it._id || it.productId || idx}>
                        <td>
                          <div className="bi-prod">
                            <b>{it.productName || it.productNo || '—'}</b>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              {it.productNo ? <span className="bi-code">{it.productNo}</span> : null}
                              {sub ? <span className="sub">{sub}</span> : null}
                            </div>
                            {imei ? <span className="bi-imei">IMEI {imei}</span> : null}
                          </div>
                        </td>
                        <td className="c">{qtyBadge(it)}</td>
                        <td className="r">{costCell(it)}</td>
                        <td className="r"><span className="bi-num">{cost != null ? currency(biQty(it) * cost) : '—'}</span></td>
                        <td>{it.supplierName || <span className="bi-sm">—</span>}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                            <span className="bi-sm">{biDate(it.productCreatedAt)}</span>
                            {ageBadge(it)}
                          </div>
                        </td>
                        <td>
                          {warranty ? <div style={{ fontSize: 13 }}>{warranty}</div> : null}
                          {it.validity ? <div className="bi-sm">Valid till {biDate(it.validity)}</div> : null}
                          {!warranty && !it.validity ? <span className="bi-sm">—</span> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Phone layout: one card per product */}
            <div className="bi-cards">
              {pageRows.map((it, idx) => {
                const cost = biUnitCost(it);
                const imei = matchedImei(it);
                const warranty = warrantyText(it);
                return (
                  <div key={it._id || it.productId || idx} className="bi-mc">
                    <div className="top">
                      <div className="bi-prod" style={{ minWidth: 0 }}>
                        <b>{it.productName || it.productNo || '—'}</b>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          {it.productNo ? <span className="bi-code">{it.productNo}</span> : null}
                          <span className="sub">{[it.brand, it.model].filter(Boolean).join(' · ')}</span>
                        </div>
                        {imei ? <span className="bi-imei">IMEI {imei}</span> : null}
                      </div>
                      {qtyBadge(it)}
                    </div>
                    <div className="grid">
                      <div><span className="lb">Unit cost</span>{costCell(it)}</div>
                      <div><span className="lb">Stock value</span><b className="bi-num">{cost != null ? currency(biQty(it) * cost) : '—'}</b></div>
                      <div><span className="lb">Supplier</span>{it.supplierName || '—'}</div>
                      <div><span className="lb">Purchased</span>{biDate(it.productCreatedAt)}<div style={{ marginTop: 4 }}>{ageBadge(it)}</div></div>
                      {(warranty || it.validity) && (
                        <div style={{ gridColumn: '1 / -1' }}><span className="lb">Warranty / validity</span>{[warranty, it.validity ? 'Valid till ' + biDate(it.validity) : ''].filter(Boolean).join(' · ')}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {pageCount > 1 && (
              <div className="bi-pager">
                <span>{(page - 1) * BI_PAGE_SIZE + 1}–{Math.min(page * BI_PAGE_SIZE, filteredEntries.length)} of {filteredEntries.length}</span>
                <div className="pg">
                  <button type="button" className="bi-btn sec sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Previous page"><BiIcon name="chevL" size={16} /></button>
                  <span>Page {page} of {pageCount}</span>
                  <button type="button" className="bi-btn sec sm" disabled={page >= pageCount} onClick={() => setPage(p => p + 1)} aria-label="Next page"><BiIcon name="chevR" size={16} /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Stock value breakdown drawer */}
      {showBreakdown && (
        <div className="bi-overlay" onClick={() => setShowBreakdown(false)}>
          <div className="bi-drawer" role="dialog" aria-modal="true" aria-label="Stock value breakdown" onClick={e => e.stopPropagation()}>
            <div className="bi-dh">
              <div>
                <h2>Stock value breakdown</h2>
                <p>Quantity × cost price for {filtersOn ? 'the filtered' : 'all'} products, highest first.</p>
              </div>
              <button type="button" className="bi-btn sec icon" aria-label="Close" onClick={() => setShowBreakdown(false)}><BiIcon name="x" /></button>
            </div>
            <div className="bi-db">
              {branchStockBreakdown.items.length === 0 ? (
                <div className="bi-empty"><div className="i"><BiIcon name="wallet" size={24} /></div><b>Nothing to value</b>No products with both quantity and cost.</div>
              ) : (
                <table className="bi-table">
                  <thead><tr><th>Product</th><th className="r">Qty × cost</th><th className="r">Value</th></tr></thead>
                  <tbody>
                    {branchStockBreakdown.items.map((b, i) => (
                      <tr key={i}>
                        <td><div className="bi-prod" style={{ minWidth: 0 }}><b>{b.productName}</b><span className="bi-code" style={{ alignSelf: 'flex-start' }}>{b.productNo}</span></div></td>
                        <td className="r bi-sm">{b.qty} × {currency(b.cost)}</td>
                        <td className="r"><span className="bi-num">{currency(b.amount)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="bi-df"><span>Total stock value</span><span className="t">{currency(branchStockBreakdown.total)}</span></div>
          </div>
        </div>
      )}

      {/* Add Stock Modal */}
      {openAdd && window.BranchStockEntry && (
        <window.BranchStockEntry
          salesUrl={salesUrl}
          getToken={getAuthToken}
          suppliers={suppliers}
          branchEntries={entries}
          onClose={() => setOpenAdd(false)}
          onSaved={async (data) => {
            setOpenAdd(false);
            await loadEntries();
            try { window.dispatchEvent(new CustomEvent('branch-stock-updated', { detail: { supply: data.supply || null, rows: data.rows || [] } })); } catch (__) {}
          }}
        />
      )}

      {/* Supplier bill import (Excel / JSON) */}
      {showImport && window.BranchStockImport && (
        <window.BranchStockImport
          salesUrl={salesUrl}
          getToken={getAuthToken}
          suppliers={suppliers}
          branchEntries={entries}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            await loadEntries();
            try { window.dispatchEvent(new CustomEvent('branch-stock-updated', { detail: {} })); } catch (__) {}
          }}
          onSuppliersChanged={loadSuppliers}
        />
      )}

      {/* Barcode Sheet Modal */}
      {showBarcodeSheet && window.BarcodeSheet && (
        <window.BarcodeSheet
          entries={barcodeEntries}
          salesUrl={salesUrl}
          token={token}
          onClose={() => setShowBarcodeSheet(false)}
        />
      )}
    </div>
  );
}

// Register globally for in-browser JSX loader
window.BranchInStock = BranchInStock;

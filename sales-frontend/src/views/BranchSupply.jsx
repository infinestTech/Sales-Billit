function BranchSupply({ salesUrl, token }) {
  const [branches, setBranches] = React.useState([]);
  const [selectedBranch, setSelectedBranch] = React.useState('');
  const [stock, setStock] = React.useState([]);
  const [selectedRows, setSelectedRows] = React.useState({});
  const [totalValue, setTotalValue] = React.useState(0);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [productFilter, setProductFilter] = React.useState('');
  const [imesOpen, setImesOpen] = React.useState({});

  const loadBranches = async () => {
    try {
      const res = await fetch(salesUrl + '/api/branches', { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load branches');
      setBranches(Array.isArray(data.branches) ? data.branches : []);
    } catch (e) { setError(e.message); }
  };

  const loadStock = async (branchId) => {
    try {
      setError('');
      const url = new URL(salesUrl + '/api/branch-stock');
      if (branchId) url.searchParams.set('branch_id', branchId);
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load branch stock');
      setStock(Array.isArray(data.rows) ? data.rows : []);
      setSelectedRows({});
      setTotalValue(0);
    } catch (e) { setError(e.message); }
  };

  React.useEffect(() => { loadBranches(); }, [token]);

  React.useEffect(() => { if (selectedBranch) loadStock(selectedBranch); }, [selectedBranch]);

  // close IME dropdowns on outside click
  React.useEffect(() => {
    function onDocClick(e) {
      // if click happened inside a dropdown, ignore; otherwise close all imes dropdowns
      try {
        if (e && e.target && e.target.closest && e.target.closest('.imes-dropdown')) return;
      } catch (__) {}
      setImesOpen({});
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const getAvailableQty = (row) => Number(row?.centralQty != null ? row.centralQty : (row?.qty ?? 0)) || 0;

  const onQtyChange = (productId, qty) => {
    const row = stock.find(s => (s.productId || s._id) === productId) || {};
    const entered = Number(qty) || 0;
    const available = getAvailableQty(row);
    let q = entered;
    if (entered > available) {
      // cap to available and inform user
      setError(`Requested qty (${entered}) exceeds available stock (${available}). Using ${available} instead.`);
      q = available;
      // clear the message after a short while
      setTimeout(() => { setError(''); }, 5000);
    }
    const pct = Number(selectedRows[productId]?.pct || 0);
    const cost = Number(row?.costPrice || 0);
    const sellingPrice = pct ? (cost * (1 + pct / 100)) : Number(row?.sellingPrice || 0);
    const value = sellingPrice * q;
    // ensure selected imes array length does not exceed qty
    setSelectedRows(prev => {
      const prevImes = Array.isArray(prev[productId]?.imes) ? prev[productId].imes.slice(0, q) : [];
      const next = { ...prev, [productId]: { qty: q, value, productId, pct, sellingPrice, imes: prevImes } };
      const total = Object.values(next).reduce((s, it) => s + (Number(it.value) || 0), 0);
      setTotalValue(total);
      return next;
    });
  };

  const onImesChange = (productId, imesArray) => {
    const row = stock.find(s => (s.productId || s._id) === productId) || {};
    setSelectedRows(prev => {
      const qty = Number(prev[productId]?.qty || 0);
      const pct = Number(prev[productId]?.pct || 0);
      const cost = Number(row?.costPrice || 0);
      const sellingPrice = pct ? (cost * (1 + pct / 100)) : Number(row?.sellingPrice || 0);
      const imes = Array.isArray(imesArray) ? imesArray.slice() : [];
      const value = sellingPrice * qty;
      const next = { ...prev, [productId]: { qty, value, productId, pct, sellingPrice, imes } };
      const total = Object.values(next).reduce((s, it) => s + (Number(it.value) || 0), 0);
      setTotalValue(total);
      return next;
    });
  };

  // Toggle a single ime for a product using functional update to avoid stale closures
  const toggleIme = (productId, ime) => {
    setSelectedRows(prev => {
      const curr = Array.isArray(prev[productId]?.imes) ? prev[productId].imes.slice() : [];
      const idx = curr.indexOf(ime);
      if (idx >= 0) curr.splice(idx, 1); else curr.push(ime);
      // reuse onImesChange logic: compute derived fields
      const qty = Number(prev[productId]?.qty || 0);
      const pct = Number(prev[productId]?.pct || 0);
      const row = stock.find(s => (s.productId || s._id) === productId) || {};
      const cost = Number(row?.costPrice || 0);
      const sellingPrice = pct ? (cost * (1 + pct / 100)) : Number(row?.sellingPrice || 0);
      const value = sellingPrice * qty;
      const next = { ...prev, [productId]: { qty, value, productId, pct, sellingPrice, imes: curr } };
      const total = Object.values(next).reduce((s, it) => s + (Number(it.value) || 0), 0);
      setTotalValue(total);
      return next;
    });
  };

  const onPctChange = (productId, pctVal) => {
    const row = stock.find(s => (s.productId || s._id) === productId) || {};
    const pct = Number(pctVal) || 0;
    const q = Number(selectedRows[productId]?.qty || 0);
    const cost = Number(row?.costPrice || 0);
    const sellingPrice = cost * (1 + pct / 100);
    const value = sellingPrice * q;
    const next = { ...selectedRows, [productId]: { qty: q, value, productId, pct, sellingPrice } };
    setSelectedRows(next);
    const total = Object.values(next).reduce((s, it) => s + (Number(it.value) || 0), 0);
    setTotalValue(total);
  };

  const onSupply = async () => {
    try {
  setError('');
  if (!selectedBranch) return setError('Select a branch');
  setLoading(true);
      // Build items, but ensure we never send more than available stock.
      const selected = Object.values(selectedRows);
      if (selected.length === 0) return setError('Select at least one product and enter qty');
      let adjusted = false;
      const items = selected.map(r => {
        const row = stock.find(s => (s.productId || s._id) === r.productId) || {};
        const sellingPrice = r.sellingPrice ?? row.sellingPrice ?? 0;
        const available = getAvailableQty(row);
        const qtyToSend = Math.min(Number(r.qty) || 0, available);
        if (qtyToSend !== (Number(r.qty) || 0)) adjusted = true;
        const itemObj = {
          productId: r.productId,
          productName: row.productName || row.name || '',
          brand: row.brand || '',
          model: row.model || '',
          validity: row.validity || null,
          qty: qtyToSend,
          sellingPrice: sellingPrice,
          costPrice: row.costPrice,
          pct: r.pct || 0
        };
        if (Array.isArray(r.imes) && r.imes.length) itemObj.imes = r.imes.slice(0, qtyToSend);
        return itemObj;
      }).filter(i => i.qty > 0);

      // debug: print exactly what we are about to send
      try { console.log('BranchSupply: sending items', items); } catch (__) {}

      // Validate selected imes match qty for items that require IME selection
      for (const it of items) {
        if (Array.isArray(it.imes) && it.imes.length > 0) {
          if (Number(it.imes.length) !== Number(it.qty)) {
            setLoading(false);
            return setError(`Selected IMEs (${it.imes.length}) do not match the quantity (${it.qty}) for product ${it.productName || it.productId}`);
          }
        }
      }

      if (items.length === 0) return setError('Select at least one product and enter qty');

      // If adjustments were made (user requested more than available), update UI and inform
      if (adjusted) {
        // reflect adjusted qtys back into selectedRows and totalValue
        const next = { ...selectedRows };
        items.forEach(it => {
          const row = stock.find(s => (s.productId || s._id) === it.productId) || {};
          const sellingPrice = it.sellingPrice ?? row.sellingPrice ?? 0;
          const value = sellingPrice * it.qty;
          next[it.productId] = { qty: it.qty, value, productId: it.productId, pct: it.pct, sellingPrice };
        });
        setSelectedRows(next);
        const total = Object.values(next).reduce((s, it) => s + (Number(it.value) || 0), 0);
        setTotalValue(total);
        setError('Some requested quantities exceeded available stock and were adjusted to available amounts.');
        setTimeout(() => { setError(''); }, 5000);
      }
      const res = await fetch(salesUrl + '/api/branch-supply', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ branch_id: selectedBranch, items })
      });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Supply failed');
  // Always reload branch stock after a successful supply to keep UI consistent
  // If the API returns updated rows, we'll still refresh from server to ensure canonical state
  await loadStock(selectedBranch);
      // notify other parts of the app that branch stock changed
      try {
        const ev = new CustomEvent('branch-stock-updated', { detail: { branchId: selectedBranch } });
        window.dispatchEvent(ev);
      } catch (__) {}

      setSelectedRows({}); setTotalValue(0);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const currency = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

  const filteredStock = React.useMemo(() => {
    // Use available quantity (centralQty or qty) and exclude items with available <= 0
    const availableFilter = (item) => getAvailableQty(item) > 0;
    if (!productFilter) {
      return stock.filter(availableFilter);
    }
    return stock
      .filter(availableFilter)
      .filter(item => item.productNo?.toLowerCase().includes(productFilter.toLowerCase()));
  }, [stock, productFilter]);

  return (
    <div>
      <div className="row" style={{justifyContent:'space-between'}}>
        <div>
          <label>Select Branch</label>
          <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}>
            <option value="">-- select branch --</option>
            {branches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontWeight:700}}>Total Supply Value</div>
          <div style={{fontSize:18}}>{currency(totalValue)}</div>
        </div>
      </div>

      <div className="card mt-3 table-card">
        <div className="table-title">Branch Stock</div>
        <div className="filter-section">
          <input
            type="text"
            placeholder="Filter by Product No"
            value={productFilter}
            onChange={e => setProductFilter(e.target.value)}
            style={{ marginBottom: '12px', padding: '8px', width: '100%' }}
          />
        </div>
        {filteredStock.length === 0 ? (
          <div className="empty-state" style={{padding:24}}>
            <div className="empty-icon">📦</div>
            <div className="empty-title">No Products</div>
            <div className="empty-sub">No products match the entered Product No.</div>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Product No</th>
                  
                  <th>Product Name</th>
                  <th>Brand</th>
                  <th>Model</th>
                  <th>Qty</th>
                 
                  <th>IME / IME Count</th>
                  <th>Total Cost</th>
                  <th>Selling Price</th>
                  <th>Supply Qty</th>
                  <th>Value</th>
                  <th>Validity</th>
                </tr>
              </thead>
              <tbody>
                {filteredStock.map(s => {
                  const pid = s.productId || s._id;
                  const sel = selectedRows[pid] || { qty: 0, value: 0 };
                  // Use only central IMEs for dropdowns (centralOnlyImes preferred)
                  const centralOnly = Array.isArray(s.centralOnlyImes) && s.centralOnlyImes.length ? s.centralOnlyImes : (Array.isArray(s.centralImes) ? s.centralImes : []);
                  const imeList = centralOnly.map(i => ({ val: i, origin: 'central' }));
                  const availableImesCount = (Array.isArray(sel.imes) && sel.imes.length) ? sel.imes.length : imeList.length;
                  return (
                    <tr key={pid}>
                      <td>{s.productNo || '-'}</td>
                      <td>{s.productName || '-'}</td>
                      <td>{s.brand || '-'}</td>
                      <td>{s.model || '-'}</td>
                      <td>{(s.centralQty != null ? s.centralQty : (s.qty ?? '-'))}</td>

                      <td style={{ position: 'relative' }}>
                        {((Array.isArray(s.imes) && s.imes.length) || (Array.isArray(s.centralImes) && s.centralImes.length)) ? (
                          <div>
                            <div
                              role="button"
                              onClick={(ev) => { ev.stopPropagation(); setImesOpen(prev => ({ ...(prev || {}), [pid]: !prev[pid] })); }}
                              style={{
                                border: '1px solid #d1d5db',
                                padding: '6px 8px',
                                minWidth: 160,
                                borderRadius: 6,
                                background: '#fff',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                              }}
                            >
                              <div style={{ fontSize: 13 }}>{(sel.imes || []).length ? `${(sel.imes || []).length} selected` : (availableImesCount ? `${availableImesCount} IMEs available` : 'Select IMEs')}</div>
                              <div style={{ transform: (imesOpen && imesOpen[pid]) ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</div>
                            </div>
                            {imesOpen && imesOpen[pid] ? (
                              <div className="imes-dropdown" onClick={e => e.stopPropagation()} style={{
                                position: 'absolute',
                                zIndex: 40,
                                background: '#fff',
                                border: '1px solid #e5e7eb',
                                boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
                                marginTop: 6,
                                padding: 8,
                                borderRadius: 6,
                                maxHeight: 180,
                                overflow: 'auto',
                                minWidth: 220
                              }}>
                                {imeList.map(iObj => {
                                  const i = iObj.val;
                                  const checked = Array.isArray(sel.imes) ? sel.imes.includes(i) : false;
                                  return (
                                    <div key={i} onClick={() => {
                                      const prev = Array.isArray(sel.imes) ? sel.imes.slice() : [];
                                      const idx = prev.indexOf(i);
                                      if (idx >= 0) prev.splice(idx, 1); else prev.push(i);
                                      onImesChange(pid, prev);
                                    }}
                                      style={{
                                        padding: '6px 8px',
                                        borderRadius: 4,
                                        marginBottom: 4,
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        background: checked ? '#eef2ff' : 'transparent',
                                        cursor: 'pointer'
                                      }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ fontSize: 13 }}>{i}</div>
                                        {iObj.origin === 'central' ? <div style={{ fontSize: 11, color: '#6b7280' }}>(central)</div> : null}
                                      </div>
                                      <div style={{ width: 18, height: 18, borderRadius: 4, border: '1px solid #cbd5e1', background: checked ? '#6366f1' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12 }}>
                                        {checked ? '✓' : ''}
                                      </div>
                                    </div>
                                  );
                                })}
                                <div style={{ fontSize: 11, color: '#666', marginTop: 6 }}>{(sel.imes || []).length} selected</div>
                              </div>
                            ) : null}
                          </div>
                        ) : (s.imeNo || s.ime ? (s.imeNo || s.ime) : '-')}
                      </td>

                      <td>{s.totalCostPrice != null ? currency(s.totalCostPrice) : (s.costPrice != null ? currency(s.costPrice) : '-')}</td>
                      <td>
                        <div style={{display:'flex',flexDirection:'column'}}>
                          <div>
                            <input style={{width:80}} type="number" min={0} value={sel.pct ?? 0} onChange={e => onPctChange(pid, e.target.value)} /> %
                          </div>
                          <div style={{fontSize:12,color:'#666'}}>{sel.sellingPrice != null ? currency(sel.sellingPrice) : (s.sellingPrice != null ? currency(s.sellingPrice) : '-')}</div>
                        </div>
                      </td>
                      <td><input style={{width:80}} type="number" min={0} value={sel.qty} onChange={e => onQtyChange(pid, e.target.value)} /></td>
                      <td>{currency(sel.value)}</td>
                      <td>{s.validity ? new Date(s.validity).toLocaleDateString() : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{padding:12, display:'flex', justifyContent:'flex-end'}}>
          <button className="btn" type="button" onClick={onSupply} disabled={loading}>{loading ? 'Supplying...' : 'Supply Stock'}</button>
        </div>

        {error ? <div className="mt-2 text-danger" style={{padding:12}}>{error}</div> : null}
      </div>
    </div>
  );
}

window.BranchSupply = BranchSupply;

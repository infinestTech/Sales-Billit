function BranchInStock({ salesUrl, token }) {
  const [entries, setEntries] = React.useState([]);
  const [error, setError] = React.useState('');
  // Add filter states
  const [productNoFilter, setProductNoFilter] = React.useState('');
  const [productNameFilter, setProductNameFilter] = React.useState('');
  const [brandFilter, setBrandFilter] = React.useState('');
  const [modelFilter, setModelFilter] = React.useState('');
  const [qtyFilter, setQtyFilter] = React.useState('');
  const [imesFilter, setImesFilter] = React.useState('');
  const [showBreakdown, setShowBreakdown] = React.useState(false);

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
            try {
              const pid = String(it.productId || it._id || '');
              if (!pid) return;
              const prev = supplyMap[pid];
              if (!prev) supplyMap[pid] = { supplierName: sName, createdAt: sCreated };
              else {
                const prevTime = prev.createdAt ? new Date(prev.createdAt).getTime() : 0;
                const curTime = sCreated ? new Date(sCreated).getTime() : 0;
                if (curTime > prevTime) supplyMap[pid] = { supplierName: sName, createdAt: sCreated };
              }
            } catch (e) { /* ignore per-item mapping errors */ }
          });
        });

        // Annotate rows with supplierName and productCreatedAt from the latest matching supply
        rows = rows.map(r => {
          const pid = String(r.productId || '');
          const info = supplyMap[pid] || null;
          return { ...r, supplierName: info ? info.supplierName : (r.supplierName || ''), productCreatedAt: info ? info.createdAt : (r.createdAt || null) };
        });
      } catch (e) {
        // ignore supply mapping errors and proceed with rows as-is
      }

      setEntries(rows);
    } catch (e) { setError(e.message); }
  };

  // Suppliers / Banks and form-level state for Add modal
  const [suppliers, setSuppliers] = React.useState([]);
  const [banks, setBanks] = React.useState([]);
  const [supplierId, setSupplierId] = React.useState('');
  const [bankId, setBankId] = React.useState('');
  const [supplierAmount, setSupplierAmount] = React.useState('');
  const [gstAmount, setGstAmount] = React.useState('');
  const [category, setCategory] = React.useState('');

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

  const loadBanks = async () => {
    try {
      const storedBranchToken = typeof window !== 'undefined' ? (localStorage.getItem('branch_token') || '') : '';
      const effectiveToken = token || storedBranchToken || '';
      let res = await fetch((salesUrl || '') + '/api/banks', { headers: { Authorization: 'Bearer ' + effectiveToken } });
      if (res.status === 401 && storedBranchToken && storedBranchToken !== effectiveToken) {
        res = await fetch((salesUrl || '') + '/api/banks', { headers: { Authorization: 'Bearer ' + storedBranchToken } });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load banks');
      setBanks(Array.isArray(data.banks) ? data.banks : []);
    } catch (e) { /* ignore */ }
  };

  // Add New Stock modal state
  const [openAdd, setOpenAdd] = React.useState(false);
  const [itemsToAdd, setItemsToAdd] = React.useState([{ productNo: '', productName: '', brand: '', model: '', qty: 1, costPrice: '', sellingPrice: '', validity: '', imes: [] }]);
  const [adding, setAdding] = React.useState(false);
  const [addError, setAddError] = React.useState('');

  const updateAddItem = (idx, field, value) => setItemsToAdd(list => list.map((it, i) => {
    if (i !== idx) return it;
    // if quantity changed and category is Mobile, ensure imes array length matches quantity
    if (field === 'qty') {
      const qty = Number(value) || 0;
      const prevImes = Array.isArray(it.imes) ? it.imes.slice(0, qty) : [];
      while (prevImes.length < qty) prevImes.push('');
      return { ...it, [field]: value, imes: prevImes };
    }
    return { ...it, [field]: value };
  }));
  const addAddRow = () => setItemsToAdd(list => [...list, { productNo: '', productName: '', brand: '', model: '', qty: 1, costPrice: '', sellingPrice: '', validity: '', imes: [] }]);
  const removeAddRow = (idx) => setItemsToAdd(list => list.filter((_, i) => i !== idx));

  const submitAdd = async () => {
    setAdding(true); setAddError('');
    try {
      const storedBranchToken = typeof window !== 'undefined' ? (localStorage.getItem('branch_token') || '') : '';
      const effectiveToken = token || storedBranchToken || '';
      const url = new URL((salesUrl || '') + '/api/branch-supply');
      // gather existing productNos from current branch entries to avoid collisions
      const existingNos = new Set((Array.isArray(entries) ? entries : []).map(r => String(r.productNo || r.productId || '').trim()).filter(Boolean));

      // generator: A0..A9, B0..B9 ... Z9 then AA0.. if needed
      function generateNextProductNo(usedSet) {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const digits = '0123456789';
        // first try single-letter + digit
        for (let i = 0; i < letters.length; i++) {
          for (let j = 0; j < digits.length; j++) {
            const candidate = letters[i] + digits[j];
            if (!usedSet.has(candidate)) return candidate;
          }
        }
        // fallback: two-letters + digit
        for (let a = 0; a < letters.length; a++) {
          for (let b = 0; b < letters.length; b++) {
            for (let d = 0; d < digits.length; d++) {
              const candidate = letters[a] + letters[b] + digits[d];
              if (!usedSet.has(candidate)) return candidate;
            }
          }
        }
        // last resort: random but ensure not used
        while (true) {
          const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
          if (!usedSet.has(rand)) return rand;
        }
      }

      const body = {
        branch_id: undefined, // optional: allow server to pick branch from token
        supplier_id: supplierId || undefined,
        bank_id: bankId || undefined,
        supplierAmount: Number(supplierAmount) || 0,
        gstAmount: Number(gstAmount) || 0,
        category: category || undefined,
        items: (() => {
          const used = new Set(existingNos);
          const mapped = [];
          for (const it of itemsToAdd) {
            let pno = it.productNo && it.productNo.trim() ? it.productNo.trim() : '';
            if (!pno) {
              pno = generateNextProductNo(used);
            }
            // mark as used to avoid duplicates within same submit
            used.add(pno);
            mapped.push({
              productId: it.productId || null,
              productNo: pno,
              productName: it.productName,
              brand: it.brand,
              model: it.model,
              qty: Number(it.qty) || 0,
              costPrice: Number(it.costPrice) || 0,
              sellingPrice: Number(it.sellingPrice) || 0,
              validity: it.validity || null,
              imes: Array.isArray(it.imes) ? it.imes.filter(x => x && x.trim()) : []
            });
          }
          return mapped;
        })()
      };
      let res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + effectiveToken }, body: JSON.stringify(body) });
      if (res.status === 401 && storedBranchToken && storedBranchToken !== effectiveToken) {
        res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + storedBranchToken }, body: JSON.stringify(body) });
      }
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to add');
      setOpenAdd(false);
  setItemsToAdd([{ productNo: '', productName: '', brand: '', model: '', qty: 1, costPrice: '', sellingPrice: '', validity: '', imes: [] }]);
  setSupplierId(''); setBankId(''); setSupplierAmount(''); setGstAmount(''); setCategory('');
      // reload entries and notify other components
      await loadEntries();
  try { window.dispatchEvent(new CustomEvent('branch-stock-updated', { detail: { supply: data.supply || null, rows: data.rows || [] } })); } catch (__) {}
    } catch (e) { setAddError(e.message); } finally { setAdding(false); }
  };

  // Keep imes length in sync when category is Mobile
  React.useEffect(() => {
    setItemsToAdd(prev => prev.map(item => {
      const qty = Number(item.qty) || 0;
      if (category === 'Mobile') {
        const imes = Array.isArray(item.imes) ? item.imes.slice(0, qty) : [];
        while (imes.length < qty) imes.push('');
        return { ...item, imes };
      }
      // clear imes for non-mobile categories to avoid showing inputs
      return { ...item, imes: [] };
    }));
  }, [category]);

  React.useEffect(() => { loadEntries(); loadSuppliers(); loadBanks(); }, [token]);
  React.useEffect(() => {
    const onUpdated = (e) => {
      // if branch-specific update then reload regardless; UI will decide filtering
      loadEntries();
    };
    window.addEventListener('branch-stock-updated', onUpdated);
    return () => window.removeEventListener('branch-stock-updated', onUpdated);
  }, [token]);

  const canSubmitAdd = React.useMemo(() => {
    if (!supplierId || !bankId) return false;
    if (!Array.isArray(itemsToAdd) || itemsToAdd.length === 0) return false;
    if (!itemsToAdd.every(it => it.productName && Number(it.qty) > 0)) return false;
    return true;
  }, [supplierId, bankId, itemsToAdd]);

  const currency = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

  // Filtering logic
  const filteredEntries = React.useMemo(() => {
    return entries.filter(it => {
      const qtyVal = it.branchQty ?? it.qty ?? '';
      // prepare IME string for searching
  const centralArr = Array.isArray(it.centralOnlyImes) && it.centralOnlyImes.length ? it.centralOnlyImes : (Array.isArray(it.centralImes) ? it.centralImes : []);
  const imesStr = [ ...(Array.isArray(it.imes) ? it.imes : []), ...centralArr ].join(',');
      return (
        (!productNoFilter || (it.productNo || '').toLowerCase().includes(productNoFilter.toLowerCase())) &&
        (!productNameFilter || (it.productName || '').toLowerCase().includes(productNameFilter.toLowerCase())) &&
        (!brandFilter || (it.brand || '').toLowerCase().includes(brandFilter.toLowerCase())) &&
        (!modelFilter || (it.model || '').toLowerCase().includes(modelFilter.toLowerCase())) &&
        (!qtyFilter || String(qtyVal).includes(qtyFilter)) &&
        (!imesFilter || imesStr.toLowerCase().includes(imesFilter.toLowerCase()))
      );
    });
  }, [entries, productNoFilter, productNameFilter, brandFilter, modelFilter, qtyFilter, imesFilter]);

  // Compute total branch stock value (Qty * Selling Price) for displayed rows
  const branchStockTotal = React.useMemo(() => {
    // helper to coerce numbers and strip currency formatting like '₹1,110.00'
    function toNumber(val) {
      if (val == null) return 0;
      if (typeof val === 'number') return val;
      try {
        const cleaned = String(val).replace(/[^0-9.-]+/g, '');
        const f = parseFloat(cleaned);
        return isNaN(f) ? 0 : f;
      } catch (e) { return 0; }
    }

    return filteredEntries.reduce((sum, it) => {
      const qty = toNumber(it.branchQty ?? it.qty ?? 0) || 0;
      // Use selling price for branch stock value; accept formatted strings as well
      const selling = toNumber(it.sellingPrice ?? it.selling ?? it.sellPrice ?? 0) || 0;
      return sum + qty * selling;
    }, 0);
  }, [filteredEntries]);

  // Provide a breakdown of per-row contributions used to compute the total
  const branchStockBreakdown = React.useMemo(() => {
    function toNumber(val) {
      if (val == null) return 0;
      if (typeof val === 'number') return val;
      try {
        const cleaned = String(val).replace(/[^0-9.-]+/g, '');
        const f = parseFloat(cleaned);
        return isNaN(f) ? 0 : f;
      } catch (e) { return 0; }
    }
    const items = filteredEntries.map(it => {
      const qty = toNumber(it.branchQty ?? it.qty ?? 0) || 0;
      const selling = toNumber(it.sellingPrice ?? it.selling ?? it.sellPrice ?? 0) || 0;
      const amount = qty * selling;
      return {
        productNo: it.productNo || (it.productId || '').toString(),
        productName: it.productName || '-',
        qty,
        selling,
        amount
      };
    }).filter(i => i.qty !== 0 && i.amount !== 0);
    const total = items.reduce((s, it) => s + it.amount, 0);
    return { items, total };
  }, [filteredEntries]);

  return (
    <div>
      <div className="card mt-3 table-card">
        <div style={{display:'flex', alignItems:'center', gap:12, justifyContent:'flex-start'}}>
          {/* Total value red box (left) */}
          <div style={{background:'#ffe6e6', border:'1px solid #ffcccc', color:'#b30000', padding:'10px 14px', borderRadius:6, fontWeight:600}} title="Branch stock total value">
            <div style={{display:'flex', alignItems:'center', gap:12}}>
              <div>Branch Stock Value: {currency(branchStockTotal)}</div>
              <button className="btn" style={{padding:'4px 8px'}} onClick={() => setShowBreakdown(s => !s)}>{showBreakdown ? 'Hide' : 'Show'} breakdown</button>
            </div>
            {showBreakdown && (
              <div style={{marginTop:8, background:'#fff', color:'#111', padding:8, borderRadius:6, boxShadow:'inset 0 0 0 1px rgba(0,0,0,0.03)'}}>
                {branchStockBreakdown.items.length === 0 ? (
                  <div style={{fontSize:12, color:'#6b7280'}}>No non-zero contributions</div>
                ) : (
                  <div style={{fontSize:13}}>
                    {branchStockBreakdown.items.map((b, i) => (
                      <div key={i} style={{display:'flex', justifyContent:'space-between', gap:12, padding:'2px 0'}}>
                        <div style={{minWidth:220}}>{b.productNo} — {b.productName}</div>
                        <div style={{color:'#6b7280'}}>{b.qty} × {currency(b.selling)}</div>
                        <div style={{fontWeight:700}}>{currency(b.amount)}</div>
                      </div>
                    ))}
                    <div style={{borderTop:'1px dashed #e5e7eb', marginTop:6, paddingTop:6, display:'flex', justifyContent:'space-between'}}>
                      <div style={{color:'#6b7280'}}>Subtotal</div>
                      <div style={{fontWeight:800}}>{currency(branchStockBreakdown.total)}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{minWidth:12}} />
          <div className="table-title">In Stock (Branch)</div>
          <div style={{marginLeft:12}}>
            <button className="btn btn-primary" type="button" onClick={() => setOpenAdd(true)}>📦 Add New Stock</button>
          </div>
        </div>

        {/* Filter Section */}
        <div className="filter-section" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px', marginTop:12 }}>
          <input type="text" placeholder="Filter by Product No" value={productNoFilter} onChange={e => setProductNoFilter(e.target.value)} style={{ padding: '8px', width: '160px' }} />
          <input type="text" placeholder="Filter by Product Name" value={productNameFilter} onChange={e => setProductNameFilter(e.target.value)} style={{ padding: '8px', width: '160px' }} />
          <input type="text" placeholder="Filter by Brand" value={brandFilter} onChange={e => setBrandFilter(e.target.value)} style={{ padding: '8px', width: '120px' }} />
          <input type="text" placeholder="Filter by Model" value={modelFilter} onChange={e => setModelFilter(e.target.value)} style={{ padding: '8px', width: '120px' }} />
          <input type="text" placeholder="Filter by Qty" value={qtyFilter} onChange={e => setQtyFilter(e.target.value)} style={{ padding: '8px', width: '80px' }} />
          <input type="text" placeholder="Filter by IME" value={imesFilter} onChange={e => setImesFilter(e.target.value)} style={{ padding: '8px', width: '160px' }} />
          </div>
        {filteredEntries.length === 0 ? (
          <div className="empty-state" style={{padding:24}}>
            <div className="empty-icon">📦</div>
            <div className="empty-title">No Entries</div>
            <div className="empty-sub">No in-stock entries found for this branch.</div>
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
                  <th>Qty </th>
                  <th>Cost Price</th>
                  <th>Selling Price</th>
                  <th>Supplier</th>
                  <th>Product Date</th>
                  <th>Days in Stock</th>
                  <th>Validity</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((it, idx) => (
                  <tr key={it._id || idx}>
                    <td>{it.productNo || '-'}</td>
                    <td>{it.productName || '-'}</td>
                    <td>{it.brand || '-'}</td>
                    <td>{it.model || '-'}</td>
                    <td>{it.branchQty ?? (it.qty ?? '-')}</td>
                    <td>{(() => {
                      // Determine whether this row references a central InStock item.
                      // Central refs are stored as '<docId>_<idx>' where docId is a 24-char hex ObjectId.
                      // Treat anything else (including 'branch_...') as branch-only so costPrice is shown.
                      const pid = String(it.productId || '');
                      const isCentralRef = /^[0-9a-fA-F]{24}_[0-9]+$/.test(pid);
                      const isBranchOnly = !isCentralRef;
                      if (!isBranchOnly) return '-';
                      const qtyVal = Number(it.branchQty ?? it.qty ?? 0) || 0;
                      const rawCost = (it.costPrice ?? it.cost ?? null);
                      let unitCost = null;
                      if (rawCost != null) unitCost = Number(rawCost) || 0;
                      else if (it.totalCostPrice != null && qtyVal > 0) unitCost = Number(it.totalCostPrice) / qtyVal;
                      return unitCost != null ? currency(unitCost) : '-';
                    })()}</td>
                    <td>{it.sellingPrice != null ? currency(it.sellingPrice) : '-'}</td>
                    <td>{it.supplierName || '-'}</td>
                    <td>{it.productCreatedAt ? new Date(it.productCreatedAt).toLocaleDateString() : '-'}</td>
                    <td>{(() => {
                      if (!it.productCreatedAt) return '-';
                      try {
                        const created = new Date(it.productCreatedAt);
                        const now = new Date();
                        // Calculate calendar day difference using UTC to avoid timezone/time-of-day issues
                        const utcToday = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
                        const utcCreated = Date.UTC(created.getFullYear(), created.getMonth(), created.getDate());
                        const diffDays = Math.floor((utcToday - utcCreated) / (1000 * 60 * 60 * 24));
                        return diffDays >= 0 ? diffDays : '-';
                      } catch (e) { return '-'; }
                    })()}</td>
                    <td>{it.validity ? new Date(it.validity).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {error ? <div className="mt-2 text-danger" style={{padding:12}}>{error}</div> : null}
      </div>

      {openAdd && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <div style={{fontWeight:800}}>Add Branch Stock</div>
              <button className="btn secondary" onClick={() => { setOpenAdd(false); setAddError(''); setItemsToAdd([{ productNo: '', productName: '', brand: '', model: '', qty: 1, costPrice: '', sellingPrice: '', validity: '', imes: [] }]); }}>Close</button>
            </div>
            <div className="modal-body">
              {addError ? <div className="text-danger" style={{marginBottom:8}}>{addError}</div> : null}
              <div className="row" style={{display:'flex', gap:12, marginBottom:12}}>
                <div style={{flex:1}}>
                  <label>Supplier</label>
                  <select value={supplierId} onChange={e=>setSupplierId(e.target.value)}>
                    <option value="">Select supplier</option>
                    {suppliers.map(s => <option key={s._id} value={s._id}>{s.supplierName || s.agencyName || s._id}</option>)}
                  </select>
                </div>
                <div style={{flex:1}}>
                  <label>Bank</label>
                  <select value={bankId} onChange={e=>setBankId(e.target.value)}>
                    <option value="">Select bank</option>
                    {banks.map(b => <option key={b._id} value={b._id}>{b.bankName || b.accountNumber || b._id}</option>)}
                  </select>
                </div>
                <div style={{width:160}}>
                  <label>Supplier Amount</label>
                  <input type="number" value={supplierAmount} onChange={e=>setSupplierAmount(e.target.value)} placeholder="Supplier Amount" />
                </div>
                <div style={{width:160}}>
                  <label>GST Amount</label>
                  <input type="number" value={gstAmount} onChange={e=>setGstAmount(e.target.value)} placeholder="GST Amount" />
                </div>
                <div style={{width:180}}>
                  <label>Category</label>
                  <select value={category} onChange={e=>setCategory(e.target.value)}>
                    <option value="">Select category</option>
                    <option value="Accessories">Accessories</option>
                    <option value="Mobile">Mobile</option>
                  </select>
                </div>
              </div>
              <div className="table-scroll">
                <table className="pretty-table">
                  <thead>
                    <tr>
                      <th>Product No</th>
                      <th>Product Name</th>
                      <th>Brand</th>
                      <th>Model</th>
                      <th>Qty</th>
                      <th>Cost Price</th>
                      <th>Selling Price</th>
                      {category === 'Mobile' && <th style={{width: '220px'}}>IMES No</th>}
                      <th>Validity</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsToAdd.map((it, idx) => (
                      <tr key={idx}>
                        <td><input value={it.productNo} onChange={e=>updateAddItem(idx,'productNo',e.target.value)} placeholder="Product No (optional)" /></td>
                        <td><input value={it.productName} onChange={e=>updateAddItem(idx,'productName',e.target.value)} placeholder="Name" /></td>
                        <td><input value={it.brand} onChange={e=>updateAddItem(idx,'brand',e.target.value)} placeholder="Brand" /></td>
                        <td><input value={it.model} onChange={e=>updateAddItem(idx,'model',e.target.value)} placeholder="Model" /></td>
                        <td style={{maxWidth:140}}><input type="number" style={{width:'120px'}} value={it.qty === undefined ? '' : it.qty} onChange={e=>updateAddItem(idx,'qty',e.target.value)} placeholder="1" /></td>
                        <td><input type="number" value={it.costPrice} onChange={e=>updateAddItem(idx,'costPrice',e.target.value)} placeholder="0" /></td>
                        <td><input type="number" value={it.sellingPrice} onChange={e=>updateAddItem(idx,'sellingPrice',e.target.value)} placeholder="0" /></td>
                        {category === 'Mobile' && (
                          <td style={{width: '220px'}}>
                            <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                              {(() => {
                                const qty = Number(it.qty) || 1;
                                const imesArr = Array.isArray(it.imes) && it.imes.length ? it.imes.slice(0, qty) : Array.from({ length: qty }, () => '');
                                return imesArr.map((im, iim) => (
                                  <input
                                    key={iim}
                                    value={im}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setItemsToAdd(list => list.map((row, rIdx) => {
                                        if (rIdx !== idx) return row;
                                        const qtyLocal = Number(row.qty) || 1;
                                        const newImes = Array.isArray(row.imes) ? row.imes.slice(0, qtyLocal) : Array.from({ length: qtyLocal }, () => '');
                                        while (newImes.length < qtyLocal) newImes.push('');
                                        newImes[iim] = val;
                                        return { ...row, imes: newImes };
                                      }));
                                    }}
                                    placeholder={`IMEI ${iim+1}`}
                                    style={{ width: 160 }}
                                  />
                                ));
                              })()}
                            </div>
                          </td>
                        )}
                        <td><input type="date" value={it.validity || ''} onChange={e=>updateAddItem(idx,'validity',e.target.value)} /></td>
                        <td><button className="btn secondary" type="button" onClick={()=>removeAddRow(idx)}>Remove</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="row mt-2">
                <button className="btn secondary" type="button" onClick={addAddRow}>Add Row</button>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" disabled={adding || !canSubmitAdd} onClick={async ()=>{ await submitAdd(); }}>{adding ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Register globally for in-browser JSX loader
window.BranchInStock = BranchInStock;

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
  const [showBarcodeSheet, setShowBarcodeSheet] = React.useState(false);

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

  // Suppliers and form-level state for Add modal
  const [suppliers, setSuppliers] = React.useState([]);
  const [supplierId, setSupplierId] = React.useState('');
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
  setSupplierId(''); setSupplierAmount(''); setGstAmount(''); setCategory('');
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

  React.useEffect(() => { loadEntries(); loadSuppliers(); }, [token]);
  React.useEffect(() => {
    const onUpdated = (e) => {
      // if branch-specific update then reload regardless; UI will decide filtering
      loadEntries();
    };
    window.addEventListener('branch-stock-updated', onUpdated);
    return () => window.removeEventListener('branch-stock-updated', onUpdated);
  }, [token]);

  const canSubmitAdd = React.useMemo(() => {
    if (!supplierId) return false;
    if (!Array.isArray(itemsToAdd) || itemsToAdd.length === 0) return false;
    if (!itemsToAdd.every(it => it.productName && Number(it.qty) > 0)) return false;
    return true;
  }, [supplierId, itemsToAdd]);

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

  // Transform branch entries for BarcodeSheet component
  const barcodeEntries = React.useMemo(() => {
    // Transform branch entries (flat array) to InStock entries format (array of entries with items)
    // Group products by category for better organization
    const grouped = {};
    
    entries.forEach(row => {
      const category = row.category || 'Uncategorized';
      if (!grouped[category]) {
        grouped[category] = {
          category: category,
          items: []
        };
      }
      
      grouped[category].items.push({
        productNo: row.productNo || row.productId || '',
        productName: row.productName || '',
        brand: row.brand || '',
        model: row.model || '',
        quantity: row.branchQty ?? row.qty ?? 0,
        imes: Array.isArray(row.imes) ? row.imes : (row.imei ? [row.imei] : [])
      });
    });
    
    return Object.values(grouped);
  }, [entries]);

  return (
    <div style={{ padding: '24px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ 
          fontSize: '32px', 
          fontWeight: '700', 
          color: '#1e293b', 
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          🏢 Branch Inventory
        </h1>
        <p style={{ color: '#64748b', fontSize: '16px', margin: 0 }}>
          Manage and track your branch-specific inventory stock
        </p>
      </div>

      {/* Statistics Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: '24px', 
        marginBottom: '32px' 
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '16px',
          padding: '24px',
          color: 'white',
          boxShadow: '0 10px 25px rgba(102, 126, 234, 0.15)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ 
              fontSize: '28px', 
              marginRight: '16px',
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '12px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>📦</div>
            <div>
              <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '4px' }}>Total Items</div>
              <div style={{ fontSize: '28px', fontWeight: '700' }}>
                {filteredEntries.length}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '14px', opacity: 0.8 }}>Items in branch inventory</div>
        </div>
       
        <div style={{
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          borderRadius: '16px',
          padding: '24px',
          color: 'white',
          boxShadow: '0 10px 25px rgba(240, 147, 251, 0.15)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ 
              fontSize: '28px', 
              marginRight: '16px',
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '12px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>📊</div>
            <div>
              <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '4px' }}>Total Quantity</div>
              <div style={{ fontSize: '28px', fontWeight: '700' }}>
                {filteredEntries.reduce((sum, item) => sum + (Number(item.branchQty || item.qty) || 0), 0)}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '14px', opacity: 0.8 }}>Units in stock</div>
        </div>
       
        <div style={{
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          borderRadius: '16px',
          padding: '24px',
          color: 'white',
          boxShadow: '0 10px 25px rgba(79, 172, 254, 0.15)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ 
              fontSize: '28px', 
              marginRight: '16px',
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '12px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>💰</div>
            <div>
              <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '4px' }}>Stock Value</div>
              <div style={{ fontSize: '28px', fontWeight: '700' }}>
                {currency(branchStockTotal)}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '14px', opacity: 0.8 }}>
            <button 
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
              onClick={() => setShowBreakdown(s => !s)}
            >
              {showBreakdown ? 'Hide' : 'Show'} breakdown
            </button>
          </div>
        </div>
      </div>

      {/* Stock Value Breakdown */}
      {showBreakdown && (
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '32px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e2e8f0'
        }}>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: '#1e293b',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            💰 Stock Value Breakdown
          </h3>
          
          {branchStockBreakdown.items.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '32px',
              background: '#f8fafc',
              borderRadius: '12px',
              border: '2px dashed #cbd5e1'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📊</div>
              <div style={{ color: '#6b7280', fontSize: '14px' }}>No items contributing to stock value</div>
            </div>
          ) : (
            <div style={{ 
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              overflow: 'hidden'
            }}>
              <div style={{ background: '#f8fafc', padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>
                  <div>PRODUCT</div>
                  <div style={{ textAlign: 'center' }}>CALCULATION</div>
                  <div style={{ textAlign: 'right' }}>VALUE</div>
                </div>
              </div>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {branchStockBreakdown.items.map((b, i) => (
                  <div key={i} style={{
                    display: 'grid', 
                    gridTemplateColumns: '2fr 1fr 1fr', 
                    gap: '16px',
                    padding: '12px 16px',
                    borderBottom: i < branchStockBreakdown.items.length - 1 ? '1px solid #f1f5f9' : 'none',
                    fontSize: '14px'
                  }}>
                    <div>
                      <div style={{ fontWeight: '500', color: '#1e293b' }}>{b.productNo}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>{b.productName}</div>
                    </div>
                    <div style={{ textAlign: 'center', color: '#6b7280' }}>
                      {b.qty} × {currency(b.selling)}
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: '600', color: '#059669' }}>
                      {currency(b.amount)}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ 
                padding: '12px 16px', 
                background: '#f8fafc', 
                borderTop: '2px solid #e2e8f0',
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr',
                gap: '16px'
              }}>
                <div></div>
                <div style={{ textAlign: 'center', fontSize: '14px', fontWeight: '600', color: '#6b7280' }}>
                  Total Value
                </div>
                <div style={{ textAlign: 'right', fontSize: '18px', fontWeight: '700', color: '#059669' }}>
                  {currency(branchStockBreakdown.total)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions Section */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '32px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <h3 style={{ 
              fontSize: '24px', 
              fontWeight: '600', 
              color: '#1e293b',
              marginBottom: '8px'
            }}>Inventory Management</h3>
            <p style={{ 
              color: '#64748b', 
              fontSize: '16px',
              margin: 0
            }}>Add new products and manage your branch inventory</p>
          </div>
          <button 
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
              transition: 'all 0.2s ease'
            }}
            type="button" 
            onClick={() => setOpenAdd(true)}
            onMouseOver={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
            }}
            onMouseOut={(e) => {
              e.target.style.transform = 'translateY(0px)';
              e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
            }}
          >
            📦 Add New Stock
          </button>

          <button 
            style={{
              background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: entries.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(250, 112, 154, 0.3)',
              transition: 'all 0.2s ease',
              opacity: entries.length === 0 ? 0.6 : 1
            }}
            type="button" 
            onClick={() => entries.length > 0 && setShowBarcodeSheet(true)}
            disabled={entries.length === 0}
            onMouseOver={(e) => {
              if (entries.length > 0) {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 16px rgba(250, 112, 154, 0.4)';
              }
            }}
            onMouseOut={(e) => {
              e.target.style.transform = 'translateY(0px)';
              e.target.style.boxShadow = '0 4px 12px rgba(250, 112, 154, 0.3)';
            }}
          >
            📊 Generate Barcode Labels
          </button>
        </div>

        {/* Filter Section */}
        <div>
          <h4 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: '#1e293b',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            🔍 Filter Inventory
          </h4>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
            gap: '16px'
          }}>
            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '500', 
                color: '#374151',
                marginBottom: '6px'
              }}>Product No</label>
              <input 
                type="text" 
                placeholder="Search by product number" 
                value={productNoFilter} 
                onChange={e => setProductNoFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  transition: 'border-color 0.2s ease',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '500', 
                color: '#374151',
                marginBottom: '6px'
              }}>Product Name</label>
              <input 
                type="text" 
                placeholder="Search by product name" 
                value={productNameFilter} 
                onChange={e => setProductNameFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  transition: 'border-color 0.2s ease',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '500', 
                color: '#374151',
                marginBottom: '6px'
              }}>Brand</label>
              <input 
                type="text" 
                placeholder="Search by brand" 
                value={brandFilter} 
                onChange={e => setBrandFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  transition: 'border-color 0.2s ease',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '500', 
                color: '#374151',
                marginBottom: '6px'
              }}>Model</label>
              <input 
                type="text" 
                placeholder="Search by model" 
                value={modelFilter} 
                onChange={e => setModelFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  transition: 'border-color 0.2s ease',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '500', 
                color: '#374151',
                marginBottom: '6px'
              }}>Quantity</label>
              <input 
                type="text" 
                placeholder="Filter by quantity" 
                value={qtyFilter} 
                onChange={e => setQtyFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  transition: 'border-color 0.2s ease',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '500', 
                color: '#374151',
                marginBottom: '6px'
              }}>IMEI</label>
              <input 
                type="text" 
                placeholder="Search by IMEI" 
                value={imesFilter} 
                onChange={e => setImesFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  transition: 'border-color 0.2s ease',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Section */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '32px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ 
            fontSize: '24px', 
            fontWeight: '600', 
            color: '#1e293b',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            📦 Branch Inventory Items
          </h3>
          <p style={{ 
            color: '#64748b', 
            fontSize: '16px',
            margin: 0
          }}>
            Showing {filteredEntries.length} item{filteredEntries.length !== 1 ? 's' : ''} in branch inventory
          </p>
        </div>
        {filteredEntries.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '64px 24px',
            background: '#f8fafc',
            borderRadius: '12px',
            border: '2px dashed #cbd5e1'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
            <div style={{ fontSize: '20px', fontWeight: '600', color: '#475569', marginBottom: '8px' }}>
              No Inventory Items
            </div>
            <div style={{ color: '#64748b', fontSize: '16px' }}>
              No in-stock entries found for this branch
            </div>
          </div>
        ) : (
          <div style={{ 
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            overflow: 'hidden',
            background: '#fff'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                fontSize: '14px'
              }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{
                      padding: '16px 12px',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: '#374151',
                      borderBottom: '2px solid #e5e7eb',
                      minWidth: '120px'
                    }}>Product No</th>
                    <th style={{
                      padding: '16px 12px',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: '#374151',
                      borderBottom: '2px solid #e5e7eb',
                      minWidth: '180px'
                    }}>Product Name</th>
                    <th style={{
                      padding: '16px 12px',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: '#374151',
                      borderBottom: '2px solid #e5e7eb',
                      minWidth: '120px'
                    }}>Brand</th>
                    <th style={{
                      padding: '16px 12px',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: '#374151',
                      borderBottom: '2px solid #e5e7eb',
                      minWidth: '120px'
                    }}>Model</th>
                    <th style={{
                      padding: '16px 12px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#374151',
                      borderBottom: '2px solid #e5e7eb',
                      width: '80px'
                    }}>Qty</th>
                    <th style={{
                      padding: '16px 12px',
                      textAlign: 'right',
                      fontWeight: '600',
                      color: '#374151',
                      borderBottom: '2px solid #e5e7eb',
                      minWidth: '120px'
                    }}>Cost Price</th>
                    <th style={{
                      padding: '16px 12px',
                      textAlign: 'right',
                      fontWeight: '600',
                      color: '#374151',
                      borderBottom: '2px solid #e5e7eb',
                      minWidth: '120px'
                    }}>Selling Price</th>
                    <th style={{
                      padding: '16px 12px',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: '#374151',
                      borderBottom: '2px solid #e5e7eb',
                      minWidth: '130px'
                    }}>Supplier</th>
                    <th style={{
                      padding: '16px 12px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#374151',
                      borderBottom: '2px solid #e5e7eb',
                      minWidth: '120px'
                    }}>Product Date</th>
                    <th style={{
                      padding: '16px 12px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#374151',
                      borderBottom: '2px solid #e5e7eb',
                      width: '100px'
                    }}>Days in Stock</th>
                    <th style={{
                      padding: '16px 12px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#374151',
                      borderBottom: '2px solid #e5e7eb',
                      minWidth: '120px'
                    }}>Validity</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((it, idx) => (
                    <tr 
                      key={it._id || idx}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseOver={(e) => e.target.parentElement.style.backgroundColor = '#f8fafc'}
                      onMouseOut={(e) => e.target.parentElement.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '16px 12px' }}>
                        <span style={{
                          background: '#f1f5f9',
                          color: '#475569',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontFamily: 'monospace'
                        }}>
                          {it.productNo || '-'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <div style={{ fontWeight: '500', color: '#1e293b' }}>
                          {it.productName || '-'}
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px', color: '#475569' }}>
                        {it.brand || '-'}
                      </td>
                      <td style={{ padding: '16px 12px', color: '#475569' }}>
                        {it.model || '-'}
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                        <span style={{
                          background: '#dbeafe',
                          color: '#1d4ed8',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          {it.branchQty ?? (it.qty ?? '-')}
                        </span>
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'right' }}>
                        <span style={{
                          color: '#dc2626',
                          fontWeight: '600'
                        }}>
                          {(() => {
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
                          })()}
                        </span>
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'right' }}>
                        <span style={{
                          color: '#059669',
                          fontWeight: '600'
                        }}>
                          {it.sellingPrice != null ? currency(it.sellingPrice) : '-'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <div style={{ fontWeight: '500', color: '#1e293b' }}>
                          {it.supplierName || '-'}
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
                        {it.productCreatedAt ? new Date(it.productCreatedAt).toLocaleDateString() : '-'}
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                        <span style={{
                          background: '#f3f4f6',
                          color: '#374151',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '12px'
                        }}>
                          {(() => {
                            if (!it.productCreatedAt) return '-';
                            try {
                              const created = new Date(it.productCreatedAt);
                              const now = new Date();
                              // Calculate calendar day difference using UTC to avoid timezone/time-of-day issues
                              const utcToday = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
                              const utcCreated = Date.UTC(created.getFullYear(), created.getMonth(), created.getDate());
                              const diffDays = Math.floor((utcToday - utcCreated) / (1000 * 60 * 60 * 24));
                              return diffDays >= 0 ? `${diffDays} days` : '-';
                            } catch (e) { return '-'; }
                          })()}
                        </span>
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
                        {it.validity ? new Date(it.validity).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            padding: '12px 16px',
            borderRadius: '8px',
            marginTop: '16px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Add Stock Modal */}
      {openAdd && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '1200px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '24px 32px',
              borderBottom: '1px solid #e5e7eb',
              position: 'sticky',
              top: 0,
              background: 'white',
              borderRadius: '16px 16px 0 0',
              zIndex: 10
            }}>
              <div>
                <h2 style={{ 
                  fontSize: '24px', 
                  fontWeight: '700', 
                  color: '#1e293b',
                  margin: 0,
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  📦 Add Branch Stock
                </h2>
                <p style={{ 
                  color: '#64748b', 
                  fontSize: '14px', 
                  margin: 0 
                }}>Add new products to your branch inventory</p>
              </div>
              <button 
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
                onClick={() => { 
                  setOpenAdd(false); 
                  setAddError(''); 
                  setItemsToAdd([{ productNo: '', productName: '', brand: '', model: '', qty: 1, costPrice: '', sellingPrice: '', validity: '', imes: [] }]); 
                }}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ padding: '32px' }}>
              {addError && (
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  marginBottom: '24px',
                  fontSize: '14px'
                }}>
                  {addError}
                </div>
              )}

              {/* Supply Information Section */}
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ 
                  fontSize: '18px', 
                  fontWeight: '600', 
                  color: '#1e293b',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  ℹ️ Supply Information
                </h3>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                  gap: '20px' 
                }}>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '14px', 
                      fontWeight: '500', 
                      color: '#374151',
                      marginBottom: '6px'
                    }}>Supplier *</label>
                    <select 
                      value={supplierId} 
                      onChange={e=>setSupplierId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px',
                        backgroundColor: 'white',
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    >
                      <option value="">Select supplier</option>
                      {suppliers.map(s => (
                        <option key={s._id} value={s._id}>
                          {s.supplierName || s.agencyName || s._id}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '14px', 
                      fontWeight: '500', 
                      color: '#374151',
                      marginBottom: '6px'
                    }}>Supplier Amount</label>
                    <input 
                      type="number" 
                      value={supplierAmount} 
                      onChange={e=>setSupplierAmount(e.target.value)} 
                      placeholder="0.00"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '14px', 
                      fontWeight: '500', 
                      color: '#374151',
                      marginBottom: '6px'
                    }}>GST Amount</label>
                    <input 
                      type="number" 
                      value={gstAmount} 
                      onChange={e=>setGstAmount(e.target.value)} 
                      placeholder="0.00"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '14px', 
                      fontWeight: '500', 
                      color: '#374151',
                      marginBottom: '6px'
                    }}>Category</label>
                    <select 
                      value={category} 
                      onChange={e=>setCategory(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px',
                        backgroundColor: 'white',
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    >
                      <option value="">Select category</option>
                      <option value="Accessories">Accessories</option>
                      <option value="Mobile">Mobile</option>
                    </select>
                  </div>
                </div>
              </div>
              {/* Products Section */}
              <div>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginBottom: '16px' 
                }}>
                  <h3 style={{ 
                    fontSize: '18px', 
                    fontWeight: '600', 
                    color: '#1e293b',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    📋 Product Details
                  </h3>
                  <button 
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    type="button" 
                    onClick={addAddRow}
                  >
                    ➕ Add Product
                  </button>
                </div>

                <div style={{ 
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  background: '#fff'
                }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ 
                      width: '100%', 
                      borderCollapse: 'collapse',
                      fontSize: '14px'
                    }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          <th style={{
                            padding: '12px',
                            textAlign: 'left',
                            fontWeight: '600',
                            color: '#374151',
                            borderBottom: '1px solid #e5e7eb',
                            minWidth: '120px'
                          }}>Product No</th>
                          <th style={{
                            padding: '12px',
                            textAlign: 'left',
                            fontWeight: '600',
                            color: '#374151',
                            borderBottom: '1px solid #e5e7eb',
                            minWidth: '150px'
                          }}>Product Name *</th>
                          <th style={{
                            padding: '12px',
                            textAlign: 'left',
                            fontWeight: '600',
                            color: '#374151',
                            borderBottom: '1px solid #e5e7eb',
                            minWidth: '100px'
                          }}>Brand</th>
                          <th style={{
                            padding: '12px',
                            textAlign: 'left',
                            fontWeight: '600',
                            color: '#374151',
                            borderBottom: '1px solid #e5e7eb',
                            minWidth: '100px'
                          }}>Model</th>
                          <th style={{
                            padding: '12px',
                            textAlign: 'center',
                            fontWeight: '600',
                            color: '#374151',
                            borderBottom: '1px solid #e5e7eb',
                            width: '80px'
                          }}>Qty</th>
                          <th style={{
                            padding: '12px',
                            textAlign: 'right',
                            fontWeight: '600',
                            color: '#374151',
                            borderBottom: '1px solid #e5e7eb',
                            minWidth: '120px'
                          }}>Cost Price</th>
                          <th style={{
                            padding: '12px',
                            textAlign: 'right',
                            fontWeight: '600',
                            color: '#374151',
                            borderBottom: '1px solid #e5e7eb',
                            minWidth: '120px'
                          }}>Selling Price</th>
                          {category === 'Mobile' && (
                            <th style={{
                              padding: '12px',
                              textAlign: 'left',
                              fontWeight: '600',
                              color: '#374151',
                              borderBottom: '1px solid #e5e7eb',
                              minWidth: '220px'
                            }}>IMEI Numbers</th>
                          )}
                          <th style={{
                            padding: '12px',
                            textAlign: 'center',
                            fontWeight: '600',
                            color: '#374151',
                            borderBottom: '1px solid #e5e7eb',
                            minWidth: '130px'
                          }}>Validity</th>
                          <th style={{
                            padding: '12px',
                            textAlign: 'center',
                            fontWeight: '600',
                            color: '#374151',
                            borderBottom: '1px solid #e5e7eb',
                            width: '60px'
                          }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemsToAdd.map((it, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '12px' }}>
                              <input 
                                value={it.productNo} 
                                onChange={e=>updateAddItem(idx,'productNo',e.target.value)} 
                                placeholder="Auto-generated"
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  outline: 'none'
                                }}
                              />
                            </td>
                            <td style={{ padding: '12px' }}>
                              <input 
                                value={it.productName} 
                                onChange={e=>updateAddItem(idx,'productName',e.target.value)} 
                                placeholder="Enter product name"
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: '2px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  outline: 'none'
                                }}
                              />
                            </td>
                            <td style={{ padding: '12px' }}>
                              <input 
                                value={it.brand} 
                                onChange={e=>updateAddItem(idx,'brand',e.target.value)} 
                                placeholder="Brand"
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  outline: 'none'
                                }}
                              />
                            </td>
                            <td style={{ padding: '12px' }}>
                              <input 
                                value={it.model} 
                                onChange={e=>updateAddItem(idx,'model',e.target.value)} 
                                placeholder="Model"
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  outline: 'none'
                                }}
                              />
                            </td>
                            <td style={{ padding: '12px' }}>
                              <input 
                                type="number" 
                                value={it.qty === undefined ? '' : it.qty} 
                                onChange={e=>updateAddItem(idx,'qty',e.target.value)} 
                                placeholder="1"
                                min="1"
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  textAlign: 'center',
                                  outline: 'none'
                                }}
                              />
                            </td>
                            <td style={{ padding: '12px' }}>
                              <input 
                                type="number" 
                                value={it.costPrice} 
                                onChange={e=>updateAddItem(idx,'costPrice',e.target.value)} 
                                placeholder="0.00"
                                step="0.01"
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  textAlign: 'right',
                                  outline: 'none'
                                }}
                              />
                            </td>
                            <td style={{ padding: '12px' }}>
                              <input 
                                type="number" 
                                value={it.sellingPrice} 
                                onChange={e=>updateAddItem(idx,'sellingPrice',e.target.value)} 
                                placeholder="0.00"
                                step="0.01"
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  textAlign: 'right',
                                  outline: 'none'
                                }}
                              />
                            </td>
                            {category === 'Mobile' && (
                              <td style={{ padding: '12px' }}>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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
                                        style={{ 
                                          width: '140px',
                                          padding: '6px 8px',
                                          border: '1px solid #d1d5db',
                                          borderRadius: '4px',
                                          fontSize: '12px',
                                          outline: 'none'
                                        }}
                                      />
                                    ));
                                  })()}
                                </div>
                              </td>
                            )}
                            <td style={{ padding: '12px' }}>
                              <input 
                                type="date" 
                                value={it.validity || ''} 
                                onChange={e=>updateAddItem(idx,'validity',e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  outline: 'none'
                                }}
                              />
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <button 
                                style={{
                                  background: '#fee2e2',
                                  color: '#dc2626',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '6px 8px',
                                  fontSize: '12px',
                                  cursor: 'pointer'
                                }}
                                type="button" 
                                onClick={()=>removeAddRow(idx)}
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              padding: '24px 32px',
              borderTop: '1px solid #e5e7eb',
              background: '#f8fafc',
              borderRadius: '0 0 16px 16px'
            }}>
              <button 
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
                onClick={() => { 
                  setOpenAdd(false); 
                  setAddError(''); 
                  setItemsToAdd([{ productNo: '', productName: '', brand: '', model: '', qty: 1, costPrice: '', sellingPrice: '', validity: '', imes: [] }]); 
                }}
              >
                Cancel
              </button>
              <button 
                disabled={adding || !canSubmitAdd}
                onClick={async ()=>{ await submitAdd(); }}
                style={{
                  background: canSubmitAdd && !adding 
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                    : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 24px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: canSubmitAdd && !adding ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {adding ? '💾 Saving...' : '✅ Save Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Sheet Modal */}
      {showBarcodeSheet && window.BarcodeSheet && (
        <window.BarcodeSheet 
          entries={barcodeEntries}
          onClose={() => setShowBarcodeSheet(false)}
        />
      )}
    </div>
  );
}

// Register globally for in-browser JSX loader
window.BranchInStock = BranchInStock;

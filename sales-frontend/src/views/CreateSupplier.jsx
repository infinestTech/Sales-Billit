function CreateSupplier({ salesUrl, token }) {
  // --- state (declare BEFORE using anywhere) ---
  const [rows, setRows] = React.useState([]);
  const [inStockEntries, setInStockEntries] = React.useState([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(10);


  // Feature context
  const { features, getFeatureLimit, isLimitReached } = window.useSalesFeatures ? window.useSalesFeatures() : {
    features: {},
    getFeatureLimit: () => 999,
    isLimitReached: () => false
  };


  const supplierLimit = getFeatureLimit('suppliers_limit', 'maxSuppliers');
  const currentSupplierCount = rows.length;
  const isAtLimit = isLimitReached('suppliers_limit', 'maxSuppliers', currentSupplierCount);


  // Filters
  const [agencyFilter, setAgencyFilter] = React.useState('');
  const [phoneFilter, setPhoneFilter] = React.useState('');
  const [panFilter, setPanFilter] = React.useState('');
  const [amountSort, setAmountSort] = React.useState(''); // 'high' | 'low' | ''


  // Form
  const [form, setForm] = React.useState({
    supplierName: '', agencyName: '', phoneNumber: '', address: '', gstNumber: '', panNumber: ''
  });


  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };


  // --- fetchers ---
  const fetchSuppliers = async () => {
    try {
      setError('');
      const res = await fetch(salesUrl + '/api/suppliers', { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load');
      const list = Array.isArray(data.suppliers) ? data.suppliers : [];
      setRows(list);
      setPage(1);
    } catch (err) {
      setError(err.message);
    }
  };


  const fetchInStock = async () => {
    try {
      const res = await fetch(salesUrl + '/api/in-stock', { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load in-stock');
      setInStockEntries(Array.isArray(data.entries) ? data.entries : []);
    } catch (err) {
      console.error(err);
    }
  };


  React.useEffect(() => {
    fetchSuppliers();
    fetchInStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // --- derived maps (must come BEFORE anything that uses them) ---
  const supplierAmountMap = React.useMemo(() => {
    const m = {};
    for (const e of inStockEntries) {
      const sid = e.supplier_id?._id || e.supplier_id;
      if (!sid) continue;
      m[sid] = (m[sid] || 0) + (Number(e.supplierAmount) || 0);
    }
    return m;
  }, [inStockEntries]);


  const supplierItemsCountMap = React.useMemo(() => {
    const m = {};
    for (const e of inStockEntries) {
      const sid = e.supplier_id?._id || e.supplier_id;
      if (!sid) continue;
      const cnt = Array.isArray(e.items) ? e.items.length : 0;
      m[sid] = (m[sid] || 0) + cnt;
    }
    return m;
  }, [inStockEntries]);


  // --- options (after rows exists) ---
  const agencyOptions = React.useMemo(() => {
    const set = new Set();
    rows.forEach(r => r.agencyName && set.add(r.agencyName));
    return Array.from(set);
  }, [rows]);


  const phoneOptions = React.useMemo(() => {
    const set = new Set();
    rows.forEach(r => r.phoneNumber && set.add(r.phoneNumber));
    return Array.from(set);
  }, [rows]);


  const panOptions = React.useMemo(() => {
    const set = new Set();
    rows.forEach(r => r.panNumber && set.add(r.panNumber));
    return Array.from(set);
  }, [rows]);


  // --- filtered/sorted data (after supplierAmountMap & rows exist) ---
  const filteredRows = React.useMemo(() => {
    let result = rows.filter(r => {
      const agencyMatch = !agencyFilter || (r.agencyName && r.agencyName.toLowerCase().includes(agencyFilter.toLowerCase()));
      const phoneMatch = !phoneFilter || (r.phoneNumber && r.phoneNumber.toLowerCase().includes(phoneFilter.toLowerCase()));
      const panMatch = !panFilter || (r.panNumber && r.panNumber.toLowerCase().includes(panFilter.toLowerCase()));
      return agencyMatch && phoneMatch && panMatch;
    });


    if (amountSort) {
      result = result.slice().sort((a, b) => {
        const aAmt = supplierAmountMap[a._id] || 0;
        const bAmt = supplierAmountMap[b._id] || 0;
        return amountSort === 'high' ? bAmt - aAmt : aAmt - bAmt;
      });
    }


    return result;
  }, [rows, agencyFilter, phoneFilter, panFilter, amountSort, supplierAmountMap]);


  // --- pagination (after filteredRows, page, pageSize exist) ---
  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(totalPages, Math.max(1, page));
  const startIndex = total === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const endIndex = Math.min(clampedPage * pageSize, total);
  const visible = filteredRows.slice((clampedPage - 1) * pageSize, (clampedPage - 1) * pageSize + pageSize);


  // --- submit ---
  const submit = async (e) => {
    e.preventDefault();
   
    // Check limit before creating
    if (isAtLimit) {
      window.checkSalesFeatureLimit('suppliers_limit', 'maxSuppliers', currentSupplierCount, features, 'Supplier');
      return;
    }
   
    setSaving(true);
    setError('');
    try {
      const res = await fetch(salesUrl + '/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Save failed');
      setForm({ supplierName: '', agencyName: '', phoneNumber: '', address: '', gstNumber: '', panNumber: '' });
      await fetchSuppliers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };


  return (
    <div>
      {/* Limit Warning */}
      {React.createElement(window.LimitGuard, {
        featureKey: 'suppliers_limit',
        limitKey: 'maxSuppliers',
        currentCount: currentSupplierCount,
        featureName: 'Supplier',
        showWarningAt: 0.8
      }, null)}
     
      {/* Filter Box */}
     
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Create Supplier</h3>
            <p className="card-description">
              Add new supplier for your inventory
              {supplierLimit < 999 && ` (${currentSupplierCount}/${supplierLimit} used)`}
            </p>
          </div>
        </div>


        {/* Show limit reached message */}
        {isAtLimit && (
          <div style={{
            backgroundColor: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '0.375rem',
            padding: '0.75rem',
            margin: '1rem',
            color: '#991b1b'
          }}>
            🚫 Supplier limit reached ({currentSupplierCount}/{supplierLimit}).
            <button
              onClick={() => window.open('/pricing', '_blank')}
              style={{
                marginLeft: '0.5rem',
                color: '#1d4ed8',
                textDecoration: 'underline',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Upgrade for more suppliers
            </button>
          </div>
        )}
       
        <form onSubmit={submit}>
          <div className="row mt-2">
            <div className="col">
              <label>Supplier Name</label>
              <input name="supplierName" value={form.supplierName} onChange={onChange} placeholder="Optional" />
            </div>
            <div className="col">
              <label>Agency Name</label>
              <input name="agencyName" value={form.agencyName} onChange={onChange} placeholder="Optional" />
            </div>
            <div className="col">
              <label>Phone Number</label>
              <input name="phoneNumber" value={form.phoneNumber} onChange={onChange} placeholder="Optional" />
            </div>
            <div className="col">
              <label>Address</label>
              <input name="address" value={form.address} onChange={onChange} placeholder="Optional" />
            </div>
          </div>
          <div className="row mt-2">
            <div className="col">
              <label>GST Number</label>
              <input name="gstNumber" value={form.gstNumber} onChange={onChange} placeholder="Optional" />
            </div>
            <div className="col">
              <label>PAN Number</label>
              <input name="panNumber" value={form.panNumber} onChange={onChange} placeholder="Optional" />
            </div>
          </div>
          <div className="row mt-3">
            <button className="btn" type="submit" disabled={saving || isAtLimit}>
              {isAtLimit ? `Limit reached (${currentSupplierCount}/${supplierLimit || '—'})` : (saving ? 'Saving…' : 'Save')}
            </button>
          </div>
          {error ? <div className="mt-2 text-danger">{error}</div> : null}
        </form>
      </div>


 <div className="card">
        <h3>Supplier Filters</h3><br />
          <div className="row mt-2">
              <div className="col">
            <label className="form-label">Agency Name</label>
            <input
              type="text"
              value={agencyFilter}
              onChange={e => { setAgencyFilter(e.target.value); setPage(1); }}
              className="form-input"
              placeholder="Search Agency Name"
            />
          </div>
          <div className="col">
            <label className="form-label">Phone Number</label>
            <input
              type="text"
              value={phoneFilter}
              onChange={e => { setPhoneFilter(e.target.value); setPage(1); }}
              className="form-input"
              placeholder="Search Phone Number"
            />
            </div>
            <div className="col">
               <label className="form-label">PAN Number</label>
            <input
              type="text"
              value={panFilter}
              onChange={e => { setPanFilter(e.target.value); setPage(1); }}
              className="form-input"
              placeholder="Search PAN Number"
            />
              </div>
              <div className="col">
                 <label className="form-label">Supplier Amount</label>
            <select value={amountSort} onChange={e => { setAmountSort(e.target.value); setPage(1); }} className="form-input">
              <option value="">None</option>
              <option value="high">High</option>
              <option value="low">Low</option>
            </select>
                </div>
            </div>


            </div>


      {/* Suppliers Table */}
      <div className="table-card">
        <div className="table-header">
          <div>
            <h3 className="table-title">Suppliers</h3>
            <p className="table-subtitle">Manage your supplier relationships</p>
          </div>
        </div>
        {visible.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏢</div>
            <div className="empty-title">No Suppliers</div>
            <div className="empty-description">Add your first supplier to get started</div>
            <button
              className="empty-action"
              onClick={() => {
                const input = document.querySelector('input[name="supplierName"]');
                if (input) input.focus();
              }}
            >
              🏢 Add Supplier
            </button>
          </div>
        ) : (
          <>
            <div className="table-scroll">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>No.</th>
                    <th>Supplier Name</th>
                    <th>Agency Name</th>
                    <th>Phone Number</th>
                    <th>Address</th>
                    <th>GST Number</th>
                    <th>PAN Number</th>
                    <th>Supplier Amount</th>
                    <th>Items Count</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r, i) => (
                    <tr key={r._id || (startIndex + i)}>
                      <td><span className="serial-badge">{startIndex + i}</span></td>
                      <td><span className="cell-strong">{r.supplierName || '-'}</span></td>
                      <td>{r.agencyName || '-'}</td>
                      <td>{r.phoneNumber || '-'}</td>
                      <td>{r.address || '-'}</td>
                      <td>{r.gstNumber || '-'}</td>
                      <td>{r.panNumber || '-'}</td>
                      <td><span className="amount-badge">{supplierAmountMap[r._id] ? supplierAmountMap[r._id] : 0}</span></td>
                      <td><span className="count-badge">{supplierItemsCountMap[r._id] ? supplierItemsCountMap[r._id] : 0}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <div className="table-info">
                {total === 0 ? 'No suppliers found' : `Showing ${startIndex} to ${endIndex} of ${total} suppliers`}
              </div>
              <div className="pagination">
                <button
                  className="pagination-btn"
                  type="button"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={clampedPage <= 1}
                >
                  ← Previous
                </button>
                <span className="pagination-info">Page {clampedPage} of {totalPages}</span>
                <button
                  className="pagination-btn"
                  type="button"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={clampedPage >= totalPages}
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}





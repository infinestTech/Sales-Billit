function MobileCreateSupplier({ salesUrl, token }) {
  const [rows, setRows] = React.useState([]);
  const [inStockEntries, setInStockEntries] = React.useState([]);
  const [saving, setSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(10);

  const formTopRef = React.useRef(null);
  const nameInputRef = React.useRef(null);

  const { features, getFeatureLimit, isLimitReached } = window.useSalesFeatures ? window.useSalesFeatures() : {
    features: {},
    getFeatureLimit: () => 999,
    isLimitReached: () => false
  };

  const supplierLimit = getFeatureLimit('suppliers_limit', 'maxSuppliers');
  const currentSupplierCount = rows.length;
  const isAtLimit = isLimitReached('suppliers_limit', 'maxSuppliers', currentSupplierCount);

  const decodeJwt = (tk) => {
    try {
      const base64 = tk.split('.')[1] || '';
      const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(json);
    } catch (_e) {
      return null;
    }
  };

  const storedBranchToken = typeof window !== 'undefined' ? (localStorage.getItem('branch_token') || '') : '';
  const effectiveToken = token || storedBranchToken || '';
  const decodedEffective = effectiveToken ? decodeJwt(effectiveToken) : null;
  const branchUserDecoded = decodedEffective && decodedEffective.branch_id ? decodedEffective : null;
  const effectiveIsAtLimit = branchUserDecoded ? false : isAtLimit;

  const [agencyFilter, setAgencyFilter] = React.useState('');
  const [phoneFilter, setPhoneFilter] = React.useState('');
  const [panFilter, setPanFilter] = React.useState('');
  const [amountSort, setAmountSort] = React.useState('');

  const [form, setForm] = React.useState({
    supplierName: '',
    agencyName: '',
    phoneNumber: '',
    address: '',
    gstNumber: '',
    panNumber: ''
  });

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const fetchSuppliers = React.useCallback(async () => {
    setLoading(true);
    try {
      setError('');
      let res = await fetch(salesUrl + '/api/suppliers', { headers: { Authorization: 'Bearer ' + effectiveToken } });
      if (res.status === 401 && storedBranchToken && storedBranchToken !== effectiveToken) {
        res = await fetch(salesUrl + '/api/suppliers', { headers: { Authorization: 'Bearer ' + storedBranchToken } });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load');
      const list = Array.isArray(data.suppliers) ? data.suppliers : [];
      setRows(list);
      setPage(1);
    } catch (err) {
      if (!branchUserDecoded) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [salesUrl, effectiveToken, storedBranchToken, branchUserDecoded]);

  const fetchInStock = React.useCallback(async () => {
    try {
      let res = await fetch(salesUrl + '/api/in-stock', { headers: { Authorization: 'Bearer ' + effectiveToken } });
      if (res.status === 401 && storedBranchToken && storedBranchToken !== effectiveToken) {
        res = await fetch(salesUrl + '/api/in-stock', { headers: { Authorization: 'Bearer ' + storedBranchToken } });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load in-stock');
      setInStockEntries(Array.isArray(data.entries) ? data.entries : []);
    } catch (err) {
      console.error(err);
    }
  }, [salesUrl, effectiveToken, storedBranchToken]);

  React.useEffect(() => {
    fetchSuppliers();
    fetchInStock();
  }, [fetchSuppliers, fetchInStock]);

  const supplierAmountMap = React.useMemo(() => {
    const map = {};
    for (const e of inStockEntries) {
      const supplierId = e.supplier_id?._id || e.supplier_id;
      if (!supplierId) continue;
      map[supplierId] = (map[supplierId] || 0) + (Number(e.supplierAmount) || 0);
    }
    return map;
  }, [inStockEntries]);

  const supplierItemsCountMap = React.useMemo(() => {
    const map = {};
    for (const e of inStockEntries) {
      const supplierId = e.supplier_id?._id || e.supplier_id;
      if (!supplierId) continue;
      const cnt = Array.isArray(e.items) ? e.items.length : 0;
      map[supplierId] = (map[supplierId] || 0) + cnt;
    }
    return map;
  }, [inStockEntries]);

  const filteredRows = React.useMemo(() => {
    let result = (rows || []).filter((r) => {
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

  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(totalPages, Math.max(1, page));
  const startIndex = total === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const endIndex = Math.min(clampedPage * pageSize, total);
  const visible = filteredRows.slice((clampedPage - 1) * pageSize, (clampedPage - 1) * pageSize + pageSize);

  const submit = async (e) => {
    e.preventDefault();

    if (effectiveIsAtLimit) {
      window.checkSalesFeatureLimit('suppliers_limit', 'maxSuppliers', currentSupplierCount, features, 'Supplier');
      return;
    }

    setSaving(true);
    setError('');

    try {
      let res = await fetch(salesUrl + '/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + effectiveToken },
        body: JSON.stringify(form)
      });

      if (res.status === 401 && storedBranchToken && storedBranchToken !== effectiveToken) {
        res = await fetch(salesUrl + '/api/suppliers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + storedBranchToken },
          body: JSON.stringify(form)
        });
      }

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Save failed');

      setForm({ supplierName: '', agencyName: '', phoneNumber: '', address: '', gstNumber: '', panNumber: '' });
      await fetchSuppliers();

      try {
        if (nameInputRef.current) nameInputRef.current.focus();
      } catch (_e) {}
    } catch (err) {
      if (!branchUserDecoded) setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setAgencyFilter('');
    setPhoneFilter('');
    setPanFilter('');
    setAmountSort('');
    setPage(1);
  };

  const scrollToCreate = () => {
    try {
      if (formTopRef.current) formTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => {
        try {
          if (nameInputRef.current) nameInputRef.current.focus();
        } catch (_e) {}
      }, 250);
    } catch (_e) {}
  };

  const badgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--text)'
  };

  return (
    <div className="mobile-content" style={{ paddingBottom: 80 }}>
      {!branchUserDecoded && React.createElement(window.LimitGuard, {
        featureKey: 'suppliers_limit',
        limitKey: 'maxSuppliers',
        currentCount: currentSupplierCount,
        featureName: 'Supplier',
        showWarningAt: 0.8
      }, null)}

      <div className="card" ref={formTopRef} style={{ marginBottom: 12 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>🏢 Supplier Management</div>
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>
            Create and manage suppliers
            {!branchUserDecoded && supplierLimit < 999 ? ` (${currentSupplierCount}/${supplierLimit} used)` : ''}
          </div>
        </div>

        {effectiveIsAtLimit ? (
          <div style={{
            backgroundColor: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '0.5rem',
            padding: '0.75rem',
            marginBottom: 12,
            color: '#991b1b',
            fontSize: 13
          }}>
            🚫 Supplier limit reached ({currentSupplierCount}/{supplierLimit}).
            <button
              type="button"
              onClick={() => window.open('/pricing', '_blank')}
              style={{
                marginLeft: 6,
                color: '#1d4ed8',
                textDecoration: 'underline',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13
              }}
            >
              Upgrade
            </button>
          </div>
        ) : null}

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Supplier Name</label>
            <input
              ref={nameInputRef}
              className="form-input"
              style={{ fontSize: 16 }}
              name="supplierName"
              value={form.supplierName}
              onChange={onChange}
              placeholder="Optional"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Agency Name</label>
            <input
              className="form-input"
              style={{ fontSize: 16 }}
              name="agencyName"
              value={form.agencyName}
              onChange={onChange}
              placeholder="Optional"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input
              className="form-input"
              style={{ fontSize: 16 }}
              name="phoneNumber"
              value={form.phoneNumber}
              onChange={onChange}
              placeholder="Optional"
              inputMode="tel"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Address</label>
            <input
              className="form-input"
              style={{ fontSize: 16 }}
              name="address"
              value={form.address}
              onChange={onChange}
              placeholder="Optional"
            />
          </div>

          <div className="form-group">
            <label className="form-label">GST Number</label>
            <input
              className="form-input"
              style={{ fontSize: 16 }}
              name="gstNumber"
              value={form.gstNumber}
              onChange={onChange}
              placeholder="Optional"
              autoCapitalize="characters"
            />
          </div>

          <div className="form-group">
            <label className="form-label">PAN Number</label>
            <input
              className="form-input"
              style={{ fontSize: 16 }}
              name="panNumber"
              value={form.panNumber}
              onChange={onChange}
              placeholder="Optional"
              autoCapitalize="characters"
            />
          </div>

          <button
            className="btn"
            type="submit"
            disabled={saving || effectiveIsAtLimit}
            style={{ width: '100%', minHeight: 44, marginTop: 6 }}
          >
            {effectiveIsAtLimit ? `Limit reached (${currentSupplierCount}/${supplierLimit || '—'})` : (saving ? 'Saving…' : 'Save Supplier')}
          </button>

          {error ? <div className="mt-2 text-danger" style={{ fontSize: 13 }}>{error}</div> : null}
        </form>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Filters</div>
            <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>Search suppliers quickly</div>
          </div>
          <button type="button" className="btn" onClick={clearFilters} style={{ minHeight: 36, padding: '8px 10px' }}>
            Clear
          </button>
        </div>

        <div className="form-group">
          <label className="form-label">Agency Name</label>
          <input
            className="form-input"
            style={{ fontSize: 16 }}
            value={agencyFilter}
            onChange={(e) => { setAgencyFilter(e.target.value); setPage(1); }}
            placeholder="Search agency name"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Phone Number</label>
          <input
            className="form-input"
            style={{ fontSize: 16 }}
            value={phoneFilter}
            onChange={(e) => { setPhoneFilter(e.target.value); setPage(1); }}
            placeholder="Search phone number"
            inputMode="tel"
          />
        </div>

        <div className="form-group">
          <label className="form-label">PAN Number</label>
          <input
            className="form-input"
            style={{ fontSize: 16 }}
            value={panFilter}
            onChange={(e) => { setPanFilter(e.target.value); setPage(1); }}
            placeholder="Search PAN number"
            autoCapitalize="characters"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Supplier Amount</label>
          <select
            className="form-input"
            style={{ fontSize: 16 }}
            value={amountSort}
            onChange={(e) => { setAmountSort(e.target.value); setPage(1); }}
          >
            <option value="">None</option>
            <option value="high">High</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Suppliers</div>
            <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>
              {total === 0 ? 'No suppliers found' : `Showing ${startIndex}–${endIndex} of ${total}`}
            </div>
          </div>
          <button type="button" className="btn" onClick={() => { fetchSuppliers(); fetchInStock(); }} style={{ minHeight: 36, padding: '8px 10px' }}>
            Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Loading…</div>
        ) : null}

        {visible.length === 0 && !loading ? (
          <div className="empty-state" style={{ padding: 18 }}>
            <div className="empty-icon">🏢</div>
            <div className="empty-title">No Suppliers</div>
            <div className="empty-description">Add your first supplier to get started</div>
            <button className="empty-action" type="button" onClick={scrollToCreate}>
              Add Supplier
            </button>
          </div>
        ) : null}

        {visible.map((r, idx) => {
          const amount = supplierAmountMap[r._id] ? supplierAmountMap[r._id] : 0;
          const itemsCount = supplierItemsCountMap[r._id] ? supplierItemsCountMap[r._id] : 0;
          const serial = startIndex + idx;

          return (
            <div key={r._id || serial} style={{
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 12,
              marginTop: 10,
              background: 'var(--card)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', wordBreak: 'break-word' }}>
                    {serial}. {r.supplierName || '—'}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>
                    {r.agencyName ? `Agency: ${r.agencyName}` : 'Agency: —'}
                  </div>
                  {!branchUserDecoded ? (
                    <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>
                      {r.branch_name ? `Branch: ${r.branch_name}` : 'Branch: —'}
                    </div>
                  ) : null}
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                <span style={badgeStyle}>₹ Amount: {amount}</span>
                <span style={badgeStyle}>Items: {itemsCount}</span>
              </div>

              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Phone:</span> {r.phoneNumber || '—'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>GST:</span> {r.gstNumber || '—'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>PAN:</span> {r.panNumber || '—'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Address:</span> {r.address || '—'}
                </div>
              </div>
            </div>
          );
        })}

        {totalPages > 1 ? (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
            <button
              type="button"
              className="btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={clampedPage <= 1}
              style={{ flex: 1, minHeight: 44 }}
            >
              ← Previous
            </button>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '0 6px', textAlign: 'center' }}>
              Page {clampedPage} / {totalPages}
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={clampedPage >= totalPages}
              style={{ flex: 1, minHeight: 44 }}
            >
              Next →
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

window.MobileCreateSupplier = MobileCreateSupplier;

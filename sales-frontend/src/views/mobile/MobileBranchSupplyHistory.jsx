function MobileBranchSupplyHistory({ salesUrl, token }) {
  const [data, setData] = React.useState({
    supplies: [],
    branches: [],
    loading: true,
    error: null
  });

  const [branchId, setBranchId] = React.useState('');
  const [filterDate, setFilterDate] = React.useState('');
  const [imesFilter, setImesFilter] = React.useState('');

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

  const authedFetch = React.useCallback(async (url, init) => {
    let res = await fetch(url, {
      ...(init || {}),
      headers: {
        ...((init && init.headers) || {}),
        Authorization: 'Bearer ' + effectiveToken
      }
    });

    if (res.status === 401 && storedBranchToken && storedBranchToken !== effectiveToken) {
      res = await fetch(url, {
        ...(init || {}),
        headers: {
          ...((init && init.headers) || {}),
          Authorization: 'Bearer ' + storedBranchToken
        }
      });
    }

    return res;
  }, [effectiveToken, storedBranchToken]);

  const loadData = React.useCallback(async (bid = '') => {
    try {
      setData((prev) => ({ ...prev, loading: true, error: null }));

      const branchesRes = await authedFetch(salesUrl + '/api/branches');
      const branchesData = await branchesRes.json();

      const url = new URL(salesUrl + '/api/branch-supplies');
      if (bid) url.searchParams.set('branch_id', bid);

      const suppliesRes = await authedFetch(url.toString());
      const suppliesData = await suppliesRes.json();

      if (!branchesRes.ok) throw new Error(branchesData.message || 'Failed to load branches');
      if (!suppliesRes.ok) throw new Error(suppliesData.message || 'Failed to load supplies');

      setData({
        branches: Array.isArray(branchesData.branches) ? branchesData.branches : [],
        supplies: Array.isArray(suppliesData.supplies) ? suppliesData.supplies : [],
        loading: false,
        error: null
      });
    } catch (error) {
      if (!branchUserDecoded) {
        setData((prev) => ({ ...prev, loading: false, error: error.message }));
      } else {
        setData((prev) => ({ ...prev, loading: false, error: null }));
      }
    }
  }, [salesUrl, authedFetch, branchUserDecoded]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const onBranchChange = (e) => {
    const id = e.target.value;
    setBranchId(id);
    loadData(id);
  };

  const processedData = React.useMemo(() => {
    const onlyAdmin = (arr) => (Array.isArray(arr) ? arr.filter((s) => String(s.createdByType || '').toLowerCase() === 'admin') : []);

    const baseArr = !filterDate
      ? data.supplies
      : (data.supplies || []).filter((supply) => {
          const selectedDate = new Date(filterDate).toDateString();
          const supplyDate = new Date(supply.createdAt || supply.updatedAt || new Date()).toDateString();
          return supplyDate === selectedDate;
        });

    const filtered = onlyAdmin(baseArr);

    const flat = [];
    filtered.forEach((s) => {
      const when = s.createdAt || s.updatedAt || new Date();
      const supplier = s.supplier_id?.supplierName || s.supplierName || '-';
      (Array.isArray(s.items) ? s.items : []).forEach((it) => {
        const imesStr = Array.isArray(it.imes) ? it.imes.join(',') : '';
        if (imesFilter && imesStr.toLowerCase().indexOf(imesFilter.toLowerCase()) === -1) return;
        flat.push({
          supplier,
          productNo: it.productNo || it.productId || '-',
          productName: it.productName || it.name || '-',
          brand: it.brand || '-',
          model: it.model || '-',
          costPrice: it.costPrice ?? it.cost ?? 0,
          validity: it.validity || null,
          pct: it.pct ?? null,
          unitPrice: it.unitSellingPrice ?? it.sellingPrice ?? 0,
          qty: it.qty ?? 0,
          value: it.value ?? ((it.unitSellingPrice ?? it.sellingPrice ?? 0) * (it.qty ?? 0)),
          when
        });
      });
    });

    return flat;
  }, [data.supplies, filterDate, imesFilter]);

  const currency = (n) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(n || 0);

  if (data.loading) {
    return (
      <div className="mobile-content" style={{ paddingBottom: 80 }}>
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontWeight: 800 }}>
          ⏳ Loading Supply History...
        </div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="mobile-content" style={{ paddingBottom: 80 }}>
        <div style={{
          padding: '12px',
          backgroundColor: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: '12px',
          margin: '12px',
          color: '#dc2626',
          fontWeight: 800
        }}>
          ❌ Error: {data.error}
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-content" style={{ paddingBottom: 80 }}>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>📦 Supply History</div>
        <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>Filter and review supplies</div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--text)', marginBottom: 10 }}>Filters</div>

        <div className="form-group" style={{ marginBottom: 10 }}>
          <label className="form-label">Filter by Branch</label>
          <select className="form-input" value={branchId} onChange={onBranchChange}>
            <option value="">All branches</option>
            {data.branches.map((b) => (
              <option key={b._id} value={b._id}>{b.name || b._id}</option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 10 }}>
          <label className="form-label">Filter by Date</label>
          <input
            className="form-input"
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Filter by IME</label>
          <input
            className="form-input"
            type="text"
            value={imesFilter}
            onChange={(e) => setImesFilter(e.target.value)}
            placeholder="Type IME..."
          />
        </div>
      </div>

      <div className="card table-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--text)' }}>Results</div>
            <div style={{ marginTop: 2, fontSize: 12, color: 'var(--text-muted)', fontWeight: 800 }}>{processedData.length} rows</div>
          </div>
          <button type="button" className="btn secondary" onClick={() => loadData(branchId)}>
            Refresh
          </button>
        </div>

        {processedData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontWeight: 800 }}>
            <div style={{ fontSize: 42, marginBottom: 10 }}>📦</div>
            No supply history found
          </div>
        ) : (
          <div className="table-scroll" style={{ overflowX: 'auto' }}>
            <table className="modern-table" style={{ minWidth: 980 }}>
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Product No</th>
                  <th>Product Name</th>
                  <th>Brand</th>
                  <th>Model</th>
                  <th>Cost Price</th>
                  <th>Product Validity</th>
                  <th>Selling Price (pct / price)</th>
                  <th>Unit Price</th>
                  <th>Supply Qty</th>
                  <th>Supply Value</th>
                  <th>Sending Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {processedData.map((r, i) => (
                  <tr key={i}>
                    <td>{r.supplier}</td>
                    <td>{r.productNo}</td>
                    <td>{r.productName}</td>
                    <td>{r.brand}</td>
                    <td>{r.model}</td>
                    <td>{r.costPrice != null ? currency(r.costPrice) : '-'}</td>
                    <td>{r.validity ? new Date(r.validity).toLocaleDateString() : '-'}</td>
                    <td>{r.pct != null ? `${r.pct}% / ${currency(r.unitPrice)}` : '-'}</td>
                    <td>{currency(r.unitPrice)}</td>
                    <td>{r.qty}</td>
                    <td>{currency(r.value)}</td>
                    <td>{new Date(r.when).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

window.MobileBranchSupplyHistory = MobileBranchSupplyHistory;

function StockHistory({ salesUrl, token, branchUser }) {
  const [supplies, setSupplies] = React.useState([]);
  const [branches, setBranches] = React.useState([]);
  const [selectedBranch, setSelectedBranch] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [selected, setSelected] = React.useState(null);

  const getEffectiveToken = () => {
    const storedBranchToken = typeof window !== 'undefined' ? (localStorage.getItem('branch_token') || '') : '';
    return token || storedBranchToken || '';
  };

  const loadBranches = async () => {
    if (branchUser) return;
    try {
      const eff = getEffectiveToken();
      const res = await fetch((salesUrl || '') + '/api/branches', { headers: { Authorization: 'Bearer ' + eff } });
      const d = await res.json();
      if (res.ok && Array.isArray(d.branches)) setBranches(d.branches);
    } catch (e) {
      // ignore
    }
  };

  const loadSupplies = async (branchId) => {
    setLoading(true); setError('');
    try {
      const storedBranchToken = typeof window !== 'undefined' ? (localStorage.getItem('branch_token') || '') : '';
      const effectiveToken = token || storedBranchToken || '';
      const url = new URL((salesUrl || '') + '/api/branch-supplies');
      const bid = branchUser ? (branchUser.branch_id || branchUser._id || branchUser.id) : (branchId || '');
      if (bid) url.searchParams.set('branch_id', bid);

      let res = await fetch(url.toString(), { headers: { Authorization: 'Bearer ' + effectiveToken } });
      if (res.status === 401 && storedBranchToken && storedBranchToken !== effectiveToken) {
        res = await fetch(url.toString(), { headers: { Authorization: 'Bearer ' + storedBranchToken } });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load supplies');
      setSupplies(Array.isArray(data.supplies) ? data.supplies : []);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  React.useEffect(() => {
    loadBranches();
    if (branchUser) {
      const bid = branchUser.branch_id || branchUser._id || branchUser.id || '';
      setSelectedBranch(bid);
      loadSupplies(bid);
    } else {
      loadSupplies('');
    }
  }, [token, branchUser]);

  // Only show supplies that were created by branches (createdByType === 'branch') and match date range
  const visibleSupplies = React.useMemo(() => {
    if (!Array.isArray(supplies)) return [];
    let list = supplies.filter(s => String(s.createdByType || '').toLowerCase() === 'branch');
    if (startDate) {
      try {
        const start = new Date(startDate); start.setHours(0,0,0,0);
        list = list.filter(s => {
          const when = s.createdAt ? new Date(s.createdAt) : null;
          if (!when) return false;
          return when.getTime() >= start.getTime();
        });
      } catch (e) { /* ignore invalid */ }
    }
    if (endDate) {
      try {
        const end = new Date(endDate); end.setHours(23,59,59,999);
        list = list.filter(s => {
          const when = s.createdAt ? new Date(s.createdAt) : null;
          if (!when) return false;
          return when.getTime() <= end.getTime();
        });
      } catch (e) { /* ignore invalid */ }
    }
    return list;
  }, [supplies, startDate, endDate]);

  return (
    <div>
      <div className="card mt-3 table-card">
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div style={{display:'flex', gap:12, alignItems:'center'}}>
            <div className="table-title">Stock History</div>
            {!branchUser ? (
              <select value={selectedBranch} onChange={(e)=>{ setSelectedBranch(e.target.value); loadSupplies(e.target.value); }} style={{padding:'6px 8px'}}>
                <option value="">All branches</option>
                {branches.map(b => (
                  <option key={b._id} value={b._id}>{b.name || b._id}</option>
                ))}
              </select>
            ) : null}
            <div style={{display:'flex', gap:8, alignItems:'center'}}>
              <label style={{fontSize:13, color:'#6b7280'}}>From</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{padding:'6px 8px'}} />
              <label style={{fontSize:13, color:'#6b7280'}}>To</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{padding:'6px 8px'}} />
              <button className="btn" onClick={() => { setStartDate(''); setEndDate(''); }}>Clear Dates</button>
            </div>
          </div>
          <div>
            <button className="btn" onClick={()=>loadSupplies(selectedBranch)}>Refresh</button>
            {!branchUser ? (
              <button className="btn" style={{marginLeft:8}} onClick={()=>{ try{ location.hash = '#branch-supply'; }catch{} }}>Add Supply</button>
            ) : null}
          </div>
        </div>
        {error ? <div className="text-danger">{error}</div> : null}
        <div className="table-scroll">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Bank</th>
                <th>Supplier Amount</th>
                <th>GST Amount</th>
                <th>Created By</th>
                <th>Branch</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              { (Array.isArray(visibleSupplies) && visibleSupplies.length) ? visibleSupplies.map(s => (
                <tr key={s._id} onClick={async () => {
                      try {
                        const eff = getEffectiveToken();
                        const res = await fetch((salesUrl || '') + '/api/branch-supplies/' + s._id, { headers: { Authorization: 'Bearer ' + eff } });
                        const d = await res.json();
                        if (res.ok && d.supply) setSelected(d.supply);
                        else setSelected(s);
                      } catch (e) { setSelected(s); }
                    }} style={{cursor:'pointer'}}>
                  <td>{s.supplierName || s.supplier || '-'}</td>
                  <td>{s.bankName || s.bank || '-'}</td>
                  <td>{s.supplierAmount != null ? (new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(s.supplierAmount)) : '-'}</td>
                  <td>{s.gstAmount != null ? (new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(s.gstAmount)) : '-'}</td>
                  <td style={{whiteSpace:'nowrap'}}>{s.createdByType === 'branch' ? 'Branch' : (s.createdByType === 'admin' ? 'Admin' : (s.createdBy || '-'))}</td>
                  <td>{s.branch_name || s.branchName || (s.branch_id ? String(s.branch_id) : '-')}</td>
                  <td>{s.createdAt ? new Date(s.createdAt).toLocaleString() : '-'}</td>
                </tr>
              )) : (
                <tr><td colSpan={6} style={{padding:24}}>No supplies found</td></tr>
              ) }
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <div style={{fontWeight:800}}>Supply Details</div>
              <button className="btn secondary" onClick={()=>setSelected(null)}>Close</button>
            </div>
            <div className="modal-body">
              <div style={{marginBottom:12}}><strong>Supplier:</strong> {selected.supplierName || selected.supplier || '-'}</div>
              <div style={{marginBottom:12}}><strong>Bank:</strong> {selected.bankName || selected.bank || '-'}</div>
              <div style={{marginBottom:12}}><strong>Supplier Amount:</strong> {selected.supplierAmount != null ? (new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(selected.supplierAmount)) : '-'}</div>
              <div style={{marginBottom:12}}><strong>GST Amount:</strong> {selected.gstAmount != null ? (new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(selected.gstAmount)) : '-'}</div>
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
                    
                      <th>Validity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.isArray(selected.items) && selected.items.length ? selected.items.map((it, idx) => (
                      <tr key={idx}>
                        <td>{it.productNo || it.productId || '-'}</td>
                        <td>{it.productName || '-'}</td>
                        <td>{it.brand || '-'}</td>
                        <td>{it.model || '-'}</td>
                        <td>{it.qty != null ? it.qty : (it.quantity != null ? it.quantity : '-')}</td>
                        <td>{it.costPrice != null ? (new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(it.costPrice)) : '-'}</td>
                        <td>{it.validity ? new Date(it.validity).toLocaleDateString() : '-'}</td>
                      </tr>
                    )) : (<tr><td colSpan={8} style={{padding:24}}>No items</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Register view
window.StockHistory = StockHistory;

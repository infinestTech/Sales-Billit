function MobileBranchSalesReport({ salesUrl, token }) {
  const [branches, setBranches] = React.useState([]);
  const [selectedBranch, setSelectedBranch] = React.useState('');
  const [sales, setSales] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [pageSize] = React.useState(25);
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [expandedSale, setExpandedSale] = React.useState(null);
  const [showFilters, setShowFilters] = React.useState(false);

  const currency = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

  const loadBranches = async () => {
    try {
      const res = await fetch(salesUrl + '/api/branches', { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      if (res.ok) setBranches(Array.isArray(data.branches) ? data.branches : []);
    } catch (e) { /* ignore */ }
  };

  const loadSales = async (pg) => {
    setLoading(true);
    setError('');
    try {
      const url = new URL(salesUrl + '/api/sales');
      if (selectedBranch) url.searchParams.set('branch_id', selectedBranch);
      url.searchParams.set('page', String(pg || page));
      url.searchParams.set('pageSize', String(pageSize));
      if (dateFrom) url.searchParams.set('from', dateFrom);
      if (dateTo) url.searchParams.set('to', dateTo);
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load sales');
      setSales(Array.isArray(data.sales) ? data.sales : []);
      setTotal(data.total || 0);
      setPage(data.page || pg || 1);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  React.useEffect(() => { loadBranches(); }, []);
  React.useEffect(() => { loadSales(1); }, [selectedBranch, dateFrom, dateTo]);

  const totalPages = Math.ceil(total / pageSize) || 1;
  const totalRevenue = sales.reduce((s, sale) => s + (Number(sale.totalAmount) || 0), 0);
  const totalItems = sales.reduce((s, sale) => s + (Array.isArray(sale.items) ? sale.items.reduce((a, it) => a + (Number(it.qty) || 0), 0) : 0), 0);

  return (
    <div style={{ padding: 12 }}>
      {error && <div className="alert error" style={{ marginBottom: 10 }}>{error}</div>}

      {/* Filter toggle */}
      <div style={{ marginBottom: 10 }}>
        <button className="btn secondary" onClick={() => setShowFilters(!showFilters)} style={{ width: '100%' }}>
          🔍 {showFilters ? 'Hide' : 'Show'} Filters
        </button>
      </div>

      {showFilters && (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Branch</label>
              <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: 4 }}>
                <option value="">All Branches</option>
                {branches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>From</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: 4 }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>To</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: 4 }} />
              </div>
            </div>
            <button className="btn secondary" onClick={() => { setSelectedBranch(''); setDateFrom(''); setDateTo(''); }} style={{ fontSize: 12 }}>
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div className="card" style={{ padding: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#64748b' }}>Sales</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#4f46e5' }}>{total}</div>
        </div>
        <div className="card" style={{ padding: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#64748b' }}>Revenue</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#16a34a' }}>{currency(totalRevenue)}</div>
        </div>
        <div className="card" style={{ padding: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#64748b' }}>Items</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#ea580c' }}>{totalItems}</div>
        </div>
      </div>

      {/* Sales list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
      ) : sales.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>No sales found</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sales.map((sale, si) => {
            const isExpanded = expandedSale === sale._id;
            const itemCount = Array.isArray(sale.items) ? sale.items.reduce((a, it) => a + (Number(it.qty) || 0), 0) : 0;
            const taxAmount = (Number(sale.cgstAmount) || 0) + (Number(sale.sgstAmount) || 0) + (Number(sale.igstAmount) || 0);
            return (
              <div key={sale._id || si} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: 12, cursor: 'pointer' }} onClick={() => setExpandedSale(isExpanded ? null : sale._id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{sale.branchName || sale.branch_id?.slice(-6) || '-'}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        {sale.customerName || 'Walk-in'} {sale.customerNo ? '• ' + sale.customerNo : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#16a34a' }}>{currency(sale.totalAmount)}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{sale.createdAt ? new Date(sale.createdAt).toLocaleString('en-IN') : '-'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                      background: (sale.paymentMethod || '').toLowerCase().includes('cash') ? '#dcfce7' : '#e0f2fe',
                      color: (sale.paymentMethod || '').toLowerCase().includes('cash') ? '#166534' : '#0369a1'
                    }}>
                      {sale.paymentMethod || '-'}
                    </span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>{itemCount} item(s)</span>
                    {sale.discount > 0 && <span style={{ fontSize: 11, color: '#ea580c' }}>{sale.discount}% off</span>}
                    {taxAmount > 0 && <span style={{ fontSize: 11, color: '#7c3aed' }}>Tax: {currency(taxAmount)}</span>}
                    <span style={{ marginLeft: 'auto', fontSize: 14 }}>{isExpanded ? '▼' : '▶'}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ borderTop: '1px solid #e2e8f0', padding: 12, background: '#f8fafc' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 10, fontSize: 12 }}>
                      <span><strong>Subtotal:</strong> {currency(sale.subTotal)}</span>
                      {sale.discount > 0 && <span><strong>Disc:</strong> {sale.discount}% ({currency(sale.discountAmount)})</span>}
                      {sale.cgst > 0 && <span><strong>CGST:</strong> {sale.cgst}%</span>}
                      {sale.sgst > 0 && <span><strong>SGST:</strong> {sale.sgst}%</span>}
                      {sale.igst > 0 && <span><strong>IGST:</strong> {sale.igst}%</span>}
                      <span><strong>Paid:</strong> {currency(sale.amountPaid)}</span>
                    </div>
                    {(Array.isArray(sale.items) ? sale.items : []).map((it, ii) => (
                      <div key={ii} style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{it.productName || '-'}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>#{it.productNo || '-'} • Qty: {it.qty} × {currency(it.sellingPrice)}</div>
                          </div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{currency(it.lineTotal)}</div>
                        </div>
                        {Array.isArray(it.imes) && it.imes.length > 0 && (
                          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                            IMEIs: {it.imes.join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 14 }}>
          <button className="btn secondary" disabled={page <= 1} onClick={() => loadSales(page - 1)} style={{ fontSize: 12 }}>← Prev</button>
          <span style={{ fontSize: 12 }}>Page {page}/{totalPages}</span>
          <button className="btn secondary" disabled={page >= totalPages} onClick={() => loadSales(page + 1)} style={{ fontSize: 12 }}>Next →</button>
        </div>
      )}
    </div>
  );
}
window.MobileBranchSalesReport = MobileBranchSalesReport;

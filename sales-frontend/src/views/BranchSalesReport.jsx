function BranchSalesReport({ salesUrl, token }) {
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

  // Summary calculations
  const totalRevenue = sales.reduce((s, sale) => s + (Number(sale.totalAmount) || 0), 0);
  const totalItems = sales.reduce((s, sale) => s + (Array.isArray(sale.items) ? sale.items.reduce((a, it) => a + (Number(it.qty) || 0), 0) : 0), 0);

  return (
    <div>
      {error && <div className="alert error" style={{ marginBottom: 12 }}>{error}</div>}

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Filter by Branch</label>
            <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} style={{ minWidth: 180, padding: '8px 12px' }}>
              <option value="">All Branches</option>
              {branches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>From Date</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: '8px 12px' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>To Date</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: '8px 12px' }} />
          </div>
          <button className="btn secondary" onClick={() => { setSelectedBranch(''); setDateFrom(''); setDateTo(''); }} style={{ height: 38 }}>
            Clear Filters
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Total Sales</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#4f46e5' }}>{total}</div>
        </div>
        <div className="card" style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Page Revenue</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#16a34a' }}>{currency(totalRevenue)}</div>
        </div>
        <div className="card" style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Items Sold (page)</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#ea580c' }}>{totalItems}</div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
        ) : sales.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No sales found</div>
        ) : (
          <table className="modern-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>Branch</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Subtotal</th>
                <th>Discount</th>
                <th>Tax</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Date & Time</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale, si) => {
                const isExpanded = expandedSale === sale._id;
                const itemCount = Array.isArray(sale.items) ? sale.items.reduce((a, it) => a + (Number(it.qty) || 0), 0) : 0;
                const taxAmount = (Number(sale.cgstAmount) || 0) + (Number(sale.sgstAmount) || 0) + (Number(sale.igstAmount) || 0);
                return (
                  <React.Fragment key={sale._id || si}>
                    <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedSale(isExpanded ? null : sale._id)}>
                      <td style={{ textAlign: 'center', fontSize: 16 }}>{isExpanded ? '▼' : '▶'}</td>
                      <td style={{ fontWeight: 600 }}>{sale.branchName || sale.branch_id?.slice(-6) || '-'}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{sale.customerName || 'Walk-in'}</div>
                        {sale.customerNo && <div style={{ fontSize: 11, color: '#94a3b8' }}>{sale.customerNo}</div>}
                      </td>
                      <td style={{ textAlign: 'center' }}>{itemCount}</td>
                      <td>{currency(sale.subTotal)}</td>
                      <td>{sale.discount ? sale.discount + '%' : '-'}</td>
                      <td>{taxAmount > 0 ? currency(taxAmount) : '-'}</td>
                      <td style={{ fontWeight: 700, color: '#16a34a' }}>{currency(sale.totalAmount)}</td>
                      <td>
                        <span style={{
                          padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                          background: (sale.paymentMethod || '').toLowerCase().includes('cash') ? '#dcfce7' : '#e0f2fe',
                          color: (sale.paymentMethod || '').toLowerCase().includes('cash') ? '#166534' : '#0369a1'
                        }}>
                          {sale.paymentMethod || '-'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>{sale.createdAt ? new Date(sale.createdAt).toLocaleString('en-IN') : '-'}</td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={10} style={{ padding: 0, background: '#f8fafc' }}>
                          <div style={{ padding: '12px 24px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginBottom: 12 }}>
                              <div><strong>Subtotal:</strong> {currency(sale.subTotal)}</div>
                              {sale.discount > 0 && <div><strong>Discount:</strong> {sale.discount}% ({currency(sale.discountAmount)})</div>}
                              {sale.cgst > 0 && <div><strong>CGST:</strong> {sale.cgst}% ({currency(sale.cgstAmount)})</div>}
                              {sale.sgst > 0 && <div><strong>SGST:</strong> {sale.sgst}% ({currency(sale.sgstAmount)})</div>}
                              {sale.igst > 0 && <div><strong>IGST:</strong> {sale.igst}% ({currency(sale.igstAmount)})</div>}
                              <div><strong>Amount Paid:</strong> {currency(sale.amountPaid)}</div>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 12 }}>Product No</th>
                                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 12 }}>Product Name</th>
                                  <th style={{ padding: '6px 10px', textAlign: 'center', fontSize: 12 }}>Qty</th>
                                  <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: 12 }}>Unit Price</th>
                                  <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: 12 }}>Line Total</th>
                                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 12 }}>IMEIs</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(Array.isArray(sale.items) ? sale.items : []).map((it, ii) => (
                                  <tr key={ii} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '6px 10px', fontSize: 12, color: '#64748b' }}>{it.productNo || '-'}</td>
                                    <td style={{ padding: '6px 10px', fontSize: 13, fontWeight: 500 }}>{it.productName || '-'}</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>{it.qty}</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>{currency(it.sellingPrice)}</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>{currency(it.lineTotal)}</td>
                                    <td style={{ padding: '6px 10px', fontSize: 11, color: '#64748b' }}>
                                      {Array.isArray(it.imes) && it.imes.length ? it.imes.join(', ') : '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <button className="btn secondary" disabled={page <= 1} onClick={() => loadSales(page - 1)}>← Previous</button>
          <span style={{ fontSize: 13 }}>Page {page} of {totalPages}</span>
          <button className="btn secondary" disabled={page >= totalPages} onClick={() => loadSales(page + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
window.BranchSalesReport = BranchSalesReport;

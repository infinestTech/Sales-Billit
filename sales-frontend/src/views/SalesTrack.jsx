function SalesTrack({ salesUrl, token }) {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [dateFilter, setDateFilter] = React.useState('');
  const [customerFilter, setCustomerFilter] = React.useState('');
  const [imeFilter, setImeFilter] = React.useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const url = new URL(salesUrl + '/api/sales');
      // if branch token is used server should infer branch; include branch param for safety
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load sales');
      setRows(Array.isArray(data.sales) ? data.sales : []);
    } catch (e) { setError(e.message || 'Failed'); }
    finally { setLoading(false); }
  };

  React.useEffect(() => { load(); }, []);

  // Filtering logic for sales rows
  const filteredRows = React.useMemo(() => {
    return rows.filter(s => {
      const saleDate = new Date(s.createdAt);
      const filterDate = dateFilter ? new Date(dateFilter) : null;
      const dateMatch = !filterDate || (saleDate.toDateString() === filterDate.toDateString());
      // customer filter
      const customerMatch = !customerFilter || (s.customerNo || '').toLowerCase().includes(customerFilter.toLowerCase());
      // ime filter: if provided, ensure at least one item in sale has this IME in its imes array
      const ime = (imeFilter || '').toString().trim();
      let imeMatch = true;
      if (ime) {
        imeMatch = (s.items || []).some(it => {
          const ims = Array.isArray(it.imes) ? it.imes : (Array.isArray(it.selectedImes) ? it.selectedImes : []);
          return ims.some(x => String(x).toLowerCase().includes(ime.toLowerCase()));
        });
      }
      return dateMatch && customerMatch && imeMatch;
    });
  }, [rows, dateFilter, customerFilter, imeFilter]);

  return (
    <div>
      <div className="card">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <h3>Sales History</h3>
          <div>
            <button className="btn" onClick={load}>Refresh</button>
          </div>
        </div>
        {error ? <div className="mt-2 text-danger">{error}</div> : null}
        {loading ? <div>Loading…</div> : (
          <div className="table-scroll mt-2">
            {/* Filter Section */}
            <div className="filter-section" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ padding: '8px', width: '180px' }} />
              <input type="text" placeholder="Filter by Customer No" value={customerFilter} onChange={e => setCustomerFilter(e.target.value)} style={{ padding: '8px', width: '180px' }} />
              <input type="text" placeholder="Filter by IME" value={imeFilter} onChange={e => setImeFilter(e.target.value)} style={{ padding: '8px', width: '180px' }} />
            </div>
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Sales Exec</th>
                  <th>Product</th>
                  <th>Discount</th>
                  <th>Total</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(s => (
                  <tr key={s._id}>
                    <td>{new Date(s.createdAt).toLocaleString()}</td>
                    <td>{s.customerNo || '-'}</td>
                    <td>{s.employee_name ? `${s.employee_name} (${s.employee_code})` : '-'}</td>
                    <td>{(s.items || []).map(i => {
                      const ims = Array.isArray(i.imes) ? i.imes : (Array.isArray(i.selectedImes) ? i.selectedImes : []);
                      const imeCountStr = ims && ims.length ? ` [IMEs:${ims.length}]` : '';
                      return `${i.productName || i.productNo || 'item'} x${i.qty || i.sellingQty || 0}${imeCountStr}`;
                    }).join(', ')}</td>
                    <td>{s.discount ? `${s.discount}% (${Number(s.discountAmount||0).toFixed(2)})` : '-'}</td>
                    <td>{Number(s.totalAmount || 0).toFixed(2)}</td>
                    <td>{s.paymentMethod || '-'}</td>
                  </tr>
                ))}
                {filteredRows.length === 0 ? (
                  <tr><td colSpan={7}>No sales found</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

window.SalesTrack = SalesTrack;

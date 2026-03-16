

const React = window.React;
const SALES_API_URL = (window.ENV_CONFIG?.SALES_API_URL || 'http://127.0.0.1:9000') + '/api/sales';




function GstCalculator(props) {
  const transactions = props.transactions || [];
  const [view, setView] = React.useState('supplier'); // 'supplier' or 'sales'
  const [salesData, setSalesData] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [showZeroGst, setShowZeroGst] = React.useState(false);

  React.useEffect(() => {
    if (view === 'sales') {
      setLoading(true);
      // Get token from props or localStorage
      const token = props.token || localStorage.getItem('sales_token') || localStorage.getItem('branch_token') || '';
      // Build query params for date filter
      let url = SALES_API_URL;
      const params = [];
      if (startDate) params.push(`startDate=${encodeURIComponent(startDate)}`);
      if (endDate) params.push(`endDate=${encodeURIComponent(endDate)}`);
      if (params.length) url += '?' + params.join('&');
      fetch(url, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      })
        .then(res => {
          if (res.status === 401) throw new Error('Unauthorized: Invalid or missing token');
          return res.json();
        })
        .then(data => {
          // Flatten sales items for table display
          const flat = [];
          if (Array.isArray(data.sales)) {
            data.sales.forEach(sale => {
              (sale.items || []).forEach(item => {
                flat.push({
                  productNo: item.productNo,
                  qty: item.qty,
                  subTotal: sale.subTotal,
                  cgstAmount: sale.cgstAmount,
                  sgstAmount: sale.sgstAmount,
                  igstAmount: sale.igstAmount,
                  paymentMethod: sale.paymentMethod,
                  createdAt: sale.createdAt,
                   cgst: sale.cgst !== undefined ? sale.cgst : 9,
                   sgst: sale.sgst !== undefined ? sale.sgst : 9,
                   igst: sale.igst !== undefined ? sale.igst : 0,
                });
              });
            });
          }
          setSalesData(flat);
          setLoading(false);
        })
        .catch(e => {
          setError(e.message || 'Failed to fetch sales data');
          setLoading(false);
        });
    }
  }, [view, props.token, startDate, endDate]);

  // Supplier GST filter by date
  const filteredTransactions = transactions.filter(t => {
    if (startDate && (!t.createdAt || new Date(t.createdAt) < new Date(startDate))) return false;
    if (endDate && (!t.createdAt || new Date(t.createdAt) > new Date(endDate))) return false;
    return true;
  });

  // Show only rows with meaningful data: require at least two of
  // (supplier, bank, branch, supplierAmount>0, gstAmount>0).
  // If showZeroGst is true, preserve the previous behavior (show all filtered rows).
  const displayedTransactions = filteredTransactions.filter(t => {
    if (showZeroGst) return true;
    function hasText(v) {
      if (v == null) return false;
      const s = String(v).trim();
      if (!s) return false;
      if (s === '-') return false;
      return true;
    }
    const checks = [];
    checks.push(hasText(t.supplierName || t.supplier || t.supplier_id));
    checks.push(hasText(t.branchName || t.branch_name || t.branch));
    checks.push((Number(t.supplierAmount) || 0) > 0);
    checks.push((Number(t.gstAmount) || 0) > 0);
    const truthyCount = checks.reduce((s, v) => s + (v ? 1 : 0), 0);
    return truthyCount >= 2;
  });

  const totalGst = displayedTransactions.reduce((sum, t) => sum + (Number(t.gstAmount) || 0), 0);

  // Compute per-branch GST subtotals
  const branchTotals = displayedTransactions.reduce((map, t) => {
    const branch = (t.branchName || t.branch_name || '').toString() || 'Main';
    const v = Number(t.gstAmount) || 0;
    map[branch] = (map[branch] || 0) + v;
    return map;
  }, {});

  // Sales GST calculation
  const totalSalesCgst = salesData.reduce((sum, s) => sum + (Number(s.cgstAmount) || 0), 0);
  const totalSalesSgst = salesData.reduce((sum, s) => sum + (Number(s.sgstAmount) || 0), 0);
  const totalSalesIgst = salesData.reduce((sum, s) => sum + (Number(s.igstAmount) || 0), 0);
  const totalSalesGst = totalSalesCgst + totalSalesSgst + totalSalesIgst;

  return (
    <div className="gst-calculator-page" style={{ padding: 32, background: '#f8fafc', minHeight: '100vh' }}>
      <h2 style={{ marginBottom: 20, fontWeight: 700, color: '#2563eb', letterSpacing: 1 }}>GST Calculator</h2>
      <div style={{ marginBottom: 28, display: 'flex', gap: 12 }}>
        <button
          className={view === 'supplier' ? 'btn primary' : 'btn'}
          style={{ minWidth: 120, padding: '10px 24px', fontWeight: 600, fontSize: 16, borderRadius: 8, border: 'none', background: view === 'supplier' ? '#2563eb' : '#e5e7eb', color: view === 'supplier' ? '#fff' : '#222', boxShadow: view === 'supplier' ? '0 2px 8px #2563eb22' : 'none', transition: 'all 0.2s' }}
          onClick={() => setView('supplier')}
        >Supplier GST</button>
        <button
          className={view === 'sales' ? 'btn primary' : 'btn'}
          style={{ minWidth: 120, padding: '10px 24px', fontWeight: 600, fontSize: 16, borderRadius: 8, border: 'none', background: view === 'sales' ? '#2563eb' : '#e5e7eb', color: view === 'sales' ? '#fff' : '#222', boxShadow: view === 'sales' ? '0 2px 8px #2563eb22' : 'none', transition: 'all 0.2s' }}
          onClick={() => setView('sales')}
        >Sales GST</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={{ fontWeight: 600, fontSize: 15 }}>Start Date:</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 15 }} />
          <label style={{ fontWeight: 600, fontSize: 15 }}>End Date:</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 15 }} />
            {/* <label style={{ fontWeight: 600, fontSize: 15, marginLeft: 12 }}>
              <input type="checkbox" checked={showZeroGst} onChange={e => setShowZeroGst(e.target.checked)} style={{ marginRight: 8 }} />
              Show zero GST
            </label> */}
        </div>
      </div>
      {view === 'supplier' ? (
        <>
          <div
            className="gst-total-box"
            style={{
              marginBottom: 24,
              fontWeight: 600,
              fontSize: 20,
              background: '#e0e7ff',
              color: '#1e293b',
              padding: '16px 28px',
              borderRadius: 10,
              display: 'inline-block',
              boxShadow: '0 2px 8px #2563eb22',
            }}
          >
            <span style={{ fontSize: 18 }}>Total GST Amount:</span> <span style={{ color: '#2563eb', fontWeight: 700, fontSize: 22 }}>{totalGst}</span>
          </div>
          {/* Branch subtotals */}
          <div style={{ marginTop: 10, marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {Object.keys(branchTotals).length === 0 ? null : Object.keys(branchTotals).map((b) => (
              <div key={b} style={{ background: '#fff', padding: '8px 12px', borderRadius: 8, border: '1px solid #e6eef8', fontWeight: 600 }}>
                {b || 'Main'}: <span style={{ color: '#2563eb' }}>{branchTotals[b]}</span>
              </div>
            ))}
          </div>
          <div
            style={{
              background: '#fff',
              borderRadius: 14,
              boxShadow: '0 2px 12px #2563eb11',
              padding: 0,
              border: '1px solid #e5e7eb',
              marginTop: 8,
            }}
          >
            <div className="mobile-overflow-x-auto" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table
                className="gst-table"
                style={{
                  width: '100%',
                  minWidth: 720,
                  borderCollapse: 'separate',
                  borderSpacing: 0,
                  fontSize: 16,
                }}
              >
                <thead>
                  <tr style={{ background: '#f3f6fa' }}>
                    <th style={{ fontWeight: 700, padding: '14px 10px', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>Supplier</th>
                    <th style={{ fontWeight: 700, padding: '14px 10px', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>Branch</th>
                    <th style={{ fontWeight: 700, padding: '14px 10px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>Supplier Amount</th>
                    <th style={{ fontWeight: 700, padding: '14px 10px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>GST Amount</th>
                    <th style={{ fontWeight: 700, padding: '14px 10px', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedTransactions.map((t, idx) => (
                    <tr
                      key={idx}
                      style={{
                        background: idx % 2 === 0 ? '#fff' : '#f9fafb',
                        borderBottom: '1px solid #e5e7eb',
                      }}
                    >
                      <td style={{ padding: '12px 10px' }}>{t.supplierName || '-'}</td>
                      <td style={{ padding: '12px 10px' }}>{t.branchName || '-'}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'right' }}>{t.supplierAmount}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'right' }}>{t.gstAmount}</td>
                      <td style={{ padding: '12px 10px' }}>{t.createdAt ? new Date(t.createdAt).toLocaleString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          {loading ? (
            <div style={{ margin: '32px 0', textAlign: 'center', fontSize: 18, color: '#2563eb' }}>
              <span className="loader" style={{ marginRight: 10, verticalAlign: 'middle' }}></span>
              Loading sales GST data...
            </div>
          ) : error ? (
            <div style={{ color: 'red', margin: '32px 0', textAlign: 'center', fontSize: 18 }}>{error}</div>
          ) : (
            <>
              <div
                className="gst-total-box"
                style={{
                  marginBottom: 24,
                  fontWeight: 600,
                  fontSize: 20,
                  background: '#e0e7ff',
                  color: '#1e293b',
                  padding: '16px 28px',
                  borderRadius: 10,
                  display: 'inline-block',
                  boxShadow: '0 2px 8px #2563eb22',
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 700 }}>Total Sales GST Amount: <span style={{ color: '#2563eb', fontWeight: 700, fontSize: 22 }}>{totalSalesGst.toFixed(2)}</span></div>
                <div style={{ fontSize: 15, marginTop: 6, fontWeight: 600 }}>
                  CGST: <span style={{ color: '#2563eb' }}>{totalSalesCgst.toFixed(2)}</span> | SGST: <span style={{ color: '#2563eb' }}>{totalSalesSgst.toFixed(2)}</span> | IGST: <span style={{ color: '#2563eb' }}>{totalSalesIgst.toFixed(2)}</span>
                </div>
              </div>
              <div
                style={{
                  background: '#fff',
                  borderRadius: 14,
                  boxShadow: '0 2px 12px #2563eb11',
                  padding: 0,
                  border: '1px solid #e5e7eb',
                  marginTop: 8,
                }}
              >
                <div className="mobile-overflow-x-auto" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table
                    className="gst-table"
                    style={{
                      width: '100%',
                      minWidth: 820,
                      borderCollapse: 'separate',
                      borderSpacing: 0,
                      fontSize: 16,
                    }}
                  >
                    <thead>
                      <tr style={{ background: '#f3f6fa' }}>
                        <th style={{ fontWeight: 700, padding: '14px 10px', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>Product No</th>
                        <th style={{ fontWeight: 700, padding: '14px 10px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>Qty</th>
                        <th style={{ fontWeight: 700, padding: '14px 10px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>Sub Total</th>
                        <th style={{ fontWeight: 700, padding: '14px 10px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>CGST</th>
                        <th style={{ fontWeight: 700, padding: '14px 10px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>SGST</th>
                        <th style={{ fontWeight: 700, padding: '14px 10px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>IGST</th>
                        <th style={{ fontWeight: 700, padding: '14px 10px', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>Payment Method</th>
                        <th style={{ fontWeight: 700, padding: '14px 10px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>GST (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesData.map((s, idx) => (
                        <tr
                          key={idx}
                          style={{
                            background: idx % 2 === 0 ? '#fff' : '#f9fafb',
                            borderBottom: '1px solid #e5e7eb',
                          }}
                        >
                          <td style={{ padding: '12px 10px' }}>{s.productNo || '-'}</td>
                          <td style={{ padding: '12px 10px', textAlign: 'right' }}>{s.qty || '-'}</td>
                          <td style={{ padding: '12px 10px', textAlign: 'right' }}>{s.subTotal || '-'}</td>
                          <td style={{ padding: '12px 10px', textAlign: 'right' }}>{s.cgstAmount || '-'}</td>
                          <td style={{ padding: '12px 10px', textAlign: 'right' }}>{s.sgstAmount || '-'}</td>
                          <td style={{ padding: '12px 10px', textAlign: 'right' }}>{s.igstAmount || '-'}</td>
                          <td style={{ padding: '12px 10px' }}>{s.paymentMethod || '-'}</td>
                          <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                            {`CGST: ${s.cgst}% | SGST: ${s.sgst}% | IGST: ${s.igst}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}



window.GstCalculator = GstCalculator;

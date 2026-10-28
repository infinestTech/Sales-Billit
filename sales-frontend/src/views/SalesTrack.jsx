// Sales History: one row per bill (invoice no., customer, salesperson, totals, payment). Clicking a bill
// expands it to show every product sold on it, with IMEIs, price, cost and line totals.

const ST_CSS = `
.st-filters{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.st-filters input{padding:8px;width:200px}
.st-summary{display:flex;gap:18px;flex-wrap:wrap;margin:0 0 12px;font-size:13px;color:#64748b}
.st-summary b{color:#0f172a;font-size:15px;margin-left:4px}
.st-table td,.st-table th{vertical-align:top}
.st-bill{cursor:pointer}
.st-bill:hover td{background:#f8fafc}
.st-bill.open td{background:#eef2ff}
.st-caret{display:inline-block;width:14px;color:#6366f1;transition:transform .15s}
.st-bill.open .st-caret{transform:rotate(90deg)}
.st-inv{font-weight:700;color:#0f172a}
.st-sub{font-size:12px;color:#64748b}
.st-amt{font-weight:700;white-space:nowrap}
.st-detail td{background:#f8fafc;padding:0 !important}
.st-detail-in{padding:12px 16px 16px 40px}
.st-items{width:100%;border-collapse:collapse;font-size:13px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}
.st-items th{background:#f1f5f9;color:#475569;font-weight:600;text-align:left;padding:8px 10px}
.st-items td{padding:8px 10px;border-top:1px solid #e2e8f0}
.st-items .num{text-align:right;white-space:nowrap}
.st-imei{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;color:#334155}
.st-totals{display:flex;gap:18px;flex-wrap:wrap;justify-content:flex-end;margin-top:10px;font-size:13px;color:#475569}
.st-totals b{color:#0f172a}
`;

const stMoney = (n) => '₹' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const stImes = (i) => (Array.isArray(i.imes) ? i.imes : (Array.isArray(i.selectedImes) ? i.selectedImes : []));
const stQty = (i) => Number(i.qty || i.sellingQty || 0);
const stPayment = (s) => (Array.isArray(s.paymentSplits) && s.paymentSplits.length > 1
  ? s.paymentSplits.map(p => `${p.method} ${stMoney(p.amount)}`).join(' + ')
  : (s.paymentMethod || '-'));

function SalesTrack({ salesUrl, token }) {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [dateFilter, setDateFilter] = React.useState('');
  const [customerFilter, setCustomerFilter] = React.useState('');
  const [imeFilter, setImeFilter] = React.useState('');
  const [open, setOpen] = React.useState(() => new Set());

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

  const toggle = (id) => setOpen(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Filtering logic for sales rows; customer matches number, name or bill number
  const filteredRows = React.useMemo(() => {
    const filterDate = dateFilter ? new Date(dateFilter) : null;
    const cust = customerFilter.trim().toLowerCase();
    const ime = imeFilter.trim().toLowerCase();
    return rows.filter(s => {
      const dateMatch = !filterDate || new Date(s.createdAt).toDateString() === filterDate.toDateString();
      const customerMatch = !cust
        || (s.customerNo || '').toLowerCase().includes(cust)
        || (s.customerName || '').toLowerCase().includes(cust)
        || String(s.invoiceNo || '').includes(cust);
      const imeMatch = !ime || (s.items || []).some(it => stImes(it).some(x => String(x).toLowerCase().includes(ime)));
      return dateMatch && customerMatch && imeMatch;
    });
  }, [rows, dateFilter, customerFilter, imeFilter]);

  const totals = React.useMemo(() => filteredRows.reduce((t, s) => {
    t.amount += Number(s.totalAmount) || 0;
    t.units += (s.items || []).reduce((n, i) => n + stQty(i), 0);
    return t;
  }, { amount: 0, units: 0 }), [filteredRows]);

  // An IMEI search opens the matching bills so the phone is visible straight away
  React.useEffect(() => {
    if (imeFilter.trim()) setOpen(new Set(filteredRows.map(s => s._id)));
  }, [imeFilter, filteredRows]);

  return (
    <div>
      <style>{ST_CSS}</style>
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
            <div className="st-filters">
              <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
              <input type="text" placeholder="Customer no, name or bill no" value={customerFilter} onChange={e => setCustomerFilter(e.target.value)} />
              <input type="text" placeholder="Filter by IMEI" value={imeFilter} onChange={e => setImeFilter(e.target.value)} />
            </div>
            <div className="st-summary">
              <span>Bills<b>{filteredRows.length}</b></span>
              <span>Units<b>{totals.units}</b></span>
              <span>Total<b>{stMoney(totals.amount)}</b></span>
            </div>
            <table className="modern-table st-table">
              <thead>
                <tr>
                  <th>Bill No</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Sales Exec</th>
                  <th>Discount</th>
                  <th>Total</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(s => {
                  const items = s.items || [];
                  const units = items.reduce((n, i) => n + stQty(i), 0);
                  const isOpen = open.has(s._id);
                  const gst = (Number(s.cgstAmount) || 0) + (Number(s.sgstAmount) || 0) + (Number(s.igstAmount) || 0);
                  return (
                    <React.Fragment key={s._id}>
                      <tr className={'st-bill' + (isOpen ? ' open' : '')} onClick={() => toggle(s._id)}
                        tabIndex={0} aria-expanded={isOpen}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(s._id); } }}>
                        <td><span className="st-caret">▸</span> <span className="st-inv">{s.invoiceNo ? '#' + s.invoiceNo : '-'}</span></td>
                        <td>
                          <div>{s.customerName || s.customerNo || '-'}</div>
                          {s.customerName && s.customerNo ? <div className="st-sub">{s.customerNo}</div> : null}
                        </td>
                        <td>{new Date(s.createdAt).toLocaleString()}</td>
                        <td>{items.length} {items.length === 1 ? 'product' : 'products'}<div className="st-sub">{units} {units === 1 ? 'unit' : 'units'}</div></td>
                        <td>{s.employee_name ? `${s.employee_name} (${s.employee_code})` : '-'}</td>
                        <td>{s.discount ? `${s.discount}% (${Number(s.discountAmount||0).toFixed(2)})` : '-'}</td>
                        <td className="st-amt">{stMoney(s.totalAmount)}</td>
                        <td>{stPayment(s)}</td>
                      </tr>
                      {isOpen ? (
                        <tr className="st-detail">
                          <td colSpan={8}>
                            <div className="st-detail-in">
                              <table className="st-items">
                                <thead>
                                  <tr>
                                    <th>Product</th>
                                    <th>Code</th>
                                    <th>IMEI</th>
                                    <th className="num">Qty</th>
                                    <th className="num">Price</th>
                                    <th className="num">Line total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {items.map((i, idx) => {
                                    const ims = stImes(i);
                                    const qty = stQty(i);
                                    const line = Number(i.lineTotal) || qty * (Number(i.sellingPrice) || 0);
                                    return (
                                      <tr key={idx}>
                                        <td>{i.productName || i.productNo || 'item'}{i.hsn ? <div className="st-sub">HSN {i.hsn}</div> : null}</td>
                                        <td>{i.productNo || '-'}</td>
                                        <td>{ims.length ? ims.map(x => <div key={x} className="st-imei">{x}</div>) : '-'}</td>
                                        <td className="num">{qty}</td>
                                        <td className="num">{stMoney(i.sellingPrice)}</td>
                                        <td className="num">{stMoney(line)}</td>
                                      </tr>
                                    );
                                  })}
                                  {items.length === 0 ? <tr><td colSpan={6}>No items on this bill</td></tr> : null}
                                </tbody>
                              </table>
                              <div className="st-totals">
                                {s.subTotal ? <span>Subtotal <b>{stMoney(s.subTotal)}</b></span> : null}
                                {Number(s.discountAmount) > 0 ? <span>Discount <b>−{stMoney(s.discountAmount)}</b></span> : null}
                                {gst > 0 ? <span>GST <b>{stMoney(gst)}</b></span> : null}
                                <span>Total <b>{stMoney(s.totalAmount)}</b></span>
                                {s.amountPaid ? <span>Received <b>{stMoney(s.amountPaid)}</b></span> : null}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}
                {filteredRows.length === 0 ? (
                  <tr><td colSpan={8}>No sales found</td></tr>
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

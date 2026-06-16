// Supplier Credits - Admin-only view for tracking credit purchases and payments
function SupplierCredits({ salesUrl, token }) {
  const [credits, setCredits] = React.useState([]);
  const [summary, setSummary] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [activeTab, setActiveTab] = React.useState('summary'); // summary | all | pending
  const [payModal, setPayModal] = React.useState(null);
  const [payAmount, setPayAmount] = React.useState('');
  const [payNote, setPayNote] = React.useState('');
  const [paying, setPaying] = React.useState(false);
  const [filterSupplier, setFilterSupplier] = React.useState('');

  const getToken = () => {
    const storedBranchToken = typeof window !== 'undefined' ? (localStorage.getItem('branch_token') || '') : '';
    return token || storedBranchToken || '';
  };

  const loadCredits = async (status) => {
    try {
      const effectiveToken = getToken();
      let url = salesUrl + '/api/supplier-credits';
      const params = [];
      if (status && status !== 'all') params.push('status=' + status);
      if (filterSupplier) params.push('supplier_id=' + filterSupplier);
      if (params.length) url += '?' + params.join('&');
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + effectiveToken } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load credits');
      setCredits(data.credits || []);
    } catch (e) { setError(e.message); }
  };

  const loadSummary = async () => {
    try {
      const effectiveToken = getToken();
      const res = await fetch(salesUrl + '/api/supplier-credits/summary', { headers: { Authorization: 'Bearer ' + effectiveToken } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load summary');
      setSummary(data.summary || []);
    } catch (e) { setError(e.message); }
  };

  const loadAll = async () => {
    setLoading(true);
    setError('');
    await Promise.all([loadSummary(), loadCredits(activeTab === 'pending' ? 'pending' : undefined)]);
    setLoading(false);
  };

  React.useEffect(() => { loadAll(); }, [activeTab, filterSupplier]);

  const formatCurrency = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n || 0);

  const totals = summary.reduce((acc, s) => ({
    totalCredit: acc.totalCredit + (s.totalCredit || 0),
    totalPaid: acc.totalPaid + (s.totalPaid || 0),
    outstanding: acc.outstanding + (s.outstanding || 0),
    count: acc.count + (s.count || 0)
  }), { totalCredit: 0, totalPaid: 0, outstanding: 0, count: 0 });

  const handlePay = async () => {
    if (!payModal || !payAmount || Number(payAmount) <= 0) return;
    setPaying(true);
    setError('');
    try {
      const effectiveToken = getToken();
      const res = await fetch(salesUrl + '/api/supplier-credits/' + payModal._id + '/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + effectiveToken },
        body: JSON.stringify({ amount: Number(payAmount), note: payNote })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Payment failed');
      setPayModal(null);
      setPayAmount('');
      setPayNote('');
      await loadAll();
    } catch (e) { setError(e.message); } finally { setPaying(false); }
  };

  const tabStyle = (active) => ({
    padding: '10px 24px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    border: 'none',
    background: active ? '#1e293b' : 'transparent',
    color: active ? '#fff' : '#64748b',
    transition: 'all 0.2s ease'
  });

  const cardStyle = {
    background: '#fff',
    borderRadius: '16px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    overflow: 'hidden'
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ ...cardStyle, padding: '20px' }}>
          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>Total Credit Given</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b' }}>{formatCurrency(totals.totalCredit)}</div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{totals.count} entries</div>
        </div>
        <div style={{ ...cardStyle, padding: '20px' }}>
          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>Total Paid Back</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#059669' }}>{formatCurrency(totals.totalPaid)}</div>
        </div>
        <div style={{ ...cardStyle, padding: '20px' }}>
          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>Outstanding Balance</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: totals.outstanding > 0 ? '#dc2626' : '#059669' }}>{formatCurrency(totals.outstanding)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: '#f1f5f9', padding: '4px', borderRadius: '12px', width: 'fit-content' }}>
        <button onClick={() => setActiveTab('summary')} style={tabStyle(activeTab === 'summary')}>📊 Summary</button>
        <button onClick={() => setActiveTab('all')} style={tabStyle(activeTab === 'all')}>📋 All Credits</button>
        <button onClick={() => setActiveTab('pending')} style={tabStyle(activeTab === 'pending')}>⏳ Pending</button>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px 16px', borderRadius: '8px', color: '#991b1b', marginBottom: '16px' }}>
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>Loading…</div>
      ) : activeTab === 'summary' ? (
        /* Summary Tab - Per Supplier */
        <div style={cardStyle}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: 0 }}>Supplier Credit Summary</h3>
          </div>
          {summary.length === 0 ? (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>💳</div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#374151' }}>No Credit Entries</div>
              <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>Credit purchases will appear here</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#64748b' }}>Supplier</th>
                    <th style={{ padding: '14px 20px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: '#64748b' }}>Entries</th>
                    <th style={{ padding: '14px 20px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: '#64748b' }}>Total Credit</th>
                    <th style={{ padding: '14px 20px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: '#64748b' }}>Paid</th>
                    <th style={{ padding: '14px 20px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: '#64748b' }}>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((s, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>
                        🏢 {s.supplierName || s.supplier_id?.supplierName || s.supplier_id?.agencyName || 'Unknown'}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', fontSize: '14px', color: '#64748b' }}>{s.count}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>{formatCurrency(s.totalCredit)}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', fontSize: '14px', color: '#059669' }}>{formatCurrency(s.totalPaid)}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: s.outstanding > 0 ? '#dc2626' : '#059669' }}>
                        {formatCurrency(s.outstanding)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* All / Pending Credits Tab */
        <div style={cardStyle}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: 0 }}>
              {activeTab === 'pending' ? '⏳ Pending Credits' : '📋 All Credit Entries'}
            </h3>
            <div style={{ fontSize: '13px', color: '#64748b' }}>{credits.length} entries</div>
          </div>
          {credits.length === 0 ? (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#374151' }}>No {activeTab === 'pending' ? 'Pending ' : ''}Credits</div>
            </div>
          ) : (
            <div style={{ padding: '16px' }}>
              {credits.map((credit) => {
                const outstanding = (credit.totalAmount || 0) - (credit.paidAmount || 0);
                return (
                  <div key={credit._id} style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    marginBottom: '12px',
                    background: credit.status === 'settled' ? '#f0fdf4' : '#fff',
                    transition: 'box-shadow 0.2s ease'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>
                          🏢 {credit.supplier_id?.supplierName || credit.supplier_id?.agencyName || 'Unknown Supplier'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                          {new Date(credit.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {credit.inStock_id?.items?.length ? ` • ${credit.inStock_id.items.length} product(s)` : ''}
                        </div>
                      </div>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '600',
                        background: credit.status === 'settled' ? '#dcfce7' : credit.status === 'partial' ? '#fef3c7' : '#fee2e2',
                        color: credit.status === 'settled' ? '#166534' : credit.status === 'partial' ? '#92400e' : '#991b1b'
                      }}>
                        {credit.status === 'settled' ? '✅ Settled' : credit.status === 'partial' ? '🔶 Partial' : '🔴 Pending'}
                      </span>
                    </div>

                    {/* Products Purchased */}
                    {credit.inStock_id?.items && credit.inStock_id.items.length > 0 && (
                      <div style={{ marginTop: '12px', padding: '12px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#0369a1', marginBottom: '8px' }}>📦 Products Purchased</div>
                        {credit.inStock_id.items.map((item, ii) => (
                          <div key={ii} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', padding: '4px 0', borderBottom: ii < credit.inStock_id.items.length - 1 ? '1px solid #e0f2fe' : 'none' }}>
                            <span style={{ color: '#1e293b' }}>
                              {item.productName}{item.brand ? ` (${item.brand})` : ''}{item.model ? ` - ${item.model}` : ''}
                            </span>
                            <span style={{ color: '#64748b', fontSize: '12px' }}>
                              Qty: {item.quantity || 1}{item.costPrice ? ` × ${formatCurrency(item.costPrice)}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '16px' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Credit</div>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>{formatCurrency(credit.totalAmount)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Paid</div>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#059669' }}>{formatCurrency(credit.paidAmount)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Due</div>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: outstanding > 0 ? '#dc2626' : '#059669' }}>{formatCurrency(outstanding)}</div>
                      </div>
                    </div>

                    {/* Payment History */}
                    {credit.payments && credit.payments.length > 0 && (
                      <div style={{ marginTop: '12px', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>Payment History</div>
                        {credit.payments.map((p, pi) => (
                          <div key={pi} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', borderBottom: pi < credit.payments.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                            <span style={{ color: '#374151' }}>{new Date(p.createdAt || p.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} {p.note ? `- ${p.note}` : ''}</span>
                            <span style={{ color: '#059669', fontWeight: '600' }}>{formatCurrency(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {credit.status !== 'settled' && (
                      <button
                        onClick={() => { setPayModal(credit); setPayAmount(''); setPayNote(''); }}
                        style={{
                          marginTop: '12px',
                          padding: '8px 20px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          border: '2px solid #059669',
                          background: '#ecfdf5',
                          color: '#059669',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        💰 Record Payment
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Payment Modal */}
      {payModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px'
        }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '440px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: '0 0 4px' }}>Record Payment</h3>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 20px' }}>
              {payModal.supplier_id?.supplierName || payModal.supplier_id?.agencyName || 'Supplier'} — Outstanding: {formatCurrency((payModal.totalAmount || 0) - (payModal.paidAmount || 0))}
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Payment Amount *</label>
              <input
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="Enter amount"
                style={{ width: '100%', padding: '12px 16px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                onFocus={(e) => e.target.style.borderColor = '#059669'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                autoFocus
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Note (optional)</label>
              <input
                type="text"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="e.g. Paid via UPI"
                style={{ width: '100%', padding: '12px 16px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                onFocus={(e) => e.target.style.borderColor = '#059669'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setPayModal(null)}
                style={{ padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', border: '2px solid #e5e7eb', background: '#fff', color: '#64748b' }}
              >
                Cancel
              </button>
              <button
                onClick={handlePay}
                disabled={paying || !payAmount || Number(payAmount) <= 0}
                style={{
                  padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                  border: 'none', background: '#059669', color: '#fff',
                  opacity: (paying || !payAmount || Number(payAmount) <= 0) ? 0.5 : 1
                }}
              >
                {paying ? 'Processing…' : '💰 Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

window.SupplierCredits = SupplierCredits;

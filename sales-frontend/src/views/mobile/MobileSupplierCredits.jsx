// Mobile Supplier Credits - Admin-only view for tracking credit purchases and payments
function MobileSupplierCredits({ salesUrl, token }) {
  const [credits, setCredits] = React.useState([]);
  const [summary, setSummary] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [activeTab, setActiveTab] = React.useState('summary');
  const [payModal, setPayModal] = React.useState(null);
  const [payAmount, setPayAmount] = React.useState('');
  const [payNote, setPayNote] = React.useState('');
  const [paying, setPaying] = React.useState(false);

  const getToken = () => {
    const storedBranchToken = typeof window !== 'undefined' ? (localStorage.getItem('branch_token') || '') : '';
    return token || storedBranchToken || '';
  };

  const loadCredits = async (status) => {
    try {
      const effectiveToken = getToken();
      let url = salesUrl + '/api/supplier-credits';
      if (status && status !== 'all') url += '?status=' + status;
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

  React.useEffect(() => { loadAll(); }, [activeTab]);

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

  return (
    <div className="mobile-content">
      {/* Summary Cards */}
      <div className="card mobile-mb-3">
        <div className="card-header">
          <h3 className="card-title">💳 Supplier Credits</h3>
          <p className="card-description">Track credit purchases & payments</p>
        </div>
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Total Credit</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>{formatCurrency(totals.totalCredit)}</div>
            </div>
            <div style={{ background: '#fef2f2', padding: '12px', borderRadius: '8px', border: '1px solid #fecaca' }}>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Outstanding</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: totals.outstanding > 0 ? '#dc2626' : '#059669' }}>{formatCurrency(totals.outstanding)}</div>
            </div>
          </div>
          <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '11px', color: '#64748b' }}>Total Paid</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#059669' }}>{formatCurrency(totals.totalPaid)}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', padding: '4px', background: '#f1f5f9', borderRadius: '10px', marginBottom: '16px' }}>
        {[['summary', '📊 Summary'], ['all', '📋 All'], ['pending', '⏳ Pending']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              flex: 1, padding: '8px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
              border: 'none', cursor: 'pointer',
              background: activeTab === id ? '#1e293b' : 'transparent',
              color: activeTab === id ? '#fff' : '#64748b'
            }}
          >{label}</button>
        ))}
      </div>

      {error && <div className="alert alert-danger mobile-mb-3">⚠️ {error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>Loading…</div>
      ) : activeTab === 'summary' ? (
        /* Summary - Per Supplier */
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Per Supplier</h3>
          </div>
          {summary.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💳</div>
              <div className="empty-title">No Credit Entries</div>
              <div className="empty-sub">Credit purchases will appear here</div>
            </div>
          ) : (
            <div style={{ padding: '12px' }}>
              {summary.map((s, i) => (
                <div key={i} style={{
                  padding: '12px', marginBottom: '8px', background: '#f8fafc',
                  borderRadius: '10px', border: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '8px' }}>
                    🏢 {s.supplierName || s.supplier_id?.supplierName || s.supplier_id?.agencyName || 'Unknown'}
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '400', marginLeft: '8px' }}>{s.count} entries</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Credit</div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{formatCurrency(s.totalCredit)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Paid</div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#059669' }}>{formatCurrency(s.totalPaid)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Due</div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: s.outstanding > 0 ? '#dc2626' : '#059669' }}>{formatCurrency(s.outstanding)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* All / Pending */
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">{activeTab === 'pending' ? '⏳ Pending' : '📋 All Credits'}</h3>
            <p className="card-description">{credits.length} entries</p>
          </div>
          {credits.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✅</div>
              <div className="empty-title">No {activeTab === 'pending' ? 'Pending ' : ''}Credits</div>
            </div>
          ) : (
            <div style={{ padding: '12px' }}>
              {credits.map((credit) => {
                const outstanding = (credit.totalAmount || 0) - (credit.paidAmount || 0);
                return (
                  <div key={credit._id} style={{
                    border: '1px solid #e5e7eb', borderRadius: '12px', padding: '14px',
                    marginBottom: '10px', background: credit.status === 'settled' ? '#f0fdf4' : '#fff'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>
                        🏢 {credit.supplier_id?.supplierName || credit.supplier_id?.agencyName || 'Unknown'}
                      </div>
                      <span style={{
                        padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
                        background: credit.status === 'settled' ? '#dcfce7' : credit.status === 'partial' ? '#fef3c7' : '#fee2e2',
                        color: credit.status === 'settled' ? '#166534' : credit.status === 'partial' ? '#92400e' : '#991b1b'
                      }}>
                        {credit.status === 'settled' ? '✅ Settled' : credit.status === 'partial' ? '🔶 Partial' : '🔴 Pending'}
                      </span>
                    </div>

                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>
                      {new Date(credit.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>

                    {/* Products Purchased */}
                    {credit.inStock_id?.items && credit.inStock_id.items.length > 0 && (
                      <div style={{ padding: '8px', background: '#f0f9ff', borderRadius: '6px', marginBottom: '8px', border: '1px solid #bae6fd' }}>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: '#0369a1', marginBottom: '6px' }}>📦 Products</div>
                        {credit.inStock_id.items.map((item, ii) => (
                          <div key={ii} style={{ fontSize: '12px', color: '#1e293b', padding: '2px 0' }}>
                            {item.productName}{item.brand ? ` (${item.brand})` : ''} × {item.quantity || 1}
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '10px' }}>
                      <div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Credit</div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{formatCurrency(credit.totalAmount)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Paid</div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#059669' }}>{formatCurrency(credit.paidAmount)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Due</div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: outstanding > 0 ? '#dc2626' : '#059669' }}>{formatCurrency(outstanding)}</div>
                      </div>
                    </div>

                    {credit.payments && credit.payments.length > 0 && (
                      <div style={{ padding: '8px', background: '#f8fafc', borderRadius: '6px', marginBottom: '8px' }}>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>Payments</div>
                        {credit.payments.map((p, pi) => (
                          <div key={pi} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '3px 0' }}>
                            <span style={{ color: '#374151' }}>{new Date(p.createdAt || p.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} {p.note ? `- ${p.note}` : ''}</span>
                            <span style={{ color: '#059669', fontWeight: '600' }}>{formatCurrency(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {credit.status !== 'settled' && (
                      <button
                        onClick={() => { setPayModal(credit); setPayAmount(''); setPayNote(''); }}
                        className="btn btn-primary mobile-w-full"
                        style={{ padding: '8px', fontSize: '13px' }}
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
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end',
          zIndex: 1000
        }}>
          <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', padding: '24px', width: '100%', maxHeight: '60vh' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: '0 0 4px' }}>Record Payment</h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px' }}>
              {payModal.supplier_id?.supplierName || payModal.supplier_id?.agencyName || 'Supplier'} — Due: {formatCurrency((payModal.totalAmount || 0) - (payModal.paidAmount || 0))}
            </p>

            <div className="form-group mobile-mb-3">
              <label className="form-label">Amount *</label>
              <input
                className="form-input"
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="Enter payment amount"
                autoFocus
              />
            </div>

            <div className="form-group mobile-mb-3">
              <label className="form-label">Note (optional)</label>
              <input
                className="form-input"
                type="text"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="e.g. Paid via UPI"
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setPayModal(null)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >Cancel</button>
              <button
                onClick={handlePay}
                disabled={paying || !payAmount || Number(payAmount) <= 0}
                className="btn btn-primary"
                style={{ flex: 2, opacity: (paying || !payAmount || Number(payAmount) <= 0) ? 0.5 : 1 }}
              >{paying ? 'Processing…' : '💰 Confirm'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

window.MobileSupplierCredits = MobileSupplierCredits;

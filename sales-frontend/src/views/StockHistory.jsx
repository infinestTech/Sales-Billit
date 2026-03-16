function StockHistory({ salesUrl, token, branchUser }) {
  const [supplies, setSupplies] = React.useState([]);
  const [branches, setBranches] = React.useState([]);
  const [selectedBranch, setSelectedBranch] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [selected, setSelected] = React.useState(null);

  const [isMobile, setIsMobile] = React.useState(() => {
    try {
      return window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    } catch (_e) {
      return false;
    }
  });

  React.useEffect(() => {
    try {
      if (!window.matchMedia) return;
      const mql = window.matchMedia('(max-width: 768px)');
      const apply = () => setIsMobile(!!mql.matches);
      apply();

      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', apply);
        return () => mql.removeEventListener('change', apply);
      }

      // Safari fallback
      if (typeof mql.addListener === 'function') {
        mql.addListener(apply);
        return () => mql.removeListener(apply);
      }
    } catch (_e) {
      // ignore
    }
  }, []);

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
    <div style={{ padding: isMobile ? '12px' : '24px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Page Header */}
      <div style={{ marginBottom: isMobile ? '18px' : '32px' }}>
        <h1 style={{ 
          fontSize: '32px', 
          fontWeight: '700', 
          color: '#1e293b', 
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          📊 Stock History
        </h1>
        <p style={{ color: '#64748b', fontSize: '16px', margin: 0 }}>
          Track and manage your inventory supply history across all branches
        </p>
      </div>

      {/* Statistics Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: isMobile ? '12px' : '24px', 
        marginBottom: isMobile ? '18px' : '32px' 
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: isMobile ? '12px' : '16px',
          padding: isMobile ? '16px' : '24px',
          color: 'white',
          boxShadow: '0 10px 25px rgba(102, 126, 234, 0.15)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ 
              fontSize: '28px', 
              marginRight: '16px',
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '12px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>📦</div>
            <div>
              <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '4px' }}>Total Supplies</div>
              <div style={{ fontSize: '28px', fontWeight: '700' }}>
                {visibleSupplies.length}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '14px', opacity: 0.8 }}>Supply records found</div>
        </div>
       
        <div style={{
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          borderRadius: '16px',
          padding: '24px',
          color: 'white',
          boxShadow: '0 10px 25px rgba(240, 147, 251, 0.15)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ 
              fontSize: '28px', 
              marginRight: '16px',
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '12px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>💰</div>
            <div>
              <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '4px' }}>Total Value</div>
              <div style={{ fontSize: '28px', fontWeight: '700' }}>
                {new Intl.NumberFormat('en-IN', { 
                  style: 'currency', 
                  currency: 'INR', 
                  maximumFractionDigits: 0 
                }).format(
                  visibleSupplies.reduce((sum, s) => sum + ((s.supplierAmount || 0) + (s.gstAmount || 0)), 0)
                )}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '14px', opacity: 0.8 }}>Total supply value</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          borderRadius: '16px',
          padding: '24px',
          color: 'white',
          boxShadow: '0 10px 25px rgba(79, 172, 254, 0.15)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ 
              fontSize: '28px', 
              marginRight: '16px',
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '12px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>🏢</div>
            <div>
              <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '4px' }}>Active Branches</div>
              <div style={{ fontSize: '28px', fontWeight: '700' }}>
                {new Set(visibleSupplies.map(s => s.branch_id || s.branchName).filter(Boolean)).size}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '14px', opacity: 0.8 }}>Branches with supplies</div>
        </div>
      </div>

      {/* Filters and Actions Section */}
      <div className="card" style={{ marginBottom: isMobile ? 18 : 32 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">Filters & Actions</h3>
            <p className="card-description">Filter supply records by branch and date range</p>
          </div>
        </div>

        <div className="form-grid form-grid-3" style={{ marginBottom: 16 }}>
          {!branchUser && (
            <div className="form-group">
              <label className="form-label">Branch</label>
              <select
                className="form-select"
                value={selectedBranch}
                onChange={(e) => { setSelectedBranch(e.target.value); loadSupplies(e.target.value); }}
              >
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>{b.name || b._id}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">From Date</label>
            <input
              className="form-input"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">To Date</label>
            <input
              className="form-input"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="btn-group" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={() => loadSupplies(selectedBranch)}>
            🔄 Refresh
          </button>
          {!branchUser ? (
            <button type="button" className="btn secondary" onClick={() => { try { location.hash = '#branch-supply'; } catch {} }}>
              ➕ Add Supply
            </button>
          ) : null}
          <button type="button" className="btn secondary" onClick={() => { setStartDate(''); setEndDate(''); }}>
            🗑️ Clear Dates
          </button>
        </div>
      </div>




      
      {/* Main Table Section */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '32px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ 
            fontSize: '24px', 
            fontWeight: '600', 
            color: '#1e293b',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            📋 Supply Records
          </h3>
          <p style={{ 
            color: '#64748b', 
            fontSize: '16px',
            margin: 0
          }}>
            {loading ? 'Loading supplies...' : `Showing ${visibleSupplies.length} supply record${visibleSupplies.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '24px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{
            textAlign: 'center',
            padding: '64px 24px',
            background: '#f8fafc',
            borderRadius: '12px',
            border: '2px dashed #cbd5e1'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
            <div style={{ fontSize: '20px', fontWeight: '600', color: '#475569', marginBottom: '8px' }}>
              Loading Supply Records
            </div>
            <div style={{ color: '#64748b', fontSize: '16px' }}>
              Please wait while we fetch the data...
            </div>
          </div>
        ) : visibleSupplies.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '64px 24px',
            background: '#f8fafc',
            borderRadius: '12px',
            border: '2px dashed #cbd5e1'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
            <div style={{ fontSize: '20px', fontWeight: '600', color: '#475569', marginBottom: '8px' }}>
              No Supply Records Found
            </div>
            <div style={{ color: '#64748b', fontSize: '16px' }}>
              {startDate || endDate ? 'No supplies found for the selected date range' : 'No supply records available'}
            </div>
          </div>
        ) : (
          <div style={{ 
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            overflow: 'hidden',
            background: '#fff'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                fontSize: '14px'
              }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{
                      padding: '16px 12px',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: '#374151',
                      borderBottom: '2px solid #e5e7eb',
                      minWidth: '150px'
                    }}>Supplier</th>
                    <th style={{
                      padding: '16px 12px',
                      textAlign: 'right',
                      fontWeight: '600',
                      color: '#374151',
                      borderBottom: '2px solid #e5e7eb',
                      minWidth: '120px'
                    }}>Supplier Amount</th>
                    <th style={{
                      padding: '16px 12px',
                      textAlign: 'right',
                      fontWeight: '600',
                      color: '#374151',
                      borderBottom: '2px solid #e5e7eb',
                      minWidth: '110px'
                    }}>GST Amount</th>
                    <th style={{
                      padding: '16px 12px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#374151',
                      borderBottom: '2px solid #e5e7eb',
                      width: '100px'
                    }}>Created By</th>
                    <th style={{
                      padding: '16px 12px',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: '#374151',
                      borderBottom: '2px solid #e5e7eb',
                      minWidth: '120px'
                    }}>Branch</th>
                    <th style={{
                      padding: '16px 12px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#374151',
                      borderBottom: '2px solid #e5e7eb',
                      minWidth: '160px'
                    }}>Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSupplies.map(s => (
                    <tr 
                      key={s._id} 
                      onClick={async () => {
                        try {
                          const eff = getEffectiveToken();
                          const res = await fetch((salesUrl || '') + '/api/branch-supplies/' + s._id, { 
                            headers: { Authorization: 'Bearer ' + eff } 
                          });
                          const d = await res.json();
                          if (res.ok && d.supply) setSelected(d.supply);
                          else setSelected(s);
                        } catch (e) { setSelected(s); }
                      }} 
                      style={{
                        cursor: 'pointer',
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseOver={(e) => e.target.parentElement.style.backgroundColor = '#f8fafc'}
                      onMouseOut={(e) => e.target.parentElement.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '16px 12px' }}>
                        <div style={{ fontWeight: '500', color: '#1e293b' }}>
                          {s.supplierName || s.supplier || '-'}
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'right' }}>
                        <span style={{
                          color: '#059669',
                          fontWeight: '600'
                        }}>
                          {s.supplierAmount != null ? 
                            new Intl.NumberFormat('en-IN', {
                              style: 'currency',
                              currency: 'INR',
                              maximumFractionDigits: 2
                            }).format(s.supplierAmount) : '-'
                          }
                        </span>
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'right' }}>
                        <span style={{
                          color: '#dc2626',
                          fontWeight: '600'
                        }}>
                          {s.gstAmount != null ? 
                            new Intl.NumberFormat('en-IN', {
                              style: 'currency',
                              currency: 'INR',
                              maximumFractionDigits: 2
                            }).format(s.gstAmount) : '-'
                          }
                        </span>
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                        <span style={{
                          background: s.createdByType === 'branch' ? '#dbeafe' : '#f3f4f6',
                          color: s.createdByType === 'branch' ? '#1d4ed8' : '#374151',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          {s.createdByType === 'branch' ? 'Branch' : 
                           (s.createdByType === 'admin' ? 'Admin' : 
                           (s.createdBy || 'Unknown'))}
                        </span>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <div style={{ fontWeight: '500', color: '#1e293b' }}>
                          {s.branch_name || s.branchName || (s.branch_id ? String(s.branch_id) : '-')}
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
                        {s.createdAt ? (
                          <div>
                            <div>{new Date(s.createdAt).toLocaleDateString()}</div>
                            <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                              {new Date(s.createdAt).toLocaleTimeString()}
                            </div>
                          </div>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Supply Details Modal */}
      {selected && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '1000px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '24px 32px',
              borderBottom: '1px solid #e5e7eb',
              position: 'sticky',
              top: 0,
              background: 'white',
              borderRadius: '16px 16px 0 0',
              zIndex: 10
            }}>
              <div>
                <h2 style={{ 
                  fontSize: '24px', 
                  fontWeight: '700', 
                  color: '#1e293b',
                  margin: 0,
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  📋 Supply Details
                </h2>
                <p style={{ 
                  color: '#64748b', 
                  fontSize: '14px', 
                  margin: 0 
                }}>Complete information about this supply record</p>
              </div>
              <button 
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
                onClick={()=>setSelected(null)}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ padding: '32px' }}>
              {/* Supply Summary Section */}
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ 
                  fontSize: '18px', 
                  fontWeight: '600', 
                  color: '#1e293b',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  ℹ️ Supply Information
                </h3>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                  gap: '20px',
                  background: '#f8fafc',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0'
                }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Supplier</div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                      {selected.supplierName || selected.supplier || '-'}
                    </div>
                  </div>
                  
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Supplier Amount</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#059669' }}>
                      {selected.supplierAmount != null ? 
                        new Intl.NumberFormat('en-IN', {
                          style: 'currency',
                          currency: 'INR',
                          maximumFractionDigits: 2
                        }).format(selected.supplierAmount) : '-'
                      }
                    </div>
                  </div>
                  
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>GST Amount</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#dc2626' }}>
                      {selected.gstAmount != null ? 
                        new Intl.NumberFormat('en-IN', {
                          style: 'currency',
                          currency: 'INR',
                          maximumFractionDigits: 2
                        }).format(selected.gstAmount) : '-'
                      }
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Total Amount</div>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: '#3b82f6' }}>
                      {new Intl.NumberFormat('en-IN', {
                        style: 'currency',
                        currency: 'INR',
                        maximumFractionDigits: 2
                      }).format((selected.supplierAmount || 0) + (selected.gstAmount || 0))}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Created Date</div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                      {selected.createdAt ? new Date(selected.createdAt).toLocaleDateString() : '-'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                      {selected.createdAt ? new Date(selected.createdAt).toLocaleTimeString() : ''}
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Section */}
              <div>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginBottom: '16px' 
                }}>
                  <h3 style={{ 
                    fontSize: '18px', 
                    fontWeight: '600', 
                    color: '#1e293b',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    📦 Product Items
                  </h3>
                  <div style={{
                    background: '#dbeafe',
                    color: '#1d4ed8',
                    padding: '4px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    {Array.isArray(selected.items) ? selected.items.length : 0} items
                  </div>
                </div>

                {Array.isArray(selected.items) && selected.items.length > 0 ? (
                  <div style={{ 
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    background: '#fff'
                  }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ 
                        width: '100%', 
                        borderCollapse: 'collapse',
                        fontSize: '14px'
                      }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            <th style={{
                              padding: '12px',
                              textAlign: 'left',
                              fontWeight: '600',
                              color: '#374151',
                              borderBottom: '2px solid #e5e7eb',
                              minWidth: '120px'
                            }}>Product No</th>
                            <th style={{
                              padding: '12px',
                              textAlign: 'left',
                              fontWeight: '600',
                              color: '#374151',
                              borderBottom: '2px solid #e5e7eb',
                              minWidth: '150px'
                            }}>Product Name</th>
                            <th style={{
                              padding: '12px',
                              textAlign: 'left',
                              fontWeight: '600',
                              color: '#374151',
                              borderBottom: '2px solid #e5e7eb',
                              minWidth: '100px'
                            }}>Brand</th>
                            <th style={{
                              padding: '12px',
                              textAlign: 'left',
                              fontWeight: '600',
                              color: '#374151',
                              borderBottom: '2px solid #e5e7eb',
                              minWidth: '100px'
                            }}>Model</th>
                            <th style={{
                              padding: '12px',
                              textAlign: 'center',
                              fontWeight: '600',
                              color: '#374151',
                              borderBottom: '2px solid #e5e7eb',
                              width: '80px'
                            }}>Qty</th>
                            <th style={{
                              padding: '12px',
                              textAlign: 'right',
                              fontWeight: '600',
                              color: '#374151',
                              borderBottom: '2px solid #e5e7eb',
                              minWidth: '120px'
                            }}>Cost Price</th>
                            <th style={{
                              padding: '12px',
                              textAlign: 'center',
                              fontWeight: '600',
                              color: '#374151',
                              borderBottom: '2px solid #e5e7eb',
                              minWidth: '120px'
                            }}>Validity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.items.map((it, idx) => (
                            <tr 
                              key={idx} 
                              style={{ borderBottom: '1px solid #f1f5f9' }}
                            >
                              <td style={{ padding: '12px' }}>
                                <span style={{
                                  background: '#f1f5f9',
                                  color: '#475569',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontFamily: 'monospace'
                                }}>
                                  {it.productNo || it.productId || '-'}
                                </span>
                              </td>
                              <td style={{ padding: '12px' }}>
                                <div style={{ fontWeight: '500', color: '#1e293b' }}>
                                  {it.productName || '-'}
                                </div>
                              </td>
                              <td style={{ padding: '12px', color: '#475569' }}>
                                {it.brand || '-'}
                              </td>
                              <td style={{ padding: '12px', color: '#475569' }}>
                                {it.model || '-'}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center' }}>
                                <span style={{
                                  background: '#dbeafe',
                                  color: '#1d4ed8',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '600'
                                }}>
                                  {it.qty != null ? it.qty : (it.quantity != null ? it.quantity : '-')}
                                </span>
                              </td>
                              <td style={{ padding: '12px', textAlign: 'right' }}>
                                <span style={{
                                  color: '#059669',
                                  fontWeight: '600'
                                }}>
                                  {it.costPrice != null ? 
                                    new Intl.NumberFormat('en-IN', {
                                      style: 'currency',
                                      currency: 'INR',
                                      maximumFractionDigits: 2
                                    }).format(it.costPrice) : '-'
                                  }
                                </span>
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
                                {it.validity ? new Date(it.validity).toLocaleDateString() : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: '48px 24px',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '2px dashed #cbd5e1'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
                    <div style={{ fontSize: '18px', fontWeight: '600', color: '#475569', marginBottom: '8px' }}>
                      No Items Found
                    </div>
                    <div style={{ color: '#64748b', fontSize: '14px' }}>
                      This supply record doesn't contain any items
                    </div>
                  </div>
                )}
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

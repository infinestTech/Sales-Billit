import React from 'react';

export default function CreateBranch({ salesUrl, token, planId, branchLimit: propBranchLimit = 0 }) {
  const [form, setForm] = React.useState({
    name: '', address: '', gstNo: '', phoneNumber: '', email: '', password: '', confirmPassword: ''
  });
  const [rows, setRows] = React.useState([]);
  const [branchLimit, setBranchLimit] = React.useState(propBranchLimit);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(10);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const loadBranches = async () => {
    try {
      setError('');
      const res = await fetch(salesUrl + '/api/branches', { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load branches');
      setRows(Array.isArray(data.branches) ? data.branches : []);
      setPage(1);
    } catch (e) { setError(e.message); }
  };

  const loadPlanLimits = async () => {
    try {
      const res = await fetch(salesUrl + '/api/plan-limits');
      const data = await res.json();
      if (res.ok && data.limits?.branches) {
        setBranchLimit(data.limits.branches);
      }
    } catch (e) {
      console.error('Failed to fetch plan limits:', e);
    }
  };

  React.useEffect(() => { 
    loadBranches(); 
    loadPlanLimits();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match');
    if (rows.length >= branchLimit) return setError('Branch limit reached for your plan');
    
    // Check if email already exists in the current branches list
    const normalizedEmail = (form.email || '').toLowerCase().trim();
    const emailExists = rows.some(branch => 
      (branch.email || '').toLowerCase().trim() === normalizedEmail
    );
    
    if (emailExists) {
      return setError('A branch with this email already exists. Please use a different email address.');
    }
    
    setSaving(true);
    try {
      const res = await fetch(salesUrl + '/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          name: form.name,
          address: form.address,
          gstNo: form.gstNo, // Added GST No field
          phoneNumber: form.phoneNumber,
          email: form.email,
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Create failed');
      setForm({ name: '', address: '', gstNo: '', phoneNumber: '', email: '', password: '', confirmPassword: '' });
      await loadBranches();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // pagination
  const total = rows.length;
  const startIndex = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, total);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const visible = rows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

  return (
    <div>
      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon">🏪</div>
            <div>
              <div className="stat-label">Branch Limit</div>
              <div className="stat-value">{Number.isFinite(branchLimit) ? branchLimit : 0}</div>
            </div>
          </div>
          <div className="stat-change positive">Plan: {planId || 'Basic'}</div>
        </div>
        
        <div className="stat-card secondary">
          <div className="stat-header">
            <div className="stat-icon" style={{background: 'var(--gradient-secondary)'}}>🌟</div>
            <div>
              <div className="stat-label">Active Branches</div>
              <div className="stat-value">{rows.length}</div>
            </div>
          </div>
          <div className="stat-change">{rows.length > 0 ? 'Operational' : 'Getting Started'}</div>
        </div>
        
        <div className="stat-card accent">
          <div className="stat-header">
            <div className="stat-icon" style={{background: 'var(--gradient-accent)'}}>📊</div>
            <div>
              <div className="stat-label">Available Slots</div>
              <div className="stat-value">{Math.max(0, branchLimit - rows.length)}</div>
            </div>
          </div>
          <div className="stat-change">{branchLimit - rows.length > 0 ? 'Ready to expand' : 'Limit reached'}</div>
        </div>
      </div>

      {/* Create Branch Form */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Create New Branch</h3>
            <p className="card-description">Add a new branch location to expand your business</p>
          </div>
        </div>
        
        <form onSubmit={submit}>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label required">Branch Name</label>
              <input 
                name="name" 
                value={form.name} 
                onChange={onChange} 
                placeholder="e.g., Downtown Store" 
                className="form-input"
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Address</label>
              <input 
                name="address" 
                value={form.address} 
                onChange={onChange} 
                placeholder="Complete address" 
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input 
                name="phoneNumber" 
                value={form.phoneNumber} 
                onChange={onChange} 
                placeholder="Contact number" 
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label required">Email</label>
              <input 
                name="email" 
                type="email" 
                value={form.email} 
                onChange={onChange} 
                placeholder="branch@example.com" 
                className="form-input"
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label required">Password</label>
              <input 
                name="password" 
                type="password" 
                value={form.password} 
                onChange={onChange} 
                placeholder="Secure password" 
                className="form-input"
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label required">Confirm Password</label>
              <input 
                name="confirmPassword" 
                type="password" 
                value={form.confirmPassword} 
                onChange={onChange} 
                placeholder="Confirm password" 
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">GST No</label>
              <input 
                name="gstNo" 
                value={form.gstNo} 
                onChange={onChange} 
                placeholder="GST Number" 
                className="form-input"
              />
            </div>
          </div>
          
          <div className="btn-group mt-4">
            <button 
              className="btn btn-primary" 
              type="submit" 
              disabled={saving || rows.length >= branchLimit}
            >
              {saving ? (
                <span className="loading">
                  <span className="spinner"></span>
                  Creating...
                </span>
              ) : '+ Create Branch'}
            </button>
            
            <div style={{ 
              alignSelf: 'center', 
              color: 'var(--text-muted)', 
              fontSize: '14px',
              fontWeight: '500'
            }}>
              {branchLimit > 0 ? `Using ${rows.length} of ${branchLimit} branches` : 'Upgrade to enable branches'}
            </div>
          </div>
          
          {error && (
            <div className="alert alert-danger mt-4">
              <div className="alert-icon">❌</div>
              <div>{error}</div>
            </div>
          )}
        </form>
      </div>

      {/* Branches Table */}
      <div className="table-card branch-section">
        <div className="table-header">
          <div>
            <h3 className="table-title">Branch Locations</h3>
            <p className="table-subtitle">Manage all your business locations</p>
          </div>
        </div>
        
        {visible.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">�</div>
            <div className="empty-title">No Branches Yet</div>
            <div className="empty-description">Create your first branch location to get started</div>
            <button className="empty-action" onClick={() => document.querySelector('input[name="name"]')?.focus()}>
              🏪 Create First Branch
            </button>
          </div>
        ) : (
          <>
            <div className="table-scroll">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th style={{width: '80px'}}>No.</th>
                    <th>Branch Name</th>
                    <th>Address</th>
                    <th>Contact</th>
                    <th>Email</th>
                    <th>GST No</th>
                    
                    <th>Status</th>
                   
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r, i) => (
                    <tr key={r._id || (startIndex + i)}>
                      <td>
                        <span className="serial-badge">{startIndex + i}</span>
                      </td>
                      <td>
                        <span className="cell-strong">{r.name || '-'}</span>
                      </td>
                      <td>{r.address || '-'}</td>
                      <td>{r.phoneNumber || '-'}</td>
                      <td>{r.email || '-'}</td>
                      <td>{r.gstNo || '-'}</td>
                      <td>
                        <span className="status-badge success">Active</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="table-footer">
              <div className="table-info">
                {total === 0 ? 'No branches found' : `Showing ${startIndex} to ${endIndex} of ${total} branches`}
              </div>
              <div className="pagination">
                <button 
                  className="pagination-btn" 
                  type="button" 
                  onClick={() => setPage(p => Math.max(1, p - 1))} 
                  disabled={page <= 1}
                >
                  ← Previous
                </button>
                <span className="pagination-info">Page {page} of {totalPages}</span>
                <button 
                  className="pagination-btn" 
                  type="button" 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                  disabled={page >= totalPages}
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

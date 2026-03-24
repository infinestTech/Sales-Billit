function MobileCreateBranch({ salesUrl, token, planId, branchLimit: propBranchLimit = 0 }) {
  const [form, setForm] = React.useState({
    name: '',
    address: '',
    gstNo: '',
    phoneNumber: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const [rows, setRows] = React.useState([]);
  const [branchLimit, setBranchLimit] = React.useState(propBranchLimit);
  const [saving, setSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(10);

  const formTopRef = React.useRef(null);
  const nameInputRef = React.useRef(null);

  const decodeJwt = (tk) => {
    try {
      const base64 = tk.split('.')[1] || '';
      const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(json);
    } catch (_e) {
      return null;
    }
  };

  const storedBranchToken = typeof window !== 'undefined' ? (localStorage.getItem('branch_token') || '') : '';
  const effectiveToken = token || storedBranchToken || '';
  const decodedEffective = effectiveToken ? decodeJwt(effectiveToken) : null;
  const branchUserDecoded = decodedEffective && decodedEffective.branch_id ? decodedEffective : null;

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const loadPlanLimits = React.useCallback(async () => {
    try {
      const res = await fetch(salesUrl + '/api/plan-limits');
      const data = await res.json();
      if (res.ok && data.limits?.branches) {
        setBranchLimit(data.limits.branches);
      }
    } catch (e) {
      console.error('Failed to fetch plan limits:', e);
    }
  }, [salesUrl]);

  const loadBranches = React.useCallback(async () => {
    setLoading(true);
    try {
      setError('');
      let res = await fetch(salesUrl + '/api/branches', {
        headers: { Authorization: 'Bearer ' + effectiveToken }
      });

      if (res.status === 401 && storedBranchToken && storedBranchToken !== effectiveToken) {
        res = await fetch(salesUrl + '/api/branches', {
          headers: { Authorization: 'Bearer ' + storedBranchToken }
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load branches');
      setRows(Array.isArray(data.branches) ? data.branches : []);
      setPage(1);
    } catch (e) {
      if (!branchUserDecoded) setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [salesUrl, effectiveToken, storedBranchToken, branchUserDecoded]);

  React.useEffect(() => {
    loadBranches();
    loadPlanLimits();
  }, [loadBranches, loadPlanLimits]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      return setError('Passwords do not match');
    }

    const limit = Number.isFinite(Number(branchLimit)) ? Number(branchLimit) : 0;
    if (limit > 0 && rows.length >= limit) {
      return setError('Branch limit reached for your plan');
    }

    const normalizedEmail = (form.email || '').toLowerCase().trim();
    const emailExists = rows.some((branch) => (branch.email || '').toLowerCase().trim() === normalizedEmail);
    if (emailExists) {
      return setError('A branch with this email already exists. Please use a different email address.');
    }

    setSaving(true);

    try {
      let res = await fetch(salesUrl + '/api/branches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + effectiveToken
        },
        body: JSON.stringify({
          name: form.name,
          address: form.address,
          gstNo: form.gstNo,
          phoneNumber: form.phoneNumber,
          email: form.email,
          password: form.password
        })
      });

      if (res.status === 401 && storedBranchToken && storedBranchToken !== effectiveToken) {
        res = await fetch(salesUrl + '/api/branches', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + storedBranchToken
          },
          body: JSON.stringify({
            name: form.name,
            address: form.address,
            gstNo: form.gstNo,
            phoneNumber: form.phoneNumber,
            email: form.email,
            password: form.password
          })
        });
      }

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Create failed');

      setForm({ name: '', address: '', gstNo: '', phoneNumber: '', email: '', password: '', confirmPassword: '' });
      await loadBranches();

      try {
        if (nameInputRef.current) nameInputRef.current.focus();
      } catch (_e) {}
    } catch (e) {
      if (!branchUserDecoded) setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(totalPages, Math.max(1, page));
  const startIndex = total === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const endIndex = Math.min(clampedPage * pageSize, total);
  const visible = rows.slice((clampedPage - 1) * pageSize, (clampedPage - 1) * pageSize + pageSize);

  const scrollToCreate = () => {
    try {
      if (formTopRef.current) formTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => {
        try {
          if (nameInputRef.current) nameInputRef.current.focus();
        } catch (_e) {}
      }, 250);
    } catch (_e) {}
  };

  const limit = Number.isFinite(Number(branchLimit)) ? Number(branchLimit) : 0;
  const usedCount = rows.length;
  const remaining = limit > 0 ? Math.max(0, limit - usedCount) : 0;
  const limitReached = limit > 0 ? usedCount >= limit : true;

  const badgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    fontSize: 12,
    fontWeight: 800,
    color: 'var(--text)'
  };

  const subStyle = {
    fontSize: 12,
    color: 'var(--text-muted)',
    marginTop: 2
  };

  const kvRow = {
    display: 'grid',
    gridTemplateColumns: '110px 1fr',
    gap: 8,
    padding: '8px 0',
    borderTop: '1px solid var(--border)'
  };

  const kvKey = { fontSize: 12, fontWeight: 800, color: 'var(--text-muted)' };
  const kvVal = { fontSize: 13, fontWeight: 700, color: 'var(--text)', wordBreak: 'break-word' };

  return (
    <div className="mobile-content" style={{ paddingBottom: 80 }}>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>🏪 Branch Management</div>
            <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>Create and manage branch locations</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            <div style={badgeStyle}>{limit > 0 ? `Limit: ${limit}` : 'Upgrade required'}</div>
            <div style={{ ...badgeStyle, fontWeight: 900 }}>{limit > 0 ? `${usedCount}/${limit} used` : `${usedCount} branches`}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 10, background: 'var(--bg)' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)' }}>Plan</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--text)', marginTop: 2 }}>{planId || 'Trial'}</div>
            <div style={subStyle}>Your current plan</div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 10, background: 'var(--bg)' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)' }}>Available Slots</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--text)', marginTop: 2 }}>{limit > 0 ? remaining : 0}</div>
            <div style={subStyle}>{limit > 0 ? (remaining > 0 ? 'Ready to expand' : 'Limit reached') : 'Enable branches to add'}</div>
          </div>
        </div>
      </div>

      <div className="card" ref={formTopRef} style={{ marginBottom: 12 }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text)' }}>+ Create New Branch</div>
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>Fill details to add a new branch</div>
        </div>

        <form onSubmit={submit}>
          <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            <div className="form-group">
              <label className="form-label required">Branch Name</label>
              <input
                ref={nameInputRef}
                name="name"
                value={form.name}
                onChange={onChange}
                placeholder="e.g., Downtown Store"
                className="form-input"
                required
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
              <label className="form-label">GST No</label>
              <input
                name="gstNo"
                value={form.gstNo}
                onChange={onChange}
                placeholder="GST Number"
                className="form-input"
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
          </div>

          <div style={{ marginTop: 12 }}>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={saving || (limit > 0 ? usedCount >= limit : true)}
              style={{ width: '100%' }}
            >
              {saving ? 'Creating…' : '+ Create Branch'}
            </button>
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>
              {limit > 0 ? `Using ${usedCount} of ${limit} branches` : 'Upgrade to enable branches'}
            </div>

            {limit > 0 && limitReached ? (
              <div style={{
                marginTop: 10,
                backgroundColor: '#fee2e2',
                border: '1px solid #fecaca',
                borderRadius: '0.75rem',
                padding: '0.75rem',
                color: '#991b1b',
                fontSize: 13
              }}>
                🚫 Branch limit reached ({usedCount}/{limit}).
                <button
                  type="button"
                  onClick={() => window.open('/pricing', '_blank')}
                  style={{
                    marginLeft: 6,
                    color: '#1d4ed8',
                    textDecoration: 'underline',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13
                  }}
                >
                  Upgrade
                </button>
              </div>
            ) : null}

            {error && (
              <div style={{
                marginTop: 10,
                backgroundColor: '#fee2e2',
                border: '1px solid #fecaca',
                borderRadius: '0.75rem',
                padding: '0.75rem',
                color: '#991b1b',
                fontSize: 13
              }}>
                ❌ {error}
              </div>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text)' }}>Branch Locations</div>
            <div style={{ marginTop: 2, fontSize: 13, color: 'var(--text-muted)' }}>Readable list for mobile</div>
          </div>

          <button type="button" className="btn secondary" onClick={loadBranches} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {loading && visible.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700, padding: 8 }}>Loading branches…</div>
        ) : null}

        {visible.length === 0 && !loading ? (
          <div style={{
            border: '1px dashed var(--border)',
            borderRadius: 14,
            padding: 14,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>No Branches Yet</div>
            <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-muted)' }}>Create your first branch location to get started</div>
            <button type="button" className="btn btn-primary" style={{ marginTop: 12, width: '100%' }} onClick={scrollToCreate}>
              🏪 Create First Branch
            </button>
          </div>
        ) : null}

        {visible.length > 0 ? (
          <>
            <div style={{ display: 'grid', gap: 10 }}>
              {visible.map((r, i) => (
                <div
                  key={r._id || (startIndex + i)}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    padding: 12,
                    background: 'var(--bg)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 950, color: 'var(--text)' }}>{r.name || '-'}</div>
                      <div style={{ marginTop: 2, fontSize: 13, fontWeight: 800, color: 'var(--text-muted)' }}>{r.email || '-'}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                      <div style={badgeStyle}>#{startIndex + i}</div>
                      <div style={{ ...badgeStyle, borderColor: 'rgba(34,197,94,0.3)' }}>Active</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <div style={kvRow}>
                      <div style={kvKey}>Contact</div>
                      <div style={kvVal}>{r.phoneNumber || '-'}</div>
                    </div>
                    <div style={kvRow}>
                      <div style={kvKey}>GST No</div>
                      <div style={kvVal}>{r.gstNo || '-'}</div>
                    </div>
                    <div style={kvRow}>
                      <div style={kvKey}>Address</div>
                      <div style={kvVal}>{r.address || '-'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              borderTop: '1px solid var(--border)',
              paddingTop: 12,
              marginTop: 12
            }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)' }}>
                {total === 0 ? 'No branches found' : `Showing ${startIndex} to ${endIndex} of ${total} branches`}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={clampedPage <= 1}
                >
                  ← Previous
                </button>
                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={clampedPage >= totalPages}
                >
                  Next →
                </button>
              </div>

              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)', textAlign: 'center' }}>
                Page {clampedPage} of {totalPages}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

window.MobileCreateBranch = MobileCreateBranch;

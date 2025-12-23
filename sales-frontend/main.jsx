// Sidebar and HeaderBar are now loaded from src/components via index.html

function App() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [token, setToken] = React.useState(localStorage.getItem('sales_token') || '');
  const [hasAccess, setHasAccess] = React.useState(null); // null=unknown, true/false
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [view, setView] = React.useState((location.hash || '#bank').slice(1));
  const [planId, setPlanId] = React.useState('');
  const [branchLimit, setBranchLimit] = React.useState(0);
  const [branchUser, setBranchUser] = React.useState(null);

  // Device detection for responsive layout
  const { isMobile } = useDeviceDetection();

  const SALES_URL = window.ENV_CONFIG?.SALES_API_URL || 'http://127.0.0.1:9000';

  const decodeJwt = (tk) => {
    try {
      const base64 = tk.split('.')[1];
      const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(json);
    } catch { return null; }
  };

  const login = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(SALES_URL + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Login failed');
      if (!data.token) throw new Error('No token returned');
      
      // Ensure branch token is removed so only one token type exists in this browser
      try { localStorage.removeItem('branch_token'); } catch (e) {}
      localStorage.setItem('sales_token', data.token);
      setToken(data.token);
      setHasAccess(true);
      setBranchUser(null);
      try { window.dispatchEvent(new Event('sales-login')); } catch (__) {}
      
      const payload = data.payload || decodeJwt(data.token);
      if (payload?.mongoPlanId) setPlanId(payload.mongoPlanId);
      if (Number.isFinite(payload?.branchLimit)) setBranchLimit(payload.branchLimit);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkAccess = async (tk = token) => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(SALES_URL + '/auth/verify', { headers: { Authorization: 'Bearer ' + tk } });
      const data = await res.json();
      if (!res.ok || !data.valid) throw new Error(data.message || 'Token invalid');
      setHasAccess(true);
      if (data.token) {
        localStorage.setItem('sales_token', data.token);
        setToken(data.token);
      }
      const decoded = data.decoded || data.payload || decodeJwt(data.token || tk);
      if (decoded?.mongoPlanId) setPlanId(decoded.mongoPlanId);
      if (Number.isFinite(decoded?.branchLimit)) setBranchLimit(decoded.branchLimit);
    } catch (err) {
      setError(err.message);
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (localStorage.getItem('token') && !localStorage.getItem('sales_token')) {
      localStorage.removeItem('token');
    }
    if (token && hasAccess === null) checkAccess(token);

    const onHash = () => setView((location.hash || '#bank').slice(1));
    window.addEventListener('hashchange', onHash);

    // Handle branch-login events dispatched from BranchLogin so same-tab updates work
    const onBranchLoginEvent = () => {
      const bt = localStorage.getItem('branch_token');
      if (bt) {
        const d = decodeJwt(bt);
        setBranchUser(d || null);
        // Ensure sales token isn't used
        setToken('');
        setHasAccess(false);
        try { location.hash = '#branch'; } catch (_) {}
      }
    };
    window.addEventListener('branch-login', onBranchLoginEvent);

    const onSalesLoginEvent = () => {
      // sales login happened elsewhere in-app/tab: clear branchUser
      setBranchUser(null);
    };
    window.addEventListener('sales-login', onSalesLoginEvent);

    // update branchUser state when branch_token changes elsewhere
    const syncBranchUser = () => {
      const bt = localStorage.getItem('branch_token');
      if (bt) {
        const d = decodeJwt(bt);
        setBranchUser(d || null);
      } else setBranchUser(null);
    };
    syncBranchUser();
    window.addEventListener('storage', syncBranchUser);

    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('storage', syncBranchUser);
      window.removeEventListener('branch-login', onBranchLoginEvent);
      window.removeEventListener('sales-login', onSalesLoginEvent);
    };
  }, []);

  if (loading && hasAccess === null) return <div>Loading…</div>;
  // If we're a branch user, render the app immediately (use branch_token as effective token)
  const effectiveToken = branchUser ? (localStorage.getItem('branch_token') || '') : token;

  // If we're not a branch user and we don't have a valid sales token, show auth screens
  if (!branchUser && ((!token) || hasAccess === false)) {
    // Allow visiting public branch-login route even without sales token
    if ((location.hash || '#bank').slice(1) === 'branch-login') {
      if (isMobile) {
        return (
          <MobileLayout
            title="Branch Dashboard"
            subtitle=""
            user={null}
            onLogout={() => {}}
            active="branch-login"
            onSelect={() => {}}
            planId=""
            branchLimit={0}
            branchUser={null}
          >
            <BranchLogin salesUrl={SALES_URL} />
          </MobileLayout>
        );
      }
      return <div className="app"><HeaderBar title="Branch Dashboard" subtitle="" /><div className="content"><BranchLogin salesUrl={SALES_URL} /></div></div>;
    }

    // No sales token and not a branch user -> show sales login
    if (isMobile) {
      return (
        <MobileAuth 
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          onLogin={login}
          onVerifyToken={() => checkAccess()}
          loading={loading}
          error={error}
          token={token}
        />
      );
    }

    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">🚀</div>
            <h2 className="auth-title">Welcome Back</h2>
            <p className="auth-subtitle">Sign in to your SalesPro account</p>
          </div>
          
          <form onSubmit={login} className="auth-form">
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                type="email" 
                className="form-input"
                placeholder="Enter your email"
                required 
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Password</label>
              <input 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                type="password" 
                className="form-input"
                placeholder="Enter your password"
                required 
              />
            </div>
            
            <button className="btn btn-primary w-full" disabled={loading} type="submit">
              {loading ? (
                <span className="loading">
                  <span className="spinner"></span>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
            
            {token && (
              <button 
                className="btn btn-outline w-full" 
                onClick={(e) => { e.preventDefault(); checkAccess(); }}
                type="button"
              >
                Verify Existing Token
              </button>
            )}
          </form>
          
          {error && (
            <div className="alert alert-danger">
              <div className="alert-icon">❌</div>
              <div>{error}</div>
            </div>
          )}
          
          <div className="auth-footer">
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              Need a branch account? <a href="#branch-login" className="auth-link">Sign in as Branch</a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const logout = () => {
    localStorage.removeItem('sales_token');
    localStorage.removeItem('branch_token');
    setToken('');
    setBranchUser(null);
    setHasAccess(false);
    location.hash = '#bank';
  };

  const branchLogout = () => {
    // Only remove branch token, keep sales token for admin
    localStorage.removeItem('branch_token');
    setBranchUser(null);
    // Restore admin access by checking existing sales token
    const salesToken = localStorage.getItem('sales_token');
    if (salesToken) {
      setToken(salesToken);
      checkAccess(salesToken);
      // Trigger feature reload for admin account
      try { 
        window.dispatchEvent(new Event('sales-login')); 
      } catch (e) {
        console.log('Event dispatch failed:', e);
      }
    }
    location.hash = '#bank';
  };

  // Helper function to get page title
  const getTitle = () => {
    if (branchUser) return 'Branch Dashboard';
    switch (view) {
      case 'bank': return 'Payment Methods';
      case 'bank-history': return 'Payment History';
      case 'supplier': return 'Supplier Management';
      case 'branch': return 'Branch Management';
      case 'whatsapp-contact': return 'WhatsApp Contacts';
      case 'whatsapp-stock': return 'WhatsApp Inventory';
      case 'product-sales': return 'Point of Sale';
      case 'sales-track': return 'Sales Analytics';
      case 'branch-expense': return 'Expenses';
      case 'seconds-sales': return 'Quick Sales';
      case 'offer': return 'Promotions';
      default: return 'Master Inventory';
    }
  };

  // Helper function to get page subtitle
  const getSubtitle = () => {
    if (branchUser) return 'Manage your branch operations and sales';
    switch (view) {
      case 'bank': return 'Set up payment methods for your business';
      case 'bank-history': return 'View all payment transactions and balances';
      case 'supplier': return 'Manage your suppliers and vendors';
      case 'branch': return 'Create and manage branch locations';
      case 'whatsapp-contact': return 'Manage WhatsApp customer contacts';
      case 'whatsapp-stock': return 'Track WhatsApp-specific inventory';
      case 'product-sales': return 'Process customer sales and transactions';
      case 'sales-track': return 'Monitor sales performance and trends';
      case 'branch-expense': return 'Record branch expenses and costs';
      case 'seconds-sales': return 'Quick sale processing for busy periods';
      case 'offer': return 'Create and manage promotional offers';
      default: return 'Track and manage your complete inventory';
    }
  };

  // Main content component
  const MainContent = () => {
    // Show mobile dashboard only on default view when on mobile
    if (isMobile && view === 'bank') {
      return (
        <MobileDashboard 
          branchUser={branchUser} 
          onNavigate={(actionId) => {
            setView(actionId);
            try { location.hash = '#' + actionId; } catch {} 
          }} 
        />
      );
    }

    return (
      <>
        {branchUser ? (
          // branch-specific welcome screen as the first nav item
          view === 'branch-welcome' || view === '' || view === 'branch' ? (
            <div className="card"><h3>Welcome</h3><p>Welcome, {branchUser.name || 'Branch User'}!</p></div>
          ) : null
        ) : null}

        {view === 'bank' ? (
          <CreateBank salesUrl={SALES_URL} token={effectiveToken} />
        ) : view === 'bank-history' ? (
          window.BankHistory ? React.createElement(window.BankHistory, { 
            salesUrl: SALES_URL, 
            token: effectiveToken 
          }) : React.createElement('div', { style: { padding: '20px' } }, 'Loading Payment History...')
        ) : (!branchUser && view === 'gst-calculator') ? (
          (window.GstCalculatorView ? React.createElement(window.GstCalculatorView) : (
            <div className="card"><div className="empty-state"><div className="empty-icon">🧮</div><div className="empty-title">Loading…</div></div></div>
          ))
        ) : (view === 'supplier') ? (
          <CreateSupplier salesUrl={SALES_URL} token={effectiveToken} />
        ) : (!branchUser && view === 'branch') ? (
          (planId === 'sales-gold' || planId === 'sales-premium') ? (
            <CreateBranch salesUrl={SALES_URL} token={effectiveToken} planId={planId} branchLimit={branchLimit} />
          ) : (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">🔒</div>
                <div className="empty-title">Upgrade Required</div>
                <div className="empty-sub">Branch management is available on Sales Gold and Premium plans.</div>
              </div>
            </div>
          )
        ) : view === 'branch-login' ? (
          <BranchLogin salesUrl={SALES_URL} />
        ) : view === 'branch-supply' ? (
          <BranchSupply salesUrl={SALES_URL} token={effectiveToken} />
        ) : (!branchUser && view === 'whatsapp-stock') ? (
          (window.WhatsappStock ? React.createElement(window.WhatsappStock, { salesUrl: SALES_URL, token: effectiveToken }) : (
            <div className="card"><div className="empty-state"><div className="empty-icon">📦💬</div><div className="empty-title">Loading…</div></div></div>
          ))
        ) : (!branchUser && view === 'whatsapp-contact') ? (
          (window.WhatsappContact ? React.createElement(window.WhatsappContact, { salesUrl: SALES_URL, token: effectiveToken }) : (
            <div className="card"><div className="empty-state"><div className="empty-icon">💬</div><div className="empty-title">Loading…</div></div></div>
          ))
        ) : (!branchUser && view === 'seconds-sales') ? (
          (window.SecondsSales ? React.createElement(window.SecondsSales, { salesUrl: SALES_URL, token: effectiveToken }) : (
            <div className="card"><div className="empty-state"><div className="empty-icon">📊</div><div className="empty-title">Loading…</div></div></div>
          ))
        ) : (branchUser && view === 'seconds-sales') ? (
          (window.SecondsSales ? React.createElement(window.SecondsSales, { salesUrl: SALES_URL, token: effectiveToken }) : (
            <div className="card"><div className="empty-state"><div className="empty-icon">📊</div><div className="empty-title">Loading…</div></div></div>
          ))
        ) : (branchUser && (view || '').startsWith('seconds-sales-view-')) ? (
          // extract id after prefix
          (() => {
            const id = (view || '').replace('seconds-sales-view-', '');
            return (window.SecondsSalesView ? React.createElement(window.SecondsSalesView, { salesUrl: SALES_URL, token: effectiveToken, id }) : (
              <div className="card"><div className="empty-state"><div className="empty-icon">📊</div><div className="empty-title">Loading…</div></div></div>
            ));
          })()
        ) : view === 'branch-supply-history' ? (
          (window.BranchSupplyHistory ? React.createElement(window.BranchSupplyHistory, { salesUrl: SALES_URL, token: effectiveToken }) : (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">📦</div>
                <div className="empty-title">Loading…</div>
                <div className="empty-sub">Branch Supply History component not loaded yet.</div>
              </div>
            </div>
          ))
        ) : view === 'stock-history' ? (
          (window.StockHistory ? React.createElement(window.StockHistory, { salesUrl: SALES_URL, token: effectiveToken, branchUser }) : (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">📚</div>
                <div className="empty-title">Loading…</div>
                <div className="empty-sub">Stock History component not loaded yet.</div>
              </div>
            </div>
          ))
        ) : view === 'branch-expense' ? (
          (window.BranchNewExpense ? React.createElement(window.BranchNewExpense, { salesUrl: SALES_URL, token: effectiveToken, branchUser }) : (
            <div className="card"><div className="empty-state"><div className="empty-icon">💸</div><div className="empty-title">Loading…</div></div></div>
          ))
        ) : view === 'sales-track' ? (
          (window.SalesTrack ? React.createElement(window.SalesTrack, { salesUrl: SALES_URL, token: effectiveToken }) : (
            <div className="card"><div className="empty-state"><div className="empty-icon">📊</div><div className="empty-title">Loading…</div></div></div>
          ))
        ) : view === 'product-sales' ? (
          (window.ProductSales ? React.createElement(window.ProductSales, { salesUrl: SALES_URL, token: effectiveToken }) : (
            <div className="card"><div className="empty-state"><div className="empty-icon">🛍️</div><div className="empty-title">Loading…</div></div></div>
          ))
        ) : (
          view === 'instock' && branchUser ? (
            <BranchInStock salesUrl={SALES_URL} token={effectiveToken} />
          ) : (
            <InStockView salesUrl={SALES_URL} token={effectiveToken} />
          )
        )}
      </>
    );
  };

  // Render mobile or desktop layout based on device detection
  if (isMobile) {
    return (
      <MobileLayout
        title={getTitle()}
        subtitle={getSubtitle()}
        user={{
          name: branchUser?.name || 'Admin',
          email: branchUser?.email || email,
          role: branchUser ? 'Branch Manager' : 'Administrator'
        }}
        onLogout={branchUser ? branchLogout : logout}
        active={view}
        onSelect={setView}
        planId={planId}
        branchLimit={branchLimit}
        branchUser={branchUser}
      >
        <MainContent />
      </MobileLayout>
    );
  }

  return (
    <div className="app">
      <Sidebar active={view} onSelect={setView} planId={planId} branchLimit={branchLimit} branchUser={branchUser} />
      <div className="main">
        <HeaderBar
          title={getTitle()}
          subtitle={getSubtitle()}
          user={{
            name: branchUser?.name || 'Admin',
            email: branchUser?.email || email,
            role: branchUser ? 'Branch Manager' : 'Administrator'
          }}
          onLogout={branchUser ? branchLogout : logout}
        />

        <div className="content">
          <MainContent />
        </div>
      </div>
    </div>
  );
}

// Modern CreateBranch component with enhanced UI
function CreateBranch({ salesUrl, token, planId, branchLimit = 0 }) {
  const [form, setForm] = React.useState({
    name: '', address: '', gstNo: '', phoneNumber: '', email: '', password: '', confirmPassword: ''
  });
  const [rows, setRows] = React.useState([]);
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

  React.useEffect(() => { loadBranches(); }, []);

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

const rootEl = document.getElementById('root');
const root = ReactDOM.createRoot(rootEl);

// Wrap App with SalesFeatureProvider
const AppWithFeatures = () => {
  return React.createElement(window.SalesFeatureProvider, {}, React.createElement(App));
};

root.render(React.createElement(AppWithFeatures));

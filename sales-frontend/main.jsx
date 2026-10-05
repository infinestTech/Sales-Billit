// Sidebar and HeaderBar are now loaded from src/components via index.html

// Owner-only screens that moved to the Shop Admin dashboard
const ADMIN_ONLY_VIEWS = new Set([
  'gst-calculator', 'branch-supply', 'branch-supply-history', 'supplier-credits',
  'branch-sales-report', 'whatsapp-stock', 'whatsapp-contact'
]);

// The owner/admin sales portal now lives in the Shop Admin dashboard of the main app;
// this app only serves branch staff.
function AdminMovedScreen() {
  const shopAdminUrl = window.ENV_CONFIG?.SHOP_ADMIN_URL || '';
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">🏪</div>
          <h2 className="auth-title">Sales Admin has moved</h2>
          <p className="auth-subtitle">
            Inventory, dealers, branches, supplies and expenses are now managed from the Shop Admin dashboard.
          </p>
        </div>

        <div className="auth-form">
          {shopAdminUrl ? (
            <a className="btn btn-primary w-full" href={shopAdminUrl}>Go to Shop Admin</a>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center' }}>
              Please sign in to the Shop Admin portal to manage your sales business.
            </p>
          )}
        </div>

        <div className="auth-footer">
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Branch staff? <a href="#branch-login" className="auth-link">Sign in as Branch</a>
          </p>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [view, setView] = React.useState((location.hash || '#instock').slice(1));
  const [branchUser, setBranchUser] = React.useState(null);
  // Kept for components that still accept plan props; branch sessions carry no plan info
  const planId = '';
  const branchLimit = 0;
  const email = '';

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

  React.useEffect(() => {
    // Owner sessions from the old admin portal are no longer used here
    try {
      localStorage.removeItem('sales_token');
      localStorage.removeItem('token');
    } catch (_) {}

    const onHash = () => setView((location.hash || '#instock').slice(1));
    window.addEventListener('hashchange', onHash);

    // Handle branch-login events dispatched from BranchLogin so same-tab updates work
    const onBranchLoginEvent = () => {
      const bt = localStorage.getItem('branch_token');
      if (bt) {
        const d = decodeJwt(bt);
        setBranchUser(d || null);
        try { location.hash = '#branch'; } catch (_) {}
      }
    };
    window.addEventListener('branch-login', onBranchLoginEvent);

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
    };
  }, []);

  const effectiveToken = branchUser ? (localStorage.getItem('branch_token') || '') : '';

  // Not signed in as a branch: only the branch login is available
  if (!branchUser) {
    if ((location.hash || '#instock').slice(1) === 'branch-login') {
      if (isMobile) {
        return window.MobileBranchLogin ? React.createElement(window.MobileBranchLogin, { salesUrl: SALES_URL }) : null;
      }
      return <BranchLogin salesUrl={SALES_URL} />;
    }
    return <AdminMovedScreen />;
  }

  const logout = () => {
    localStorage.removeItem('branch_token');
    setBranchUser(null);
    location.hash = '#branch-login';
  };
  const branchLogout = logout;

  // Helper function to get page title
  const getTitle = () => {
    if (branchUser) return 'Branch Dashboard';
    switch (view) {
      case 'supplier': return 'Supplier Management';
      case 'supplier-credits': return 'Supplier Credits';
      case 'branch': return 'Branch Management';
      case 'whatsapp-contact': return 'WhatsApp Contacts';
      case 'whatsapp-stock': return 'WhatsApp Inventory';
      case 'product-sales': return 'Point of Sale';
      case 'sales-track': return 'Sales Analytics';
      case 'branch-expense': return 'Expenses';
      case 'branch-sales-report': return 'Branch Sales Report';
      case 'seconds-sales': return 'Quick Sales';
      case 'offer': return 'Promotions';
      default: return 'Master Inventory';
    }
  };

  // Helper function to get page subtitle
  const getSubtitle = () => {
    if (branchUser) return 'Manage your branch operations and sales';
    switch (view) {
      case 'supplier': return 'Manage your suppliers and vendors';
      case 'supplier-credits': return 'Manage supplier credit accounts and balances';
      case 'branch': return 'Create and manage branch locations';
      case 'whatsapp-contact': return 'Manage WhatsApp customer contacts';
      case 'whatsapp-stock': return 'Track WhatsApp-specific inventory';
      case 'product-sales': return 'Process customer sales and transactions';
      case 'sales-track': return 'Monitor sales performance and trends';
      case 'branch-expense': return 'Record branch expenses and costs';
      case 'branch-sales-report': return 'View sales details across all branches';
      case 'seconds-sales': return 'Quick sale processing for busy periods';
      case 'offer': return 'Create and manage promotional offers';
      default: return 'Track and manage your complete inventory';
    }
  };

  // Main content component
  const MainContent = () => {
    // Show mobile dashboard only on default view when on mobile
    if (isMobile && view === 'instock') {
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

        {ADMIN_ONLY_VIEWS.has(view) ? (
          <div className="card"><div className="empty-state"><div className="empty-icon">🔒</div><div className="empty-title">Moved to Shop Admin</div><div className="empty-sub">This section is now managed by the owner from the Shop Admin dashboard.</div></div></div>
        ) : (view === 'supplier') ? (
          <CreateSupplier salesUrl={SALES_URL} token={effectiveToken} />
        ) : view === 'branch-login' ? (
          <BranchLogin salesUrl={SALES_URL} />
        ) : (view === 'seconds-sales') ? (
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

  // Render branch login as a standalone page even when already logged in,
  // to match the main login page behavior and avoid embedding it inside the app layout.
  if (view === 'branch-login') {
    if (isMobile) {
      return window.MobileBranchLogin ? React.createElement(window.MobileBranchLogin, { salesUrl: SALES_URL }) : null;
    }
    return <BranchLogin salesUrl={SALES_URL} />;
  }

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
        {React.createElement(window.MobileViewRenderer, {
          view: view,
          salesUrl: SALES_URL,
          token: effectiveToken,
          branchUser: branchUser,
          planId: planId,
          branchLimit: branchLimit
        })}
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
function CreateBranch({ salesUrl, token, planId, branchLimit: propBranchLimit = 0 }) {
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

const rootEl = document.getElementById('root');
const root = ReactDOM.createRoot(rootEl);

// Wrap App with SalesFeatureProvider
const AppWithFeatures = () => {
  return React.createElement(window.SalesFeatureProvider, {}, React.createElement(App));
};

root.render(React.createElement(AppWithFeatures));

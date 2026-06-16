function BranchLogin({ salesUrl }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');

  const submit = async (e) => {
    e && e.preventDefault();
    setLoading(true); setMessage('');
    try {
      const res = await fetch(salesUrl + '/auth/branch-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Login failed');
      // show welcome message
      setMessage(`Welcome, ${data.payload?.name || 'Branch user'}!`);
      // optionally store branch token
      // Remove any sales token to avoid both tokens co-existing in the same browser
      try { localStorage.removeItem('sales_token'); } catch (__) {}
      localStorage.setItem('branch_token', data.token);
      // Notify the app in the same tab that a branch login happened
      try { window.dispatchEvent(new Event('branch-login')); } catch (__) {}
      // Navigate to product sales (Point of Sale)
      try { location.hash = '#product-sales'; } catch (__) {}
    } catch (err) {
      setMessage(err.message || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">🏪</div>
          <h2 className="auth-title">Branch Login</h2>
          <p className="auth-subtitle">Sign in to your branch account</p>
        </div>
        
        <form onSubmit={submit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input 
              type="email" 
              className="form-input"
              placeholder="Enter your email"
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              type="password" 
              className="form-input"
              placeholder="Enter your password"
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
            />
          </div>
          
          <button className="btn btn-primary w-full" type="submit" disabled={loading}>
            {loading ? (
              <span className="loading">
                <span className="spinner"></span>
                Signing in...
              </span>
            ) : 'Sign In'}
          </button>
        </form>
        
        {message && (
          <div className={`alert ${message.includes('Welcome') ? 'alert-success' : 'alert-danger'}`}>
            <div className="alert-icon">
              {message.includes('Welcome') ? '✅' : '❌'}
            </div>
            <div>{message}</div>
          </div>
        )}
        
        <div className="auth-footer">
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Need help? Contact your administrator
          </p>
        </div>
      </div>
    </div>
  );
}
// Register as global for in-browser JSX loader
window.BranchLogin = BranchLogin;

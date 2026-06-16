function MobileBranchLogin({ salesUrl }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');

  const submit = async (e) => {
    e && e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const res = await fetch(salesUrl + '/auth/branch-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Login failed');

      setMessage(`Welcome, ${data.payload?.name || 'Branch user'}!`);

      // Ensure only one token type exists in this browser
      try { localStorage.removeItem('sales_token'); } catch (__) {}
      localStorage.setItem('branch_token', data.token);

      // Notify the app in the same tab that a branch login happened
      try { window.dispatchEvent(new Event('branch-login')); } catch (__) {}

      // Navigate to product sales (Point of Sale)
      try { location.hash = '#product-sales'; } catch (__) {}
    } catch (err) {
      setMessage(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-auth-container">
      <div className="mobile-auth-card">
        <div className="mobile-auth-header">
          <div className="mobile-auth-logo">🏪</div>
          <h2 className="mobile-auth-title">Branch Login</h2>
          <p className="mobile-auth-subtitle">Sign in to your branch account</p>
        </div>

        <form onSubmit={submit} className="mobile-auth-form">
          <div className="mobile-form-group">
            <label className="mobile-form-label">Email Address</label>
            <input
              type="email"
              className="mobile-form-input"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="mobile-form-group">
            <label className="mobile-form-label">Password</label>
            <input
              type="password"
              className="mobile-form-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button className="mobile-btn mobile-btn-primary" type="submit" disabled={loading}>
            {loading ? (
              <span className="mobile-loading">
                <span className="mobile-spinner"></span>
                Signing in...
              </span>
            ) : 'Sign In'}
          </button>
        </form>

        {message && (
          <div className={`mobile-alert ${message.includes('Welcome') ? 'mobile-alert-success' : 'mobile-alert-danger'}`}>
            <div className="mobile-alert-icon">{message.includes('Welcome') ? '✅' : '❌'}</div>
            <div>{message}</div>
          </div>
        )}

        <div className="mobile-auth-footer">
          <p className="mobile-auth-footer-text">Need help? Contact your administrator</p>
        </div>
      </div>
    </div>
  );
}

window.MobileBranchLogin = MobileBranchLogin;

function MobileAuth({ 
  email, 
  setEmail, 
  password, 
  setPassword, 
  onLogin, 
  onVerifyToken,
  loading, 
  error, 
  token 
}) {
  return (
    <div className="mobile-auth-container">
      <div className="mobile-auth-card">
        <div className="mobile-auth-header">
          <div className="mobile-auth-logo">🚀</div>
          <h2 className="mobile-auth-title">Welcome Back</h2>
          <p className="mobile-auth-subtitle">Sign in to your SalesPro account</p>
        </div>
        
        <form onSubmit={onLogin} className="mobile-auth-form">
          <div className="mobile-form-group">
            <label className="mobile-form-label">Email Address</label>
            <input 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              type="email" 
              className="mobile-form-input"
              placeholder="Enter your email"
              required 
            />
          </div>
          
          <div className="mobile-form-group">
            <label className="mobile-form-label">Password</label>
            <input 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              type="password" 
              className="mobile-form-input"
              placeholder="Enter your password"
              required 
            />
          </div>
          
          <button className="mobile-btn mobile-btn-primary" disabled={loading} type="submit">
            {loading ? (
              <span className="mobile-loading">
                <span className="mobile-spinner"></span>
                Signing in...
              </span>
            ) : 'Sign In'}
          </button>
          
          {token && (
            <button 
              className="mobile-btn mobile-btn-outline" 
              onClick={(e) => { e.preventDefault(); onVerifyToken(); }}
              type="button"
            >
              Verify Existing Token
            </button>
          )}
        </form>
        
        {error && (
          <div className="mobile-alert mobile-alert-danger">
            <div className="mobile-alert-icon">❌</div>
            <div>{error}</div>
          </div>
        )}
        
        <div className="mobile-auth-footer">
          <p className="mobile-auth-footer-text">
            Need a branch account? <a href="#branch-login" className="mobile-auth-link">Sign in as Branch</a>
          </p>
        </div>
      </div>
    </div>
  );
}

// Register globally for the in-browser JSX loader
window.MobileAuth = MobileAuth;

function MobileHeader({ title, subtitle, user, onLogout, onMenuToggle, isMenuOpen }) {
  return (
    <header className="mobile-header">
      <div className="mobile-header-left">
        <button 
          className={`mobile-menu-toggle ${isMenuOpen ? 'active' : ''}`}
          onClick={onMenuToggle}
          aria-label="Toggle menu"
        >
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
        </button>
        <div className="mobile-header-content">
          <h1 className="mobile-title">{title}</h1>
          {subtitle && <div className="mobile-subtitle">{subtitle}</div>}
        </div>
      </div>
      
      <div className="mobile-header-right">
        {user && (
          <React.Fragment>
            <div className="mobile-user-avatar" title={user.name || user.email}>
              {user.name ? user.name.charAt(0).toUpperCase() : user.email ? user.email.charAt(0).toUpperCase() : 'U'}
            </div>
            {onLogout && (
              <button 
                onClick={onLogout}
                className="mobile-logout-btn"
                title="Logout"
                aria-label="Logout"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </button>
            )}
          </React.Fragment>
        )}
      </div>
    </header>
  );
}

// Register globally for the in-browser JSX loader
window.MobileHeader = MobileHeader;

function HeaderBar({ title, subtitle, user, onLogout }) {
  const [currentTime, setCurrentTime] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <header className="header">
      <div className="header-left">
        <div className="header-title-wrapper">
          <h1>{title}</h1>
          {subtitle ? <div className="subtitle">{subtitle}</div> : null}
        </div>
      </div>
      <div className="header-right">
        <div className="header-time">
          <span className="time-icon">🕐</span>
          <span className="time-text">{formatTime(currentTime)}</span>
        </div>
        {user && (
          <div className="user-menu-wrapper">
            <div className="user-menu">
              <div className="user-avatar">
                <span className="avatar-text">
                  {user.name ? user.name.charAt(0).toUpperCase() : user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                </span>
              </div>
              <div className="user-info">
                <div className="user-name">
                  {user.name || user.email || 'User'}
                </div>
                <div className="user-role">
                  {user.role || 'Admin'}
                </div>
              </div>
            </div>
            {onLogout && (
              <button 
                onClick={onLogout}
                className="logout-btn"
                title="Logout"
                aria-label="Logout"
              >
                <span className="logout-text">Logout</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

// Register globally for the in-browser JSX loader
window.HeaderBar = HeaderBar;

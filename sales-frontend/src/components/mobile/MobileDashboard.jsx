function MobileDashboard({ branchUser, onNavigate }) {
  // Static demo data (using same pattern as desktop components)
  const stats = branchUser ? [
    { label: 'Today\'s Sales', value: '₹12,450', change: '+8.2%', positive: true },
    { label: 'Stock Items', value: '245', change: '-3 items', positive: false },
    { label: 'Customers', value: '34', change: '+5 new', positive: true }
  ] : [
    { label: 'Total Branches', value: '8', change: '+2 this month', positive: true },
    { label: 'Total Revenue', value: '₹1,24,500', change: '+15.2%', positive: true },
    { label: 'Active Suppliers', value: '12', change: '2 new', positive: true }
  ];

  return (
    <div className="mobile-dashboard">
      {/* Welcome Section */}
      <div className="mobile-welcome-section">
        <div className="mobile-welcome-text">
          <h2 className="mobile-welcome-title">
            {branchUser ? `Welcome back, ${branchUser.name || 'Manager'}!` : 'Welcome to SalesPro'}
          </h2>
          <p className="mobile-welcome-subtitle">
            {branchUser ? 'Here\'s your branch overview for today' : 'Your business overview at a glance'}
          </p>
        </div>
        <div className="mobile-welcome-icon">
          {branchUser ? '🏪' : '📊'}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mobile-stats-grid">
        {stats.map((stat, index) => (
          <div key={index} className="mobile-stat-card">
            <div className="mobile-stat-value">{stat.value}</div>
            <div className="mobile-stat-label">{stat.label}</div>
            <div className={`mobile-stat-change ${stat.positive ? 'positive' : 'negative'}`}>
              <span className="mobile-stat-change-icon">
                {stat.positive ? '↗️' : '↘️'}
              </span>
              <span>{stat.change}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <MobileQuickActions 
        branchUser={branchUser} 
        onActionSelect={onNavigate} 
      />

      {/* Recent Activity - Static demo data */}
      <div className="mobile-recent-activity">
        <div className="mobile-section-header">
          <h3 className="mobile-section-title">Recent Activity</h3>
          <button 
            className="mobile-section-action"
            onClick={() => onNavigate && onNavigate('sales-track')}
          >
            View All
          </button>
        </div>
        <div className="mobile-activity-list">
          {[
            { icon: '🛒', title: 'New sale recorded', time: '2 min ago', amount: '₹2,450' },
            { icon: '📦', title: 'Stock updated', time: '15 min ago', amount: '45 items' },
            { icon: '👤', title: 'New customer added', time: '1 hour ago', amount: 'John Doe' }
          ].map((activity, index) => (
            <div key={index} className="mobile-activity-item">
              <div className="mobile-activity-icon">{activity.icon}</div>
              <div className="mobile-activity-content">
                <div className="mobile-activity-title">{activity.title}</div>
                <div className="mobile-activity-time">{activity.time}</div>
              </div>
              <div className="mobile-activity-amount">{activity.amount}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Register globally for the in-browser JSX loader
window.MobileDashboard = MobileDashboard;

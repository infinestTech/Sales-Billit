function MobileLayout({ children, title, subtitle, user, onLogout, active, onSelect, planId, branchLimit, branchUser }) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  const handleMenuToggle = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleSidebarClose = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div className={`mobile-app ${isSidebarOpen ? 'sidebar-open' : ''}`}>
      <MobileHeader 
        title={title}
        subtitle={subtitle}
        user={user}
        onLogout={onLogout}
        onMenuToggle={handleMenuToggle}
        isMenuOpen={isSidebarOpen}
      />
      
      <MobileSidebar 
        active={active}
        onSelect={onSelect}
        planId={planId}
        branchLimit={branchLimit}
        branchUser={branchUser}
        isOpen={isSidebarOpen}
        onClose={handleSidebarClose}
      />
      
      <main className="mobile-main">
        <div className="mobile-content">
          {children}
        </div>
      </main>
    </div>
  );
}

// Register globally for the in-browser JSX loader
window.MobileLayout = MobileLayout;

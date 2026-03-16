function MobileSidebar({ active = 'instock', onSelect, planId, branchLimit, branchUser, isOpen, onClose }) {

  const MobileNavItem = ({ id, label, icon = '📋', activeId, onClick, description }) => (
    <a
      className={`mobile-nav-item ${activeId === id ? 'active' : ''}`}
      href={"#" + id}
      onClick={(e) => { 
        e.preventDefault(); 
        onClick?.(id); 
        onClose?.(); // Close sidebar after navigation
        try { location.hash = '#' + id; } catch {} 
      }}
    >
      <div className="mobile-nav-item-icon">
        <span className="mobile-icon">{icon}</span>
      </div>
      <div className="mobile-nav-item-content">
        <span className="mobile-nav-item-label">{label}</span>
        {description && <span className="mobile-nav-item-desc">{description}</span>}
      </div>
      <div className="mobile-nav-item-arrow">
        <span>›</span>
      </div>
    </a>
  );

  // Determine if this is a branch user
  const isBranch = !!branchUser;

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose?.();
    }
  };

  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose?.();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // Prevent background scroll
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`mobile-sidebar-backdrop ${isOpen ? 'open' : ''}`}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />
      
      {/* Sidebar */}
      <aside className={`mobile-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="mobile-sidebar-header">
          <MobileNav />
          <button 
            className="mobile-sidebar-close"
            onClick={onClose}
            aria-label="Close menu"
          >
            <span>✕</span>
          </button>
        </div>
        
        <nav className="mobile-nav">
          {isBranch ? (
            // Branch users see a minimal branch nav
            <>
              <div className="mobile-nav-section">
                <div className="mobile-nav-section-title">
                  <span className="section-icon">💰</span>
                  Financial
                </div>
                <MobileNavItem 
                  id="branch-expense" 
                  label="Expenses" 
                  icon="💸" 
                  description="Record branch expenses"
                  activeId={active} 
                  onClick={onSelect} 
                />
              </div>

              <div className="mobile-nav-section">
                <div className="mobile-nav-section-title">
                  <span className="section-icon">📦</span>
                  Inventory
                </div>
                <MobileNavItem 
                  id="supplier" 
                  label="Dealers" 
                  icon="🏢" 
                  description="Manage suppliers"
                  activeId={active} 
                  onClick={onSelect}
                />
                <MobileNavItem 
                  id="instock" 
                  label="Product Inventory" 
                  icon="📦" 
                  description="Track stock levels"
                  activeId={active} 
                  onClick={onSelect} 
                />
                <MobileNavItem 
                  id="stock-history" 
                  label="Stock History" 
                  icon="📚" 
                  description="View stock movements"
                  activeId={active} 
                  onClick={onSelect} 
                />
              </div>

              <div className="mobile-nav-section">
                <div className="mobile-nav-section-title">
                  <span className="section-icon">📈</span>
                  Sales
                </div>
                <MobileNavItem 
                  id="product-sales" 
                  label="Product Sales" 
                  icon="🛒" 
                  description="Process customer sales"
                  activeId={active} 
                  onClick={onSelect} 
                />
                <MobileNavItem 
                  id="seconds-sales" 
                  label="Seconds Mobile Sales" 
                  icon="⚡" 
                  description="Fast checkout process"
                  activeId={active} 
                  onClick={onSelect} 
                />
                <MobileNavItem 
                  id="sales-track" 
                  label="Sales Analytics" 
                  icon="📈" 
                  description="Monitor performance"
                  activeId={active} 
                  onClick={onSelect} 
                />
              </div>
            </>
          ) : (
            // Admin / seller view
            <>
              <div className="mobile-nav-section">
                <div className="mobile-nav-section-title">
                  <span className="section-icon">💰</span>
                  Financial Management
                </div>
                <MobileNavItem 
                  id="branch-expense" 
                  label="Expenses" 
                  icon="💸" 
                  description="Track all expenses"
                  activeId={active} 
                  onClick={onSelect} 
                />
                <MobileNavItem 
                  id="gst-calculator" 
                  label="GST Calculator" 
                  icon="🧮" 
                  description="Calculate GST amounts"
                  activeId={active} 
                  onClick={onSelect}
                />
              </div>

              <div className="mobile-nav-section">
                <div className="mobile-nav-section-title">
                  <span className="section-icon">📦</span>
                  Inventory Management
                </div>
                <MobileNavItem 
                  id="supplier" 
                  label="Dealers" 
                  icon="🏢" 
                  description="Manage vendors"
                  activeId={active} 
                  onClick={onSelect} 
                />
                <MobileNavItem 
                  id="instock" 
                  label="Product Inventory" 
                  icon="📦" 
                  description="Central stock management"
                  activeId={active} 
                  onClick={onSelect} 
                />
                <MobileNavItem 
                  id="stock-history" 
                  label="Stock History" 
                  icon="📚" 
                  description="View stock records"
                  activeId={active} 
                  onClick={onSelect} 
                />
                <MobileNavItem 
                  id="supplier-credits" 
                  label="Supplier Credits" 
                  icon="💳" 
                  description="Manage credit accounts"
                  activeId={active} 
                  onClick={onSelect} 
                />
              </div>

              <div className="mobile-nav-section">
                <div className="mobile-nav-section-title">
                  <span className="section-icon">🏪</span>
                  Branch Operations
                </div>
                <MobileNavItem
                  id="branch"
                  label="Branch Management"
                  icon="🏪"
                  description="Manage locations"
                  activeId={active} 
                  onClick={onSelect}
                />
                <MobileNavItem 
                  id="branch-supply" 
                  label="Branch Supply" 
                  icon="🚚" 
                  description="Supply branches"
                  activeId={active} 
                  onClick={onSelect} 
                />
                <MobileNavItem 
                  id="branch-supply-history" 
                  label="Supply History" 
                  icon="📋" 
                  description="Track supplies"
                  activeId={active} 
                  onClick={onSelect} 
                />
                <MobileNavItem 
                  id="branch-sales-report" 
                  label="Branch Sales" 
                  icon="📊" 
                  description="View branch sales"
                  activeId={active} 
                  onClick={onSelect} 
                />
              </div>
            </>
          )}
          
          <div className="mobile-nav-footer">
            <div className="mobile-plan-info">
              <div className="mobile-plan-badge">
                <span className="mobile-plan-icon">⭐</span>
                <span className="mobile-plan-text">
                  {planId === 'sales-premium' ? 'Premium Plan' : 'Basic Plan'}
                </span>
              </div>
              {!isBranch && (
                <div className="mobile-branch-limit">
                  <span className="mobile-limit-text">
                    Branches: {branchLimit === 0 ? '0' : branchLimit || 'Unlimited'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </nav>
      </aside>
    </>
  );
}

// Register globally for the in-browser JSX loader
window.MobileSidebar = MobileSidebar;

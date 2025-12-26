function MobileSidebar({ active = 'bank', onSelect, planId, branchLimit, branchUser, isOpen, onClose }) {
  // Use sales features context
  const { features, isFeatureEnabled, getFeatureLimit } = window.useSalesFeatures ? window.useSalesFeatures() : { 
    features: {}, 
    isFeatureEnabled: () => true, 
    getFeatureLimit: () => 999 
  };

  const MobileNavItem = ({ id, label, icon = '📋', locked = false, activeId, onClick, description, onLockedClick }) => (
    <a
      className={`mobile-nav-item ${activeId === id ? 'active' : ''} ${locked ? 'locked' : ''}`}
      href={"#" + id}
      onClick={(e) => { 
        e.preventDefault(); 
        if (locked) {
          if (onLockedClick) onLockedClick();
          return;
        }
        onClick?.(id); 
        onClose?.(); // Close sidebar after navigation
        try { location.hash = '#' + id; } catch {} 
      }}
    >
      <div className="mobile-nav-item-icon">
        <span className="mobile-icon">{icon}</span>
        {locked && <span className="mobile-lock">🔒</span>}
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

  // Determine if this is a branch user early so feature checks can use it
  const isBranch = !!branchUser;

  // Feature access checks with better fallback logic
  const isBankEnabled = isFeatureEnabled('bank_accounts_enabled') || (planId === 'sales-gold' || planId === 'sales-premium' || planId === 'sales-basic');
  const isSupplierEnabled = isFeatureEnabled('suppliers_enabled') || isBranch || (planId === 'sales-basic' || planId === 'sales-gold' || planId === 'sales-premium');
  const isGstEnabled = isFeatureEnabled('gst_calculator_enabled') || (planId === 'sales-gold' || planId === 'sales-premium');
  const isPaymentHistoryEnabled = isFeatureEnabled('payment_history_enabled') || (planId === 'sales-gold' || planId === 'sales-premium');
  const isSupplyHistoryEnabled = isFeatureEnabled('supply_history_enabled') || (planId === 'sales-premium');
  const isBranchEnabled = isFeatureEnabled('branch_management_enabled') || (planId === 'sales-gold' || planId === 'sales-premium');
  const canUseBranch = isBranchEnabled || planId === 'sales-gold' || planId === 'sales-premium';

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
                  id="bank" 
                  label="Bank Accounts" 
                  icon="💳" 
                  description="Manage payment methods"
                  activeId={active} 
                  onClick={onSelect}
                  locked={!isBankEnabled}
                  onLockedClick={() => window.checkSalesFeatureAccess('bank_accounts_enabled', 'Bank Account Management', features, 'Basic/Gold/Premium')}
                />
                <MobileNavItem 
                  id="bank-history" 
                  label="Transaction History" 
                  icon="📊" 
                  description="View transaction records"
                  activeId={active} 
                  onClick={onSelect}
                  locked={!isPaymentHistoryEnabled}
                  onLockedClick={() => window.checkSalesFeatureAccess('payment_history_enabled', 'Payment History', features, 'Gold/Premium')}
                />
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
                  locked={!isSupplierEnabled}
                  onLockedClick={() => window.checkSalesFeatureAccess('suppliers_enabled', 'Supplier Management', features, 'Basic/Gold/Premium')}
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
                  id="bank" 
                  label="Bank Accounts" 
                  icon="💳" 
                  description="Set up payment options"
                  activeId={active} 
                  onClick={onSelect}
                  locked={!isBankEnabled}
                  onLockedClick={() => window.checkSalesFeatureAccess('bank_accounts_enabled', 'Bank Account Management', features, 'Basic/Gold/Premium')}
                />
                <MobileNavItem 
                  id="bank-history" 
                  label="Transaction History" 
                  icon="📊" 
                  description="View all transactions"
                  activeId={active} 
                  onClick={onSelect}
                  locked={!isPaymentHistoryEnabled}
                  onLockedClick={() => window.checkSalesFeatureAccess('payment_history_enabled', 'Payment History', features, 'Gold/Premium')}
                />
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
                  locked={!isGstEnabled}
                  onLockedClick={() => window.checkSalesFeatureAccess('gst_calculator_enabled', 'GST Calculator', features, 'Gold/Premium')}
                />
              </div>

              <div className="mobile-nav-section">
                <div className="mobile-nav-section-title">
                  <span className="section-icon">📦</span>
                  Inventory Management
                </div>
                <MobileNavItem 
                  locked={!isSupplierEnabled}
                  onLockedClick={() => window.checkSalesFeatureAccess('suppliers_enabled', 'Supplier Management', features, 'Basic/Gold/Premium')}
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
                  description={canUseBranch ? "Manage locations" : "Upgrade to unlock"}
                  locked={!canUseBranch}
                  onLockedClick={() => window.checkSalesFeatureAccess('branch_management_enabled', 'Branch Management', features, 'Basic/Gold/Premium')}
                />
                <MobileNavItem 
                  id="branch-supply" 
                  label="Branch Supply" 
                  icon="🚚" 
                  description={canUseBranch ? "Supply branches" : "Upgrade required"}
                  activeId={active} 
                  onClick={onSelect} 
                  locked={!canUseBranch}
                  onLockedClick={() => window.checkSalesFeatureAccess('branch_management_enabled', 'Branch Supply', features, 'Basic/Gold/Premium')}
                />
                <MobileNavItem 
                  id="branch-supply-history" 
                  label="Supply History" 
                  icon="📋" 
                  description={canUseBranch ? "Track supplies" : "Upgrade required"}
                  activeId={active} 
                  onClick={onSelect} 
                  locked={!isSupplyHistoryEnabled}
                  onLockedClick={() => window.checkSalesFeatureAccess('supply_history_enabled', 'Supply History', features, 'Premium')}
                  onClick={onSelect} 
                  locked={!canUseBranch} 
                />
              </div>
            </>
          )}
          
          <div className="mobile-nav-footer">
            <div className="mobile-plan-info">
              <div className="mobile-plan-badge">
                <span className="mobile-plan-icon">⭐</span>
                <span className="mobile-plan-text">
                  {planId === 'sales-premium' ? 'Premium Plan' : 
                   planId === 'sales-gold' ? 'Gold Plan' : 'Basic Plan'}
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

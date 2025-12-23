function Sidebar({ active = 'bank', onSelect, planId, branchLimit, branchUser }) {
  // Use sales features context
  const { features, isFeatureEnabled, getFeatureLimit } = window.useSalesFeatures ? window.useSalesFeatures() : { features: {}, isFeatureEnabled: () => true, getFeatureLimit: () => 999 };
  
  const Item = ({ id, label, icon = '📋', locked = false, activeId, onClick, onLockedClick }) => (
    <a
      className={'nav-item ' + (activeId === id ? 'active' : '')}
      href={"#" + id}
      onClick={(e) => {
        e.preventDefault();
        if (locked) {
          if (onLockedClick) onLockedClick();
          return;
        }
        onClick?.(id);
        try { location.hash = '#' + id; } catch {}
      }}
    >
      <span className="icon">{icon}</span>
      <span>{label}</span>
      {locked ? <span className="lock">🔒</span> : null}
    </a>
  );

  const SectionTitle = ({ title, icon }) => (
    <div className="nav-section-title">
      {icon && <span className="section-icon">{icon}</span>}
      <span>{title}</span>
    </div>
  );

  // Determine if this is a branch user early so feature checks can use it
  const isBranch = !!branchUser;

  // Feature access checks with better fallback logic for Gold plan
  const isBankEnabled = isFeatureEnabled('bank_accounts_enabled') || (planId === 'sales-gold' || planId === 'sales-premium' || planId === 'sales-basic');
  // Allow branch users to access suppliers/dealers even if the feature flag is not enabled
  const isSupplierEnabled = isFeatureEnabled('suppliers_enabled') || isBranch || (planId === 'sales-basic' || planId === 'sales-gold' || planId === 'sales-premium');
  const isGstEnabled = isFeatureEnabled('gst_calculator_enabled') || (planId === 'sales-gold' || planId === 'sales-premium');
  const isPaymentHistoryEnabled = isFeatureEnabled('payment_history_enabled') || (planId === 'sales-gold' || planId === 'sales-premium');
  const isSupplyHistoryEnabled = isFeatureEnabled('supply_history_enabled') || (planId === 'sales-premium');
  const isBranchEnabled = isFeatureEnabled('branch_management_enabled') || (planId === 'sales-basic' || planId === 'sales-gold' || planId === 'sales-premium');
  // Legacy fallback for existing planId checks
  const canUseBranch = isBranchEnabled || planId === 'sales-gold' || planId === 'sales-premium';
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">💎</div>
        <div className="brand-info">
          <h1>Fixel</h1>
          <p>Sales Management Pro</p>
        </div>
      </div>
      <nav className="nav">
        {isBranch ? (
          // Branch users see a minimal branch nav
          <>
            <SectionTitle title="Financial" icon="💰" />
            <Item id="bank" label="Bank Accounts" icon={"💳"} activeId={active} onClick={onSelect} />
            <Item id="bank-history" label="Transaction History" icon={"📊"} activeId={active} onClick={onSelect} />
            <Item id="branch-expense" label="Expenses" icon={"💸"} activeId={active} onClick={onSelect} />

            <SectionTitle title="Inventory" icon="📦" />
            <Item
              id="supplier"
              label="Dealers"
              icon={"🏢"}
              activeId={active}
              onClick={onSelect}
              locked={!isSupplierEnabled}
              onLockedClick={() => window.checkSalesFeatureAccess('suppliers_enabled', 'Supplier Management', features, 'Basic/Gold/Premium')}
            />
            <Item id="instock" label="Product Inventory" icon={"📦"} activeId={active} onClick={onSelect} />
            <Item id="stock-history" label="Stock History" icon={"📚"} activeId={active} onClick={onSelect} />

            <SectionTitle title="Sales" icon="📈" />
            <Item id="product-sales" label="Product Sales" icon={"🛒"} activeId={active} onClick={onSelect} />
            <Item id="seconds-sales" label="Seconds Mobile Sales" icon={"⚡"} activeId={active} onClick={onSelect} />
            <Item id="sales-track" label="Sales Analytics" icon={"📈"} activeId={active} onClick={onSelect} />
          </>
        ) : (
          // Admin / seller view
          <>
            <SectionTitle title="Financial Management" icon="💰" />
            <Item
              id="bank"
              label="Bank Accounts"
              icon={"💳"}
              activeId={active}
              onClick={onSelect}
              locked={!isBankEnabled}
              onLockedClick={() => window.checkSalesFeatureAccess('bank_accounts_enabled', 'Bank Account Management', features, 'Basic/Gold/Premium')}
            />
            <Item
              id="bank-history"
              label="Transaction History"
              icon={"📊"}
              activeId={active}
              onClick={onSelect}
              locked={!isPaymentHistoryEnabled}
              onLockedClick={() => window.checkSalesFeatureAccess('payment_history_enabled', 'Payment History', features, 'Gold/Premium')}
            />
            <Item id="branch-expense" label="Expenses" icon={"💸"} activeId={active} onClick={onSelect} />
            <Item
              id="gst-calculator"
              label="GST Calculator"
              icon={"🧮"}
              activeId={active}
              onClick={onSelect}
              locked={!isGstEnabled}
              onLockedClick={() => window.checkSalesFeatureAccess('gst_calculator_enabled', 'GST Calculator', features, 'Gold/Premium')}
            />

            <SectionTitle title="Inventory Management" icon="📦" />
            <Item
              id="supplier"
              label="Dealers"
              icon={"🏢"}
              activeId={active}
              onClick={onSelect}
              locked={!isSupplierEnabled}
              onLockedClick={() => window.checkSalesFeatureAccess('suppliers_enabled', 'Supplier Management', features, 'Basic/Gold/Premium')}
            />
            <Item id="instock" label="Product Inventory" icon={"📦"} activeId={active} onClick={onSelect} />
            <Item id="stock-history" label="Stock History" icon={"📚"} activeId={active} onClick={onSelect} />

            <SectionTitle title="Branch Operations" icon="🏪" />
            <Item
              id="branch"
              label="Branch Management"
              icon={"🏪"}
              locked={!canUseBranch}
              activeId={active}
              onClick={onSelect}
              onLockedClick={() => window.checkSalesFeatureAccess('branch_management_enabled', 'Branch Management', features, 'Basic/Gold/Premium')}
            />
            <Item
              id="branch-supply"
              label="Branch Supply"
              icon={"🚚"}
              activeId={active}
              onClick={onSelect}
              locked={!canUseBranch}
              onLockedClick={() => window.checkSalesFeatureAccess('branch_management_enabled', 'Branch Supply', features, 'Basic/Gold/Premium')}
            />
            <Item
              id="branch-supply-history"
              label="Supply History"
              icon={"📋"}
              activeId={active}
              onClick={onSelect}
              locked={!isSupplyHistoryEnabled}
              onLockedClick={() => window.checkSalesFeatureAccess('supply_history_enabled', 'Supply History', features, 'Premium')}
            />
          </>
        )}
      </nav>
    </aside>
  );
}
// Register globally for the in-browser JSX loader
window.Sidebar = Sidebar;

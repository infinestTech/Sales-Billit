// Mobile view wrapper - renders appropriate mobile component based on view
function MobileViewRenderer({ view, salesUrl, token, branchUser, ...props }) {
  const renderCardMessage = (icon, title, subtitle) => (
    <div className="card">
      <div className="empty-state">
        <div className="empty-icon">{icon}</div>
        <div className="empty-title">{title}</div>
        {subtitle ? <div className="empty-sub">{subtitle}</div> : null}
      </div>
    </div>
  );

  // Mirror key desktop conditional rendering from `MainContent` in `main.jsx`
  // so feature/plan restrictions are consistent on mobile too.
  const planId = props?.planId || '';

  // Admin-only views (desktop blocks these when `branchUser` is truthy)
  const adminOnlyViews = new Set(['gst-calculator', 'whatsapp-stock', 'whatsapp-contact']);
  if (branchUser && adminOnlyViews.has(view)) {
    return (
      <div className="mobile-content mobile-overflow-y-auto">
        {renderCardMessage('🔒', 'Admin Only', 'This section is available only for the admin account.')}
      </div>
    );
  }

  // Branch Management: desktop allows only admin
  if (view === 'branch') {
    if (branchUser) {
      return (
        <div className="mobile-content mobile-overflow-y-auto">
          <div className="card">
            <h3>Welcome</h3>
            <p>Welcome, {branchUser.name || 'Branch User'}!</p>
          </div>
        </div>
      );
    }
  }

  // Seconds Sales detail view: desktop uses dynamic hash `seconds-sales-view-<id>`
  if ((view || '').startsWith('seconds-sales-view-')) {
    const id = (view || '').replace('seconds-sales-view-', '');
    const Comp = window.MobileSecondsSalesView || window.SecondsSalesView;
    return (
      <div className="mobile-content mobile-overflow-y-auto">
        {Comp ? React.createElement(Comp, { salesUrl, token, id, ...props }) : renderCardMessage('📱', 'Loading…', 'SecondsSalesView component not loaded yet.')}
      </div>
    );
  }

  // InStock: desktop shows BranchInStock for branch users (different API than InStockView)
  if (view === 'instock' && branchUser) {
    const Comp = window.BranchInStock;
    return (
      <div className="mobile-content mobile-overflow-y-auto">
        {Comp ? React.createElement(Comp, { salesUrl, token, ...props }) : renderCardMessage('📦', 'Loading…', 'BranchInStock component not loaded yet.')}
      </div>
    );
  }

  // Map views to mobile components
  const viewComponents = {
    'instock': window.MobileInStock,
    'branch-expense': window.MobileBranchExpense,
    'supplier': window.MobileCreateSupplier,
    'branch': window.MobileCreateBranch,
    'branch-supply-history': window.MobileBranchSupplyHistory,
    'product-sales': window.MobileProductSales,
    'seconds-sales': window.MobileSecondsSales,
    'supplier-credits': window.MobileSupplierCredits,
    'branch-sales-report': window.MobileBranchSalesReport,
  };

  const MobileComponent = viewComponents[view];
  
  // If mobile component exists, use it; otherwise fall back to desktop component
  if (MobileComponent) {
    return React.createElement(MobileComponent, { salesUrl, token, ...props });
  }
  
  // Fallback to desktop components wrapped in mobile-friendly container
  return (
    <div className="mobile-content mobile-overflow-y-auto">
      {renderDesktopView(view, salesUrl, token, branchUser, props)}
    </div>
  );
}

function renderDesktopView(view, salesUrl, token, branchUser, props) {
  // Render desktop components in mobile container
  switch(view) {
    case 'branch-expense':
      return window.BranchNewExpense ? React.createElement(window.BranchNewExpense, { salesUrl, token, branchUser }) : null;
    case 'gst-calculator':
      return window.GstCalculatorView ? React.createElement(window.GstCalculatorView, { salesUrl, token }) : null;
    case 'supplier':
      return window.CreateSupplier ? React.createElement(window.CreateSupplier, { salesUrl, token }) : null;
    case 'instock':
      if (branchUser) {
        return window.BranchInStock ? React.createElement(window.BranchInStock, { salesUrl, token }) : null;
      }
      return window.InStockView ? React.createElement(window.InStockView, { salesUrl, token }) : null;
    case 'stock-history':
      return window.StockHistory ? React.createElement(window.StockHistory, { salesUrl, token, branchUser }) : null;
    case 'supplier-credits':
      return window.SupplierCredits ? React.createElement(window.SupplierCredits, { salesUrl, token }) : null;
    case 'branch':
      return window.CreateBranch ? React.createElement(window.CreateBranch, { salesUrl, token, ...props }) : null;
    case 'branch-supply':
      return window.BranchSupply ? React.createElement(window.BranchSupply, { salesUrl, token }) : null;
    case 'branch-supply-history':
      return window.BranchSupplyHistory ? React.createElement(window.BranchSupplyHistory, { salesUrl, token }) : null;
    case 'product-sales':
      return window.ProductSales ? React.createElement(window.ProductSales, { salesUrl, token }) : null;
    case 'seconds-sales':
      return window.SecondsSales ? React.createElement(window.SecondsSales, { salesUrl, token }) : null;
    case 'sales-track':
      return window.SalesTrack ? React.createElement(window.SalesTrack, { salesUrl, token }) : null;
    case 'product-sell':
      return window.ProductSell ? React.createElement(window.ProductSell, { salesUrl, token }) : null;
    default:
      return (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <div className="empty-title">View Not Found</div>
          <div className="empty-sub">The requested view doesn't exist</div>
        </div>
      );
  }
}

// Register globally
window.MobileViewRenderer = MobileViewRenderer;

// Mobile view wrapper - renders appropriate mobile component based on view
function MobileViewRenderer({ view, salesUrl, token, branchUser, ...props }) {
  // Map views to mobile components
  const viewComponents = {
    'bank': window.MobileCreateBank,
    'bank-history': window.MobileBankHistory,
    'instock': window.MobileInStock,
    'branch-expense': window.MobileBranchExpense,
    'supplier': window.MobileCreateSupplier,
    // Add more as they're created
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
    case 'bank':
      return window.CreateBank ? React.createElement(window.CreateBank, { salesUrl, token }) : null;
    case 'bank-history':
      return window.BankHistory ? React.createElement(window.BankHistory, { salesUrl, token }) : null;
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

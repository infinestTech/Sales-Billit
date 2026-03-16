function Sidebar({ active = 'instock', onSelect, planId, branchLimit, branchUser }) {
  
  const Item = ({ id, label, icon = '📋', activeId, onClick }) => (
    <a
      className={'nav-item ' + (activeId === id ? 'active' : '')}
      href={"#" + id}
      onClick={(e) => {
        e.preventDefault();
        onClick?.(id);
        try { location.hash = '#' + id; } catch {}
      }}
    >
      <span className="icon">{icon}</span>
      <span>{label}</span>
    </a>
  );

  const SectionTitle = ({ title, icon }) => (
    <div className="nav-section-title">
      {icon && <span className="section-icon">{icon}</span>}
      <span>{title}</span>
    </div>
  );

  // Determine if this is a branch user
  const isBranch = !!branchUser;

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
            <SectionTitle title="Point of Sale" icon="🛒" />
            <Item id="product-sales" label="Product Sales" icon={"💳"} activeId={active} onClick={onSelect} />

            <div style={{borderTop: '2px solid var(--border)', margin: '16px 0'}}></div>

            <SectionTitle title="Financial" icon="💰" />
            <Item id="branch-expense" label="Expenses" icon={"💸"} activeId={active} onClick={onSelect} />

            <SectionTitle title="Inventory" icon="📦" />
            <Item id="supplier" label="Dealers" icon={"🏢"} activeId={active} onClick={onSelect} />
            <Item id="instock" label="Product Inventory" icon={"📦"} activeId={active} onClick={onSelect} />
            <Item id="stock-history" label="Stock History" icon={"📚"} activeId={active} onClick={onSelect} />

            <SectionTitle title="Other Sales" icon="📈" />
            <Item id="seconds-sales" label="Seconds Mobile Sales" icon={"⚡"} activeId={active} onClick={onSelect} />
            <Item id="sales-track" label="Sales Analytics" icon={"📊"} activeId={active} onClick={onSelect} />
          </>
        ) : (
          // Admin / seller view
          <>
            <SectionTitle title="Financial Management" icon="💰" />
            <Item id="branch-expense" label="Expenses" icon={"💸"} activeId={active} onClick={onSelect} />
            <Item id="gst-calculator" label="GST Calculator" icon={"🧮"} activeId={active} onClick={onSelect} />

            <SectionTitle title="Inventory Management" icon="📦" />
            <Item id="supplier" label="Dealers" icon={"🏢"} activeId={active} onClick={onSelect} />
            <Item id="instock" label="Product Inventory" icon={"📦"} activeId={active} onClick={onSelect} />
            <Item id="stock-history" label="Stock History" icon={"📚"} activeId={active} onClick={onSelect} />
            <Item id="supplier-credits" label="Supplier Credits" icon={"💳"} activeId={active} onClick={onSelect} />

            <SectionTitle title="Branch Operations" icon="🏪" />
            <Item id="branch" label="Branch Management" icon={"🏪"} activeId={active} onClick={onSelect} />
            <Item id="branch-supply" label="Branch Supply" icon={"🚚"} activeId={active} onClick={onSelect} />
            <Item id="branch-supply-history" label="Supply History" icon={"📋"} activeId={active} onClick={onSelect} />
            <Item id="branch-sales-report" label="Branch Sales" icon={"📊"} activeId={active} onClick={onSelect} />
          </>
        )}
      </nav>
    </aside>
  );
}
// Register globally for the in-browser JSX loader
window.Sidebar = Sidebar;

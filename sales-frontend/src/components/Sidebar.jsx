function Sidebar({ active = 'instock', onSelect, planId, branchLimit, branchUser }) {
  
  const Item = ({ id, label, icon = 'clipboard', activeId, onClick }) => (
    <a
      className={'nav-item ' + (activeId === id ? 'active' : '')}
      href={"#" + id}
      onClick={(e) => {
        e.preventDefault();
        onClick?.(id);
        try { location.hash = '#' + id; } catch {}
      }}
    >
      <span className="icon"><window.LineIcon name={icon} size={18} /></span>
      <span>{label}</span>
    </a>
  );

  const SectionTitle = ({ title, icon }) => (
    <div className="nav-section-title">
      {icon && <span className="section-icon"><window.LineIcon name={icon} size={13} /></span>}
      <span>{title}</span>
    </div>
  );

  // Determine if this is a branch user
  const isBranch = !!branchUser;

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon"><window.LineIcon name="gem" size={24} /></div>
        <div className="brand-info">
          <h1>Fixel</h1>
          <p>Sales Management Pro</p>
        </div>
      </div>
      <nav className="nav">
        {isBranch ? (
          // Branch users see a minimal branch nav
          <>
            <SectionTitle title="Point of Sale" icon="card" />
            <Item id="product-sales" label="Sales" icon="cart" activeId={active} onClick={onSelect} />

            <div style={{borderTop: '2px solid var(--border)', margin: '16px 0'}}></div>

            <SectionTitle title="Financial" icon="wallet" />
            <Item id="branch-expense" label="Expenses" icon="receipt" activeId={active} onClick={onSelect} />
            <Item id="dealer-credits" label="Dealer Credits" icon="card" activeId={active} onClick={onSelect} />

            <SectionTitle title="Inventory" icon="box" />
            <Item id="supplier" label="Dealers" icon="building" activeId={active} onClick={onSelect} />
            <Item id="instock" label="Purchase Inventory" icon="box" activeId={active} onClick={onSelect} />
            <Item id="stock-history" label="Stock History" icon="history" activeId={active} onClick={onSelect} />
            <Item id="price-code" label="Price Code" icon="key" activeId={active} onClick={onSelect} />

            <SectionTitle title="Other Sales" icon="trending" />
            <Item id="seconds-sales" label="Seconds Mobile Sales" icon="phone" activeId={active} onClick={onSelect} />
            <Item id="sales-track" label="Sales Analytics" icon="chart" activeId={active} onClick={onSelect} />
          </>
        ) : (
          // Admin / seller view
          <>
            <SectionTitle title="Financial Management" icon="wallet" />
            <Item id="branch-expense" label="Expenses" icon="receipt" activeId={active} onClick={onSelect} />
            <Item id="gst-calculator" label="GST Calculator" icon="calculator" activeId={active} onClick={onSelect} />

            <SectionTitle title="Inventory Management" icon="box" />
            <Item id="supplier" label="Dealers" icon="building" activeId={active} onClick={onSelect} />
            <Item id="instock" label="Purchase Inventory" icon="box" activeId={active} onClick={onSelect} />
            <Item id="stock-history" label="Stock History" icon="history" activeId={active} onClick={onSelect} />
            <Item id="supplier-credits" label="Supplier Credits" icon="card" activeId={active} onClick={onSelect} />

            <SectionTitle title="Branch Operations" icon="store" />
            <Item id="branch" label="Branch Management" icon="store" activeId={active} onClick={onSelect} />
            <Item id="branch-supply" label="Branch Supply" icon="truck" activeId={active} onClick={onSelect} />
            <Item id="branch-supply-history" label="Supply History" icon="clipboard" activeId={active} onClick={onSelect} />
            <Item id="branch-sales-report" label="Branch Sales" icon="chart" activeId={active} onClick={onSelect} />
          </>
        )}
      </nav>
    </aside>
  );
}
// Register globally for the in-browser JSX loader
window.Sidebar = Sidebar;

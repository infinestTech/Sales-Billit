function WhatsappStock({ salesUrl, token }) {
  const [mode, setMode] = React.useState('price'); // 'price' or 'sell'

  return (
    <div>
      {/* Header Section */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">WhatsApp Inventory Management</h3>
            <p className="card-description">Manage product pricing and sales for WhatsApp business</p>
          </div>
        </div>
        
        {/* Mode Toggle */}
        <div className="toggle-section">
          <div className="toggle-pill">
            <button 
              className={`toggle-btn ${mode === 'price' ? 'active' : ''}`} 
              onClick={() => setMode('price')}
            >
              💰 Product Pricing
            </button>
            <button 
              className={`toggle-btn ${mode === 'sell' ? 'active' : ''}`} 
              onClick={() => setMode('sell')}
            >
              🛒 Product Sales
            </button>
          </div>
        </div>
        
        <div className="mode-description">
          {mode === 'price' ? (
            <div className="info-card">
              <div className="info-icon">💰</div>
              <div>
                <div className="info-title">Product Pricing Mode</div>
                <div className="info-text">Set selling prices and supply quantities for WhatsApp inventory</div>
              </div>
            </div>
          ) : (
            <div className="info-card">
              <div className="info-icon">🛒</div>
              <div>
                <div className="info-title">Product Sales Mode</div>
                <div className="info-text">Process sales and manage WhatsApp product transactions</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content Section */}
      <div className="content-wrapper">
        {mode === 'price' ? (
          (window.ProductPrice ? React.createElement(window.ProductPrice, { salesUrl, token }) : 
           <div className="loading-card">
             <div className="loading-content">
               <div className="spinner"></div>
               <div>Loading Product Price...</div>
             </div>
           </div>)
        ) : (
          (window.ProductSell ? React.createElement(window.ProductSell, { salesUrl, token }) : 
           <div className="loading-card">
             <div className="loading-content">
               <div className="spinner"></div>
               <div>Loading Product Sales...</div>
             </div>
           </div>)
        )}
      </div>
    </div>
  );
}

window.WhatsappStock = WhatsappStock;

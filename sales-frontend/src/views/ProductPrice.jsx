function ProductPrice({ salesUrl, token }) {
  const [productNo, setProductNo] = React.useState('');
  const [rows, setRows] = React.useState([]);
  const [rowEdits, setRowEdits] = React.useState({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  async function showProduct(e) {
    if (e && e.preventDefault) e.preventDefault();
    const needle = (productNo || '').toString().trim();
    if (!needle) { setError('Enter a product no'); return; }
    setError('');
    setLoading(true);
    try {
      const found = await fetchProduct(needle);
      if (found.length === 0) {
        setRows([]);
        alert('Product not available');
      } else {
        setRows(found);
        // log current quantities
        console.log('Current quantities for', needle, found.map(r => ({ productNo: r.productNo || r.productId, qty: r.qty != null ? r.qty : (r.centralQty != null ? r.centralQty : 0) })));
      }
    } catch (err) {
      console.error('ProductPrice fetch error', err);
      alert('Failed to fetch product details');
    } finally {
      setLoading(false);
    }
  }

  async function fetchProduct(needle) {
    const base = (salesUrl || '').replace(/\/$/, '');
    const url = base + '/api/branch-stock?productNo=' + encodeURIComponent(needle);
    const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) } });
    const data = await res.json();
    if (!data || !data.success) return [];
    return Array.isArray(data.rows) ? data.rows : [];
  }

  const currency = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

  async function saveWhatsappStock(key, row) {
    try {
      const edit = rowEdits[key] || {};
  const supplyQty = Number(edit.supplyQty || 0);
  const sellPercent = Number(edit.sellPercent || 0);
  // compute selling price same as BranchSupply.jsx: pct ? cost * (1 + pct/100) : row.sellingPrice
  const cost = Number(row.costPrice ?? row.cost ?? row.totalCostPrice ?? row.totalCost ?? 0);
  const rawSelling = sellPercent ? (cost * (1 + sellPercent / 100)) : Number(row.sellingPrice || 0);
  const sellingPrice = Number(Number(rawSelling || 0).toFixed(2));
      // set saving flag
      setRowEdits(s => ({ ...s, [key]: { ...(s[key] || {}), saving: true } }));

      const base = (salesUrl || '').replace(/\/$/, '');
      const payload = {
        productNo: row.productNo || row.productId || '',
        productName: row.productName || '',
        brand: row.brand || '',
        model: row.model || '',
  supplyQty,
  sellPercent,
  sellingPrice,
  costPrice: cost,
  totalCost: Number(row.totalCostPrice || row.totalCost || 0)
      };

      // log current qty before transfer
      const currentQty = (row.qty != null) ? row.qty : (row.centralQty != null ? row.centralQty : 0);
      console.log('Before transfer:', { productNo: payload.productNo, currentQty });

      const res = await fetch(base + '/api/whatsapp-stock', {
        method: 'POST', headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {})
        }, body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.message || 'Save failed');
      } else {
        alert(data.message || 'Saved');
        // reflect saved state
        setRowEdits(s => ({ ...s, [key]: { ...s[key], saving: false } }));
        // fetch updated product and log new qty
        try {
          const refreshed = await fetchProduct(payload.productNo);
          const updated = refreshed.find(rr => (rr.productNo || rr.productId) === payload.productNo);
          const newQty = updated ? (updated.qty != null ? updated.qty : (updated.centralQty != null ? updated.centralQty : 0)) : null;
          console.log('Transfer completed:', { productNo: payload.productNo, supplyQty, before: currentQty, after: newQty });
        } catch (e) { console.error('Failed to fetch refreshed product', e); }
      }
    } catch (err) {
      console.error('saveWhatsappStock error', err);
      alert('Save failed');
      setRowEdits(s => ({ ...s, [key]: { ...s[key], saving: false } }));
    }
  }

  return (
    <div>
      {/* Search Section */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Product Search</h3>
            <p className="card-description">Search and manage product pricing for WhatsApp inventory</p>
          </div>
        </div>
        
        <form onSubmit={showProduct}>
          <div className="form-grid form-grid-3">
            <div className="form-group">
              <label className="form-label required">Product Number</label>
              <input 
                value={productNo} 
                onChange={e => setProductNo(e.target.value)} 
                placeholder="Enter product number" 
                className="form-input"
                required
              />
            </div>
          </div>
          
          <div className="btn-group mt-4">
            <button 
              className="btn btn-primary" 
              onClick={showProduct} 
              disabled={loading}
              type="button"
            >
              {loading ? (
                <span className="loading">
                  <span className="spinner"></span>
                  Searching...
                </span>
              ) : '🔍 Search Product'}
            </button>
            
            <button 
              type="button" 
              className="btn btn-outline" 
              onClick={() => { setProductNo(''); setRows([]); setError(''); }}
            >
              🗑️ Clear
            </button>
          </div>
          
          {error && (
            <div className="alert alert-danger mt-4">
              <div className="alert-icon">❌</div>
              <div>{error}</div>
            </div>
          )}
        </form>
      </div>

      {/* Results Table */}
      <div className="table-card">
        <div className="table-header">
          <div>
            <h3 className="table-title">Product Pricing</h3>
            <p className="table-subtitle">Set pricing and supply quantities for WhatsApp inventory</p>
          </div>
        </div>
        
        {rows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <div className="empty-title">No Products Found</div>
            <div className="empty-description">Search for a product number to view pricing details</div>
          </div>
        ) : (
          <>
            <div className="table-scroll">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>No.</th>
                    <th style={{ width: '120px' }}>Product No</th>
                    <th style={{ width: '180px' }}>Product Name</th>
                    <th style={{ width: '120px' }}>Brand</th>
                    <th style={{ width: '120px' }}>Model</th>
                    <th style={{ width: '80px' }}>Stock Qty</th>
                    <th style={{ width: '110px' }}>Total Cost</th>
                    <th style={{ width: '140px' }}>Selling Price</th>
                    <th style={{ width: '120px' }}>Supply Qty</th>
                    <th style={{ width: '100px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const key = r.productNo || r.productId || i;
                    const edit = rowEdits[key] || { sellPercent: '', supplyQty: '' };
                    const availableQty = (r.qty != null) ? r.qty : (r.centralQty != null ? r.centralQty : 0);
                    const cost = Number(r.costPrice ?? r.cost ?? r.totalCostPrice ?? r.totalCost ?? 0);
                    const sellPct = Number(edit.sellPercent || 0);
                    const calculatedPrice = sellPct ? (cost * (1 + sellPct / 100)) : Number(r.sellingPrice || 0);
                    const supplyQty = Number(edit.supplyQty || 0);
                    const isOverSupply = supplyQty > availableQty;
                    
                    return (
                      <tr key={key}>
                        <td>
                          <span className="serial-badge">{i + 1}</span>
                        </td>
                        <td>
                          <div className="product-cell">
                            <span className="product-code">{r.productNo || '-'}</span>
                          </div>
                        </td>
                        <td>
                          <div className="product-cell">
                            <span className="cell-strong">{r.productName || '-'}</span>
                          </div>
                        </td>
                        <td>
                          <span className="brand-text">{r.brand || '-'}</span>
                        </td>
                        <td>
                          <span className="model-text">{r.model || '-'}</span>
                        </td>
                        <td>
                          <span className="count-badge">{availableQty}</span>
                        </td>
                        <td>
                          <span className="amount-badge">
                            {currency(Number(r.totalCostPrice || r.totalCost || 0))}
                          </span>
                        </td>
                        <td>
                          <div className="pricing-cell">
                            <div className="form-group mb-2">
                              <div className="input-group">
                                <input 
                                  type="number"
                                  className="form-input form-input-sm"
                                  style={{ width: '80px' }}
                                  placeholder="Sell %" 
                                  value={edit.sellPercent}
                                  onChange={e => setRowEdits(s => ({ ...s, [key]: { ...edit, sellPercent: e.target.value } }))} 
                                />
                                <span className="input-suffix">%</span>
                              </div>
                            </div>
                            <div className="calculated-price">
                              {calculatedPrice ? currency(Number(calculatedPrice.toFixed(2))) : '-'}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="supply-cell">
                            <div className="form-group">
                              <input 
                                type="number"
                                className={`form-input form-input-sm ${isOverSupply ? 'error' : ''}`}
                                style={{ width: '80px' }}
                                placeholder="Qty" 
                                min={0} 
                                max={availableQty}
                                value={edit.supplyQty}
                                onChange={e => setRowEdits(s => ({ ...s, [key]: { ...edit, supplyQty: e.target.value } }))} 
                              />
                            </div>
                            {isOverSupply && (
                              <div className="error-text">Exceeds stock</div>
                            )}
                          </div>
                        </td>
                        <td>
                          <button 
                            className="btn btn-sm btn-primary" 
                            onClick={() => saveWhatsappStock(key, r)}
                            disabled={edit.saving || isOverSupply}
                          >
                            {edit.saving ? (
                              <span className="loading">
                                <span className="spinner"></span>
                                Saving...
                              </span>
                            ) : '💾 Save'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

window.ProductPrice = ProductPrice;

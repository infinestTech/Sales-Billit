// Mobile-optimized InStock view
function MobileInStock({ salesUrl, token }) {
  const [suppliers, setSuppliers] = React.useState([]);
  const [entries, setEntries] = React.useState([]);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [supplierId, setSupplierId] = React.useState('');
  const [supplierAmount, setSupplierAmount] = React.useState('');
  const [gstAmount, setGstAmount] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [items, setItems] = React.useState([
    { productNo: '', productName: '', brand: '', model: '', quantity: 1, costPrice: '', validity: '', imes: [] }
  ]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [purchaseType, setPurchaseType] = React.useState('normal');
  const [creditAmount, setCreditAmount] = React.useState('');

  const loadSuppliers = async () => {
    try {
      const storedBranchToken = typeof window !== 'undefined' ? (localStorage.getItem('branch_token') || '') : '';
      const effectiveToken = token || storedBranchToken || '';
      const res = await fetch(salesUrl + '/api/suppliers', { headers: { Authorization: 'Bearer ' + effectiveToken } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load suppliers');
      setSuppliers(Array.isArray(data.suppliers) ? data.suppliers : []);
    } catch (e) { setError(e.message); }
  };

  const loadEntries = async () => {
    try {
      const storedBranchToken = typeof window !== 'undefined' ? (localStorage.getItem('branch_token') || '') : '';
      const effectiveToken = token || storedBranchToken || '';
      const res = await fetch(salesUrl + '/api/in-stock', { headers: { Authorization: 'Bearer ' + effectiveToken } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load');
      setEntries(Array.isArray(data.entries) ? data.entries : []);
    } catch (e) { setError(e.message); }
  };

  React.useEffect(() => { loadSuppliers(); loadEntries(); }, []);

  const canSubmit = supplierId && items.every(it => it.productName);
  const totalProductAmount = items.reduce((sum, it) => sum + ((Number(it.quantity) || 0) * (Number(it.costPrice) || 0)), 0);
  const totalBillAmount = (Number(supplierAmount) || 0) + (Number(gstAmount) || 0);

  const addRow = () => setItems(it => [...it, { productNo: '', productName: '', brand: '', model: '', quantity: 1, costPrice: '', validity: '', imes: [] }]);
  
  const updateItem = (idx, field, value) => setItems(list => list.map((it, i) => {
    if (i !== idx) return it;
    if (field === 'quantity') {
      const qty = Number(value) || 0;
      const prevImes = Array.isArray(it.imes) ? it.imes.slice(0, qty) : [];
      while (prevImes.length < qty) prevImes.push('');
      return { ...it, [field]: value, imes: prevImes };
    }
    return { ...it, [field]: value };
  }));

  const removeRow = (idx) => setItems(list => list.filter((_, i) => i !== idx));

  // Helper to generate random alphanumeric string (2-9 chars) like desktop `InStockView`
  function randomProductNo() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const len = Math.floor(Math.random() * 3) + 2; // 2 to 9
    let str = '';
    for (let i = 0; i < len; i++) {
      str += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return str;
  }

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const storedBranchToken = typeof window !== 'undefined' ? (localStorage.getItem('branch_token') || '') : '';
      const effectiveToken = token || storedBranchToken || '';
      const res = await fetch(salesUrl + '/api/in-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + effectiveToken },
        body: JSON.stringify({
          supplier_id: supplierId,
          supplierAmount: Number(supplierAmount) || 0,
          gstAmount: Number(gstAmount) || 0,
          category,
          purchaseType,
          creditAmount: purchaseType === 'credit' ? (Number(creditAmount) || 0) : 0,
          items: items.map(it => ({
            productNo: it.productNo && String(it.productNo).trim() ? it.productNo : randomProductNo(),
            productName: it.productName,
            brand: it.brand,
            model: it.model,
            quantity: Number(it.quantity) || 1,
            costPrice: Number(it.costPrice) || 0,
            validity: it.validity,
            imes: Array.isArray(it.imes) ? it.imes.filter(x => x && String(x).trim()) : []
          }))
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Save failed');
      
      // Reset form
      setSupplierId('');
      setSupplierAmount('');
      setGstAmount('');
      setCategory('');
      setPurchaseType('normal');
      setCreditAmount('');
      setItems([{ productNo: '', productName: '', brand: '', model: '', quantity: 1, costPrice: '', validity: '', imes: [] }]);
      setShowAddForm(false);
      await loadEntries();
    } catch (err) {
      setError(err.message);
    } finally { setSaving(false); }
  };

  const formatCurrency = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n || 0);

  return (
    <div className="mobile-content">
      {/* Header */}
      <div className="card mobile-mb-3">
        <div className="card-header">
          <h3 className="card-title">📦 Product Inventory</h3>
          <p className="card-description">{entries.length} stock entries</p>
        </div>
        <div style={{ padding: '16px' }}>
          <button 
            className="btn btn-primary mobile-w-full"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? '❌ Cancel' : '➕ Add New Stock'}
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="card mobile-mb-3">
          <div className="card-header">
            <h3 className="card-title">➕ Add Stock Entry</h3>
          </div>
          
          <div style={{ padding: '16px' }}>
            {/* Supplier & Bank */}
            <div className="form-group mobile-mb-3">
              <label className="form-label">Supplier/Dealer</label>
              <select 
                className="form-select"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                required
              >
                <option value="">Select Supplier</option>
                {suppliers.map(s => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group mobile-mb-3">
              <label className="form-label">Category</label>
              <select 
                className="form-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Select Category</option>
                <option value="Mobile">Mobile</option>
                <option value="Accessories">Accessories</option>
              </select>
            </div>

            <div className="form-group mobile-mb-3">
              <label className="form-label">Supplier Amount</label>
              <input 
                className="form-input"
                type="number"
                value={supplierAmount}
                onChange={(e) => setSupplierAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
              />
            </div>

            {/* Purchase Type Toggle */}
            <div className="form-group mobile-mb-3">
              <label className="form-label">Purchase Type</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => { setPurchaseType('normal'); setCreditAmount(''); }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    border: purchaseType === 'normal' ? '2px solid #059669' : '2px solid #d1d5db',
                    background: purchaseType === 'normal' ? '#ecfdf5' : '#fff',
                    color: purchaseType === 'normal' ? '#059669' : '#6b7280'
                  }}
                >
                  💵 Normal
                </button>
                <button
                  type="button"
                  onClick={() => setPurchaseType('credit')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    border: purchaseType === 'credit' ? '2px solid #dc2626' : '2px solid #d1d5db',
                    background: purchaseType === 'credit' ? '#fef2f2' : '#fff',
                    color: purchaseType === 'credit' ? '#dc2626' : '#6b7280'
                  }}
                >
                  🏷️ Credit
                </button>
              </div>
            </div>

            {purchaseType === 'credit' && (
              <div className="form-group mobile-mb-3" style={{ background: '#fef2f2', padding: '12px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                <div style={{ fontSize: '12px', color: '#991b1b', marginBottom: '8px' }}>⚠️ This amount will be recorded as credit owed to the supplier</div>
                <label className="form-label" style={{ color: '#991b1b' }}>Credit Amount *</label>
                <input
                  className="form-input"
                  type="number"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="Enter credit amount"
                  step="0.01"
                />
              </div>
            )}

            <div className="form-group mobile-mb-3">
              <label className="form-label">GST Amount</label>
              <input 
                className="form-input"
                type="number"
                value={gstAmount}
                onChange={(e) => setGstAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
              />
            </div>

            {/* Products */}
            <div style={{ marginTop: '20px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
                Products
              </h4>
              
              {items.map((item, idx) => (
                <div key={idx} style={{
                  background: '#f8fafc',
                  padding: '12px',
                  borderRadius: '8px',
                  marginBottom: '12px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div className="form-group mobile-mb-2">
                    <label className="form-label" style={{ fontSize: '13px' }}>Product Name *</label>
                    <input 
                      className="form-input"
                      value={item.productName}
                      onChange={(e) => updateItem(idx, 'productName', e.target.value)}
                      placeholder="Enter product name"
                      required
                    />
                  </div>

                  <div className="form-group mobile-mb-2">
                    <label className="form-label" style={{ fontSize: '13px' }}>Product No</label>
                    <input 
                      className="form-input"
                      value={item.productNo}
                      onChange={(e) => updateItem(idx, 'productNo', e.target.value)}
                      placeholder="SKU/Code"
                    />
                  </div>

                  <div className="form-group mobile-mb-2">
                    <label className="form-label" style={{ fontSize: '13px' }}>Brand</label>
                    <input 
                      className="form-input"
                      value={item.brand}
                      onChange={(e) => updateItem(idx, 'brand', e.target.value)}
                      placeholder="Brand name"
                    />
                  </div>

                  <div className="form-group mobile-mb-2">
                    <label className="form-label" style={{ fontSize: '13px' }}>Model</label>
                    <input 
                      className="form-input"
                      value={item.model}
                      onChange={(e) => updateItem(idx, 'model', e.target.value)}
                      placeholder="Model number"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '13px' }}>Quantity</label>
                      <input 
                        className="form-input"
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                        min="1"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '13px' }}>Cost Price</label>
                      <input 
                        className="form-input"
                        type="number"
                        value={item.costPrice}
                        onChange={(e) => updateItem(idx, 'costPrice', e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                      />
                    </div>
                  </div>

                  {items.length > 1 && (
                    <button 
                      className="btn btn-danger mobile-w-full mobile-mt-2"
                      onClick={() => removeRow(idx)}
                      style={{ padding: '8px', fontSize: '14px' }}
                    >
                      🗑️ Remove Product
                    </button>
                  )}
                </div>
              ))}

              <button 
                className="btn btn-secondary mobile-w-full"
                onClick={addRow}
              >
                ➕ Add Another Product
              </button>
            </div>

            {/* Summary */}
            <div style={{
              background: '#f0f9ff',
              padding: '12px',
              borderRadius: '8px',
              marginTop: '16px',
              border: '1px solid #bae6fd'
            }}>
              <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                <strong>Product Amount:</strong> {formatCurrency(totalProductAmount)}
              </div>
              <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                <strong>Total Bill:</strong> {formatCurrency(totalBillAmount)}
              </div>
            </div>

            {error && (
              <div className="alert alert-danger mobile-mt-3">
                ⚠️ {error}
              </div>
            )}

            <button 
              className="btn btn-primary mobile-w-full mobile-mt-3"
              onClick={submit}
              disabled={!canSubmit || saving}
            >
              {saving ? '💾 Saving...' : '💾 Save Stock Entry'}
            </button>
          </div>
        </div>
      )}

      {/* Stock Entries List */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">📋 Stock Entries</h3>
        </div>
        
        {entries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <div className="empty-title">No Stock Entries</div>
            <div className="empty-sub">Add your first stock entry above</div>
          </div>
        ) : (
          <div style={{ padding: '16px' }}>
            {entries.map((entry, idx) => (
              <div key={entry._id || idx} style={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                padding: '12px',
                marginBottom: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                  {new Date(entry.createdAt).toLocaleDateString()}
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
                  {entry.items?.length || 0} product(s)
                </div>
                <div style={{ fontSize: '13px', color: '#64748b' }}>
                  Total: {formatCurrency((entry.supplierAmount || 0) + (entry.gstAmount || 0))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Register globally
window.MobileInStock = MobileInStock;

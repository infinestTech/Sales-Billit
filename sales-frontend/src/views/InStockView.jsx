function InStockView({ salesUrl, token }) {
  const [suppliers, setSuppliers] = React.useState([]);
  const [banks, setBanks] = React.useState([]);
  const [entries, setEntries] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [supplierId, setSupplierId] = React.useState('');
  const [bankId, setBankId] = React.useState('');
  const [supplierAmount, setSupplierAmount] = React.useState('');
  const [gstAmount, setGstAmount] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [items, setItems] = React.useState([
    { productNo: '', productName: '', brand: '', model: '', quantity: 1, costPrice: '', validity: '', imes: [] }
  ]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [filter, setFilter] = React.useState({
    productNo: '',
    productName: '',
    brand: '',
    model: '',
    productDays: '',
    quantity: ''
  });
  const [validityPopup, setValidityPopup] = React.useState(false);
  const [validityData, setValidityData] = React.useState([]);
  const [showRedDot, setShowRedDot] = React.useState(false);


  const loadSuppliers = async () => {
    try {
      const res = await fetch(salesUrl + '/api/suppliers', { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load suppliers');
      setSuppliers(Array.isArray(data.suppliers) ? data.suppliers : []);
    } catch (e) { setError(e.message); }
  };
  const loadBanks = async () => {
    try {
      const res = await fetch(salesUrl + '/api/banks', { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load banks');
      setBanks(Array.isArray(data.banks) ? data.banks : []);
    } catch (e) { setError(e.message); }
  };
  const loadEntries = async () => {
    try {
      const res = await fetch(salesUrl + '/api/in-stock', { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load');
      setEntries(Array.isArray(data.entries) ? data.entries : []);
    } catch (e) { setError(e.message); }
  };
  React.useEffect(() => { loadSuppliers(); loadBanks(); loadEntries(); }, []);


  React.useEffect(() => {
    const hasExpiringProducts = entries.some(entry => {
      return entry.items.some(item => {
        if (!item.validity) return false;
        const validityDate = new Date(item.validity);
        const today = new Date();
        const diffInDays = Math.ceil((validityDate - today) / (1000 * 60 * 60 * 24));
        return diffInDays > 0 && diffInDays <= 7; // Check for products expiring within 7 days
      });
    });
    setShowRedDot(hasExpiringProducts);
  }, [entries]);


  const handleFilterChange = (field, value) => {
    setFilter(prev => ({ ...prev, [field]: value }));
  };


  const filteredEntries = React.useMemo(() => {
    return entries.filter(entry => {
      return entry.items.some(item => {
        const productDays = filter.productDays ? parseInt(filter.productDays, 10) : null;
        const createdDate = new Date(entry.createdAt);
        const daysInStock = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;


        return (
          (!filter.productNo || item.productNo?.includes(filter.productNo)) &&
          (!filter.productName || item.productName?.toLowerCase().includes(filter.productName.toLowerCase())) &&
          (!filter.brand || item.brand?.toLowerCase().includes(filter.brand.toLowerCase())) &&
          (!filter.model || item.model?.toLowerCase().includes(filter.model.toLowerCase())) &&
          (!productDays || daysInStock === productDays) &&
          (filter.quantity === '' || item.quantity === parseInt(filter.quantity, 10))
        );
      });
    });
  }, [entries, filter]);


  // Removed sumCost calculation and Supplier Amount check
  const canSubmit = supplierId && bankId && items.every(it => it.productName);
  // Calculate product amount (qty x cost price) for each item
  const productAmounts = items.map(it => (Number(it.quantity) || 0) * (Number(it.costPrice) || 0));
  const totalProductAmount = productAmounts.reduce((sum, amt) => sum + amt, 0);
  // Calculate total bill amount
  const totalBillAmount = (Number(supplierAmount) || 0) + (Number(gstAmount) || 0);


  const addRow = () => setItems(it => [...it, { productNo: '', productName: '', brand: '', model: '', quantity: 1, costPrice: '', validity: '' }]);
  const addRowWithImes = () => setItems(it => [...it, { productNo: '', productName: '', brand: '', model: '', quantity: 1, costPrice: '', validity: '', imes: [] }]);


  const updateItem = (idx, field, value) => setItems(list => list.map((it, i) => {
    if (i !== idx) return it;
    // if quantity changed and category is Mobile, ensure imes array length matches quantity
    if (field === 'quantity') {
      const qty = Number(value) || 0;
      const prevImes = Array.isArray(it.imes) ? it.imes.slice(0, qty) : [];
      while (prevImes.length < qty) prevImes.push('');
      return { ...it, [field]: value, imes: prevImes };
    }
    return { ...it, [field]: value };
  }));
  const removeRow = (idx) => setItems(list => list.filter((_, i) => i !== idx));


  const resetModal = () => {
    setSupplierId(''); setBankId(''); setSupplierAmount('');
  setItems([{ productNo: '', productName: '', brand: '', model: '', quantity: 1, costPrice: '', validity: '', imes: [] }]);
    setError('');
    setGstAmount('');
    setCategory('');
  };


  // Ensure IMES inputs are present when category is Mobile: keep imes array length == quantity
  React.useEffect(() => {
    setItems(prev => prev.map(item => {
      const qty = Number(item.quantity) || 0;
      if (category === 'Mobile') {
        const imes = Array.isArray(item.imes) ? item.imes.slice(0, qty) : [];
        while (imes.length < qty) imes.push('');
        return { ...item, imes };
      }
      // clear imes for non-mobile categories to avoid showing inputs
      return { ...item, imes: [] };
    }));
  }, [category]);


  // Helper to generate random alphanumeric string (2-9 chars)
  function randomProductNo() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const len = Math.floor(Math.random() * 8) + 2; // 2 to 9
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
      const res = await fetch(salesUrl + '/api/in-stock', {
            method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({
              supplier_id: supplierId,
              bank_id: bankId,
              supplierAmount: Number(supplierAmount) || 0,
              gstAmount: Number(gstAmount) || 0,
              category: category || null,
              items: items.map(it => ({
                productNo: it.productNo && it.productNo.trim() ? it.productNo : randomProductNo(),
                productName: it.productName,
                brand: it.brand,
                model: it.model,
                quantity: Number(it.quantity) || 1,
                costPrice: Number(it.costPrice) || 0,
                validity: it.validity,
                imes: Array.isArray(it.imes) ? it.imes.filter(x => x && x.trim()) : []
              }))
            })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Save failed');
      setOpen(false);
      resetModal();
      await loadEntries();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };


  const selectedSupplierTotal = React.useMemo(() => {
    if (!supplierId) return 0;
    const fromEntries = entries.reduce((sum, e) => {
      const sid = e.supplier_id?._id || e.supplier_id;
      if (sid !== supplierId) return sum;
      return sum + (Number(e.supplierAmount) || 0);
    }, 0);
    return fromEntries;
  }, [entries, supplierId, open]);


  const handleProductValidity = () => {
    const today = new Date();
    const data = entries.flatMap(entry => {
      return entry.items
        .filter(item => {
          if (!item.validity) return false;
          const validityDate = new Date(item.validity);
          const diffInDays = Math.ceil((validityDate - today) / (1000 * 60 * 60 * 24));
          return diffInDays > 0 && diffInDays <= 7;
        })
        .map(item => ({
          productNo: item.productNo || 'N/A',
          validityDate: new Date(item.validity).toLocaleDateString()
        }));
    });
    setValidityData(data);
    setValidityPopup(true);
    setShowRedDot(false); // Hide red dot when popup is opened
  };


  return (
    <div>
      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon">📦</div>
            <div>
              <div className="stat-label">Total Products</div>
              <div className="stat-value">{entries.reduce((sum, e) => sum + (Array.isArray(e.items) ? e.items.length : 0), 0)}</div>
            </div>
          </div>
          <div className="stat-change">Unique items in stock</div>
        </div>
       
        <div className="stat-card secondary">
          <div className="stat-header">
            <div className="stat-icon" style={{background: 'var(--gradient-secondary)'}}>📊</div>
            <div>
              <div className="stat-label">Total Quantity</div>
              <div className="stat-value">{entries.reduce((sum, e) => sum + (Array.isArray(e.items) ? e.items.reduce((itemSum, it) => itemSum + (Number(it.quantity) || 0), 0) : 0), 0)}</div>
            </div>
          </div>
          <div className="stat-change">Items available</div>
        </div>
       
        <div className="stat-card accent">
          <div className="stat-header">
            <div className="stat-icon" style={{background: 'var(--gradient-accent)'}}>💰</div>
            <div>
              <div className="stat-label">Inventory Value</div>
              <div className="stat-value">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(selectedSupplierTotal)}</div>
            </div>
          </div>
          <div className="stat-change">Total stock value</div>
        </div>
      </div>


      {/* Action Section */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Inventory Management</h3>
            <p className="card-description">Add new products to your inventory</p>
          </div>
          <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
            📦 Add New Stock
          </button>


          <button className="btn btn-secondary" type="button" onClick={handleProductValidity}>
            📅 Product Validity
            {showRedDot && <span className="red-dot"></span>}
          </button>
        </div>
         <h4>Filter Inventory</h4><br />
         <div className="row mt-2">
         
              <div className="col">


                <input
            type="text"
            placeholder="Product No"
            value={filter.productNo}
            onChange={e => handleFilterChange('productNo', e.target.value)}
          />
          </div>
          <div className="col">
          <input
            type="text"
            placeholder="Product Name"
            value={filter.productName}
            onChange={e => handleFilterChange('productName', e.target.value)}
          />
          </div>
          <div className="col">
          <input
            type="text"
            placeholder="Brand"
            value={filter.brand}
            onChange={e => handleFilterChange('brand', e.target.value)}
          />
          </div>
          <div className="col">
          <input
            type="text"
            placeholder="Model"
            value={filter.model}
            onChange={e => handleFilterChange('model', e.target.value)}
          />
          </div>
          <div className="col">
          <input
            type="number"
            placeholder="Product Days"
            value={filter.productDays}
            onChange={e => handleFilterChange('productDays', e.target.value)}
          />
          </div>
          <div className="col">
            <input
              type="number"
              placeholder="Quantity"
              value={filter.quantity}
              onChange={e => handleFilterChange('quantity', e.target.value)}
            />
          </div>


         
               
              </div>
      </div>
{/*
      {/* Inventory Table */}
      <div className="table-card">
        <div className="table-header">
          <div>
            <h3 className="table-title">
              Master Inventory
              {showRedDot && <span className="red-dot"></span>}
            </h3>
            <p className="table-subtitle">Complete list of all products in your inventory</p>
          </div>
        </div>


        {filteredEntries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <div className="empty-title">No Inventory Items</div>
            <div className="empty-description">No items match the filter criteria</div>
          </div>
        ) : (
          <>
            <div className="table-scroll">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th style={{width: '150px'}}>Supplier</th>
                    <th style={{width: '120px'}}>Product No</th>
                    <th style={{width: '180px'}}>Product Name</th>
                    <th style={{width: '120px'}}>Brand</th>
                    <th style={{width: '120px'}}>Model</th>
                    <th style={{width: '80px'}}>Qty</th>
                    <th style={{width: '90px'}}>Total Qty</th>
                    <th style={{width: '110px'}}>Cost Price</th>
                    <th style={{width: '120px'}}>Validity</th>
                    <th style={{width: '120px'}}>Product Date</th>
                    <th style={{width: '140px'}}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.flatMap((e) => (
                    (Array.isArray(e.items) ? e.items : []).map((it, idx) => (
                      <tr key={`${e._id}-${idx}`}>
                        <td>
                          <div className="supplier-cell">
                            <span className="cell-strong">{e.supplier_id?.supplierName || 'Unknown Supplier'}</span>
                            <div className="cell-sub">{e.supplier_id?.agencyName || '-'}</div>
                          </div>
                        </td>
                        <td>
                          <span className="product-code">{it.productNo || '-'}</span>
                        </td>
                        <td>
                          <div className="product-cell">
                            <span className="cell-strong">{it.productName || '-'}</span>
                          </div>
                        </td>
                        <td>
                          <span className="brand-text">{it.brand || '-'}</span>
                        </td>
                        <td>
                          <span className="model-text">{it.model || '-'}</span>
                        </td>
                        <td>
                          <span className="count-badge">{it.quantity ?? 0}</span>
                        </td>
                        <td>
                          <span className="count-badge">{it.totalQuantity ?? it.quantity ?? 0}</span>
                        </td>
                        <td>
                          <span className="amount-badge">
                            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(it.costPrice || 0)}
                          </span>
                        </td>
                        <td>
                          <div className="date-cell">
                            {it.validity ? new Date(it.validity).toLocaleDateString() : '-'}
                          </div>
                        </td>
                        <td>{(() => {
                          try {
                            const created = new Date(e.createdAt);
                            if (isNaN(created.getTime())) return '-';
                            const msPerDay = 1000 * 60 * 60 * 24;
                            const days = Math.floor((Date.now() - created.getTime()) / msPerDay) + 1;
                            return `${days} day${days !== 1 ? 's' : ''}`;
                          } catch (err) { return '-'; }
                        })()}</td>
                        <td>{new Date(e.createdAt).toLocaleString()}</td>
                      </tr>
                    ))
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>


      {open && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <div style={{fontWeight:800}}>Add In Stock</div>
              <button className="btn secondary" onClick={() => { setOpen(false); resetModal(); }}>Close</button>
            </div>
            <div className="modal-body" onKeyDown={(e)=>{ if(e.key==='Enter'){ e.preventDefault(); if(canSubmit && !saving) submit(); } }}>
              {error ? <div className="text-danger" style={{marginBottom:8}}>{error}</div> : null}
              <div className="row">
                <div className="col">
                  <label>Supplier</label>
                  <select value={supplierId} onChange={e=>setSupplierId(e.target.value)}>
                    <option value="">Select supplier</option>
                    {suppliers.map(s => <option key={s._id} value={s._id}>{s.supplierName || s.agencyName || s._id}</option>)}
                  </select>
                </div>
                <div className="col">
                  <label>Bank</label>
                  <select value={bankId} onChange={e=>setBankId(e.target.value)}>
                    <option value="">Select bank</option>
                    {banks.map(b => <option key={b._id} value={b._id}>{b.bankName || b.accountNumber || b._id}</option>)}
                  </select>
                </div>
                <div className="col">
                  <label>Supplier Amount</label>
                  <input type="number" value={supplierAmount} onChange={e=>setSupplierAmount(e.target.value)} placeholder="Supplier Amount" />
                </div>
                <div className="col">
                  <label>GST Amount</label>
                  <input type="number" value={gstAmount} onChange={e=>setGstAmount(e.target.value)} placeholder="GST Amount" />
                </div>
                <div className="col">
                  <label>Category</label>
                  <select value={category} onChange={e=>setCategory(e.target.value)}>
                    <option value="">Select category</option>
                    <option value="Accessories">Accessories</option>
                    <option value="Mobile">Mobile</option>
                  </select>
                </div>
              </div>


              <div className="table-scroll mt-3">
                <table className="pretty-table">
                  <thead>
                    <tr>
                      <th>Product No</th>
                      <th>Product Name</th>
                      <th>Brand</th>
                      <th>Model</th>
                      <th>Qty</th>
                      <th>Cost Price</th>
                      <th>Product Validity</th>
                      {category === 'Mobile' && <th style={{width: '220px'}}>IMES No</th>}
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr key={idx}>
                        <td><input value={it.productNo} onChange={e=>updateItem(idx,'productNo',e.target.value)} placeholder="Product No (optional)" /></td>
                        <td><input value={it.productName} onChange={e=>updateItem(idx,'productName',e.target.value)} placeholder="Name" /></td>
                        <td><input value={it.brand} onChange={e=>updateItem(idx,'brand',e.target.value)} placeholder="Brand" /></td>
                        <td><input value={it.model} onChange={e=>updateItem(idx,'model',e.target.value)} placeholder="Model" /></td>
                        <td style={{maxWidth:140}}><input type="number" style={{width:'120px'}} value={it.quantity === undefined ? '' : it.quantity} onChange={e=>updateItem(idx,'quantity',e.target.value)} placeholder="1" /></td>
                        <td><input type="number" value={it.costPrice} onChange={e=>updateItem(idx,'costPrice',e.target.value)} placeholder="0" /></td>
                        <td><input type="date" value={it.validity} onChange={e=>updateItem(idx,'validity',e.target.value)} /></td>
                        {category === 'Mobile' && (
                          <td style={{width: '220px'}}>
                            <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                              {(() => {
                                const qty = Number(it.quantity) || 1;
                                const imesArr = Array.isArray(it.imes) && it.imes.length ? it.imes.slice(0, qty) : Array.from({ length: qty }, () => '');
                                return imesArr.map((im, iim) => (
                                  <input
                                    key={iim}
                                    value={im}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setItems(list => list.map((row, rIdx) => {
                                        if (rIdx !== idx) return row;
                                        const qtyLocal = Number(row.quantity) || 1;
                                        const newImes = Array.isArray(row.imes) ? row.imes.slice(0, qtyLocal) : Array.from({ length: qtyLocal }, () => '');
                                        while (newImes.length < qtyLocal) newImes.push('');
                                        newImes[iim] = val;
                                        return { ...row, imes: newImes };
                                      }));
                                    }}
                                    placeholder={`IMEI ${iim+1}`}
                                    style={{ width: 160 }}
                                  />
                                ));
                              })()}
                            </div>
                          </td>
                        )}
                       
                        <td><button className="btn secondary" type="button" onClick={()=>removeRow(idx)}>Remove</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="row mt-2" style={{justifyContent:'space-between'}}>
                <button className="btn secondary" type="button" onClick={addRowWithImes}>Add Row</button>
              </div>
              <div className="row mt-2" style={{justifyContent:'flex-end'}}>
                <div style={{color:'#9ca3af', marginRight: '32px'}}>
                  Product Amount = qty x cost price (Total: {items.map(it => (Number(it.quantity) || 0) * (Number(it.costPrice) || 0)).reduce((sum, amt) => sum + amt, 0)})<br />
                  Total Bill Amount = Supplier Amount + GST Amount ({(Number(supplierAmount) || 0) + (Number(gstAmount) || 0)})
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" disabled={!canSubmit || saving} onClick={submit}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}


      {validityPopup && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <div style={{fontWeight:800}}>Product Validity</div>
              <button className="btn secondary" onClick={() => setValidityPopup(false)}>Close</button>
            </div>
            <div className="modal-body">
              {validityData.length === 0 ? (
                <div className="text-center" style={{color:'#9ca3af', padding: '32px 0'}}>
                  No products with validity dates found.
                </div>
              ) : (
                <div className="row">
                  {validityData.map((vd, idx) => (
                    <div key={idx} className="col-6" style={{marginBottom:16}}>
                      <div style={{fontWeight:600}}>{vd.productNo}</div>
                      <div style={{color:'#6b7280'}}>{vd.validityDate}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}





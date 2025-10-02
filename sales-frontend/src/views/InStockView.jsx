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
      const storedBranchToken = typeof window !== 'undefined' ? (localStorage.getItem('branch_token') || '') : '';
      const effectiveToken = token || storedBranchToken || '';
      let res = await fetch(salesUrl + '/api/suppliers', { headers: { Authorization: 'Bearer ' + effectiveToken } });
      if (res.status === 401 && storedBranchToken && storedBranchToken !== effectiveToken) {
        res = await fetch(salesUrl + '/api/suppliers', { headers: { Authorization: 'Bearer ' + storedBranchToken } });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load suppliers');
      setSuppliers(Array.isArray(data.suppliers) ? data.suppliers : []);
    } catch (e) { setError(e.message); }
  };
  const loadBanks = async () => {
    try {
      const storedBranchToken = typeof window !== 'undefined' ? (localStorage.getItem('branch_token') || '') : '';
      const effectiveToken = token || storedBranchToken || '';
      const res = await fetch(salesUrl + '/api/banks', { headers: { Authorization: 'Bearer ' + effectiveToken } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load banks');
      setBanks(Array.isArray(data.banks) ? data.banks : []);
    } catch (e) { setError(e.message); }
  };
  const loadEntries = async () => {
    try {
      const storedBranchToken = typeof window !== 'undefined' ? (localStorage.getItem('branch_token') || '') : '';
      const effectiveToken = token || storedBranchToken || '';
      let res = await fetch(salesUrl + '/api/in-stock', { headers: { Authorization: 'Bearer ' + effectiveToken } });
      if (res.status === 401 && storedBranchToken && storedBranchToken !== effectiveToken) {
        res = await fetch(salesUrl + '/api/in-stock', { headers: { Authorization: 'Bearer ' + storedBranchToken } });
      }
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
    <div style={{ padding: '24px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>
          Inventory Management
        </h1>
        <p style={{ color: '#64748b', fontSize: '16px', margin: 0 }}>
          Manage your product inventory with ease
        </p>
      </div>

      {/* Statistics Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: '24px', 
        marginBottom: '32px' 
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '16px',
          padding: '24px',
          color: 'white',
          boxShadow: '0 10px 25px rgba(102, 126, 234, 0.15)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ 
              fontSize: '28px', 
              marginRight: '16px',
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '12px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>📦</div>
            <div>
              <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '4px' }}>Total Products</div>
              <div style={{ fontSize: '28px', fontWeight: '700' }}>
                {entries.reduce((sum, e) => sum + (Array.isArray(e.items) ? e.items.length : 0), 0)}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '14px', opacity: 0.8 }}>Unique items in stock</div>
        </div>
       
        <div style={{
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          borderRadius: '16px',
          padding: '24px',
          color: 'white',
          boxShadow: '0 10px 25px rgba(240, 147, 251, 0.15)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ 
              fontSize: '28px', 
              marginRight: '16px',
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '12px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>📊</div>
            <div>
              <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '4px' }}>Total Quantity</div>
              <div style={{ fontSize: '28px', fontWeight: '700' }}>
                {entries.reduce((sum, e) => sum + (Array.isArray(e.items) ? e.items.reduce((itemSum, it) => itemSum + (Number(it.quantity) || 0), 0) : 0), 0)}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '14px', opacity: 0.8 }}>Items available</div>
        </div>
      </div>


      {/* Action Section */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '32px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          marginBottom: '32px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <h3 style={{ 
              fontSize: '24px', 
              fontWeight: '600', 
              color: '#1e293b',
              marginBottom: '8px'
            }}>Quick Actions</h3>
            <p style={{ 
              color: '#64748b', 
              fontSize: '16px',
              margin: 0
            }}>Manage your inventory operations</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button 
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                transition: 'all 0.2s ease'
              }}
              type="button" 
              onClick={() => setOpen(true)}
              onMouseOver={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
              }}
              onMouseOut={(e) => {
                e.target.style.transform = 'translateY(0px)';
                e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
              }}
            >
              📦 Add New Stock
            </button>

            <button 
              style={{
                background: showRedDot 
                  ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' 
                  : 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                position: 'relative',
                boxShadow: showRedDot 
                  ? '0 4px 12px rgba(240, 147, 251, 0.3)' 
                  : '0 4px 12px rgba(79, 172, 254, 0.3)',
                transition: 'all 0.2s ease'
              }}
              type="button" 
              onClick={handleProductValidity}
              onMouseOver={(e) => {
                e.target.style.transform = 'translateY(-2px)';
              }}
              onMouseOut={(e) => {
                e.target.style.transform = 'translateY(0px)';
              }}
            >
              📅 Product Validity
              {showRedDot && (
                <span style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  width: '12px',
                  height: '12px',
                  backgroundColor: '#ef4444',
                  borderRadius: '50%',
                  border: '2px solid white',
                  animation: 'pulse 2s infinite'
                }}></span>
              )}
            </button>
          </div>
        </div>

        {/* Filter Section */}
        <div>
          <h4 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: '#1e293b',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            🔍 Filter Inventory
          </h4>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '16px'
          }}>
            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '500', 
                color: '#374151',
                marginBottom: '6px'
              }}>Product No</label>
              <input
                type="text"
                placeholder="Search by product number"
                value={filter.productNo}
                onChange={e => handleFilterChange('productNo', e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  transition: 'border-color 0.2s ease',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '500', 
                color: '#374151',
                marginBottom: '6px'
              }}>Product Name</label>
              <input
                type="text"
                placeholder="Search by product name"
                value={filter.productName}
                onChange={e => handleFilterChange('productName', e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  transition: 'border-color 0.2s ease',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '500', 
                color: '#374151',
                marginBottom: '6px'
              }}>Brand</label>
              <input
                type="text"
                placeholder="Search by brand"
                value={filter.brand}
                onChange={e => handleFilterChange('brand', e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  transition: 'border-color 0.2s ease',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '500', 
                color: '#374151',
                marginBottom: '6px'
              }}>Model</label>
              <input
                type="text"
                placeholder="Search by model"
                value={filter.model}
                onChange={e => handleFilterChange('model', e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  transition: 'border-color 0.2s ease',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '500', 
                color: '#374151',
                marginBottom: '6px'
              }}>Product Days</label>
              <input
                type="number"
                placeholder="Days in stock"
                value={filter.productDays}
                onChange={e => handleFilterChange('productDays', e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  transition: 'border-color 0.2s ease',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '500', 
                color: '#374151',
                marginBottom: '6px'
              }}>Quantity</label>
              <input
                type="number"
                placeholder="Filter by quantity"
                value={filter.quantity}
                onChange={e => handleFilterChange('quantity', e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  transition: 'border-color 0.2s ease',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>
          </div>
        </div>
      </div>
      {/* Inventory Table */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '32px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ 
            fontSize: '24px', 
            fontWeight: '600', 
            color: '#1e293b',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            📋 Master Inventory
            {showRedDot && (
              <span style={{
                width: '12px',
                height: '12px',
                backgroundColor: '#ef4444',
                borderRadius: '50%',
                animation: 'pulse 2s infinite'
              }}></span>
            )}
          </h3>
          <p style={{ 
            color: '#64748b', 
            fontSize: '16px',
            margin: 0
          }}>Complete list of all products in your inventory</p>
        </div>

        {filteredEntries.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '64px 24px',
            background: '#f8fafc',
            borderRadius: '12px',
            border: '2px dashed #cbd5e1'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
            <div style={{ fontSize: '20px', fontWeight: '600', color: '#475569', marginBottom: '8px' }}>
              No Inventory Items
            </div>
            <div style={{ color: '#64748b', fontSize: '16px' }}>
              No items match the filter criteria
            </div>
          </div>
        ) : (
          <div style={{ 
            overflowX: 'auto',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            background: '#fff'
          }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              fontSize: '14px'
            }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{
                    padding: '16px 12px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '2px solid #e5e7eb',
                    minWidth: '150px'
                  }}>Supplier</th>
                  <th style={{
                    padding: '16px 12px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '2px solid #e5e7eb',
                    minWidth: '120px'
                  }}>Product No</th>
                  <th style={{
                    padding: '16px 12px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '2px solid #e5e7eb',
                    minWidth: '180px'
                  }}>Product Name</th>
                  <th style={{
                    padding: '16px 12px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '2px solid #e5e7eb',
                    minWidth: '120px'
                  }}>Brand</th>
                  <th style={{
                    padding: '16px 12px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '2px solid #e5e7eb',
                    minWidth: '120px'
                  }}>Model</th>
                  <th style={{
                    padding: '16px 12px',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '2px solid #e5e7eb',
                    width: '80px'
                  }}>Qty</th>
                  <th style={{
                    padding: '16px 12px',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '2px solid #e5e7eb',
                    width: '90px'
                  }}>Total Qty</th>
                  <th style={{
                    padding: '16px 12px',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '2px solid #e5e7eb',
                    minWidth: '120px'
                  }}>IMEI Count</th>
                  <th style={{
                    padding: '16px 12px',
                    textAlign: 'right',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '2px solid #e5e7eb',
                    minWidth: '110px'
                  }}>Cost Price</th>
                  <th style={{
                    padding: '16px 12px',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '2px solid #e5e7eb',
                    minWidth: '120px'
                  }}>Validity</th>
                  <th style={{
                    padding: '16px 12px',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '2px solid #e5e7eb',
                    minWidth: '120px'
                  }}>Days in Stock</th>
                  <th style={{
                    padding: '16px 12px',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '2px solid #e5e7eb',
                    minWidth: '140px'
                  }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.flatMap((e) => (
                  (Array.isArray(e.items) ? e.items : []).map((it, idx) => (
                    <tr key={`${e._id}-${idx}`} style={{
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseOver={(e) => e.target.parentElement.style.backgroundColor = '#f8fafc'}
                    onMouseOut={(e) => e.target.parentElement.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '16px 12px' }}>
                        <div>
                          <div style={{ fontWeight: '500', color: '#1e293b', marginBottom: '2px' }}>
                            {e.supplier_id?.supplierName || 'Unknown Supplier'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>
                            {e.supplier_id?.agencyName || '-'}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <span style={{
                          background: '#f1f5f9',
                          color: '#475569',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontFamily: 'monospace'
                        }}>
                          {it.productNo || '-'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <div style={{ fontWeight: '500', color: '#1e293b' }}>
                          {it.productName || '-'}
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px', color: '#475569' }}>
                        {it.brand || '-'}
                      </td>
                      <td style={{ padding: '16px 12px', color: '#475569' }}>
                        {it.model || '-'}
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                        <span style={{
                          background: '#dbeafe',
                          color: '#1d4ed8',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          {it.quantity ?? 0}
                        </span>
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                        <span style={{
                          background: '#dcfce7',
                          color: '#166534',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          {it.totalQuantity ?? it.quantity ?? 0}
                        </span>
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                        {Array.isArray(it.imes) && it.imes.length ? (
                          <span style={{
                            background: '#fef3c7',
                            color: '#92400e',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '500'
                          }}>
                            {it.imes.length} IMEIs
                          </span>
                        ) : (
                          <span style={{ color: '#9ca3af' }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'right' }}>
                        <span style={{
                          color: '#059669',
                          fontWeight: '600'
                        }}>
                          {new Intl.NumberFormat('en-IN', { 
                            style: 'currency', 
                            currency: 'INR', 
                            maximumFractionDigits: 2 
                          }).format(it.costPrice || 0)}
                        </span>
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                        <div style={{ 
                          color: it.validity ? '#374151' : '#9ca3af',
                          fontSize: '13px'
                        }}>
                          {it.validity ? new Date(it.validity).toLocaleDateString() : '-'}
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                        <span style={{
                          background: '#f3f4f6',
                          color: '#374151',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '12px'
                        }}>
                          {(() => {
                            try {
                              const created = new Date(e.createdAt);
                              if (isNaN(created.getTime())) return '-';
                              const msPerDay = 1000 * 60 * 60 * 24;
                              const days = Math.floor((Date.now() - created.getTime()) / msPerDay) + 1;
                              return `${days} day${days !== 1 ? 's' : ''}`;
                            } catch (err) { return '-'; }
                          })()}
                        </span>
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
                        {new Date(e.createdAt).toLocaleDateString()}
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                          {new Date(e.createdAt).toLocaleTimeString()}
                        </div>
                      </td>
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>


      {open && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '1200px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '24px 32px',
              borderBottom: '1px solid #e5e7eb',
              position: 'sticky',
              top: 0,
              background: 'white',
              borderRadius: '16px 16px 0 0',
              zIndex: 10
            }}>
              <div>
                <h2 style={{ 
                  fontSize: '24px', 
                  fontWeight: '700', 
                  color: '#1e293b',
                  margin: 0,
                  marginBottom: '4px'
                }}>📦 Add New Stock</h2>
                <p style={{ 
                  color: '#64748b', 
                  fontSize: '14px', 
                  margin: 0 
                }}>Add products to your inventory</p>
              </div>
              <button 
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                onClick={() => { setOpen(false); resetModal(); }}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ padding: '32px' }} onKeyDown={(e)=>{ if(e.key==='Enter'){ e.preventDefault(); if(canSubmit && !saving) submit(); } }}>
              {error && (
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  marginBottom: '24px',
                  fontSize: '14px'
                }}>
                  {error}
                </div>
              )}

              {/* Basic Information Section */}
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ 
                  fontSize: '18px', 
                  fontWeight: '600', 
                  color: '#1e293b',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  ℹ️ Basic Information
                </h3>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                  gap: '20px' 
                }}>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '14px', 
                      fontWeight: '500', 
                      color: '#374151',
                      marginBottom: '6px'
                    }}>Supplier *</label>
                    <select 
                      value={supplierId} 
                      onChange={e=>setSupplierId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px',
                        backgroundColor: 'white',
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    >
                      <option value="">Select supplier</option>
                      {suppliers.map(s => (
                        <option key={s._id} value={s._id}>
                          {s.supplierName || s.agencyName || s._id}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '14px', 
                      fontWeight: '500', 
                      color: '#374151',
                      marginBottom: '6px'
                    }}>Bank Account *</label>
                    <select 
                      value={bankId} 
                      onChange={e=>setBankId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px',
                        backgroundColor: 'white',
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    >
                      <option value="">Select bank</option>
                      {banks.map(b => (
                        <option key={b._id} value={b._id}>
                          {b.bankName || b.accountNumber || b._id}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '14px', 
                      fontWeight: '500', 
                      color: '#374151',
                      marginBottom: '6px'
                    }}>Supplier Amount</label>
                    <input 
                      type="number" 
                      value={supplierAmount} 
                      onChange={e=>setSupplierAmount(e.target.value)} 
                      placeholder="0.00"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '14px', 
                      fontWeight: '500', 
                      color: '#374151',
                      marginBottom: '6px'
                    }}>GST Amount</label>
                    <input 
                      type="number" 
                      value={gstAmount} 
                      onChange={e=>setGstAmount(e.target.value)} 
                      placeholder="0.00"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '14px', 
                      fontWeight: '500', 
                      color: '#374151',
                      marginBottom: '6px'
                    }}>Category</label>
                    <select 
                      value={category} 
                      onChange={e=>setCategory(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px',
                        backgroundColor: 'white',
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    >
                      <option value="">Select category</option>
                      <option value="Accessories">Accessories</option>
                      <option value="Mobile">Mobile</option>
                    </select>
                  </div>
                </div>
              </div>


              {/* Products Section */}
              <div style={{ marginBottom: '32px' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginBottom: '16px' 
                }}>
                  <h3 style={{ 
                    fontSize: '18px', 
                    fontWeight: '600', 
                    color: '#1e293b',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    📋 Product Details
                  </h3>
                  <button 
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    type="button" 
                    onClick={addRowWithImes}
                  >
                    ➕ Add Product
                  </button>
                </div>

                <div style={{ 
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  background: '#fff'
                }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ 
                      width: '100%', 
                      borderCollapse: 'collapse',
                      fontSize: '14px'
                    }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          <th style={{
                            padding: '12px',
                            textAlign: 'left',
                            fontWeight: '600',
                            color: '#374151',
                            borderBottom: '1px solid #e5e7eb',
                            minWidth: '120px'
                          }}>Product No</th>
                          <th style={{
                            padding: '12px',
                            textAlign: 'left',
                            fontWeight: '600',
                            color: '#374151',
                            borderBottom: '1px solid #e5e7eb',
                            minWidth: '150px'
                          }}>Product Name *</th>
                          <th style={{
                            padding: '12px',
                            textAlign: 'left',
                            fontWeight: '600',
                            color: '#374151',
                            borderBottom: '1px solid #e5e7eb',
                            minWidth: '100px'
                          }}>Brand</th>
                          <th style={{
                            padding: '12px',
                            textAlign: 'left',
                            fontWeight: '600',
                            color: '#374151',
                            borderBottom: '1px solid #e5e7eb',
                            minWidth: '100px'
                          }}>Model</th>
                          <th style={{
                            padding: '12px',
                            textAlign: 'center',
                            fontWeight: '600',
                            color: '#374151',
                            borderBottom: '1px solid #e5e7eb',
                            width: '80px'
                          }}>Qty</th>
                          <th style={{
                            padding: '12px',
                            textAlign: 'right',
                            fontWeight: '600',
                            color: '#374151',
                            borderBottom: '1px solid #e5e7eb',
                            minWidth: '120px'
                          }}>Cost Price</th>
                          <th style={{
                            padding: '12px',
                            textAlign: 'center',
                            fontWeight: '600',
                            color: '#374151',
                            borderBottom: '1px solid #e5e7eb',
                            minWidth: '130px'
                          }}>Validity</th>
                          {category === 'Mobile' && (
                            <th style={{
                              padding: '12px',
                              textAlign: 'left',
                              fontWeight: '600',
                              color: '#374151',
                              borderBottom: '1px solid #e5e7eb',
                              minWidth: '220px'
                            }}>IMEI Numbers</th>
                          )}
                          <th style={{
                            padding: '12px',
                            textAlign: 'center',
                            fontWeight: '600',
                            color: '#374151',
                            borderBottom: '1px solid #e5e7eb',
                            width: '60px'
                          }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '12px' }}>
                              <input 
                                value={it.productNo} 
                                onChange={e=>updateItem(idx,'productNo',e.target.value)} 
                                placeholder="Auto-generated"
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  outline: 'none'
                                }}
                              />
                            </td>
                            <td style={{ padding: '12px' }}>
                              <input 
                                value={it.productName} 
                                onChange={e=>updateItem(idx,'productName',e.target.value)} 
                                placeholder="Enter product name"
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: '2px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  outline: 'none'
                                }}
                              />
                            </td>
                            <td style={{ padding: '12px' }}>
                              <input 
                                value={it.brand} 
                                onChange={e=>updateItem(idx,'brand',e.target.value)} 
                                placeholder="Brand"
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  outline: 'none'
                                }}
                              />
                            </td>
                            <td style={{ padding: '12px' }}>
                              <input 
                                value={it.model} 
                                onChange={e=>updateItem(idx,'model',e.target.value)} 
                                placeholder="Model"
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  outline: 'none'
                                }}
                              />
                            </td>
                            <td style={{ padding: '12px' }}>
                              <input 
                                type="number" 
                                value={it.quantity === undefined ? '' : it.quantity} 
                                onChange={e=>updateItem(idx,'quantity',e.target.value)} 
                                placeholder="1"
                                min="1"
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  textAlign: 'center',
                                  outline: 'none'
                                }}
                              />
                            </td>
                            <td style={{ padding: '12px' }}>
                              <input 
                                type="number" 
                                value={it.costPrice} 
                                onChange={e=>updateItem(idx,'costPrice',e.target.value)} 
                                placeholder="0.00"
                                step="0.01"
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  textAlign: 'right',
                                  outline: 'none'
                                }}
                              />
                            </td>
                            <td style={{ padding: '12px' }}>
                              <input 
                                type="date" 
                                value={it.validity} 
                                onChange={e=>updateItem(idx,'validity',e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  outline: 'none'
                                }}
                              />
                            </td>
                            {category === 'Mobile' && (
                              <td style={{ padding: '12px' }}>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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
                                        style={{ 
                                          width: '140px',
                                          padding: '6px 8px',
                                          border: '1px solid #d1d5db',
                                          borderRadius: '4px',
                                          fontSize: '12px',
                                          outline: 'none'
                                        }}
                                      />
                                    ));
                                  })()}
                                </div>
                              </td>
                            )}
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <button 
                                style={{
                                  background: '#fee2e2',
                                  color: '#dc2626',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '6px 8px',
                                  fontSize: '12px',
                                  cursor: 'pointer'
                                }}
                                type="button" 
                                onClick={()=>removeRow(idx)}
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Summary Section */}
              <div style={{
                background: '#f8fafc',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                marginBottom: '24px'
              }}>
                <h4 style={{ 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  color: '#1e293b',
                  marginBottom: '12px'
                }}>
                  💰 Amount Summary
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Product Amount</div>
                    <div style={{ fontSize: '18px', fontWeight: '600', color: '#059669' }}>
                      ₹{items.map(it => (Number(it.quantity) || 0) * (Number(it.costPrice) || 0)).reduce((sum, amt) => sum + amt, 0).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>Quantity × Cost Price</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Total Bill Amount</div>
                    <div style={{ fontSize: '18px', fontWeight: '600', color: '#3b82f6' }}>
                      ₹{((Number(supplierAmount) || 0) + (Number(gstAmount) || 0)).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>Supplier Amount + GST Amount</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              padding: '24px 32px',
              borderTop: '1px solid #e5e7eb',
              background: '#f8fafc',
              borderRadius: '0 0 16px 16px'
            }}>
              <button 
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
                onClick={() => { setOpen(false); resetModal(); }}
              >
                Cancel
              </button>
              <button 
                disabled={!canSubmit || saving}
                onClick={submit}
                style={{
                  background: canSubmit && !saving 
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                    : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 24px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: canSubmit && !saving ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {saving ? '💾 Saving...' : '✅ Save Stock'}
              </button>
            </div>
          </div>
        </div>
      )}


      {validityPopup && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '24px 32px',
              borderBottom: '1px solid #e5e7eb',
              position: 'sticky',
              top: 0,
              background: 'white',
              borderRadius: '16px 16px 0 0'
            }}>
              <div>
                <h2 style={{ 
                  fontSize: '24px', 
                  fontWeight: '700', 
                  color: '#1e293b',
                  margin: 0,
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  📅 Product Validity Alert
                </h2>
                <p style={{ 
                  color: '#64748b', 
                  fontSize: '14px', 
                  margin: 0 
                }}>Products expiring within 7 days</p>
              </div>
              <button 
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
                onClick={() => setValidityPopup(false)}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ padding: '32px' }}>
              {validityData.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '48px 24px',
                  background: '#f0fdf4',
                  borderRadius: '12px',
                  border: '1px solid #bbf7d0'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                  <div style={{ fontSize: '20px', fontWeight: '600', color: '#166534', marginBottom: '8px' }}>
                    All Products Fresh!
                  </div>
                  <div style={{ color: '#15803d', fontSize: '16px' }}>
                    No products are expiring within the next 7 days
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{
                    background: '#fef3c7',
                    border: '1px solid #fbbf24',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    marginBottom: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ fontSize: '20px' }}>⚠️</span>
                    <div>
                      <div style={{ fontWeight: '600', color: '#92400e' }}>
                        {validityData.length} product{validityData.length > 1 ? 's' : ''} expiring soon
                      </div>
                      <div style={{ fontSize: '14px', color: '#b45309' }}>
                        Please review and take necessary action
                      </div>
                    </div>
                  </div>

                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
                    gap: '16px' 
                  }}>
                    {validityData.map((vd, idx) => (
                      <div 
                        key={idx} 
                        style={{
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          borderRadius: '12px',
                          padding: '16px',
                          transition: 'transform 0.2s ease'
                        }}
                        onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
                        onMouseOut={(e) => e.target.style.transform = 'translateY(0px)'}
                      >
                        <div style={{ 
                          fontWeight: '600', 
                          color: '#dc2626',
                          marginBottom: '8px',
                          fontSize: '16px'
                        }}>
                          {vd.productNo}
                        </div>
                        <div style={{ 
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          color: '#7f1d1d',
                          fontSize: '14px'
                        }}>
                          <span>📅</span>
                          <span>Expires: {vd.validityDate}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}





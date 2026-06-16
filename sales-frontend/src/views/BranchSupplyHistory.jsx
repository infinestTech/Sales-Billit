function BranchSupplyHistory({ salesUrl, token }) {
  
  // Safe state management
  const [data, setData] = React.useState({
    supplies: [],
    branches: [],
    loading: true,
    error: null
  });
  
  const [branchId, setBranchId] = React.useState('');
  const [filterDate, setFilterDate] = React.useState('');
  const [imesFilter, setImesFilter] = React.useState('');

  // Simple data loading function
  const loadData = React.useCallback(async (bid = '') => {
    try {
      setData(prev => ({ ...prev, loading: true, error: null }));
      
      // Load branches
      const branchesRes = await fetch(salesUrl + '/api/branches', { 
        headers: { Authorization: 'Bearer ' + token } 
      });
      const branchesData = await branchesRes.json();
      
      // Load supplies
      const url = new URL(salesUrl + '/api/branch-supplies');
      if (bid) url.searchParams.set('branch_id', bid);
      const suppliesRes = await fetch(url, { 
        headers: { Authorization: 'Bearer ' + token } 
      });
      const suppliesData = await suppliesRes.json();
      
      setData({
        branches: Array.isArray(branchesData.branches) ? branchesData.branches : [],
        supplies: Array.isArray(suppliesData.supplies) ? suppliesData.supplies : [],
        loading: false,
        error: null
      });
      
    } catch (error) {
      setData(prev => ({ ...prev, loading: false, error: error.message }));
    }
  }, [salesUrl, token]);

  // Load data on mount
  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle branch change
  const onBranchChange = (e) => {
    const id = e.target.value;
    setBranchId(id);
    loadData(id);
  };

  // Pre-process filtered data to avoid function calls in render
  const processedData = React.useMemo(() => {
    // Only include supplies created by admin (exclude branch-created supplies)
    const onlyAdmin = (arr) => (Array.isArray(arr) ? arr.filter(s => String(s.createdByType || '').toLowerCase() === 'admin') : []);

    const baseArr = !filterDate ? data.supplies : data.supplies.filter(supply => {
      const selectedDate = new Date(filterDate).toDateString();
      const supplyDate = new Date(supply.createdAt || supply.updatedAt || new Date()).toDateString();
      return supplyDate === selectedDate;
    });
    const filtered = onlyAdmin(baseArr);

    const flat = [];
    filtered.forEach(s => {
      const when = s.createdAt || s.updatedAt || new Date();
      const supplier = s.supplier_id?.supplierName || s.supplierName || '-';
      (Array.isArray(s.items) ? s.items : []).forEach(it => {
        // prepare IME string and apply IME filter
        const imesStr = Array.isArray(it.imes) ? it.imes.join(',') : '';
        if (imesFilter && imesStr.toLowerCase().indexOf(imesFilter.toLowerCase()) === -1) return;
        flat.push({
          supplier,
          productNo: it.productNo || it.productId || '-',
          productName: it.productName || it.name || '-',
          brand: it.brand || '-',
          model: it.model || '-',
          costPrice: it.costPrice ?? it.cost ?? 0,
          validity: it.validity || null,
          pct: it.pct ?? null,
          unitPrice: it.unitSellingPrice ?? it.sellingPrice ?? 0,
          qty: it.qty ?? 0,
          value: it.value ?? ((it.unitSellingPrice ?? it.sellingPrice ?? 0) * (it.qty ?? 0)),
          when
        });
      });
    });

    return flat;
  }, [data.supplies, filterDate, imesFilter]);

  const currency = (n) => new Intl.NumberFormat('en-IN', { 
    style: 'currency', 
    currency: 'INR', 
    maximumFractionDigits: 2 
  }).format(n || 0);

  if (data.loading) {
    return React.createElement('div', {
      style: { 
        padding: '40px', 
        textAlign: 'center',
        fontSize: '18px',
        color: '#6b7280'
      }
    }, '⏳ Loading Supply History...');
  }

  if (data.error) {
    return React.createElement('div', {
      style: { 
        padding: '20px',
        backgroundColor: '#fee2e2',
        border: '1px solid #fca5a5',
        borderRadius: '8px',
        margin: '20px',
        color: '#dc2626'
      }
    }, '❌ Error: ' + data.error);
  }

  return React.createElement('div', {
    className: 'card table-card'
  }, [
    React.createElement('div', {
      key: 'filters',
      className: 'row',
      style: { padding: '12px 12px 0 12px' }
    }, [
      React.createElement('div', {
        key: 'branch-filter',
        className: 'col'
      }, [
        React.createElement('label', { key: 'label' }, 'Filter by Branch'),
        React.createElement('select', {
          key: 'select',
          value: branchId,
          onChange: onBranchChange
        }, [
          React.createElement('option', { key: 'all', value: '' }, 'All branches'),
          ...data.branches.map(b => 
            React.createElement('option', { 
              key: b._id, 
              value: b._id 
            }, b.name || b._id)
          )
        ])
      ]),
      React.createElement('div', {
        key: 'date-filter',
        className: 'col'
      }, [
        React.createElement('label', { key: 'label' }, 'Filter by Date'),
        React.createElement('input', {
          key: 'input',
          type: 'date',
          value: filterDate,
          onChange: (e) => setFilterDate(e.target.value),
          style: { marginBottom: '12px', padding: '8px', width: '100%' }
        })
      ])
    ]),

    // IME filter row
    React.createElement('div', { key: 'ime-filter', className: 'row', style: { padding: '6px 12px 0 12px' } }, [
      React.createElement('div', { key: 'ime-col', className: 'col' }, [
        React.createElement('label', { key: 'imelabel' }, 'Filter by IME'),
        React.createElement('input', { key: 'imeinput', type: 'text', value: imesFilter, onChange: (e) => setImesFilter(e.target.value), style: { marginBottom: '12px', padding: '8px', width: '100%' } })
      ])
    ]),

    React.createElement('div', {
      key: 'content',
      className: 'table-scroll'
    }, (
      processedData.length === 0 ? 
        React.createElement('div', {
          style: { 
            textAlign: 'center', 
            padding: '40px',
            color: '#6b7280'
          }
        }, [
          React.createElement('div', { 
            key: 'icon',
            style: { fontSize: '48px', marginBottom: '16px' }
          }, '📦'),
          React.createElement('p', { 
            key: 'msg',
            style: { margin: '0' }
          }, 'No supply history found')
        ]) :
        React.createElement('table', {
          className: 'modern-table'
        }, [
          React.createElement('thead', { key: 'thead' }, 
            React.createElement('tr', {}, [
             
              React.createElement('th', { key: 'productNo' }, 'Product No'),
              React.createElement('th', { key: 'product' }, 'Product Name'),
              React.createElement('th', { key: 'brand' }, 'Brand'),
              React.createElement('th', { key: 'model' }, 'Model'),
              React.createElement('th', { key: 'cost' }, 'Cost Price'),
              React.createElement('th', { key: 'validity' }, 'Product Validity'),
              React.createElement('th', { key: 'selling' }, 'Selling Price (pct / price)'),
              React.createElement('th', { key: 'unit' }, 'Unit Price'),
              React.createElement('th', { key: 'qty' }, 'Supply Qty'),
              React.createElement('th', { key: 'value' }, 'Supply Value'),
              React.createElement('th', { key: 'date' }, 'Sending Date & Time')
            ])
          ),
          React.createElement('tbody', { key: 'tbody' }, 
                processedData.map((r, i) => 
              React.createElement('tr', { key: i }, [
                React.createElement('td', { key: 'productNo' }, r.productNo),
                React.createElement('td', { key: 'product' }, r.productName),
                React.createElement('td', { key: 'brand' }, r.brand),
                React.createElement('td', { key: 'model' }, r.model),
                React.createElement('td', { key: 'cost' }, 
                  r.costPrice != null ? currency(r.costPrice) : '-'
                ),
                React.createElement('td', { key: 'validity' }, 
                  r.validity ? new Date(r.validity).toLocaleDateString() : '-'
                ),
                React.createElement('td', { key: 'selling' }, 
                  r.pct != null ? `${r.pct}% / ${currency(r.unitPrice)}` : '-'
                ),
                React.createElement('td', { key: 'unit' }, currency(r.unitPrice)),
                React.createElement('td', { key: 'qty' }, r.qty),
                React.createElement('td', { key: 'value' }, currency(r.value)),
                React.createElement('td', { key: 'date' }, new Date(r.when).toLocaleString())
              ])
            )
          )
        ])
    )),

    data.error ? React.createElement('div', {
      key: 'error',
      className: 'mt-2 text-danger',
      style: { padding: '0 12px 12px' }
    }, data.error) : null
  ]);
}

// Register component directly without wrapper to prevent infinite loops
window.BranchSupplyHistory = BranchSupplyHistory;

function BankHistory({ salesUrl, token }) {
  
  // Use basic state management
  const [data, setData] = React.useState({
    banks: [],
    transactions: [],
    loading: true,
    error: null
  });
  // Filters
  const [bankFilter, setBankFilter] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('');
  const [referenceFilter, setReferenceFilter] = React.useState('');

  const normalizeReference = (ref) => {
    if (!ref) return ref;
    // Remove trailing Mongo/ObjectId-like token at the end (space + 24 hex chars)
    // e.g. "InStock payment for supplier 68cd09fcf5d4f275fc0e9bdc" -> "InStock payment for supplier"
    return ref.replace(/\s[0-9a-fA-F]{24}$/, '').trim();
  };
  
  // Use basic refs for filters to avoid state update loops
  const bankIdRef = React.useRef('');
  const typeFilterRef = React.useRef('');
  
  // Simple data loading function
  const loadData = React.useCallback(async () => {
    try {
      setData(prev => ({ ...prev, loading: true, error: null }));
      
      // Load banks
      const banksRes = await fetch(salesUrl + '/api/banks', { 
        headers: { Authorization: 'Bearer ' + token } 
      });
      const banksData = await banksRes.json();
      
      // Load transactions  
      const txnsRes = await fetch(salesUrl + '/api/bank-transactions', { 
        headers: { Authorization: 'Bearer ' + token } 
      });
      const txnsData = await txnsRes.json();
      
      setData({
        banks: Array.isArray(banksData.banks) ? banksData.banks : [],
        transactions: Array.isArray(txnsData.transactions) ? txnsData.transactions : [],
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
  
  if (data.loading) {
    return React.createElement('div', {
      style: { 
        padding: '40px', 
        textAlign: 'center',
        fontSize: '18px',
        color: '#6b7280'
      }
    }, '⏳ Loading Payment History...');
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
    style: { padding: '20px' }
  }, [
    React.createElement('h2', { 
      key: 'title',
      style: { marginBottom: '20px', color: '#1f2937' }
    }, '🏦 Payment History'),
    // Filters row
    React.createElement('div', {
      key: 'filters',
      style: { display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }
    }, [
      React.createElement('div', { key: 'bankFilterWrap', style: { minWidth: 200 } }, [
        React.createElement('label', { key: 'bankLabel', style: { display: 'block', fontSize: 12, color: '#6b7280' } }, 'Bank'),
        React.createElement('select', {
          key: 'bankSelect',
          value: bankFilter,
          onChange: e => setBankFilter(e.target.value),
          style: { width: '100%', padding: '8px', borderRadius: 4 }
        }, [
          React.createElement('option', { key: '__all', value: '' }, '-- All Banks --'),
          ...data.banks.map(b => React.createElement('option', { key: b._id, value: b._id }, b.bankName || b.name || b._id))
        ])
      ]),

      React.createElement('div', { key: 'typeFilterWrap', style: { minWidth: 160 } }, [
        React.createElement('label', { key: 'typeLabel', style: { display: 'block', fontSize: 12, color: '#6b7280' } }, 'Type'),
        React.createElement('select', {
          key: 'typeSelect',
          value: typeFilter,
          onChange: e => setTypeFilter(e.target.value),
          style: { width: '100%', padding: '8px', borderRadius: 4 }
        }, [
          React.createElement('option', { key: '__all_t', value: '' }, '-- All Types --'),
          ...Array.from(new Set(data.transactions.map(t => t.type).filter(Boolean))).map(t => React.createElement('option', { key: t, value: t }, t))
        ])
      ]),

      React.createElement('div', { key: 'refFilterWrap', style: { minWidth: 220 } }, [
        React.createElement('label', { key: 'refLabel', style: { display: 'block', fontSize: 12, color: '#6b7280' } }, 'Reference'),
        React.createElement('select', {
          key: 'refSelect',
          value: referenceFilter,
          onChange: e => setReferenceFilter(e.target.value),
          style: { width: '100%', padding: '8px', borderRadius: 4 }
        }, [
          React.createElement('option', { key: '__all_r', value: '' }, '-- All References --'),
          ...Array.from(new Set(data.transactions.map(t => normalizeReference(t.reference)).filter(Boolean))).map(r => React.createElement('option', { key: r, value: r }, r))
        ])
      ])
    ]),
    
    React.createElement('div', {
      key: 'stats',
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }
    }, [
      React.createElement('div', {
        key: 'total',
        style: {
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '16px'
        }
      }, [
        React.createElement('h3', { 
          key: 'label',
          style: { margin: '0 0 8px 0', color: '#6b7280', fontSize: '14px' }
        }, 'Total Transactions'),
        React.createElement('p', { 
          key: 'value',
          style: { margin: '0', fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }
        }, data.transactions.length)
      ]),
      
      React.createElement('div', {
        key: 'banks',
        style: {
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '16px'
        }
      }, [
        React.createElement('h3', { 
          key: 'label',
          style: { margin: '0 0 8px 0', color: '#6b7280', fontSize: '14px' }
        }, 'Connected Banks'),
        React.createElement('p', { 
          key: 'value',
          style: { margin: '0', fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }
        }, data.banks.length)
      ])
    ]),
    
    React.createElement('div', {
      key: 'content',
      style: {
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '20px'
      }
    }, [
      React.createElement('h3', { 
        key: 'subtitle',
        style: { marginTop: '0', marginBottom: '16px', color: '#1f2937' }
      }, 'Recent Transactions'),
      
      // Apply client-side filters
      (() => {
        const byBank = bankFilter ? data.transactions.filter(t => t.bank_id?._id === bankFilter) : data.transactions;
        const byType = typeFilter ? byBank.filter(t => t.type === typeFilter) : byBank;
        const byRef = referenceFilter ? byType.filter(t => t.reference === referenceFilter) : byType;
        const filtered = byRef;
        return filtered.length === 0 ?
        React.createElement('div', {
          key: 'empty',
          style: { 
            textAlign: 'center', 
            padding: '40px',
            color: '#6b7280'
          }
        }, [
          React.createElement('div', { 
            key: 'icon',
            style: { fontSize: '48px', marginBottom: '16px' }
          }, '💳'),
          React.createElement('p', { 
            key: 'msg',
            style: { margin: '0' }
          }, 'No transactions found')
        ]) :
        React.createElement('div', {
          key: 'table',
          style: { overflowX: 'auto' }
        }, React.createElement('table', {
          style: { 
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '14px'
          }
        }, [
          React.createElement('thead', { key: 'thead' }, 
            React.createElement('tr', {}, [
              React.createElement('th', { 
                key: 'date',
                style: { padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }
              }, 'Date'),
              React.createElement('th', { 
                key: 'bank',
                style: { padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }
              }, 'Bank'),
              React.createElement('th', { 
                key: 'type',
                style: { padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }
              }, 'Type'),
              React.createElement('th', { 
                key: 'reference',
                style: { padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }
              }, 'Reference'),
              React.createElement('th', { 
                key: 'supplier',
                style: { padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }
              }, 'Supplier'),
              React.createElement('th', { 
                key: 'amount',
                style: { padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }
              }, 'Amount')
            ])
          ),
          React.createElement('tbody', { key: 'tbody' }, 
            filtered.slice(0, 10).map((txn, index) => 
              React.createElement('tr', { key: txn._id || index }, [
                React.createElement('td', { 
                  key: 'date',
                  style: { padding: '12px', borderBottom: '1px solid #f3f4f6' }
                }, new Date(txn.createdAt).toLocaleDateString()),
                React.createElement('td', { 
                  key: 'bank',
                  style: { padding: '12px', borderBottom: '1px solid #f3f4f6' }
                }, txn.bank_id?.bankName || 'Unknown'),
                React.createElement('td', { 
                  key: 'type',
                  style: { padding: '12px', borderBottom: '1px solid #f3f4f6' }
                }, txn.type || 'Unknown'),
                React.createElement('td', { 
                  key: 'reference',
                  style: { padding: '12px', borderBottom: '1px solid #f3f4f6' }
                }, normalizeReference(txn.reference) || '-'),
                React.createElement('td', { 
                  key: 'supplier',
                  style: { padding: '12px', borderBottom: '1px solid #f3f4f6' }
                }, txn.supplier_id?.supplierName || '-'),
                React.createElement('td', { 
                  key: 'amount',
                  style: { 
                    padding: '12px', 
                    borderBottom: '1px solid #f3f4f6',
                    textAlign: 'right',
                    color: txn.amount >= 0 ? '#059669' : '#dc2626',
                    fontWeight: 'bold'
                  }
                }, '₹' + (txn.amount || 0).toLocaleString())
              ])
            )
          )
        ]))
      })()
    ])
  ]);
}

// COMPLETELY REMOVE THE WRAPPER - REGISTER COMPONENT DIRECTLY
window.BankHistory = BankHistory;

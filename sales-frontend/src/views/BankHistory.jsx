function BankHistory({ salesUrl, token }) {
  
  // Use basic state management
  const [data, setData] = React.useState({
    banks: [],
    transactions: [],
    loading: true,
    error: null
  });
  
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
      
      data.transactions.length === 0 ? 
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
                key: 'reference',
                style: { padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }
              }, 'Reference'),
              React.createElement('th', { 
                key: 'supplier',
                style: { padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }
              }, 'Supplier'),
              React.createElement('th', { 
                key: 'type',
                style: { padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }
              }, 'Type'),
              React.createElement('th', { 
                key: 'amount',
                style: { padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }
              }, 'Amount')
            ])
          ),
          React.createElement('tbody', { key: 'tbody' }, 
            data.transactions.slice(0, 10).map((txn, index) => 
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
                  key: 'reference',
                  style: { padding: '12px', borderBottom: '1px solid #f3f4f6', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
                }, txn.reference || '-'),
                React.createElement('td', { 
                  key: 'supplier',
                  style: { padding: '12px', borderBottom: '1px solid #f3f4f6' }
                }, (txn.supplier_id && (txn.supplier_id.supplierName || txn.supplier_id.name)) || '-'),
                React.createElement('td', { 
                  key: 'type',
                  style: { padding: '12px', borderBottom: '1px solid #f3f4f6' }
                }, txn.type || 'Unknown'),
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
    ])
  ]);
}

// COMPLETELY REMOVE THE WRAPPER - REGISTER COMPONENT DIRECTLY
window.BankHistory = BankHistory;

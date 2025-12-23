function MobileBankHistory({ salesUrl, token }) {
  const [data, setData] = React.useState({
    banks: [],
    transactions: [],
    loading: true,
    error: null
  });
  
  const [bankFilter, setBankFilter] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('');
  const [referenceFilter, setReferenceFilter] = React.useState('');
  const [expandedTx, setExpandedTx] = React.useState(null);

  const normalizeReference = (ref) => {
    if (!ref) return ref;
    return ref.replace(/\s[0-9a-fA-F]{24}$/, '').trim();
  };
  
  const loadData = React.useCallback(async () => {
    try {
      setData(prev => ({ ...prev, loading: true, error: null }));
      
      const banksRes = await fetch(salesUrl + '/api/banks', { 
        headers: { Authorization: 'Bearer ' + token } 
      });
      const banksData = await banksRes.json();
      
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
  
  React.useEffect(() => {
    loadData();
  }, [loadData]);
  
  if (data.loading) {
    return React.createElement('div', {
      className: 'mobile-content',
      style: { 
        padding: '40px 20px',
        textAlign: 'center',
        fontSize: '16px',
        color: '#6b7280'
      }
    }, '⏳ Loading Payment History...');
  }
  
  if (data.error) {
    return React.createElement('div', {
      className: 'mobile-content',
      style: { padding: '16px' }
    }, 
      React.createElement('div', {
        style: { 
          padding: '16px',
          backgroundColor: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: '12px',
          color: '#dc2626'
        }
      }, '❌ Error: ' + data.error)
    );
  }

  // Apply filters
  let filtered = data.transactions;
  if (bankFilter) {
    filtered = filtered.filter(t => t.bank_id?._id === bankFilter);
  }
  if (typeFilter) {
    filtered = filtered.filter(t => t.type === typeFilter);
  }
  if (referenceFilter) {
    filtered = filtered.filter(t => normalizeReference(t.reference) === referenceFilter);
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '₹0';
    return '₹' + parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return React.createElement('div', {
    className: 'mobile-content',
    style: { 
      padding: '12px',
      paddingBottom: '80px',
      minHeight: '100vh',
      backgroundColor: '#f9fafb'
    }
  }, [
    // Header
    React.createElement('div', {
      key: 'header',
      style: {
        background: '#fff',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }
    }, [
      React.createElement('h2', { 
        key: 'title',
        style: { 
          margin: '0 0 4px 0',
          fontSize: '20px',
          fontWeight: '600',
          color: '#1f2937'
        }
      }, '🏦 Payment History'),
      React.createElement('p', {
        key: 'subtitle',
        style: {
          margin: 0,
          fontSize: '14px',
          color: '#6b7280'
        }
      }, 'View all payment transactions and bank history')
    ]),

    // Stats Cards
    React.createElement('div', {
      key: 'stats',
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        marginBottom: '12px'
      }
    }, [
      React.createElement('div', {
        key: 'total',
        style: {
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px',
          padding: '16px',
          color: '#fff'
        }
      }, [
        React.createElement('div', { 
          key: 'icon',
          style: { fontSize: '24px', marginBottom: '8px' }
        }, '📊'),
        React.createElement('div', { 
          key: 'label',
          style: { fontSize: '12px', opacity: 0.9, marginBottom: '4px' }
        }, 'Total Transactions'),
        React.createElement('div', { 
          key: 'value',
          style: { fontSize: '24px', fontWeight: 'bold' }
        }, filtered.length)
      ]),
      
      React.createElement('div', {
        key: 'banks',
        style: {
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          borderRadius: '12px',
          padding: '16px',
          color: '#fff'
        }
      }, [
        React.createElement('div', { 
          key: 'icon',
          style: { fontSize: '24px', marginBottom: '8px' }
        }, '🏦'),
        React.createElement('div', { 
          key: 'label',
          style: { fontSize: '12px', opacity: 0.9, marginBottom: '4px' }
        }, 'Connected Banks'),
        React.createElement('div', { 
          key: 'value',
          style: { fontSize: '24px', fontWeight: 'bold' }
        }, data.banks.length)
      ])
    ]),

    // Filters Section - MOBILE OPTIMIZED
    React.createElement('div', {
      key: 'filters',
      style: {
        background: '#fff',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '12px'
      }
    }, [
      React.createElement('h3', {
        key: 'filter-title',
        style: {
          margin: '0 0 12px 0',
          fontSize: '16px',
          fontWeight: '600',
          color: '#1f2937'
        }
      }, '🔍 Filters'),

      // Bank Filter
      React.createElement('div', {
        key: 'bank-filter',
        className: 'form-group',
        style: { marginBottom: '12px' }
      }, [
        React.createElement('label', {
          key: 'label',
          className: 'form-label',
          style: { 
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            marginBottom: '6px',
            color: '#374151'
          }
        }, 'Bank'),
        React.createElement('select', {
          key: 'select',
          value: bankFilter,
          onChange: e => setBankFilter(e.target.value),
          style: {
            width: '100%',
            padding: '12px',
            fontSize: '16px', // Prevent iOS zoom
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            backgroundColor: '#fff',
            color: '#1f2937',
            // MOBILE FIX: Ensure dropdown appears properly
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
            backgroundSize: '20px',
            paddingRight: '40px'
          }
        }, [
          React.createElement('option', { key: '__all', value: '' }, '-- All Banks --'),
          ...data.banks.map(b => 
            React.createElement('option', { 
              key: b._id, 
              value: b._id 
            }, b.bankName || b.name || b._id)
          )
        ])
      ]),

      // Type Filter
      React.createElement('div', {
        key: 'type-filter',
        className: 'form-group',
        style: { marginBottom: '12px' }
      }, [
        React.createElement('label', {
          key: 'label',
          className: 'form-label',
          style: { 
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            marginBottom: '6px',
            color: '#374151'
          }
        }, 'Type'),
        React.createElement('select', {
          key: 'select',
          value: typeFilter,
          onChange: e => setTypeFilter(e.target.value),
          style: {
            width: '100%',
            padding: '12px',
            fontSize: '16px',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            backgroundColor: '#fff',
            color: '#1f2937',
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
            backgroundSize: '20px',
            paddingRight: '40px'
          }
        }, [
          React.createElement('option', { key: '__all_t', value: '' }, '-- All Types --'),
          ...Array.from(new Set(data.transactions.map(t => t.type).filter(Boolean))).map(t => 
            React.createElement('option', { key: t, value: t }, t)
          )
        ])
      ]),

      // Reference Filter
      React.createElement('div', {
        key: 'ref-filter',
        className: 'form-group',
        style: { marginBottom: 0 }
      }, [
        React.createElement('label', {
          key: 'label',
          className: 'form-label',
          style: { 
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            marginBottom: '6px',
            color: '#374151'
          }
        }, 'Reference'),
        React.createElement('select', {
          key: 'select',
          value: referenceFilter,
          onChange: e => setReferenceFilter(e.target.value),
          style: {
            width: '100%',
            padding: '12px',
            fontSize: '16px',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            backgroundColor: '#fff',
            color: '#1f2937',
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
            backgroundSize: '20px',
            paddingRight: '40px'
          }
        }, [
          React.createElement('option', { key: '__all_r', value: '' }, '-- All References --'),
          ...Array.from(new Set(data.transactions.map(t => normalizeReference(t.reference)).filter(Boolean))).map(r => 
            React.createElement('option', { key: r, value: r }, r)
          )
        ])
      ])
    ]),

    // Transactions List
    React.createElement('div', {
      key: 'transactions-header',
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
        padding: '0 4px'
      }
    }, [
      React.createElement('h3', {
        key: 'title',
        style: {
          margin: 0,
          fontSize: '16px',
          fontWeight: '600',
          color: '#1f2937'
        }
      }, 'Recent Transactions'),
      filtered.length > 0 && React.createElement('span', {
        key: 'count',
        style: {
          fontSize: '14px',
          color: '#6b7280',
          backgroundColor: '#f3f4f6',
          padding: '4px 12px',
          borderRadius: '12px'
        }
      }, filtered.length + ' found')
    ]),

    // Transaction Cards
    filtered.length === 0 
      ? React.createElement('div', {
          key: 'no-data',
          style: {
            background: '#fff',
            borderRadius: '12px',
            padding: '40px 20px',
            textAlign: 'center',
            color: '#6b7280'
          }
        }, [
          React.createElement('div', {
            key: 'icon',
            style: { fontSize: '48px', marginBottom: '12px' }
          }, '📭'),
          React.createElement('div', {
            key: 'text',
            style: { fontSize: '16px' }
          }, 'No transactions found')
        ])
      : filtered.slice(0, 50).map((tx, idx) => 
          React.createElement('div', {
            key: tx._id || idx,
            style: {
              background: '#fff',
              borderRadius: '12px',
              marginBottom: '12px',
              overflow: 'hidden',
              border: '1px solid #e5e7eb'
            }
          }, [
            // Transaction Header (always visible)
            React.createElement('div', {
              key: 'header',
              onClick: () => setExpandedTx(expandedTx === tx._id ? null : tx._id),
              style: {
                padding: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                backgroundColor: expandedTx === tx._id ? '#f9fafb' : '#fff'
              }
            }, [
              React.createElement('div', {
                key: 'left',
                style: { flex: 1 }
              }, [
                React.createElement('div', {
                  key: 'bank',
                  style: {
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#1f2937',
                    marginBottom: '4px'
                  }
                }, tx.bank_id?.bankName || tx.bank_id?.name || 'Unknown Bank'),
                React.createElement('div', {
                  key: 'date',
                  style: {
                    fontSize: '14px',
                    color: '#6b7280'
                  }
                }, formatDate(tx.date))
              ]),
              React.createElement('div', {
                key: 'right',
                style: {
                  textAlign: 'right'
                }
              }, [
                React.createElement('div', {
                  key: 'amount',
                  style: {
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: tx.type === 'debit' ? '#dc2626' : '#059669',
                    marginBottom: '4px'
                  }
                }, (tx.type === 'debit' ? '- ' : '+ ') + formatCurrency(tx.amount)),
                React.createElement('div', {
                  key: 'type',
                  style: {
                    fontSize: '12px',
                    padding: '2px 8px',
                    borderRadius: '8px',
                    display: 'inline-block',
                    backgroundColor: tx.type === 'debit' ? '#fee2e2' : '#d1fae5',
                    color: tx.type === 'debit' ? '#dc2626' : '#059669'
                  }
                }, tx.type || 'N/A')
              ])
            ]),

            // Expanded Details
            expandedTx === tx._id && React.createElement('div', {
              key: 'details',
              style: {
                padding: '16px',
                paddingTop: '0',
                borderTop: '1px solid #e5e7eb',
                backgroundColor: '#f9fafb'
              }
            }, [
              React.createElement('div', {
                key: 'ref',
                style: {
                  marginBottom: '12px',
                  padding: '12px',
                  backgroundColor: '#fff',
                  borderRadius: '8px'
                }
              }, [
                React.createElement('div', {
                  key: 'label',
                  style: {
                    fontSize: '12px',
                    color: '#6b7280',
                    marginBottom: '4px'
                  }
                }, 'Reference'),
                React.createElement('div', {
                  key: 'value',
                  style: {
                    fontSize: '14px',
                    color: '#1f2937',
                    wordBreak: 'break-word'
                  }
                }, normalizeReference(tx.reference) || 'N/A')
              ]),
              tx.notes && React.createElement('div', {
                key: 'notes',
                style: {
                  padding: '12px',
                  backgroundColor: '#fef3c7',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: '#92400e'
                }
              }, [
                React.createElement('strong', { key: 'label' }, '📝 Notes: '),
                tx.notes
              ])
            ])
          ])
        )
  ]);
}

window.MobileBankHistory = MobileBankHistory;

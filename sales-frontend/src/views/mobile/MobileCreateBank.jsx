// Mobile-optimized CreateBank view
function MobileCreateBank({ salesUrl, token }) {
  const [form, setForm] = React.useState({
    bankName: '', accountNumber: '', holderName: '', address: '', phoneNumber: '', accountBalance: ''
  });
  const [rows, setRows] = React.useState([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  // Feature context
  const { features, getFeatureLimit, isLimitReached } = window.useSalesFeatures ? window.useSalesFeatures() : { 
    features: {}, 
    getFeatureLimit: () => 999, 
    isLimitReached: () => false 
  };

  const bankLimit = getFeatureLimit('bank_accounts_limit', 'maxBankAccounts');
  const [remoteBankLimit, setRemoteBankLimit] = React.useState(null);
  const currentBankCount = rows.length;
  const effectiveBankLimit = (typeof remoteBankLimit === 'number' && remoteBankLimit >= 0) ? remoteBankLimit : bankLimit;
  const isAtLimit = effectiveBankLimit > 0 ? (currentBankCount >= effectiveBankLimit) : false;

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const fetchBanks = async () => {
    try {
      setError('');
      const res = await fetch(salesUrl + '/api/banks', { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load');
      const list = Array.isArray(data.banks) ? data.banks : [];
      setRows(list);
    } catch (err) {
      setError(err.message);
    }
  };

  React.useEffect(() => { fetchBanks(); }, [token]);

  React.useEffect(() => {
    let mounted = true;
    const fetchLimit = async () => {
      try {
        if (!token || (bankLimit && bankLimit > 0)) return;
        const res = await fetch(salesUrl + '/api/user/features/bank_accounts_limit/limits', { headers: { Authorization: 'Bearer ' + token } });
        if (!res.ok) return;
        const data = await res.json();
        const val = data?.limits?.maxBankAccounts;
        if (mounted && typeof val === 'number') setRemoteBankLimit(Number(val));
      } catch (err) { }
    };
    fetchLimit();
    return () => { mounted = false; };
  }, [token, salesUrl, bankLimit]);

  const submit = async (e) => {
    e.preventDefault();
    
    if (isAtLimit) {
      window.checkSalesFeatureLimit('bank_accounts_limit', 'maxBankAccounts', currentBankCount, features, 'Bank Account');
      return;
    }
    
    setSaving(true);
    setError('');
    try {
      const res = await fetch(salesUrl + '/api/banks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          bankName: form.bankName,
          accountNumber: form.accountNumber,
          holderName: form.holderName,
          address: form.address,
          phoneNumber: form.phoneNumber,
          accountBalance: form.accountBalance !== '' ? Number(form.accountBalance) : undefined,
          branchName: localStorage.getItem('branch_token') ? (function(){ try{ const p = JSON.parse(atob(localStorage.getItem('branch_token').split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); return p.name || ''; }catch(e){return '';} })() : undefined
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Save failed');
      setForm({ bankName: '', accountNumber: '', holderName: '', address: '', phoneNumber: '', accountBalance: '' });
      await fetchBanks();
    } catch (err) {
      setError(err.message);
    } finally { setSaving(false); }
  };

  const totalBalance = React.useMemo(() => rows.reduce((sum, r) => {
    const val = typeof r.accountBalance === 'number' ? r.accountBalance : Number(r.accountBalance);
    return sum + (Number.isFinite(val) ? val : 0);
  }, 0), [rows]);
  
  const formatCurrency = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

  return (
    <div className="mobile-content">
      {/* Limit Warning */}
      {React.createElement(window.LimitGuard, {
        featureKey: 'bank_accounts_limit',
        limitKey: 'maxBankAccounts',
        currentCount: currentBankCount,
        featureName: 'Bank Account',
        showWarningAt: 0.8
      }, null)}
      
      {/* Create Form Card */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">💳 Add Payment Method</h3>
          <p className="card-description">
            {bankLimit < 999 && `${currentBankCount}/${bankLimit} used`}
          </p>
        </div>
        
        {isAtLimit && (
          <div style={{
            backgroundColor: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            padding: '12px',
            margin: '16px 0',
            color: '#991b1b',
            fontSize: '14px'
          }}>
            🚫 Bank account limit reached ({currentBankCount}/{bankLimit}). 
            <button 
              onClick={() => window.open('/pricing', '_blank')}
              style={{
                marginLeft: '8px',
                color: '#1d4ed8',
                textDecoration: 'underline',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Upgrade
            </button>
          </div>
        )}
        
        <form onSubmit={submit} style={{ padding: '16px' }}>
          <div className="form-group mobile-mb-3">
            <label className="form-label">Bank Name</label>
            <input 
              name="bankName" 
              value={form.bankName} 
              onChange={onChange} 
              placeholder="e.g., State Bank of India" 
              className="form-input"
              required
            />
          </div>
          
          <div className="form-group mobile-mb-3">
            <label className="form-label">Account Number</label>
            <input 
              name="accountNumber" 
              value={form.accountNumber} 
              onChange={onChange} 
              placeholder="Account number" 
              className="form-input"
            />
          </div>
          
          <div className="form-group mobile-mb-3">
            <label className="form-label">Holder Name</label>
            <input 
              name="holderName" 
              value={form.holderName} 
              onChange={onChange} 
              placeholder="Account holder name" 
              className="form-input"
            />
          </div>
          
          <div className="form-group mobile-mb-3">
            <label className="form-label">Address</label>
            <input 
              name="address" 
              value={form.address} 
              onChange={onChange} 
              placeholder="Branch address" 
              className="form-input"
            />
          </div>
          
          <div className="form-group mobile-mb-3">
            <label className="form-label">Phone Number</label>
            <input 
              name="phoneNumber" 
              value={form.phoneNumber} 
              onChange={onChange} 
              placeholder="Contact number" 
              className="form-input"
              type="tel"
            />
          </div>
          
          <div className="form-group mobile-mb-3">
            <label className="form-label">Initial Balance (Optional)</label>
            <input 
              name="accountBalance" 
              value={form.accountBalance} 
              onChange={onChange} 
              placeholder="0" 
              className="form-input"
              type="number"
              step="0.01"
            />
          </div>
          
          {error && (
            <div className="alert alert-danger mobile-mb-3" style={{ fontSize: '14px' }}>
              ⚠️ {error}
            </div>
          )}
          
          <button 
            type="submit" 
            className="btn btn-primary mobile-w-full" 
            disabled={saving || isAtLimit}
          >
            {saving ? '💾 Saving...' : '💾 Save Payment Method'}
          </button>
        </form>
      </div>

      {/* Banks List */}
      <div className="card mobile-mt-3">
        <div className="card-header">
          <h3 className="card-title">💰 Your Payment Methods</h3>
          <p className="card-description">Total Balance: {formatCurrency(totalBalance)}</p>
        </div>
        
        <div className="mobile-overflow-x-auto">
          {rows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💳</div>
              <div className="empty-title">No Payment Methods</div>
              <div className="empty-sub">Add your first payment method above</div>
            </div>
          ) : (
            <div style={{ padding: '16px' }}>
              {rows.map((bank, idx) => (
                <div key={bank._id || idx} style={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    marginBottom: '12px'
                  }}>
                    <div>
                      <h4 style={{ 
                        fontSize: '16px', 
                        fontWeight: '600', 
                        color: '#1e293b',
                        margin: '0 0 4px 0'
                      }}>
                        💳 {bank.bankName}
                      </h4>
                      <p style={{ 
                        fontSize: '13px', 
                        color: '#64748b',
                        margin: 0
                      }}>
                        {bank.accountNumber}
                      </p>
                    </div>
                    <div style={{
                      fontSize: '18px',
                      fontWeight: '700',
                      color: '#059669'
                    }}>
                      {formatCurrency(bank.accountBalance)}
                    </div>
                  </div>
                  
                  <div style={{ fontSize: '13px', color: '#64748b' }}>
                    <div style={{ marginBottom: '4px' }}>
                      👤 {bank.holderName}
                    </div>
                    {bank.phoneNumber && (
                      <div style={{ marginBottom: '4px' }}>
                        📞 {bank.phoneNumber}
                      </div>
                    )}
                    {bank.address && (
                      <div>
                        📍 {bank.address}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Register globally
window.MobileCreateBank = MobileCreateBank;

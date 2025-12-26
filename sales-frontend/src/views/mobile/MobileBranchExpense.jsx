function MobileBranchExpense({ salesUrl, token, adminUrl, branchUser }) {
  const [form, setForm] = React.useState({ title: '', amount: '', date: '', bank_id: '', branch_id: '' });
  const [banks, setBanks] = React.useState([]);
  const [branches, setBranches] = React.useState([]);
  const [selectedBank, setSelectedBank] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [rows, setRows] = React.useState([]);
  const [sales, setSales] = React.useState([]);
  const [selectedDate, setSelectedDate] = React.useState('');
  const [summary, setSummary] = React.useState({ salesRevenue: 0, stockRevenue: 0, totalRevenue: 0, totalExpense: 0, netRevenue: 0 });

  const currency = (n) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(n || 0);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const load = React.useCallback(async () => {
    try {
      setError('');
      const url = new URL(salesUrl + '/api/branch-expenses');
      if (form.branch_id) url.searchParams.set('branch_id', form.branch_id);
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load expenses');
      setRows(Array.isArray(data.expenses) ? data.expenses : []);
    } catch (e) {
      setError(e.message || 'Failed to load expenses');
    }
  }, [salesUrl, token, form.branch_id]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    const fetchBanks = async () => {
      try {
        const url = new URL(salesUrl + '/api/banks');
        const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load banks');
        setBanks(Array.isArray(data.banks) ? data.banks : []);
      } catch (_e) {
        setBanks([]);
      }
    };
    fetchBanks();
  }, [salesUrl, token]);

  React.useEffect(() => {
    const fetchBranches = async () => {
      try {
        const url = new URL(salesUrl + '/api/branches');
        const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load branches');
        setBranches(Array.isArray(data.branches) ? data.branches : []);
      } catch (_e) {
        setBranches([]);
      }
    };
    // Desktop loads branches for admins; branch users don't need selector
    if (!branchUser) fetchBranches();
  }, [salesUrl, token, branchUser]);

  React.useEffect(() => {
    if (!form.bank_id) {
      setSelectedBank(null);
      return;
    }
    const bank = banks.find((b) => b._id === form.bank_id);
    setSelectedBank(bank || null);
  }, [form.bank_id, banks]);

  React.useEffect(() => {
    const loadSales = async () => {
      try {
        const url = new URL(salesUrl + '/api/sales');
        url.searchParams.set('pageSize', '200');
        if (form.branch_id) url.searchParams.set('branch_id', form.branch_id);
        const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
        const data = await res.json();
        if (res.ok) setSales(Array.isArray(data.sales) ? data.sales : []);
      } catch (_e) {
        // ignore
      }
    };
    loadSales();
  }, [salesUrl, token, form.branch_id]);

  const getRangeForDay = (day) => {
    if (!day) return null;
    const parts = String(day).split('-').map(Number);
    const start = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
    const end = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
    return { start, end };
  };

  const filteredRows = React.useMemo(() => {
    const range = selectedDate ? getRangeForDay(selectedDate) : null;
    if (!range) return rows || [];
    return (rows || []).filter((r) => {
      const t = r.date ? new Date(r.date) : (r.createdAt ? new Date(r.createdAt) : null);
      return t && t >= range.start && t <= range.end;
    });
  }, [rows, selectedDate]);

  React.useEffect(() => {
    try {
      let range = null;
      if (selectedDate) {
        range = getRangeForDay(selectedDate);
      } else {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const end = new Date(); end.setHours(23, 59, 59, 999);
        range = { start, end };
      }

      const todaysSales = (sales || []).filter((s) => {
        const t = s.createdAt ? new Date(s.createdAt) : null;
        return t && t >= range.start && t <= range.end;
      });

      const salesRevenue = todaysSales.reduce((sum, x) => sum + (Number(x.totalAmount) || 0), 0);

      let stockRevenue = 0;
      for (const s of todaysSales) {
        const items = Array.isArray(s.items) ? s.items : [];
        for (const it of items) {
          const qty = Number(it.qty || it.sellingQty || 0);
          const costUnit = Number(it.costPrice || it.cost || it.unitCost || 0);
          const totalCost = Number(it.totalCostPrice || (costUnit * qty) || 0);
          stockRevenue += totalCost;
        }
      }

      const totalExpense = (filteredRows || []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      const totalRevenue = salesRevenue - stockRevenue;
      const netRevenue = totalRevenue - totalExpense;

      setSummary({ salesRevenue, stockRevenue, totalRevenue, totalExpense, netRevenue });
    } catch (_e) {
      // ignore
    }
  }, [sales, filteredRows, selectedDate]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    const amt = Number(form.amount);
    if (!form.title || String(form.title).trim() === '') return setError('Enter an expense title');
    if (!amt || amt <= 0) return setError('Enter a valid amount');
    if (!form.bank_id) return setError('Select a bank');
    if (!selectedBank) return setError('Invalid bank selected');
    if (amt > Number(selectedBank.accountBalance)) return setError('Amount exceeds selected bank balance');

    setLoading(true);
    try {
      const postTitle = form.title;
      const postDate = form.date || new Date().toISOString();
      const postBranchId = form.branch_id || undefined;

      const res = await fetch(salesUrl + '/api/branch-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ title: postTitle, amount: amt, date: postDate, bank_id: form.bank_id, branch_id: postBranchId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Create failed');

      setForm((prev) => ({ ...prev, title: '', amount: '', date: '' }));
      await load();

      if (adminUrl) {
        try {
          const adminBody = {
            shop_id: (data.expense && data.expense.shop_id) || (window && window.shopId) || '',
            title: postTitle,
            amount: amt,
            createdAt: postDate
          };
          fetch((adminUrl || '') + '/api/expenses/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify(adminBody)
          }).catch(() => {});
        } catch (_e) {}
      }

      try { window.dispatchEvent(new Event('branch-expense-created')); } catch (_e) {}
    } catch (e2) {
      setError(e2.message || 'Failed to create expense');
    } finally {
      setLoading(false);
    }
  };

  const todayISO = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  return (
    <div className="mobile-content" style={{ paddingBottom: '80px' }}>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>💸 Expenses</div>
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)' }}>Add and track expenses with daily summary</div>
        </div>

        <div className="form-group" style={{ marginBottom: 12 }}>
          <label className="form-label">Filter by date</label>
          <input
            type="date"
            className="form-input"
            style={{ fontSize: 16 }}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              type="button"
              className="btn"
              onClick={() => setSelectedDate(todayISO())}
              style={{ flex: 1, minHeight: 44 }}
            >
              Today
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setSelectedDate('')}
              style={{ flex: 1, minHeight: 44 }}
            >
              Clear
            </button>
          </div>
        </div>

        {!branchUser ? (
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Filter by branch</label>
            <select
              className="form-input"
              name="branch_id"
              value={form.branch_id || ''}
              onChange={onChange}
            >
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>{b.name || b._id}</option>
              ))}
            </select>
          </div>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          {branchUser ? (
            <div className="stat-card">
              <div className="stat-label">Sales Revenue</div>
              <div className="stat-value">{currency(summary.salesRevenue)}</div>
            </div>
          ) : null}

          {branchUser ? (
            <div className="stat-card">
              <div className="stat-label">Net Revenue</div>
              <div className="stat-value">{currency(summary.netRevenue)}</div>
            </div>
          ) : null}

          <div className="stat-card">
            <div className="stat-label">Total Expense {selectedDate ? '(filtered)' : '(today)'}</div>
            <div className="stat-value">{currency(summary.totalExpense)}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="table-title" style={{ marginBottom: 12 }}>Add Expense</div>
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Expense Title</label>
            <input
              name="title"
              value={form.title}
              onChange={onChange}
              placeholder="Enter expense title"
              className="form-input"
              style={{ fontSize: 16 }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Amount</label>
            <input
              name="amount"
              value={form.amount}
              onChange={onChange}
              placeholder="0.00"
              className="form-input"
              inputMode="decimal"
              style={{ fontSize: 16 }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Date & Time</label>
            <input
              name="date"
              type="datetime-local"
              value={form.date}
              onChange={onChange}
              className="form-input"
              style={{ fontSize: 16 }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Bank</label>
            <select
              name="bank_id"
              value={form.bank_id}
              onChange={onChange}
              className="form-input"
              style={{ fontSize: 16 }}
            >
              <option value="">Select bank</option>
              {banks.map((b) => {
                const label = `${b.bankName || 'Bank'} (${b.accountNumber || '-'}) - ₹${Number(b.accountBalance || 0).toLocaleString()}`;
                return (
                  <option key={b._id} value={b._id}>{label}</option>
                );
              })}
            </select>
            {selectedBank ? (
              <div style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: 12 }}>
                Balance: ₹{Number(selectedBank.accountBalance || 0).toLocaleString()}
              </div>
            ) : null}
          </div>

          {error ? (
            <div style={{ marginTop: 8 }} className="text-danger">{error}</div>
          ) : null}

          <button
            className="btn"
            type="submit"
            disabled={loading}
            style={{ width: '100%', minHeight: 44, marginTop: 10 }}
          >
            {loading ? 'Saving…' : '+ Add Expense'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="table-title" style={{ marginBottom: 8 }}>Recent Expenses</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 10 }}>
          {filteredRows.length} record{filteredRows.length === 1 ? '' : 's'}
        </div>

        {filteredRows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💸</div>
            <div className="empty-title">No expenses found for selected date</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredRows.map((r, i) => {
              const dt = r.date ? new Date(r.date) : (r.createdAt ? new Date(r.createdAt) : null);
              return (
                <div key={r._id || i} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.title || '-'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                        {dt ? dt.toLocaleString() : '-'}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                      {currency(Number(r.amount) || 0)}
                    </div>
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      #{i + 1}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {selectedDate ? 'Filtered' : 'Today view'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

window.MobileBranchExpense = MobileBranchExpense;

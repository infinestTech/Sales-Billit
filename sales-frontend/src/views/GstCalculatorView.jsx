function GstCalculatorView() {
  const [transactions, setTransactions] = React.useState([]);
 
  React.useEffect(() => {
    const salesUrl = window.ENV_CONFIG?.SALES_API_URL || 'http://127.0.0.1:9000';
    // Prefer sales_token but fall back to branch_token when needed. Also retry with branch token on 401.
    const primaryToken = localStorage.getItem('sales_token') || '';
    const branchToken = localStorage.getItem('branch_token') || '';

    async function fetchWithFallback(path) {
      const url = salesUrl + path;
      const tryPrimary = async () => {
        if (!primaryToken) return null;
        try {
          const res = await fetch(url, { headers: { Authorization: 'Bearer ' + primaryToken } });
          if (res.status === 401) return 'unauth';
          if (!res.ok) return { ok: false, res };
          const json = await res.json();
          return { ok: true, json };
        } catch (e) {
          return { ok: false, res: null };
        }
      };
      const tryBranch = async () => {
        if (!branchToken) return null;
        try {
          const res = await fetch(url, { headers: { Authorization: 'Bearer ' + branchToken } });
          if (!res.ok) return { ok: false, res };
          const json = await res.json();
          return { ok: true, json };
        } catch (e) {
          return { ok: false, res: null };
        }
      };

      // Try primary first (if present)
      if (primaryToken) {
        const p = await tryPrimary();
        if (p === 'unauth') {
          // try branch token when primary is unauthorized
          const b = await tryBranch();
          if (b && b.ok) return b.json;
          return null;
        }
        if (p && p.ok) return p.json;
        // If primary failed with network or other error, try branch
      }
      // Fallback to branch token
      if (branchToken) {
        const b = await tryBranch();
        if (b && b.ok) return b.json;
      }
      return null;
    }

    (async () => {
      try {
        const data1 = await fetchWithFallback('/api/in-stock?gstOnly=1');
        const data2 = await fetchWithFallback('/api/branch-supplies');

        const entries = data1 && Array.isArray(data1.entries) ? data1.entries : [];
        const supplies = data2 && Array.isArray(data2.supplies) ? data2.supplies : [];

        const list = [];
        entries.forEach(e => {
          list.push({
            supplierName: (e.supplier_id && (e.supplier_id.supplierName || e.supplier_id.agencyName)) || '-',
            bankName: (e.bank_id && (e.bank_id.bankName || e.bank_id.accountNumber)) || '-',
            supplierAmount: e.supplierAmount,
            gstAmount: e.gstAmount,
            createdAt: e.createdAt,
            branchName: ''
          });
        });
        supplies.forEach(s => {
          list.push({
            supplierName: s.supplierName || '-',
            bankName: s.bankName || '-',
            supplierAmount: (s.supplierAmount != null) ? s.supplierAmount : 0,
            gstAmount: (s.gstAmount != null) ? s.gstAmount : 0,
            createdAt: s.createdAt,
            branchName: s.branch_name || ''
          });
        });
        setTransactions(list);
      } catch (e) {
        console.error('Failed to load GST entries', e);
      }
    })();
  }, []);
 
  return React.createElement(window.GstCalculator, { transactions });
}


window.GstCalculatorView = GstCalculatorView;
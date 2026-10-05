import React from 'react';

// Origin of a supply record. Older records have no `source`, so fall back to who created them.
const sourceOf = (s) => s.source || (String(s.createdByType || '').toLowerCase() === 'branch' ? 'manual' : 'supply');

const SOURCE_LABEL = {
  supply: { text: 'Sent from inventory', bg: '#e0e7ff', color: '#3730a3' },
  import: { text: 'Branch import', bg: '#dcfce7', color: '#166534' },
  manual: { text: 'Branch added', bg: '#fef3c7', color: '#92400e' },
};

const currency = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);
const dayKey = (d) => {
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? '' : `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export default function BranchSupplyHistory({ salesUrl, token }) {
  const [supplies, setSupplies] = React.useState([]);
  const [branches, setBranches] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [branchId, setBranchId] = React.useState('');
  const [source, setSource] = React.useState('');
  const [filterDate, setFilterDate] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [imesFilter, setImesFilter] = React.useState('');

  const load = React.useCallback(async (bid) => {
    setLoading(true); setError('');
    try {
      const headers = { Authorization: 'Bearer ' + token };
      const url = new URL(salesUrl + '/api/branch-supplies');
      url.searchParams.set('limit', '200');
      if (bid) url.searchParams.set('branch_id', bid);
      const [bRes, sRes] = await Promise.all([fetch(salesUrl + '/api/branches', { headers }), fetch(url, { headers })]);
      const [bData, sData] = await Promise.all([bRes.json(), sRes.json()]);
      if (!sRes.ok) throw new Error(sData.message || 'Failed to load supply history');
      setBranches(Array.isArray(bData.branches) ? bData.branches : []);
      setSupplies(Array.isArray(sData.supplies) ? sData.supplies : []);
    } catch (e) {
      setError(e.message || 'Failed to load supply history');
    } finally {
      setLoading(false);
    }
  }, [salesUrl, token]);

  React.useEffect(() => { load(branchId); }, [load, branchId]);

  const branchName = React.useMemo(() => {
    const m = new Map(branches.map(b => [String(b._id), b.name || '']));
    return (s) => s.branch_name || m.get(String(s.branch_id)) || '-';
  }, [branches]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const ime = imesFilter.trim().toLowerCase();
    return supplies
      .filter(s => !source || sourceOf(s) === source)
      .filter(s => !filterDate || dayKey(s.createdAt || s.updatedAt) === filterDate)
      .map(s => {
        const items = (Array.isArray(s.items) ? s.items : []).filter(it => {
          if (ime && !(Array.isArray(it.imes) ? it.imes.join(',') : '').toLowerCase().includes(ime)) return false;
          if (q && !`${it.productNo || ''} ${it.productName || ''} ${it.brand || ''} ${s.billNo || ''} ${s.supplierName || ''}`.toLowerCase().includes(q)) return false;
          return true;
        });
        return { ...s, items };
      })
      .filter(s => s.items.length > 0);
  }, [supplies, source, filterDate, search, imesFilter]);

  const totals = React.useMemo(() => {
    const t = { supply: 0, import: 0, manual: 0, units: 0, cost: 0 };
    filtered.forEach(s => {
      t[sourceOf(s)] += 1;
      s.items.forEach(it => { t.units += Number(it.qty) || 0; t.cost += Number(it.totalCostPrice ?? (Number(it.costPrice) || 0) * (Number(it.qty) || 0)) || 0; });
    });
    return t;
  }, [filtered]);

  const field = { padding: '8px', width: '100%', boxSizing: 'border-box' };
  const badge = (src) => {
    const l = SOURCE_LABEL[src] || SOURCE_LABEL.supply;
    return <span style={{ background: l.bg, color: l.color, padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>{l.text}</span>;
  };

  if (loading && !supplies.length) {
    return <div style={{ padding: '40px', textAlign: 'center', fontSize: '18px', color: '#6b7280' }}>⏳ Loading Supply History...</div>;
  }

  return (
    <div className="card table-card">
      <div className="row" style={{ padding: '12px 12px 0 12px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        <div className="col" style={{ minWidth: '180px', flex: 1 }}>
          <label>Branch</label>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} style={field}>
            <option value="">All branches</option>
            {branches.map(b => <option key={b._id} value={b._id}>{b.name || b._id}</option>)}
          </select>
        </div>
        <div className="col" style={{ minWidth: '180px', flex: 1 }}>
          <label>Source</label>
          <select value={source} onChange={(e) => setSource(e.target.value)} style={field}>
            <option value="">All stock movements</option>
            <option value="supply">Sent from inventory (admin)</option>
            <option value="import">Branch import (Excel / JSON)</option>
            <option value="manual">Branch added manually</option>
          </select>
        </div>
        <div className="col" style={{ minWidth: '160px', flex: 1 }}>
          <label>Date</label>
          <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={field} />
        </div>
        <div className="col" style={{ minWidth: '200px', flex: 1 }}>
          <label>Search (product, code, bill, supplier)</label>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} style={field} />
        </div>
        <div className="col" style={{ minWidth: '160px', flex: 1 }}>
          <label>IMEI</label>
          <input type="text" value={imesFilter} onChange={(e) => setImesFilter(e.target.value)} style={field} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '12px', fontSize: '12px' }}>
        <span style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: '999px' }}>{filtered.length} record(s) · {totals.units} units · cost {currency(totals.cost)}</span>
        {totals.supply > 0 && <span>{badge('supply')} {totals.supply}</span>}
        {totals.import > 0 && <span>{badge('import')} {totals.import}</span>}
        {totals.manual > 0 && <span>{badge('manual')} {totals.manual}</span>}
      </div>

      {error && <div style={{ margin: '0 12px 12px', padding: '12px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#dc2626' }}>❌ {error}</div>}

      <div className="table-scroll">
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
            <p style={{ margin: 0 }}>No supply history found</p>
          </div>
        ) : (
          <table className="modern-table">
            <thead>
              <tr>
                <th>Date &amp; Time</th>
                <th>Branch</th>
                <th>Source</th>
                <th>Supplier / Bill</th>
                <th>Product No</th>
                <th>Product Name</th>
                <th>Brand</th>
                <th>Model</th>
                <th>Cost Price</th>
                <th>Selling Price</th>
                <th>Qty</th>
                <th>Value</th>
                <th>Validity</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const src = sourceOf(s);
                const when = new Date(s.createdAt || s.updatedAt || Date.now()).toLocaleString();
                const supplier = s.supplierName || s.supplier_id?.supplierName || '';
                const units = s.items.reduce((a, it) => a + (Number(it.qty) || 0), 0);
                return (
                  <React.Fragment key={s._id}>
                    <tr style={{ background: '#f8fafc' }}>
                      <td colSpan={13} style={{ fontSize: '12px', color: '#334155' }}>
                        <strong>{when}</strong> · {branchName(s)} · {badge(src)}
                        {supplier ? <> · {supplier}</> : null}
                        {s.billNo ? <> · Bill <strong>{s.billNo}</strong>{s.billDate ? ` (${new Date(s.billDate).toLocaleDateString()})` : ''}</> : null}
                        {s.purchaseType === 'credit' ? <> · <span style={{ color: '#b45309', fontWeight: 600 }}>Credit {currency(s.creditAmount)}</span></> : null}
                        {' '}· {s.items.length} product(s), {units} unit(s) · value {currency(s.totalSupplyValue)}
                      </td>
                    </tr>
                    {s.items.map((it, idx) => {
                      const unit = it.unitSellingPrice ?? it.sellingPrice ?? 0;
                      return (
                        <tr key={`${s._id}-${idx}`}>
                          <td style={{ fontSize: '12px', color: '#64748b' }}>{when}</td>
                          <td>{branchName(s)}</td>
                          <td>{badge(src)}</td>
                          <td style={{ fontSize: '12px' }}>
                            {supplier || it.supplierName || '-'}
                            {s.billNo ? <div style={{ color: '#64748b' }}>Bill {s.billNo}</div> : null}
                          </td>
                          <td style={{ fontFamily: 'monospace' }}>{it.productNo || '-'}</td>
                          <td>{it.productName || it.name || '-'}</td>
                          <td>{it.brand || '-'}</td>
                          <td>{it.model || '-'}</td>
                          <td>{currency(it.costPrice ?? it.cost ?? 0)}</td>
                          <td>{it.pct != null ? `${it.pct}% / ${currency(unit)}` : currency(unit)}</td>
                          <td>{it.qty ?? 0}</td>
                          <td>{currency(it.value ?? unit * (it.qty ?? 0))}</td>
                          <td>{it.validity ? new Date(it.validity).toLocaleDateString() : '-'}</td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

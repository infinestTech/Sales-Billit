import React from 'react';

// Branch Management: usage overview, one card per branch (contact details + stock held), create/edit in a
// modal, and a delete dialog that warns when the branch still holds stock (deleting removes that stock too).

const CB_CSS = `
.cb{--cb-ink:#0f172a;--cb-mute:#64748b;--cb-line:#e2e8f0;--cb-soft:#f8fafc;--cb-pri:#4f46e5;--cb-pri-soft:#eef2ff;--cb-red:#dc2626;--cb-red-soft:#fef2f2;color:var(--cb-ink)}
.cb *{box-sizing:border-box}
.cb-top{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.cb-h1{font-size:22px;font-weight:700;margin:0}
.cb-sub{color:var(--cb-mute);font-size:14px;margin:4px 0 0}
.cb-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:10px;padding:10px 16px;font-size:14px;font-weight:600;border:1px solid transparent;cursor:pointer;transition:background .15s,border-color .15s,opacity .15s;white-space:nowrap}
.cb-btn:disabled{opacity:.5;cursor:not-allowed}
.cb-btn-pri{background:var(--cb-pri);color:#fff}
.cb-btn-pri:hover:not(:disabled){background:#4338ca}
.cb-btn-ghost{background:#fff;color:#334155;border-color:var(--cb-line)}
.cb-btn-ghost:hover:not(:disabled){background:var(--cb-soft)}
.cb-btn-red{background:var(--cb-red);color:#fff}
.cb-btn-red:hover:not(:disabled){background:#b91c1c}
.cb-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:20px}
.cb-stat{background:#fff;border:1px solid var(--cb-line);border-radius:14px;padding:16px}
.cb-stat-l{font-size:12px;font-weight:600;color:var(--cb-mute);text-transform:uppercase;letter-spacing:.04em}
.cb-stat-v{font-size:24px;font-weight:700;margin-top:6px}
.cb-stat-v small{font-size:14px;font-weight:500;color:var(--cb-mute)}
.cb-bar{height:6px;border-radius:99px;background:#e2e8f0;margin-top:10px;overflow:hidden}
.cb-bar>span{display:block;height:100%;background:var(--cb-pri);border-radius:99px}
.cb-bar.full>span{background:#f59e0b}
.cb-alert{display:flex;gap:10px;align-items:flex-start;border-radius:12px;padding:12px 14px;font-size:14px;margin-bottom:16px}
.cb-alert-err{background:var(--cb-red-soft);color:#991b1b;border:1px solid #fecaca}
.cb-alert-ok{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0}
.cb-alert button{margin-left:auto;background:none;border:0;color:inherit;cursor:pointer;font-size:16px;line-height:1}
.cb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
.cb-card{background:#fff;border:1px solid var(--cb-line);border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:14px;transition:box-shadow .15s,border-color .15s}
.cb-card:hover{border-color:#c7d2fe;box-shadow:0 6px 20px rgba(15,23,42,.06)}
.cb-card-h{display:flex;gap:12px;align-items:center}
.cb-av{width:44px;height:44px;border-radius:12px;background:var(--cb-pri-soft);color:var(--cb-pri);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;flex-shrink:0}
.cb-name{font-weight:700;font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cb-tags{display:flex;gap:6px;margin-top:3px;flex-wrap:wrap}
.cb-tag{font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px;background:#f1f5f9;color:#475569}
.cb-tag.ok{background:#dcfce7;color:#166534}
.cb-tag.main{background:var(--cb-pri-soft);color:var(--cb-pri)}
.cb-info{display:grid;gap:7px;font-size:13px}
.cb-info div{display:flex;gap:8px;color:#334155;min-width:0}
.cb-info span:first-child{width:18px;flex-shrink:0;text-align:center;color:var(--cb-mute)}
.cb-info span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cb-info .none{color:#94a3b8}
.cb-stock{display:flex;justify-content:space-between;align-items:center;background:var(--cb-soft);border-radius:10px;padding:10px 12px;font-size:13px;color:var(--cb-mute)}
.cb-stock b{color:var(--cb-ink);font-size:14px}
.cb-actions{display:flex;gap:8px;margin-top:auto}
.cb-actions .cb-btn{flex:1;padding:8px 12px}
.cb-del{color:var(--cb-red) !important}
.cb-del:hover:not(:disabled){background:var(--cb-red-soft) !important;border-color:#fecaca !important}
.cb-empty{background:#fff;border:1px dashed #cbd5e1;border-radius:16px;padding:48px 20px;text-align:center}
.cb-empty-i{font-size:36px}
.cb-empty h3{margin:10px 0 4px;font-size:17px}
.cb-empty p{color:var(--cb-mute);font-size:14px;margin:0 0 16px}
.cb-ov{position:fixed;inset:0;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;padding:16px;z-index:1000}
.cb-modal{background:#fff;border-radius:18px;width:100%;max-width:640px;max-height:calc(100vh - 32px);display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(15,23,42,.25)}
.cb-modal.sm{max-width:460px}
.cb-mh{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:20px 22px 14px;border-bottom:1px solid var(--cb-line)}
.cb-mh h3{margin:0;font-size:18px}
.cb-mh p{margin:4px 0 0;color:var(--cb-mute);font-size:13px}
.cb-x{background:#f1f5f9;border:0;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:16px;color:#475569;flex-shrink:0}
.cb-mb{padding:18px 22px;overflow-y:auto}
.cb-mf{display:flex;justify-content:flex-end;gap:10px;padding:14px 22px;border-top:1px solid var(--cb-line)}
.cb-fgrid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.cb-f{display:flex;flex-direction:column;gap:6px}
.cb-f.wide{grid-column:1/-1}
.cb-f label{font-size:13px;font-weight:600;color:#334155}
.cb-f label i{color:var(--cb-red);font-style:normal}
.cb-f input{border:1px solid #cbd5e1;border-radius:10px;padding:10px 12px;font-size:14px;outline:none;width:100%;background:#fff;color:var(--cb-ink)}
.cb-f input:focus{border-color:var(--cb-pri);box-shadow:0 0 0 3px rgba(79,70,229,.15)}
.cb-sec{grid-column:1/-1;font-size:12px;font-weight:700;color:var(--cb-mute);text-transform:uppercase;letter-spacing:.05em;padding-top:4px}
.cb-hint{font-size:12px;color:var(--cb-mute)}
.cb-warn{background:var(--cb-red-soft);border:1px solid #fecaca;border-radius:12px;padding:14px;margin-top:14px}
.cb-warn-t{font-weight:700;color:#991b1b;font-size:14px}
.cb-warn-n{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}
.cb-warn-n div{background:#fff;border-radius:8px;padding:8px;text-align:center;font-size:12px;color:var(--cb-mute)}
.cb-warn-n b{display:block;font-size:16px;color:var(--cb-ink)}
.cb-check{display:flex;gap:8px;align-items:flex-start;font-size:13px;color:#7f1d1d;cursor:pointer}
.cb-check input{margin-top:2px;padding:0;accent-color:var(--cb-red);width:16px;height:16px;flex-shrink:0}
.cb-list{margin:10px 0 0;padding-left:18px;color:#475569;font-size:13px;line-height:1.6}
.cb-spin{width:14px;height:14px;border:2px solid rgba(255,255,255,.5);border-top-color:#fff;border-radius:50%;animation:cbspin .7s linear infinite}
@keyframes cbspin{to{transform:rotate(360deg)}}
@media (max-width:640px){.cb-fgrid{grid-template-columns:1fr}.cb-top .cb-btn{width:100%}}
`;

const emptyForm = { name: '', address: '', gstNo: '', phoneNumber: '', email: '', password: '', confirmPassword: '' };
const money = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const stockOf = (r) => r.stock || { units: 0, products: 0, value: 0 };

export default function CreateBranch({ salesUrl, token, planId, branchLimit: propBranchLimit = 0 }) {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [branchLimit, setBranchLimit] = React.useState(propBranchLimit);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  // Create/edit modal: null = closed, { id: null } = new branch, { id } = editing
  const [editor, setEditor] = React.useState(null);
  const [form, setForm] = React.useState(emptyForm);
  const [formError, setFormError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  // Delete dialog: { branch, stock, ack, busy, error }
  const [del, setDel] = React.useState(null);

  const loadBranches = async () => {
    try {
      setError('');
      const res = await fetch(salesUrl + '/api/branches', { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load branches');
      setRows(Array.isArray(data.branches) ? data.branches : []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const loadPlanLimits = async () => {
    try {
      const res = await fetch(salesUrl + '/api/plan-limits');
      const data = await res.json();
      if (res.ok && data.limits?.branches) setBranchLimit(data.limits.branches);
    } catch (e) {
      console.error('Failed to fetch plan limits:', e);
    }
  };

  React.useEffect(() => {
    loadBranches();
    loadPlanLimits();
  }, []);

  const limit = Number.isFinite(Number(branchLimit)) ? Number(branchLimit) : 0;
  const atLimit = rows.length >= limit;
  const totals = rows.reduce((t, r) => {
    const s = stockOf(r);
    t.units += Number(s.units) || 0;
    t.value += Number(s.value) || 0;
    return t;
  }, { units: 0, value: 0 });

  // Esc closes whichever dialog is open (not while a request is running)
  React.useEffect(() => {
    if (!editor && !del) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (editor && !saving) setEditor(null);
      if (del && !del.busy) setDel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editor, del, saving]);

  const openCreate = () => {
    setForm(emptyForm);
    setFormError('');
    setEditor({ id: null });
  };

  const openEdit = (r) => {
    setForm({ name: r.name || '', address: r.address || '', gstNo: r.gstNo || '', phoneNumber: r.phoneNumber || '', email: r.email || '', password: '', confirmPassword: '' });
    setFormError('');
    setEditor({ id: r._id });
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setFormError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    const editingId = editor?.id || null;
    if (form.password !== form.confirmPassword) return setFormError('Passwords do not match');
    if (!editingId && atLimit) return setFormError('Branch limit reached for your plan');
    const normalizedEmail = (form.email || '').toLowerCase().trim();
    if (rows.some((b) => b._id !== editingId && (b.email || '').toLowerCase().trim() === normalizedEmail)) {
      return setFormError('A branch with this email already exists. Use a different email address.');
    }

    setSaving(true);
    try {
      const res = await fetch(salesUrl + '/api/branches' + (editingId ? '/' + encodeURIComponent(editingId) : ''), {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          name: form.name,
          address: form.address,
          gstNo: form.gstNo,
          phoneNumber: form.phoneNumber,
          email: form.email,
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || (editingId ? 'Update failed' : 'Create failed'));
      setEditor(null);
      setNotice(editingId ? `${form.name} updated` : `${form.name} created`);
      await loadBranches();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const openDelete = (r) => setDel({ branch: r, stock: stockOf(r), ack: false, busy: false, error: '' });

  const confirmDelete = async () => {
    if (!del) return;
    const { branch, stock, ack } = del;
    const hasStock = Number(stock.units) > 0;
    if (hasStock && !ack) return;
    setDel((d) => ({ ...d, busy: true, error: '' }));
    try {
      const res = await fetch(salesUrl + '/api/branches/' + encodeURIComponent(branch._id) + (hasStock ? '?force=1' : ''), {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token },
      });
      const data = await res.json().catch(() => ({}));
      // Stock arrived since the list loaded: show the warning and ask again
      if (res.status === 409 && data.needsConfirm) {
        setDel((d) => ({ ...d, busy: false, ack: false, stock: data.stock || d.stock }));
        return;
      }
      if (!res.ok || !data.success) throw new Error(data.message || 'Delete failed');
      setDel(null);
      setNotice(hasStock ? `${branch.name} deleted with ${stock.units} unit(s) of stock` : `${branch.name} deleted`);
      await loadBranches();
    } catch (e) {
      setDel((d) => (d ? { ...d, busy: false, error: e.message } : d));
    }
  };

  const delHasStock = del && Number(del.stock.units) > 0;

  return (
    <div className="cb">
      <style>{CB_CSS}</style>

      <div className="cb-top">
        <div>
          <h2 className="cb-h1">Branches</h2>
          <p className="cb-sub">Each branch has its own login, stock and sales.</p>
        </div>
        <button type="button" className="cb-btn cb-btn-pri" onClick={openCreate} disabled={limit <= 0 || atLimit}
          title={limit <= 0 ? 'Upgrade your plan to add branches' : atLimit ? 'Branch limit reached for your plan' : ''}>
          + Add branch
        </button>
      </div>

      <div className="cb-stats">
        <div className="cb-stat">
          <div className="cb-stat-l">Branches used</div>
          <div className="cb-stat-v">{rows.length} <small>of {limit}</small></div>
          <div className={'cb-bar' + (atLimit ? ' full' : '')}>
            <span style={{ width: (limit > 0 ? Math.min(100, (rows.length / limit) * 100) : 0) + '%' }} />
          </div>
        </div>
        <div className="cb-stat">
          <div className="cb-stat-l">Plan</div>
          <div className="cb-stat-v" style={{ fontSize: 18 }}>{planId || 'Basic'}</div>
          <div className="cb-hint" style={{ marginTop: 6 }}>
            {limit <= 0 ? 'Upgrade to enable branches' : atLimit ? 'Limit reached' : `${limit - rows.length} slot(s) free`}
          </div>
        </div>
        <div className="cb-stat">
          <div className="cb-stat-l">Stock across branches</div>
          <div className="cb-stat-v">{totals.units.toLocaleString('en-IN')} <small>units</small></div>
          <div className="cb-hint" style={{ marginTop: 6 }}>{money(totals.value)} at cost</div>
        </div>
      </div>

      {error && (
        <div className="cb-alert cb-alert-err"><span>⚠️</span><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Dismiss">×</button></div>
      )}
      {notice && (
        <div className="cb-alert cb-alert-ok"><span>✓</span><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>
      )}

      {loading ? (
        <div className="cb-empty"><p>Loading branches…</p></div>
      ) : rows.length === 0 ? (
        <div className="cb-empty">
          <div className="cb-empty-i">🏪</div>
          <h3>No branches yet</h3>
          <p>{limit > 0 ? 'Create your first branch to start selling from it.' : 'Your plan does not include branches.'}</p>
          {limit > 0 && <button type="button" className="cb-btn cb-btn-pri" onClick={openCreate}>+ Add branch</button>}
        </div>
      ) : (
        <div className="cb-grid">
          {rows.map((r) => {
            const s = stockOf(r);
            return (
              <div className="cb-card" key={r._id}>
                <div className="cb-card-h">
                  <div className="cb-av">{initials(r.name)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="cb-name" title={r.name}>{r.name || '-'}</div>
                    <div className="cb-tags">
                      <span className="cb-tag ok">Active</span>
                      {r.isAdmin && <span className="cb-tag main">Main branch</span>}
                      {r.gstNo && <span className="cb-tag">GST</span>}
                    </div>
                  </div>
                </div>
                <div className="cb-info">
                  <div><span>📍</span><span className={r.address ? '' : 'none'} title={r.address}>{r.address || 'No address'}</span></div>
                  <div><span>📞</span><span className={r.phoneNumber ? '' : 'none'}>{r.phoneNumber || 'No phone'}</span></div>
                  <div><span>✉️</span><span title={r.email}>{r.email || '-'}</span></div>
                  {r.gstNo && <div><span>🧾</span><span>{r.gstNo}</span></div>}
                </div>
                <div className="cb-stock">
                  <span>Stock held</span>
                  <span>{s.units > 0 ? <><b>{s.units}</b> units · {money(s.value)}</> : 'None'}</span>
                </div>
                <div className="cb-actions">
                  <button type="button" className="cb-btn cb-btn-ghost" onClick={() => openEdit(r)}>✏️ Edit</button>
                  <button type="button" className="cb-btn cb-btn-ghost cb-del" onClick={() => openDelete(r)}>🗑 Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editor && (
        <div className="cb-ov" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setEditor(null); }}>
          <form className="cb-modal" onSubmit={submit} role="dialog" aria-modal="true">
            <div className="cb-mh">
              <div>
                <h3>{editor.id ? 'Edit branch' : 'New branch'}</h3>
                <p>{editor.id ? 'Leave the password blank to keep the current one.' : 'The email and password are the branch login.'}</p>
              </div>
              <button type="button" className="cb-x" onClick={() => setEditor(null)} disabled={saving} aria-label="Close">✕</button>
            </div>
            <div className="cb-mb">
              <div className="cb-fgrid">
                <div className="cb-sec">Details</div>
                <div className="cb-f wide">
                  <label>Branch name <i>*</i></label>
                  <input name="name" value={form.name} onChange={onChange} placeholder="e.g. Downtown Store" required autoFocus />
                </div>
                <div className="cb-f wide">
                  <label>Address</label>
                  <input name="address" value={form.address} onChange={onChange} placeholder="Street, city" />
                </div>
                <div className="cb-f">
                  <label>Phone number</label>
                  <input name="phoneNumber" value={form.phoneNumber} onChange={onChange} placeholder="Contact number" inputMode="tel" />
                </div>
                <div className="cb-f">
                  <label>GST No</label>
                  <input name="gstNo" value={form.gstNo} onChange={onChange} placeholder="Optional" />
                </div>
                <div className="cb-sec">Login</div>
                <div className="cb-f wide">
                  <label>Email <i>*</i></label>
                  <input name="email" type="email" value={form.email} onChange={onChange} placeholder="branch@example.com" required />
                </div>
                <div className="cb-f">
                  <label>{editor.id ? 'New password' : <>Password <i>*</i></>}</label>
                  <input name="password" type="password" value={form.password} onChange={onChange}
                    placeholder={editor.id ? 'Keep current' : 'Password'} required={!editor.id} autoComplete="new-password" />
                </div>
                <div className="cb-f">
                  <label>{editor.id ? 'Confirm new password' : <>Confirm password <i>*</i></>}</label>
                  <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={onChange}
                    placeholder={editor.id ? 'Keep current' : 'Repeat password'} required={!editor.id || !!form.password} autoComplete="new-password" />
                </div>
              </div>
              {formError && <div className="cb-alert cb-alert-err" style={{ marginTop: 16, marginBottom: 0 }}><span>⚠️</span><span>{formError}</span></div>}
            </div>
            <div className="cb-mf">
              <button type="button" className="cb-btn cb-btn-ghost" onClick={() => setEditor(null)} disabled={saving}>Cancel</button>
              <button type="submit" className="cb-btn cb-btn-pri" disabled={saving}>
                {saving && <span className="cb-spin" />}
                {editor.id ? (saving ? 'Saving…' : 'Save changes') : (saving ? 'Creating…' : 'Create branch')}
              </button>
            </div>
          </form>
        </div>
      )}

      {del && (
        <div className="cb-ov" onMouseDown={(e) => { if (e.target === e.currentTarget && !del.busy) setDel(null); }}>
          <div className="cb-modal sm" role="alertdialog" aria-modal="true">
            <div className="cb-mh">
              <div>
                <h3>Delete {del.branch.name}?</h3>
                <p>This cannot be undone.</p>
              </div>
              <button type="button" className="cb-x" onClick={() => setDel(null)} disabled={del.busy} aria-label="Close">✕</button>
            </div>
            <div className="cb-mb">
              <ul className="cb-list">
                <li>The branch login stops working.</li>
                <li>Past sales, supplies and expenses stay in your reports.</li>
                {del.branch.isAdmin && <li>The oldest remaining branch becomes the main branch.</li>}
              </ul>
              {delHasStock && (
                <div className="cb-warn">
                  <div className="cb-warn-t">⚠️ This branch still holds stock</div>
                  <div className="cb-warn-n">
                    <div><b>{del.stock.units}</b>units</div>
                    <div><b>{del.stock.products}</b>products</div>
                    <div><b>{money(del.stock.value)}</b>at cost</div>
                  </div>
                  <label className="cb-check">
                    <input type="checkbox" checked={del.ack} disabled={del.busy}
                      onChange={(e) => setDel((d) => ({ ...d, ack: e.target.checked }))} />
                    <span>I understand this stock will be permanently deleted with the branch.</span>
                  </label>
                </div>
              )}
              {del.error && <div className="cb-alert cb-alert-err" style={{ marginTop: 14, marginBottom: 0 }}><span>⚠️</span><span>{del.error}</span></div>}
            </div>
            <div className="cb-mf">
              <button type="button" className="cb-btn cb-btn-ghost" onClick={() => setDel(null)} disabled={del.busy}>Cancel</button>
              <button type="button" className="cb-btn cb-btn-red" onClick={confirmDelete} disabled={del.busy || (delHasStock && !del.ack)}>
                {del.busy && <span className="cb-spin" />}
                {del.busy ? 'Deleting…' : delHasStock ? 'Delete branch and stock' : 'Delete branch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

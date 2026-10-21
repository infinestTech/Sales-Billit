// Expenses (branch portal, #branch-expense; desktop and mobile). Records money spent from the branch and shows,
// for the chosen period, how it affects profit: sales − cost of goods sold − expenses = profit.
// SalesServer: GET/POST /api/branch-expenses, GET /api/branch-expense-summary?start=&end= (sales + cost + expenses).
// Styles: shared `dl-` classes from src/utils/dealerUi.js plus the `ex-` rules below.

const EX_CATEGORIES = [
	{ icon: '☕', label: 'Tea & snacks', match: /tea|coffee|snack|food|lunch|water/i },
	{ icon: '🚚', label: 'Transport', match: /transport|auto|petrol|fuel|courier|delivery|travel|bus/i },
	{ icon: '🏠', label: 'Rent', match: /rent/i },
	{ icon: '💡', label: 'Electricity', match: /electric|current|eb bill|power/i },
	{ icon: '🧑‍💼', label: 'Salary advance', match: /salary|advance|wage/i },
	{ icon: '🛠️', label: 'Repairs', match: /repair|maintenance|service/i },
	{ icon: '📎', label: 'Stationery', match: /stationery|paper|print|pen|bill book/i },
	{ icon: '🧹', label: 'Cleaning', match: /clean|housekeeping/i },
];
const EX_METHODS = [{ v: 'Cash', i: '💵' }, { v: 'Gpay', i: '📱' }, { v: 'Card', i: '💳' }];
const EX_PERIODS = [['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'This week'], ['month', 'This month'], ['custom', 'Pick a date']];

const EX_CSS = [
	'.ex-period{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:16px}',
	'.ex-period input[type=date]{height:38px;border:1px solid var(--dl-ln);border-radius:10px;padding:0 10px;font-size:13px;width:auto!important}',
	'.ex-layout{display:grid;grid-template-columns:380px minmax(0,1fr);gap:16px;align-items:start}',
	'.ex-cat{display:flex;flex-wrap:wrap;gap:6px}',
	'.ex-cat button{height:32px;padding:0 10px;border-radius:999px;border:1px solid var(--dl-ln);background:#fff;font-size:12.5px;font-weight:600;color:#334155;cursor:pointer}',
	'.ex-cat button.on,.ex-cat button:hover{border-color:var(--dl-ac2);background:var(--dl-acs);color:var(--dl-ac)}',
	'.ex-flow{display:flex;height:14px;border-radius:999px;overflow:hidden;background:#eef2f7}',
	'.ex-flow i{display:block;height:100%}',
	'.ex-legend{display:flex;flex-wrap:wrap;gap:14px;margin-top:10px;font-size:12.5px;color:var(--dl-mu)}',
	'.ex-legend b{color:var(--dl-tx);font-variant-numeric:tabular-nums}',
	'.ex-dot{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}',
	'.ex-item{display:flex;gap:12px;align-items:center;padding:12px 16px;border-top:1px solid var(--dl-ln)}',
	'.ex-item .ic{flex:0 0 38px;height:38px;border-radius:11px;background:#fff7ed;display:flex;align-items:center;justify-content:center;font-size:18px}',
	'.ex-eq{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:13px;color:var(--dl-mu);margin-top:8px}',
	'.ex-eq b{color:var(--dl-tx);font-variant-numeric:tabular-nums}',
	'@media (max-width:1100px){.ex-layout{grid-template-columns:1fr}}'
].join('\n');

function exCategoryOf(title) {
	return EX_CATEGORIES.find(c => c.match.test(String(title || ''))) || null;
}
function exLocalInputNow() {
	const d = new Date();
	const p = (n) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
// [start, end] Date objects for a period in the device's local time
function exRange(period, customDay) {
	const startOf = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
	const endOf = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
	const now = new Date();
	if (period === 'yesterday') { const y = new Date(now); y.setDate(y.getDate() - 1); return [startOf(y), endOf(y)]; }
	if (period === 'week') { const s = startOf(now); s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); return [s, endOf(now)]; }
	if (period === 'month') return [new Date(now.getFullYear(), now.getMonth(), 1), endOf(now)];
	if (period === 'custom' && customDay) { const [y, m, d] = customDay.split('-').map(Number); const day = new Date(y, m - 1, d); return [startOf(day), endOf(day)]; }
	return [startOf(now), endOf(now)];
}

function BranchNewExpense({ salesUrl, token }) {
	const UI = window.DealerUI;
	const authToken = token || localStorage.getItem('branch_token') || '';
	const headers = { Authorization: 'Bearer ' + authToken, 'Content-Type': 'application/json' };

	const [period, setPeriod] = React.useState('today');
	const [customDay, setCustomDay] = React.useState(UI.todayInput());
	const [rows, setRows] = React.useState([]);
	const [summary, setSummary] = React.useState(null);
	const [counts, setCounts] = React.useState({ sales: 0, expenses: 0 });
	const [loading, setLoading] = React.useState(true);
	const [loadError, setLoadError] = React.useState('');
	const [query, setQuery] = React.useState('');
	const [form, setForm] = React.useState({ title: '', amount: '', paymentMethod: 'Cash', date: exLocalInputNow() });
	const [touched, setTouched] = React.useState(false);
	const [saving, setSaving] = React.useState(false);
	const [toast, setToast] = React.useState(null);
	const flash = (type, text) => { setToast({ type, text }); setTimeout(() => setToast(null), 3500); };

	const [start, end] = React.useMemo(() => exRange(period, customDay), [period, customDay]);
	const periodLabel = period === 'custom' ? UI.formatDate(start) : (EX_PERIODS.find(p => p[0] === period) || [])[1];

	const load = React.useCallback(async () => {
		setLoading(true); setLoadError('');
		try {
			const sumUrl = new URL(salesUrl + '/api/branch-expense-summary');
			sumUrl.searchParams.set('start', start.toISOString());
			sumUrl.searchParams.set('end', end.toISOString());
			const [listRes, sumRes] = await Promise.all([
				fetch(salesUrl + '/api/branch-expenses', { headers }),
				fetch(sumUrl, { headers }),
			]);
			const list = await listRes.json().catch(() => ({}));
			const sum = await sumRes.json().catch(() => ({}));
			if (!listRes.ok) throw new Error(list.message || 'Could not load expenses');
			setRows(Array.isArray(list.expenses) ? list.expenses : []);
			if (sumRes.ok && sum.summary) { setSummary(sum.summary); setCounts(sum.counts || { sales: 0, expenses: 0 }); }
		} catch (e) { setLoadError(e.message); }
		finally { setLoading(false); }
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [salesUrl, authToken, start.getTime(), end.getTime()]);

	React.useEffect(() => { load(); }, [load]);

	const inPeriod = React.useMemo(() => rows
		.map(r => ({ ...r, when: new Date(r.date || r.createdAt) }))
		.filter(r => r.when >= start && r.when <= end)
		.sort((a, b) => b.when - a.when), [rows, start, end]);

	const shown = React.useMemo(() => {
		const q = query.trim().toLowerCase();
		return q ? inPeriod.filter(r => String(r.title || '').toLowerCase().includes(q) || String(r.paymentMethod || '').toLowerCase().includes(q)) : inPeriod;
	}, [inPeriod, query]);

	const totalExpense = inPeriod.reduce((s, r) => s + (Number(r.amount) || 0), 0);
	const byMethod = EX_METHODS.map(m => ({ ...m, amount: inPeriod.filter(r => r.paymentMethod === m.v).reduce((s, r) => s + (Number(r.amount) || 0), 0) })).filter(m => m.amount > 0);
	const days = React.useMemo(() => {
		const out = [];
		shown.forEach(r => {
			const key = UI.formatDate(r.when);
			let g = out.find(x => x.key === key);
			if (!g) { g = { key, total: 0, items: [] }; out.push(g); }
			g.total += Number(r.amount) || 0; g.items.push(r);
		});
		return out;
	}, [shown]);

	const sales = summary ? Number(summary.salesRevenue) || 0 : 0;
	const cost = summary ? Number(summary.stockRevenue) || 0 : 0;
	const profit = sales - cost - totalExpense;
	const flowBase = Math.max(sales, cost + totalExpense, 1);
	const pct = (n) => Math.max(0, Math.min(100, (n / flowBase) * 100));

	// form
	const amountNum = Number(form.amount);
	const errors = {};
	if (!form.title.trim()) errors.title = 'What was this expense for?';
	if (!(amountNum > 0)) errors.amount = 'Enter the amount spent';
	if (!form.date) errors.date = 'Pick when it was paid';
	else if (new Date(form.date) > new Date(Date.now() + 60000)) errors.date = 'Date cannot be in the future';
	const hasErrors = Object.keys(errors).length > 0;
	const activeCat = exCategoryOf(form.title);

	const submit = async (e) => {
		e.preventDefault();
		setTouched(true);
		if (hasErrors) return;
		setSaving(true);
		try {
			const res = await fetch(salesUrl + '/api/branch-expenses', {
				method: 'POST', headers,
				body: JSON.stringify({ title: form.title.trim(), amount: amountNum, paymentMethod: form.paymentMethod, date: new Date(form.date).toISOString() })
			});
			const d = await res.json().catch(() => ({}));
			if (!res.ok || d.success === false) throw new Error(d.message || 'Could not save the expense');
			flash('ok', `${UI.money(amountNum)} for "${form.title.trim()}" added`);
			setForm({ title: '', amount: '', paymentMethod: form.paymentMethod, date: exLocalInputNow() });
			setTouched(false);
			try { window.dispatchEvent(new Event('branch-expense-created')); } catch (_) {}
			load();
		} catch (err) { flash('err', err.message); }
		finally { setSaving(false); }
	};

	return (
		<div className="dl">
			<style>{UI.CSS + '\n' + EX_CSS}</style>

			<div className="dl-head">
				<div>
					<h1>Expenses</h1>
					<p>Money spent from the branch — tea, transport, rent, bills. Expenses reduce your profit for the day.</p>
				</div>
			</div>

			<div className="ex-period" role="group" aria-label="Period">
				<div className="dl-chips">
					{EX_PERIODS.map(([k, l]) => (
						<button key={k} type="button" className={period === k ? 'on' : ''} onClick={() => setPeriod(k)}>{l}</button>
					))}
				</div>
				{period === 'custom' && (
					<input type="date" value={customDay} max={UI.todayInput()} onChange={e => setCustomDay(e.target.value || UI.todayInput())} aria-label="Day to show" />
				)}
			</div>

			<div className="dl-stats">
				<div className="dl-stat"><div className="k">Sales</div><div className="v">{summary ? UI.money(sales) : '—'}</div><div className="s">{counts.sales} bill{counts.sales === 1 ? '' : 's'} · {periodLabel}</div></div>
				<div className="dl-stat"><div className="k">Cost of goods sold</div><div className="v">{summary ? UI.money(cost) : '—'}</div><div className="s">Purchase price of items sold</div></div>
				<div className="dl-stat warn"><div className="k">Expenses</div><div className="v">{UI.money(totalExpense)}</div><div className="s">{inPeriod.length} entr{inPeriod.length === 1 ? 'y' : 'ies'} · {periodLabel}</div></div>
				<div className={'dl-stat ' + (profit >= 0 ? 'ok' : '')}><div className="k">Profit</div><div className="v" style={profit < 0 ? { color: 'var(--dl-er)' } : undefined}>{summary ? UI.money(profit) : '—'}</div><div className="s">{profit < 0 ? 'Loss — spending is more than earnings' : 'After cost and expenses'}</div></div>
			</div>

			{summary && (
				<div className="dl-card" style={{ padding: 16, marginBottom: 16 }}>
					<div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
						<b>Where the money from sales went · {periodLabel}</b>
						<span className="dl-sub">{sales > 0 ? `Expenses are ${Math.round((totalExpense / sales) * 100)}% of sales` : 'No sales in this period yet'}</span>
					</div>
					<div className="ex-flow" role="img" aria-label={`Cost ${UI.money(cost)}, expenses ${UI.money(totalExpense)}, profit ${UI.money(Math.max(0, profit))}`}>
						<i style={{ width: pct(cost) + '%', background: '#94a3b8' }} />
						<i style={{ width: pct(totalExpense) + '%', background: '#f59e0b' }} />
						<i style={{ width: pct(Math.max(0, profit)) + '%', background: '#22c55e' }} />
					</div>
					<div className="ex-legend">
						<span><i className="ex-dot" style={{ background: '#94a3b8' }} />Cost of goods <b>{UI.money(cost)}</b></span>
						<span><i className="ex-dot" style={{ background: '#f59e0b' }} />Expenses <b>{UI.money(totalExpense)}</b></span>
						<span><i className="ex-dot" style={{ background: profit >= 0 ? '#22c55e' : '#ef4444' }} />{profit >= 0 ? 'Profit' : 'Loss'} <b>{UI.money(Math.abs(profit))}</b></span>
					</div>
					<div className="ex-eq">
						<b>{UI.money(sales)}</b> sales − <b>{UI.money(cost)}</b> cost − <b>{UI.money(totalExpense)}</b> expenses = <b style={{ color: profit >= 0 ? 'var(--dl-ok)' : 'var(--dl-er)' }}>{UI.money(profit)}</b> {profit >= 0 ? 'profit' : 'loss'}
					</div>
				</div>
			)}

			<div className="ex-layout">
				<form className="dl-card" style={{ padding: 18 }} onSubmit={submit} noValidate>
					<div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Add an expense</div>
					<div className="dl-sub" style={{ whiteSpace: 'normal', marginBottom: 14 }}>Record money paid out from the branch as soon as you spend it.</div>

					<div className="dl-f" style={{ marginBottom: 12 }}>
						<label htmlFor="ex-title">What was it for? <i>*</i></label>
						<div className="ex-cat" role="group" aria-label="Common expenses">
							{EX_CATEGORIES.map(c => (
								<button key={c.label} type="button" className={activeCat === c ? 'on' : ''} onClick={() => setForm(f => ({ ...f, title: c.label }))}>{c.icon} {c.label}</button>
							))}
						</div>
						<input id="ex-title" value={form.title} maxLength={120} placeholder="Or type it, e.g. Courier to Chennai" onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={touched && errors.title ? 'bad' : ''} style={{ marginTop: 4 }} />
						{touched && errors.title ? <small className="err">{errors.title}</small> : null}
					</div>

					<div className="dl-grid" style={{ marginBottom: 12 }}>
						<div className="dl-f">
							<label htmlFor="ex-amount">Amount <i>*</i></label>
							<div className="dl-money"><span>₹</span>
								<input id="ex-amount" type="number" min="0" step="0.01" inputMode="decimal" value={form.amount} placeholder="0.00" onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={touched && errors.amount ? 'bad' : ''} />
							</div>
							{touched && errors.amount ? <small className="err">{errors.amount}</small> : null}
						</div>
						<div className="dl-f">
							<label htmlFor="ex-date">When</label>
							<input id="ex-date" type="datetime-local" value={form.date} max={exLocalInputNow()} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={touched && errors.date ? 'bad' : ''} />
							{touched && errors.date ? <small className="err">{errors.date}</small> : null}
						</div>
					</div>

					<div className="dl-f" style={{ marginBottom: 16 }}>
						<label id="ex-method-l">Paid by</label>
						<div className="dl-seg" role="radiogroup" aria-labelledby="ex-method-l">
							{EX_METHODS.map(m => (
								<button key={m.v} type="button" role="radio" aria-checked={form.paymentMethod === m.v} className={form.paymentMethod === m.v ? 'on' : ''} onClick={() => setForm(f => ({ ...f, paymentMethod: m.v }))}>{m.i} {m.v}</button>
							))}
						</div>
					</div>

					<button type="submit" className="dl-btn pri" style={{ width: '100%' }} disabled={saving}>
						{saving ? 'Saving…' : amountNum > 0 ? `Add expense of ${UI.money(amountNum)}` : 'Add expense'}
					</button>
				</form>

				<div className="dl-card">
					<div className="dl-toolbar">
						<div style={{ flex: '1 1 200px', minWidth: 0 }}>
							<div style={{ fontWeight: 800, fontSize: 16 }}>Expenses · {periodLabel}</div>
							<div className="dl-sub" style={{ whiteSpace: 'normal' }}>
								{inPeriod.length ? `${UI.money(totalExpense)} spent` + (byMethod.length ? ' — ' + byMethod.map(m => `${m.i} ${m.v} ${UI.money(m.amount)}`).join(' · ') : '') : 'Nothing spent in this period'}
							</div>
						</div>
						{inPeriod.length > 3 && (
							<div className="dl-search plain" style={{ flex: '0 1 220px' }}><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search expenses" aria-label="Search expenses" /></div>
						)}
					</div>

					{loading ? (
						<div className="dl-empty"><div className="i">⏳</div>Loading expenses…</div>
					) : loadError ? (
						<div className="dl-empty"><div className="i">⚠️</div><b>{loadError}</b><button type="button" className="dl-btn sec sm" onClick={load}>Try again</button></div>
					) : inPeriod.length === 0 ? (
						<div className="dl-empty"><div className="i">🧾</div><b>No expenses {period === 'today' ? 'today' : 'in this period'}</b>Use the form to record money spent from the branch. It will show up here and in your profit.</div>
					) : shown.length === 0 ? (
						<div className="dl-empty"><div className="i">🔎</div><b>No expenses match</b></div>
					) : days.map(g => (
						<div key={g.key}>
							{(days.length > 1 || period !== 'today') && <div className="dl-day"><span>{g.key}</span><span>Spent {UI.money(g.total)}</span></div>}
							{g.items.map(r => {
								const cat = exCategoryOf(r.title);
								return (
									<div key={r._id} className="ex-item">
										<div className="ic" aria-hidden="true">{cat ? cat.icon : '💸'}</div>
										<div style={{ flex: 1, minWidth: 0 }}>
											<div className="dl-name" style={{ fontSize: 14.5 }}>{r.title || 'Expense'}</div>
											<div className="dl-sub">{r.when.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}{r.paymentMethod ? ' · ' + r.paymentMethod : ''}</div>
										</div>
										<div className="dl-num" style={{ color: 'var(--dl-wa)' }}>− {UI.money(r.amount)}</div>
									</div>
								);
							})}
						</div>
					))}
				</div>
			</div>

			{toast && <div className={'dl-toast ' + toast.type} role="status">{toast.text}</div>}
		</div>
	);
}

window.BranchNewExpense = BranchNewExpense;

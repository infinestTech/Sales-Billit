// Dealers (suppliers) for the branch portal: who the branch buys from and how much is owed to each.
// Balances come from the dealer credit book (GET /api/dealer-ledger); new dealers are created with
// POST /api/suppliers, optionally with the opening credit owed before the shop started using the app.
// Used on desktop and mobile (layout is responsive; styles in src/utils/dealerUi.js).

const DL_EMPTY_FORM = { supplierName: '', agencyName: '', phoneNumber: '', email: '', address: '', gstNumber: '', panNumber: '', openingCredit: '' };
const DL_GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const DL_PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

function dealerFormErrors(f) {
	const e = {};
	if (!f.supplierName.trim() && !f.agencyName.trim()) e.supplierName = 'Enter the dealer or agency name';
	const phone = f.phoneNumber.replace(/[\s-]/g, '');
	if (phone && !/^(\+?91)?[6-9]\d{9}$/.test(phone)) e.phoneNumber = 'Enter a valid 10-digit mobile number';
	if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Enter a valid email address';
	if (f.gstNumber.trim() && !DL_GSTIN_RE.test(f.gstNumber.trim().toUpperCase())) e.gstNumber = 'GSTIN should look like 33AASFC4203F1ZS';
	if (f.panNumber.trim() && !DL_PAN_RE.test(f.panNumber.trim().toUpperCase())) e.panNumber = 'PAN should look like ABCDE1234F';
	const oc = f.openingCredit === '' ? 0 : Number(f.openingCredit);
	if (!Number.isFinite(oc) || oc < 0) e.openingCredit = 'Enter 0 or a positive amount';
	return e;
}

function CreateSupplier({ salesUrl, token }) {
	const UI = window.DealerUI;
	const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('branch_token') || '' : '');
	const [dealers, setDealers] = React.useState([]);
	const [totals, setTotals] = React.useState(null);
	const [loading, setLoading] = React.useState(true);
	const [loadError, setLoadError] = React.useState('');
	const [query, setQuery] = React.useState('');
	const [filter, setFilter] = React.useState('all'); // all | dues | clear
	const [sort, setSort] = React.useState('recent'); // recent | due | name
	const [drawer, setDrawer] = React.useState(false);
	const [form, setForm] = React.useState(DL_EMPTY_FORM);
	const [touched, setTouched] = React.useState(false);
	const [saving, setSaving] = React.useState(false);
	const [toast, setToast] = React.useState(null);

	const flash = (type, text) => { setToast({ type, text }); setTimeout(() => setToast(null), 3500); };

	const load = React.useCallback(async () => {
		setLoading(true); setLoadError('');
		try {
			const res = await fetch(salesUrl + '/api/dealer-ledger', { headers: { Authorization: 'Bearer ' + authToken } });
			const d = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(d.message || 'Could not load dealers');
			setDealers(Array.isArray(d.dealers) ? d.dealers : []);
			setTotals(d.totals || null);
		} catch (e) { setLoadError(e.message); }
		finally { setLoading(false); }
	}, [salesUrl, authToken]);

	React.useEffect(() => { load(); }, [load]);

	const visible = React.useMemo(() => {
		const q = query.trim().toLowerCase();
		let list = dealers.filter(d => {
			if (filter === 'dues' && !(d.outstanding > 0)) return false;
			if (filter === 'clear' && d.outstanding > 0) return false;
			if (!q) return true;
			return [d.supplierName, d.agencyName, d.phoneNumber, d.gstNumber, d.email].some(v => String(v || '').toLowerCase().includes(q));
		});
		if (sort === 'due') list = list.slice().sort((a, b) => b.outstanding - a.outstanding);
		else if (sort === 'name') list = list.slice().sort((a, b) => UI.dealerName(a).localeCompare(UI.dealerName(b)));
		return list;
	}, [dealers, query, filter, sort]);

	const errors = dealerFormErrors(form);
	const hasErrors = Object.keys(errors).length > 0;
	const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
	const openDrawer = () => { setForm(DL_EMPTY_FORM); setTouched(false); setDrawer(true); };
	const closeDrawer = () => { if (!saving) setDrawer(false); };

	React.useEffect(() => {
		if (!drawer) return;
		const onKey = (e) => { if (e.key === 'Escape') closeDrawer(); };
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	});

	const save = async (e) => {
		e.preventDefault();
		setTouched(true);
		if (hasErrors) return;
		setSaving(true);
		try {
			const body = {
				supplierName: form.supplierName.trim(),
				agencyName: form.agencyName.trim(),
				phoneNumber: form.phoneNumber.trim(),
				email: form.email.trim(),
				address: form.address.trim(),
				gstNumber: form.gstNumber.trim().toUpperCase(),
				panNumber: form.panNumber.trim().toUpperCase(),
				openingCredit: form.openingCredit === '' ? 0 : Number(form.openingCredit)
			};
			const res = await fetch(salesUrl + '/api/suppliers', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + authToken },
				body: JSON.stringify(body)
			});
			const d = await res.json().catch(() => ({}));
			if (!res.ok || d.success === false) throw new Error(d.message || 'Could not add the dealer');
			setDrawer(false);
			flash('ok', `${UI.dealerName(body)} added${body.openingCredit > 0 ? ` with ${UI.money(body.openingCredit)} opening credit` : ''}`);
			load();
		} catch (err) { flash('err', err.message); }
		finally { setSaving(false); }
	};

	const field = (key, label, opts = {}) => (
		<div className={'dl-f' + (opts.full ? ' full' : '')}>
			<label htmlFor={'dl-' + key}>{label}{opts.required ? <i> *</i> : null}</label>
			{opts.textarea ? (
				<textarea id={'dl-' + key} rows={2} value={form[key]} onChange={set(key)} placeholder={opts.placeholder} className={touched && errors[key] ? 'bad' : ''} />
			) : (
				<input id={'dl-' + key} value={form[key]} onChange={set(key)} placeholder={opts.placeholder} inputMode={opts.inputMode}
					autoComplete="off" style={opts.upper ? { textTransform: 'uppercase' } : undefined} className={touched && errors[key] ? 'bad' : ''} />
			)}
			{touched && errors[key] ? <small className="err">{errors[key]}</small> : opts.hint ? <small>{opts.hint}</small> : null}
		</div>
	);

	return (
		<div className="dl">
			<style>{UI.CSS}</style>

			<div className="dl-head">
				<div>
					<h1>Dealers</h1>
					<p>The dealers and suppliers this branch buys from, and what you owe each of them.</p>
				</div>
				<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
					<button type="button" className="dl-btn sec" onClick={() => { location.hash = '#dealer-credits'; }}>💳 Dealer Credits</button>
					<button type="button" className="dl-btn pri" onClick={openDrawer}>＋ Add dealer</button>
				</div>
			</div>

			<div className="dl-stats">
				<div className="dl-stat"><div className="k">Dealers</div><div className="v">{totals ? totals.dealers : '—'}</div><div className="s">{totals ? `${totals.dealersWithDues} with dues` : ' '}</div></div>
				<div className="dl-stat warn"><div className="k">Total due</div><div className="v">{totals ? UI.money(totals.outstanding) : '—'}</div><div className="s">Credit not yet paid</div></div>
				<div className="dl-stat"><div className="k">Credit purchases</div><div className="v">{totals ? UI.money(totals.totalCredit) : '—'}</div><div className="s">Including opening credit</div></div>
				<div className="dl-stat ok"><div className="k">Paid today</div><div className="v">{totals ? UI.money(totals.paidToday) : '—'}</div><div className="s">To all dealers</div></div>
			</div>

			<div className="dl-card">
				<div className="dl-toolbar">
					<div className="dl-search">
						<span>🔍</span>
						<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, agency, phone or GSTIN" aria-label="Search dealers" />
					</div>
					<div className="dl-chips" role="group" aria-label="Filter dealers">
						{[['all', 'All'], ['dues', 'With dues'], ['clear', 'Settled']].map(([k, l]) => (
							<button key={k} type="button" className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>
						))}
					</div>
					<select className="dl-select" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort dealers">
						<option value="recent">Recently added</option>
						<option value="due">Highest due</option>
						<option value="name">Name A–Z</option>
					</select>
				</div>

				{loading ? (
					<div className="dl-empty"><div className="i">⏳</div>Loading dealers…</div>
				) : loadError ? (
					<div className="dl-empty"><div className="i">⚠️</div><b>{loadError}</b><button type="button" className="dl-btn sec sm" onClick={load}>Try again</button></div>
				) : dealers.length === 0 ? (
					<div className="dl-empty">
						<div className="i">🏢</div>
						<b>No dealers yet</b>
						Add the dealers you buy stock from. You can record what you already owe them as opening credit.
						<div style={{ marginTop: 14 }}><button type="button" className="dl-btn pri" onClick={openDrawer}>＋ Add your first dealer</button></div>
					</div>
				) : visible.length === 0 ? (
					<div className="dl-empty"><div className="i">🔎</div><b>No dealers match</b>Try a different search or filter.</div>
				) : (
					<div role="table" aria-label="Dealers">
						<div className="dl-row h" role="row">
							<div>Dealer</div><div className="hide-sm">Contact</div><div className="hide-sm">GSTIN</div><div className="hide-sm">Last paid</div><div style={{ textAlign: 'right' }}>Due</div>
						</div>
						{visible.map(d => (
							<div key={d._id} className="dl-row" role="row">
								<div className="dl-who">
									<div className="dl-av" aria-hidden="true">{UI.initials(UI.dealerName(d))}</div>
									<div style={{ minWidth: 0 }}>
										<div className="dl-name">{UI.dealerName(d)}</div>
										<div className="dl-sub">{d.supplierName && d.agencyName ? d.agencyName : (d.address || 'Added ' + UI.formatDate(d.createdAt))}</div>
									</div>
								</div>
								<div className="hide-sm" style={{ minWidth: 0 }}>
									<div className="dl-sub" style={{ color: 'var(--dl-tx)' }}>{d.phoneNumber ? <a href={'tel:' + d.phoneNumber} style={{ color: 'inherit', textDecoration: 'none' }}>📞 {d.phoneNumber}</a> : '—'}</div>
									{d.email ? <div className="dl-sub">{d.email}</div> : null}
								</div>
								<div className="hide-sm dl-sub" style={{ fontFamily: 'monospace' }}>{d.gstNumber || '—'}</div>
								<div className="hide-sm dl-sub">{d.lastPaymentAt ? UI.formatDate(d.lastPaymentAt) : (d.bills ? 'Not paid yet' : '—')}</div>
								<div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
									{d.outstanding > 0
										? <span className="dl-badge due">{UI.money(d.outstanding)}</span>
										: <span className={'dl-badge ' + (d.bills ? 'ok' : 'mu')}>{d.bills ? 'Settled' : 'No credit'}</span>}
									<button type="button" className="dl-btn ghost" onClick={() => UI.openDealerCredits(d._id)} aria-label={'Open credit book for ' + UI.dealerName(d)}>
										{d.outstanding > 0 ? 'Pay ›' : 'View ›'}
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{drawer && (
				<div className="dl-overlay" onMouseDown={e => { if (e.target === e.currentTarget) closeDrawer(); }}>
					<form className="dl-drawer" role="dialog" aria-modal="true" aria-labelledby="dl-add-title" onSubmit={save} noValidate>
						<div className="dl-dh">
							<h2 id="dl-add-title">Add dealer</h2>
							<button type="button" className="dl-x" onClick={closeDrawer} aria-label="Close">✕</button>
						</div>
						<div className="dl-db">
							<div className="dl-sec">
								<h3>Dealer details</h3>
								<div className="dl-grid">
									{field('supplierName', 'Dealer name', { required: true, placeholder: 'e.g. Ravi Kumar', full: true })}
									{field('agencyName', 'Agency / company', { placeholder: 'e.g. Sri Murugan Mobiles', full: true, hint: 'Either the dealer or the agency name is enough' })}
								</div>
							</div>
							<div className="dl-sec">
								<h3>Contact</h3>
								<div className="dl-grid">
									{field('phoneNumber', 'Mobile number', { placeholder: '98765 43210', inputMode: 'tel' })}
									{field('email', 'Email', { placeholder: 'dealer@example.com', inputMode: 'email' })}
									{field('address', 'Address', { placeholder: 'Street, area, city', textarea: true, full: true })}
								</div>
							</div>
							<div className="dl-sec">
								<h3>Tax details</h3>
								<div className="dl-grid">
									{field('gstNumber', 'GSTIN', { placeholder: '33AASFC4203F1ZS', upper: true })}
									{field('panNumber', 'PAN', { placeholder: 'ABCDE1234F', upper: true })}
								</div>
							</div>
							<div className="dl-sec">
								<h3>Opening credit</h3>
								<div className="dl-callout">
									<div className="dl-f">
										<label htmlFor="dl-openingCredit">Amount you already owe this dealer</label>
										<div className="dl-money">
											<span>₹</span>
											<input id="dl-openingCredit" type="number" min="0" step="0.01" inputMode="decimal" value={form.openingCredit}
												onChange={set('openingCredit')} placeholder="0.00" className={touched && errors.openingCredit ? 'bad' : ''} />
										</div>
										{touched && errors.openingCredit
											? <small className="err">{errors.openingCredit}</small>
											: <small>Credit from before you started using Fixel. It appears in Dealer Credits and is settled first when you pay this dealer. Leave empty if nothing is due.</small>}
									</div>
								</div>
							</div>
						</div>
						<div className="dl-df">
							<button type="button" className="dl-btn sec" onClick={closeDrawer} disabled={saving}>Cancel</button>
							<button type="submit" className="dl-btn pri" disabled={saving || (touched && hasErrors)}>{saving ? 'Saving…' : 'Add dealer'}</button>
						</div>
					</form>
				</div>
			)}

			{toast && <div className={'dl-toast ' + toast.type} role="status">{toast.text}</div>}
		</div>
	);
}

window.CreateSupplier = CreateSupplier;

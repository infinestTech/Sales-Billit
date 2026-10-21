// Dealer Credits (branch portal, #dealer-credits): what the branch owes each dealer from credit purchases and
// opening credit, and paying it off day by day. A payment settles the dealer's bills oldest first.
// SalesServer: GET /api/dealer-ledger, GET /api/dealer-ledger/:id, POST /api/dealer-ledger/:id/pay.

const DLC_METHODS = ['Cash', 'Gpay', 'Card', 'Bank Transfer', 'Cheque'];
const DLC_ICON = { Cash: '💵', Gpay: '📱', Card: '💳', 'Bank Transfer': '🏦', Cheque: '🧾' };

// Which bills a payment would settle (oldest first, same as the server)
function dlcAllocate(bills, amount) {
	let left = Math.round((Number(amount) || 0) * 100) / 100;
	const out = [];
	for (const b of bills) {
		if (left <= 0) break;
		if (!(b.outstanding > 0)) continue;
		const part = Math.min(b.outstanding, left);
		out.push({ label: b.label, amount: part, clears: part >= b.outstanding });
		left = Math.round((left - part) * 100) / 100;
	}
	return out;
}

function DealerCredits({ salesUrl, token }) {
	const UI = window.DealerUI;
	const authToken = token || localStorage.getItem('branch_token') || '';
	const headers = { Authorization: 'Bearer ' + authToken, 'Content-Type': 'application/json' };

	const [dealers, setDealers] = React.useState([]);
	const [totals, setTotals] = React.useState(null);
	const [loading, setLoading] = React.useState(true);
	const [loadError, setLoadError] = React.useState('');
	const [query, setQuery] = React.useState('');
	const [onlyDues, setOnlyDues] = React.useState(true);
	const [selectedId, setSelectedId] = React.useState(() => {
		try { const id = sessionStorage.getItem('dealerCredits.selected') || ''; sessionStorage.removeItem('dealerCredits.selected'); return id; } catch (e) { return ''; }
	});
	const [showDetail, setShowDetail] = React.useState(!!selectedId); // narrow screens: list ↔ detail
	const [ledger, setLedger] = React.useState(null);
	const [ledgerLoading, setLedgerLoading] = React.useState(false);
	const [tab, setTab] = React.useState('bills');
	const [pay, setPay] = React.useState({ amount: '', method: 'Cash', paidOn: UI.todayInput(), note: '' });
	const [paying, setPaying] = React.useState(false);
	const [payError, setPayError] = React.useState('');
	const [toast, setToast] = React.useState(null);
	const flash = (type, text) => { setToast({ type, text }); setTimeout(() => setToast(null), 3500); };

	const loadSummary = React.useCallback(async () => {
		setLoadError('');
		try {
			const res = await fetch(salesUrl + '/api/dealer-ledger', { headers });
			const d = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(d.message || 'Could not load dealer credits');
			const list = Array.isArray(d.dealers) ? d.dealers : [];
			setDealers(list);
			setTotals(d.totals || null);
			// Opened from a dealer that is settled: show all dealers so it stays visible
			setSelectedId(cur => {
				const pick = cur && list.find(x => String(x._id) === String(cur));
				if (pick && !(pick.outstanding > 0)) setOnlyDues(false);
				if (pick) return cur;
				const first = list.filter(x => x.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding)[0] || list[0];
				return first ? String(first._id) : '';
			});
		} catch (e) { setLoadError(e.message); }
		finally { setLoading(false); }
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [salesUrl, authToken]);

	const loadLedger = React.useCallback(async (id) => {
		if (!id) { setLedger(null); return; }
		setLedgerLoading(true);
		try {
			const res = await fetch(salesUrl + '/api/dealer-ledger/' + encodeURIComponent(id), { headers });
			const d = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(d.message || 'Could not load this dealer');
			setLedger(d);
		} catch (e) { setLedger(null); flash('err', e.message); }
		finally { setLedgerLoading(false); }
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [salesUrl, authToken]);

	React.useEffect(() => { loadSummary(); }, [loadSummary]);
	React.useEffect(() => {
		loadLedger(selectedId);
		setPay(p => ({ ...p, amount: '', note: '' }));
		setPayError('');
	}, [selectedId, loadLedger]);

	const list = React.useMemo(() => {
		const q = query.trim().toLowerCase();
		return dealers
			.filter(d => (!onlyDues || d.outstanding > 0 || String(d._id) === String(selectedId)))
			.filter(d => !q || [d.supplierName, d.agencyName, d.phoneNumber].some(v => String(v || '').toLowerCase().includes(q)))
			.sort((a, b) => b.outstanding - a.outstanding || UI.dealerName(a).localeCompare(UI.dealerName(b)));
	}, [dealers, query, onlyDues, selectedId]);

	const due = ledger ? ledger.totals.outstanding : 0;
	const amountNum = Number(pay.amount) || 0;
	const allocation = ledger ? dlcAllocate(ledger.bills, Math.min(amountNum, due)) : [];

	const submitPay = async (e) => {
		e.preventDefault();
		setPayError('');
		if (!(amountNum > 0)) { setPayError('Enter the amount paid'); return; }
		if (amountNum > due + 0.001) { setPayError(`That is more than the ${UI.money(due)} due`); return; }
		if (!pay.paidOn) { setPayError('Pick the payment date'); return; }
		setPaying(true);
		try {
			const [y, m, d] = pay.paidOn.split('-').map(Number);
			const now = new Date();
			const paidOn = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
			const res = await fetch(salesUrl + '/api/dealer-ledger/' + encodeURIComponent(selectedId) + '/pay', {
				method: 'POST', headers, body: JSON.stringify({ amount: amountNum, method: pay.method, note: pay.note.trim(), paidOn: (paidOn > now ? now : paidOn).toISOString() })
			});
			const out = await res.json().catch(() => ({}));
			if (!res.ok || !out.success) throw new Error(out.message || 'Payment not saved');
			flash('ok', `${UI.money(amountNum)} paid to ${UI.dealerName(ledger.dealer)}${out.outstanding > 0 ? ` — ${UI.money(out.outstanding)} still due` : ' — fully settled'}`);
			setPay(p => ({ ...p, amount: '', note: '' }));
			setTab('payments');
			await Promise.all([loadLedger(selectedId), loadSummary()]);
		} catch (err) { setPayError(err.message); }
		finally { setPaying(false); }
	};

	const select = (id) => { setSelectedId(String(id)); setShowDetail(true); setTab('bills'); };

	// Payments grouped by day, newest first
	const paymentDays = React.useMemo(() => {
		const groups = [];
		(ledger ? ledger.payments : []).forEach(p => {
			const key = UI.formatDate(p.paidOn);
			let g = groups.find(x => x.key === key);
			if (!g) { g = { key, total: 0, items: [] }; groups.push(g); }
			g.total += p.amount; g.items.push(p);
		});
		return groups;
	}, [ledger]);

	const dealer = ledger && ledger.dealer;
	const paidPct = ledger && ledger.totals.totalCredit > 0 ? Math.min(100, (ledger.totals.totalPaid / ledger.totals.totalCredit) * 100) : 0;

	return (
		<div className="dl">
			<style>{UI.CSS}</style>
			<div className="dl-head">
				<div>
					<h1>Dealer Credits</h1>
					<p>Track what you owe each dealer and settle it day by day. Payments clear the oldest bills first.</p>
				</div>
				<button type="button" className="dl-btn sec" onClick={() => { location.hash = '#supplier'; }}>🏢 Dealers</button>
			</div>

			<div className="dl-stats">
				<div className="dl-stat warn"><div className="k">Total due</div><div className="v">{totals ? UI.money(totals.outstanding) : '—'}</div><div className="s">{totals ? `${totals.dealersWithDues} dealer${totals.dealersWithDues === 1 ? '' : 's'} to pay` : ' '}</div></div>
				<div className="dl-stat ok"><div className="k">Paid today</div><div className="v">{totals ? UI.money(totals.paidToday) : '—'}</div><div className="s">All dealers</div></div>
				<div className="dl-stat"><div className="k">Total paid</div><div className="v">{totals ? UI.money(totals.totalPaid) : '—'}</div><div className="s">Since the start</div></div>
				<div className="dl-stat"><div className="k">Credit taken</div><div className="v">{totals ? UI.money(totals.totalCredit) : '—'}</div><div className="s">Purchases + opening credit</div></div>
			</div>

			{loading ? (
				<div className="dl-card dl-empty"><div className="i">⏳</div>Loading dealer credits…</div>
			) : loadError ? (
				<div className="dl-card dl-empty"><div className="i">⚠️</div><b>{loadError}</b><button type="button" className="dl-btn sec sm" onClick={loadSummary}>Try again</button></div>
			) : dealers.length === 0 ? (
				<div className="dl-card dl-empty">
					<div className="i">💳</div><b>No dealers yet</b>
					Add a dealer first. Credit purchases and opening credit will show up here.
					<div style={{ marginTop: 14 }}><button type="button" className="dl-btn pri" onClick={() => { location.hash = '#supplier'; }}>Go to Dealers</button></div>
				</div>
			) : (
				<div className={'dl-split' + (showDetail ? ' detail' : '')}>
					{/* Dealer list */}
					<div className="dl-card dl-side">
						<div className="dl-toolbar" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
							<div className="dl-search plain"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search dealer" aria-label="Search dealer" /></div>
							<div className="dl-chips" role="group" aria-label="Which dealers">
								<button type="button" className={onlyDues ? 'on' : ''} onClick={() => setOnlyDues(true)}>With dues</button>
								<button type="button" className={!onlyDues ? 'on' : ''} onClick={() => setOnlyDues(false)}>All dealers</button>
							</div>
						</div>
						<div className="dl-list">
							{list.length === 0 ? (
								<div className="dl-empty"><div className="i">🎉</div><b>{onlyDues ? 'Nothing due' : 'No match'}</b>{onlyDues ? 'Every dealer is fully paid.' : 'Try another search.'}</div>
							) : list.map(d => (
								<button key={d._id} type="button" className={'dl-li' + (String(d._id) === String(selectedId) ? ' on' : '')} onClick={() => select(d._id)}>
									<div className="dl-av" aria-hidden="true">{UI.initials(UI.dealerName(d))}</div>
									<div style={{ minWidth: 0 }}>
										<div className="dl-name">{UI.dealerName(d)}</div>
										<div className="dl-sub">{d.openBills ? `${d.openBills} open bill${d.openBills === 1 ? '' : 's'}` : d.bills ? 'All bills paid' : 'No credit yet'}</div>
									</div>
									<div className="r">
										<div className="dl-num" style={{ color: d.outstanding > 0 ? 'var(--dl-wa)' : 'var(--dl-ok)' }}>{UI.money(d.outstanding)}</div>
										<div className="dl-sub">{d.lastPaymentAt ? 'Paid ' + UI.formatDate(d.lastPaymentAt) : ' '}</div>
									</div>
								</button>
							))}
						</div>
					</div>

					{/* Dealer detail */}
					<div className="dl-main">
						{!dealer ? (
							<div className="dl-card dl-empty"><div className="i">👈</div>{ledgerLoading ? 'Loading…' : 'Choose a dealer'}</div>
						) : (
							<>
								<div className="dl-card" style={{ padding: 18 }}>
									<button type="button" className="dl-btn ghost dl-back" onClick={() => setShowDetail(false)} style={{ marginBottom: 8, paddingLeft: 0 }}>‹ All dealers</button>
									<div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between' }}>
										<div className="dl-who">
											<div className="dl-av" style={{ width: 48, height: 48, flexBasis: 48, fontSize: 16 }}>{UI.initials(UI.dealerName(dealer))}</div>
											<div style={{ minWidth: 0 }}>
												<div className="dl-name" style={{ fontSize: 18 }}>{UI.dealerName(dealer)}</div>
												<div className="dl-sub">
													{[dealer.supplierName && dealer.agencyName ? dealer.agencyName : '', dealer.phoneNumber, dealer.gstNumber ? 'GSTIN ' + dealer.gstNumber : ''].filter(Boolean).join(' · ') || 'No contact details'}
												</div>
											</div>
										</div>
										{dealer.phoneNumber ? <a className="dl-btn sec sm" href={'tel:' + dealer.phoneNumber} style={{ textDecoration: 'none' }}>📞 Call</a> : null}
									</div>
									<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12, marginTop: 16 }}>
										<div><div className="dl-sub">Credit taken</div><div className="dl-num" style={{ fontSize: 17 }}>{UI.money(ledger.totals.totalCredit)}</div></div>
										<div><div className="dl-sub">Paid</div><div className="dl-num" style={{ fontSize: 17, color: 'var(--dl-ok)' }}>{UI.money(ledger.totals.totalPaid)}</div></div>
										<div><div className="dl-sub">Due now</div><div className="dl-num" style={{ fontSize: 17, color: due > 0 ? 'var(--dl-wa)' : 'var(--dl-ok)' }}>{UI.money(due)}</div></div>
									</div>
									<div className="dl-bar" style={{ marginTop: 12 }} role="progressbar" aria-valuenow={Math.round(paidPct)} aria-valuemin="0" aria-valuemax="100" aria-label="Share of credit paid"><i style={{ width: paidPct + '%' }} /></div>
									<div className="dl-sub" style={{ marginTop: 6 }}>{Math.round(paidPct)}% of all credit paid</div>
								</div>

								<form className="dl-card" style={{ padding: 18 }} onSubmit={submitPay} noValidate>
									<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
										<div style={{ fontWeight: 800, fontSize: 16 }}>Record a payment</div>
										{due > 0 ? <span className="dl-badge due">{UI.money(due)} due</span> : <span className="dl-badge ok">✓ Fully settled</span>}
									</div>
									{due > 0 ? (
										<>
											<div className="dl-grid">
												<div className="dl-f">
													<label htmlFor="dlc-amount">Amount paid <i>*</i></label>
													<div className="dl-money"><span>₹</span>
														<input id="dlc-amount" type="number" min="0" step="0.01" inputMode="decimal" value={pay.amount} placeholder="0.00"
															onChange={e => { setPay(p => ({ ...p, amount: e.target.value })); setPayError(''); }} className={payError && /amount|more than/i.test(payError) ? 'bad' : ''} />
													</div>
													<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
														<button type="button" className="dl-btn ghost sm" style={{ height: 28, paddingLeft: 0 }} onClick={() => setPay(p => ({ ...p, amount: String(due) }))}>Pay full {UI.money(due)}</button>
													</div>
												</div>
												<div className="dl-f">
													<label htmlFor="dlc-date">Payment date</label>
													<input id="dlc-date" type="date" value={pay.paidOn} max={UI.todayInput()} onChange={e => setPay(p => ({ ...p, paidOn: e.target.value }))} />
												</div>
												<div className="dl-f full">
													<label id="dlc-method-l">Paid by</label>
													<div className="dl-seg" role="radiogroup" aria-labelledby="dlc-method-l">
														{DLC_METHODS.map(m => (
															<button key={m} type="button" role="radio" aria-checked={pay.method === m} className={pay.method === m ? 'on' : ''} onClick={() => setPay(p => ({ ...p, method: m }))}>{DLC_ICON[m]} {m}</button>
														))}
													</div>
												</div>
												<div className="dl-f full">
													<label htmlFor="dlc-note">Note <span style={{ fontWeight: 400, color: 'var(--dl-mu)' }}>(optional)</span></label>
													<input id="dlc-note" value={pay.note} maxLength={200} placeholder="e.g. UPI ref 4521, paid to Ravi" onChange={e => setPay(p => ({ ...p, note: e.target.value }))} />
												</div>
											</div>
											{amountNum > 0 && amountNum <= due + 0.001 && allocation.length > 0 && (
												<div className="dl-callout" style={{ marginTop: 14 }}>
													<div style={{ fontSize: 12, fontWeight: 800, color: 'var(--dl-ac)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>This payment settles</div>
													{allocation.map((a, i) => (
														<div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, padding: '2px 0' }}>
															<span>{a.label} {a.clears ? <span className="dl-badge ok" style={{ padding: '1px 8px' }}>cleared</span> : <span className="dl-badge mu" style={{ padding: '1px 8px' }}>part</span>}</span>
															<span className="dl-num">{UI.money(a.amount)}</span>
														</div>
													))}
													<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginTop: 6, paddingTop: 6, borderTop: '1px solid #c7d2fe' }}>
														<span>Still due after this</span><span className="dl-num">{UI.money(Math.max(0, due - amountNum))}</span>
													</div>
												</div>
											)}
											{payError && <div role="alert" style={{ marginTop: 10, color: 'var(--dl-er)', fontSize: 13.5, fontWeight: 600 }}>{payError}</div>}
											<div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
												<button type="submit" className="dl-btn pri" disabled={paying}>{paying ? 'Saving…' : amountNum > 0 ? `Save payment of ${UI.money(Math.min(amountNum, due))}` : 'Save payment'}</button>
											</div>
										</>
									) : (
										<div className="dl-sub" style={{ whiteSpace: 'normal' }}>Nothing is due to this dealer. New credit purchases from Purchase Inventory will appear here.</div>
									)}
								</form>

								<div className="dl-card">
									<div className="dl-tabs" role="tablist">
										{[['bills', `Bills (${ledger.bills.length})`], ['payments', `Payments (${ledger.payments.length})`], ['statement', 'Statement']].map(([k, l]) => (
											<button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
										))}
									</div>

									{tab === 'bills' && (ledger.bills.length === 0 ? (
										<div className="dl-empty"><div className="i">🧾</div><b>No credit bills</b>Buy stock on credit from this dealer in Purchase Inventory, or add opening credit when creating a dealer.</div>
									) : (
										<div style={{ overflowX: 'auto' }}>
											<table className="dl-table">
												<thead><tr><th>Bill</th><th>Date</th><th className="n">Amount</th><th className="n">Paid</th><th className="n">Due</th><th>Status</th></tr></thead>
												<tbody>
													{ledger.bills.map(b => (
														<tr key={b._id}>
															<td style={{ fontWeight: 600 }}>{b.kind === 'opening' ? '📌 ' : '🧾 '}{b.label}</td>
															<td>{UI.formatDate(b.billDate)}</td>
															<td className="n">{UI.money(b.totalAmount)}</td>
															<td className="n" style={{ color: 'var(--dl-ok)' }}>{UI.money(b.paidAmount)}</td>
															<td className="n" style={{ fontWeight: 700 }}>{UI.money(b.outstanding)}</td>
															<td>{b.outstanding <= 0 ? <span className="dl-badge ok">Settled</span> : b.paidAmount > 0 ? <span className="dl-badge ac">Part paid</span> : <span className="dl-badge due">Unpaid</span>}</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									))}

									{tab === 'payments' && (paymentDays.length === 0 ? (
										<div className="dl-empty"><div className="i">💸</div><b>No payments yet</b>Payments you record will be listed here day by day.</div>
									) : paymentDays.map(g => (
										<div key={g.key}>
											<div className="dl-day"><span>{g.key}</span><span>Paid {UI.money(g.total)}</span></div>
											{g.items.map(p => (
												<div key={p.id} className="dl-pay">
													<div className="ic" aria-hidden="true">{DLC_ICON[p.method] || '✓'}</div>
													<div style={{ flex: 1, minWidth: 0 }}>
														<div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
															<b>{p.method || 'Payment'}</b><span className="dl-num" style={{ color: 'var(--dl-ok)' }}>{UI.money(p.amount)}</span>
														</div>
														{p.note ? <div className="dl-sub" style={{ whiteSpace: 'normal' }}>{p.note}</div> : null}
														<div className="dl-sub" style={{ whiteSpace: 'normal' }}>{p.allocations.map(a => `${a.label} ${UI.money(a.amount)}`).join(' · ')}</div>
													</div>
												</div>
											))}
										</div>
									)))}

									{tab === 'statement' && (ledger.statement.length === 0 ? (
										<div className="dl-empty"><div className="i">📄</div><b>No entries yet</b></div>
									) : (
										<div style={{ overflowX: 'auto' }}>
											<table className="dl-table">
												<thead><tr><th>Date</th><th>Entry</th><th className="n">Credit</th><th className="n">Paid</th><th className="n">Balance</th></tr></thead>
												<tbody>
													{ledger.statement.map((s, i) => (
														<tr key={i}>
															<td>{UI.formatDate(s.date)}</td>
															<td>{s.label}</td>
															<td className="n">{s.credit ? UI.money(s.credit) : ''}</td>
															<td className="n" style={{ color: 'var(--dl-ok)' }}>{s.paid ? UI.money(s.paid) : ''}</td>
															<td className="n" style={{ fontWeight: 700 }}>{UI.money(s.balance)}</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									))}
								</div>
							</>
						)}
					</div>
				</div>
			)}

			{toast && <div className={'dl-toast ' + toast.type} role="status">{toast.text}</div>}
		</div>
	);
}

window.DealerCredits = DealerCredits;

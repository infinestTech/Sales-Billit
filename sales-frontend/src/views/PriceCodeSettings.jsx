// Branch portal "Price Code" screen: give each digit (1 2 3 4 5 6 7 8 9 0) its own secret character.
// Barcode labels and inventory then show the cost price written with those characters. One code for the
// whole shop — saved to Shop.sales_settings.price_cipher via SalesServer PATCH /api/shop-info/price-cipher.

function PriceCodeSettings({ salesUrl, token }) {
	const BL = window.BarcodeLabels;
	const DIGITS = BL.PRICE_CODE_DIGITS.split('');
	const EMPTY = DIGITS.map(() => '');
	const EXAMPLES = [450, 1299, 8750, 15999];

	const toSlots = (cipher) => {
		const chars = Array.from(String(cipher || ''));
		return chars.length === 10 ? chars : EMPTY.slice();
	};
	const cleanChar = (v) => {
		const c = Array.from(String(v || '').replace(/\s+/g, '')).pop() || '';
		return /[0-9]/.test(c) ? '' : c.toUpperCase();
	};

	const [saved, setSaved] = React.useState('');
	const [slots, setSlots] = React.useState(EMPTY.slice());
	const [quick, setQuick] = React.useState('');
	const [tryAmount, setTryAmount] = React.useState('1450');
	const [loading, setLoading] = React.useState(true);
	const [saving, setSaving] = React.useState(false);
	const [notice, setNotice] = React.useState(null); // { type: 'ok' | 'err', text }
	const boxes = React.useRef([]);

	React.useEffect(() => {
		let alive = true;
		setLoading(true);
		fetch(salesUrl + '/api/shop-info', { headers: { Authorization: 'Bearer ' + token } })
			.then(r => r.json().then(d => ({ ok: r.ok, d })))
			.then(({ ok, d }) => {
				if (!alive) return;
				if (!ok) throw new Error();
				const c = BL.normalizePriceCipher(d.priceCipher);
				setSaved(c); setSlots(toSlots(c));
			})
			.catch(() => { if (alive) setNotice({ type: 'err', text: 'Could not load the price code' }); })
			.finally(() => { if (alive) setLoading(false); });
		return () => { alive = false; };
	}, [salesUrl, token]);

	const cipher = slots.join('');
	const filled = slots.filter(Boolean).length;
	const duplicates = React.useMemo(() => {
		const seen = {};
		slots.forEach(c => { if (c) seen[c] = (seen[c] || 0) + 1; });
		return new Set(Object.keys(seen).filter(c => seen[c] > 1));
	}, [slots]);
	const complete = filled === 10 && duplicates.size === 0;
	const changed = cipher !== saved;
	const problem = filled === 0 ? '' : duplicates.size
		? `"${[...duplicates].join('", "')}" is used for more than one digit — each digit needs its own character`
		: filled < 10 ? `${10 - filled} digit${10 - filled === 1 ? '' : 's'} still need a character` : '';

	const flash = (type, text) => { setNotice({ type, text }); setTimeout(() => setNotice(null), 3500); };

	const setSlot = (i, value) => {
		const c = cleanChar(value);
		setSlots(s => s.map((x, j) => (j === i ? c : x)));
		if (c && i < 9) boxes.current[i + 1]?.focus();
	};

	const fillFrom = (text) => {
		const chars = Array.from(String(text || '').replace(/[\s0-9]+/g, '').toUpperCase()).slice(0, 10);
		setSlots(DIGITS.map((_, i) => chars[i] || ''));
	};

	const onBoxKey = (i, e) => {
		if (e.key === 'Backspace' && !slots[i] && i > 0) { e.preventDefault(); boxes.current[i - 1]?.focus(); setSlot(i - 1, ''); }
		else if (e.key === 'ArrowLeft' && i > 0) boxes.current[i - 1]?.focus();
		else if (e.key === 'ArrowRight' && i < 9) boxes.current[i + 1]?.focus();
	};

	const onBoxPaste = (i, e) => {
		const text = e.clipboardData.getData('text');
		if (Array.from(text.trim()).length > 1) { e.preventDefault(); fillFrom(text); }
	};

	const save = async (next) => {
		setSaving(true);
		try {
			const res = await fetch(salesUrl + '/api/shop-info/price-cipher', {
				method: 'PATCH',
				headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
				body: JSON.stringify({ cipher: next })
			});
			const d = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(d.message || 'Could not save the price code');
			const c = BL.normalizePriceCipher(d.priceCipher);
			setSaved(c); setSlots(toSlots(c)); setQuick('');
			flash('ok', c ? 'Price code saved — new labels will use it' : 'Price code removed');
		} catch (err) {
			flash('err', err.message || 'Could not save the price code');
		} finally {
			setSaving(false);
		}
	};

	const clearCode = () => {
		if (!window.confirm('Remove the price code? Labels will print without it until you set a new one.')) return;
		save('');
	};

	const previewCipher = complete ? cipher : '';
	const tryCode = previewCipher ? BL.encodePriceCode(tryAmount, previewCipher) : '';

	const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(15,23,42,0.06)' };
	const btn = (bg, color) => ({
		display: 'inline-flex', alignItems: 'center', gap: '6px', height: '44px', padding: '0 18px', border: 'none',
		borderRadius: '10px', background: bg, color, fontSize: '14px', fontWeight: 600, cursor: 'pointer'
	});

	if (loading) {
		return <div style={{ ...card, textAlign: 'center', color: '#64748b' }}>Loading price code…</div>;
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
			<div style={card}>
				<div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
					<div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
						<span style={{ fontSize: '22px', background: '#e0e7ff', borderRadius: '10px', padding: '8px', lineHeight: 1 }}>🔑</span>
						<div>
							<h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Price Code</h2>
							<p style={{ margin: '6px 0 0', maxWidth: '640px', fontSize: '14px', color: '#475569', lineHeight: 1.5 }}>
								Give every digit its own secret letter or symbol. Barcode labels and inventory will show the cost
								price written in these letters, so your staff can read the purchase price but customers can't.
							</p>
						</div>
					</div>
					<span style={{
						borderRadius: '999px', padding: '4px 12px', fontSize: '12px', fontWeight: 700,
						background: saved ? '#dcfce7' : '#fef3c7', color: saved ? '#15803d' : '#b45309'
					}}>{saved ? 'Active' : 'Not set up'}</span>
				</div>

				{notice && (
					<div role="status" style={{
						marginTop: '16px', borderRadius: '10px', padding: '10px 14px', fontSize: '14px',
						background: notice.type === 'ok' ? '#f0fdf4' : '#fef2f2', color: notice.type === 'ok' ? '#15803d' : '#b91c1c'
					}}>{notice.text}</div>
				)}

				<div style={{ marginTop: '24px' }}>
					<label htmlFor="price-code-quick" style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 600, color: '#334155' }}>
						Quick fill <span style={{ fontWeight: 400, color: '#94a3b8' }}>— type a 10-letter word with no repeated letters</span>
					</label>
					<input
						id="price-code-quick"
						value={quick}
						onChange={e => { setQuick(e.target.value.toUpperCase()); fillFrom(e.target.value); }}
						placeholder="e.g. COMPUTERSX"
						maxLength={20}
						autoComplete="off"
						style={{
							height: '44px', width: '100%', maxWidth: '320px', boxSizing: 'border-box', padding: '0 12px',
							border: '2px solid #e2e8f0', borderRadius: '10px', fontFamily: 'monospace', fontSize: '16px',
							letterSpacing: '0.2em', textTransform: 'uppercase', outline: 'none'
						}}
					/>
				</div>

				<div style={{ marginTop: '24px' }}>
					<p style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600, color: '#334155' }}>Digit → character</p>
					<div role="group" aria-label="Character for each digit" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))', gap: '8px', maxWidth: '640px' }}>
						{DIGITS.map((d, i) => {
							const c = slots[i];
							const dup = c && duplicates.has(c);
							return (
								<div key={d} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
									<span style={{ marginBottom: '4px', fontSize: '12px', fontWeight: 700, color: '#64748b' }}>{d}</span>
									<input
										ref={el => { boxes.current[i] = el; }}
										value={c}
										onChange={e => setSlot(i, e.target.value)}
										onKeyDown={e => onBoxKey(i, e)}
										onPaste={e => onBoxPaste(i, e)}
										onFocus={e => e.target.select()}
										aria-label={`Character for digit ${d}`}
										aria-invalid={dup || undefined}
										autoComplete="off"
										style={{
											height: '48px', width: '100%', maxWidth: '52px', boxSizing: 'border-box', textAlign: 'center',
											fontFamily: 'monospace', fontSize: '18px', fontWeight: 700, textTransform: 'uppercase',
											borderRadius: '10px', outline: 'none', borderWidth: '2px', borderStyle: 'solid',
											borderColor: dup ? '#f87171' : c ? '#a5b4fc' : '#e2e8f0',
											background: dup ? '#fef2f2' : c ? '#eef2ff' : '#fff',
											color: dup ? '#b91c1c' : c ? '#4338ca' : '#0f172a'
										}}
									/>
								</div>
							);
						})}
					</div>
					<p style={{ margin: '8px 0 0', minHeight: '20px', fontSize: '14px', color: problem ? '#dc2626' : '#64748b' }}>
						{problem || (complete ? 'All 10 digits have their own character.' : 'Letters and symbols only — numbers are not allowed.')}
					</p>
				</div>

				<div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
					<button
						type="button"
						onClick={() => save(cipher)}
						disabled={!complete || !changed || saving}
						style={{ ...btn('#4f46e5', '#fff'), opacity: !complete || !changed || saving ? 0.5 : 1, cursor: !complete || !changed || saving ? 'not-allowed' : 'pointer' }}
					>
						✓ {saving ? 'Saving…' : saved ? 'Save changes' : 'Save price code'}
					</button>
					{changed && (
						<button type="button" onClick={() => { setSlots(toSlots(saved)); setQuick(''); }} disabled={saving} style={btn('#f1f5f9', '#334155')}>
							↺ Undo changes
						</button>
					)}
					{saved && !changed && (
						<button type="button" onClick={clearCode} disabled={saving} style={btn('transparent', '#dc2626')}>
							🗑 Remove price code
						</button>
					)}
				</div>
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
				<div style={card}>
					<h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Try it</h3>
					<p style={{ margin: '4px 0 0', fontSize: '14px', color: '#64748b' }}>Cost price in rupees (paise are rounded off).</p>
					<div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px' }}>
						<div style={{ position: 'relative' }}>
							<span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}>₹</span>
							<input
								type="number"
								inputMode="numeric"
								min="0"
								value={tryAmount}
								onChange={e => setTryAmount(e.target.value)}
								aria-label="Cost price to encode"
								style={{ height: '44px', width: '160px', boxSizing: 'border-box', padding: '0 12px 0 28px', border: '2px solid #e2e8f0', borderRadius: '10px', outline: 'none' }}
							/>
						</div>
						<span style={{ color: '#94a3b8' }}>→</span>
						<span aria-live="polite" style={{ minWidth: '96px', borderRadius: '10px', background: '#eef2ff', padding: '8px 16px', fontFamily: 'monospace', fontSize: '20px', fontWeight: 700, letterSpacing: '0.15em', color: '#4338ca' }}>
							{tryCode || '—'}
						</span>
					</div>
					{previewCipher && (
						<table style={{ marginTop: '20px', width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
							<tbody>
								{EXAMPLES.map(n => (
									<tr key={n} style={{ borderTop: '1px solid #f1f5f9' }}>
										<td style={{ padding: '8px 0', color: '#475569' }}>₹{n.toLocaleString('en-IN')}</td>
										<td style={{ padding: '8px 0', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.15em', color: '#0f172a' }}>{BL.encodePriceCode(n, previewCipher)}</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>

				<div style={card}>
					<h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>ℹ️ How it works</h3>
					<ul style={{ margin: '12px 0 0', paddingLeft: '20px', fontSize: '14px', color: '#475569', lineHeight: 1.6 }}>
						<li>Nobody types a price code while adding stock — it is worked out from each product's cost price.</li>
						<li>It prints on every barcode label (A4 and thermal) and shows next to the cost in branch stock and in the owner's Product Inventory.</li>
						<li>One code for the whole shop: changing it here changes it for every branch.</li>
						<li>Labels already stuck on products keep the old code, so reprint them if needed.</li>
						<li>Keep it secret: anyone who knows the letters can read your purchase prices.</li>
					</ul>
				</div>
			</div>
		</div>
	);
}

window.PriceCodeSettings = PriceCodeSettings;

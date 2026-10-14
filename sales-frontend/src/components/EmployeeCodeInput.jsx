// Salesperson attribution at the point of sale.
// useEmployeeCode() loads the shop's active employees from SalesServer (/api/employees) so the cashier can
// search by name (or code / designation) and pick from a dropdown, and loads the shop's POS rule
// (/api/employees/pos-config) that can make the selection mandatory. The sale still sends `employeeCode`.

function useEmployeeCode(salesUrl, token) {
	const [employees, setEmployees] = React.useState([]);
	const [loading, setLoading] = React.useState(false);
	const [loadError, setLoadError] = React.useState('');
	const [employee, setEmployee] = React.useState(null);
	const [required, setRequired] = React.useState(false);

	React.useEffect(() => {
		if (!salesUrl || !token) return;
		let alive = true;
		const headers = { Authorization: 'Bearer ' + token };
		fetch(salesUrl + '/api/employees/pos-config', { headers })
			.then(r => r.json().catch(() => ({})))
			.then(d => { if (alive && d && d.success) setRequired(!!d.requireEmployeeCode); })
			.catch(() => {});
		setLoading(true); setLoadError('');
		fetch(salesUrl + '/api/employees', { headers })
			.then(r => r.json().catch(() => ({})))
			.then(d => {
				if (!alive) return;
				if (d && d.success) setEmployees(Array.isArray(d.employees) ? d.employees : []);
				else setLoadError((d && d.message) || 'Could not load employees');
			})
			.catch(() => { if (alive) setLoadError('Could not load employees'); })
			.finally(() => { if (alive) setLoading(false); });
		return () => { alive = false; };
	}, [salesUrl, token]);

	const select = React.useCallback((emp) => setEmployee(emp || null), []);
	const reset = React.useCallback(() => setEmployee(null), []);

	// Returns an error message when the sale must not be submitted yet, otherwise null
	const validateForSale = React.useCallback(() => {
		if (!employee) return required ? 'Select the sales executive for this sale' : null;
		return null;
	}, [employee, required]);

	return {
		code: employee ? employee.code : '',
		employee, employees, loading, loadError, required, select, reset, validateForSale
	};
}

function EmployeeCodeInput({ state, compact }) {
	const { employee, employees, loading, loadError, required, select } = state;
	const [query, setQuery] = React.useState('');
	const [open, setOpen] = React.useState(false);
	const [active, setActive] = React.useState(0);
	const wrapRef = React.useRef(null);

	React.useEffect(() => {
		const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
		document.addEventListener('mousedown', onDown);
		document.addEventListener('touchstart', onDown);
		return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown); };
	}, []);

	const matches = React.useMemo(() => {
		const q = query.trim().toLowerCase();
		const list = q
			? employees.filter(e =>
				(e.name || '').toLowerCase().includes(q) ||
				(e.code || '').toLowerCase().includes(q) ||
				(e.designation || '').toLowerCase().includes(q))
			: employees;
		return list.slice(0, 50);
	}, [employees, query]);

	React.useEffect(() => { setActive(0); }, [query, open]);

	const pick = (emp) => { select(emp); setQuery(''); setOpen(false); };
	const clear = () => { select(null); setQuery(''); setOpen(true); };

	const onKeyDown = (e) => {
		if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(i => Math.min(i + 1, matches.length - 1)); }
		else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
		else if (e.key === 'Enter') { if (open && matches[active]) { e.preventDefault(); pick(matches[active]); } }
		else if (e.key === 'Escape') setOpen(false);
	};

	const pad = compact ? '10px 12px' : '12px 16px';
	const fieldStyle = {
		width: '100%', padding: pad, fontSize: '15px', boxSizing: 'border-box',
		border: '2px solid ' + (employee ? '#22c55e' : '#e2e8f0'), borderRadius: '10px', outline: 'none', background: '#fff'
	};
	const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase();

	return (
		<div ref={wrapRef} style={{ marginBottom: compact ? '12px' : '16px', position: 'relative' }}>
			<label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
				Sales Executive {required ? <span style={{ color: '#ef4444' }}>*</span> : <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span>}
			</label>

			{employee ? (
				<div style={{ ...fieldStyle, display: 'flex', alignItems: 'center', gap: '10px', cursor: 'default' }}>
					<span style={{ width: 32, height: 32, borderRadius: '50%', background: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
						{initials(employee.name)}
					</span>
					<span style={{ flex: 1, minWidth: 0 }}>
						<span style={{ display: 'block', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{employee.name}</span>
						<span style={{ display: 'block', fontSize: 12, color: '#64748b' }}>
							{employee.code}{employee.designation ? ' · ' + employee.designation : ''}
						</span>
					</span>
					<button type="button" onClick={clear} aria-label="Change sales executive"
						style={{ border: 'none', background: '#f1f5f9', color: '#475569', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
						Change
					</button>
				</div>
			) : (
				<input
					value={query}
					onChange={e => { setQuery(e.target.value); setOpen(true); }}
					onFocus={() => setOpen(true)}
					onKeyDown={onKeyDown}
					placeholder={loading ? 'Loading employees…' : 'Search employee by name'}
					autoComplete="off"
					role="combobox"
					aria-expanded={open}
					style={fieldStyle}
				/>
			)}

			{!employee && open && (
				<div style={{
					position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 4, zIndex: 50,
					background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, maxHeight: 260, overflowY: 'auto',
					boxShadow: '0 10px 25px rgba(15,23,42,0.15)'
				}}>
					{loading && <div style={{ padding: '12px 14px', fontSize: 13, color: '#64748b' }}>Loading employees…</div>}
					{!loading && loadError && <div style={{ padding: '12px 14px', fontSize: 13, color: '#dc2626' }}>{loadError}</div>}
					{!loading && !loadError && matches.length === 0 && (
						<div style={{ padding: '12px 14px', fontSize: 13, color: '#64748b' }}>
							{employees.length === 0 ? 'No active employees found' : 'No employee matches "' + query + '"'}
						</div>
					)}
					{!loading && matches.map((e, i) => (
						<div
							key={e.id}
							onMouseDown={ev => { ev.preventDefault(); pick(e); }}
							onMouseEnter={() => setActive(i)}
							style={{
								display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer',
								background: i === active ? '#eef2ff' : '#fff', borderBottom: '1px solid #f1f5f9'
							}}
						>
							<span style={{ width: 32, height: 32, borderRadius: '50%', background: '#e0e7ff', color: '#4338ca', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
								{initials(e.name)}
							</span>
							<span style={{ flex: 1, minWidth: 0 }}>
								<span style={{ display: 'block', fontWeight: 600, color: '#0f172a', fontSize: 14 }}>{e.name}</span>
								<span style={{ display: 'block', fontSize: 12, color: '#64748b' }}>
									{e.designation || 'Employee'}{e.businessUnit === 'sales' ? ' · Sales' : ' · Service'}
								</span>
							</span>
							<span style={{ fontSize: 12, fontWeight: 600, color: '#4338ca', background: '#eef2ff', borderRadius: 6, padding: '3px 8px', flexShrink: 0 }}>{e.code}</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

window.useEmployeeCode = useEmployeeCode;
window.EmployeeCodeInput = EmployeeCodeInput;

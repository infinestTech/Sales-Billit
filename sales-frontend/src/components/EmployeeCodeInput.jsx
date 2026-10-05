// Salesperson attribution at the point of sale.
// useEmployeeCode() validates the typed code against SalesServer (/api/employees/lookup) and loads the
// shop's POS rule (/api/employees/pos-config) that can make the code mandatory.

function useEmployeeCode(salesUrl, token) {
	const [code, setCodeRaw] = React.useState('');
	const [employee, setEmployee] = React.useState(null);
	const [status, setStatus] = React.useState('idle'); // idle | checking | valid | invalid
	const [message, setMessage] = React.useState('');
	const [required, setRequired] = React.useState(false);
	const reqId = React.useRef(0);

	React.useEffect(() => {
		if (!salesUrl || !token) return;
		let alive = true;
		fetch(salesUrl + '/api/employees/pos-config', { headers: { Authorization: 'Bearer ' + token } })
			.then(r => r.json().catch(() => ({})))
			.then(d => { if (alive && d && d.success) setRequired(!!d.requireEmployeeCode); })
			.catch(() => {});
		return () => { alive = false; };
	}, [salesUrl, token]);

	const normalized = (code || '').trim().toUpperCase();

	React.useEffect(() => {
		if (!normalized) { setEmployee(null); setStatus('idle'); setMessage(''); return; }
		const id = ++reqId.current;
		setStatus('checking'); setMessage('');
		const t = setTimeout(async () => {
			try {
				const url = new URL(salesUrl + '/api/employees/lookup');
				url.searchParams.set('code', normalized);
				const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
				const data = await res.json().catch(() => ({}));
				if (id !== reqId.current) return;
				if (res.ok && data.success && data.employee) {
					setEmployee(data.employee); setStatus('valid'); setMessage('');
				} else {
					setEmployee(null); setStatus('invalid'); setMessage(data.message || 'Employee code not found');
				}
			} catch (e) {
				if (id !== reqId.current) return;
				setEmployee(null); setStatus('invalid'); setMessage('Could not verify employee code');
			}
		}, 350);
		return () => clearTimeout(t);
	}, [normalized, salesUrl, token]);

	const setCode = React.useCallback((v) => setCodeRaw(String(v || '').toUpperCase().replace(/\s+/g, '')), []);
	const reset = React.useCallback(() => { setCodeRaw(''); setEmployee(null); setStatus('idle'); setMessage(''); }, []);

	// Returns an error message when the sale must not be submitted yet, otherwise null
	const validateForSale = React.useCallback(() => {
		if (!normalized) return required ? 'Enter the employee code of the salesperson' : null;
		if (status === 'checking') return 'Verifying employee code, please wait';
		if (status !== 'valid') return message || 'Employee code is not valid';
		return null;
	}, [normalized, required, status, message]);

	return { code: normalized, rawCode: code, setCode, employee, status, message, required, reset, validateForSale };
}

function EmployeeCodeInput({ state, compact }) {
	const { rawCode, setCode, employee, status, message, required } = state;
	const border = status === 'valid' ? '#22c55e' : status === 'invalid' ? '#ef4444' : '#e2e8f0';
	return (
		<div style={{ marginBottom: compact ? '12px' : '16px' }}>
			<label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
				Sales Executive Code {required ? <span style={{ color: '#ef4444' }}>*</span> : <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span>}
			</label>
			<input
				value={rawCode}
				onChange={e => setCode(e.target.value)}
				placeholder="e.g. EMP001"
				autoComplete="off"
				style={{
					width: '100%', padding: compact ? '10px 12px' : '12px 16px', fontSize: '15px',
					border: '2px solid ' + border, borderRadius: '10px', outline: 'none',
					textTransform: 'uppercase', letterSpacing: '0.5px', boxSizing: 'border-box'
				}}
			/>
			<div style={{ minHeight: '18px', marginTop: '4px', fontSize: '12px' }}>
				{status === 'checking' && <span style={{ color: '#64748b' }}>Checking…</span>}
				{status === 'valid' && employee && (
					<span style={{ color: '#15803d', fontWeight: 600 }}>
						✓ {employee.name}{employee.designation ? ' · ' + employee.designation : ''}
					</span>
				)}
				{status === 'invalid' && <span style={{ color: '#dc2626' }}>{message}</span>}
			</div>
		</div>
	);
}

window.useEmployeeCode = useEmployeeCode;
window.EmployeeCodeInput = EmployeeCodeInput;

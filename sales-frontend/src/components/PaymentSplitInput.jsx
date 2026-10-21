// Payment at the point of sale: Cash, Gpay, Card or any combination of them. For a combination the cashier
// enters how much came in by each mode; the field they did not just type in fills with what is left, so the
// amounts always add up to the bill unless they deliberately change every field. The sale sends
// `paymentMethod` (the label) and `paymentSplits` ([{ method, amount }]) — SalesServer utils/paymentSplits.js.

window.SalesPayments = (function () {
	const MODES = ['Cash', 'Gpay', 'Card'];
	const METHODS = ['Cash', 'Gpay', 'Card', 'Cash + Gpay', 'Cash + Card', 'Gpay + Card', 'Cash + Gpay + Card'];
	const ICONS = { Cash: '💵', Gpay: '📱', Card: '💳' };
	const modesOf = (method) => (METHODS.includes(method) ? method.split(' + ') : []);
	return { MODES, METHODS, ICONS, modesOf };
})();

const payRound2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Mode whose amount is filled automatically: the last one never typed in, else the one typed longest ago
function payAutoModeFor(modes, order, justTyped) {
	const others = modes.filter(m => m !== justTyped);
	const untouched = others.filter(m => !order.includes(m));
	if (untouched.length) return untouched[untouched.length - 1];
	return order.find(m => others.includes(m)) || null;
}

function payWithRemainder(amounts, modes, auto, total) {
	if (!auto) return amounts;
	const others = modes.filter(m => m !== auto).reduce((s, m) => s + (Number(amounts[m]) || 0), 0);
	return { ...amounts, [auto]: String(payRound2(Math.max(0, total - others))) };
}

function usePaymentSplit(total) {
	const [method, setMethodState] = React.useState('');
	const [amounts, setAmounts] = React.useState({});
	const [order, setOrder] = React.useState([]); // modes in the order the cashier last typed them
	const modes = window.SalesPayments.modesOf(method);
	const isSplit = modes.length > 1;
	const billTotal = payRound2(total);

	const setMethod = React.useCallback((next) => {
		setMethodState(next);
		setAmounts({});
		setOrder([]);
	}, []);

	const setAmount = (mode, value) => {
		const nextOrder = order.filter(m => m !== mode).concat(mode);
		setOrder(nextOrder);
		setAmounts(payWithRemainder({ ...amounts, [mode]: value }, modes, payAutoModeFor(modes, order, mode), billTotal));
	};

	// Keep the auto-filled amount in step when the bill changes (discount, GST, cart edits)
	React.useEffect(() => {
		if (!isSplit || order.length === 0) return;
		setAmounts(a => payWithRemainder(a, modes, payAutoModeFor(modes, order, order[order.length - 1]), billTotal));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [billTotal]);

	const received = isSplit ? payRound2(modes.reduce((s, m) => s + (Number(amounts[m]) || 0), 0)) : (method ? billTotal : 0);

	const validate = () => {
		if (!method) return 'Select a payment method';
		if (!isSplit) return null;
		const missing = modes.find(m => !(Number(amounts[m]) > 0));
		if (missing) return `Enter the amount received by ${missing}`;
		if (Math.abs(received - billTotal) > 0.01) {
			return `${method} adds up to ₹${received.toFixed(2)} but the bill is ₹${billTotal.toFixed(2)}`;
		}
		return null;
	};

	const splits = () => (isSplit
		? modes.map(m => ({ method: m, amount: payRound2(amounts[m]) }))
		: [{ method, amount: billTotal }]);

	const reset = () => setMethod('');

	return { method, setMethod, modes, isSplit, amounts, setAmount, received, total: billTotal, validate, splits, reset };
}

function PaymentSplitInput({ state, compact }) {
	const { method, setMethod, modes, isSplit, amounts, setAmount, received, total } = state;
	const pad = compact ? '10px 12px' : '12px 16px';
	const remaining = payRound2(total - received);
	const balanced = Math.abs(remaining) <= 0.01;
	const fieldStyle = {
		width: '100%', padding: pad, fontSize: '15px', border: '2px solid #e2e8f0', borderRadius: '10px',
		outline: 'none', backgroundColor: '#fff', boxSizing: 'border-box'
	};

	return (
		<div>
			<label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
				Payment Method <span style={{ color: '#ef4444' }}>*</span>
			</label>
			<select value={method} onChange={e => setMethod(e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }}>
				<option value="">Select Payment Method</option>
				{window.SalesPayments.METHODS.map(m => <option key={m} value={m}>{m}</option>)}
			</select>

			{isSplit && (
				<div style={{ marginTop: '12px', padding: compact ? '10px' : '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
					<div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>Amount received by each method</div>
					{modes.map(m => (
						<div key={m} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
							<label htmlFor={'pay-split-' + m} style={{ width: '72px', fontSize: '14px', fontWeight: '600', color: '#1e293b', flexShrink: 0 }}>
								{window.SalesPayments.ICONS[m]} {m}
							</label>
							<span style={{ color: '#94a3b8', fontWeight: '600' }}>₹</span>
							<input
								id={'pay-split-' + m}
								type="number"
								inputMode="decimal"
								min="0"
								step="0.01"
								value={amounts[m] ?? ''}
								onChange={e => setAmount(m, e.target.value)}
								onFocus={e => e.target.select()}
								placeholder="0.00"
								style={{ ...fieldStyle, flex: 1, minWidth: 0, padding: compact ? '8px 10px' : '10px 12px', fontWeight: '600' }}
							/>
						</div>
					))}
					<div aria-live="polite" style={{ fontSize: '13px', fontWeight: '600', marginTop: '4px', color: received === 0 ? '#64748b' : balanced ? '#16a34a' : remaining > 0 ? '#d97706' : '#dc2626' }}>
						{received === 0
							? `Enter how much was paid by each method (bill ₹${total.toFixed(2)})`
							: balanced
							? `✓ ₹${received.toFixed(2)} received — matches the bill`
							: remaining > 0
								? `₹${remaining.toFixed(2)} still to collect (bill ₹${total.toFixed(2)})`
								: `₹${(-remaining).toFixed(2)} more than the bill (₹${total.toFixed(2)})`}
					</div>
				</div>
			)}
		</div>
	);
}

window.usePaymentSplit = usePaymentSplit;
window.PaymentSplitInput = PaymentSplitInput;

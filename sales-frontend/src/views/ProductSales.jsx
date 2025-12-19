function ProductSales({ salesUrl, token }) {
	const [products, setProducts] = React.useState([]);
	const [sellerProducts, setSellerProducts] = React.useState([]);
	const [productNo, setProductNo] = React.useState('');
	const [customerNo, setCustomerNo] = React.useState('');
	const [customerName, setCustomerName] = React.useState('');
	const [error, setError] = React.useState('');
	const [showAlert, setShowAlert] = React.useState(false);
	const [loadingLoad, setLoadingLoad] = React.useState(false);
	const [banks, setBanks] = React.useState([]);
	const [selectedBank, setSelectedBank] = React.useState('select');
	const [sellingBusy, setSellingBusy] = React.useState(false);
	const [lastSale, setLastSale] = React.useState(null);
	const [previewHtml, setPreviewHtml] = React.useState('');
	const [showPreview, setShowPreview] = React.useState(false);


	// Fetch branch stock products
	React.useEffect(() => {
		async function fetchProducts() {
			try {
				setError('');
				const url = new URL(salesUrl + '/api/branch-stock');
				url.searchParams.set('only_branch', '1');
				const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
				const data = await res.json();
				if (!res.ok) throw new Error(data.message || 'Failed to load');
				setProducts(Array.isArray(data.rows) ? data.rows : []);
			} catch (e) { setError(e.message); }
		}
		fetchProducts();
	}, [salesUrl, token]);

	// show popup when error or message is set
	React.useEffect(() => {
		if (!error) { setShowAlert(false); return; }
		setShowAlert(true);
		const t = setTimeout(() => { setShowAlert(false); }, 4000);
		return () => clearTimeout(t);
	}, [error]);

	// Fetch banks for online payment dropdown
	React.useEffect(() => {
		async function loadBanks() {
			try {
				const url = new URL(salesUrl + '/api/banks');
				const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
				const data = await res.json();
				if (res.ok && Array.isArray(data.banks)) setBanks(data.banks);
			} catch (e) { /* ignore */ }
		}
		loadBanks();
	}, [salesUrl, token]);

	// Filter products by productNo
	const filtered = products.filter(p =>
		(!productNo || (p.productNo && p.productNo.toLowerCase().includes(productNo.toLowerCase())))
	);

	function lineTotal(item) {
		const qty = Number(item.sellingQty ?? item.qty ?? 0);
		const unit = Number(item.sellingPrice ?? item.unitSellingPrice ?? 0);
		return qty * unit;
	}

	const totalCount = sellerProducts.reduce((s, it) => s + Number(it.sellingQty ?? it.qty ?? 0), 0);
	const subTotal = sellerProducts.reduce((s, it) => s + lineTotal(it), 0);

	// state to toggle IME list per product index
	const [showImes, setShowImes] = React.useState({});

	// Discount state (percentage)
	const [discount, setDiscount] = React.useState(0);
	const discountAmount = ((Number(discount) || 0) / 100) * subTotal;
	const taxableAmount = Math.max(0, subTotal - discountAmount);

	// GST state
	const [cgst, setCgst] = React.useState(0);
	const [sgst, setSgst] = React.useState(0);
	const [igst, setIgst] = React.useState(0);

	// GST calculation (apply on taxableAmount i.e. after discount)
	const cgstAmount = ((Number(cgst) || 0) / 100) * taxableAmount;
	const sgstAmount = ((Number(sgst) || 0) / 100) * taxableAmount;
	const igstAmount = ((Number(igst) || 0) / 100) * taxableAmount;

	// Total calculation logic
	let totalAmount = taxableAmount;
	if (igst > 0) {
			totalAmount += igstAmount;
	} else {
			totalAmount += cgstAmount + sgstAmount;
	}
	totalAmount = Number(totalAmount.toFixed(1));

	async function doSell() {
		try {
			if (sellerProducts.length === 0) { setError('No products to sell'); return; }
			// validate quantities before sending
			const over = sellerProducts.find(it => Number(it.sellingQty ?? it.qty ?? 0) > Number(it.qty ?? 0));
			if (over) { setError('Your qty is low'); return; }
			// validate IME selections: for products that track IMEs, selected IMEs must match selling qty
			const imeMismatch = sellerProducts.find(it => {
				const sellingQty = Number(it.sellingQty ?? it.qty ?? 0);
				const availableImes = (Array.isArray(it.centralOnlyImes) && it.centralOnlyImes.length) ? it.centralOnlyImes : (Array.isArray(it.centralImes) && it.centralImes.length) ? it.centralImes : (Array.isArray(it.imes) ? it.imes : []);
				if (!availableImes || availableImes.length === 0) return false; // not IME-tracked
				const selected = Array.isArray(it.selectedImes) ? it.selectedImes.length : 0;
				return selected !== sellingQty;
			});
			if (imeMismatch) { setError('Selected IMEs must match selling quantity for IME-tracked products'); return; }
			if (!(customerNo || '').toString().replace(/[^0-9]/g, '')) { setError('Customer mobile number is required'); return; }
			if (!selectedBank || selectedBank === 'select') { setError('Select a payment method'); return; }
			setSellingBusy(true);
			setError('');
			const url = new URL(salesUrl + '/api/sales');
			// cash option removed: payments are online via selected bank
			const paymentMethod = 'online';
			const payload = {
				items: sellerProducts.map(it => ({ productId: it.productId || it._id || '', productNo: it.productNo || '', productName: it.productName || '', qty: Number(it.sellingQty ?? it.qty ?? 0), sellingPrice: Number(it.sellingPrice || 0), lineTotal: Number(lineTotal(it),), imes: Array.isArray(it.selectedImes) && it.selectedImes.length ? it.selectedImes : (Array.isArray(it.imes) ? it.imes : []) })),
				customerNo,
				customerName: customerName || 'Walk-in Customer',
				subTotal,
				cgst: Number(cgst),
				sgst: Number(sgst),
					igst: Number(igst),
					discount: Number(discount) || 0,
					discountAmount: Number(discountAmount.toFixed(2)),
				cgstAmount: Number(cgstAmount.toFixed(2)),
				sgstAmount: Number(sgstAmount.toFixed(2)),
				igstAmount: Number(igstAmount.toFixed(2)),
				totalAmount: Number(totalAmount.toFixed(2)),
				paymentMethod,
				amountPaid: Number(totalAmount || 0),
				bank_id: (selectedBank && selectedBank !== 'select') ? selectedBank : ''
			};
			const res = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || 'Sell failed');
			// on success save returned sale for printing / whatsapp and clear the cart
			const savedSale = data.sale || data || null;
			setLastSale(savedSale);
			// update local products: remove sold IMEs and decrement qty
			try {
				if (Array.isArray(savedSale?.items) && savedSale.items.length) {
					// create a copy for updates
					setProducts(prev => {
						const next = (prev || []).map(prod => ({ ...prod }));
						for (const sold of savedSale.items) {
							const idCandidates = [sold.productId, sold._id, sold.productNo].filter(Boolean).map(String);
							const foundIdx = next.findIndex(p => idCandidates.includes(String(p.productId || p._id || p.productNo)));
							if (foundIdx === -1) continue;
							const product = next[foundIdx];
							const soldQty = Number(sold.qty ?? sold.sellingQty ?? 0);
							// remove selected IMEs from product IME arrays if present
							const soldImes = Array.isArray(sold.imes) ? sold.imes : (Array.isArray(sold.selectedImes) ? sold.selectedImes : []);
							if (soldImes && soldImes.length) {
								['centralOnlyImes','centralImes','imes'].forEach(key => {
									if (Array.isArray(product[key]) && product[key].length) {
										product[key] = product[key].filter(v => !soldImes.includes(v));
									}
								});
							}
							// decrement qty but not below 0
							product.qty = Math.max(0, Number(product.qty ?? 0) - soldQty);
							next[foundIdx] = product;
						}
						return next;
					});
				}
			} catch (e) { /* non-fatal local update failure */ }
			// clear sellerProducts (cart)
			setSellerProducts([]);
			setCustomerNo('');
			setCustomerName('');
			setSelectedBank('');
			setCgst(0);
			setSgst(0);
			setIgst(0);
			setError('Sale saved');
		} catch (e) {
			setError(e.message || 'Sell failed');
		} finally { setSellingBusy(false); }
	}

	// decode JWT payload safely (no verification) to read branch/shop info
	function decodeJwt(tk) {
		try {
			const theToken = tk || token || localStorage.getItem('branch_token') || localStorage.getItem('sales_token') || '';
			const parts = theToken.split('.');
			if (parts.length < 2) return {};
			const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
			const json = decodeURIComponent(atob(base64).split('').map(function(c) { return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join(''));
			return JSON.parse(json);
		} catch (e) { return {}; }
	}

	async function printSale() {
		try {
			const sale = lastSale || { items: sellerProducts, totalAmount, customerNo, createdAt: new Date().toISOString() };
			// fetch branch info
			let shopName = '';
			let shopContact = '';
			let shopGst = '';
			let shopAddress = '';
			try {
				const res = await fetch(new URL(salesUrl + '/api/branches'), { headers: { Authorization: 'Bearer ' + token } });
				const data = await res.json();
				if (res.ok && Array.isArray(data.branches) && data.branches.length > 0) {
					const payload = decodeJwt();
					const branchId = payload?.branch_id || payload?._id || '';
					let found = null;
					if (branchId) found = data.branches.find(b => String(b._id) === String(branchId));
					if (!found) found = data.branches[0];
					shopName = found?.name || '';
					shopContact = found?.phoneNumber || found?.phone || '';
					shopGst = found?.gstNo || found?.gst || '';
					shopAddress = found?.address || found?.branchAddress || '';
				}
			} catch (e) { /* ignore */ }
			if (!shopName || !shopContact) {
				const payload = decodeJwt();
				shopName = shopName || payload.shopName || payload.name || payload.branchName || '';
				shopContact = shopContact || payload.phone || payload.phoneNumber || payload.branchPhone || '';
				shopGst = shopGst || payload.gstNo || payload.gst || '';
				shopAddress = shopAddress || payload.address || payload.branchAddress || '';
			}
			// fetch branch stock to resolve prices
			let stock = [];
			try {
				const sres = await fetch(new URL(salesUrl + '/api/branch-stock?only_branch=1'), { headers: { Authorization: 'Bearer ' + token } });
				const sdata = await sres.json();
				if (sres.ok && Array.isArray(sdata.rows)) stock = sdata.rows;
			} catch (e) { /* ignore */ }
			
			// GST details - declare before items mapping
			const cgstPercent = sale.cgst || cgst;
			const sgstPercent = sale.sgst || sgst;
			const igstPercent = sale.igst || igst;
			const cgstAmt = sale.cgstAmount ?? cgstAmount;
			const sgstAmt = sale.sgstAmount ?? sgstAmount;
			const igstAmt = sale.igstAmount ?? igstAmount;
			
			const items = (sale.items || []).map((i, idx) => {
				const found = (stock || []).find(p => (String(p._id) && String(p._id) === String(i.productId || i._id)) || (p.productId && String(p.productId) === String(i.productId)) || (p.productNo && i.productNo && String(p.productNo) === String(i.productNo)));
				const name = found?.productName || found?.name || i.productName || i.productNo || '';
				const brand = found?.brand || '';
				const model = found?.model || '';
				
				// Extract IMEI numbers from the item - prioritize selectedImes (actually sold)
				const imes = Array.isArray(i.selectedImes) && i.selectedImes.length > 0 ? i.selectedImes : (Array.isArray(i.imes) ? i.imes : []);
				const imeiText = imes.length > 0 ? imes.map(imei => `IMEI: ${imei}`).join(', ') : '';
				
				// Build product description with brand/model
				let productDescription = `<span class="product-name">${name}</span>`;
				if (brand || model) {
					productDescription += `<br><span style="font-size:9px;color:#333;">${brand} ${model}`.trim() + `</span>`;
				}
				if (imeiText) {
					productDescription += `<br><span class="imei-info">${imeiText}</span>`;
				}
				
				const qty = Number(i.qty || i.sellingQty || 0);
				const unit = Number(found?.sellingPrice ?? found?.unitSellingPrice ?? i.sellingPrice ?? 0);
				
				// Calculate tax per unit (GST percentage from sale data)
				const taxPercent = (Number(cgstPercent) + Number(sgstPercent) + Number(igstPercent)) || 0;
				const taxPerUnit = ((taxPercent / 100) * unit).toFixed(2);
				
				const line = (qty * unit).toFixed(2);
				
				return `<tr>
					<td class="center">${idx + 1}</td>
					<td>${productDescription}</td>
					<td class="center">${qty}</td>
					<td class="right">Rs. ${unit.toFixed(2)}</td>
					<td class="right">Rs. ${taxPerUnit} (${taxPercent.toFixed(0)}%)</td>
					<td class="right">Rs. ${line}</td>
				</tr>`;
			}).join('');
			const total = Number(sale.totalAmount || 0).toFixed(2);
			const date = new Date(sale.createdAt || Date.now()).toLocaleString();

			// Build professional A4 TAX INVOICE HTML
			const outSubTotal = Number((sale.subTotal ?? subTotal) || 0);
			const outDiscount = Number((sale.discountAmount ?? discountAmount) || 0);
			const outTaxable = Number((sale.taxableAmount ?? Math.max(0, outSubTotal - outDiscount)) || 0);
			const outTotal = Number(sale.totalAmount ?? total).toFixed(2);
			
			// Format invoice number with date
			const invoiceNo = sale.invoiceNo || sale._id?.slice(-6)?.toUpperCase() || 'INV' + Date.now().toString().slice(-6);
			const invoiceDate = new Date(sale.createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

			const invoiceHtml = `<!doctype html><html><head><meta charset="utf-8"><title>TAX INVOICE</title><style>
				@page { size: A4; margin: 10mm; }
				* { margin: 0; padding: 0; box-sizing: border-box; }
				body {
					font-family: 'Arial', 'Helvetica', sans-serif;
					padding: 15px;
					color: #000;
					background: #fff;
					font-size: 11px;
					line-height: 1.4;
				}
				.invoice-container {
					border: 2px solid #000;
					padding: 0;
				}
				.header {
					text-align: center;
					border-bottom: 2px solid #000;
					padding: 8px 15px;
				}
				.header h1 {
					font-size: 20px;
					font-weight: bold;
					margin-bottom: 2px;
					letter-spacing: 2px;
				}
				.company-name {
					font-size: 24px;
					font-weight: bold;
					color: #00b894;
					margin: 8px 0;
					letter-spacing: 1px;
				}
				.company-details {
					font-size: 10px;
					margin-top: 4px;
				}
				.info-row {
					display: flex;
					border-bottom: 1px solid #000;
				}
				.info-left, .info-right {
					padding: 8px 15px;
					flex: 1;
				}
				.info-left {
					border-right: 1px solid #000;
				}
				.info-label {
					font-weight: bold;
					font-size: 10px;
				}
				.bill-to-section {
					display: flex;
					border-bottom: 1px solid #000;
				}
				.bill-to {
					padding: 10px 15px;
					flex: 1;
					border-right: 1px solid #000;
				}
				.invoice-details {
					padding: 10px 15px;
					flex: 1;
					text-align: right;
				}
				.bill-to h3, .invoice-details h3 {
					font-size: 11px;
					font-weight: bold;
					margin-bottom: 8px;
					text-transform: uppercase;
				}
				table.items-table {
					width: 100%;
					border-collapse: collapse;
				}
				table.items-table thead {
					background-color: #00b894;
					color: white;
				}
				table.items-table th {
					padding: 8px 6px;
					text-align: left;
					font-size: 10px;
					font-weight: bold;
					border-right: 1px solid #fff;
				}
				table.items-table th:last-child {
					border-right: none;
				}
				table.items-table th.center {
					text-align: center;
				}
				table.items-table th.right {
					text-align: right;
				}
				table.items-table td {
					padding: 8px 6px;
					border-bottom: 1px solid #ddd;
					font-size: 10px;
					vertical-align: top;
				}
				table.items-table td.center {
					text-align: center;
				}
				table.items-table td.right {
					text-align: right;
					font-family: 'Courier New', monospace;
				}
				table.items-table tbody tr:nth-child(even) {
					background-color: #f9f9f9;
				}
				.product-name {
					font-weight: 600;
					color: #000;
				}
				.imei-info {
					font-size: 8px;
					color: #666;
					margin-top: 2px;
					font-style: italic;
				}
				.totals-section {
					display: flex;
					border-top: 2px solid #000;
				}
				.totals-left {
					flex: 1;
					padding: 12px 15px;
					border-right: 1px solid #000;
				}
				.totals-right {
					width: 40%;
					padding: 0;
				}
				.total-row {
					display: flex;
					padding: 6px 15px;
					border-bottom: 1px solid #ddd;
					font-size: 10px;
				}
				.total-row.discount {
					background-color: #fff3cd;
				}
				.total-row.grand-total {
					background-color: #00b894;
					color: white;
					font-weight: bold;
					font-size: 12px;
					border-bottom: none;
				}
				.total-label {
					flex: 1;
				}
				.total-value {
					text-align: right;
					font-family: 'Courier New', monospace;
					min-width: 100px;
				}
				.footer {
					padding: 12px 15px;
					border-top: 2px solid #000;
				}
				.notes-terms {
					display: flex;
				}
				.notes, .terms {
					flex: 1;
					padding-right: 15px;
				}
				.notes h4, .terms h4 {
					font-size: 10px;
					font-weight: bold;
					margin-bottom: 6px;
					text-transform: uppercase;
				}
				.notes ul, .terms ul {
					list-style-position: inside;
					font-size: 9px;
					line-height: 1.6;
				}
				.signature-box {
					text-align: right;
					margin-top: 30px;
					padding-right: 15px;
				}
				.signature-line {
					border-top: 1px solid #000;
					display: inline-block;
					min-width: 200px;
					margin-top: 40px;
					padding-top: 5px;
					font-size: 10px;
					font-weight: bold;
				}
				@media print {
					body { padding: 0; }
					.invoice-container { border: 2px solid #000; }
				}
			</style></head><body>
			<div class="invoice-container">
				<div class="header">
					<h1>TAX INVOICE</h1>
					<div class="company-name">${shopName || 'Your Shop Name'}</div>
					<div class="company-details">
						${shopAddress || 'Shop Address'}<br>
						<strong>Phone:</strong> ${shopContact || 'Contact Number'} | 
						<strong>GSTIN:</strong> ${shopGst || 'N/A'}
					</div>
				</div>
				
				<div class="bill-to-section">
					<div class="bill-to">
						<h3>Bill To</h3>
						<strong>${sale.customerName || customerName || 'Walk-in Customer'}</strong><br>
						Phone: ${sale.customerNo || customerNo || 'N/A'}
					</div>
					<div class="invoice-details">
						<h3>Invoice Details</h3>
						<strong>Invoice No:</strong> ${invoiceNo}<br>
						<strong>Invoice Date:</strong> ${invoiceDate}
					</div>
				</div>
				
				<table class="items-table">
					<thead>
						<tr>
							<th style="width:5%;" class="center">Sr. No.</th>
							<th style="width:45%;">Items</th>
							<th style="width:12%;" class="center">Quantity</th>
							<th style="width:13%;" class="right">Price / Unit</th>
							<th style="width:12%;" class="right">Tax / Unit</th>
							<th style="width:13%;" class="right">Amount</th>
						</tr>
					</thead>
					<tbody>${items}</tbody>
				</table>
				
				<div class="totals-section">
					<div class="totals-left">
						<div class="notes-terms">
							<div class="notes">
								<h4>Notes</h4>
								<ul>
									<li>No return deal</li>
									<li>Warranty as per manufacturer terms</li>
								</ul>
							</div>
							<div class="terms">
								<h4>Terms & Conditions</h4>
								<ul>
									<li>Customer will pay the GST</li>
									<li>Payment due within 15 days</li>
								</ul>
							</div>
						</div>
						<div class="signature-box">
							<div>Authorised Signatory For</div>
							<div style="font-weight:bold;margin-top:5px;">${shopName || 'Shop Name'}</div>
							<div class="signature-line">Signature</div>
						</div>
					</div>
					<div class="totals-right">
						<div class="total-row">
							<div class="total-label">Total</div>
							<div class="total-value">Rs. ${outSubTotal.toFixed(2)}</div>
						</div>
						${sale.discount > 0 ? `<div class="total-row discount">
							<div class="total-label">Discount (${sale.discount}%)</div>
							<div class="total-value">Rs. ${outDiscount.toFixed(2)}</div>
						</div>` : ''}
						${cgstPercent > 0 ? `<div class="total-row">
							<div class="total-label">CGST (${cgstPercent}%)</div>
							<div class="total-value">Rs. ${Number(cgstAmt).toFixed(2)}</div>
						</div>` : ''}
						${sgstPercent > 0 ? `<div class="total-row">
							<div class="total-label">SGST (${sgstPercent}%)</div>
							<div class="total-value">Rs. ${Number(sgstAmt).toFixed(2)}</div>
						</div>` : ''}
						${igstPercent > 0 ? `<div class="total-row">
							<div class="total-label">IGST (${igstPercent}%)</div>
							<div class="total-value">Rs. ${Number(igstAmt).toFixed(2)}</div>
						</div>` : ''}
						<div class="total-row grand-total">
							<div class="total-label">GRAND TOTAL</div>
							<div class="total-value">Rs. ${outTotal}</div>
						</div>
					</div>
				</div>
			</div>
			</body></html>`;

			const w = window.open('', '_blank');
			if (!w) {
				setPreviewHtml(invoiceHtml);
				setShowPreview(true);
				setError('Popup blocked: showing preview. Allow popups to print directly.');
				return;
			}
			w.document.open(); w.document.write(invoiceHtml); w.document.close(); w.focus();
			setTimeout(() => { try { w.print(); } catch (e) { /* ignore */ } }, 300);
		} catch (e) { setError('Failed to open printer: ' + (e.message || e)); }
	}

	// Small receipt format print function
	async function printSmallReceipt() {
		try {
			const sale = lastSale || { items: sellerProducts, totalAmount, customerNo, customerName, createdAt: new Date().toISOString() };
			// fetch branch info
			let shopName = '';
			let shopContact = '';
			let shopGst = '';
			let shopAddress = '';
			try {
				const res = await fetch(new URL(salesUrl + '/api/branches'), { headers: { Authorization: 'Bearer ' + token } });
				const data = await res.json();
				if (res.ok && Array.isArray(data.branches) && data.branches.length > 0) {
					const payload = decodeJwt();
					const branchId = payload?.branch_id || payload?._id || '';
					let found = null;
					if (branchId) found = data.branches.find(b => String(b._id) === String(branchId));
					if (!found) found = data.branches[0];
					shopName = found?.name || '';
					shopContact = found?.phoneNumber || found?.phone || '';
					shopGst = found?.gstNo || found?.gst || '';
					shopAddress = found?.address || found?.branchAddress || '';
				}
			} catch (e) { /* ignore */ }
			if (!shopName || !shopContact) {
				const payload = decodeJwt();
				shopName = shopName || payload.shopName || payload.name || payload.branchName || '';
				shopContact = shopContact || payload.phone || payload.phoneNumber || payload.branchPhone || '';
				shopGst = shopGst || payload.gstNo || payload.gst || '';
				shopAddress = shopAddress || payload.address || payload.branchAddress || '';
			}
			// fetch branch stock to resolve prices
			let stock = [];
			try {
				const sres = await fetch(new URL(salesUrl + '/api/branch-stock?only_branch=1'), { headers: { Authorization: 'Bearer ' + token } });
				const sdata = await sres.json();
				if (sres.ok && Array.isArray(sdata.rows)) stock = sdata.rows;
			} catch (e) { /* ignore */ }
			
			// GST details
			const cgstPercent = sale.cgst || cgst;
			const sgstPercent = sale.sgst || sgst;
			const igstPercent = sale.igst || igst;
			const cgstAmt = sale.cgstAmount ?? cgstAmount;
			const sgstAmt = sale.sgstAmount ?? sgstAmount;
			const igstAmt = sale.igstAmount ?? igstAmount;
			
			const items = (sale.items || []).map((i, idx) => {
				const found = (stock || []).find(p => (String(p._id) && String(p._id) === String(i.productId || i._id)) || (p.productId && String(p.productId) === String(i.productId)) || (p.productNo && i.productNo && String(p.productNo) === String(i.productNo)));
				const name = found?.productName || found?.name || i.productName || i.productNo || '';
				
				// Extract IMEI numbers from the item - prioritize selectedImes (actually sold)
				const imes = Array.isArray(i.selectedImes) && i.selectedImes.length > 0 ? i.selectedImes : (Array.isArray(i.imes) ? i.imes : []);
				const imeiText = imes.length > 0 ? imes.map(imei => `IMEI: ${imei}`).join(', ') : '';
				
				// Combine product name with IMEI information
				const productDescription = imeiText ? `${name}<br><span style="font-size:9px;color:#6c757d;font-style:italic;">${imeiText}</span>` : name;
				
				const qty = Number(i.qty || i.sellingQty || 0);
				const unit = Number(found?.sellingPrice ?? found?.unitSellingPrice ?? i.sellingPrice ?? 0).toFixed(2);
				const line = (qty * Number(unit)).toFixed(2);
				const hasImei = imes.length > 0;
				
				return `<tr>
					<td style="padding:8px;text-align:center;vertical-align:top;font-weight:600;background:#f8f9fa">${idx + 1}</td>
					<td style="padding:8px;vertical-align:top;line-height:1.4;${hasImei ? 'font-size:10px;' : ''}">${productDescription}</td>
					<td style="padding:8px;text-align:center;vertical-align:top;color:#6c757d">&nbsp;</td>
					<td style="padding:8px;text-align:right;vertical-align:top;font-weight:500">${qty}</td>
					<td style="padding:8px;text-align:right;vertical-align:top;font-family:monospace">₹${unit}</td>
					<td style="padding:8px;text-align:right;vertical-align:top;font-weight:600;font-family:monospace">₹${line}</td>
				</tr>`;
			}).join('');
			const total = Number(sale.totalAmount || 0).toFixed(2);
			const date = new Date(sale.createdAt || Date.now()).toLocaleString();

			// Build the small receipt HTML
			const outSubTotal = Number((sale.subTotal ?? subTotal) || 0);
			const outDiscount = Number((sale.discountAmount ?? discountAmount) || 0);
			const outTaxable = Number((sale.taxableAmount ?? Math.max(0, outSubTotal - outDiscount)) || 0);
			const outTotal = Number(sale.totalAmount ?? total).toFixed(2);

			const receiptHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt</title><style>
				@page { size: 80mm auto; margin: 6mm; }
				body {
					font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
					padding: 12px;
					color: #212529;
					width: 80mm;
					box-sizing: border-box;
					line-height: 1.4;
					background: #fff;
				}
				.top-box {
					border: 2px solid #2c3e50;
					padding: 10px;
					margin-bottom: 12px;
					background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
					border-radius: 4px;
				}
				.top-left { float: left; font-size: 11px; font-weight: 600; color: #495057; }
				.top-right { float: right; font-size: 11px; font-weight: 600; color: #495057; }
				.center-title {
					clear: both;
					text-align: center;
					font-weight: 800;
					margin: 10px 0;
					font-size: 14px;
					color: #2c3e50;
					letter-spacing: 1px;
					text-transform: uppercase;
				}
				.branch-name {
					font-size: 18px;
					font-weight: 900;
					text-align: center;
					padding: 8px 0;
					border-bottom: 2px solid #2c3e50;
					color: #2c3e50;
					letter-spacing: 0.5px;
				}
				.address {
					font-size: 11px;
					text-align: center;
					margin-top: 6px;
					color: #6c757d;
					font-style: italic;
				}
				.cust-line {
					margin-top: 10px;
					font-size: 12px;
					color: #495057;
				}
				.cust-dotted {
					border-bottom: 2px dotted #6c757d;
					padding-bottom: 8px;
					margin-bottom: 10px;
					font-weight: 600;
				}
				table.items {
					width: 100%;
					border-collapse: collapse;
					margin-top: 12px;
					font-size: 11px;
					box-shadow: 0 2px 4px rgba(0,0,0,0.1);
					border-radius: 4px;
					overflow: hidden;
				}
				table.items th {
					background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
					color: white;
					padding: 10px 8px;
					font-weight: 700;
					text-align: center;
					font-size: 10px;
					text-transform: uppercase;
					letter-spacing: 0.5px;
					border: none;
				}
				table.items td {
					border: 1px solid #dee2e6;
					padding: 8px;
					background: #fff;
				}
				table.items tbody tr:nth-child(even) {
					background: #f8f9fa;
				}
				table.items tbody tr:hover {
					background: #e3f2fd;
				}
				table.totals {
					width: 50%;
					float: right;
					border-collapse: collapse;
					margin-top: 12px;
					font-size: 11px;
					background: #f8f9fa;
					border-radius: 4px;
					overflow: hidden;
				}
				table.totals td {
					padding: 8px 12px;
					border: none;
					border-bottom: 1px solid #dee2e6;
				}
				table.totals tr:last-child td {
					border-bottom: none;
					background: #2c3e50;
					color: white;
					font-weight: 800;
				}
				.right { text-align: right; }
				.imei-text {
					font-size: 9px;
					color: #6c757d;
					font-style: italic;
					margin-top: 2px;
				}
			</style></head><body>` +
				`<div class="top-box">
					<div class="top-left">📋 GSTIN: ${shopGst || 'N/A'}</div>
					<div class="top-right">📞 ${shopContact || 'Contact N/A'}</div>
					<div style="clear:both"></div>
				</div>` +
				`<div class="center-title">💰 PRODUCT SALES RECEIPT 💰</div>` +
				`<div class="branch-name">${shopName || 'Branch Name'}</div>` +
				`<div class="address">📍 ${shopAddress || 'Branch Address'}</div>` +
				`<div class="cust-line cust-dotted">
					<strong>👤 Customer:</strong> ${sale.customerName || customerName || 'Walk-in Customer'}
				</div>` +
				`<div class="cust-line">
					<strong>📱 Phone:</strong> ${sale.customerNo || customerNo || 'N/A'} &nbsp;&nbsp;&nbsp;
					<strong>📅 Date:</strong> ${date}
				</div>` +
				`<table class="items">
					<thead>
						<tr>
							<th style="width:8%">#</th>
							<th style="width:52%">📦 Product Details</th>
							<th style="width:10%">HSN</th>
							<th style="width:10%">Qty</th>
							<th style="width:10%">Rate</th>
							<th style="width:10%">Amount</th>
						</tr>
					</thead>
					<tbody>${items}</tbody>
				</table>` +
				`<table class="totals">` +
					`<tr><td>📊 Sub Total:</td><td class="right">₹ ${outSubTotal.toFixed(2)}</td></tr>` +
					(sale.discount ? `<tr><td>🏷️ Discount (${sale.discount}%):</td><td class="right">- ₹ ${outDiscount.toFixed(2)}</td></tr>` : '') +
					`<tr><td>💵 Taxable Amount:</td><td class="right">₹ ${outTaxable.toFixed(2)}</td></tr>` +
					(cgstPercent > 0 ? `<tr><td>🏛️ CGST ${cgstPercent}%:</td><td class="right">₹ ${Number(cgstAmt).toFixed(2)}</td></tr>` : '') +
					(sgstPercent > 0 ? `<tr><td>🏛️ SGST ${sgstPercent}%:</td><td class="right">₹ ${Number(sgstAmt).toFixed(2)}</td></tr>` : '') +
					(igstPercent > 0 ? `<tr><td>🏛️ IGST ${igstPercent}%:</td><td class="right">₹ ${Number(igstAmt).toFixed(2)}</td></tr>` : '') +
					`<tr><td>💰 GRAND TOTAL:</td><td class="right">₹ ${outTotal}</td></tr>` +
				`</table>` +
				`<div style="clear:both;margin-top:20px;text-align:center;font-size:11px;color:#6c757d;border-top:1px solid #dee2e6;padding-top:10px;">
					🙏 Thank you for your business! 🙏<br>
					<span style="font-size:10px;font-style:italic;">Visit again soon!</span>
				</div></body></html>`;

			const w = window.open('', '_blank');
			if (!w) {
				setPreviewHtml(receiptHtml);
				setShowPreview(true);
				setError('Popup blocked: showing preview. Allow popups to print directly.');
				return;
			}
			w.document.open(); w.document.write(receiptHtml); w.document.close(); w.focus();
			setTimeout(() => { try { w.print(); } catch (e) { /* ignore */ } }, 300);
		} catch (e) { setError('Failed to open small receipt printer: ' + (e.message || e)); }
	}

	// preview modal markup will be rendered below; Print fallback opens this modal

	return (
		<div>
			{showPreview ? (
				<div style={{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}} onClick={() => setShowPreview(false)}>
					<div style={{width:'90%',height:'90%',background:'#fff',borderRadius:6,overflow:'hidden',position:'relative'}} onClick={e => e.stopPropagation()}>
						<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:8,borderBottom:'1px solid #eee'}}>
							<div style={{fontWeight:600}}>Receipt Preview</div>
							<div>
								<button className="btn" onClick={() => { const w = window.open('', '_blank'); w.document.open(); w.document.write(previewHtml); w.document.close(); w.print(); }}>Print</button>
								<button className="btn secondary" style={{marginLeft:8}} onClick={() => setShowPreview(false)}>Close</button>
							</div>
						</div>
						<iframe title="receipt-preview" style={{width:'100%',height:'calc(100% - 48px)',border:0}} srcDoc={previewHtml}></iframe>
					</div>
				</div>
			) : null}
			{showAlert ? (
				<div style={{position:'fixed', right:16, bottom:16, zIndex:9999}}>
					<div style={{background:'#ffe6e6', color:'#900', padding:12, borderRadius:6, boxShadow:'0 2px 8px rgba(0,0,0,0.15)', minWidth:280}}>
						<div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:12}}>
							<div style={{fontWeight:600}}>Message</div>
							<button className="btn secondary" onClick={() => setShowAlert(false)}>Close</button>
						</div>
						<div style={{marginTop:8}}>{error}</div>
					</div>
				</div>
			) : null}
			<div className="row" style={{ gap: 16, marginBottom: 16 }}>
				<div>
					<label>Product No</label><br />
					<div style={{display:'flex', gap:8}}>
						<input value={productNo} onChange={e => setProductNo(e.target.value)} placeholder="Enter product no to filter" />
						<button className="btn" type="button" onClick={() => {
							const needle = (productNo || '').toString().trim().toLowerCase();
							if (!needle) return;
							const found = products.find(p => String(p.productNo || '').toLowerCase() === needle);
							if (!found) { setError('Product not found'); return; }
							if (Number(found.qty) === 0) {
								setError('This product has zero quantity and cannot be added to sales.');
								return;
							}
							setError('');
							setSellerProducts(sp => {
								if (sp.some(x => (x.productId || x._id) === (found.productId || found._id))) return sp;
								return [...sp, found];
							});
							setProductNo('');
						}}>Add</button>
					</div>
				</div>
				<div>
					<label>Customer Name</label><br />
					<input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Enter customer name" />
				</div>
				<div>
					<label>Mobile Number <span style={{color:'red'}}>*</span></label><br />
					<input value={customerNo} onChange={e => setCustomerNo(e.target.value)} placeholder="Enter mobile number" />
				</div>
				<div>
					<label>Payment <span style={{color:'red'}}>*</span></label><br />
					<select value={selectedBank} onChange={e => setSelectedBank(e.target.value)}>
						<option value="select">Select</option>
						{banks.map(b => <option key={b._id} value={b._id}>{b.bankName}</option>)}
					</select>
				</div>
			</div>

			{/* Payment section */}
			
			
			
			
			<div className="card mt-3 table-card">
				<div className="table-title">Branch Product Sell</div>
				{sellerProducts.length === 0 ? (
					<div className="empty-state" style={{padding:24}}>
						<div className="empty-icon">🧾</div>
						<div className="empty-title">No Products Added</div>
						<div className="empty-sub">Enter a product no and click Add to populate your list.</div>
					</div>
				) : (
					<div className="table-scroll">
						<table className="modern-table">
							<thead>
								<tr>
									 <th>Product No</th>
									
									<th>Product Name</th>
									<th>Brand</th>
									<th>Model</th>
									<th>Qty</th>
                                    	
									<th>Selling Price</th>
									<th>Selling Qty</th>
								
									<th>Line Total</th>
									<th>Validity</th>
									 <th style={{textAlign:'center'}}>IMEs</th>
		                                    <th>Action</th>
								</tr>
							</thead>
							<tbody>
								{sellerProducts.filter(p => Number(p.qty) > 0).map((p, i) => (
									<tr key={p._id || p.productId || i}>
								
										<td>{p.productNo || '-'}</td>
										<td>{p.productName || '-'}</td>
										<td>{p.brand || '-'}</td>
										<td>{p.model || '-'}</td>
										<td>{p.qty ?? '-'}</td>
                                        	
										<td>{p.sellingPrice ?? '-'}</td>
										<td>
											<input style={{width:64}} value={p.sellingQty ?? p.qty ?? 1} onChange={e => {
												const inputVal = Number(e.target.value) || 0;
												const available = Number(p.qty ?? 0);
												let v = inputVal;
												if (inputVal > available) {
													// Prevent setting selling quantity more than available
													setError('Your qty is low');
													v = available;
												}
												setSellerProducts(sp => sp.map((s, idx) => idx === i ? { ...s, sellingQty: v } : s));
											}} />
										</td>
									
										<td>{lineTotal(p).toFixed(2)}</td>
										<td>{p.validity ? new Date(p.validity).toLocaleDateString() : '-'}</td>
										<td style={{textAlign:'center', position: 'relative'}}>
											<div style={{display:'inline-block', textAlign:'left'}}>
												<button className="btn tiny" style={{padding:'6px 10px', borderRadius:6, border:'1px solid #ddd'}} onClick={() => setShowImes(s => ({ ...s, [i]: !s[i] }))}>
													{(Array.isArray(p.centralOnlyImes) ? p.centralOnlyImes.length : (Array.isArray(p.centralImes) ? p.centralImes.length : (Array.isArray(p.imes) ? p.imes.length : 0))) || 0} IMEs available <span style={{marginLeft:8}}>▾</span>
												</button>
											</div>
											{showImes[i] ? (
												<div style={{position:'absolute', zIndex:999, top:36, left:0, background:'#fff', border:'1px solid #ddd', padding:8, minWidth:260, maxHeight:260, overflowY:'auto', boxShadow:'0 6px 18px rgba(0,0,0,0.08)'}}>
													<div style={{fontSize:13, marginBottom:6, color:'#333', fontWeight:600}}>Select IMEs</div>
													{(((Array.isArray(p.centralOnlyImes) && p.centralOnlyImes.length) ? p.centralOnlyImes : (Array.isArray(p.centralImes) && p.centralImes.length) ? p.centralImes : (Array.isArray(p.imes) ? p.imes : [])) || []).map((val, idx2) => {
														const checked = Array.isArray(p.selectedImes) && p.selectedImes.includes(val);
														const isCentral = Array.isArray(p.centralOnlyImes) && p.centralOnlyImes.includes(val);
														return (
															<div key={idx2} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 6px', borderBottom:'1px solid #f3f3f3'}}>
															<div style={{display:'flex', alignItems:'center', gap:8}}>
																<div style={{width:8}}></div>
																<div style={{fontSize:13}}>{val}</div>
																{isCentral ? <div style={{fontSize:11, color:'#666', marginLeft:8}}>(central)</div> : null}
															</div>
															<div>
																<input type="checkbox" checked={checked} onChange={() => {
																	setSellerProducts(sp => sp.map((s, idxS) => idxS === i ? { ...s, selectedImes: checked ? (s.selectedImes || []).filter(x => x !== val) : ((s.selectedImes || []).concat([val])) } : s));
																}} />
															</div>
															</div>
														);
													})}
													<div style={{paddingTop:8, borderTop:'1px solid #eee', marginTop:8, fontSize:13, color:'#333'}}>
														{Array.isArray(p.selectedImes) && p.selectedImes.length ? `${p.selectedImes.length} selected` : '0 selected'}
													</div>
												</div>
											) : null}
										</td>
										<td><button className="btn secondary" onClick={() => setSellerProducts(sp => sp.filter(x => (x.productId || x._id) !== (p.productId || p._id)))}>Remove</button></td>
									</tr>
								))}
										<tr>
											<td colSpan={4} style={{textAlign:'right', fontWeight:600}}>Sub Total:</td>
											<td style={{fontWeight:600}}>{totalCount}</td>
											<td></td>
											<td style={{fontWeight:600}}>{subTotal.toFixed(2)}</td>
											</tr>
											<tr>
											<td colSpan={4} style={{textAlign:'right'}}>Discount (%)</td>
											<td colSpan={2}></td>
											<td><input style={{width:64}} type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)} /></td>
											<td>₹ {discountAmount.toFixed(2)}</td>
											<td colSpan={1}></td>
											</tr>
											{/* GST Inputs */}
										<tr>
											<td colSpan={4} style={{textAlign:'right'}}>CGST (%)</td>
											<td colSpan={2}></td>
											<td><input style={{width:64}} type="number" min="0" value={cgst} onChange={e => setCgst(e.target.value)} /></td>
											<td>₹ {cgstAmount.toFixed(1)}</td>
											<td colSpan={1}></td>
										</tr>
										<tr>
											<td colSpan={4} style={{textAlign:'right'}}>SGST (%)</td>
											<td colSpan={2}></td>
											<td><input style={{width:64}} type="number" min="0" value={sgst} onChange={e => setSgst(e.target.value)} /></td>
											<td>₹ {sgstAmount.toFixed(1)}</td>
											<td colSpan={1}></td>
										</tr>
										<tr>
											<td colSpan={4} style={{textAlign:'right'}}>IGST (%)</td>
											<td colSpan={2}></td>
											<td><input style={{width:64}} type="number" min="0" value={igst} onChange={e => setIgst(e.target.value)} /></td>
											<td>₹ {igstAmount.toFixed(1)}</td>
											<td colSpan={1}></td>
										</tr>
										{/* Total Amount */}
										<tr>
											<td colSpan={4} style={{textAlign:'right', fontWeight:600}}>Total Amount:</td>
											<td></td>
											<td></td>
											<td style={{fontWeight:600}}>{totalAmount.toFixed(1)}</td>
											<td colSpan={2}></td>
										</tr>
										</tbody>
									</table>
					</div>
				)}
			</div>
							<div style={{marginTop:12}}>
								<button className="btn" onClick={doSell} disabled={sellingBusy}>{sellingBusy ? 'Processing...' : 'Sell'}</button>
								<button className="btn secondary" style={{marginLeft:8}} onClick={printSale}>Print A4 Invoice</button>
								<button className="btn secondary" style={{marginLeft:8}} onClick={printSmallReceipt}>Print Receipt</button>
								<button className="btn secondary" style={{marginLeft:8}} onClick={() => {
									(async () => {
										const sale = lastSale || { items: sellerProducts, customerNo };
										// normalize customer number
										let digits = (sale.customerNo || '').toString().replace(/[^0-9]/g, '');
										if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
										if (digits.length === 10) digits = '91' + digits;
										const cust = digits;
										// attempt to fetch authoritative branch info
										let shopName = '';
										let shopContact = '';
										try {
											const url = new URL(salesUrl + '/api/branches');
											const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
											const data = await res.json();
											if (res.ok && Array.isArray(data.branches) && data.branches.length > 0) {
												const payload = decodeJwt();
												const branchId = payload?.branch_id || payload?._id || '';
												let foundBranch = null;
												if (branchId) foundBranch = data.branches.find(b => String(b._id) === String(branchId));
												if (!foundBranch) foundBranch = data.branches[0];
												shopName = foundBranch?.name || '';
												shopContact = foundBranch?.phoneNumber || foundBranch?.phone || '';
											}
										} catch (e) { /* ignore */ }
										if (!shopName || !shopContact) {
											const payload = decodeJwt();
											shopName = shopName || payload.shopName || payload.name || payload.branchName || '';
											shopContact = shopContact || payload.phone || payload.phoneNumber || payload.branchPhone || '';
										}
										const itemsText = (sale.items || []).map(i => {
											const qty = i.qty || i.sellingQty || 0;
											const unit = Number(i.sellingPrice || i.unitSellingPrice || 0).toFixed(2);
											return `${i.productName || i.productNo || 'item'} x${qty} @ ${unit}`;
										}).join('\n\n');
										const message = `Shop: ${shopName}\nContact: ${shopContact}\n\nItems:\n${itemsText}\n\nTotal: ${Number(sale.totalAmount || totalAmount || 0).toFixed(2)}`;
										console.log('WhatsApp send to (from sale):', cust);
										const whatsappUrl = window.ENV_CONFIG?.WHATSAPP_WEB_URL || 'https://web.whatsapp.com';
										window.open(`${whatsappUrl}/send?phone=${cust}&text=${encodeURIComponent(message)}`, '_blank');
									})();
								}}>WhatsApp</button>
							</div>
		</div>
	);
}

window.ProductSales = ProductSales;

function ProductSales({ salesUrl, token }) {
	const [products, setProducts] = React.useState([]);
	const [sellerProducts, setSellerProducts] = React.useState([]);
	const [productNo, setProductNo] = React.useState('');
	const [customerNo, setCustomerNo] = React.useState('');
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

	// GST state
	const [cgst, setCgst] = React.useState(0);
	const [sgst, setSgst] = React.useState(0);
	const [igst, setIgst] = React.useState(0);

	// GST calculation
	// GST calculation (calculator logic: percentage / 100 * subTotal)
	const cgstAmount = ((Number(cgst) || 0) / 100) * subTotal;
	const sgstAmount = ((Number(sgst) || 0) / 100) * subTotal;
	const igstAmount = ((Number(igst) || 0) / 100) * subTotal;

	// Total calculation logic
	let totalAmount = subTotal;
	if (igst > 0) {
		totalAmount += igstAmount;
	} else {
		totalAmount += cgstAmount + sgstAmount;
	}
	totalAmount = Number(totalAmount.toFixed(1));

	async function doSell() {
		try {
			if (sellerProducts.length === 0) { setError('No products to sell'); return; }
			if (!(customerNo || '').toString().replace(/[^0-9]/g, '')) { setError('Customer mobile number is required'); return; }
			if (!selectedBank || selectedBank === 'select') { setError('Select a payment method'); return; }
			setSellingBusy(true);
			setError('');
			const url = new URL(salesUrl + '/api/sales');
			// cash option removed: payments are online via selected bank
			const paymentMethod = 'online';
			const payload = {
				items: sellerProducts.map(it => ({ productId: it.productId || it._id || '', productNo: it.productNo || '', productName: it.productName || '', qty: Number(it.sellingQty ?? it.qty ?? 0), sellingPrice: Number(it.sellingPrice || 0), lineTotal: Number(lineTotal(it)) })),
				customerNo,
				subTotal,
				cgst: Number(cgst),
				sgst: Number(sgst),
				igst: Number(igst),
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
			setLastSale(data.sale || data || null);
			setSellerProducts([]);
			setCustomerNo('');
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
			const items = (sale.items || []).map(i => {
				const found = (stock || []).find(p => (String(p._id) && String(p._id) === String(i.productId || i._id)) || (p.productId && String(p.productId) === String(i.productId)) || (p.productNo && i.productNo && String(p.productNo) === String(i.productNo)));
				const name = found?.productName || found?.name || i.productName || i.productNo || '';
				const qty = Number(i.qty || i.sellingQty || 0);
				const unit = Number(found?.sellingPrice ?? found?.unitSellingPrice ?? i.sellingPrice ?? 0).toFixed(2);
				const line = (qty * Number(unit)).toFixed(2);
				return `<tr><td style="padding:6px">${name}</td><td style="text-align:right;padding:6px">${qty}</td><td style="text-align:right;padding:6px">${unit}</td><td style="text-align:right;padding:6px">${line}</td></tr>`;
			}).join('');
			const total = Number(sale.totalAmount || 0).toFixed(2);
			const date = new Date(sale.createdAt || Date.now()).toLocaleString();
			// GST details
			const cgstPercent = sale.cgst || cgst;
			const sgstPercent = sale.sgst || sgst;
			const igstPercent = sale.igst || igst;
			const cgstAmt = sale.cgstAmount || cgstAmount;
			const sgstAmt = sale.sgstAmount || sgstAmount;
			const igstAmt = sale.igstAmount || igstAmount;
			const subTotalValue = (typeof sale.subTotal === 'number' ? sale.subTotal : subTotal);
			let gstLines = '';
			if (cgstPercent > 0) gstLines += `<div>CGST ${cgstPercent}%: <span style="float:right;">${cgstAmt.toFixed(2)}</span></div>`;
			if (sgstPercent > 0) gstLines += `<div>SGST ${sgstPercent}%: <span style="float:right;">${sgstAmt.toFixed(2)}</span></div>`;
			if (igstPercent > 0) gstLines += `<div>IGST ${igstPercent}%: <span style="float:right;">${igstAmt.toFixed(2)}</span></div>`;
			if (gstLines) gstLines += `<div style="margin:6px 0;"></div>`;
			const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt</title><style> @page { size: 72mm auto; margin: 2mm; } body{font-family:monospace,Arial,Helvetica,sans-serif;padding:6px;color:#111; width:72mm; box-sizing:border-box;} h2{margin:0 0 6px;font-size:14px} .shop{ text-align:center; margin-bottom:6px; } .shop strong{ display:block; font-size:12px } .shop .contact{ font-size:11px; margin-top:2px } .gst{ font-size:11px; margin-top:2px } .address{ font-size:11px; margin-top:2px } .date{ font-size:11px; margin-bottom:6px } table{width:100%;border-collapse:collapse;margin-top:6px;font-size:11px} th,td{padding:4px 2px} thead th{border-bottom:1px dashed #bbb; text-align:left; font-size:11px} tbody td{border-bottom:1px dashed #eee} .right{ text-align:right } footer{margin-top:8px;text-align:right;font-weight:700;font-size:12px} .center{ text-align:center }</style></head><body>` +
				`<div class="center"><h2 style="margin:0">CASH RECEIPT</h2></div><div class="shop"><strong>${shopName || 'Shop'}</strong><div class="contact">${shopContact || ''}</div><div class="gst">GST No: ${shopGst || '-'}</div><div class="address">${shopAddress || '-'}</div></div>` +
				`<div class="date"><strong>Date:</strong> ${date}</div>` +
				`<table><thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Unit</th><th class="right">Line</th></tr></thead><tbody>${items}</tbody></table>` +
				`<footer style="margin-top:10px;text-align:left;font-size:12px;line-height:1.7;">` +
				`<div>SUB TOTAL: <span style="float:right;">${subTotalValue.toFixed(2)}</span></div>` +
				gstLines +
				`<div style="font-weight:700;font-size:14px;">TOTAL: <span style="float:right;">${total}</span></div>` +
				`</footer></body></html>`;
			const w = window.open('', '_blank');
			if (!w) {
				// fallback to in-page preview when popups are blocked
				setPreviewHtml(html);
				setShowPreview(true);
				setError('Popup blocked: showing preview. Allow popups to print directly.');
				return;
			}
			w.document.open(); w.document.write(html); w.document.close(); w.focus();
			setTimeout(() => { try { w.print(); } catch (e) { /* ignore */ } }, 300);
		} catch (e) { setError('Failed to open printer: ' + (e.message || e)); }
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
				<div className="table-title">My Products</div>
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
                                    	<th>Cost Price</th>
									<th>Selling Price</th>
									<th>Selling Qty</th>
								
									<th>Line Total</th>
									<th>Validity</th>
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
                                        	<td>{p.costPrice ?? '-'}</td>
										<td>{p.sellingPrice ?? '-'}</td>
										<td>
											<input style={{width:64}} value={p.sellingQty ?? p.qty ?? 1} onChange={e => {
												const v = Number(e.target.value) || 0;
												setSellerProducts(sp => sp.map((s, idx) => idx === i ? { ...s, sellingQty: v } : s));
											}} />
										</td>
									
										<td>{lineTotal(p).toFixed(2)}</td>
										<td>{p.validity ? new Date(p.validity).toLocaleDateString() : '-'}</td>
								

										<td><button className="btn secondary" onClick={() => setSellerProducts(sp => sp.filter(x => (x.productId || x._id) !== (p.productId || p._id)))}>Remove</button></td>
									</tr>
								))}
										<tr>
											<td colSpan={4} style={{textAlign:'right', fontWeight:600}}>Sub Total:</td>
											<td style={{fontWeight:600}}>{totalCount}</td>
											<td></td>
											<td style={{fontWeight:600}}>{subTotal.toFixed(1)}</td>
											<td colSpan={2}></td>
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
								<button className="btn secondary" style={{marginLeft:8}} onClick={printSale}>Printer</button>
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

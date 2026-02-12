// Constant payment methods used across the application
window.__SELL_PAYMENT_METHODS__ = [
  { value: 'Cash', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'Card', label: 'Card' },
  { value: 'UPI-H', label: 'UPI-H' },
  { value: 'UPI-S', label: 'UPI-S' },
  { value: 'Cash + Card', label: 'Cash + Card' },
  { value: 'UPI H + CASH', label: 'UPI H + Cash' },
  { value: 'UPI S + CASH', label: 'UPI S + Cash' },
  { value: 'UPI H + CARD', label: 'UPI H + Card' },
  { value: 'UPI S + CARD', label: 'UPI S + Card' }
];
window.__SELL_PAYMENT_METHOD_VALUES__ = window.__SELL_PAYMENT_METHODS__.map(function(m) { return m.value; });

function ProductSell({ salesUrl, token }) {
  const [products, setProducts] = React.useState([]);
  const [sellerProducts, setSellerProducts] = React.useState([]);
  const [productNo, setProductNo] = React.useState('');
  const [customerNo, setCustomerNo] = React.useState('');
  const [error, setError] = React.useState('');
  const [showAlert, setShowAlert] = React.useState(false);
  const [banks, setBanks] = React.useState([]);
  const [whatsappStock, setWhatsappStock] = React.useState([]);
  const [selectedBank, setSelectedBank] = React.useState('select');
  const [sellingBusy, setSellingBusy] = React.useState(false);
  const [lastSale, setLastSale] = React.useState(null);
  const [previewHtml, setPreviewHtml] = React.useState('');
  const [showPreview, setShowPreview] = React.useState(false);

  React.useEffect(() => {
    async function loadProducts() {
      try {
        setError('');
        // Sales server branch stock endpoint
        const url = new URL((salesUrl || '') + '/api/branch-stock');
        url.searchParams.set('only_branch', '1');
        const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load branch stock');
        setProducts(Array.isArray(data.rows) ? data.rows : []);
      } catch (e) { setError(e.message || 'Failed to load products'); }
    }
    loadProducts();
  }, [salesUrl, token]);

  React.useEffect(() => {
    if (!error) { setShowAlert(false); return; }
    setShowAlert(true);
    const t = setTimeout(() => setShowAlert(false), 4000);
    return () => clearTimeout(t);
  }, [error]);

  React.useEffect(() => {
    async function loadBanks() {
      try {
        const url = new URL((salesUrl || '') + '/api/banks');
        const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
        const data = await res.json();
        if (res.ok && Array.isArray(data.banks)) setBanks(data.banks);
      } catch (e) { /* ignore */ }
    }
    loadBanks();
  }, [token]);

  React.useEffect(() => {
    async function loadWhatsappStock() {
      try {
        const url = new URL((salesUrl || '') + '/api/whatsapp-stock');
        const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
        const data = await res.json();
        if (res.ok && Array.isArray(data.rows)) setWhatsappStock(data.rows);
      } catch (e) { /* ignore */ }
    }
    loadWhatsappStock();
  }, [salesUrl, token]);

  function lineTotal(item) {
    const qty = Number(item.sellingQty ?? item.qty ?? 0);
    const unit = Number(item.sellingPrice ?? item.sellingPrice ?? 0);
    return qty * unit;
  }

  const totalCount = sellerProducts.reduce((s, it) => s + Number(it.sellingQty ?? it.qty ?? 0), 0);
  const totalAmount = sellerProducts.reduce((s, it) => s + lineTotal(it), 0);

  async function doSell() {
    try {
      if (sellerProducts.length === 0) { setError('No products to sell'); return; }
      if (!(customerNo || '').toString().replace(/[^0-9]/g, '')) { setError('Customer mobile number is required'); return; }
      if (!selectedBank || selectedBank === 'select') { setError('Select a payment method'); return; }
      setSellingBusy(true); setError('');

      const payload = {
        items: sellerProducts.map(it => ({ productId: it._id || it.productId, productNo: it.productNo || '', productName: it.productName || it.name || '', qty: Number(it.sellingQty ?? it.qty ?? 0), sellingPrice: Number(it.sellingPrice || 0), lineTotal: Number(lineTotal(it)) })),
        customerNo,
        paymentMethod: (window.__SELL_PAYMENT_METHOD_VALUES__ || []).includes(selectedBank) ? selectedBank : 'online',
        amountPaid: Number(totalAmount || 0),
        bank_id: (selectedBank && selectedBank !== 'select' && !(window.__SELL_PAYMENT_METHOD_VALUES__ || []).includes(selectedBank)) ? selectedBank : ''
      };

      // Decide endpoint: if any item is from whatsapp stock, use whatsapp-sales endpoint
      const whatsappIds = new Set((whatsappStock || []).map(w => String(w._id)));
      const hasWhatsappItem = sellerProducts.some(sp => whatsappIds.has(String(sp._id || sp.productId)));
      const url = new URL((salesUrl || '') + (hasWhatsappItem ? '/api/whatsapp-sales' : '/api/sales'));
      const res = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Sell failed');
      setLastSale(data.sale || data || null);
      setSellerProducts([]); setCustomerNo(''); setSelectedBank('select'); setError('Sale saved');
      // refresh product lists to reflect updated stock
      try { 
        const bsUrl = new URL((salesUrl || '') + '/api/branch-stock'); bsUrl.searchParams.set('only_branch','1');
        const r2 = await fetch(bsUrl, { headers: { Authorization: 'Bearer ' + token } }); const d2 = await r2.json(); if (r2.ok && Array.isArray(d2.rows)) setProducts(d2.rows);
        const wsUrl = new URL((salesUrl || '') + '/api/whatsapp-stock'); const r3 = await fetch(wsUrl, { headers: { Authorization: 'Bearer ' + token } }); const d3 = await r3.json(); if (r3.ok && Array.isArray(d3.rows)) setWhatsappStock(d3.rows);
      } catch (__) { }
    } catch (e) { setError(e.message || 'Sell failed'); }
    finally { setSellingBusy(false); }
  }

  async function printSale() {
    try {
      const sale = lastSale || { items: sellerProducts, totalAmount, customerNo, createdAt: new Date().toISOString() };
      // fetch branch info
      let shopName = '';
      let shopContact = '';
      try {
        const res = await fetch(new URL((salesUrl || '') + '/api/branches'), { headers: { Authorization: 'Bearer ' + token } });
        const data = await res.json();
        if (res.ok && Array.isArray(data.branches) && data.branches.length > 0) {
          const payload = decodeJwt();
          const branchId = payload?.branch_id || payload?._id || '';
          let found = null;
          if (branchId) found = data.branches.find(b => String(b._id) === String(branchId));
          if (!found) found = data.branches[0];
          shopName = found?.name || '';
          shopContact = found?.phoneNumber || found?.phone || '';
        }
      } catch (e) { /* ignore */ }
      if (!shopName || !shopContact) {
        const payload = decodeJwt();
        shopName = shopName || payload.shopName || payload.name || payload.branchName || '';
        shopContact = shopContact || payload.phone || payload.phoneNumber || payload.branchPhone || '';
      }

      // fetch branch stock to resolve prices
      let stock = [];
      try {
        const sres = await fetch(new URL((salesUrl || '') + '/api/branch-stock?only_branch=1'), { headers: { Authorization: 'Bearer ' + token } });
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
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt</title><style> @page { size: 72mm auto; margin: 2mm; } body{font-family:monospace,Arial,Helvetica,sans-serif;padding:6px;color:#111; width:72mm; box-sizing:border-box;} h2{margin:0 0 6px;font-size:14px} .shop{ text-align:center; margin-bottom:6px; } .shop strong{ display:block; font-size:12px } .shop .contact{ font-size:11px; margin-top:2px } .date{ font-size:11px; margin-bottom:6px } table{width:100%;border-collapse:collapse;margin-top:6px;font-size:11px} th,td{padding:4px 2px} thead th{border-bottom:1px dashed #bbb; text-align:left; font-size:11px} tbody td{border-bottom:1px dashed #eee} .right{ text-align:right } footer{margin-top:8px;text-align:right;font-weight:700;font-size:12px} .center{ text-align:center }</style></head><body>` +
        `<div class="center"><h2 style="margin:0">CASH RECEIPT</h2></div><div class="shop"><strong>${shopName || 'Shop'}</strong><div class="contact">${shopContact || ''}</div></div>` +
        `<div class="date"><strong>Date:</strong> ${date}</div>` +
        `<table><thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Unit</th><th class="right">Line</th></tr></thead><tbody>${items}</tbody></table>` +
        `<footer>Total: ${total}</footer></body></html>`;
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

  function whatsappShare() {
    (async () => {
      const sale = lastSale || { items: sellerProducts, totalAmount, customerNo };
      // attempt to fetch authoritative branch info
      let shopName = '';
      let shopContact = '';
      try {
        // Prefer authoritative MySQL user info (username/contact) from SalesServer proxy to AUTH
        const mu = await fetch(new URL((salesUrl || '') + '/api/mysql-user'), { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } });
        const muData = await mu.json().catch(() => ({}));
        if (mu.ok && muData && muData.user) {
          shopName = muData.user.username || muData.user.name || muData.user.shopName || '';
          shopContact = muData.user.contact || muData.user.phone || muData.user.mobile || '';
        }
      } catch (e) { /* ignore */ }
      // Fallback to branches endpoint / JWT if mysql-user not present
      if (!shopName || !shopContact) {
        try {
          const url = new URL((salesUrl || '') + '/api/branches');
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
      }
      const itemsText = (sale.items || []).map((i, idx) => {
        const qty = i.qty || i.sellingQty || 0;
        const unit = Number(i.sellingPrice || i.unitSellingPrice || 0).toFixed(2);
        const line = (qty * Number(unit)).toFixed(2);
        return `${idx + 1}. ${i.productName || i.productNo || 'Item'}\n   Qty: ${qty} × ₹${unit} = ₹${line}`;
      }).join('\n');
      const invoiceNo = sale.billNo || sale.invoiceNo || sale._id || '';
      const saleDate = new Date(sale.createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const saleTotal = Number(sale.totalAmount || totalAmount || 0).toFixed(2);
      // normalize customer number
      let digits = (sale.customerNo || '').toString().replace(/[^0-9]/g, '');
      if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
      if (digits.length === 10) digits = '91' + digits;
      const cust = digits;
      const message = `━━━━━━━━━━━━━━━━━━━━\n   *${shopName || 'Store'}*\n${shopContact ? '   📞 ' + shopContact : ''}\n━━━━━━━━━━━━━━━━━━━━\n\n*INVOICE*${invoiceNo ? ' #' + invoiceNo : ''}\n📅 ${saleDate}\n\n*Items:*\n${itemsText}\n\n━━━━━━━━━━━━━━━━━━━━\n*Total: ₹${saleTotal}*\n━━━━━━━━━━━━━━━━━━━━\n\nThank you for your purchase! 🙏`;
      const whatsappUrl = window.ENV_CONFIG?.WHATSAPP_WEB_URL || 'https://web.whatsapp.com';
      window.open(`${whatsappUrl}/send?phone=${cust}&text=${encodeURIComponent(message)}`, '_blank');
    })();
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
      {showAlert && (
        <div style={{position:'fixed', right:16, bottom:16, zIndex:9999}}>
          <div style={{background:'#ffe6e6', color:'#900', padding:12, borderRadius:6}}>
            <div style={{fontWeight:600}}>Message</div>
            <div style={{marginTop:8}}>{error}</div>
          </div>
        </div>
      )}

      <div className="row" style={{ gap: 16, marginBottom: 16 }}>
        <div>
          <label>Product No</label><br />
          <div style={{display:'flex', gap:8}}>
            <input value={productNo} onChange={e => setProductNo(e.target.value)} placeholder="Enter product no to filter" />
            <button className="btn" type="button" onClick={() => {
              const needle = (productNo || '').toString().trim().toLowerCase();
              if (!needle) return;
              // Prefer whatsapp-stock records
              const foundW = whatsappStock.find(w => String(w.productNo || '').toLowerCase() === needle);
              if (foundW) {
                setError('');
                // Compute per-unit cost and selling price using totalCost and sellPercent when available
                const supplyQty = Number(foundW.supplyQty || 0);
                const totalCost = Number(foundW.totalCost || foundW.totalCostPrice || foundW.total_cost || foundW.costPrice || 0);
                let unitCost = Number(foundW.costPrice || 0);
                if (supplyQty > 0 && totalCost > 0) unitCost = totalCost / supplyQty;
                // selling price from percent markup if provided, else explicit sellingPrice
                const pct = Number(foundW.sellPercent || foundW.sell_percent || 0);
                let unitSelling = Number(foundW.sellingPrice || foundW.selling_price || 0);
                if (pct && pct !== 0) unitSelling = Number((unitCost * (1 + (pct / 100))).toFixed(2));

                const mapped = {
                  _id: foundW._id,
                  productId: foundW.productId || '',
                  productNo: foundW.productNo || '',
                  productName: foundW.productName || foundW.product_name || '',
                  brand: foundW.brand || '',
                  model: foundW.model || '',
                  qty: supplyQty || 0,
                  costPrice: Number(unitCost),
                  sellingPrice: Number(unitSelling),
                  sellPercent: pct || 0,
                  validity: foundW.validity || null
                };
                setSellerProducts(sp => {
                  if (sp.some(x => String(x.productNo || x._id) === String(mapped.productNo || mapped._id))) return sp;
                  return [...sp, mapped];
                });
                setProductNo('');
                return;
              }

              // fallback to branch-stock products
              const found = products.find(p => String(p.productNo || p._id || '').toLowerCase() === needle);
              if (!found) { setError('Product not found'); return; }
              setError('');
              setSellerProducts(sp => {
                if (sp.some(x => String(x._id) === String(found._id))) return sp;
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
            <option value="Cash">Cash</option>
            <option value="UPI">UPI</option>
            <option value="Card">Card</option>
            <option value="UPI-H">UPI-H</option>
            <option value="UPI-S">UPI-S</option>
            <option value="Cash + Card">Cash + Card</option>
            <option value="UPI H + CASH">UPI H + Cash</option>
            <option value="UPI S + CASH">UPI S + Cash</option>
            <option value="UPI H + CARD">UPI H + Card</option>
            <option value="UPI S + CARD">UPI S + Card</option>
            {banks.length > 0 && <option disabled>── Bank Accounts ──</option>}
            {banks.map(b => <option key={b._id} value={b._id}>{b.bankName || b.accountNumber || b._id}</option>)}
          </select>
        </div>
      </div>

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
                  <th>Qty</th>
                  {/* <th>Cost Price</th> */}
                  <th>Selling Price</th>
                  <th>Selling Qty</th>
                  <th>Line Total</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sellerProducts.map((p, i) => (
                  <tr key={p._id || p.productId || i}>
                    <td>{p.productNo || p._id || '-'}</td>
                    <td>{p.productName || p.name || '-'}</td>
                    <td>{p.quantity ?? p.qty ?? '-'}</td>
                    {/* <td>{p.costPrice ?? p.totalCost ?? '-'}</td> */}
                    <td>{p.sellingPrice ?? p.sellingPrice ?? '-'}</td>
                    <td>
                      <input style={{width:64}} value={p.sellingQty ?? p.qty ?? 1} onChange={e => {
                        const v = Number(e.target.value) || 0;
                        setSellerProducts(sp => sp.map((s, idx) => idx === i ? { ...s, sellingQty: v } : s));
                      }} />
                    </td>
                    <td>{lineTotal(p).toFixed(2)}</td>
                    <td><button className="btn secondary" onClick={() => setSellerProducts(sp => sp.filter(x => String(x._id) !== String(p._id)))}>Remove</button></td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2} style={{textAlign:'right', fontWeight:600}}>Totals:</td>
                  <td style={{fontWeight:600}}>{totalCount}</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td style={{fontWeight:600}}>{totalAmount.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{marginTop:12}}>
        <button className="btn" onClick={doSell} disabled={sellingBusy}>{sellingBusy ? 'Processing...' : 'Sell'}</button>
        <button className="btn secondary" style={{marginLeft:8}} onClick={printSale}>Printer</button>
        <button className="btn secondary" style={{marginLeft:8}} onClick={whatsappShare}>WhatsApp</button>
      </div>
    </div>
  );
}

window.ProductSell = ProductSell;

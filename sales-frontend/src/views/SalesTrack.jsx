function SalesTrack({ salesUrl, token }) {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [previewHtml, setPreviewHtml] = React.useState('');
  const [showPreview, setShowPreview] = React.useState(false);
  const [dateFilter, setDateFilter] = React.useState('');
  const [customerFilter, setCustomerFilter] = React.useState('');
  const [imeFilter, setImeFilter] = React.useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const url = new URL(salesUrl + '/api/sales');
      // if branch token is used server should infer branch; include branch param for safety
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load sales');
      setRows(Array.isArray(data.sales) ? data.sales : []);
    } catch (e) { setError(e.message || 'Failed'); }
    finally { setLoading(false); }
  };

  React.useEffect(() => { load(); }, []);

  // decode JWT payload to extract branch/shop info when branch endpoint isn't available
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

  async function getBranchInfo() {
    let branchName = '';
    let branchContact = '';
    let branchGst = '';
    let branchAddress = '';
    try {
      const res = await fetch(new URL(salesUrl + '/api/branches'), { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      if (res.ok && Array.isArray(data.branches) && data.branches.length > 0) {
        const payload = decodeJwt();
        const branchId = payload?.branch_id || payload?._id || '';
        let found = null;
        if (branchId) found = data.branches.find(b => String(b._id) === String(branchId));
        if (!found) found = data.branches[0];
        branchName = found?.name || '';
        branchContact = found?.phoneNumber || found?.phone || '';
        branchGst = found?.gstNo || found?.gst || '';
        branchAddress = found?.address || found?.branchAddress || '';
      }
    } catch (e) { /* ignore */ }
    if (!branchName || !branchContact) {
      const payload = decodeJwt();
      branchName = branchName || payload.shopName || payload.name || payload.branchName || '';
      branchContact = branchContact || payload.phone || payload.phoneNumber || payload.branchPhone || '';
      branchGst = branchGst || payload.gstNo || payload.gst || '';
      branchAddress = branchAddress || payload.address || payload.branchAddress || '';
    }
    return { branchName, branchContact, branchGst, branchAddress };
  }

  function buildReceiptHtml(sale, branchName, branchContact, stock, branchGst, branchAddress) {
    const items = (sale.items || []).map(i => {
      // resolve from stock when available
      const found = (stock || []).find(p => (String(p._id) && String(p._id) === String(i.productId || i._id)) || (p.productId && String(p.productId) === String(i.productId)) || (p.productNo && i.productNo && String(p.productNo) === String(i.productNo)));
      const name = found?.productName || found?.name || i.productName || i.productNo || '';
      const qty = Number(i.qty || i.sellingQty || 0);
      const unit = Number(found?.sellingPrice ?? found?.unitSellingPrice ?? i.sellingPrice ?? 0).toFixed(2);
      const line = (qty * Number(unit)).toFixed(2);
      return { name, qty, unit, line };
    });
    // build table rows with S.no, Description (wide), HSN (empty), Qty, Rate, Amount
    const itemsRows = items.map((it, idx) => `
      <tr>
        <td style="padding:6px;text-align:center">${idx+1}</td>
        <td style="padding:6px">${it.name}</td>
        <td style="padding:6px;text-align:center">&nbsp;</td>
        <td style="padding:6px;text-align:right">${it.qty}</td>
        <td style="padding:6px;text-align:right">${it.unit}</td>
        <td style="padding:6px;text-align:right">${it.line}</td>
      </tr>
    `).join('');
    // GST details
  const cgstPercent = sale.cgst || sale.cgstPercent || 0;
  const sgstPercent = sale.sgst || sale.sgstPercent || 0;
  const igstPercent = sale.igst || sale.igstPercent || 0;
  const cgstAmt = sale.cgstAmount ?? 0;
  const sgstAmt = sale.sgstAmount ?? 0;
  const igstAmt = sale.igstAmount ?? 0;
  const subTotal = sale.subTotal ?? items.reduce((s, it) => s + Number(it.line), 0);
  const discount = sale.discount ?? 0;
  const discountAmount = sale.discountAmount ?? 0;
  const taxable = sale.taxableAmount ?? Math.max(0, subTotal - discountAmount);
  const total = Number(sale.totalAmount ?? (taxable + cgstAmt + sgstAmt + igstAmt)).toFixed(2);
    const date = new Date(sale.createdAt || Date.now()).toLocaleString();
    let gstLines = '';
    if (cgstPercent > 0) gstLines += `<div>CGST ${cgstPercent}%: <span style=\"float:right;\">${Number(cgstAmt).toFixed(2)}</span></div>`;
    if (sgstPercent > 0) gstLines += `<div>SGST ${sgstPercent}%: <span style=\"float:right;\">${Number(sgstAmt).toFixed(2)}</span></div>`;
    if (igstPercent > 0) gstLines += `<div>IGST ${igstPercent}%: <span style=\"float:right;\">${Number(igstAmt).toFixed(2)}</span></div>`;
    if (gstLines) gstLines += `<div style=\"margin:6px 0;\"></div>`;
    // Build a bordered invoice that matches provided layout
    const outSubTotal = Number(subTotal || 0);
    const outDiscount = Number(discountAmount || 0);
    const outTaxable = Number(taxable || Math.max(0, outSubTotal - outDiscount));
    const outTotal = Number(total || 0).toFixed(2);

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice</title><style>
      @page { size: 80mm auto; margin: 6mm; }
      body{font-family: Arial, Helvetica, sans-serif; padding:8px; color:#111; width:80mm; box-sizing:border-box}
      .top-box{border:1px solid #000;padding:6px;margin-bottom:6px}
      .top-left{float:left;font-size:11px}
      .top-right{float:right;font-size:11px}
      .center-title{clear:both;text-align:center;font-weight:700;margin:6px 0}
      .branch-name{font-size:16px;font-weight:900;text-align:center;padding:4px 0;border-bottom:1px solid #000}
      .address{font-size:11px;text-align:center;margin-top:4px}
      .cust-line{margin-top:8px;font-size:11px}
      .cust-dotted{border-bottom:1px dotted #000;padding-bottom:6px;margin-bottom:6px}
      table.items{width:100%;border-collapse:collapse;margin-top:8px;font-size:11px}
      table.items th, table.items td{border:1px solid #000;padding:6px}
      thead th{background:#fff}
      table.totals{width:44%;float:right;border-collapse:collapse;margin-top:8px;font-size:11px}
      table.totals td{padding:6px;border:0}
      .right{text-align:right}
    </style></head><body>` +
      `<div class="top-box"><div class="top-left">GSTIN: ${branchGst || '-'}</div><div class="top-right">Mob: ${branchContact || '-'}</div><div style="clear:both"></div></div>` +
      `<div class="center-title">CASH RECEIPT</div>` +
      `<div class="branch-name">${branchName || 'Branch Name'}</div>` +
      `<div class="address">${branchAddress || 'Branch Address'}</div>` +
      `<div class="cust-line cust-dotted"><strong>Customer:</strong> ${sale.customerName || 'John Doe'}</div>` +
      `<div class="cust-line"><strong>Phone:</strong> ${sale.customerNo || '9999999999'} &nbsp;&nbsp; <strong>Date:</strong> ${date}</div>` +
      `<table class="items"><thead><tr><th style="width:6%">S.no</th><th style="width:56%">Description of Goods</th><th style="width:10%">HSN</th><th style="width:8%">Qty</th><th style="width:10%">Rate</th><th style="width:10%">Amount</th></tr></thead><tbody>${itemsRows}</tbody></table>` +
      `<table class="totals">` +
        `<tr><td>SUB TOTAL:</td><td class="right">${outSubTotal.toFixed(2)}</td></tr>` +
        (discount ? `<tr><td>DISCOUNT (${discount}%):</td><td class="right">${outDiscount.toFixed(2)}</td></tr>` : '') +
        `<tr><td>TAXABLE:</td><td class="right">${outTaxable.toFixed(2)}</td></tr>` +
        (cgstPercent > 0 ? `<tr><td>CGST ${cgstPercent}%:</td><td class="right">${Number(cgstAmt).toFixed(2)}</td></tr>` : '') +
        (sgstPercent > 0 ? `<tr><td>SGST ${sgstPercent}%:</td><td class="right">${Number(sgstAmt).toFixed(2)}</td></tr>` : '') +
        (igstPercent > 0 ? `<tr><td>IGST ${igstPercent}%:</td><td class="right">${Number(igstAmt).toFixed(2)}</td></tr>` : '') +
        `<tr><td style="font-weight:700">GRAND TOTAL:</td><td class="right" style="font-weight:700">${outTotal}</td></tr>` +
      `</table>` +
    `</body></html>`;
    return html;
  }

  // Filtering logic for sales rows
  const filteredRows = React.useMemo(() => {
    return rows.filter(s => {
      const saleDate = new Date(s.createdAt);
      const filterDate = dateFilter ? new Date(dateFilter) : null;
      const dateMatch = !filterDate || (saleDate.toDateString() === filterDate.toDateString());
      // customer filter
      const customerMatch = !customerFilter || (s.customerNo || '').toLowerCase().includes(customerFilter.toLowerCase());
      // ime filter: if provided, ensure at least one item in sale has this IME in its imes array
      const ime = (imeFilter || '').toString().trim();
      let imeMatch = true;
      if (ime) {
        imeMatch = (s.items || []).some(it => {
          const ims = Array.isArray(it.imes) ? it.imes : (Array.isArray(it.selectedImes) ? it.selectedImes : []);
          return ims.some(x => String(x).toLowerCase().includes(ime.toLowerCase()));
        });
      }
      return dateMatch && customerMatch && imeMatch;
    });
  }, [rows, dateFilter, customerFilter, imeFilter]);

  return (
    <div>
      <div className="card">
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
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <h3>Sales History</h3>
          <div>
            <button className="btn" onClick={load}>Refresh</button>
          </div>
        </div>
        {error ? <div className="mt-2 text-danger">{error}</div> : null}
        {loading ? <div>Loading…</div> : (
          <div className="table-scroll mt-2">
            {/* Filter Section */}
            <div className="filter-section" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ padding: '8px', width: '180px' }} />
              <input type="text" placeholder="Filter by Customer No" value={customerFilter} onChange={e => setCustomerFilter(e.target.value)} style={{ padding: '8px', width: '180px' }} />
              <input type="text" placeholder="Filter by IME" value={imeFilter} onChange={e => setImeFilter(e.target.value)} style={{ padding: '8px', width: '180px' }} />
            </div>
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Discount</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(s => (
                  <tr key={s._id}>
                    <td>{new Date(s.createdAt).toLocaleString()}</td>
                    <td>{s.customerNo || '-'}</td>
                    <td>{(s.items || []).map(i => {
                      const ims = Array.isArray(i.imes) ? i.imes : (Array.isArray(i.selectedImes) ? i.selectedImes : []);
                      const imeCountStr = ims && ims.length ? ` [IMEs:${ims.length}]` : '';
                      return `${i.productName || i.productNo || 'item'} x${i.qty || i.sellingQty || 0}${imeCountStr}`;
                    }).join(', ')}</td>
                    <td>{s.discount ? `${s.discount}% (${Number(s.discountAmount||0).toFixed(2)})` : '-'}</td>
                    <td>{Number(s.totalAmount || 0).toFixed(2)}</td>
                    <td>{s.paymentMethod || '-'}</td>
                    <td>
                      <button className="btn secondary" onClick={async () => {
                        try {
                          const { branchName, branchContact, branchGst, branchAddress } = await getBranchInfo();
                          // fetch stock to resolve product names/prices
                          let stock = [];
                          try {
                            const sres = await fetch(new URL(salesUrl + '/api/branch-stock?only_branch=1'), { headers: { Authorization: 'Bearer ' + token } });
                            const sdata = await sres.json();
                            if (sres.ok && Array.isArray(sdata.rows)) stock = sdata.rows;
                          } catch (e) { /* ignore */ }
                          const html = buildReceiptHtml(s, branchName, branchContact, stock, branchGst, branchAddress);
                          const w = window.open('', '_blank');
                          if (!w) { alert('Popup blocked: allow popups to print'); return; }
                          w.document.open(); w.document.write(html); w.document.close();
                          w.focus();
                          setTimeout(() => { try { w.print(); } catch (e) { /* ignore */ } }, 300);
                        } catch (e) { console.error(e); alert('Failed to generate receipt'); }
                      }}>Print</button>
                      <button className="btn secondary" style={{marginLeft:8}} onClick={async () => {
                        try {
                          const { branchName, branchContact, branchGst, branchAddress } = await getBranchInfo();
                          let stock = [];
                          try {
                            const sres = await fetch(new URL(salesUrl + '/api/branch-stock?only_branch=1'), { headers: { Authorization: 'Bearer ' + token } });
                            const sdata = await sres.json();
                            if (sres.ok && Array.isArray(sdata.rows)) stock = sdata.rows;
                          } catch (e) { /* ignore */ }
                          const html = buildReceiptHtml(s, branchName, branchContact, stock, branchGst, branchAddress);
                          setPreviewHtml(html);
                          setShowPreview(true);
                        } catch (e) { console.error(e); alert('Failed to prepare preview'); }
                      }}>Preview</button>
                      <button className="btn secondary" style={{marginLeft:8}} onClick={async () => {
                        // Build authoritative WhatsApp message: try to fetch branch info and branch-stock to resolve product names/prices
                        let branchName = '';
                        let branchContact = '';
                        try {
                          const bres = await fetch(new URL(salesUrl + '/api/branches'), { headers: { Authorization: 'Bearer ' + token } });
                          const bdata = await bres.json();
                          if (bres.ok && Array.isArray(bdata.branches) && bdata.branches.length > 0) {
                            branchName = bdata.branches[0].name || '';
                            branchContact = bdata.branches[0].phoneNumber || bdata.branches[0].phone || '';
                          }
                        } catch (e) { /* ignore */ }

                        // attempt to fetch branch-stock to resolve prices
                        let stock = [];
                        try {
                          const sres = await fetch(new URL(salesUrl + '/api/branch-stock?only_branch=1'), { headers: { Authorization: 'Bearer ' + token } });
                          const sdata = await sres.json();
                          if (sres.ok && Array.isArray(sdata.rows)) stock = sdata.rows;
                        } catch (e) { /* ignore */ }

                        const itemsText = (s.items||[]).map(i => {
                          const found = stock.find(p => (String(p._id) && String(p._id) === String(i.productId || i._id)) || (p.productId && String(p.productId) === String(i.productId)) || (p.productNo && i.productNo && String(p.productNo) === String(i.productNo)));
                          const name = found?.productName || found?.name || i.productName || i.productNo || '';
                          const unit = Number(found?.sellingPrice ?? found?.unitSellingPrice ?? i.sellingPrice ?? 0).toFixed(2);
                          const qty = Number(i.qty || i.sellingQty || 0);
                          return `${name} x${qty} @ ${unit}`;
                        }).join('\n');

                        const message = `Shop: ${branchName}\nContact: ${branchContact}\n\nItems:\n${itemsText}\n\nTotal: ${Number(s.totalAmount||0).toFixed(2)}`;
                        const text = encodeURIComponent(message);
                        // no specific phone in sales track share previously; prefer sending directly to sale.customerNo when available
                        const raw = (s.customerNo || '').toString().replace(/[^0-9]/g, '');
                        if (raw && raw.length > 0) {
                          let phone = raw.replace(/^0+/, '');
                          if (phone.length === 10) phone = '91' + phone; // default to India if 10 digits
                          console.log('WhatsApp send to (sales track):', phone);
                          console.log('Prepared WhatsApp message:', message);
                          const whatsappUrl = window.ENV_CONFIG?.WHATSAPP_WEB_URL || 'https://web.whatsapp.com';
                          window.open(`${whatsappUrl}/send?phone=${phone}&text=${text}`, '_blank');
                        } else {
                          // fallback: open shared message without target phone
                          console.log('Prepared WhatsApp message (no customer phone):', message);
                          const whatsappUrl = window.ENV_CONFIG?.WHATSAPP_WEB_URL || 'https://web.whatsapp.com';
                          window.open(`${whatsappUrl}/send?text=${text}`, '_blank');
                        }
                      }}>WhatsApp</button>
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 ? (
                  <tr><td colSpan={6}>No sales found</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

window.SalesTrack = SalesTrack;

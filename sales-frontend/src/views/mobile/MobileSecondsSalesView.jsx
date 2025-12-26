function MobileSecondsSalesView({ salesUrl, token, id }) {
  const [entry, setEntry] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  // Purchase modal state
  const [showPurchase, setShowPurchase] = React.useState(false);
  const [purchaseForm, setPurchaseForm] = React.useState({ customerName: '', phone: '', price: '', bankId: '' });
  const [purchaseImages, setPurchaseImages] = React.useState([]);
  const [purchaseDocs, setPurchaseDocs] = React.useState([]);
  const [banks, setBanks] = React.useState([]);
  const [purchaseLoading, setPurchaseLoading] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError('');
        const res = await fetch((salesUrl || '') + '/api/seconds-sales', {
          headers: { Authorization: token ? 'Bearer ' + token : '' }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load');
        const found = (data.rows || []).find((r) => String(r._id) === String(id));
        if (mounted) setEntry(found || null);
      } catch (err) {
        if (mounted) setError(err.message || 'Failed');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [id, salesUrl, token]);

  // load banks
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch((salesUrl || '') + '/api/banks', {
          headers: { Authorization: token ? 'Bearer ' + token : '' }
        });
        const data = await res.json();
        if (res.ok && mounted) setBanks(Array.isArray(data.banks) ? data.banks : []);
      } catch (err) {
        console.error('load banks', err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [salesUrl, token]);

  function purchaseOnChange(e) {
    const { name, value } = e.target;
    setPurchaseForm((f) => ({ ...f, [name]: value }));
  }

  function filesToBase64(fileList, setter) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const promises = files.map(
      (f) =>
        new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res({ name: f.name, base64: reader.result });
          reader.onerror = rej;
          reader.readAsDataURL(f);
        })
    );
    Promise.all(promises)
      .then((arr) => setter((prev) => [...prev, ...arr]))
      .catch((err) => console.error('file read', err));
  }

  async function submitPurchase(e) {
    e.preventDefault();
    const amount = Number(purchaseForm.price || 0);
    const bankId = purchaseForm.bankId || '';
    if (!amount || amount <= 0) return alert('Enter valid price');
    setPurchaseLoading(true);
    try {
      const payload = {
        customerName: purchaseForm.customerName || '',
        phone: purchaseForm.phone || '',
        price: amount,
        bank_id: bankId || undefined,
        images: purchaseImages || [],
        documents: purchaseDocs || []
      };
      const res = await fetch((salesUrl || '') + '/api/seconds-sales/' + encodeURIComponent(entry._id) + '/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token ? 'Bearer ' + token : '' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Purchase API failed');
      if (data.entry) setEntry(data.entry);
      setShowPurchase(false);
      setPurchaseForm({ customerName: '', phone: '', price: '', bankId: '' });
      setPurchaseImages([]);
      setPurchaseDocs([]);
    } catch (err) {
      alert(err.message || 'Purchase failed');
    } finally {
      setPurchaseLoading(false);
    }
  }

  function decodeJwt(tk) {
    try {
      const theToken = tk || token || localStorage.getItem('branch_token') || localStorage.getItem('sales_token') || '';
      const parts = theToken.split('.');
      if (parts.length < 2) return {};
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(
        atob(base64)
          .split('')
          .map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join('')
      );
      return JSON.parse(json);
    } catch (e) {
      return {};
    }
  }

  async function getBranchInfo() {
    let shopName = '';
    let shopContact = '';
    try {
      const url = new URL((salesUrl || '') + '/api/branches');
      const res = await fetch(url, { headers: { Authorization: token ? 'Bearer ' + token : '' } });
      const data = await res.json();
      if (res.ok && Array.isArray(data.branches) && data.branches.length > 0) {
        const payload = decodeJwt();
        const branchId = payload?.branch_id || payload?._id || '';
        let found = null;
        if (branchId) found = data.branches.find((b) => String(b._id) === String(branchId));
        if (!found) found = data.branches[0];
        shopName = found?.name || '';
        shopContact = found?.phoneNumber || found?.phone || '';
      }
    } catch (e) {
      /* ignore */
    }
    if (!shopName || !shopContact) {
      const payload = decodeJwt();
      shopName = shopName || payload.shopName || payload.name || payload.branchName || '';
      shopContact = shopContact || payload.phone || payload.phoneNumber || payload.branchPhone || '';
    }
    return { shopName, shopContact };
  }

  function normalizePhone(raw) {
    let digits = (raw || '').toString().replace(/[^0-9]/g, '');
    if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    if (digits.length === 10) digits = '91' + digits;
    return digits;
  }

  async function handleWhatsAppLastPurchase() {
    const p = (entry.purchases || [])[(entry.purchases || []).length - 1];
    if (!p) return alert('No purchase found');
    const { shopName, shopContact } = await getBranchInfo();
    const productName = `${entry.mobileName || ''}${entry.model ? ' — ' + entry.model : ''}`.trim();
    const date = new Date(p.createdAt || Date.now()).toLocaleString();
    const message = `Shop: ${shopName}\nContact: ${shopContact}\n\nProduct: ${productName}\nPrice: ₹ ${Number(p.price || 0).toFixed(2)}\nDate: ${date}\nCustomer: ${p.customerName || '-'} — ${p.phone || '-'}\n\nThanks,\n${shopName}`;
    const cust = normalizePhone(p.phone || '');
    try {
      const whatsappUrl = window.ENV_CONFIG?.WHATSAPP_WEB_URL || 'https://web.whatsapp.com';
      if (cust) window.open(`${whatsappUrl}/send?phone=${cust}&text=${encodeURIComponent(message)}`, '_blank');
      else window.open(whatsappUrl + '/', '_blank');
    } catch (e) {
      console.error('open whatsapp', e);
    }
  }

  function handlePrintLastPurchase() {
    const p = (entry.purchases || [])[(entry.purchases || []).length - 1];
    if (!p) return alert('No purchase found');
    (async () => {
      const { shopName, shopContact } = await getBranchInfo();
      const productName = `${entry.mobileName || ''}${entry.model ? ' — ' + entry.model : ''}`.trim();
      const date = new Date(p.createdAt || Date.now()).toLocaleString();
      const total = Number(p.price || 0).toFixed(2);
      const html =
        `<!doctype html><html><head><meta charset="utf-8"><title>Receipt</title><style> @page { size: 72mm auto; margin: 2mm; } body{font-family:monospace,Arial,Helvetica,sans-serif;padding:6px;color:#111; width:72mm; box-sizing:border-box;} h2{margin:0 0 6px;font-size:14px} .shop{ text-align:center; margin-bottom:6px; } .shop strong{ display:block; font-size:12px } .shop .contact{ font-size:11px; margin-top:2px } .date{ font-size:11px; margin-bottom:6px } table{width:100%;border-collapse:collapse;margin-top:6px;font-size:11px} th,td{padding:4px 2px} thead th{border-bottom:1px dashed #bbb; text-align:left; font-size:11px} tbody td{border-bottom:1px dashed #eee} .right{ text-align:right } footer{margin-top:8px;text-align:right;font-weight:700;font-size:12px} .center{ text-align:center }</style></head><body>` +
        `<div class="center"><h2 style="margin:0">TAX INVOICE</h2></div><div class="shop"><strong>${shopName || 'Shop'}</strong><div class="contact">${shopContact || ''}</div></div>` +
        `<div class="date"><strong>Date:</strong> ${date}</div>` +
        `<table><thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Unit</th><th class="right">Line</th></tr></thead><tbody>` +
        `<tr><td style="padding:6px">${productName}</td><td style="text-align:right;padding:6px">1</td><td style="text-align:right;padding:6px">${Number(p.price || 0).toFixed(2)}</td><td style="text-align:right;padding:6px">${Number(p.price || 0).toFixed(2)}</td></tr>` +
        `</tbody></table>` +
        `<footer>Total: ${total}</footer><div style="margin-top:8px">Thanks for your purchase!</div></body></html>`;
      const w = window.open('', '_blank');
      if (!w) {
        alert('Popup blocked: allow popups to print directly');
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => {
        try {
          w.print();
        } catch (e) {
          /* ignore */
        }
      }, 300);
    })();
  }

  const fileLinks = (arr) =>
    (arr || []).map((f, i) => {
      const filename = f.filename || (f.path ? f.path.split(/[\\/]/).pop() : null);
      const base = (salesUrl || '').replace(/\/+$/, '') || '';
      const url = filename ? `${base}/uploads/seconds-sales/${filename}` : f.path || '#';
      return (
        <div key={i} style={{ marginBottom: 8 }}>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              textDecoration: 'none',
              color: '#111',
              maxWidth: '100%',
              overflow: 'hidden'
            }}
          >
            <span style={{ fontSize: 12, opacity: 0.9 }}>↗</span>
            <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
              {f.originalName || filename || 'file'}
            </span>
          </a>
        </div>
      );
    });

  if (loading) {
    return (
      <div className="card">
        <div className="empty-state" style={{ padding: 18 }}>
          <div className="empty-icon">⏳</div>
          <div className="empty-title">Loading Entry</div>
          <div className="empty-sub">Please wait…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="empty-state" style={{ padding: 18 }}>
          <div className="empty-icon">⚠️</div>
          <div className="empty-title">Error</div>
          <div className="empty-sub">{error}</div>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => window.location.reload()}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="card">
        <div className="empty-state" style={{ padding: 18 }}>
          <div className="empty-icon">📱</div>
          <div className="empty-title">Entry Not Found</div>
          <div className="empty-sub">This mobile entry could not be found.</div>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => { try { location.hash = '#seconds-sales'; } catch {} }}>
            Back
          </button>
        </div>
      </div>
    );
  }

  const lastPurchase = (entry.purchases || [])[(entry.purchases || []).length - 1];

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 900, wordBreak: 'break-word' }}>{entry.mobileName || 'Mobile Entry'} Details</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{entry.model || ''}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn secondary" type="button" onClick={() => { try { location.hash = '#seconds-sales'; } catch {} }}>
              Back
            </button>
            <button className="btn" type="button" onClick={() => setShowPurchase(true)}>
              Purchase
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Device</div>
        <div style={{ fontSize: 13, opacity: 0.9 }}>IMEI: <span style={{ fontFamily: 'monospace' }}>{entry.imeNo || '—'}</span></div>
        <div style={{ fontSize: 13, opacity: 0.9, marginTop: 6 }}>Specification: {entry.specification || '—'}</div>
        <div style={{ fontSize: 13, opacity: 0.9, marginTop: 6 }}>Condition: {entry.mobileCondition || '—'}</div>
        <div style={{ fontSize: 13, opacity: 0.9, marginTop: 6 }}>Color: {entry.colour || '—'}</div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Seller</div>
        <div style={{ fontSize: 13, opacity: 0.9 }}>Name: {entry.sellerName || '—'}</div>
        <div style={{ fontSize: 13, opacity: 0.9, marginTop: 6 }}>Address: {entry.sellerAddress || '—'}</div>
        <div style={{ fontSize: 13, opacity: 0.9, marginTop: 6 }}>
          Reference: {(entry.referenceName || '—') + (entry.referenceNumber ? ' — ' + entry.referenceNumber : '')}
        </div>
        <div style={{ fontSize: 13, opacity: 0.9, marginTop: 6 }}>Reason: {entry.reasonForSale || '—'}</div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Payment & Proof</div>
        <div style={{ fontSize: 13, opacity: 0.9 }}>Proof: {(entry.proofType || '—') + (entry.proofNo ? ' — ' + entry.proofNo : '')}</div>
        <div style={{ fontSize: 16, fontWeight: 900, marginTop: 8 }}>₹{Number(entry.valueOfProduct || 0).toFixed(2)}</div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Attachments</div>
        <div style={{ fontWeight: 700, marginTop: 4 }}>Images ({(entry.images || []).length})</div>
        {(entry.images || []).length ? fileLinks(entry.images) : <div style={{ fontSize: 13, opacity: 0.8, marginTop: 6 }}>No images</div>}
        <div style={{ fontWeight: 700, marginTop: 10 }}>Documents ({(entry.documents || []).length})</div>
        {(entry.documents || []).length ? fileLinks(entry.documents) : <div style={{ fontSize: 13, opacity: 0.8, marginTop: 6 }}>No documents</div>}
        <div style={{ fontWeight: 700, marginTop: 10 }}>Signatures ({(entry.signatures || []).length})</div>
        {(entry.signatures || []).length ? fileLinks(entry.signatures) : <div style={{ fontSize: 13, opacity: 0.8, marginTop: 6 }}>No signatures</div>}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Purchase History</div>
        {(entry.purchases || []).length === 0 ? (
          <div style={{ fontSize: 13, opacity: 0.85 }}>No purchases yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(entry.purchases || []).map((p, idx) => (
              <div key={idx} style={{ border: '1px solid #eee', borderRadius: 10, padding: 12, background: '#fef2f2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900 }}>SOLD #{idx + 1}</div>
                    <div style={{ fontSize: 13, opacity: 0.9, marginTop: 2 }}>{p.customerName || 'Unknown Customer'}</div>
                    <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>{p.phone || 'No phone'}</div>
                  </div>
                  <div style={{ fontWeight: 900 }}>₹{Number(p.price || 0).toFixed(2)}</div>
                </div>
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>
                  {new Date(p.createdAt || Date.now()).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
                {(p.documents || []).length ? (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>Documents</div>
                    {fileLinks(p.documents)}
                  </div>
                ) : null}
                {(p.images || []).length ? (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>Images</div>
                    {fileLinks(p.images)}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {lastPurchase ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            <button className="btn secondary" type="button" onClick={handleWhatsAppLastPurchase}>
              WhatsApp Last Purchase
            </button>
            <button className="btn secondary" type="button" onClick={handlePrintLastPurchase}>
              Print Last Receipt
            </button>
          </div>
        ) : null}
      </div>

      {showPurchase ? (
        <div
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center'
          }}
          onClick={() => setShowPurchase(false)}
        >
          <div
            style={{
              width: '100%',
              maxHeight: '92%',
              background: '#fff',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: 12, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 900 }}>Record Purchase</div>
              <button className="btn secondary" type="button" onClick={() => setShowPurchase(false)}>
                Close
              </button>
            </div>

            <form onSubmit={submitPurchase} style={{ padding: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label>Customer Name</label>
                  <input name="customerName" value={purchaseForm.customerName} onChange={purchaseOnChange} style={{ width: '100%', marginTop: 6 }} />
                </div>
                <div>
                  <label>Phone</label>
                  <input name="phone" value={purchaseForm.phone} onChange={purchaseOnChange} style={{ width: '100%', marginTop: 6 }} />
                </div>
                <div>
                  <label>Price *</label>
                  <input name="price" type="number" value={purchaseForm.price} onChange={purchaseOnChange} style={{ width: '100%', marginTop: 6 }} />
                </div>
                <div>
                  <label>Bank</label>
                  <select name="bankId" value={purchaseForm.bankId} onChange={purchaseOnChange} style={{ width: '100%', marginTop: 6 }}>
                    <option value="">Select bank account</option>
                    {banks.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.bankName} — ₹{Number(b.accountBalance || 0).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>Documents</label>
                  <input type="file" accept="application/pdf,image/*" multiple onChange={(e) => filesToBase64(e.target.files, setPurchaseDocs)} style={{ width: '100%', marginTop: 6 }} />
                  {purchaseDocs.length ? <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{purchaseDocs.length} selected</div> : null}
                </div>

                <div>
                  <label>Images</label>
                  <input type="file" accept="image/*" multiple onChange={(e) => filesToBase64(e.target.files, setPurchaseImages)} style={{ width: '100%', marginTop: 6 }} />
                  {purchaseImages.length ? <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{purchaseImages.length} selected</div> : null}
                </div>

                <button className="btn" type="submit" disabled={purchaseLoading}>
                  {purchaseLoading ? 'Recording…' : 'Record Purchase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

window.MobileSecondsSalesView = MobileSecondsSalesView;

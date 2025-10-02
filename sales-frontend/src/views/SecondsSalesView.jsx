function SecondsSalesView({ salesUrl, token, id }) {
  const [entry, setEntry] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch((salesUrl || '') + '/api/seconds-sales', { headers: { Authorization: token ? ('Bearer ' + token) : '' } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load');
        const found = (data.rows || []).find(r => String(r._id) === String(id));
        if (mounted) setEntry(found || null);
      } catch (err) {
        if (mounted) setError(err.message || 'Failed');
      } finally { if (mounted) setLoading(false); }
    }
    load();
    return () => { mounted = false; };
  }, [id]);

  // Purchase modal state (hooks before returns)
  const [showPurchase, setShowPurchase] = React.useState(false);
  const [purchaseForm, setPurchaseForm] = React.useState({ customerName: '', phone: '', price: '', bankId: '' });
  const [purchaseImages, setPurchaseImages] = React.useState([]);
  const [purchaseDocs, setPurchaseDocs] = React.useState([]);
  const [banks, setBanks] = React.useState([]);
  const [purchaseLoading, setPurchaseLoading] = React.useState(false);

  // load banks
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch((salesUrl || '') + '/api/banks', { headers: { Authorization: token ? ('Bearer ' + token) : '' } });
        const data = await res.json();
        if (res.ok && mounted) setBanks(Array.isArray(data.banks) ? data.banks : []);
      } catch (err) { console.error('load banks', err); }
    })();
    return () => { mounted = false; };
  }, []);

  function purchaseOnChange(e) {
    const { name, value } = e.target;
    setPurchaseForm(f => ({ ...f, [name]: value }));
  }

  function filesToBase64(fileList, setter) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const promises = files.map(f => new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res({ name: f.name, base64: reader.result });
      reader.onerror = rej;
      reader.readAsDataURL(f);
    }));
    Promise.all(promises).then(arr => setter(prev => [...prev, ...arr])).catch(err => console.error('file read', err));
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
        headers: { 'Content-Type': 'application/json', Authorization: token ? ('Bearer ' + token) : '' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Purchase API failed');
      // server returns updated entry (with purchases)
      if (data.entry) setEntry(data.entry);
      setShowPurchase(false);
      setPurchaseForm({ customerName: '', phone: '', price: '', bankId: '' });
      setPurchaseImages([]); setPurchaseDocs([]);
    } catch (err) {
      alert(err.message || 'Purchase failed');
    } finally { setPurchaseLoading(false); }
  }

  // Helpers to prepare WhatsApp message and printable bill
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
    let shopName = '';
    let shopContact = '';
    try {
      const url = new URL((salesUrl || '') + '/api/branches');
      const res = await fetch(url, { headers: { Authorization: token ? ('Bearer ' + token) : '' } });
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
    return { shopName, shopContact };
  }

  function normalizePhone(raw) {
    let digits = (raw || '').toString().replace(/[^0-9]/g, '');
    if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    if (digits.length === 10) digits = '91' + digits;
    return digits;
  }

  async function handleWhatsAppLastPurchase() {
    const p = (entry.purchases || [])[((entry.purchases||[]).length - 1)];
    if (!p) return alert('No purchase found');
    const { shopName, shopContact } = await getBranchInfo();
    const productName = `${entry.mobileName || ''}${entry.model ? (' — ' + entry.model) : ''}`.trim();
    const date = new Date(p.createdAt || Date.now()).toLocaleString();
    const message = `Shop: ${shopName}\nContact: ${shopContact}\n\nProduct: ${productName}\nPrice: ₹ ${Number(p.price||0).toFixed(2)}\nDate: ${date}\nCustomer: ${p.customerName || '-'} — ${p.phone || '-'}\n\nThanks,\n${shopName}`;
    const cust = normalizePhone(p.phone || '');
    try {
      // Open WhatsApp web with prefilled message to customer number
      const whatsappUrl = window.ENV_CONFIG?.WHATSAPP_WEB_URL || 'https://web.whatsapp.com';
      if (cust) window.open(`${whatsappUrl}/send?phone=${cust}&text=${encodeURIComponent(message)}`, '_blank');
      else window.open(whatsappUrl + '/', '_blank');
    } catch (e) { console.error('open whatsapp', e); }
  }

  function handlePrintLastPurchase() {
    const p = (entry.purchases || [])[((entry.purchases||[]).length - 1)];
    if (!p) return alert('No purchase found');
    (async () => {
      const { shopName, shopContact } = await getBranchInfo();
      const productName = `${entry.mobileName || ''}${entry.model ? (' — ' + entry.model) : ''}`.trim();
      const date = new Date(p.createdAt || Date.now()).toLocaleString();
      const total = Number(p.price || 0).toFixed(2);
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt</title><style> @page { size: 72mm auto; margin: 2mm; } body{font-family:monospace,Arial,Helvetica,sans-serif;padding:6px;color:#111; width:72mm; box-sizing:border-box;} h2{margin:0 0 6px;font-size:14px} .shop{ text-align:center; margin-bottom:6px; } .shop strong{ display:block; font-size:12px } .shop .contact{ font-size:11px; margin-top:2px } .date{ font-size:11px; margin-bottom:6px } table{width:100%;border-collapse:collapse;margin-top:6px;font-size:11px} th,td{padding:4px 2px} thead th{border-bottom:1px dashed #bbb; text-align:left; font-size:11px} tbody td{border-bottom:1px dashed #eee} .right{ text-align:right } footer{margin-top:8px;text-align:right;font-weight:700;font-size:12px} .center{ text-align:center }</style></head><body>` +
        `<div class="center"><h2 style="margin:0">TAX INVOICE</h2></div><div class="shop"><strong>${shopName || 'Shop'}</strong><div class="contact">${shopContact || ''}</div></div>` +
        `<div class="date"><strong>Date:</strong> ${date}</div>` +
        `<table><thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Unit</th><th class="right">Line</th></tr></thead><tbody>` +
        `<tr><td style="padding:6px">${productName}</td><td style="text-align:right;padding:6px">1</td><td style="text-align:right;padding:6px">${Number(p.price||0).toFixed(2)}</td><td style="text-align:right;padding:6px">${Number(p.price||0).toFixed(2)}</td></tr>` +
        `</tbody></table>` +
        `<footer>Total: ${total}</footer><div style="margin-top:8px">Thanks for your purchase!</div></body></html>`;
      const w = window.open('', '_blank');
      if (!w) {
        setError('Popup blocked: allow popups to print directly');
        return;
      }
      w.document.open(); w.document.write(html); w.document.close(); w.focus();
      setTimeout(() => { try { w.print(); } catch (e) { /* ignore */ } }, 300);
    })();
  }

  if (loading) return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <div className="card" style={{ 
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
        borderRadius: '12px',
        textAlign: 'center',
        padding: '60px 20px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
        <h3 style={{ margin: '0 0 8px 0', color: '#374151' }}>Loading Entry Details</h3>
        <p style={{ margin: 0, color: '#6b7280' }}>Please wait while we fetch the information...</p>
      </div>
    </div>
  );
  
  if (error) return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <div className="card" style={{ 
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
        borderRadius: '12px',
        textAlign: 'center',
        padding: '60px 20px',
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <h3 style={{ margin: '0 0 8px 0', color: '#dc2626' }}>Error Loading Entry</h3>
        <p style={{ margin: 0, color: '#7f1d1d' }}>{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          style={{ 
            marginTop: '16px',
            padding: '8px 16px',
            backgroundColor: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Try Again
        </button>
      </div>
    </div>
  );
  
  if (!entry) return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <div className="card" style={{ 
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
        borderRadius: '12px',
        textAlign: 'center',
        padding: '60px 20px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📱</div>
        <h3 style={{ margin: '0 0 8px 0', color: '#374151' }}>Entry Not Found</h3>
        <p style={{ margin: '0 0 16px 0', color: '#6b7280' }}>The requested mobile entry could not be found.</p>
        <button 
          onClick={() => { try { location.hash = '#seconds-sales'; } catch {} }}
          style={{ 
            padding: '8px 16px',
            backgroundColor: '#4f46e5',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          ← Back to List
        </button>
      </div>
    </div>
  );

  // Enhanced helper to render file links with better styling
  const fileLinks = (arr) => (arr || []).map((f, i) => {
    const filename = f.filename || (f.path ? f.path.split(/[\\/]/).pop() : null);
    const base = (salesUrl || '').replace(/\/+$/, '') || '';
    const url = filename ? `${base}/uploads/seconds-sales/${filename}` : (f.path || '#');
    const isPdf = (filename || '').toLowerCase().endsWith('.pdf');
    const isImage = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(filename || '');
    
    const getFileIcon = () => {
      if (isPdf) return '📄';
      if (isImage) return '🖼️';
      return '📁';
    };
    
    return (
      <div key={i} style={{ marginBottom: '8px' }}>
        <a 
          href={url} 
          target="_blank" 
          rel="noreferrer" 
          type={isPdf ? 'application/pdf' : undefined}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            backgroundColor: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            textDecoration: 'none',
            color: '#374151',
            fontSize: '13px',
            fontWeight: '500',
            transition: 'all 0.2s ease',
            maxWidth: '100%',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#e5e7eb';
            e.target.style.borderColor = '#9ca3af';
            e.target.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#f3f4f6';
            e.target.style.borderColor = '#d1d5db';
            e.target.style.transform = 'translateY(0px)';
          }}
        >
          <span style={{ fontSize: '14px' }}>{getFileIcon()}</span>
          <span style={{ 
            overflow: 'hidden', 
            textOverflow: 'ellipsis', 
            whiteSpace: 'nowrap',
            maxWidth: '200px'
          }}>
            {f.originalName || filename || 'file'}
          </span>
          <span style={{ fontSize: '12px', opacity: 0.7 }}>↗</span>
        </a>
      </div>
    );
  });

  // Helper to render file links for purchases
  const purchaseFileLinks = fileLinks;

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <div className="card" style={{ 
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
        borderRadius: '12px', 
        border: '1px solid #e1e5e9',
        background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
        overflow: 'hidden'
      }}>
        <div style={{ 
          padding: '24px 32px', 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ 
              margin: 0, 
              fontSize: '24px', 
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              📱 {entry.mobileName || 'Mobile Entry'} Details
            </h3>
            <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: '14px' }}>
              Complete information and purchase history
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={() => { try { location.hash = '#seconds-sales'; } catch {} }}
              style={{
                padding: '10px 20px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = 'rgba(255,255,255,0.3)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'rgba(255,255,255,0.2)';
              }}
            >
              ← Back to List
            </button>
            <button 
              onClick={() => setShowPurchase(true)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#16a34a',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#15803d';
                e.target.style.transform = 'translateY(-1px)';
                e.target.style.boxShadow = '0 4px 12px rgba(22, 163, 74, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#16a34a';
                e.target.style.transform = 'translateY(0px)';
                e.target.style.boxShadow = '0 2px 8px rgba(22, 163, 74, 0.3)';
              }}
            >
              💰 Record Purchase
            </button>
          </div>
        </div>

        <div style={{ padding: '32px' }}>
          {/* Mobile Device Information */}
          <div style={{ 
            marginBottom: '32px', 
            padding: '24px', 
            backgroundColor: '#f8fafc', 
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <h4 style={{ 
              margin: '0 0 20px 0', 
              color: '#2d3748', 
              fontSize: '18px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              📋 Device Information
            </h4>
            <div className="row" style={{ gap: '24px', marginBottom: '16px' }}>
              <div className="col" style={{ minWidth: '250px' }}>
                <div style={{ 
                  fontSize: '12px', 
                  fontWeight: '600', 
                  color: '#6b7280', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px',
                  marginBottom: '6px'
                }}>Model</div>
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: '500', 
                  color: '#111827',
                  padding: '8px 0'
                }}>{entry.model || 'Not specified'}</div>
              </div>
              <div className="col" style={{ minWidth: '250px' }}>
                <div style={{ 
                  fontSize: '12px', 
                  fontWeight: '600', 
                  color: '#6b7280', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px',
                  marginBottom: '6px'
                }}>IMEI Number</div>
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: '500', 
                  color: '#111827',
                  padding: '8px 12px',
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb',
                  fontFamily: 'monospace'
                }}>{entry.imeNo || 'Not available'}</div>
              </div>
            </div>
            <div className="row" style={{ gap: '24px' }}>
              <div className="col" style={{ minWidth: '250px' }}>
                <div style={{ 
                  fontSize: '12px', 
                  fontWeight: '600', 
                  color: '#6b7280', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px',
                  marginBottom: '6px'
                }}>Specification</div>
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: '500', 
                  color: '#111827',
                  padding: '8px 0'
                }}>{entry.specification || 'Not specified'}</div>
              </div>
              <div className="col" style={{ minWidth: '250px' }}>
                <div style={{ 
                  fontSize: '12px', 
                  fontWeight: '600', 
                  color: '#6b7280', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px',
                  marginBottom: '6px'
                }}>Condition</div>
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: '500', 
                  color: '#111827',
                  padding: '8px 0'
                }}>{entry.mobileCondition || 'Not specified'}</div>
              </div>
            </div>
          </div>

          {/* Seller Information */}
          <div style={{ 
            marginBottom: '32px', 
            padding: '24px', 
            backgroundColor: '#fef7f0', 
            borderRadius: '8px',
            border: '1px solid #fed7aa'
          }}>
            <h4 style={{ 
              margin: '0 0 20px 0', 
              color: '#ea580c', 
              fontSize: '18px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              👤 Seller Information
            </h4>
            <div className="row" style={{ gap: '24px', marginBottom: '16px' }}>
              <div className="col" style={{ minWidth: '250px' }}>
                <div style={{ 
                  fontSize: '12px', 
                  fontWeight: '600', 
                  color: '#6b7280', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px',
                  marginBottom: '6px'
                }}>Seller Name</div>
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: '500', 
                  color: '#111827',
                  padding: '8px 0'
                }}>{entry.sellerName || 'Not provided'}</div>
              </div>
              <div className="col" style={{ minWidth: '350px' }}>
                <div style={{ 
                  fontSize: '12px', 
                  fontWeight: '600', 
                  color: '#6b7280', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px',
                  marginBottom: '6px'
                }}>Address</div>
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: '500', 
                  color: '#111827',
                  padding: '8px 0'
                }}>{entry.sellerAddress || 'Not provided'}</div>
              </div>
            </div>
            <div className="row" style={{ gap: '24px' }}>
              <div className="col" style={{ minWidth: '250px' }}>
                <div style={{ 
                  fontSize: '12px', 
                  fontWeight: '600', 
                  color: '#6b7280', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px',
                  marginBottom: '6px'
                }}>Reference Contact</div>
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: '500', 
                  color: '#111827',
                  padding: '8px 0'
                }}>{(entry.referenceName || 'Not provided') + (entry.referenceNumber ? (' — ' + entry.referenceNumber) : '')}</div>
              </div>
              <div className="col" style={{ minWidth: '250px' }}>
                <div style={{ 
                  fontSize: '12px', 
                  fontWeight: '600', 
                  color: '#6b7280', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px',
                  marginBottom: '6px'
                }}>Reason for Sale</div>
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: '500', 
                  color: '#111827',
                  padding: '8px 0'
                }}>{entry.reasonForSale || 'Not provided'}</div>
              </div>
            </div>
          </div>

          {/* Payment & Proof */}
          <div style={{ 
            marginBottom: '32px', 
            padding: '24px', 
            backgroundColor: '#f0fdf4', 
            borderRadius: '8px',
            border: '1px solid #bbf7d0'
          }}>
            <h4 style={{ 
              margin: '0 0 20px 0', 
              color: '#15803d', 
              fontSize: '18px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              💰 Payment & Verification
            </h4>
            <div className="row" style={{ gap: '24px' }}>
              <div className="col" style={{ minWidth: '250px' }}>
                <div style={{ 
                  fontSize: '12px', 
                  fontWeight: '600', 
                  color: '#6b7280', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px',
                  marginBottom: '6px'
                }}>Proof Details</div>
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: '500', 
                  color: '#111827',
                  padding: '8px 0'
                }}>{(entry.proofType || 'Not provided') + (entry.proofNo ? (' — ' + entry.proofNo) : '')}</div>
              </div>
              <div className="col" style={{ minWidth: '250px' }}>
                <div style={{ 
                  fontSize: '12px', 
                  fontWeight: '600', 
                  color: '#6b7280', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px',
                  marginBottom: '6px'
                }}>Purchase Value</div>
                <div style={{ 
                  fontSize: '24px', 
                  fontWeight: '700', 
                  color: '#059669',
                  padding: '8px 0'
                }}>₹{Number(entry.valueOfProduct || 0).toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Attachments */}
          <div style={{ 
            padding: '24px', 
            backgroundColor: '#faf5ff', 
            borderRadius: '8px',
            border: '1px solid #d8b4fe'
          }}>
            <h4 style={{ 
              margin: '0 0 20px 0', 
              color: '#7c3aed', 
              fontSize: '18px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              📎 Attached Files
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              <div>
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: '#374151',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>📸 Images ({(entry.images || []).length})</div>
                <div style={{ 
                  minHeight: '60px',
                  padding: '12px',
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb'
                }}>
                  {(entry.images || []).length > 0 ? fileLinks(entry.images) : (
                    <div style={{ color: '#9ca3af', fontSize: '14px' }}>No images attached</div>
                  )}
                </div>
              </div>
              <div>
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: '#374151',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>📄 Documents ({(entry.documents || []).length})</div>
                <div style={{ 
                  minHeight: '60px',
                  padding: '12px',
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb'
                }}>
                  {(entry.documents || []).length > 0 ? fileLinks(entry.documents) : (
                    <div style={{ color: '#9ca3af', fontSize: '14px' }}>No documents attached</div>
                  )}
                </div>
              </div>
              <div>
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: '#374151',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>✍️ Signatures ({(entry.signatures || []).length})</div>
                <div style={{ 
                  minHeight: '60px',
                  padding: '12px',
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb'
                }}>
                  {(entry.signatures || []).length > 0 ? fileLinks(entry.signatures) : (
                    <div style={{ color: '#9ca3af', fontSize: '14px' }}>No signatures attached</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Purchases Section */}
      <div className="card" style={{ 
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
        borderRadius: '12px', 
        border: '1px solid #e1e5e9',
        marginTop: '24px',
        overflow: 'hidden'
      }}>
        <div style={{ 
          padding: '24px 32px', 
          background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
          color: 'white',
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center'
        }}>
          <div>
            <h4 style={{ 
              margin: 0, 
              fontSize: '20px', 
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              🧾 Purchase History
            </h4>
            <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: '14px' }}>
              Track all sales for this mobile device
            </p>
          </div>
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.2)',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: '600'
          }}>
            {(entry.purchases || []).length} Record{(entry.purchases || []).length !== 1 ? 's' : ''}
          </div>
        </div>
        
        <div style={{ padding: '32px' }}>
          {(entry.purchases || []).length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#6b7280',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              border: '2px dashed #d1d5db'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🧾</div>
              <h4 style={{ margin: '0 0 8px 0', color: '#374151' }}>No Purchases Yet</h4>
              <p style={{ margin: '0 0 16px 0', fontSize: '14px' }}>
                This mobile device is still available for sale. Use the "Record Purchase" button above to add a sale.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {(entry.purchases || []).map((p, idx) => (
                <div key={idx} style={{
                  border: '2px solid #fecaca',
                  borderRadius: '12px',
                  backgroundColor: '#fef2f2',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease'
                }}>
                  {/* Purchase Header */}
                  <div style={{
                    padding: '16px 20px',
                    backgroundColor: '#fee2e2',
                    borderBottom: '1px solid #fecaca',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{
                        backgroundColor: '#dc2626',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        SOLD #{idx + 1}
                      </span>
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>
                          {p.customerName || 'Unknown Customer'}
                        </div>
                        <div style={{ fontSize: '14px', color: '#6b7280' }}>
                          {p.phone || 'No phone number'}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      fontSize: '20px',
                      fontWeight: '700',
                      color: '#dc2626'
                    }}>
                      ₹{Number(p.price || 0).toFixed(2)}
                    </div>
                  </div>
                  
                  {/* Purchase Details */}
                  <div style={{ padding: '20px' }}>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                      gap: '16px' 
                    }}>
                      <div>
                        <div style={{ 
                          fontSize: '12px', 
                          fontWeight: '600', 
                          color: '#6b7280', 
                          textTransform: 'uppercase',
                          marginBottom: '8px'
                        }}>📄 Documents ({(p.documents || []).length})</div>
                        <div style={{
                          minHeight: '40px',
                          padding: '8px',
                          backgroundColor: 'white',
                          borderRadius: '6px',
                          border: '1px solid #fecaca'
                        }}>
                          {(p.documents || []).length > 0 ? purchaseFileLinks(p.documents) : (
                            <div style={{ color: '#9ca3af', fontSize: '14px' }}>No documents</div>
                          )}
                        </div>
                      </div>
                      <div>
                        <div style={{ 
                          fontSize: '12px', 
                          fontWeight: '600', 
                          color: '#6b7280', 
                          textTransform: 'uppercase',
                          marginBottom: '8px'
                        }}>📸 Images ({(p.images || []).length})</div>
                        <div style={{
                          minHeight: '40px',
                          padding: '8px',
                          backgroundColor: 'white',
                          borderRadius: '6px',
                          border: '1px solid #fecaca'
                        }}>
                          {(p.images || []).length > 0 ? purchaseFileLinks(p.images) : (
                            <div style={{ color: '#9ca3af', fontSize: '14px' }}>No images</div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ 
                      marginTop: '12px',
                      fontSize: '12px',
                      color: '#6b7280',
                      textAlign: 'right'
                    }}>
                      Sold on {new Date(p.createdAt || Date.now()).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Action Buttons */}
          {(entry.purchases || []).length > 0 ? (
            <div style={{ 
              marginTop: '24px', 
              paddingTop: '24px',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button 
                onClick={handleWhatsAppLastPurchase}
                style={{
                  padding: '12px 20px',
                  backgroundColor: '#25D366',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#1DA851';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#25D366';
                  e.target.style.transform = 'translateY(0px)';
                }}
              >
                💬 Send WhatsApp
              </button>
              <button 
                onClick={handlePrintLastPurchase}
                style={{
                  padding: '12px 20px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#374151';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#6b7280';
                  e.target.style.transform = 'translateY(0px)';
                }}
              >
                🖨️ Print Receipt
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Enhanced Purchase Modal */}
      {showPurchase ? (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            border: '1px solid #e5e7eb'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '24px 32px',
              background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
              color: 'white',
              borderRadius: '16px 16px 0 0',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <h4 style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                💰 Record New Purchase
              </h4>
              <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: '14px' }}>
                Enter customer details and sale information
              </p>
            </div>

            <form onSubmit={submitPurchase} style={{ padding: '32px' }}>
              {/* Customer Information */}
              <div style={{ marginBottom: '24px' }}>
                <h5 style={{
                  margin: '0 0 16px 0',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#374151',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  👤 Customer Information
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontWeight: '500',
                      color: '#374151',
                      fontSize: '14px'
                    }}>Customer Name *</label>
                    <input 
                      name="customerName" 
                      value={purchaseForm.customerName} 
                      onChange={purchaseOnChange}
                      required
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '14px',
                        transition: 'all 0.2s ease'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#16a34a'}
                      onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                    />
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontWeight: '500',
                      color: '#374151',
                      fontSize: '14px'
                    }}>Phone Number</label>
                    <input 
                      name="phone" 
                      value={purchaseForm.phone} 
                      onChange={purchaseOnChange}
                      type="tel"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '14px',
                        transition: 'all 0.2s ease'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#16a34a'}
                      onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                    />
                  </div>
                </div>
              </div>

              {/* Payment Information */}
              <div style={{ marginBottom: '24px' }}>
                <h5 style={{
                  margin: '0 0 16px 0',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#374151',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  💳 Payment Details
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontWeight: '500',
                      color: '#374151',
                      fontSize: '14px'
                    }}>Sale Price (₹) *</label>
                    <input 
                      name="price" 
                      value={purchaseForm.price} 
                      onChange={purchaseOnChange}
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '14px',
                        transition: 'all 0.2s ease'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#16a34a'}
                      onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                    />
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontWeight: '500',
                      color: '#374151',
                      fontSize: '14px'
                    }}>Credit to Bank Account *</label>
                    <select 
                      name="bankId" 
                      value={purchaseForm.bankId} 
                      onChange={purchaseOnChange} 
                      required
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '14px',
                        backgroundColor: 'white',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#16a34a'}
                      onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                    >
                      <option value="">Select bank account</option>
                      {banks.map(b => (
                        <option key={b._id} value={b._id}>
                          {b.bankName} — ₹{Number(b.accountBalance||0).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* File Attachments */}
              <div style={{ marginBottom: '32px' }}>
                <h5 style={{
                  margin: '0 0 16px 0',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#374151',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  📎 Attachments (Optional)
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontWeight: '500',
                      color: '#374151',
                      fontSize: '14px'
                    }}>📄 Documents</label>
                    <input 
                      type="file" 
                      accept="application/pdf,image/*" 
                      multiple 
                      onChange={(e) => filesToBase64(e.target.files, setPurchaseDocs)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px dashed #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        backgroundColor: '#f9fafb',
                        cursor: 'pointer'
                      }}
                    />
                    {purchaseDocs.length > 0 && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#16a34a' }}>
                        ✓ {purchaseDocs.length} document{purchaseDocs.length !== 1 ? 's' : ''} selected
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontWeight: '500',
                      color: '#374151',
                      fontSize: '14px'
                    }}>📸 Photos</label>
                    <input 
                      type="file" 
                      accept="image/*" 
                      multiple 
                      onChange={(e) => filesToBase64(e.target.files, setPurchaseImages)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px dashed #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        backgroundColor: '#f9fafb',
                        cursor: 'pointer'
                      }}
                    />
                    {purchaseImages.length > 0 && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#16a34a' }}>
                        ✓ {purchaseImages.length} image{purchaseImages.length !== 1 ? 's' : ''} selected
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                justifyContent: 'flex-end',
                paddingTop: '20px',
                borderTop: '1px solid #e5e7eb'
              }}>
                <button 
                  type="button" 
                  onClick={() => setShowPurchase(false)}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#e5e7eb';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = '#f3f4f6';
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={purchaseLoading}
                  style={{
                    padding: '12px 32px',
                    backgroundColor: purchaseLoading ? '#9ca3af' : '#16a34a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: purchaseLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    if (!purchaseLoading) {
                      e.target.style.backgroundColor = '#15803d';
                      e.target.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!purchaseLoading) {
                      e.target.style.backgroundColor = '#16a34a';
                      e.target.style.transform = 'translateY(0px)';
                    }
                  }}
                >
                  {purchaseLoading ? '⏳ Recording Sale...' : '💾 Record Purchase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

window.SecondsSalesView = SecondsSalesView;

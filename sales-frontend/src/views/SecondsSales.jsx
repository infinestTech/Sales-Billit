function SecondsSales({ salesUrl, token }) {
  const [form, setForm] = React.useState({
    mobileName: '', model: '', imeNo: '', specification: '', mobileCondition: '', colour: '', sellerName: '', sellerAddress: '', referenceName: '', referenceNumber: '', reasonForSale: '', proofType: '', proofNo: '', valueOfProduct: '', paymentMethod: ''
  });
  const [images, setImages] = React.useState([]);
  const [documents, setDocuments] = React.useState([]);
  const [signatures, setSignatures] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [entries, setEntries] = React.useState([]);
  const [mobileNameFilter, setMobileNameFilter] = React.useState('');
  const [modelFilter, setModelFilter] = React.useState('');

  async function loadEntries() {
    try {
      const res = await fetch((salesUrl || '') + '/api/seconds-sales', { headers: { Authorization: token ? ('Bearer ' + token) : '' } });
      console.log("sales",res);
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load');
      setEntries(Array.isArray(data.rows) ? data.rows : []);
    } catch (err) {
      console.error('loadEntries error', err);
    }
  }

  React.useEffect(() => { loadEntries(); }, []);

  function onChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleFiles(e, setter) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setLoading(true);
    try {
      const arr = await Promise.all(files.map(async f => ({ name: f.name, base64: await toBase64(f) })));
      setter(prev => [...prev, ...arr]);
    } catch (err) {
      console.error(err);
      setError('Failed to read files');
    } finally { setLoading(false); }
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
  const payload = { ...form, images, documents, signatures };
      const res = await fetch((salesUrl || '') + '/api/seconds-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token ? ('Bearer ' + token) : '' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Save failed');
      setSuccess('Saved successfully');
      setForm({ mobileName: '', model: '', imeNo: '', specification: '', mobileCondition: '', colour: '', sellerName: '', sellerAddress: '', referenceName: '', referenceNumber: '', reasonForSale: '', proofType: '', proofNo: '', valueOfProduct: '', paymentMethod: '' });
  setImages([]); setDocuments([]); setSignatures([]);
  await loadEntries();
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally { setLoading(false); }
  }

  // Filtering logic for entries
  const filteredEntries = React.useMemo(() => {
    return entries.filter(r => {
      return (
        (!mobileNameFilter || (r.mobileName || '').toLowerCase().includes(mobileNameFilter.toLowerCase())) &&
        (!modelFilter || (r.model || '').toLowerCase().includes(modelFilter.toLowerCase()))
      );
    });
  }, [entries, mobileNameFilter, modelFilter]);

  // Helper to check if a mobile is sold
  function isSold(entry) {
    return Array.isArray(entry.purchases) && entry.purchases.length > 0;
  }

  // Sort: unsold first, sold last
  const sortedEntries = [
    ...filteredEntries.filter(e => !isSold(e)),
    ...filteredEntries.filter(e => isSold(e))
  ];

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <div className="card" style={{ 
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
        borderRadius: '12px', 
        border: '1px solid #e1e5e9',
        background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)'
      }}>
        <div style={{ 
          padding: '24px 32px', 
          borderBottom: '2px solid #e1e5e9', 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderRadius: '12px 12px 0 0',
          marginBottom: '32px'
        }}>
          <h3 style={{ 
            margin: 0, 
            fontSize: '24px', 
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            📱 Seconds Sales - Create New Entry
          </h3>
          <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: '14px' }}>
            Fill in the mobile device details and seller information
          </p>
        </div>
        
        <form onSubmit={submit} style={{ padding: '0 32px 32px 32px' }}>
          {/* Mobile Details Section */}
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
              📋 Mobile Device Information
            </h4>
            <div className="row" style={{ gap: '16px' }}>
              <div className="col" style={{ minWidth: '200px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontWeight: '500', 
                  color: '#374151',
                  fontSize: '14px'
                }}>Mobile Name *</label>
                <input 
                  name="mobileName" 
                  value={form.mobileName} 
                  onChange={onChange}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    backgroundColor: 'white'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>
              <div className="col" style={{ minWidth: '200px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontWeight: '500', 
                  color: '#374151',
                  fontSize: '14px'
                }}>Model *</label>
                <input 
                  name="model" 
                  value={form.model} 
                  onChange={onChange}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    backgroundColor: 'white'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>
              <div className="col" style={{ minWidth: '200px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontWeight: '500', 
                  color: '#374151',
                  fontSize: '14px'
                }}>IMEI Number</label>
                <input 
                  name="imeNo" 
                  value={form.imeNo} 
                  onChange={onChange}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    backgroundColor: 'white'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>
            </div>
            <div className="row mt-2" style={{ gap: '16px', marginTop: '16px' }}>
              <div className="col" style={{ minWidth: '200px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontWeight: '500', 
                  color: '#374151',
                  fontSize: '14px'
                }}>Specification</label>
                <input 
                  name="specification" 
                  value={form.specification} 
                  onChange={onChange}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    backgroundColor: 'white'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>
              <div className="col" style={{ minWidth: '200px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontWeight: '500', 
                  color: '#374151',
                  fontSize: '14px'
                }}>Condition</label>
                <input 
                  name="mobileCondition" 
                  value={form.mobileCondition} 
                  onChange={onChange}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    backgroundColor: 'white'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>
              <div className="col" style={{ minWidth: '200px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontWeight: '500', 
                  color: '#374151',
                  fontSize: '14px'
                }}>Color</label>
                <input 
                  name="colour" 
                  value={form.colour} 
                  onChange={onChange}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    backgroundColor: 'white'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>
            </div>
          </div>

          {/* Seller Information Section */}
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
            <div className="row" style={{ gap: '16px' }}>
              <div className="col" style={{ minWidth: '200px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontWeight: '500', 
                  color: '#374151',
                  fontSize: '14px'
                }}>Seller Name *</label>
                <input 
                  name="sellerName" 
                  value={form.sellerName} 
                  onChange={onChange}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #fed7aa',
                    borderRadius: '8px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    backgroundColor: 'white'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#ea580c'}
                  onBlur={(e) => e.target.style.borderColor = '#fed7aa'}
                />
              </div>
              <div className="col" style={{ minWidth: '300px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontWeight: '500', 
                  color: '#374151',
                  fontSize: '14px'
                }}>Seller Address</label>
                <input 
                  name="sellerAddress" 
                  value={form.sellerAddress} 
                  onChange={onChange}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #fed7aa',
                    borderRadius: '8px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    backgroundColor: 'white'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#ea580c'}
                  onBlur={(e) => e.target.style.borderColor = '#fed7aa'}
                />
              </div>
              <div className="col" style={{ minWidth: '200px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontWeight: '500', 
                  color: '#374151',
                  fontSize: '14px'
                }}>Reason for Sale</label>
                <input 
                  name="reasonForSale" 
                  value={form.reasonForSale} 
                  onChange={onChange}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #fed7aa',
                    borderRadius: '8px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    backgroundColor: 'white'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#ea580c'}
                  onBlur={(e) => e.target.style.borderColor = '#fed7aa'}
                />
              </div>
            </div>
            <div className="row mt-2" style={{ gap: '16px', marginTop: '16px' }}>
              <div className="col" style={{ minWidth: '200px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontWeight: '500', 
                  color: '#374151',
                  fontSize: '14px'
                }}>Reference Name</label>
                <input 
                  name="referenceName" 
                  value={form.referenceName} 
                  onChange={onChange}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #fed7aa',
                    borderRadius: '8px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    backgroundColor: 'white'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#ea580c'}
                  onBlur={(e) => e.target.style.borderColor = '#fed7aa'}
                />
              </div>
              <div className="col" style={{ minWidth: '200px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontWeight: '500', 
                  color: '#374151',
                  fontSize: '14px'
                }}>Reference Number</label>
                <input 
                  name="referenceNumber" 
                  value={form.referenceNumber} 
                  onChange={onChange}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #fed7aa',
                    borderRadius: '8px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    backgroundColor: 'white'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#ea580c'}
                  onBlur={(e) => e.target.style.borderColor = '#fed7aa'}
                />
              </div>
              <div className="col" style={{ minWidth: '200px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontWeight: '500', 
                  color: '#374151',
                  fontSize: '14px'
                }}>Proof Type</label>
                <input 
                  name="proofType" 
                  value={form.proofType} 
                  onChange={onChange}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #fed7aa',
                    borderRadius: '8px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    backgroundColor: 'white'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#ea580c'}
                  onBlur={(e) => e.target.style.borderColor = '#fed7aa'}
                />
              </div>
            </div>
          </div>


          {/* Payment & Proof Section */}
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
              💰 Payment & Proof Details
            </h4>
            <div className="row" style={{ gap: '16px' }}>
              <div className="col" style={{ minWidth: '200px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontWeight: '500', 
                  color: '#374151',
                  fontSize: '14px'
                }}>Proof Number</label>
                <input 
                  name="proofNo" 
                  value={form.proofNo} 
                  onChange={onChange}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #bbf7d0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    backgroundColor: 'white'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#15803d'}
                  onBlur={(e) => e.target.style.borderColor = '#bbf7d0'}
                />
              </div>
              <div className="col" style={{ minWidth: '200px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontWeight: '500', 
                  color: '#374151',
                  fontSize: '14px'
                }}>Price (₹) *</label>
                <input 
                  name="valueOfProduct" 
                  value={form.valueOfProduct} 
                  onChange={onChange}
                  type="number"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #bbf7d0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    backgroundColor: 'white'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#15803d'}
                  onBlur={(e) => e.target.style.borderColor = '#bbf7d0'}
                />
              </div>
              <div className="col" style={{ minWidth: '250px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontWeight: '500', 
                  color: '#374151',
                  fontSize: '14px'
                }}>Payment Method *</label>
                <select 
                  name="paymentMethod" 
                  value={form.paymentMethod} 
                  onChange={onChange}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #bbf7d0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    backgroundColor: 'white',
                    cursor: 'pointer'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#15803d'}
                  onBlur={(e) => e.target.style.borderColor = '#bbf7d0'}
                >
                  <option value="">Select payment method</option>
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
                </select>
              </div>
            </div>
          </div>

          {/* File Upload Section */}
          <div style={{ 
            marginBottom: '32px', 
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
              📎 File Attachments
            </h4>
            <div className="row" style={{ gap: '16px' }}>
              <div className="col" style={{ minWidth: '250px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '500', 
                  color: '#374151',
                  fontSize: '14px'
                }}>📸 Images (Photos)</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple 
                  onChange={e => handleFiles(e, setImages)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px dashed #d8b4fe',
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: 'white',
                    cursor: 'pointer'
                  }}
                />
                {images.length > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#7c3aed' }}>
                    ✓ {images.length} image{images.length !== 1 ? 's' : ''} selected
                  </div>
                )}
              </div>
              <div className="col" style={{ minWidth: '250px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '500', 
                  color: '#374151',
                  fontSize: '14px'
                }}>📄 Documents (Proof)</label>
                <input 
                  type="file" 
                  accept="application/pdf,image/*" 
                  multiple 
                  onChange={e => handleFiles(e, setDocuments)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px dashed #d8b4fe',
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: 'white',
                    cursor: 'pointer'
                  }}
                />
                {documents.length > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#7c3aed' }}>
                    ✓ {documents.length} document{documents.length !== 1 ? 's' : ''} selected
                  </div>
                )}
              </div>
              <div className="col" style={{ minWidth: '250px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '500', 
                  color: '#374151',
                  fontSize: '14px'
                }}>✍️ Signatures</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple 
                  onChange={e => handleFiles(e, setSignatures)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px dashed #d8b4fe',
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: 'white',
                    cursor: 'pointer'
                  }}
                />
                {signatures.length > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#7c3aed' }}>
                    ✓ {signatures.length} signature{signatures.length !== 1 ? 's' : ''} selected
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            justifyContent: 'flex-end',
            paddingTop: '20px',
            borderTop: '1px solid #e5e7eb'
          }}>
            <button 
              className="btn secondary" 
              type="button" 
              style={{
                padding: '12px 24px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: '2px solid #d1d5db',
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
                e.target.style.backgroundColor = '#e5e7eb';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#f3f4f6';
                e.target.style.transform = 'translateY(0px)';
              }}
              onClick={() => { 
                setForm({ 
                  mobileName: '', model: '', imeNo: '', specification: '', mobileCondition: '', 
                  colour: '', sellerName: '', sellerAddress: '', referenceName: '', referenceNumber: '', 
                  reasonForSale: '', proofType: '', proofNo: '', valueOfProduct: '', paymentMethod: '' 
                }); 
                setImages([]); 
                setDocuments([]); 
                setSignatures([]); 
              }}
            >
              🔄 Reset Form
            </button>
            <button 
              className="btn" 
              type="submit" 
              disabled={loading}
              style={{
                padding: '12px 32px',
                backgroundColor: loading ? '#9ca3af' : '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.target.style.backgroundColor = '#5b21b6';
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.6)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.target.style.backgroundColor = '#667eea';
                  e.target.style.transform = 'translateY(0px)';
                  e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                }
              }}
            >
              {loading ? '⏳ Saving...' : '💾 Save Entry'}
            </button>
          </div>

          {/* Status Messages */}
          {error ? (
            <div style={{
              marginTop: '16px',
              padding: '12px 16px',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              ⚠️ {error}
            </div>
          ) : null}
          {success ? (
            <div style={{
              marginTop: '16px',
              padding: '12px 16px',
              backgroundColor: '#f0fdf4',
              color: '#16a34a',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              ✅ {success}
            </div>
          ) : null}
        </form>
      </div>

      {/* <div className="card mt-3 table-card">
  <div className="table-title">Selected Files</div>
        <div style={{padding:12}}>
          <div>
            <strong>Images:</strong>
            <ul>{images.map((f,i) => <li key={i}>{f.name}</li>)}</ul>
          </div>
          <div>
            <strong>Documents:</strong>
            <ul>{documents.map((f,i) => <li key={i}>{f.name}</li>)}</ul>
          </div>
          <div>
            <strong>Signatures:</strong>
            <ul>{signatures.map((f,i) => <li key={i}>{f.name}</li>)}</ul>
          </div>
        </div>
      </div> */}

      <div className="card mt-3 table-card" style={{ 
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
        borderRadius: '12px', 
        border: '1px solid #e1e5e9',
        marginTop: '32px'
      }}>
        <div style={{ 
          padding: '24px 32px', 
          borderBottom: '2px solid #e1e5e9', 
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          color: 'white',
          borderRadius: '12px 12px 0 0',
          marginBottom: 0
        }}>
          <h3 style={{ 
            margin: 0, 
            fontSize: '20px', 
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            📊 Saved Entries ({sortedEntries.length})
          </h3>
          <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: '14px' }}>
            Manage and view all mobile device entries
          </p>
        </div>
        
        {/* Enhanced Filter Section */}
        <div style={{ 
          padding: '24px 32px',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0'
        }}>
          <div style={{ 
            display: 'flex', 
            gap: '16px', 
            flexWrap: 'wrap', 
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>🔍 Filters:</span>
            </div>
            <div>
              <input 
                type="text" 
                placeholder="Search by Mobile Name..." 
                value={mobileNameFilter} 
                onChange={e => setMobileNameFilter(e.target.value)}
                style={{ 
                  padding: '10px 16px', 
                  width: '200px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = '#4f46e5'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>
            <div>
              <input 
                type="text" 
                placeholder="Search by Model..." 
                value={modelFilter} 
                onChange={e => setModelFilter(e.target.value)}
                style={{ 
                  padding: '10px 16px', 
                  width: '200px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = '#4f46e5'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>
            {(mobileNameFilter || modelFilter) && (
              <button
                onClick={() => { setMobileNameFilter(''); setModelFilter(''); }}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#fee2e2',
                  color: '#dc2626',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                ✕ Clear
              </button>
            )}
          </div>
        </div>
        <div className="table-scroll" style={{ padding: '0 32px 32px 32px' }}>
          {sortedEntries.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#6b7280',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              border: '2px dashed #d1d5db'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📱</div>
              <h4 style={{ margin: '0 0 8px 0', color: '#374151' }}>No Entries Found</h4>
              <p style={{ margin: 0, fontSize: '14px' }}>
                {(mobileNameFilter || modelFilter) 
                  ? 'Try adjusting your search filters' 
                  : 'Start by creating your first mobile entry above'
                }
              </p>
            </div>
          ) : (
            <table className="modern-table" style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              backgroundColor: 'white',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={{ 
                    padding: '16px 12px', 
                    textAlign: 'left', 
                    fontWeight: '600', 
                    color: '#374151',
                    fontSize: '14px',
                    borderBottom: '2px solid #e5e7eb'
                  }}>#</th>
                  <th style={{ 
                    padding: '16px 12px', 
                    textAlign: 'left', 
                    fontWeight: '600', 
                    color: '#374151',
                    fontSize: '14px',
                    borderBottom: '2px solid #e5e7eb'
                  }}>Mobile Info</th>
                  <th style={{ 
                    padding: '16px 12px', 
                    textAlign: 'left', 
                    fontWeight: '600', 
                    color: '#374151',
                    fontSize: '14px',
                    borderBottom: '2px solid #e5e7eb'
                  }}>IMEI</th>
                  <th style={{ 
                    padding: '16px 12px', 
                    textAlign: 'left', 
                    fontWeight: '600', 
                    color: '#374151',
                    fontSize: '14px',
                    borderBottom: '2px solid #e5e7eb'
                  }}>Seller</th>
                  <th style={{ 
                    padding: '16px 12px', 
                    textAlign: 'right', 
                    fontWeight: '600', 
                    color: '#374151',
                    fontSize: '14px',
                    borderBottom: '2px solid #e5e7eb'
                  }}>Price</th>
                  <th style={{ 
                    padding: '16px 12px', 
                    textAlign: 'center', 
                    fontWeight: '600', 
                    color: '#374151',
                    fontSize: '14px',
                    borderBottom: '2px solid #e5e7eb'
                  }}>Files</th>
                  <th style={{ 
                    padding: '16px 12px', 
                    textAlign: 'left', 
                    fontWeight: '600', 
                    color: '#374151',
                    fontSize: '14px',
                    borderBottom: '2px solid #e5e7eb'
                  }}>Date</th>
                  <th style={{ 
                    padding: '16px 12px', 
                    textAlign: 'center', 
                    fontWeight: '600', 
                    color: '#374151',
                    fontSize: '14px',
                    borderBottom: '2px solid #e5e7eb'
                  }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map((r, i) => (
                  <tr 
                    key={r._id || i} 
                    style={{
                      backgroundColor: isSold(r) ? '#fef2f2' : 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      borderBottom: '1px solid #f3f4f6'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isSold(r) ? '#fee2e2' : '#f8fafc';
                      e.currentTarget.style.transform = 'translateX(2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isSold(r) ? '#fef2f2' : 'white';
                      e.currentTarget.style.transform = 'translateX(0px)';
                    }}
                    onClick={() => { try { location.hash = '#seconds-sales-view-' + (r._id || i); } catch {} }}
                  >
                    <td style={{ padding: '16px 12px' }}>
                      <span style={{
                        display: 'inline-block',
                        backgroundColor: '#4f46e5',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600',
                        minWidth: '24px',
                        textAlign: 'center'
                      }}>
                        {i + 1}
                      </span>
                    </td>
                    <td style={{ padding: '16px 12px' }}>
                      <div>
                        <div style={{ fontWeight: '600', color: '#111827', marginBottom: '2px' }}>
                          {r.mobileName || '-'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          {r.model || 'Model not specified'}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 12px', fontSize: '14px', color: '#374151' }}>
                      <code style={{ 
                        backgroundColor: '#f3f4f6', 
                        padding: '2px 6px', 
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        {r.imeNo || '-'}
                      </code>
                    </td>
                    <td style={{ padding: '16px 12px', fontSize: '14px', color: '#374151' }}>
                      {r.sellerName || '-'}
                    </td>
                    <td style={{ padding: '16px 12px', textAlign: 'right' }}>
                      <span style={{
                        fontWeight: '600',
                        color: '#059669',
                        fontSize: '16px'
                      }}>
                        ₹{Number(r.valueOfProduct || 0).toFixed(2)}
                      </span>
                    </td>
                    <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                      <span style={{
                        backgroundColor: '#e0e7ff',
                        color: '#3730a3',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        📎 {((r.images || []).length + (r.documents || []).length + (r.signatures || []).length) || 0}
                      </span>
                    </td>
                    <td style={{ padding: '16px 12px', fontSize: '12px', color: '#6b7280' }}>
                      {new Date(r.createdAt || Date.now()).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                      <br />
                      <span style={{ fontSize: '10px' }}>
                        {new Date(r.createdAt || Date.now()).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </td>
                    <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                      {isSold(r) ? (
                        <span style={{
                          backgroundColor: '#fee2e2',
                          color: '#dc2626',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '600',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          🔴 SOLD
                        </span>
                      ) : (
                        <span style={{
                          backgroundColor: '#dcfce7',
                          color: '#16a34a',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '600',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          🟢 AVAILABLE
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

window.SecondsSales = SecondsSales;

function MobileSecondsSales({ salesUrl, token }) {
  const [form, setForm] = React.useState({
    mobileName: '',
    model: '',
    imeNo: '',
    specification: '',
    mobileCondition: '',
    colour: '',
    sellerName: '',
    sellerAddress: '',
    referenceName: '',
    referenceNumber: '',
    reasonForSale: '',
    proofType: '',
    proofNo: '',
    valueOfProduct: '',
    paymentMethod: ''
  });

  const [images, setImages] = React.useState([]);
  const [documents, setDocuments] = React.useState([]);
  const [signatures, setSignatures] = React.useState([]);

  const [banks, setBanks] = React.useState([]);
  const [entries, setEntries] = React.useState([]);

  const [mobileNameFilter, setMobileNameFilter] = React.useState('');
  const [modelFilter, setModelFilter] = React.useState('');

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [showAlert, setShowAlert] = React.useState(false);

  const [activeSection, setActiveSection] = React.useState('create'); // create | list

  React.useEffect(() => {
    if (!error && !success) {
      setShowAlert(false);
      return;
    }
    setShowAlert(true);
    const t = setTimeout(() => setShowAlert(false), 3500);
    return () => clearTimeout(t);
  }, [error, success]);

  async function loadEntries() {
    try {
      const res = await fetch((salesUrl || '') + '/api/seconds-sales', {
        headers: { Authorization: token ? 'Bearer ' + token : '' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load');
      setEntries(Array.isArray(data.rows) ? data.rows : []);
    } catch (err) {
      console.error('loadEntries error', err);
      setError(err.message || 'Failed to load entries');
    }
  }

  async function loadBanks() {
    try {
      const res = await fetch((salesUrl || '') + '/api/banks', {
        headers: { Authorization: token ? 'Bearer ' + token : '' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load banks');
      setBanks(Array.isArray(data.banks) ? data.banks : []);
    } catch (err) {
      console.error('loadBanks error', err);
      setBanks([]);
    }
  }

  React.useEffect(() => {
    loadEntries();
    loadBanks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
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
      const arr = await Promise.all(files.map(async (f) => ({ name: f.name, base64: await toBase64(f) })));
      setter((prev) => [...prev, ...arr]);
    } catch (err) {
      console.error(err);
      setError('Failed to read files');
    } finally {
      setLoading(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const payload = { ...form, images, documents, signatures, bank_id: form.paymentMethod || '' };
      const res = await fetch((salesUrl || '') + '/api/seconds-sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? 'Bearer ' + token : ''
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Save failed');

      setSuccess('Saved successfully');
      setForm({
        mobileName: '',
        model: '',
        imeNo: '',
        specification: '',
        mobileCondition: '',
        colour: '',
        sellerName: '',
        sellerAddress: '',
        referenceName: '',
        referenceNumber: '',
        reasonForSale: '',
        proofType: '',
        proofNo: '',
        valueOfProduct: '',
        paymentMethod: ''
      });
      setImages([]);
      setDocuments([]);
      setSignatures([]);
      await loadEntries();
      setActiveSection('list');
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({
      mobileName: '',
      model: '',
      imeNo: '',
      specification: '',
      mobileCondition: '',
      colour: '',
      sellerName: '',
      sellerAddress: '',
      referenceName: '',
      referenceNumber: '',
      reasonForSale: '',
      proofType: '',
      proofNo: '',
      valueOfProduct: '',
      paymentMethod: ''
    });
    setImages([]);
    setDocuments([]);
    setSignatures([]);
  }

  function isSold(entry) {
    return Array.isArray(entry.purchases) && entry.purchases.length > 0;
  }

  const filteredEntries = React.useMemo(() => {
    return (entries || []).filter((r) => {
      return (
        (!mobileNameFilter || (r.mobileName || '').toLowerCase().includes(mobileNameFilter.toLowerCase())) &&
        (!modelFilter || (r.model || '').toLowerCase().includes(modelFilter.toLowerCase()))
      );
    });
  }, [entries, mobileNameFilter, modelFilter]);

  const sortedEntries = React.useMemo(() => {
    return [...filteredEntries.filter((e) => !isSold(e)), ...filteredEntries.filter((e) => isSold(e))];
  }, [filteredEntries]);

  const selectedBank = form.paymentMethod ? banks.find((b) => b._id === form.paymentMethod) : null;

  const SectionButton = ({ id, label, count }) => (
    <button
      type="button"
      className={"btn " + (activeSection === id ? '' : 'secondary')}
      style={{ flex: 1, padding: '10px 12px', borderRadius: 10 }}
      onClick={() => setActiveSection(id)}
    >
      <span style={{ fontWeight: 700 }}>{label}</span>
      {typeof count === 'number' ? <span style={{ marginLeft: 8, opacity: 0.85 }}>({count})</span> : null}
    </button>
  );

  return (
    <div>
      {showAlert ? (
        <div style={{ position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 9999 }}>
          <div
            style={{
              background: error ? '#ffe6e6' : '#e7f9ef',
              color: error ? '#900' : '#0b5d2a',
              padding: 12,
              borderRadius: 10,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ fontWeight: 800 }}>{error ? 'Message' : 'Success'}</div>
              <button className="btn secondary" onClick={() => setShowAlert(false)}>
                Close
              </button>
            </div>
            <div style={{ marginTop: 8, wordBreak: 'break-word' }}>{error || success}</div>
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <SectionButton id="create" label="New Entry" />
          <SectionButton id="list" label="Saved" count={sortedEntries.length} />
        </div>
      </div>

      {activeSection === 'create' ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 12 }}>Seconds Sales — Create New Entry</div>

          <form onSubmit={submit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label>Mobile Name *</label>
                <input name="mobileName" value={form.mobileName} onChange={onChange} style={{ width: '100%', marginTop: 6 }} />
              </div>
              <div>
                <label>Model *</label>
                <input name="model" value={form.model} onChange={onChange} style={{ width: '100%', marginTop: 6 }} />
              </div>
              <div>
                <label>IMEI Number</label>
                <input name="imeNo" value={form.imeNo} onChange={onChange} style={{ width: '100%', marginTop: 6 }} />
              </div>
              <div>
                <label>Specification</label>
                <input name="specification" value={form.specification} onChange={onChange} style={{ width: '100%', marginTop: 6 }} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label>Condition</label>
                  <input name="mobileCondition" value={form.mobileCondition} onChange={onChange} style={{ width: '100%', marginTop: 6 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Color</label>
                  <input name="colour" value={form.colour} onChange={onChange} style={{ width: '100%', marginTop: 6 }} />
                </div>
              </div>

              <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />

              <div style={{ fontWeight: 800 }}>Seller</div>
              <div>
                <label>Seller Name *</label>
                <input name="sellerName" value={form.sellerName} onChange={onChange} style={{ width: '100%', marginTop: 6 }} />
              </div>
              <div>
                <label>Seller Address</label>
                <input name="sellerAddress" value={form.sellerAddress} onChange={onChange} style={{ width: '100%', marginTop: 6 }} />
              </div>
              <div>
                <label>Reason for Sale</label>
                <input name="reasonForSale" value={form.reasonForSale} onChange={onChange} style={{ width: '100%', marginTop: 6 }} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label>Reference Name</label>
                  <input name="referenceName" value={form.referenceName} onChange={onChange} style={{ width: '100%', marginTop: 6 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Reference Number</label>
                  <input name="referenceNumber" value={form.referenceNumber} onChange={onChange} style={{ width: '100%', marginTop: 6 }} />
                </div>
              </div>

              <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />

              <div style={{ fontWeight: 800 }}>Payment & Proof</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label>Proof Type</label>
                  <input name="proofType" value={form.proofType} onChange={onChange} style={{ width: '100%', marginTop: 6 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Proof Number</label>
                  <input name="proofNo" value={form.proofNo} onChange={onChange} style={{ width: '100%', marginTop: 6 }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label>Price (₹) *</label>
                  <input name="valueOfProduct" type="number" value={form.valueOfProduct} onChange={onChange} style={{ width: '100%', marginTop: 6 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Payment Method (Bank) *</label>
                  <select name="paymentMethod" value={form.paymentMethod} onChange={onChange} style={{ width: '100%', marginTop: 6 }}>
                    <option value="">Select bank account</option>
                    {banks.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.bankName} — ₹{Number(b.accountBalance || 0).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {selectedBank ? (
                <div style={{ fontSize: 12, opacity: 0.85 }}>
                  Selected balance: ₹{Number(selectedBank.accountBalance || 0).toFixed(2)}
                </div>
              ) : null}

              <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />

              <div style={{ fontWeight: 800 }}>Attachments</div>

              <div>
                <label>Images (Photos)</label>
                <input type="file" accept="image/*" multiple onChange={(e) => handleFiles(e, setImages)} style={{ width: '100%', marginTop: 6 }} />
                {images.length ? <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{images.length} selected</div> : null}
              </div>
              <div>
                <label>Documents (Proof)</label>
                <input type="file" accept="application/pdf,image/*" multiple onChange={(e) => handleFiles(e, setDocuments)} style={{ width: '100%', marginTop: 6 }} />
                {documents.length ? <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{documents.length} selected</div> : null}
              </div>
              <div>
                <label>Signatures</label>
                <input type="file" accept="image/*" multiple onChange={(e) => handleFiles(e, setSignatures)} style={{ width: '100%', marginTop: 6 }} />
                {signatures.length ? <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{signatures.length} selected</div> : null}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button className="btn secondary" type="button" onClick={resetForm} disabled={loading} style={{ flex: 1 }}>
                  Reset
                </button>
                <button className="btn" type="submit" disabled={loading} style={{ flex: 1 }}>
                  {loading ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      {activeSection === 'list' ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 12 }}>Saved Entries</div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Search Mobile Name"
              value={mobileNameFilter}
              onChange={(e) => setMobileNameFilter(e.target.value)}
              style={{ flex: 1 }}
            />
            <input
              type="text"
              placeholder="Search Model"
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              style={{ flex: 1 }}
            />
          </div>
          {(mobileNameFilter || modelFilter) ? (
            <button className="btn secondary" type="button" onClick={() => { setMobileNameFilter(''); setModelFilter(''); }} style={{ width: '100%', marginBottom: 12 }}>
              Clear Filters
            </button>
          ) : null}

          {sortedEntries.length === 0 ? (
            <div className="empty-state" style={{ padding: 18 }}>
              <div className="empty-icon">📱</div>
              <div className="empty-title">No Entries Found</div>
              <div className="empty-sub">{(mobileNameFilter || modelFilter) ? 'Try different filters.' : 'Create your first entry.'}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sortedEntries.map((r, i) => {
                const sold = isSold(r);
                const attachmentsCount = ((r.images || []).length + (r.documents || []).length + (r.signatures || []).length) || 0;
                return (
                  <button
                    key={r._id || i}
                    type="button"
                    className="card"
                    style={{
                      textAlign: 'left',
                      padding: 12,
                      border: '1px solid #eee',
                      background: sold ? '#fef2f2' : '#fff'
                    }}
                    onClick={() => {
                      try {
                        location.hash = '#seconds-sales-view-' + (r._id || i);
                      } catch (_) {
                        // ignore
                      }
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, wordBreak: 'break-word' }}>{r.mobileName || '-'}</div>
                        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{r.model || 'Model not specified'}</div>
                        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>
                          IMEI: <span style={{ fontFamily: 'monospace' }}>{r.imeNo || '-'}</span>
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>Seller: {r.sellerName || '-'}</div>
                        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>Files: {attachmentsCount}</div>
                        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
                          {new Date(r.createdAt || Date.now()).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 900 }}>₹{Number(r.valueOfProduct || 0).toFixed(2)}</div>
                        <div style={{ marginTop: 6 }}>
                          {sold ? (
                            <span style={{ fontSize: 12, fontWeight: 800, color: '#b91c1c' }}>SOLD</span>
                          ) : (
                            <span style={{ fontSize: 12, fontWeight: 800, color: '#16a34a' }}>AVAILABLE</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

window.MobileSecondsSales = MobileSecondsSales;

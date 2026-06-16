function WhatsappContact({ salesUrl, token }) {
  const [form, setForm] = React.useState({ name: '', number: '', district: '' });
  const [rows, setRows] = React.useState([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  // Tamil Nadu districts list (common set)
  const DISTRICTS = [
    'Ariyalur','Chengalpattu','Chennai','Coimbatore','Cuddalore','Dharmapuri','Dindigul','Erode','Kallakurichi','Kanchipuram','Kanyakumari','Karur','Krishnagiri','Madurai','Nagapattinam','Namakkal','Nilgiris','Perambalur','Pudukkottai','Ramanathapuram','Ranipet','Salem','Sivaganga','Tenkasi','Thanjavur','Theni','Thiruvallur','Thiruvarur','Thoothukudi','Tiruchirappalli','Tirunelveli','Tiruppur','Tiruvannamalai','Vellore','Viluppuram','Virudhunagar'
  ];

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const fetchContacts = async () => {
    try {
      setError('');
      const res = await fetch(salesUrl + '/api/whatsapp-contacts', { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load');
      setRows(Array.isArray(data.contacts) ? data.contacts : []);
    } catch (err) { setError(err.message); }
  };

  React.useEffect(() => { fetchContacts(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const res = await fetch(salesUrl + '/api/whatsapp-contacts', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Save failed');
      setForm({ name: '', number: '', district: '' });
      await fetchContacts();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  // Filtered district suggestions for a simple dropdown list
  const suggested = React.useMemo(() => {
    const q = (form.district || '').toLowerCase();
    if (!q) return DISTRICTS.slice(0, 8);
    return DISTRICTS.filter(d => d.toLowerCase().includes(q)).slice(0, 12);
  }, [form.district]);

  return (
    <div>
      <div className="card">
        <form onSubmit={submit}>
          <div className="row">
            <div className="col">
              <label>Contact Name</label>
              <input name="name" value={form.name} onChange={onChange} placeholder="Contact name" />
            </div>
            <div className="col">
              <label>Contact Number</label>
              <input name="number" value={form.number} onChange={onChange} placeholder="Phone number" />
            </div>
          </div>

          <div className="row mt-2">
            <div className="col">
              <label>District (Tamil Nadu)</label>
              <input name="district" value={form.district} onChange={onChange} placeholder="Type to search districts" list="tn-districts" />
              <datalist id="tn-districts">
                {suggested.map(d => <option key={d} value={d} />)}
              </datalist>
            </div>
          </div>

          <div className="row mt-3">
            <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
          {error ? <div className="mt-2 text-danger">{error}</div> : null}
        </form>
      </div>

      <div className="card mt-3 table-card">
        <div className="table-title">Saved Whatsapp Contacts</div>
        {rows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📇</div>
            <div className="empty-title">No Records Found</div>
            <div className="empty-sub">No contacts found. Add one above to get started.</div>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="modern-table">
              <thead>
                <tr>
                  <th style={{width:80}}>S.No</th>
                  <th>Contact Name</th>
                  <th>Number</th>
                  <th>District</th>
                  <th>Purchase Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r._id || i}>
                    <td><span className="serial-badge">{i+1}</span></td>
                    <td><span className="cell-strong">{r.name || '-'}</span></td>
                    <td>{r.number || '-'}</td>
                    <td>{r.district || '-'}</td>
                    <td>{(Number(r.purchaseAmount || 0)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Register globally for the in-browser JSX loader
window.WhatsappContact = WhatsappContact;

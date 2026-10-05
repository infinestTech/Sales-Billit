import React from 'react';
import { parseInventoryFile, summarize, downloadTemplate, downloadJsonTemplate, toNumber } from './inventoryImport';

const currency = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

const toInputDate = (s) => {
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = String(s).match(/^(\d{1,2})[-/.](\d{1,2}|[A-Za-z]{3})[-/.](\d{2,4})$/);
  if (m) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const mo = /^\d+$/.test(m[2]) ? Number(m[2]) : months.indexOf(m[2].toLowerCase()) + 1;
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    if (mo >= 1) return `${y}-${String(mo).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

const matchSupplier = (suppliers, name) => {
  const n = String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!n) return '';
  const hit = suppliers.find(s => {
    const a = String(s.supplierName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const b = String(s.agencyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return (a && (a === n || a.includes(n) || n.includes(a))) || (b && (b === n || b.includes(n) || n.includes(b)));
  });
  return hit ? hit._id : '';
};

const label = { display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' };
const input = { width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', background: 'white' };
const th = { padding: '10px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap', fontSize: '12px' };
const td = { padding: '8px 10px', borderBottom: '1px solid #f1f5f9', fontSize: '13px', verticalAlign: 'top' };
const btn = (bg, color = 'white') => ({ background: bg, color, border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' });

export default function InStockImport({ salesUrl, token, suppliers, existingEntries, onClose, onImported, onSuppliersChanged }) {
  const [fileName, setFileName] = React.useState('');
  const [parsing, setParsing] = React.useState(false);
  const [parseError, setParseError] = React.useState('');
  const [items, setItems] = React.useState(null);
  const [meta, setMeta] = React.useState({});
  const [supplierId, setSupplierId] = React.useState('');
  const [billNo, setBillNo] = React.useState('');
  const [billDate, setBillDate] = React.useState('');
  const [purchaseType, setPurchaseType] = React.useState('normal');
  const [creditAmount, setCreditAmount] = React.useState('');
  const [supplierAmount, setSupplierAmount] = React.useState('');
  const [gstAmount, setGstAmount] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState('');
  const [creatingSupplier, setCreatingSupplier] = React.useState(false);
  const fileRef = React.useRef(null);

  const summary = React.useMemo(() => (items ? summarize(items) : null), [items]);

  const existingNos = React.useMemo(() => {
    const set = new Set();
    (existingEntries || []).forEach(e => (e.items || []).forEach(it => { if (it.productNo) set.add(String(it.productNo).trim().toLowerCase()); }));
    return set;
  }, [existingEntries]);

  const duplicateCount = React.useMemo(
    () => (summary ? summary.valid.filter(i => i.productNo && existingNos.has(i.productNo.toLowerCase())).length : 0),
    [summary, existingNos]
  );

  const handleFile = async (file) => {
    if (!file) return;
    setParseError(''); setSaveError(''); setItems(null); setParsing(true); setFileName(file.name);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('File is larger than 5 MB.');
      const result = await parseInventoryFile(file);
      if (!result.items.length) throw new Error('No product rows were found in the file.');
      const s = summarize(result.items);
      setItems(result.items);
      setMeta(result.meta || {});
      setSupplierId(matchSupplier(suppliers || [], result.meta?.supplierName));
      setBillNo(result.meta?.billNo || '');
      setBillDate(toInputDate(result.meta?.billDate));
      const isCredit = /credit/i.test(result.meta?.billType || '');
      setPurchaseType(isCredit ? 'credit' : 'normal');
      setSupplierAmount(String(s.supplierAmount));
      setGstAmount(String(s.gstAmount));
      setCreditAmount(isCredit ? String(s.supplierAmount) : '');
    } catch (e) {
      setParseError(e.message || 'Could not read the file');
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeRow = (rowNumber) => setItems(list => list.filter(i => i.rowNumber !== rowNumber));

  const createSupplierFromFile = async () => {
    if (!meta.supplierName) return;
    setCreatingSupplier(true); setSaveError('');
    try {
      const res = await fetch(salesUrl + '/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ supplierName: meta.supplierName, agencyName: meta.supplierName, gstNumber: meta.supplierGstin || '' })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Could not create supplier');
      await onSuppliersChanged?.();
      setSupplierId(data.supplier?._id || '');
    } catch (e) { setSaveError(e.message); } finally { setCreatingSupplier(false); }
  };

  const canImport = summary && summary.valid.length > 0 && supplierId && !saving &&
    (purchaseType !== 'credit' || toNumber(creditAmount) > 0);

  const submit = async () => {
    if (!canImport) return;
    setSaving(true); setSaveError('');
    try {
      const body = {
        supplier_id: supplierId,
        supplierAmount: toNumber(supplierAmount),
        gstAmount: toNumber(gstAmount),
        purchaseType,
        creditAmount: purchaseType === 'credit' ? toNumber(creditAmount) : 0,
        billNo,
        billDate: billDate || null,
        source: 'import',
        items: summary.valid.map(i => ({
          productNo: i.productNo,
          productName: i.productName,
          brand: i.brand,
          model: i.model,
          quantity: i.quantity,
          costPrice: i.costPrice,
          sellingPrice: i.sellingPrice,
          validity: i.validity || undefined,
          imes: i.imes,
          warrantyMonths: i.warrantyMonths,
          warrantyDetails: i.warrantyDetails,
          hsn: i.hsn,
          mrp: i.mrp,
          gstPercent: i.gstPercent,
        })),
      };
      const res = await fetch(salesUrl + '/api/in-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Import failed');
      await onImported?.(summary.valid.length);
      onClose();
    } catch (e) { setSaveError(e.message); } finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '1200px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid #e5e7eb' }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', margin: 0 }}>📥 Import Stock from File</h2>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>Upload a supplier invoice as Excel (.xlsx/.xls/.csv) or JSON to add it to the master inventory</p>
          </div>
          <button type="button" style={btn('#f1f5f9', '#475569')} onClick={onClose}>✕ Close</button>
        </div>

        <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>
          {/* Upload */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
            style={{ border: '2px dashed #c7d2fe', background: '#eef2ff', borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}
          >
            <div>
              <div style={{ fontWeight: '600', color: '#3730a3' }}>{fileName ? `📄 ${fileName}` : 'Drop the invoice file here or choose a file'}</div>
              <div style={{ fontSize: '12px', color: '#6366f1', marginTop: '4px' }}>
                Columns: S.No, Code, Product, HSN, MRP, Rate, Qty, T.Value, CGST %, CGST Amt, SGST %, SGST Amt, Total (optional: Brand, Model, IMEI, Selling Price, Warranty, Validity)
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" style={btn('#ffffff', '#4f46e5')} onClick={downloadTemplate}>⬇ Excel template</button>
              <button type="button" style={btn('#ffffff', '#4f46e5')} onClick={downloadJsonTemplate}>⬇ JSON template</button>
              <button type="button" style={btn('linear-gradient(135deg, #667eea 0%, #764ba2 100%)')} onClick={() => fileRef.current?.click()} disabled={parsing}>
                {parsing ? 'Reading…' : 'Choose File'}
              </button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.json,application/json" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files?.[0])} />
            </div>
          </div>

          {parseError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', marginTop: '16px', fontSize: '14px' }}>{parseError}</div>
          )}

          {items && summary && (
            <>
              {/* Bill details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '24px' }}>
                <div>
                  <label style={label}>Supplier *</label>
                  <select style={input} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                    <option value="">Select supplier</option>
                    {(suppliers || []).map(s => <option key={s._id} value={s._id}>{s.supplierName || s.agencyName || s._id}</option>)}
                  </select>
                  {!supplierId && meta.supplierName && (
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                      File says “{meta.supplierName}”.{' '}
                      <button type="button" onClick={createSupplierFromFile} disabled={creatingSupplier} style={{ background: 'none', border: 'none', color: '#4f46e5', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: '12px' }}>
                        {creatingSupplier ? 'Adding…' : 'Add as new dealer'}
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label style={label}>Bill No</label>
                  <input style={input} value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="e.g. GST-R-373" />
                </div>
                <div>
                  <label style={label}>Bill Date</label>
                  <input style={input} type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
                </div>
                <div>
                  <label style={label}>Purchase Type</label>
                  <select style={input} value={purchaseType} onChange={(e) => { setPurchaseType(e.target.value); if (e.target.value === 'credit' && !creditAmount) setCreditAmount(supplierAmount); }}>
                    <option value="normal">Paid</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>
                <div>
                  <label style={label}>Supplier Amount (bill total)</label>
                  <input style={input} type="number" value={supplierAmount} onChange={(e) => setSupplierAmount(e.target.value)} />
                </div>
                <div>
                  <label style={label}>GST Amount</label>
                  <input style={input} type="number" value={gstAmount} onChange={(e) => setGstAmount(e.target.value)} />
                </div>
                {purchaseType === 'credit' && (
                  <div>
                    <label style={label}>Credit Amount *</label>
                    <input style={input} type="number" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} />
                  </div>
                )}
              </div>

              {/* Summary */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '20px', fontSize: '13px' }}>
                <span style={{ background: '#dcfce7', color: '#166534', padding: '6px 10px', borderRadius: '999px', fontWeight: '600' }}>{summary.valid.length} products ready</span>
                <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '6px 10px', borderRadius: '999px', fontWeight: '600' }}>{summary.totalQty} units</span>
                <span style={{ background: '#f1f5f9', color: '#334155', padding: '6px 10px', borderRadius: '999px', fontWeight: '600' }}>Total {currency(summary.supplierAmount)} · GST {currency(summary.gstAmount)}</span>
                {summary.invalid.length > 0 && (
                  <span style={{ background: '#fee2e2', color: '#991b1b', padding: '6px 10px', borderRadius: '999px', fontWeight: '600' }}>{summary.invalid.length} rows will be skipped</span>
                )}
                {duplicateCount > 0 && (
                  <span style={{ background: '#fef3c7', color: '#92400e', padding: '6px 10px', borderRadius: '999px', fontWeight: '600' }}>{duplicateCount} codes already in inventory (added as a new stock entry)</span>
                )}
              </div>

              {/* Preview */}
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'auto', marginTop: '16px', maxHeight: '45vh' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
                    <tr>
                      {['Row', 'Code', 'Product', 'HSN', 'Qty', 'Rate (cost)', 'MRP / Selling', 'GST', 'Total', 'Extras', ''].map(h => <th key={h} style={th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(i => (
                      <tr key={i.rowNumber} style={{ background: i.errors.length ? '#fef2f2' : 'white' }}>
                        <td style={td}>{i.rowNumber}</td>
                        <td style={td}><span style={{ fontFamily: 'monospace' }}>{i.productNo || <em style={{ color: '#9ca3af' }}>auto</em>}</span></td>
                        <td style={{ ...td, minWidth: '220px' }}>
                          <div style={{ fontWeight: '500', color: '#1e293b' }}>{i.productName || '-'}</div>
                          {i.errors.map(err => <div key={err} style={{ color: '#dc2626', fontSize: '12px' }}>⚠ {err}</div>)}
                        </td>
                        <td style={td}>{i.hsn || '-'}</td>
                        <td style={td}>{i.quantity}</td>
                        <td style={td}>{currency(i.costPrice)}</td>
                        <td style={td}>{i.sellingPrice ? currency(i.sellingPrice) : '-'}</td>
                        <td style={td}>{i.gstPercent ? `${i.gstPercent}% · ${currency(i.gstAmount)}` : '-'}</td>
                        <td style={{ ...td, fontWeight: '600' }}>{currency(i.lineTotal)}</td>
                        <td style={{ ...td, fontSize: '12px', color: '#64748b' }}>
                          {[i.brand, i.model].filter(Boolean).join(' ')}
                          {i.imes.length ? <div>{i.imes.length} IMEI</div> : null}
                          {i.warrantyMonths ? <div>{i.warrantyMonths}m warranty</div> : null}
                        </td>
                        <td style={td}>
                          <button type="button" onClick={() => removeRow(i.rowNumber)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer' }}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {saveError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', marginTop: '16px', fontSize: '14px' }}>{saveError}</div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '18px 28px', borderTop: '1px solid #e5e7eb', background: '#f8fafc', borderRadius: '0 0 16px 16px' }}>
          <button type="button" style={btn('#f1f5f9', '#475569')} onClick={onClose}>Cancel</button>
          <button
            type="button"
            onClick={submit}
            disabled={!canImport}
            style={{ ...btn(canImport ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#9ca3af'), cursor: canImport ? 'pointer' : 'not-allowed' }}
          >
            {saving ? 'Importing…' : `✅ Import ${summary ? summary.valid.length : 0} Products`}
          </button>
        </div>
      </div>
    </div>
  );
}

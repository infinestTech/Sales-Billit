import React from 'react';
import { parseInventoryFile, summarize, downloadTemplate, downloadJsonTemplate, toNumber, normalizeProductCodes } from './inventoryImport';

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

const squash = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const matchSupplier = (suppliers, name) => {
  const n = squash(name);
  if (!n) return '';
  const hit = suppliers.find(s => {
    const a = squash(s.supplierName);
    const b = squash(s.agencyName);
    return (a && (a === n || a.includes(n) || n.includes(a))) || (b && (b === n || b.includes(n) || n.includes(b)));
  });
  return hit ? hit._id : '';
};

// One editable bill per invoice found in the file
function makeBill(invoice, index, suppliers) {
  const s = summarize(invoice.items);
  const isCredit = /credit/i.test(invoice.meta?.billType || '');
  return {
    key: `${index}-${invoice.name}`,
    name: invoice.name,
    meta: invoice.meta || {},
    items: invoice.items,
    include: true,
    status: 'pending', // pending | saving | done | error
    error: '',
    supplierId: matchSupplier(suppliers || [], invoice.meta?.supplierName),
    billNo: invoice.meta?.billNo || '',
    billDate: toInputDate(invoice.meta?.billDate),
    purchaseType: isCredit ? 'credit' : 'normal',
    supplierAmount: String(s.supplierAmount),
    gstAmount: String(s.gstAmount),
    creditAmount: isCredit ? String(s.supplierAmount) : '',
  };
}

const billProblem = (bill) => {
  const s = summarize(bill.items);
  if (!s.valid.length) return 'No valid products';
  if (!bill.supplierId) return 'Select a supplier';
  if (bill.purchaseType === 'credit' && !(toNumber(bill.creditAmount) > 0)) return 'Enter the credit amount';
  return null;
};

const label = { display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' };
const input = { width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', background: 'white', boxSizing: 'border-box' };
const th = { padding: '10px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap', fontSize: '12px' };
const td = { padding: '8px 10px', borderBottom: '1px solid #f1f5f9', fontSize: '13px', verticalAlign: 'top' };
const btn = (bg, color = 'white') => ({ background: bg, color, border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' });
const pill = (bg, color) => ({ background: bg, color, padding: '6px 10px', borderRadius: '999px', fontWeight: '600' });

export default function InStockImport({ salesUrl, token, suppliers, existingEntries, onClose, onImported, onSuppliersChanged }) {
  const [fileName, setFileName] = React.useState('');
  const [parsing, setParsing] = React.useState(false);
  const [parseError, setParseError] = React.useState('');
  const [bills, setBills] = React.useState([]);
  const [activeKey, setActiveKey] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState('');
  const [creatingSupplier, setCreatingSupplier] = React.useState(false);
  const fileRef = React.useRef(null);

  const active = bills.find(b => b.key === activeKey) || bills[0] || null;
  const summary = React.useMemo(() => (active ? summarize(active.items) : null), [active]);
  const multi = bills.length > 1;

  const existingNos = React.useMemo(() => {
    const set = new Set();
    (existingEntries || []).forEach(e => (e.items || []).forEach(it => { if (it.productNo) set.add(String(it.productNo).trim().toLowerCase()); }));
    return set;
  }, [existingEntries]);

  const duplicateCount = React.useMemo(
    () => (summary ? summary.valid.filter(i => i.productNo && existingNos.has(i.productNo.toLowerCase())).length : 0),
    [summary, existingNos]
  );

  const pendingBills = bills.filter(b => b.include && b.status !== 'done');
  const readyBills = pendingBills.filter(b => !billProblem(b));
  const totals = React.useMemo(() => {
    let products = 0, units = 0, amount = 0;
    pendingBills.forEach(b => { const s = summarize(b.items); products += s.valid.length; units += s.totalQty; amount += s.supplierAmount; });
    return { products, units, amount };
  }, [pendingBills]);

  const updateBill = (key, patch) => setBills(list => list.map(b => (b.key === key ? { ...b, ...patch } : b)));

  const handleFile = async (file) => {
    if (!file) return;
    setParseError(''); setSaveError(''); setBills([]); setActiveKey(''); setParsing(true); setFileName(file.name);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('File is larger than 5 MB.');
      const { invoices } = await parseInventoryFile(file);
      normalizeProductCodes(invoices);
      const next = invoices.map((inv, i) => makeBill(inv, i, suppliers));
      if (!next.some(b => b.items.length)) throw new Error('No product rows were found in the file.');
      setBills(next);
      setActiveKey(next[0].key);
    } catch (e) {
      setParseError(e.message || 'Could not read the file');
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeRow = (rowNumber) => {
    if (!active) return;
    const items = active.items.filter(i => i.rowNumber !== rowNumber);
    const s = summarize(items);
    updateBill(active.key, {
      items,
      supplierAmount: String(s.supplierAmount),
      gstAmount: String(s.gstAmount),
      creditAmount: active.purchaseType === 'credit' ? String(s.supplierAmount) : active.creditAmount,
    });
  };

  // Use the active bill's supplier for every other bill in the file
  const applySupplierToAll = () => {
    if (!active?.supplierId) return;
    setBills(list => list.map(b => (b.status === 'done' ? b : { ...b, supplierId: active.supplierId })));
  };

  const createSupplierFromFile = async () => {
    const name = active?.meta?.supplierName;
    if (!name) return;
    setCreatingSupplier(true); setSaveError('');
    try {
      const res = await fetch(salesUrl + '/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ supplierName: name, agencyName: name, gstNumber: active.meta.supplierGstin || '' })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Could not create supplier');
      await onSuppliersChanged?.();
      const newId = data.supplier?._id || '';
      // Every bill from the same supplier gets the new dealer
      setBills(list => list.map(b => (!b.supplierId && squash(b.meta?.supplierName) === squash(name) ? { ...b, supplierId: newId } : b)));
    } catch (e) { setSaveError(e.message); } finally { setCreatingSupplier(false); }
  };

  const saveBill = async (bill) => {
    const s = summarize(bill.items);
    const body = {
      supplier_id: bill.supplierId,
      supplierAmount: toNumber(bill.supplierAmount),
      gstAmount: toNumber(bill.gstAmount),
      purchaseType: bill.purchaseType,
      creditAmount: bill.purchaseType === 'credit' ? toNumber(bill.creditAmount) : 0,
      billNo: bill.billNo,
      billDate: bill.billDate || null,
      source: 'import',
      items: s.valid.map(i => ({
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
        priceCode: i.priceCode,
      })),
    };
    const res = await fetch(salesUrl + '/api/in-stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.message || 'Import failed');
    return s.valid.length;
  };

  // Bills are saved one by one so each keeps its own bill no/date and supplier credit
  const submit = async () => {
    if (!readyBills.length || saving) return;
    const blocked = pendingBills.find(b => billProblem(b));
    if (blocked) {
      setActiveKey(blocked.key);
      setSaveError(`${blocked.billNo || blocked.name}: ${billProblem(blocked)}. Fix it or untick the bill to skip it.`);
      return;
    }
    setSaving(true); setSaveError('');
    let imported = 0;
    let failed = null;
    for (const bill of readyBills) {
      updateBill(bill.key, { status: 'saving', error: '' });
      try {
        imported += await saveBill(bill);
        updateBill(bill.key, { status: 'done' });
      } catch (e) {
        updateBill(bill.key, { status: 'error', error: e.message });
        failed = { bill, message: e.message };
        break; // stop so later bills are not imported out of order
      }
    }
    setSaving(false);
    if (imported) await onImported?.(imported);
    if (failed) {
      setActiveKey(failed.bill.key);
      setSaveError(`${failed.bill.billNo || failed.bill.name} was not imported: ${failed.message}${imported ? ` (${imported} products from earlier bills were imported)` : ''}`);
      return;
    }
    onClose();
  };

  const statusBadge = (b) => {
    if (b.status === 'done') return <span style={{ color: '#16a34a', fontWeight: 700 }}>✓ Imported</span>;
    if (b.status === 'saving') return <span style={{ color: '#4f46e5' }}>Saving…</span>;
    if (b.status === 'error') return <span style={{ color: '#dc2626' }}>Failed</span>;
    if (!b.include) return <span style={{ color: '#94a3b8' }}>Skipped</span>;
    const p = billProblem(b);
    return p ? <span style={{ color: '#d97706' }}>⚠ {p}</span> : <span style={{ color: '#16a34a' }}>Ready</span>;
  };

  const locked = !active || active.status === 'done' || saving;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '1200px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid #e5e7eb' }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', margin: 0 }}>📥 Import Stock from File</h2>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>Upload supplier invoices as Excel (.xlsx/.xls/.csv — one sheet per bill) or JSON (one invoice or a list of invoices)</p>
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
                Columns: S.No, Code, Product, HSN, MRP, Rate, Qty, T.Value, CGST %, CGST Amt, SGST %, SGST Amt, Total (optional: Brand, Model, IMEI, Selling Price, Warranty, Validity, Price Code)
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" style={btn('#ffffff', '#4f46e5')} onClick={downloadTemplate}>⬇ Excel template</button>
              <button type="button" style={btn('#ffffff', '#4f46e5')} onClick={downloadJsonTemplate}>⬇ JSON template</button>
              <button type="button" style={btn('linear-gradient(135deg, #667eea 0%, #764ba2 100%)')} onClick={() => fileRef.current?.click()} disabled={parsing || saving}>
                {parsing ? 'Reading…' : 'Choose File'}
              </button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.json,application/json" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files?.[0])} />
            </div>
          </div>

          {parseError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', marginTop: '16px', fontSize: '14px' }}>{parseError}</div>
          )}

          {/* Bills found in the file */}
          {multi && (
            <div style={{ marginTop: '20px', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '14px' }}>{bills.length} bills found in this file — each is imported as a separate stock entry</span>
                {active?.supplierId && bills.some(b => b.status !== 'done' && b.supplierId !== active.supplierId) && (
                  <button type="button" onClick={applySupplierToAll} disabled={saving} style={{ background: 'none', border: 'none', color: '#4f46e5', textDecoration: 'underline', cursor: 'pointer', fontSize: '12px' }}>
                    Use this bill&apos;s supplier for all bills
                  </button>
                )}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['', 'Bill', 'Date', 'Products', 'Units', 'Bill total', 'Type', 'Status'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {bills.map(b => {
                    const s = summarize(b.items);
                    const isActive = active && b.key === active.key;
                    return (
                      <tr key={b.key} onClick={() => setActiveKey(b.key)} style={{ cursor: 'pointer', background: isActive ? '#eef2ff' : 'white' }}>
                        <td style={td} onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={b.include} disabled={b.status === 'done' || saving} onChange={(e) => updateBill(b.key, { include: e.target.checked })} />
                        </td>
                        <td style={{ ...td, fontWeight: 600, color: '#1e293b' }}>{b.billNo || b.name}</td>
                        <td style={td}>{b.billDate || '-'}</td>
                        <td style={td}>{s.valid.length}{s.invalid.length ? <span style={{ color: '#dc2626' }}> (+{s.invalid.length} skipped)</span> : ''}</td>
                        <td style={td}>{s.totalQty}</td>
                        <td style={td}>{currency(s.supplierAmount)}</td>
                        <td style={td}>{b.purchaseType === 'credit' ? 'Credit' : 'Paid'}</td>
                        <td style={{ ...td, fontSize: '12px' }}>{statusBadge(b)}{b.error ? <div style={{ color: '#dc2626' }}>{b.error}</div> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {active && summary && (
            <>
              {multi && (
                <div style={{ marginTop: '20px', fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
                  Bill {active.billNo || active.name}{active.status === 'done' ? ' — imported' : ''}
                </div>
              )}

              {/* Bill details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: multi ? '12px' : '24px' }}>
                <div>
                  <label style={label}>Supplier *</label>
                  <select style={input} value={active.supplierId} disabled={locked} onChange={(e) => updateBill(active.key, { supplierId: e.target.value })}>
                    <option value="">Select supplier</option>
                    {(suppliers || []).map(s => <option key={s._id} value={s._id}>{s.supplierName || s.agencyName || s._id}</option>)}
                  </select>
                  {!active.supplierId && active.meta.supplierName && (
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                      File says “{active.meta.supplierName}”.{' '}
                      <button type="button" onClick={createSupplierFromFile} disabled={creatingSupplier || locked} style={{ background: 'none', border: 'none', color: '#4f46e5', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: '12px' }}>
                        {creatingSupplier ? 'Adding…' : 'Add as new dealer'}
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label style={label}>Bill No</label>
                  <input style={input} value={active.billNo} disabled={locked} onChange={(e) => updateBill(active.key, { billNo: e.target.value })} placeholder="e.g. GST-R-373" />
                </div>
                <div>
                  <label style={label}>Bill Date</label>
                  <input style={input} type="date" value={active.billDate} disabled={locked} onChange={(e) => updateBill(active.key, { billDate: e.target.value })} />
                </div>
                <div>
                  <label style={label}>Purchase Type</label>
                  <select
                    style={input}
                    value={active.purchaseType}
                    disabled={locked}
                    onChange={(e) => updateBill(active.key, {
                      purchaseType: e.target.value,
                      creditAmount: e.target.value === 'credit' && !active.creditAmount ? active.supplierAmount : active.creditAmount,
                    })}
                  >
                    <option value="normal">Paid</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>
                <div>
                  <label style={label}>Supplier Amount (bill total)</label>
                  <input style={input} type="number" value={active.supplierAmount} disabled={locked} onChange={(e) => updateBill(active.key, { supplierAmount: e.target.value })} />
                </div>
                <div>
                  <label style={label}>GST Amount</label>
                  <input style={input} type="number" value={active.gstAmount} disabled={locked} onChange={(e) => updateBill(active.key, { gstAmount: e.target.value })} />
                </div>
                {active.purchaseType === 'credit' && (
                  <div>
                    <label style={label}>Credit Amount *</label>
                    <input style={input} type="number" value={active.creditAmount} disabled={locked} onChange={(e) => updateBill(active.key, { creditAmount: e.target.value })} />
                  </div>
                )}
              </div>

              {/* Summary */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '20px', fontSize: '13px' }}>
                <span style={pill('#dcfce7', '#166534')}>{summary.valid.length} products ready</span>
                <span style={pill('#e0e7ff', '#3730a3')}>{summary.totalQty} units</span>
                <span style={pill('#f1f5f9', '#334155')}>Total {currency(summary.supplierAmount)} · GST {currency(summary.gstAmount)}</span>
                {summary.invalid.length > 0 && <span style={pill('#fee2e2', '#991b1b')}>{summary.invalid.length} rows will be skipped</span>}
                {duplicateCount > 0 && <span style={pill('#fef3c7', '#92400e')}>{duplicateCount} codes already in inventory (added as a new stock entry)</span>}
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
                    {active.items.map(i => (
                      <tr key={i.rowNumber} style={{ background: i.errors.length ? '#fef2f2' : 'white' }}>
                        <td style={td}>{i.rowNumber}</td>
                        <td style={td}>
                          <span style={{ fontFamily: 'monospace' }} title={i.originalCode ? `Supplier code "${i.originalCode}" is used for several products in this file` : undefined}>{i.productNo || <em style={{ color: '#9ca3af' }}>auto</em>}</span>
                          {i.originalCode ? <div style={{ fontSize: '11px', color: '#d97706' }}>was {i.originalCode}</div> : null}
                          {i.priceCode ? <div style={{ fontSize: '11px', color: '#475569' }}>Price code: <span style={{ fontFamily: 'monospace' }}>{i.priceCode}</span></div> : null}
                        </td>
                        <td style={{ ...td, minWidth: '220px' }}>
                          <div style={{ fontWeight: '500', color: '#1e293b' }}>{i.productName || '-'}</div>
                          {i.errors.map(err => <div key={err} style={{ color: '#dc2626', fontSize: '12px' }}>⚠ {err}</div>)}
                        </td>
                        <td style={td}>{i.hsn || '-'}</td>
                        <td style={td}>{i.quantity}</td>
                        <td style={td}>{currency(i.costPrice)}</td>
                        <td style={td}>
                          {i.mrp ? <div>MRP {currency(i.mrp)}</div> : null}
                          {i.sellingPrice && i.sellingPrice !== i.mrp ? <div>Sell {currency(i.sellingPrice)}</div> : null}
                          {!i.mrp && !i.sellingPrice ? '-' : null}
                        </td>
                        <td style={td}>{i.gstPercent ? `${i.gstPercent}% · ${currency(i.gstAmount)}` : '-'}</td>
                        <td style={{ ...td, fontWeight: '600' }}>{currency(i.lineTotal)}</td>
                        <td style={{ ...td, fontSize: '12px', color: '#64748b' }}>
                          {[i.brand, i.model].filter(Boolean).join(' ')}
                          {i.imes.length ? <div>{i.imes.length} IMEI</div> : null}
                          {i.warrantyMonths ? <div>{i.warrantyMonths}m warranty</div> : null}
                        </td>
                        <td style={td}>
                          {!locked && (
                            <button type="button" onClick={() => removeRow(i.rowNumber)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer' }}>🗑️</button>
                          )}
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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '18px 28px', borderTop: '1px solid #e5e7eb', background: '#f8fafc', borderRadius: '0 0 16px 16px' }}>
          <div style={{ fontSize: '13px', color: '#475569' }}>
            {bills.length > 0 && `${pendingBills.length} bill(s) · ${totals.products} products · ${totals.units} units · ${currency(totals.amount)}`}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="button" style={btn('#f1f5f9', '#475569')} onClick={onClose} disabled={saving}>{bills.some(b => b.status === 'done') ? 'Done' : 'Cancel'}</button>
            <button
              type="button"
              onClick={submit}
              disabled={!readyBills.length || saving}
              style={{ ...btn(readyBills.length && !saving ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#9ca3af'), cursor: readyBills.length && !saving ? 'pointer' : 'not-allowed' }}
            >
              {saving
                ? 'Importing…'
                : multi
                  ? `✅ Import ${pendingBills.length} Bills (${totals.products} Products)`
                  : `✅ Import ${totals.products} Products`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

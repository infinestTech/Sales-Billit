/**
 * BarcodeSheet Component
 * Generates professional barcode labels for inventory products with PDF download
 * - Filters: Product type, specific products, quantity control
 * - Downloads as PDF instead of printing
 */

function BarcodeSheet({ entries, onClose, salesUrl, token }) {
  const [barcodeData, setBarcodeData] = React.useState([]);
  const [filteredData, setFilteredData] = React.useState([]);
  const [filters, setFilters] = React.useState({
    type: 'all', // 'all', 'mobile', 'accessory'
    customQuantity: {}
  });
  const [downloading, setDownloading] = React.useState(false);
  const [shopName, setShopName] = React.useState('');
  // Price code cipher from shop-admin; labels print the encoded cost price. '' = not set up yet
  const [priceCipher, setPriceCipher] = React.useState('');
  const [cipherLoaded, setCipherLoaded] = React.useState(false);
  const [cipherPrompt, setCipherPrompt] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState(() => new Set()); // product keys ticked in the picker
  const pendingDownload = React.useRef(false); // set by "Only this": download once previews are drawn
  const BL = window.BarcodeLabels;
  const LOTS = window.LotStock;

  // 'a4' keeps the original sheet; 'thermal' prints one label per PDF page for the label printer
  const [layout, setLayout] = React.useState('a4');
  const [thermal, setThermal] = React.useState(() => {
    const s = BL.loadThermalSettings();
    return { widthMm: String(s.widthMm), heightMm: String(s.heightMm), showTypeTag: s.showTypeTag };
  });
  const thermalSettings = React.useMemo(
    () => ({ widthMm: Number(thermal.widthMm), heightMm: Number(thermal.heightMm), showTypeTag: thermal.showTypeTag }),
    [thermal]
  );
  const thermalError = BL.thermalSizeError(thermalSettings.widthMm, thermalSettings.heightMm);
  React.useEffect(() => { if (!thermalError) BL.saveThermalSettings(thermalSettings); }, [thermalSettings, thermalError]);

  React.useEffect(() => {
    const effectiveToken = token || localStorage.getItem('branch_token') || '';
    if (!salesUrl || !effectiveToken) return undefined;
    let cancelled = false;
    fetch(salesUrl + '/api/shop-info', { headers: { Authorization: 'Bearer ' + effectiveToken } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (cancelled || !d) return;
        if (d.shopName) setShopName(d.shopName);
        setPriceCipher(BL.normalizePriceCipher(d.priceCipher));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCipherLoaded(true); });
    return () => { cancelled = true; };
  }, [salesUrl, token]);

  // Generate barcode data from entries
  React.useEffect(() => {
    const data = [];
    const lots = new Map(); // productNo (TEMPER-D8) -> one label template per category
    
    entries.forEach(entry => {
      const category = entry.category || '';
      
      entry.items?.forEach(item => {
        // Pouch / tempered lots: one label per category whatever the number of purchases; the user
        // enters how many labels to print (it starts at 0 — nobody prints a whole lot of 1000 at once)
        if (LOTS.isLotItem(item)) {
          const qty = Math.max(0, parseInt(item.quantity) || 0);
          const cost = Number(item.costPrice) || 0;
          const prev = lots.get(item.productNo);
          if (prev) {
            const total = prev.maxQuantity + qty;
            if (total > 0) prev.costPrice = (prev.costPrice * prev.maxQuantity + cost * qty) / total;
            prev.maxQuantity = total;
          } else {
            const lot = {
              id: `lot-${item.productNo}`,
              productNo: item.productNo,
              productName: item.productName || LOTS.lotLabelTitle(item),
              brand: '',
              model: '',
              imei: null,
              costPrice: cost,
              barcodeValue: item.productNo,
              type: 'Lot',
              typeTag: LOTS.lotTypeOf(item.lotType).label,
              lotType: item.lotType,
              lotCategory: item.lotCategory,
              labelTitle: LOTS.lotLabelTitle(item),
              quantity: 0,
              maxQuantity: qty
            };
            lots.set(item.productNo, lot);
            data.push(lot);
          }
          return;
        }
        // Check if it's a mobile by category OR by having real IMEI numbers (ignore "0"/placeholder values)
        const hasImei = Array.isArray(item.imes) && item.imes.length > 0 && item.imes.some(imei => imei && imei.trim() && !/^0+$/.test(imei.trim()));
        const isMobile = category.toLowerCase().includes('mobile') || category.toLowerCase() === 'phone' || hasImei;
        
        if (isMobile && hasImei) {
          // For mobiles: create separate barcode for each real IMEI
          item.imes.forEach((imei, index) => {
            if (imei && imei.trim() && !/^0+$/.test(imei.trim())) {
              data.push({
                id: `${item.productNo}-${imei}`,
                productNo: item.productNo || 'N/A',
                productName: item.productName || 'Unnamed Product',
                brand: item.brand || '',
                model: item.model || '',
                imei: imei,
                priceCode: BL.encodePriceCode(item.costPrice, priceCipher),
                barcodeValue: imei.trim(),
                type: 'Mobile',
                quantity: 1
              });
            }
          });
        } else {
          // For accessories: barcode = product number
          const quantity = parseInt(item.quantity) || 1;
          
          data.push({
            id: `${item.productNo}`,
            productNo: item.productNo || 'N/A',
            productName: item.productName || 'Unnamed Product',
            brand: item.brand || '',
            model: item.model || '',
            imei: null,
            priceCode: BL.encodePriceCode(item.costPrice, priceCipher),
            barcodeValue: item.productNo || 'N/A',
            type: 'Accessory',
            quantity: quantity,
            maxQuantity: quantity
          });
        }
      });
    });
    
    lots.forEach(l => { l.priceCode = BL.encodePriceCode(l.costPrice, priceCipher); });
    setBarcodeData(data);
  }, [entries, priceCipher]);

  // Generate barcodes
  React.useEffect(() => {
    if (filteredData.length > 0 && window.JsBarcode) {
      setTimeout(() => {
        filteredData.forEach((item, index) => {
          try {
            const canvas = document.getElementById(`barcode-${index}`);
            if (canvas) {
              // Encode the exact code: Code 128 carries spaces and hyphens, and the POS looks codes up as written
              const value = BL.barcodeValueOf(item);
              if (value.length > 0) {
                window.JsBarcode(canvas, value, {
                  format: 'CODE128',
                  width: 2,
                  height: 60,
                  // The code is printed as its own line below the bars (product code, price code)
                  displayValue: false,
                  margin: 5
                });
              }
            }
          } catch (error) {
            console.error('Barcode generation error:', error);
          }
        });
        if (pendingDownload.current) {
          pendingDownload.current = false;
          handleDownloadPDF();
        }
      }, 100);
    }
  }, [filteredData]);

  // One row per product: accessories carry a quantity, mobiles one label per IMEI
  const products = React.useMemo(() => {
    const map = new Map();
    barcodeData.forEach(item => {
      const key = item.type + '|' + item.productNo;
      let p = map.get(key);
      if (!p) {
        p = { key, productNo: item.productNo, productName: item.productName, type: item.type, labels: [] };
        map.set(key, p);
      }
      p.labels.push(item);
    });
    return Array.from(map.values()).sort((a, b) => String(a.productName).localeCompare(String(b.productName)));
  }, [barcodeData]);

  // Search matches name, product code or IMEI. Value per visible product: null = whole product,
  // or the Set of label ids when only some IMEIs of a phone matched (only those labels print).
  const query = search.trim().toLowerCase();
  const searchHits = React.useMemo(() => {
    const hits = new Map();
    const wantType = filters.type === 'mobile' ? 'Mobile' : filters.type === 'accessory' ? 'Accessory' : filters.type === 'lot' ? 'Lot' : null;
    products.forEach(p => {
      if (wantType && p.type !== wantType) return;
      if (!query) { hits.set(p.key, null); return; }
      if (String(p.productName).toLowerCase().includes(query) || String(p.productNo).toLowerCase().includes(query)) { hits.set(p.key, null); return; }
      if (p.type === 'Mobile') {
        const ids = p.labels.filter(l => String(l.imei || '').toLowerCase().includes(query)).map(l => l.id);
        if (ids.length) hits.set(p.key, new Set(ids));
      }
    });
    return hits;
  }, [products, query, filters.type]);
  const visibleProducts = React.useMemo(() => products.filter(p => searchHits.has(p.key)), [products, searchHits]);

  // Ticked products print on their own (whatever the search shows); with nothing ticked, everything visible prints
  const selectionMode = selected.size > 0;
  const printProducts = React.useMemo(
    () => (selectionMode ? products.filter(p => selected.has(p.key)) : visibleProducts),
    [selectionMode, products, selected, visibleProducts]
  );

  const accessoryQty = (item) => {
    const q = filters.customQuantity[item.productNo];
    return Math.max(0, q != null ? q : (parseInt(item.quantity) || 0));
  };
  const labelsOf = (p) => {
    const only = searchHits.get(p.key);
    const out = [];
    p.labels.forEach(item => {
      if (item.type === 'Accessory' || item.type === 'Lot') {
        const qty = accessoryQty(item);
        for (let i = 0; i < qty; i++) out.push({ ...item, id: `${item.id}-${i}` });
      } else if (!only || only.has(item.id)) {
        out.push(item);
      }
    });
    return out;
  };

  React.useEffect(() => {
    const out = [];
    printProducts.forEach(p => { labelsOf(p).forEach(l => out.push(l)); });
    setFilteredData(out);
  }, [printProducts, searchHits, filters.customQuantity]);

  const toggleSelected = (key) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const allVisibleSelected = visibleProducts.length > 0 && visibleProducts.every(p => selected.has(p.key));
  const toggleAllVisible = () => setSelected(prev => {
    const next = new Set(prev);
    visibleProducts.forEach(p => { if (allVisibleSelected) next.delete(p.key); else next.add(p.key); });
    return next;
  });
  // "Only this": print one product by itself. The download starts once its label previews are drawn.
  const downloadOnly = (key) => {
    if (selected.size === 1 && selected.has(key)) { handleDownloadPDF(); return; }
    pendingDownload.current = true;
    setSelected(new Set([key]));
  };
  const PRODUCT_LIST_LIMIT = 200;

  // Thermal: flag labels whose code is too long or whose bars would be too short to scan
  const thermalCheck = React.useMemo(() => {
    if (layout !== 'thermal' || thermalError || !window.JsBarcode || !window.jspdf) return null;
    return BL.checkThermalLabels({ jsPDF: window.jspdf.jsPDF, JsBarcode: window.JsBarcode, labels: filteredData, settings: thermalSettings, shopName });
  }, [layout, thermalError, thermalSettings, filteredData, shopName]);

  // Goes to this portal's Inventory → Price Code screen (src/views/PriceCodeSettings.jsx)
  const canSetupPriceCode = true;
  const openPriceCodeSetup = () => {
    if (onClose) onClose();
    try { location.hash = '#price-code'; } catch (_) {}
  };

  // `force` is true only from the "Download anyway" button of the missing price code prompt
  const handleDownloadPDF = async (force) => {
    if (cipherLoaded && !priceCipher && force !== true) {
      setCipherPrompt(true);
      return;
    }
    setCipherPrompt(false);
    if (filteredData.length === 0) {
      alert('No labels to download!');
      return;
    }
    if (layout === 'thermal' && thermalError) {
      alert(thermalError);
      return;
    }

    setDownloading(true);
    try {
      const { jsPDF } = window.jspdf;
      const doc = layout === 'thermal'
        ? BL.buildThermalPdf({ jsPDF, JsBarcode: window.JsBarcode, document, labels: filteredData, settings: thermalSettings, shopName })
        : BL.buildA4Pdf({ jsPDF, labels: filteredData, shopName, getCanvas: (i) => document.getElementById(`barcode-${i}`) });
      doc.save(`Barcode_Labels_${new Date().getTime()}.pdf`);
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleQuantityChange = (productNo, value) => {
    setFilters(prev => ({
      ...prev,
      customQuantity: {
        ...prev.customQuantity,
        [productNo]: parseInt(value) || 0
      }
    }));
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        maxWidth: '1200px',
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>
                📦 Barcode Labels Generator
              </h2>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>
                {filteredData.length} label{filteredData.length !== 1 ? 's' : ''} ready to download
                {layout === 'thermal' && !thermalError ? ` · one ${thermalSettings.widthMm} × ${thermalSettings.heightMm} mm label per page` : ''}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleDownloadPDF}
                disabled={downloading || filteredData.length === 0 || (layout === 'thermal' && !!thermalError)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: downloading ? '#94a3b8' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: downloading || filteredData.length === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
                onMouseOver={e => !downloading && filteredData.length > 0 && (e.target.style.backgroundColor = '#059669')}
                onMouseOut={e => !downloading && (e.target.style.backgroundColor = '#10b981')}
              >
                {downloading ? '⏳ Generating...' : '📥 Download PDF'}
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={e => e.target.style.backgroundColor = '#dc2626'}
                onMouseOut={e => e.target.style.backgroundColor = '#ef4444'}
              >
                Close
              </button>
            </div>
          </div>

          {/* Filters */}
          <div style={{
            marginTop: '20px',
            padding: '16px',
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              {/* Search */}
              <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
                <label htmlFor="barcode-search" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                  Search products
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="barcode-search"
                    type="search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Product name, product code or IMEI…"
                    autoComplete="off"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
                  />
                </div>
              </div>

              {/* Type */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                  Type
                </label>
                <div role="radiogroup" aria-label="Product type" style={{ display: 'flex', flexWrap: 'wrap', width: '100%', boxSizing: 'border-box', background: '#f1f5f9', borderRadius: '8px', padding: '3px', gap: '2px' }}>
                  {[['all', 'All'], ['mobile', 'Mobiles'], ['accessory', 'Accessories'], ['lot', 'Pouch / Tempered']].map(([value, text]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={filters.type === value}
                      onClick={() => setFilters(prev => ({ ...prev, type: value }))}
                      style={{
                        flex: '1 1 auto', border: 'none', borderRadius: '6px', padding: '7px 6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                        whiteSpace: 'nowrap', minWidth: 0, minHeight: 0, margin: 0,
                        background: filters.type === value ? 'white' : 'transparent',
                        color: filters.type === value ? '#4338ca' : '#475569',
                        boxShadow: filters.type === value ? '0 1px 3px rgba(15,23,42,.12)' : 'none'
                      }}
                    >{text}</button>
                  ))}
                </div>
              </div>

              {/* Label layout */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                  Label layout
                </label>
                <select
                  value={layout}
                  onChange={e => setLayout(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  <option value="a4">A4 sheet (existing)</option>
                  <option value="thermal">Thermal label</option>
                </select>
              </div>
            </div>

            {/* Thermal label size */}
            {layout === 'thermal' && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
                  {[['widthMm', 'Label width (mm)'], ['heightMm', 'Label height (mm)']].map(([key, text]) => (
                    <div key={key}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                        {text}
                      </label>
                      <input
                        type="number"
                        min={key === 'widthMm' ? BL.THERMAL_LIMITS.minWidthMm : BL.THERMAL_LIMITS.minHeightMm}
                        max={key === 'widthMm' ? BL.THERMAL_LIMITS.maxWidthMm : BL.THERMAL_LIMITS.maxHeightMm}
                        step="0.5"
                        value={thermal[key]}
                        onChange={e => { const v = e.target.value; setThermal(prev => ({ ...prev, [key]: v })); }}
                        style={{ width: '110px', padding: '8px 10px', border: '1px solid ' + (thermalError ? '#f87171' : '#cbd5e1'), borderRadius: '6px', fontSize: '14px' }}
                      />
                    </div>
                  ))}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569', paddingBottom: '9px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={thermal.showTypeTag}
                      onChange={e => { const v = e.target.checked; setThermal(prev => ({ ...prev, showTypeTag: v })); }}
                    />
                    Show type tag
                  </label>
                  <span style={{ fontSize: '12px', color: '#64748b', paddingBottom: '9px' }}>
                    One label per PDF page. Print at 100% / “Actual size”, not “Fit to page”.
                  </span>
                </div>
                {thermalError && (
                  <div style={{ marginTop: '10px', padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c', fontSize: '13px' }}>
                    {thermalError}
                  </div>
                )}
                {thermalCheck && thermalCheck.problems.length > 0 && (
                  <div style={{ marginTop: '10px', padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', color: '#92400e', fontSize: '13px' }}>
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                      ⚠ {thermalCheck.problems.reduce((s, p) => s + p.count, 0)} label(s) may not scan or print fully on a {thermalSettings.widthMm} × {thermalSettings.heightMm} mm label:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '18px' }}>
                      {thermalCheck.problems.slice(0, 8).map(p => (
                        <li key={p.code + '|' + p.productName}>
                          <strong>{p.code || '(no code)'}</strong> — {p.productName}{p.count > 1 ? ` (×${p.count})` : ''}: {p.problems.join('; ')}
                        </li>
                      ))}
                    </ul>
                    {thermalCheck.problems.length > 8 && <div>…and {thermalCheck.problems.length - 8} more</div>}
                  </div>
                )}
                {thermalCheck && thermalCheck.reducedText > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
                    {thermalCheck.reducedText} label(s) use smaller text so the barcode keeps a scannable size.
                  </div>
                )}
              </div>
            )}

            {/* Product picker: tick products to print only those, or download one product on its own */}
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#334155', cursor: visibleProducts.length ? 'pointer' : 'default' }}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    disabled={!visibleProducts.length}
                    onChange={toggleAllVisible}
                    style={{ width: 'auto', height: 'auto', margin: 0 }}
                    ref={el => { if (el) el.indeterminate = !allVisibleSelected && visibleProducts.some(p => selected.has(p.key)); }}
                  />
                  {query || filters.type !== 'all'
                    ? `${visibleProducts.length} matching product${visibleProducts.length !== 1 ? 's' : ''}`
                    : `All ${visibleProducts.length} product${visibleProducts.length !== 1 ? 's' : ''}`}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#475569' }}>
                  {selectionMode ? (
                    <>
                      <span style={{ background: '#eef2ff', color: '#4338ca', borderRadius: '999px', padding: '3px 10px', fontWeight: 600 }}>
                        Printing {selected.size} selected product{selected.size !== 1 ? 's' : ''} only
                      </span>
                      <button type="button" onClick={() => setSelected(new Set())} style={{ border: 'none', background: 'none', color: '#4f46e5', fontWeight: 600, cursor: 'pointer', padding: 0, minWidth: 0, minHeight: 0 }}>
                        Clear selection
                      </button>
                    </>
                  ) : (
                    <span>Tick products to print only those</span>
                  )}
                </div>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', maxHeight: '260px', overflowY: 'auto', background: 'white' }}>
                {visibleProducts.length === 0 && (
                  <div style={{ padding: '18px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                    {products.length ? 'No products match your search' : 'No products to label'}
                  </div>
                )}
                {visibleProducts.slice(0, PRODUCT_LIST_LIMIT).map(p => {
                  const isChecked = selected.has(p.key);
                  const only = searchHits.get(p.key);
                  const isLot = p.type === 'Lot';
                  const isAccessory = p.type === 'Accessory' || isLot; // both print a chosen number of labels
                  const first = p.labels[0] || {};
                  const max = parseInt(first.maxQuantity ?? first.quantity) || 0;
                  const mobileCount = only ? only.size : p.labels.length;
                  return (
                    <div key={p.key} style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderBottom: '1px solid #f1f5f9',
                      background: isChecked ? '#f5f7ff' : 'white', flexWrap: 'wrap'
                    }}>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleSelected(p.key)} aria-label={'Select ' + p.productName} style={{ flexShrink: 0, width: 'auto', height: 'auto', margin: 0 }} />
                      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.productName}>
                          {p.productName}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {isLot ? `🧩 ${first.typeTag} · ${p.productNo} · ${max} in stock` : <>{isAccessory ? '🎧 Accessory' : '📱 Mobile'} · {p.productNo}</>}
                          {!isAccessory && (only ? ` · ${only.size} of ${p.labels.length} IMEIs match` : ` · ${p.labels.length} IMEI${p.labels.length !== 1 ? 's' : ''}`)}
                        </div>
                      </div>
                      {isAccessory ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
                          <span>Labels</span>
                          <input
                            type="number"
                            min="0"
                            max={max || undefined}
                            value={filters.customQuantity[p.productNo] ?? (parseInt(first.quantity) || 0)}
                            onChange={e => handleQuantityChange(p.productNo, e.target.value)}
                            aria-label={'Number of labels for ' + p.productName}
                            style={{ width: '64px', padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                          />
                          <span style={{ color: '#94a3b8' }}>/ {max}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#64748b' }}>{mobileCount} label{mobileCount !== 1 ? 's' : ''}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => downloadOnly(p.key)}
                        disabled={downloading || labelsOf(p).length === 0}
                        title="Download labels for this product only"
                        style={{
                          border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4338ca', borderRadius: '6px', padding: '5px 10px',
                          fontSize: '12px', fontWeight: 600, cursor: downloading ? 'wait' : 'pointer', whiteSpace: 'nowrap', minWidth: 0, minHeight: 0, margin: 0
                        }}
                      >⬇ Only this</button>
                    </div>
                  );
                })}
                {visibleProducts.length > PRODUCT_LIST_LIMIT && (
                  <div style={{ padding: '10px 12px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                    Showing the first {PRODUCT_LIST_LIMIT} of {visibleProducts.length} — search to narrow the list
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {cipherLoaded && !priceCipher && (
          <div role="status" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap',
            padding: '12px 24px', background: '#fffbeb', borderBottom: '1px solid #fde68a', color: '#92400e', fontSize: '14px'
          }}>
            <span>⚠️ <strong>Price code is not set up.</strong> Labels will print without the encoded cost price.</span>
            {canSetupPriceCode && (
              <button type="button" onClick={openPriceCodeSetup} style={{
                padding: '8px 14px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer'
              }}>Set up price code</button>
            )}
          </div>
        )}

        {cipherPrompt && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
          }} onClick={(e) => { if (e.target === e.currentTarget) setCipherPrompt(false); }}>
            <div role="alertdialog" aria-modal="true" aria-labelledby="price-code-prompt-title" style={{
              background: 'white', borderRadius: '14px', padding: '24px', maxWidth: '440px', width: '100%',
              boxShadow: '0 20px 50px rgba(15, 23, 42, 0.3)'
            }}>
              <h3 id="price-code-prompt-title" style={{ margin: '0 0 8px', fontSize: '18px', color: '#0f172a' }}>⚠️ No price code on these labels</h3>
              <p style={{ margin: '0 0 20px', color: '#475569', fontSize: '14px', lineHeight: 1.5 }}>
                The shop's price code (the secret letters for each digit of the cost price) hasn't been set up yet,
                so these labels will be printed without it.
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setCipherPrompt(false)} style={{
                  padding: '10px 16px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer'
                }}>Cancel</button>
                <button type="button" onClick={() => handleDownloadPDF(true)} style={{
                  padding: '10px 16px', background: '#e2e8f0', color: '#0f172a', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer'
                }}>Download anyway</button>
                {canSetupPriceCode && (
                  <button type="button" onClick={() => { setCipherPrompt(false); openPriceCodeSetup(); }} style={{
                    padding: '10px 16px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer'
                  }}>Set up price code</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Barcode Grid */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px'
        }}>
          {filteredData.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#64748b'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
              <p style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                No Labels to Display
              </p>
              <p style={{ fontSize: '14px' }}>
                Adjust your filters or add products to your inventory.
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '16px'
            }}>
              {filteredData.map((item, index) => (
                <div
                  key={item.id}
                  style={{
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    backgroundColor: 'white'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <div style={{ width: '100%', textAlign: 'center' }}>
                      {shopName && (
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '700',
                          color: '#4f46e5',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          marginBottom: '6px',
                          wordWrap: 'break-word'
                        }}>
                          {shopName}
                        </div>
                      )}
                      <div title={item.productName} style={{
                        fontSize: '16px',
                        fontWeight: '700',
                        color: '#1e293b',
                        wordWrap: 'break-word'
                      }}>
                        {BL.labelTitle(item)}
                      </div>
                    </div>

                    <canvas id={`barcode-${index}`} style={{ maxWidth: '100%' }}></canvas>

                    <div style={{ textAlign: 'center' }}>
                      {BL.labelCodeLines(item).map(line => (
                        <div key={line.kind} style={{
                          fontSize: line.kind === 'price' ? '14px' : '13px',
                          fontWeight: line.kind === 'price' ? '700' : '600',
                          color: '#1e293b',
                          fontFamily: 'monospace',
                          wordBreak: 'break-all'
                        }}>
                          {line.text}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

window.BarcodeSheet = BarcodeSheet;

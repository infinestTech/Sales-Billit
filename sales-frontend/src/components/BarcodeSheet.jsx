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
    productNo: 'all',
    customQuantity: {}
  });
  const [downloading, setDownloading] = React.useState(false);
  const [shopName, setShopName] = React.useState('');
  const BL = window.BarcodeLabels;

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
      .then(d => { if (!cancelled && d && d.shopName) setShopName(d.shopName); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [salesUrl, token]);

  // Generate barcode data from entries
  React.useEffect(() => {
    const data = [];
    
    entries.forEach(entry => {
      const category = entry.category || '';
      
      entry.items?.forEach(item => {
        // Check if it's a mobile by category OR by having IMEI numbers
        const hasImei = Array.isArray(item.imes) && item.imes.length > 0 && item.imes.some(imei => imei && imei.trim());
        const isMobile = category.toLowerCase().includes('mobile') || category.toLowerCase() === 'phone' || hasImei;
        
        if (isMobile && hasImei) {
          // For mobiles: create separate barcode for each IMEI
          item.imes.forEach((imei, index) => {
            if (imei && imei.trim()) {
              data.push({
                id: `${item.productNo}-${imei}`,
                productNo: item.productNo || 'N/A',
                productName: item.productName || 'Unnamed Product',
                brand: item.brand || '',
                model: item.model || '',
                imei: imei,
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
            barcodeValue: item.productNo || 'N/A',
            type: 'Accessory',
            quantity: quantity,
            maxQuantity: quantity
          });
        }
      });
    });
    
    setBarcodeData(data);
  }, [entries]);

  // Apply filters
  React.useEffect(() => {
    let filtered = [...barcodeData];

    // Filter by type
    if (filters.type !== 'all') {
      const targetType = filters.type === 'mobile' ? 'Mobile' : 'Accessory';
      filtered = filtered.filter(item => item.type === targetType);
    }

    // Filter by product
    if (filters.productNo !== 'all') {
      filtered = filtered.filter(item => item.productNo === filters.productNo);
    }

    // Expand accessories based on custom quantity
    const expanded = [];
    filtered.forEach(item => {
      if (item.type === 'Accessory') {
        const qty = filters.customQuantity[item.productNo] || item.quantity;
        for (let i = 0; i < qty; i++) {
          expanded.push({ ...item, id: `${item.id}-${i}` });
        }
      } else {
        expanded.push(item);
      }
    });

    setFilteredData(expanded);
  }, [barcodeData, filters]);

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
                  displayValue: true,
                  fontSize: 12,
                  margin: 5
                });
              }
            }
          } catch (error) {
            console.error('Barcode generation error:', error);
          }
        });
      }, 100);
    }
  }, [filteredData]);

  // Get unique products for filter
  const uniqueProducts = React.useMemo(() => {
    const products = new Map();
    barcodeData.forEach(item => {
      if (!products.has(item.productNo)) {
        products.set(item.productNo, {
          productNo: item.productNo,
          productName: item.productName,
          brand: item.brand,
          model: item.model,
          type: item.type
        });
      }
    });
    return Array.from(products.values());
  }, [barcodeData]);

  // Thermal: flag labels whose code is too long or whose bars would be too short to scan
  const thermalCheck = React.useMemo(() => {
    if (layout !== 'thermal' || thermalError || !window.JsBarcode || !window.jspdf) return null;
    return BL.checkThermalLabels({ jsPDF: window.jspdf.jsPDF, JsBarcode: window.JsBarcode, labels: filteredData, settings: thermalSettings, shopName });
  }, [layout, thermalError, thermalSettings, filteredData, shopName]);

  const handleDownloadPDF = async () => {
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
              {/* Type Filter */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                  Filter by Type
                </label>
                <select
                  value={filters.type}
                  onChange={e => setFilters(prev => ({ ...prev, type: e.target.value, productNo: 'all' }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  <option value="all">All Types</option>
                  <option value="mobile">Mobiles Only</option>
                  <option value="accessory">Accessories Only</option>
                </select>
              </div>

              {/* Product Filter */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                  Filter by Product
                </label>
                <select
                  value={filters.productNo}
                  onChange={e => setFilters(prev => ({ ...prev, productNo: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  <option value="all">All Products</option>
                  {uniqueProducts
                    .filter(p => filters.type === 'all' || 
                      (filters.type === 'mobile' && p.type === 'Mobile') ||
                      (filters.type === 'accessory' && p.type === 'Accessory'))
                    .map(product => {
                      let displayText = product.productName;
                      if (product.brand) {
                        displayText = `${product.brand} - ${displayText}`;
                      }
                      if (product.model) {
                        displayText = `${displayText} - ${product.model}`;
                      }
                      displayText = `${displayText} (${product.type})`;
                      return (
                        <option key={product.productNo} value={product.productNo}>
                          {displayText}
                        </option>
                      );
                    })}
                </select>
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

            {/* Quantity Controls for Accessories */}
            {barcodeData.filter(item => 
              item.type === 'Accessory' && 
              (filters.type === 'all' || filters.type === 'accessory') &&
              (filters.productNo === 'all' || filters.productNo === item.productNo)
            ).length > 0 && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '8px' }}>
                  Customize Quantity (Accessories)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
                  {barcodeData
                    .filter(item => 
                      item.type === 'Accessory' && 
                      (filters.type === 'all' || filters.type === 'accessory') &&
                      (filters.productNo === 'all' || filters.productNo === item.productNo)
                    )
                    .map(item => (
                      <div key={item.productNo} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', color: '#64748b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.productName}
                        </span>
                        <input
                          type="number"
                          min="0"
                          max={item.maxQuantity}
                          value={filters.customQuantity[item.productNo] ?? item.quantity}
                          onChange={e => handleQuantityChange(item.productNo, e.target.value)}
                          style={{
                            width: '70px',
                            padding: '6px 8px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            fontSize: '13px'
                          }}
                        />
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>/ {item.maxQuantity}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

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
                    <div style={{
                      width: '100%',
                      textAlign: 'center',
                      marginBottom: '8px'
                    }}>
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
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '700',
                        color: '#1e293b',
                        marginBottom: '4px',
                        wordWrap: 'break-word'
                      }}>
                        {item.productName}
                      </div>
                      {(item.brand || item.model) && (
                        <div style={{
                          fontSize: '13px',
                          color: '#64748b',
                          marginBottom: '4px'
                        }}>
                          {item.brand} {item.model}
                        </div>
                      )}
                      <div style={{
                        fontSize: '12px',
                        color: '#94a3b8',
                        fontWeight: '600'
                      }}>
                        Product No: {item.productNo}
                      </div>
                      {item.imei && (
                        <div style={{
                          fontSize: '11px',
                          color: '#f59e0b',
                          fontWeight: '600',
                          marginTop: '4px',
                          padding: '4px 8px',
                          backgroundColor: '#fef3c7',
                          borderRadius: '4px',
                          display: 'inline-block'
                        }}>
                          IMEI: {item.imei}
                        </div>
                      )}
                    </div>

                    <canvas id={`barcode-${index}`} style={{ maxWidth: '100%' }}></canvas>
                    
                    <div style={{
                      fontSize: '10px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: item.type === 'Mobile' ? '#dbeafe' : '#f0fdf4',
                      color: item.type === 'Mobile' ? '#1e40af' : '#15803d',
                      fontWeight: '600',
                      marginTop: '4px'
                    }}>
                      {item.type}
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

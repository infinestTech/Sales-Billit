// 80 mm thermal "Tax Invoice" receipt for product sales (desktop POS, mobile POS and WhatsApp-stock sales).
// Layout follows the shop's printed bill: shop header (address, state from the GSTIN, phone, email, GSTIN),
// party name, date and invoice number, # / Name / Qty / Price / Amount with HSN and IMEI under the name,
// a Total row, then Total / Received / Balance and the terms line. Plain JS, no Babel.
(function () {
  // GST state codes (first two digits of a GSTIN)
  var GST_STATES = {
    '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand',
    '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
    '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya',
    '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
    '24': 'Gujarat', '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa',
    '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar Islands',
    '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh', '97': 'Other Territory'
  };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return (Number(n) || 0).toFixed(2); }
  function pct(n) { return String(Number(n) || 0); }

  function stateFromGstin(gstin) {
    var code = String(gstin || '').trim().slice(0, 2);
    return GST_STATES[code] ? code + '-' + GST_STATES[code] : '';
  }

  function formatDate(d) {
    var dt = new Date(d || Date.now());
    if (isNaN(dt.getTime())) dt = new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(dt.getDate()) + '/' + p(dt.getMonth() + 1) + '/' + dt.getFullYear();
  }

  function decodeJwt(token) {
    try {
      var part = String(token || '').split('.')[1];
      if (!part) return {};
      var json = decodeURIComponent(atob(part.replace(/-/g, '+').replace(/_/g, '/')).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(json);
    } catch (e) { return {}; }
  }

  // Header details: the signed-in branch's name / address / phone / GSTIN, with the shop's email and name as fallbacks
  async function loadShop(salesUrl, token) {
    var headers = { Authorization: 'Bearer ' + token };
    var getJson = function (path) {
      return fetch(salesUrl + path, { headers: headers })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    };
    var results = await Promise.all([getJson('/api/branches'), getJson('/api/shop-info')]);
    var branches = results[0] && Array.isArray(results[0].branches) ? results[0].branches : [];
    var info = results[1] || {};
    var payload = decodeJwt(token);
    var branchId = payload.branch_id || payload._id || '';
    var branch = (branchId && branches.find(function (b) { return String(b._id) === String(branchId); })) || branches[0] || {};
    var shopLocation = /^location not set$/i.test(String(info.location || '').trim()) ? '' : info.location;
    return {
      name: branch.name || info.shopName || payload.shopName || payload.name || '',
      address: branch.address || shopLocation || '',
      phone: branch.phoneNumber || branch.phone || info.phone || '',
      email: info.email || branch.email || '',
      gstin: branch.gstNo || branch.gst || ''
    };
  }

  function buildHtml(sale, shop) {
    sale = sale || {};
    shop = shop || {};
    var items = Array.isArray(sale.items) ? sale.items : [];
    var realImeis = (window.BarcodeLabels && window.BarcodeLabels.realImeis) || function (l) { return Array.isArray(l) ? l : []; };

    var totalQty = 0;
    var rows = items.map(function (it, idx) {
      var qty = Number(it.qty != null ? it.qty : it.sellingQty) || 0;
      var price = Number(it.sellingPrice != null ? it.sellingPrice : it.unitSellingPrice) || 0;
      var amount = it.lineTotal != null && Number(it.lineTotal) ? Number(it.lineTotal) : qty * price;
      totalQty += qty;
      var imeis = realImeis(Array.isArray(it.imes) && it.imes.length ? it.imes : it.selectedImes);
      var extra = '';
      if (it.hsn) extra += '<tr class="sub"><td></td><td colspan="4">HSN: ' + esc(it.hsn) + '</td></tr>';
      imeis.forEach(function (imei) { extra += '<tr class="sub"><td></td><td colspan="4">IMEI: ' + esc(imei) + '</td></tr>'; });
      return '<tr class="item"><td>' + (idx + 1) + '</td><td class="name">' + esc(it.productName || it.productNo || 'Item') + '</td>' +
        '<td class="qty">' + qty + 'Pcs</td><td class="num">' + money(price) + '</td><td class="num">' + money(amount) + '</td></tr>' + extra;
    }).join('');

    var subTotal = Number(sale.subTotal) || items.reduce(function (s, it) {
      return s + (Number(it.qty != null ? it.qty : it.sellingQty) || 0) * (Number(it.sellingPrice) || 0);
    }, 0);
    var total = Number(sale.totalAmount != null ? sale.totalAmount : subTotal) || 0;
    var splits = Array.isArray(sale.paymentSplits) ? sale.paymentSplits : [];
    var received = splits.length
      ? splits.reduce(function (s, p) { return s + (Number(p.amount) || 0); }, 0)
      : (sale.amountPaid != null ? Number(sale.amountPaid) || 0 : total);
    var balance = Math.max(0, total - received);

    var line = function (label, value) {
      return '<tr><td class="lbl">' + label + '</td><td class="colon">:</td><td class="num">' + value + '</td></tr>';
    };
    var summary = '';
    var hasAdjustments = Number(sale.discountAmount) > 0 || Number(sale.cgstAmount) > 0 || Number(sale.sgstAmount) > 0 || Number(sale.igstAmount) > 0;
    if (hasAdjustments) summary += line('Sub Total', money(subTotal));
    if (Number(sale.discountAmount) > 0) summary += line('Discount' + (Number(sale.discount) > 0 ? ' (' + pct(sale.discount) + '%)' : ''), '-' + money(sale.discountAmount));
    if (Number(sale.cgstAmount) > 0) summary += line('CGST @' + pct(sale.cgst) + '%', money(sale.cgstAmount));
    if (Number(sale.sgstAmount) > 0) summary += line('SGST @' + pct(sale.sgst) + '%', money(sale.sgstAmount));
    if (Number(sale.igstAmount) > 0) summary += line('IGST @' + pct(sale.igst) + '%', money(sale.igstAmount));
    summary += line('Total', money(total)) + line('Received', money(received)) + line('Balance', money(balance));

    var invoiceNo = sale.invoiceNo || (sale._id ? String(sale._id).slice(-6).toUpperCase() : '');
    var state = stateFromGstin(shop.gstin);
    var header = '<div class="shop">' + esc(shop.name || 'Shop') + '</div>' +
      (shop.address ? '<div class="center">' + esc(shop.address) + '</div>' : '') +
      (state ? '<div class="center">State: ' + esc(state) + '</div>' : '') +
      (shop.phone ? '<div class="center">Ph.No.: ' + esc(shop.phone) + '</div>' : '') +
      (shop.email ? '<div class="center">Email: ' + esc(shop.email) + '</div>' : '') +
      (shop.gstin ? '<div class="center">GSTIN: ' + esc(shop.gstin) + '</div>' : '');

    return '<!doctype html><html><head><meta charset="utf-8"><title>Tax Invoice ' + esc(invoiceNo) + '</title><style>' +
      '@page { size: 80mm auto; margin: 0; }' +
      '* { box-sizing: border-box; }' +
      'body { margin: 0; background: #fff; color: #000; }' +
      '.receipt { width: 80mm; padding: 4mm 3.5mm 6mm; font-family: Consolas, "Lucida Console", "Courier New", monospace; font-size: 12px; line-height: 1.35; }' +
      '.shop { text-align: center; font-size: 17px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 2px; }' +
      '.center { text-align: center; word-break: break-word; }' +
      '.rule { border-top: 1px dashed #000; margin: 6px 0; }' +
      '.title { text-align: center; font-size: 13px; margin: 4px 0 2px; }' +
      '.party { margin-bottom: 4px; }' +
      '.right { text-align: right; }' +
      'table { width: 100%; border-collapse: collapse; }' +
      'th, td { padding: 1px 0; vertical-align: top; font-weight: normal; }' +
      '.items th { text-align: left; padding-bottom: 4px; border-bottom: 1px dashed #000; }' +
      '.items tr.item td { padding-top: 5px; }' +
      '.items th.num, .items td.num { text-align: right; }' +
      '.items th.qty, .items td.qty { text-align: center; }' +
      '.items td.name { word-break: break-word; padding-right: 4px; }' +
      '.items tr.sub td { font-size: 11px; }' +
      '.items tfoot td { border-top: 1px dashed #000; padding-top: 4px; }' +
      '.summary { width: 78%; margin-left: 22%; margin-top: 2px; }' +
      '.summary td.colon { width: 14px; text-align: center; }' +
      '.summary td.num { text-align: right; }' +
      '.terms { font-size: 10.5px; line-height: 1.25; }' +
      '@media screen { body { background: #f1f5f9; } .receipt { background: #fff; margin: 12px auto; box-shadow: 0 1px 4px rgba(0,0,0,.15); } }' +
      '</style></head><body><div class="receipt">' +
      header +
      '<div class="rule"></div>' +
      '<div class="title">Tax Invoice</div>' +
      '<div class="party">' + esc(sale.customerName || 'Walk-in Customer') + '</div>' +
      '<div class="right">Date: ' + formatDate(sale.createdAt) + '</div>' +
      (invoiceNo ? '<div class="right">Invoice No.: ' + esc(invoiceNo) + '</div>' : '') +
      '<div class="rule"></div>' +
      '<table class="items"><colgroup><col style="width:7%"><col style="width:37%"><col style="width:16%"><col style="width:19%"><col style="width:21%"></colgroup>' +
      '<thead><tr><th>#</th><th>Name</th><th class="qty">Qty</th><th class="num">Price</th><th class="num">Amount</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '<tfoot><tr><td colspan="2">Total</td><td class="qty">' + totalQty + '</td><td></td><td class="num">' + money(subTotal) + '</td></tr></tfoot>' +
      '</table>' +
      '<table class="summary">' + summary + '</table>' +
      '<div class="rule"></div>' +
      '<div class="terms">Terms &amp; Conditions</div>' +
      '<div class="terms">Thanks for doing business with us!</div>' +
      '</div></body></html>';
  }

  // Opens the receipt in a new window and prints it; returns false when the popup was blocked
  function print(html) {
    var w = window.open('', '_blank');
    if (!w) return false;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(function () { try { w.print(); } catch (e) { /* ignore */ } }, 300);
    return true;
  }

  window.SalesReceipt = { loadShop: loadShop, buildHtml: buildHtml, print: print, stateFromGstin: stateFromGstin };
})();

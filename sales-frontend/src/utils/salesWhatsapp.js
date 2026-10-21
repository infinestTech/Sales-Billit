// WhatsApp billing + A4 invoice PDF for branch-portal sales (plain JS, needs the React global).
// The admin turns WhatsApp billing on per shop (super-admin dashboard → WhatsApp → "Sales bill"); when on,
// the POS sends the invoice PDF to the customer through MSG91 right after a sale and from its WhatsApp button.
// SalesServer: GET /api/sales/whatsapp-config, GET /api/sales/:id/invoice-link, POST /api/sales/:id/whatsapp.
(function () {
  function authHeaders(token) {
    return { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  }

  async function loadConfig(salesUrl, token) {
    try {
      var res = await fetch(salesUrl + '/api/sales/whatsapp-config', { headers: authHeaders(token) });
      var d = await res.json().catch(function () { return {}; });
      return !!(res.ok && d.enabled);
    } catch (e) { return false; }
  }

  // Returns { ok, message } — never throws
  async function sendBill(salesUrl, token, saleId) {
    if (!saleId) return { ok: false, message: 'Complete a sale first' };
    try {
      var res = await fetch(salesUrl + '/api/sales/' + encodeURIComponent(saleId) + '/whatsapp', { method: 'POST', headers: authHeaders(token) });
      var d = await res.json().catch(function () { return {}; });
      if (res.ok && d.success) return { ok: true, message: 'Invoice sent successfully to the customer on WhatsApp' };
      return { ok: false, message: d.message || 'WhatsApp bill could not be sent' };
    } catch (e) {
      return { ok: false, message: 'Could not reach the server to send the WhatsApp bill' };
    }
  }

  // Opens the A4 invoice PDF in a new tab (opened before the request so popup blockers allow it).
  // Returns 'opened'; { blocked: true, html } when popups are blocked (show `html` in the page's preview
  // modal); or null when there is no PDF (caller falls back to the browser-printed invoice).
  async function openInvoice(salesUrl, token, saleId) {
    if (!saleId) return null;
    var w = window.open('', '_blank');
    try {
      var res = await fetch(salesUrl + '/api/sales/' + encodeURIComponent(saleId) + '/invoice-link', { headers: authHeaders(token) });
      var d = await res.json().catch(function () { return {}; });
      if (!res.ok || !d.url) throw new Error(d.message || 'No invoice link');
      if (w) { w.location.href = d.url; return 'opened'; }
      var src = String(d.url).replace(/"/g, '&quot;');
      return { blocked: true, html: '<!doctype html><html><body style="margin:0"><iframe src="' + src + '" title="Invoice" style="border:0;width:100%;height:100vh"></iframe></body></html>' };
    } catch (e) {
      if (w) w.close();
      return null;
    }
  }

  // { enabled, sending, send(saleId) -> { ok, message } }
  function useWhatsappBilling(salesUrl, token) {
    var enabledState = React.useState(false);
    var sendingState = React.useState(false);
    React.useEffect(function () {
      var alive = true;
      if (salesUrl && token) loadConfig(salesUrl, token).then(function (on) { if (alive) enabledState[1](on); });
      return function () { alive = false; };
    }, [salesUrl, token]);
    var send = async function (saleId) {
      sendingState[1](true);
      try { return await sendBill(salesUrl, token, saleId); }
      finally { sendingState[1](false); }
    };
    return { enabled: enabledState[0], sending: sendingState[0], send: send };
  }

  window.SalesWhatsApp = { loadConfig: loadConfig, sendBill: sendBill, openInvoice: openInvoice, useWhatsappBilling: useWhatsappBilling };
})();

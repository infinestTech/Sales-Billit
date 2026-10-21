// Combo plans: "Switch to Service" in the desktop and mobile headers. It asks SalesServer
// GET /api/service-switch whether the shop has a combo plan and renders nothing otherwise.
// - Owner who opened Sales from the Service portal (branch token via: 'service'): one-click switch —
//   SalesServer issues a 60s one-time code (POST /api/service-sso) that the Service app's /service-sso page
//   swaps for the Service session.
// - Anyone signed in with a branch password: opens the Service sign-in page, so branch staff never get the
//   owner's Service account without the owner's login.
function SwitchToServiceButton({ salesUrl, token, compact }) {
  const [busy, setBusy] = React.useState(false);
  const [mode, setMode] = React.useState(null); // null (hidden) | 'instant' | 'login'
  const serviceUrl = String((window.ENV_CONFIG && window.ENV_CONFIG.SERVICE_APP_URL) || '').replace(/\/+$/, '');
  const authToken = token || localStorage.getItem('branch_token') || '';

  React.useEffect(() => {
    let alive = true;
    if (!serviceUrl || !authToken) return undefined;
    fetch(salesUrl + '/api/service-switch', { headers: { Authorization: 'Bearer ' + authToken } })
      .then(r => r.json().catch(() => ({})))
      .then(d => { if (alive && d && d.available) setMode(d.instant ? 'instant' : 'login'); })
      .catch(() => {});
    return () => { alive = false; };
  }, [salesUrl, authToken, serviceUrl]);

  if (!serviceUrl || !mode) return null;

  const go = async () => {
    if (busy) return;
    if (mode === 'login') { window.location.href = serviceUrl + '/billit-login'; return; }
    setBusy(true);
    try {
      const res = await fetch(salesUrl + '/api/service-sso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + authToken }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.code) throw new Error(data.message || 'Could not open Service');
      window.location.href = serviceUrl + '/service-sso?code=' + encodeURIComponent(data.code);
    } catch (e) {
      setBusy(false);
      alert(e.message || 'Could not open Service. Please try again.');
    }
  };

  return (
    <button
      type="button"
      onClick={go}
      disabled={busy}
      title={mode === 'instant' ? 'Open the Service portal' : 'Sign in to the Service portal with the owner account'}
      aria-label="Switch to Service"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap',
        padding: compact ? '7px 10px' : '9px 16px', minWidth: 0, minHeight: 0, margin: 0,
        borderRadius: '999px', border: '1px solid rgba(255,255,255,0.45)',
        background: 'rgba(255,255,255,0.16)', color: 'white',
        fontSize: compact ? '12px' : '14px', fontWeight: 600, cursor: busy ? 'wait' : 'pointer',
        backdropFilter: 'blur(4px)'
      }}
    >
      <span aria-hidden="true">🛠️</span>
      {busy ? 'Opening…' : (compact ? 'Service' : 'Switch to Service')}
    </button>
  );
}

window.SwitchToServiceButton = SwitchToServiceButton;

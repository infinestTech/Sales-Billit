// Combo plans: an owner who opened Sales from the Service portal can jump back without signing in.
// SalesServer issues a 60s one-time code (POST /api/service-sso, only for branch tokens with via: 'service');
// the Service app's /service-sso page swaps it for the Service session. Rendered in the desktop and mobile headers.
function SwitchToServiceButton({ salesUrl, token, compact }) {
  const [busy, setBusy] = React.useState(false);
  const serviceUrl = String((window.ENV_CONFIG && window.ENV_CONFIG.SERVICE_APP_URL) || '').replace(/\/+$/, '');
  if (!serviceUrl) return null;

  const go = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(salesUrl + '/api/service-sso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || localStorage.getItem('branch_token') || '') }
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
      title="Open the Service portal"
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

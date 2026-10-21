// Shared look and helpers for the Dealers and Dealer Credits screens (plain JS). Classes are prefixed `dl-`.
(function () {
  var CSS = [
    '.dl{--dl-ac:#4f46e5;--dl-ac2:#6366f1;--dl-acs:#eef2ff;--dl-tx:#0f172a;--dl-mu:#64748b;--dl-ln:#e2e8f0;--dl-bg:#f8fafc;--dl-ok:#16a34a;--dl-oks:#dcfce7;--dl-wa:#b45309;--dl-was:#fef3c7;--dl-er:#dc2626;--dl-ers:#fee2e2;color:var(--dl-tx);font-family:Inter,system-ui,sans-serif}',
    '.dl *{box-sizing:border-box}',
    '.dl-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:18px}',
    '.dl-head h1{margin:0;font-size:26px;font-weight:800;letter-spacing:-.02em}',
    '.dl-head p{margin:4px 0 0;color:var(--dl-mu);font-size:14px}',
    '.dl-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:42px;padding:0 18px;border-radius:10px;border:1px solid transparent;font-weight:600;font-size:14px;cursor:pointer;transition:background .15s,box-shadow .15s,transform .05s;white-space:nowrap}',
    '.dl-btn:active{transform:translateY(1px)}',
    '.dl-btn:disabled{opacity:.55;cursor:not-allowed}',
    '.dl-btn.pri{background:var(--dl-ac);color:#fff;box-shadow:0 4px 12px rgba(79,70,229,.25)}',
    '.dl-btn.pri:hover:not(:disabled){background:#4338ca}',
    '.dl-btn.sec{background:#fff;color:var(--dl-tx);border-color:var(--dl-ln)}',
    '.dl-btn.sec:hover:not(:disabled){background:var(--dl-bg)}',
    '.dl-btn.ghost{background:transparent;color:var(--dl-ac);height:34px;padding:0 10px}',
    '.dl-btn.ghost:hover{background:var(--dl-acs)}',
    '.dl-btn.sm{height:34px;padding:0 12px;font-size:13px}',
    '.dl-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:18px}',
    '.dl-stat{background:#fff;border:1px solid var(--dl-ln);border-radius:14px;padding:14px 16px}',
    '.dl-stat .k{font-size:12px;font-weight:600;color:var(--dl-mu);text-transform:uppercase;letter-spacing:.04em}',
    '.dl-stat .v{margin-top:6px;font-size:22px;font-weight:800;font-variant-numeric:tabular-nums}',
    '.dl-stat .s{margin-top:2px;font-size:12px;color:var(--dl-mu)}',
    '.dl-stat.warn .v{color:var(--dl-wa)}.dl-stat.ok .v{color:var(--dl-ok)}',
    '.dl-card{background:#fff;border:1px solid var(--dl-ln);border-radius:14px}',
    '.dl-toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:14px;border-bottom:1px solid var(--dl-ln)}',
    '.dl-search{position:relative;flex:1 1 240px;min-width:0}',
    '.dl-search input{width:100%;height:40px;padding:0 12px 0 36px;border:1px solid var(--dl-ln);border-radius:10px;font-size:14px;outline:none;background:var(--dl-bg)}',
    '.dl-search input:focus{border-color:var(--dl-ac2);background:#fff;box-shadow:0 0 0 3px var(--dl-acs)}',
    '.dl-search.plain{flex:0 0 auto}.dl-search.plain input{padding-left:12px}',
    '.dl-search span{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--dl-mu);pointer-events:none}',
    '.dl-chips{display:inline-flex;background:var(--dl-bg);border:1px solid var(--dl-ln);border-radius:10px;padding:3px}',
    '.dl-chips button{border:0;background:transparent;height:32px;padding:0 12px;border-radius:7px;font-size:13px;font-weight:600;color:var(--dl-mu);cursor:pointer}',
    '.dl-chips button.on{background:#fff;color:var(--dl-tx);box-shadow:0 1px 3px rgba(15,23,42,.12)}',
    '.dl-select{width:auto!important;flex:0 0 auto;height:40px;border:1px solid var(--dl-ln);border-radius:10px;padding:0 10px;font-size:13px;background:#fff;color:var(--dl-tx)}',
    '.dl-row{display:grid;grid-template-columns:minmax(0,2.2fr) minmax(0,1.2fr) minmax(0,1.2fr) minmax(0,1fr) auto;gap:14px;align-items:center;padding:14px 16px;border-bottom:1px solid var(--dl-ln)}',
    '.dl-row:last-child{border-bottom:0}',
    '.dl-row.h{background:var(--dl-bg);font-size:12px;font-weight:700;color:var(--dl-mu);text-transform:uppercase;letter-spacing:.04em;padding-top:10px;padding-bottom:10px}',
    '.dl-row:not(.h):hover{background:#fafaff}',
    '.dl-who{display:flex;gap:12px;align-items:center;min-width:0}',
    '.dl-av{flex:0 0 40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:var(--dl-ac);background:var(--dl-acs)}',
    '.dl-name{font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.dl-sub{font-size:12.5px;color:var(--dl-mu);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.dl-num{font-variant-numeric:tabular-nums;font-weight:700}',
    '.dl-badge{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700;white-space:nowrap}',
    '.dl-badge.due{background:var(--dl-was);color:var(--dl-wa)}.dl-badge.ok{background:var(--dl-oks);color:var(--dl-ok)}.dl-badge.mu{background:#f1f5f9;color:var(--dl-mu)}.dl-badge.ac{background:var(--dl-acs);color:var(--dl-ac)}',
    '.dl-empty{text-align:center;padding:48px 20px;color:var(--dl-mu)}',
    '.dl-empty .i{font-size:40px;margin-bottom:8px}',
    '.dl-empty b{display:block;color:var(--dl-tx);font-size:16px;margin-bottom:4px}',
    '.dl-overlay{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:9000;display:flex;justify-content:flex-end}',
    '.dl-drawer{width:min(520px,100%);height:100%;background:#fff;display:flex;flex-direction:column;box-shadow:-12px 0 40px rgba(15,23,42,.2);animation:dlIn .18s ease-out}',
    '@keyframes dlIn{from{transform:translateX(24px);opacity:.6}to{transform:none;opacity:1}}',
    '.dl-dh{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid var(--dl-ln)}',
    '.dl-dh h2{margin:0;font-size:18px}',
    '.dl-x{border:0;background:var(--dl-bg);width:36px;height:36px;border-radius:10px;font-size:18px;cursor:pointer;color:var(--dl-mu)}',
    '.dl-db{flex:1;overflow:auto;padding:18px 20px}',
    '.dl-df{padding:14px 20px;border-top:1px solid var(--dl-ln);display:flex;gap:10px;justify-content:flex-end;background:#fff}',
    '.dl-sec{margin-bottom:20px}',
    '.dl-sec h3{margin:0 0 10px;font-size:12px;font-weight:800;color:var(--dl-mu);text-transform:uppercase;letter-spacing:.06em}',
    '.dl-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
    '.dl-f{display:flex;flex-direction:column;gap:6px;min-width:0}',
    '.dl-f.full{grid-column:1/-1}',
    '.dl-f label{font-size:13px;font-weight:600;color:#334155}',
    '.dl-f label i{color:var(--dl-er);font-style:normal}',
    '.dl-f input,.dl-f textarea,.dl-f select{width:100%;border:1px solid var(--dl-ln);border-radius:10px;padding:10px 12px;font-size:14px;outline:none;background:#fff;font-family:inherit}',
    '.dl-f input:focus,.dl-f textarea:focus,.dl-f select:focus{border-color:var(--dl-ac2);box-shadow:0 0 0 3px var(--dl-acs)}',
    '.dl-f .bad{border-color:var(--dl-er)!important;background:#fffafa}',
    '.dl-f small{font-size:12px;color:var(--dl-mu)}.dl-f small.err{color:var(--dl-er)}',
    '.dl-money{position:relative}.dl-money span{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--dl-mu);font-weight:700}.dl-money input{padding-left:28px;font-weight:700;font-size:16px}',
    '.dl-callout{border:1px dashed #c7d2fe;background:var(--dl-acs);border-radius:12px;padding:14px}',
    '.dl-toast{position:fixed;right:18px;bottom:18px;z-index:9500;max-width:380px;padding:12px 16px;border-radius:12px;font-size:14px;font-weight:600;box-shadow:0 10px 30px rgba(15,23,42,.2)}',
    '.dl-toast.ok{background:#064e3b;color:#ecfdf5}.dl-toast.err{background:#7f1d1d;color:#fef2f2}',
    '.dl-split{display:grid;grid-template-columns:340px minmax(0,1fr);gap:16px;align-items:start}',
    '.dl-list{max-height:calc(100vh - 330px);min-height:320px;overflow:auto}',
    '.dl-li{display:flex;gap:12px;align-items:center;width:100%;text-align:left;border:0;border-bottom:1px solid var(--dl-ln);background:#fff;padding:12px 14px;cursor:pointer;font:inherit;color:inherit}',
    '.dl-li:hover{background:#fafaff}.dl-li.on{background:var(--dl-acs);box-shadow:inset 3px 0 0 var(--dl-ac)}',
    '.dl-li .r{margin-left:auto;text-align:right;flex-shrink:0}',
    '.dl-tabs{display:flex;gap:4px;border-bottom:1px solid var(--dl-ln);padding:0 16px}',
    '.dl-tabs button{border:0;background:transparent;padding:12px 10px;font-size:14px;font-weight:600;color:var(--dl-mu);border-bottom:2px solid transparent;cursor:pointer;margin-bottom:-1px}',
    '.dl-tabs button.on{color:var(--dl-ac);border-bottom-color:var(--dl-ac)}',
    '.dl-bar{height:8px;border-radius:999px;background:#eef2f7;overflow:hidden}.dl-bar>i{display:block;height:100%;background:linear-gradient(90deg,#22c55e,#16a34a);border-radius:999px}',
    '.dl-seg{display:flex;flex-wrap:wrap;gap:6px}',
    '.dl-seg button{height:36px;padding:0 12px;border-radius:9px;border:1px solid var(--dl-ln);background:#fff;font-size:13px;font-weight:600;cursor:pointer;color:#334155}',
    '.dl-seg button.on{border-color:var(--dl-ac);background:var(--dl-acs);color:var(--dl-ac)}',
    '.dl-table{width:100%;border-collapse:collapse;font-size:13.5px}',
    '.dl-table th{text-align:left;font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--dl-mu);background:var(--dl-bg);padding:9px 12px;font-weight:700}',
    '.dl-table td{padding:11px 12px;border-top:1px solid var(--dl-ln);vertical-align:top}',
    '.dl-table .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.dl-day{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:var(--dl-bg);font-size:12.5px;font-weight:700;color:var(--dl-mu);border-top:1px solid var(--dl-ln)}',
    '.dl-pay{display:flex;gap:12px;align-items:flex-start;padding:12px 16px;border-top:1px solid var(--dl-ln)}',
    '.dl-pay .ic{flex:0 0 34px;height:34px;border-radius:10px;background:var(--dl-oks);color:var(--dl-ok);display:flex;align-items:center;justify-content:center;font-size:16px}',
    '.dl-main{display:flex;flex-direction:column;gap:16px;min-width:0}',
    '.dl-back{display:none}',
    '@media (max-width:1100px){.dl-split{grid-template-columns:290px minmax(0,1fr)}}',
    '@media (max-width:900px){.dl-row{grid-template-columns:minmax(0,1fr) auto}.dl-row .hide-sm{display:none}.dl-row.h{display:none}',
    '.dl-split{grid-template-columns:1fr}.dl-split.detail .dl-side{display:none}.dl-split:not(.detail) .dl-main{display:none}.dl-back{display:inline-flex}.dl-list{max-height:none}}',
    '@media (max-width:560px){.dl-grid{grid-template-columns:1fr}.dl-head h1{font-size:22px}.dl-stat .v{font-size:19px}.dl-drawer{width:100%}.dl-toolbar{padding:10px}}'
  ].join('\n');

  function money(n) {
    return '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function formatDate(d) {
    if (!d) return '—';
    var dt = new Date(d);
    return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function initials(name) {
    var parts = String(name || '?').trim().split(/\s+/);
    return ((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }
  function dealerName(d) {
    return (d && (d.supplierName || d.agencyName)) || 'Unnamed dealer';
  }
  // Local yyyy-mm-dd (for <input type="date">)
  function todayInput() {
    var t = new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate());
  }
  // Opens Dealer Credits with a dealer selected
  function openDealerCredits(id) {
    try { sessionStorage.setItem('dealerCredits.selected', String(id || '')); } catch (e) { /* ignore */ }
    location.hash = '#dealer-credits';
  }

  window.DealerUI = { CSS: CSS, money: money, formatDate: formatDate, initials: initials, dealerName: dealerName, todayInput: todayInput, openDealerCredits: openDealerCredits };
})();

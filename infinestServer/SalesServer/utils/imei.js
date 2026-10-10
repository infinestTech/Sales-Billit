// Accessories are often imported with "0", "-" or "NA" in the IMEI column. Those are placeholders, not IMEIs —
// keep them out of stock so only phones are treated as IMEI-tracked. Mirrors isPlaceholderImei in the
// shop-admin barcodeLabels.js / inventoryImport.js helpers.
const PLACEHOLDERS = new Set(['na', 'n/a', 'nil', 'none', 'null', 'undefined', 'nan', 'no', 'imei']);

function isPlaceholderImei(value) {
  const v = String(value == null ? '' : value).trim();
  if (!v) return true;
  if (/^0+$/.test(v) || /^[^a-z0-9]+$/i.test(v)) return true;
  return PLACEHOLDERS.has(v.toLowerCase());
}

function cleanImeis(list) {
  return (Array.isArray(list) ? list : []).map((x) => String(x == null ? '' : x).trim()).filter((x) => !isPlaceholderImei(x));
}

// Strips placeholders from the IMEI arrays on stock rows sent to clients
function cleanRowImeis(rows) {
  return (Array.isArray(rows) ? rows : []).map((r) => {
    if (!r || typeof r !== 'object') return r;
    const out = { ...r };
    ['imes', 'centralImes', 'centralOnlyImes'].forEach((k) => { if (Array.isArray(out[k])) out[k] = cleanImeis(out[k]); });
    return out;
  });
}

module.exports = { isPlaceholderImei, cleanImeis, cleanRowImeis };

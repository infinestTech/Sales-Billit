'use strict';
/**
 * POS payment modes: Cash, Gpay, Card and every combination of them ("Cash + Gpay", ...). A sale stores the
 * chosen label in `paymentMethod` and how much was received in each mode in `paymentSplits`, so reports can
 * total cash, Gpay and card separately. The branch portal copy of these lists is src/utils/salesPayments.js.
 */

const PAYMENT_MODES = ['Cash', 'Gpay', 'Card'];
const PAYMENT_METHODS = ['Cash', 'Gpay', 'Card', 'Cash + Gpay', 'Cash + Card', 'Gpay + Card', 'Cash + Gpay + Card'];
// Client totals are rounded to 10 paise and the server's to 1 paisa; differences up to this are absorbed
const ROUNDING_TOLERANCE = 1;

const round2 = (n) => Math.round(Number(n) * 100) / 100;

/**
 * Reads paymentMethod / paymentSplits from a sale request.
 * Returns { paymentMethod, paymentSplits, amountPaid } or { error }.
 * Requests without paymentSplits (older clients) keep their label; a single mode is recorded as one split.
 */
function parsePayment(body, totalAmount) {
  const method = String((body && body.paymentMethod) || '').trim();
  const rawSplits = body && Array.isArray(body.paymentSplits) ? body.paymentSplits : null;
  if (!rawSplits) {
    return {
      paymentMethod: method || 'Cash',
      paymentSplits: PAYMENT_MODES.includes(method) ? [{ method, amount: round2(totalAmount) }] : [],
      amountPaid: Number((body && body.amountPaid) || 0)
    };
  }
  if (!PAYMENT_METHODS.includes(method)) return { error: 'Choose a payment method: Cash, Gpay, Card or a combination of them' };

  const splits = [];
  for (const mode of method.split(' + ')) {
    const row = rawSplits.find((s) => s && s.method === mode);
    const amount = round2(row ? row.amount : NaN);
    if (!Number.isFinite(amount) || amount <= 0) return { error: `Enter the amount received by ${mode}` };
    splits.push({ method: mode, amount });
  }
  const received = round2(splits.reduce((s, p) => s + p.amount, 0));
  const diff = round2(totalAmount - received);
  if (Math.abs(diff) > ROUNDING_TOLERANCE) {
    return { error: `Payments add up to ₹${received.toFixed(2)} but the bill total is ₹${Number(totalAmount).toFixed(2)}` };
  }
  if (diff !== 0) splits[splits.length - 1].amount = round2(splits[splits.length - 1].amount + diff);
  return { paymentMethod: method, paymentSplits: splits, amountPaid: round2(totalAmount) };
}

module.exports = { PAYMENT_MODES, PAYMENT_METHODS, parsePayment };

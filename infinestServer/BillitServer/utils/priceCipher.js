'use strict';
/**
 * Price code cipher: the shop assigns one character to each digit, in the order 1 2 3 4 5 6 7 8 9 0.
 * Labels and inventory show the cost price written with those characters (₹1450 -> "CPUX" for "COMPUTERSX").
 * Stored as a 10-character string on Shop.sales_settings.price_cipher ('' = not set up).
 */

const DIGIT_ORDER = '1234567890';

/** Returns { cipher } for a valid input ('' clears it) or { error } explaining what is wrong. */
function parsePriceCipher(raw) {
  const chars = Array.isArray(raw) ? raw.map(c => String(c == null ? '' : c).trim()) : Array.from(String(raw == null ? '' : raw).trim());
  if (chars.every(c => c === '')) return { cipher: '' };
  if (chars.length !== 10) return { error: 'Assign exactly one character to each of the 10 digits' };
  const upper = chars.map(c => c.toUpperCase());
  for (let i = 0; i < 10; i++) {
    const c = upper[i];
    if (Array.from(c).length !== 1) return { error: `Digit ${DIGIT_ORDER[i]} needs exactly one character` };
    if (/\s/.test(c)) return { error: `Digit ${DIGIT_ORDER[i]} cannot be a space` };
    if (/[0-9]/.test(c)) return { error: `Use letters or symbols, not numbers (digit ${DIGIT_ORDER[i]})` };
  }
  const dup = upper.find((c, i) => upper.indexOf(c) !== i);
  if (dup) return { error: `"${dup}" is used for more than one digit — every digit needs its own character` };
  return { cipher: upper.join('') };
}

module.exports = { DIGIT_ORDER, parsePriceCipher };

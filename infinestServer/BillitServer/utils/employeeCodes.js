'use strict';
/**
 * Employee codes (e.g. EMP001) are the human-facing identity used at the POS and in reports.
 * They are unique per shop (partial unique index on Employee { shop_id, employee_code }).
 */

const { Employee } = require('../models/mongoModels');

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{0,19}$/;
const AUTO_PREFIX = 'EMP';

function normalizeEmployeeCode(raw) {
  if (raw === undefined || raw === null) return '';
  return String(raw).trim().toUpperCase().replace(/\s+/g, '');
}

function isValidEmployeeCode(code) {
  return CODE_PATTERN.test(code);
}

async function nextEmployeeCode(shopId) {
  const rows = await Employee.find(
    { shop_id: shopId, employee_code: { $regex: `^${AUTO_PREFIX}\\d+$` } },
    { employee_code: 1 }
  ).lean();
  const max = rows.reduce((m, r) => Math.max(m, parseInt(String(r.employee_code).slice(AUTO_PREFIX.length), 10) || 0), 0);
  return `${AUTO_PREFIX}${String(max + 1).padStart(3, '0')}`;
}

async function isEmployeeCodeTaken(shopId, code, exceptId) {
  const q = { shop_id: shopId, employee_code: code };
  if (exceptId) q._id = { $ne: exceptId };
  return !!(await Employee.exists(q));
}

const isDuplicateKeyError = (err) => err && (err.code === 11000 || /E11000/.test(err.message || ''));

/** Gives every employee of the shop that has no code a sequential EMP### code (oldest first). */
async function ensureEmployeeCodes(shopId) {
  const missing = await Employee.find(
    { shop_id: shopId, $or: [{ employee_code: { $exists: false } }, { employee_code: null }, { employee_code: '' }] },
    { _id: 1 }
  ).sort({ created_at: 1, _id: 1 }).lean();
  for (const emp of missing) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const code = await nextEmployeeCode(shopId);
        await Employee.updateOne({ _id: emp._id }, { $set: { employee_code: code } });
        break;
      } catch (err) {
        if (!isDuplicateKeyError(err)) throw err;
      }
    }
  }
  return missing.length;
}

module.exports = {
  normalizeEmployeeCode,
  isValidEmployeeCode,
  nextEmployeeCode,
  isEmployeeCodeTaken,
  isDuplicateKeyError,
  ensureEmployeeCodes,
};

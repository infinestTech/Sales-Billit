'use strict';
/**
 * Service (repair) metrics. Jobs store the technician as free text (Mobile.technician_name), so a job is
 * attributed to an employee when that text equals the employee's code or name (case-insensitive).
 *
 * Revenue follows the financial report: payments received in the period (Mobile.payments[].date),
 * plus legacy jobs without a payments ledger counted by created_at / paid_amount.
 */

const { Mobile, Expense } = require('../models/mongoModels');
const { IST_TZ } = require('./periodRange');

const techKey = (name) => String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const HAS_TECH = { technician_name: { $exists: true, $nin: [null, ''] } };
const LEGACY_PAYMENT = { $or: [{ payments: { $exists: false } }, { payments: { $size: 0 } }] };
const TECH_GROUP_KEY = { $toLower: { $trim: { input: '$technician_name' } } };

/** Maps normalized code/name → employee id. Names shared by several employees are ambiguous and skipped. */
function buildEmployeeMatcher(employees) {
  const byKey = new Map();
  const ambiguous = new Set();
  const add = (key, id) => {
    if (!key) return;
    if (byKey.has(key) && byKey.get(key) !== id) ambiguous.add(key);
    else byKey.set(key, id);
  };
  employees.forEach((e) => add(techKey(e.employee_code), String(e._id)));
  employees.forEach((e) => {
    add(techKey(e.name), String(e._id));
    if (e.employee_name && e.employee_name !== e.name) add(techKey(e.employee_name), String(e._id));
  });
  ambiguous.forEach((k) => byKey.delete(k));
  return (name) => byKey.get(techKey(name)) || null;
}

const emptyTech = (name) => ({ name, jobs: 0, completed: 0, delivered: 0, returned: 0, partsCost: 0, revenue: 0 });

/** Per-technician service metrics for the period, keyed by normalized technician name. */
async function getServiceByTechnician(shopId, start, end) {
  const [jobs, paid, legacy] = await Promise.all([
    Mobile.aggregate([
      { $match: { shop_id: shopId, created_at: { $gte: start, $lte: end }, ...HAS_TECH } },
      {
        $group: {
          _id: TECH_GROUP_KEY,
          name: { $first: '$technician_name' },
          jobs: { $sum: 1 },
          completed: { $sum: { $cond: [{ $or: ['$ready', '$delivered'] }, 1, 0] } },
          delivered: { $sum: { $cond: ['$delivered', 1, 0] } },
          returned: { $sum: { $cond: ['$returned', 1, 0] } },
          partsCost: { $sum: { $ifNull: ['$supplier_amount', 0] } },
        },
      },
    ]),
    Mobile.aggregate([
      { $match: { shop_id: shopId, ...HAS_TECH, 'payments.date': { $gte: start, $lte: end } } },
      { $unwind: '$payments' },
      { $match: { 'payments.date': { $gte: start, $lte: end } } },
      { $group: { _id: TECH_GROUP_KEY, name: { $first: '$technician_name' }, revenue: { $sum: '$payments.amount' } } },
    ]),
    Mobile.aggregate([
      { $match: { shop_id: shopId, ...HAS_TECH, created_at: { $gte: start, $lte: end }, paid_amount: { $gt: 0 }, ...LEGACY_PAYMENT } },
      { $group: { _id: TECH_GROUP_KEY, name: { $first: '$technician_name' }, revenue: { $sum: '$paid_amount' } } },
    ]),
  ]);

  const map = new Map();
  const row = (r) => {
    const key = techKey(r._id);
    if (!map.has(key)) map.set(key, emptyTech(String(r.name || '').trim()));
    return map.get(key);
  };
  jobs.forEach((r) => {
    const t = row(r);
    t.jobs += r.jobs; t.completed += r.completed; t.delivered += r.delivered;
    t.returned += r.returned; t.partsCost += r.partsCost || 0;
  });
  [...paid, ...legacy].forEach((r) => { row(r).revenue += r.revenue || 0; });
  map.forEach((t) => { t.partsCost = round2(t.partsCost); t.revenue = round2(t.revenue); });
  return map;
}

/**
 * Rolls technician metrics up to employees.
 * Returns { byEmployee: Map(employeeId → metrics), unlinked: [technician rows not matching any employee] }.
 */
function attributeServiceToEmployees(techMap, employees) {
  const match = buildEmployeeMatcher(employees);
  const byEmployee = new Map();
  const unlinked = [];
  techMap.forEach((t) => {
    const empId = match(t.name);
    if (!empId) { unlinked.push(t); return; }
    const agg = byEmployee.get(empId) || { ...emptyTech(''), technicianNames: [] };
    agg.jobs += t.jobs; agg.completed += t.completed; agg.delivered += t.delivered; agg.returned += t.returned;
    agg.partsCost = round2(agg.partsCost + t.partsCost);
    agg.revenue = round2(agg.revenue + t.revenue);
    agg.technicianNames.push(t.name);
    byEmployee.set(empId, agg);
  });
  unlinked.sort((a, b) => b.revenue - a.revenue || b.jobs - a.jobs);
  return { byEmployee, unlinked };
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Recent jobs handled by an employee (matched on code or name). */
async function getEmployeeServiceJobs(shopId, employee, start, end, limit = 25) {
  const names = [employee.employee_code, employee.name, employee.employee_name]
    .map((n) => String(n || '').trim())
    .filter(Boolean)
    .map((n) => new RegExp('^\\s*' + escapeRegex(n).replace(/\s+/g, '\\s+') + '\\s*$', 'i'));
  if (!names.length) return [];
  const rows = await Mobile.find({
    shop_id: shopId,
    technician_name: { $in: names },
    $or: [{ created_at: { $gte: start, $lte: end } }, { 'payments.date': { $gte: start, $lte: end } }],
  })
    .select('mobile_name model issue technician_name created_at ready delivered returned processing paid_amount total_paid supplier_amount payments')
    .sort({ created_at: -1 })
    .limit(limit)
    .lean();
  return rows.map((m) => ({
    id: m._id,
    device: `${m.mobile_name || ''} ${m.model || ''}`.trim(),
    issue: m.issue || '',
    createdAt: m.created_at,
    status: m.returned ? 'Returned' : m.delivered ? 'Delivered' : m.ready ? 'Ready' : m.processing ? 'Processing' : 'Pending',
    collected: round2(Array.isArray(m.payments) && m.payments.length
      ? m.payments.filter((p) => p.date >= start && p.date <= end).reduce((s, p) => s + (p.amount || 0), 0)
      : (m.created_at >= start && m.created_at <= end ? (m.paid_amount || 0) : 0)),
    partsCost: round2(m.supplier_amount || 0),
  }));
}

/** Shop-wide service financials for the period (all jobs, with or without technician). */
async function getServiceFinancials(shopId, start, end) {
  const dayExpr = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: IST_TZ } });
  const [jobs, paidByDay, legacyByDay, paidByMethod, expenseAgg] = await Promise.all([
    Mobile.aggregate([
      { $match: { shop_id: shopId, created_at: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: null,
          received: { $sum: 1 },
          completed: { $sum: { $cond: [{ $or: ['$ready', '$delivered'] }, 1, 0] } },
          delivered: { $sum: { $cond: ['$delivered', 1, 0] } },
          returned: { $sum: { $cond: ['$returned', 1, 0] } },
          partsCost: { $sum: { $ifNull: ['$supplier_amount', 0] } },
        },
      },
    ]),
    Mobile.aggregate([
      { $match: { shop_id: shopId, 'payments.date': { $gte: start, $lte: end } } },
      { $unwind: '$payments' },
      { $match: { 'payments.date': { $gte: start, $lte: end } } },
      { $group: { _id: dayExpr('$payments.date'), revenue: { $sum: '$payments.amount' } } },
    ]),
    Mobile.aggregate([
      { $match: { shop_id: shopId, created_at: { $gte: start, $lte: end }, paid_amount: { $gt: 0 }, ...LEGACY_PAYMENT } },
      { $group: { _id: dayExpr('$created_at'), revenue: { $sum: '$paid_amount' } } },
    ]),
    Mobile.aggregate([
      { $match: { shop_id: shopId, 'payments.date': { $gte: start, $lte: end } } },
      { $unwind: '$payments' },
      { $match: { 'payments.date': { $gte: start, $lte: end } } },
      { $group: { _id: { $ifNull: ['$payments.method', 'Cash'] }, amount: { $sum: '$payments.amount' } } },
    ]),
    Expense.aggregate([
      { $match: { userId: shopId, createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ]);

  const byDayMap = new Map();
  [...paidByDay, ...legacyByDay].forEach((r) => byDayMap.set(r._id, (byDayMap.get(r._id) || 0) + (r.revenue || 0)));
  const byDay = [...byDayMap.entries()].map(([date, revenue]) => ({ date, revenue: round2(revenue) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const revenue = round2(byDay.reduce((s, d) => s + d.revenue, 0));
  const j = jobs[0] || {};
  const received = j.received || 0;
  return {
    revenue,
    partsCost: round2(j.partsCost),
    expenses: round2(expenseAgg[0]?.total),
    expenseCount: expenseAgg[0]?.count || 0,
    jobs: {
      received,
      completed: j.completed || 0,
      delivered: j.delivered || 0,
      returned: j.returned || 0,
      pending: Math.max(0, received - (j.completed || 0) - (j.returned || 0)),
    },
    byDay,
    byPaymentMethod: paidByMethod.map((r) => ({ method: r._id, amount: round2(r.amount) })).sort((a, b) => b.amount - a.amount),
  };
}

module.exports = {
  techKey,
  buildEmployeeMatcher,
  getServiceByTechnician,
  attributeServiceToEmployees,
  getEmployeeServiceJobs,
  getServiceFinancials,
};

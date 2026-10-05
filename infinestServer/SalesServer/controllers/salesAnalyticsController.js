const Sale = require('../models/sale');
const Branch = require('../models/branch');
const { _getExpenseModel } = require('./branchExpenseController');

const IST_TZ = 'Asia/Kolkata';
const IST_OFFSET_MS = 330 * 60 * 1000; // India has no DST
const DAY_MS = 86400000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 366;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const istDayStart = (str) => {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - IST_OFFSET_MS);
};
const istToday = () => new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);

/** from/to are IST calendar days (YYYY-MM-DD); defaults to the current month to date. */
function parseRange(query = {}) {
  const today = istToday();
  const from = DAY_RE.test(query.from || '') ? query.from : `${today.slice(0, 7)}-01`;
  const to = DAY_RE.test(query.to || '') ? query.to : today;
  const start = istDayStart(from);
  const endStart = istDayStart(to);
  if (isNaN(start.getTime()) || isNaN(endStart.getTime())) return { error: 'from/to must be YYYY-MM-DD' };
  if (endStart < start) return { error: '"to" must be on or after "from"' };
  const days = Math.round((endStart - start) / DAY_MS) + 1;
  if (days > MAX_DAYS) return { error: `Date range cannot exceed ${MAX_DAYS} days` };
  return { from, to, start, end: new Date(endStart.getTime() + DAY_MS - 1), days };
}

// Per-sale derived values: GST, quantity and cost of goods (cost snapshot taken at sale time)
const SALE_FIELDS = {
  $addFields: {
    _gst: { $add: [{ $ifNull: ['$cgstAmount', 0] }, { $ifNull: ['$sgstAmount', 0] }, { $ifNull: ['$igstAmount', 0] }] },
    _net: { $ifNull: ['$taxableAmount', { $subtract: [{ $ifNull: ['$subTotal', 0] }, { $ifNull: ['$discountAmount', 0] }] }] },
    _qty: { $reduce: { input: { $ifNull: ['$items', []] }, initialValue: 0, in: { $add: ['$$value', { $ifNull: ['$$this.qty', 0] }] } } },
    _cogs: {
      $reduce: {
        input: { $ifNull: ['$items', []] }, initialValue: 0,
        in: { $add: ['$$value', { $multiply: [{ $ifNull: ['$$this.costPrice', 0] }, { $ifNull: ['$$this.qty', 0] }] }] }
      }
    },
    _uncosted: {
      $size: { $filter: { input: { $ifNull: ['$items', []] }, cond: { $lte: [{ $ifNull: ['$$this.costPrice', 0] }, 0] } } }
    }
  }
};

const TOTALS_GROUP = {
  salesCount: { $sum: 1 },
  grossSales: { $sum: { $ifNull: ['$subTotal', 0] } },
  discount: { $sum: { $ifNull: ['$discountAmount', 0] } },
  netSales: { $sum: '$_net' },
  gst: { $sum: '$_gst' },
  totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } },
  itemsSold: { $sum: '$_qty' },
  cogs: { $sum: '$_cogs' },
  uncostedItems: { $sum: '$_uncosted' }
};

function shapeTotals(t = {}) {
  const netSales = round2(t.netSales);
  const cogs = round2(t.cogs);
  const grossProfit = round2(netSales - cogs);
  return {
    salesCount: t.salesCount || 0,
    grossSales: round2(t.grossSales),
    discount: round2(t.discount),
    netSales,
    gst: round2(t.gst),
    totalAmount: round2(t.totalAmount),
    itemsSold: t.itemsSold || 0,
    cogs,
    grossProfit,
    marginPercent: netSales > 0 ? round2((grossProfit / netSales) * 100) : 0,
    avgBillValue: t.salesCount ? round2(t.totalAmount / t.salesCount) : 0,
    uncostedItems: t.uncostedItems || 0
  };
}

/**
 * Sales analytics for a shop and period. branch_id (optional) restricts to one branch.
 * Revenue figures: netSales = after discount, before GST (commission basis); totalAmount = billed incl. GST.
 */
async function buildSummary({ shop_id, branch_id, start, end }) {
  const match = { shop_id: String(shop_id), createdAt: { $gte: start, $lte: end } };
  if (branch_id) match.branch_id = String(branch_id);
  const dayExpr = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: IST_TZ } };

  const [facet] = await Sale.aggregate([
    { $match: match },
    SALE_FIELDS,
    {
      $facet: {
        totals: [{ $group: { _id: null, ...TOTALS_GROUP } }],
        byDay: [{ $group: { _id: dayExpr, ...TOTALS_GROUP } }, { $sort: { _id: 1 } }],
        byBranch: [{ $group: { _id: '$branch_id', ...TOTALS_GROUP } }, { $sort: { netSales: -1 } }],
        byPayment: [{ $group: { _id: { $ifNull: ['$paymentMethod', 'Cash'] }, count: { $sum: 1 }, amount: { $sum: '$totalAmount' } } }, { $sort: { amount: -1 } }],
        byEmployee: [
          {
            $group: {
              _id: { $ifNull: ['$employee_id', ''] },
              code: { $last: '$employee_code' },
              name: { $last: '$employee_name' },
              lastSaleAt: { $max: '$createdAt' },
              activeDays: { $addToSet: dayExpr },
              ...TOTALS_GROUP
            }
          },
          { $sort: { netSales: -1 } }
        ],
        byHour: [
          { $group: { _id: { $hour: { date: '$createdAt', timezone: IST_TZ } }, count: { $sum: 1 }, amount: { $sum: '$totalAmount' } } },
          { $sort: { _id: 1 } }
        ],
        topProducts: [
          { $unwind: '$items' },
          {
            $group: {
              _id: { $ifNull: [{ $cond: [{ $gt: ['$items.productNo', ''] }, '$items.productNo', null] }, '$items.productName'] },
              productName: { $last: '$items.productName' },
              productNo: { $last: '$items.productNo' },
              qty: { $sum: { $ifNull: ['$items.qty', 0] } },
              revenue: { $sum: { $ifNull: ['$items.lineTotal', 0] } },
              cost: { $sum: { $multiply: [{ $ifNull: ['$items.costPrice', 0] }, { $ifNull: ['$items.qty', 0] }] } }
            }
          },
          { $sort: { revenue: -1 } },
          { $limit: 10 }
        ]
      }
    }
  ]);

  const expenseMatch = { shop_id: String(shop_id), date: { $gte: start, $lte: end } };
  if (branch_id) expenseMatch.branch_id = String(branch_id);
  const [expenseAgg, branches] = await Promise.all([
    _getExpenseModel().aggregate([
      { $match: expenseMatch },
      { $group: { _id: '$branch_id', total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]),
    Branch.find({ shop_id: String(shop_id) }).select('name').lean()
  ]);
  const branchName = new Map(branches.map((b) => [String(b._id), b.name || '']));
  const expensesByBranch = new Map(expenseAgg.map((e) => [String(e._id || ''), round2(e.total)]));
  const totalExpenses = round2(expenseAgg.reduce((s, e) => s + (e.total || 0), 0));

  const totals = shapeTotals(facet?.totals?.[0]);
  const byEmployee = (facet?.byEmployee || []).map((r) => ({
    employeeId: r._id || null,
    code: r.code || '',
    name: r.name || '',
    activeDays: (r.activeDays || []).length,
    lastSaleAt: r.lastSaleAt,
    ...shapeTotals(r)
  }));
  const attributed = byEmployee.filter((r) => r.employeeId);
  const unattributed = byEmployee.find((r) => !r.employeeId) || shapeTotals();

  return {
    totals: {
      ...totals,
      expenses: totalExpenses,
      operatingProfit: round2(totals.grossProfit - totalExpenses),
      attributedSales: attributed.reduce((s, r) => s + r.salesCount, 0),
      attributedNetSales: round2(attributed.reduce((s, r) => s + r.netSales, 0))
    },
    byDay: (facet?.byDay || []).map((r) => ({ date: r._id, ...shapeTotals(r) })),
    byBranch: (facet?.byBranch || []).map((r) => ({
      branchId: r._id,
      branchName: branchName.get(String(r._id)) || 'Unknown branch',
      expenses: expensesByBranch.get(String(r._id)) || 0,
      ...shapeTotals(r)
    })),
    byPayment: (facet?.byPayment || []).map((r) => ({ method: r._id || 'Cash', count: r.count, amount: round2(r.amount) })),
    byHour: (facet?.byHour || []).map((r) => ({ hour: r._id, count: r.count, amount: round2(r.amount) })),
    topProducts: (facet?.topProducts || []).map((r) => ({
      productNo: r.productNo || '',
      productName: r.productName || r._id || '',
      qty: r.qty,
      revenue: round2(r.revenue),
      cost: round2(r.cost)
    })),
    byEmployee: attributed,
    unattributed: { salesCount: unattributed.salesCount || 0, netSales: unattributed.netSales || 0, totalAmount: unattributed.totalAmount || 0 }
  };
}

/** Day-wise trend, top products and latest bills for one salesperson. */
async function buildEmployeeDetail({ shop_id, employee_id, start, end }) {
  const match = { shop_id: String(shop_id), employee_id: String(employee_id), createdAt: { $gte: start, $lte: end } };
  const dayExpr = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: IST_TZ } };
  const [facet] = await Sale.aggregate([
    { $match: match },
    SALE_FIELDS,
    {
      $facet: {
        totals: [{ $group: { _id: null, ...TOTALS_GROUP } }],
        byDay: [{ $group: { _id: dayExpr, ...TOTALS_GROUP } }, { $sort: { _id: 1 } }],
        topProducts: [
          { $unwind: '$items' },
          {
            $group: {
              _id: '$items.productName',
              qty: { $sum: { $ifNull: ['$items.qty', 0] } },
              revenue: { $sum: { $ifNull: ['$items.lineTotal', 0] } }
            }
          },
          { $sort: { revenue: -1 } },
          { $limit: 5 }
        ],
        recent: [
          { $sort: { createdAt: -1 } },
          { $limit: 20 },
          { $project: { createdAt: 1, customerName: 1, customerNo: 1, totalAmount: 1, paymentMethod: 1, branch_id: 1, _qty: 1, _net: 1 } }
        ]
      }
    }
  ]);
  const branches = await Branch.find({ shop_id: String(shop_id) }).select('name').lean();
  const branchName = new Map(branches.map((b) => [String(b._id), b.name || '']));
  return {
    totals: shapeTotals(facet?.totals?.[0]),
    byDay: (facet?.byDay || []).map((r) => ({ date: r._id, ...shapeTotals(r) })),
    topProducts: (facet?.topProducts || []).map((r) => ({ productName: r._id || '', qty: r.qty, revenue: round2(r.revenue) })),
    recentSales: (facet?.recent || []).map((s) => ({
      id: String(s._id),
      createdAt: s.createdAt,
      customerName: s.customerName || '',
      customerNo: s.customerNo || '',
      branchName: branchName.get(String(s.branch_id)) || '',
      items: s._qty || 0,
      netSales: round2(s._net),
      totalAmount: round2(s.totalAmount),
      paymentMethod: s.paymentMethod || ''
    }))
  };
}

// Branch tokens are always limited to their own branch
const scopedBranch = (req) => (req.user?.isBranch ? req.user.branch_id : (req.query.branch_id || null));

exports.summary = async (req, res) => {
  try {
    const range = parseRange(req.query);
    if (range.error) return res.status(400).json({ success: false, message: range.error });
    const summary = await buildSummary({ shop_id: req.user.shop_id, branch_id: scopedBranch(req), ...range });
    return res.json({ success: true, range: { from: range.from, to: range.to, days: range.days }, summary });
  } catch (err) {
    console.error('salesAnalytics.summary error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.employeeDetail = async (req, res) => {
  try {
    const range = parseRange(req.query);
    if (range.error) return res.status(400).json({ success: false, message: range.error });
    if (!req.params.employeeId) return res.status(400).json({ success: false, message: 'employeeId required' });
    const detail = await buildEmployeeDetail({ shop_id: req.user.shop_id, employee_id: req.params.employeeId, ...range });
    return res.json({ success: true, range: { from: range.from, to: range.to, days: range.days }, detail });
  } catch (err) {
    console.error('salesAnalytics.employeeDetail error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Internal (x-internal-key) variants used by BillitServer for HR performance, payroll and business analytics ──

exports.internalSummary = async (req, res) => {
  try {
    if (!req.query.shop_id) return res.status(400).json({ success: false, message: 'shop_id required' });
    const range = parseRange(req.query);
    if (range.error) return res.status(400).json({ success: false, message: range.error });
    const summary = await buildSummary({ shop_id: req.query.shop_id, ...range });
    return res.json({ success: true, range: { from: range.from, to: range.to, days: range.days }, summary });
  } catch (err) {
    console.error('salesAnalytics.internalSummary error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.internalEmployeeDetail = async (req, res) => {
  try {
    const { shop_id, employee_id } = req.query;
    if (!shop_id || !employee_id) return res.status(400).json({ success: false, message: 'shop_id and employee_id required' });
    const range = parseRange(req.query);
    if (range.error) return res.status(400).json({ success: false, message: range.error });
    const detail = await buildEmployeeDetail({ shop_id, employee_id, ...range });
    return res.json({ success: true, range: { from: range.from, to: range.to, days: range.days }, detail });
  } catch (err) {
    console.error('salesAnalytics.internalEmployeeDetail error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.parseRange = parseRange;
exports.buildSummary = buildSummary;

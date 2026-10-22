const mongoose = require('mongoose');
const Sale = require('../models/sale');
const WhatsappSale = require('../models/whatsappSale');
const SecondsSale = require('../models/secondsSale');
const SupplierCredit = require('../models/supplierCredit');
const Supplier = require('../models/supplier');
const Branch = require('../models/branch');
const BranchStock = require('../models/branchStock');
const { _getExpenseModel } = require('./branchExpenseController');
const { parseRange } = require('./salesAnalyticsController');

/**
 * Sales financial report for a shop and period.
 *
 * There is no fixed selling price: every product is stocked at cost and the salesperson prices it at the POS.
 *   Sales profit  = what the item was sold for (after bill discount, before GST) − its cost snapshot
 *   Net profit    = sales profit − expenses
 *   Net cash flow = money collected − dealer (supplier credit) payments − expenses − second-hand phones bought
 * Dealer payments are cash leaving the shop for stock already bought; they are shown as cash flow and are not
 * subtracted from profit again (sales profit already deducts the cost of what was sold).
 *
 * Filters: branch_id, employee_id ('none' = sales with no salesperson), payment (Cash | Gpay | Card).
 * The salesperson filter narrows sales only; the payment filter also narrows expenses and dealer payments.
 */

const IST_OFFSET_MS = 330 * 60 * 1000;
const PAYMENT_MODES = ['Cash', 'Gpay', 'Card'];
const MAX_ROWS = 3000;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const istDay = (d) => new Date(new Date(d).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
const asObjectId = (id) => (mongoose.Types.ObjectId.isValid(String(id)) ? new mongoose.Types.ObjectId(String(id)) : null);
// Shop/branch ids are stored as strings on some collections and ObjectIds on others
const idValues = (id) => { const oid = asObjectId(id); return oid ? [String(id), oid] : [String(id)]; };

// Payment modes a label covers: "Cash + Gpay" -> ['Cash', 'Gpay']; legacy "Gpay H + CASH", "UPI-S", "online" too
function modesOf(label) {
  const parts = String(label || 'Cash').split('+').map((p) => p.trim().toLowerCase()).filter(Boolean);
  const out = new Set();
  parts.forEach((p) => {
    if (p.startsWith('cash')) out.add('Cash');
    else if (p.startsWith('gpay') || p.startsWith('upi') || p === 'online') out.add('Gpay');
    else if (p.startsWith('card')) out.add('Card');
  });
  return out.size ? [...out] : ['Other'];
}

// Amount per payment mode for one sale; older sales without splits share their label evenly
function paymentParts(sale) {
  if (Array.isArray(sale.paymentSplits) && sale.paymentSplits.length) {
    return sale.paymentSplits.map((p) => ({ method: p.method || 'Cash', amount: Number(p.amount) || 0 }));
  }
  const modes = modesOf(sale.paymentMethod);
  const total = Number(sale.totalAmount) || 0;
  return modes.map((m) => ({ method: m, amount: total / modes.length }));
}

/**
 * Sales made before the cost snapshot existed carry costPrice 0; fall back to the branch stock's current cost
 * (matched by productId, then product code) so their profit is not reported as 100%.
 */
async function fillMissingCosts(shop_id, saleDocs) {
  const missing = [];
  saleDocs.forEach((s) => (s.items || []).forEach((it) => { if (!(Number(it.costPrice) > 0)) missing.push({ s, it }); }));
  if (!missing.length) return;
  const ids = [...new Set(missing.map((m) => String(m.it.productId || '')).filter(Boolean))];
  const codes = [...new Set(missing.map((m) => String(m.it.productNo || '').trim()).filter(Boolean))];
  const stock = await BranchStock.find({
    shop_id: String(shop_id),
    costPrice: { $gt: 0 },
    $or: [{ productId: { $in: ids } }, { productNo: { $in: codes } }],
  }).select('branch_id productId productNo costPrice').lean();
  const byId = new Map();
  const byCode = new Map();
  stock.forEach((r) => {
    byId.set(`${r.branch_id}|${r.productId}`, r.costPrice);
    if (r.productNo) byCode.set(`${r.branch_id}|${String(r.productNo).trim().toLowerCase()}`, r.costPrice);
  });
  missing.forEach(({ s, it }) => {
    const b = String(s.branch_id || '');
    const cost = byId.get(`${b}|${it.productId}`) || byCode.get(`${b}|${String(it.productNo || '').trim().toLowerCase()}`);
    if (cost > 0) { it.costPrice = cost; it.costEstimated = true; }
  });
}

const itemQty = (it) => Number(it.qty ?? it.sellingQty ?? 0) || 0;
const itemGross = (it) => {
  const line = Number(it.lineTotal);
  return Number.isFinite(line) && line > 0 ? line : itemQty(it) * (Number(it.sellingPrice) || 0);
};

function emptyTotals() {
  return { bills: 0, itemsSold: 0, grossSales: 0, discount: 0, netSales: 0, gst: 0, revenue: 0, cogs: 0, salesProfit: 0, uncostedItems: 0, estimatedCostItems: 0 };
}
function addTotals(t, s) {
  t.bills += 1;
  t.itemsSold += s.itemsSold;
  t.grossSales += s.grossSales;
  t.discount += s.discount;
  t.netSales += s.netSales;
  t.gst += s.gst;
  t.revenue += s.revenue;
  t.cogs += s.cogs;
  t.salesProfit += s.profit;
  t.uncostedItems += s.uncostedItems;
  t.estimatedCostItems += s.estimatedCostItems || 0;
}
const shapeTotals = (t) => ({
  bills: t.bills,
  itemsSold: t.itemsSold,
  grossSales: round2(t.grossSales),
  discount: round2(t.discount),
  netSales: round2(t.netSales),
  gst: round2(t.gst),
  revenue: round2(t.revenue),
  cogs: round2(t.cogs),
  salesProfit: round2(t.salesProfit),
  marginPercent: t.netSales > 0 ? round2((t.salesProfit / t.netSales) * 100) : 0,
  uncostedItems: t.uncostedItems,
  estimatedCostItems: t.estimatedCostItems,
});

/**
 * Normalises a POS sale or a WhatsApp sale into one shape with profit per bill and per item.
 * The bill discount is spread over the items in proportion to their value.
 */
function normaliseSale(sale, source) {
  const items = Array.isArray(sale.items) ? sale.items : [];
  const grossSales = source === 'pos' && Number(sale.subTotal) > 0 ? Number(sale.subTotal) : items.reduce((s, it) => s + itemGross(it), 0);
  const discount = source === 'pos' ? Number(sale.discountAmount) || 0 : 0;
  const netSales = source === 'pos' && sale.taxableAmount != null ? Number(sale.taxableAmount) || 0 : Math.max(0, grossSales - discount);
  const gst = source === 'pos' ? (Number(sale.cgstAmount) || 0) + (Number(sale.sgstAmount) || 0) + (Number(sale.igstAmount) || 0) : 0;
  const revenue = Number(sale.totalAmount) || netSales + gst;
  const share = grossSales > 0 ? netSales / grossSales : 1;

  let cogs = 0;
  let uncostedItems = 0;
  let estimatedCostItems = 0;
  let itemsSold = 0;
  const lines = items.map((it) => {
    const qty = itemQty(it);
    const cost = (Number(it.costPrice) || 0) * qty;
    const net = itemGross(it) * share;
    if (!(Number(it.costPrice) > 0)) uncostedItems += 1;
    else if (it.costEstimated) estimatedCostItems += 1;
    cogs += cost;
    itemsSold += qty;
    return {
      productNo: it.productNo || '',
      productName: it.productName || '',
      qty,
      soldAt: Number(it.sellingPrice) || (qty ? itemGross(it) / qty : 0),
      costPrice: Number(it.costPrice) || 0,
      net,
      cost,
      profit: net - cost,
    };
  });

  return {
    id: String(sale._id),
    source,
    date: sale.createdAt,
    day: istDay(sale.createdAt),
    invoiceNo: sale.invoiceNo || null,
    branchId: String(sale.branch_id || ''),
    customerName: sale.customerName || '',
    customerNo: sale.customerNo || '',
    employeeId: sale.employee_id || '',
    employeeCode: sale.employee_code || '',
    employeeName: sale.employee_name || '',
    paymentMethod: sale.paymentMethod || '',
    payments: paymentParts(sale),
    itemsSold,
    grossSales,
    discount,
    netSales,
    gst,
    revenue,
    cogs,
    profit: netSales - cogs,
    uncostedItems,
    estimatedCostItems,
    lines,
  };
}

async function buildFinancialReport({ shop_id, branch_id, employee_id, payment, start, end }) {
  const shopIds = idValues(shop_id);
  const modeFilter = PAYMENT_MODES.includes(payment) ? payment : null;
  const usesMode = (label) => !modeFilter || modesOf(label).includes(modeFilter);

  // ── Sales (POS + WhatsApp) ──
  const saleMatch = { shop_id: String(shop_id), createdAt: { $gte: start, $lte: end } };
  const waMatch = { shop_id: { $in: shopIds }, createdAt: { $gte: start, $lte: end } };
  if (branch_id) {
    saleMatch.branch_id = String(branch_id);
    waMatch.branch_id = { $in: idValues(branch_id) };
  }
  if (employee_id) {
    const emp = employee_id === 'none' ? '' : String(employee_id);
    saleMatch.employee_id = emp;
    waMatch.employee_id = emp;
  }
  const saleFields = 'createdAt invoiceNo branch_id customerName customerNo employee_id employee_code employee_name items subTotal discountAmount taxableAmount cgstAmount sgstAmount igstAmount totalAmount paymentMethod paymentSplits';

  const [posSales, waSales, seconds, expenseDocs, credits, branches] = await Promise.all([
    Sale.find(saleMatch).select(saleFields).sort({ createdAt: 1 }).lean(),
    WhatsappSale.find(waMatch).select(saleFields).sort({ createdAt: 1 }).lean(),
    // Second-hand phones: bought from a seller (cash out) and resold (purchases[] = resale entries)
    employee_id ? Promise.resolve([]) : SecondsSale.find({
      shop_id: { $in: shopIds },
      ...(branch_id ? { branch_id: { $in: idValues(branch_id) } } : {}),
      $or: [{ createdAt: { $gte: start, $lte: end } }, { 'purchases.createdAt': { $gte: start, $lte: end } }],
    }).select('createdAt branch_id mobileName model imeNo valueOfProduct paymentMethod purchases').lean(),
    _getExpenseModel().find({
      shop_id: String(shop_id),
      date: { $gte: start, $lte: end },
      ...(branch_id ? { branch_id: String(branch_id) } : {}),
    }).sort({ date: 1 }).lean(),
    SupplierCredit.find({
      shop_id: { $in: shopIds },
      'payments.0': { $exists: true },
      ...(branch_id ? { branch_id: String(branch_id) } : {}),
    }).select('supplier_id branch_id kind payments').lean(),
    Branch.find({ shop_id: String(shop_id) }).select('name').lean(),
  ]);

  await fillMissingCosts(shop_id, [...posSales, ...waSales]);

  const branchName = new Map(branches.map((b) => [String(b._id), b.name || '']));
  const nameOfBranch = (id) => (id ? branchName.get(String(id)) || 'Head office' : 'Head office');

  const sales = [
    ...posSales.map((s) => normaliseSale(s, 'pos')),
    ...waSales.map((s) => normaliseSale(s, 'whatsapp')),
  ].filter((s) => !modeFilter || s.payments.some((p) => p.method === modeFilter && p.amount > 0));

  // ── Second-hand phones ──
  const secondsRows = [];
  let secondsPurchases = 0;
  const secondsPurchaseRows = [];
  seconds.forEach((doc) => {
    const bought = new Date(doc.createdAt);
    if (bought >= start && bought <= end && usesMode(doc.paymentMethod)) {
      secondsPurchases += Number(doc.valueOfProduct) || 0;
      secondsPurchaseRows.push({ date: doc.createdAt, day: istDay(doc.createdAt), branchId: String(doc.branch_id || ''), amount: Number(doc.valueOfProduct) || 0 });
    }
    (doc.purchases || []).forEach((p) => {
      const at = new Date(p.createdAt || doc.updatedAt || doc.createdAt);
      if (at < start || at > end) return;
      const price = Number(p.price) || 0;
      const cost = Number(doc.valueOfProduct) || 0;
      secondsRows.push({
        id: `${doc._id}-${secondsRows.length}`,
        source: 'seconds',
        date: at,
        day: istDay(at),
        invoiceNo: null,
        branchId: String(doc.branch_id || ''),
        customerName: p.customerName || '',
        customerNo: p.phone || '',
        employeeId: '', employeeCode: '', employeeName: '',
        paymentMethod: p.bankName ? 'Bank' : '',
        payments: [],
        itemsSold: 1,
        grossSales: price, discount: 0, netSales: price, gst: 0, revenue: price,
        cogs: cost, profit: price - cost, uncostedItems: cost > 0 ? 0 : 1,
        lines: [{ productNo: doc.imeNo || '', productName: [doc.mobileName, doc.model].filter(Boolean).join(' ') || 'Second-hand phone', qty: 1, soldAt: price, costPrice: cost, net: price, cost, profit: price - cost }],
      });
    });
  });
  // A payment-mode filter cannot be applied to resales (no mode is recorded), so they are left out then
  const allSales = modeFilter ? sales : [...sales, ...secondsRows];

  // ── Expenses ──
  const expenses = expenseDocs
    .filter((e) => usesMode(e.paymentMethod))
    .map((e) => ({
      id: String(e._id),
      date: e.date || e.createdAt,
      day: istDay(e.date || e.createdAt),
      branchId: String(e.branch_id || ''),
      branchName: nameOfBranch(branchName.has(String(e.branch_id)) ? e.branch_id : ''),
      title: e.title || '',
      paymentMethod: e.paymentMethod || '',
      amount: round2(e.amount),
    }));

  // ── Dealer (supplier credit) payments, one row per payment (a payment spread over several bills shares a batch) ──
  const supplierIds = [...new Set(credits.map((c) => String(c.supplier_id)))];
  const suppliers = supplierIds.length ? await Supplier.find({ _id: { $in: supplierIds } }).select('supplierName agencyName').lean() : [];
  const supplierName = new Map(suppliers.map((s) => [String(s._id), s.supplierName || s.agencyName || 'Dealer']));
  const paymentRows = new Map();
  credits.forEach((c) => {
    (c.payments || []).forEach((p) => {
      const at = new Date(p.paidOn || p.createdAt);
      if (isNaN(at.getTime()) || at < start || at > end) return;
      if (!usesMode(p.method)) return;
      const key = p.batch ? `b:${p.batch}` : `p:${p._id}`;
      const row = paymentRows.get(key) || {
        id: key,
        date: at,
        day: istDay(at),
        supplierId: String(c.supplier_id),
        dealer: supplierName.get(String(c.supplier_id)) || 'Dealer',
        branchId: String(c.branch_id || ''),
        branchName: nameOfBranch(c.branch_id),
        method: p.method || '',
        note: p.note || '',
        bills: 0,
        amount: 0,
      };
      row.bills += 1;
      row.amount += Number(p.amount) || 0;
      paymentRows.set(key, row);
    });
  });
  const supplierPayments = [...paymentRows.values()].sort((a, b) => a.date - b.date).map((r) => ({ ...r, amount: round2(r.amount) }));

  // ── Totals ──
  const salesTotals = emptyTotals();
  allSales.forEach((s) => addTotals(salesTotals, s));
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalSupplierPayments = supplierPayments.reduce((s, p) => s + p.amount, 0);
  const secondsRevenue = secondsRows.reduce((s, r) => s + r.revenue, 0);
  const secondsProfit = secondsRows.reduce((s, r) => s + r.profit, 0);
  const shaped = shapeTotals(salesTotals);
  const netProfit = salesTotals.salesProfit - totalExpenses;
  const cashOut = totalSupplierPayments + totalExpenses + secondsPurchases;

  const summary = {
    ...shaped,
    posBills: allSales.filter((s) => s.source === 'pos').length,
    whatsappBills: allSales.filter((s) => s.source === 'whatsapp').length,
    secondsSold: modeFilter ? 0 : secondsRows.length,
    secondsRevenue: modeFilter ? 0 : round2(secondsRevenue),
    secondsProfit: modeFilter ? 0 : round2(secondsProfit),
    expenses: round2(totalExpenses),
    expenseCount: expenses.length,
    netProfit: round2(netProfit),
    netMarginPercent: salesTotals.netSales > 0 ? round2((netProfit / salesTotals.netSales) * 100) : 0,
    supplierPayments: round2(totalSupplierPayments),
    supplierPaymentCount: supplierPayments.length,
    secondsPurchases: round2(secondsPurchases),
    collected: round2(salesTotals.revenue),
    cashOut: round2(cashOut),
    netCashFlow: round2(salesTotals.revenue - cashOut),
    avgBillValue: salesTotals.bills ? round2(salesTotals.revenue / salesTotals.bills) : 0,
  };

  // ── Day-wise (every day in the range, so charts and exports have no gaps) ──
  const days = new Map();
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    const day = istDay(t);
    days.set(day, { date: day, ...emptyTotals(), expenses: 0, supplierPayments: 0, secondsPurchases: 0 });
  }
  const dayOf = (d) => days.get(d) || days.set(d, { date: d, ...emptyTotals(), expenses: 0, supplierPayments: 0, secondsPurchases: 0 }).get(d);
  allSales.forEach((s) => addTotals(dayOf(s.day), s));
  expenses.forEach((e) => { dayOf(e.day).expenses += e.amount; });
  supplierPayments.forEach((p) => { dayOf(p.day).supplierPayments += p.amount; });
  secondsPurchaseRows.forEach((p) => { dayOf(p.day).secondsPurchases += p.amount; });
  const byDay = [...days.values()].sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({
    date: d.date,
    ...shapeTotals(d),
    expenses: round2(d.expenses),
    supplierPayments: round2(d.supplierPayments),
    netProfit: round2(d.salesProfit - d.expenses),
    netCashFlow: round2(d.revenue - d.supplierPayments - d.expenses - d.secondsPurchases),
  }));

  // ── By branch ──
  const branchRows = new Map();
  const branchRow = (id) => {
    const key = branchName.has(String(id)) ? String(id) : '';
    if (!branchRows.has(key)) branchRows.set(key, { branchId: key, branchName: nameOfBranch(key), ...emptyTotals(), expenses: 0, supplierPayments: 0 });
    return branchRows.get(key);
  };
  allSales.forEach((s) => addTotals(branchRow(s.branchId), s));
  expenses.forEach((e) => { branchRow(e.branchId).expenses += e.amount; });
  supplierPayments.forEach((p) => { branchRow(p.branchId).supplierPayments += p.amount; });
  const byBranch = [...branchRows.values()].map((b) => ({
    branchId: b.branchId || null,
    branchName: b.branchName,
    ...shapeTotals(b),
    expenses: round2(b.expenses),
    supplierPayments: round2(b.supplierPayments),
    netProfit: round2(b.salesProfit - b.expenses),
  })).sort((a, b) => b.salesProfit - a.salesProfit);

  // ── By payment mode (money received) ──
  const payRows = new Map();
  allSales.forEach((s) => s.payments.forEach((p) => {
    if (modeFilter && p.method !== modeFilter) return;
    const r = payRows.get(p.method) || { method: p.method, bills: 0, amount: 0 };
    r.bills += 1; r.amount += p.amount;
    payRows.set(p.method, r);
  }));
  const byPayment = [...payRows.values()].map((r) => ({ ...r, amount: round2(r.amount) })).sort((a, b) => b.amount - a.amount);

  // ── By salesperson ──
  const empRows = new Map();
  allSales.filter((s) => s.source !== 'seconds').forEach((s) => {
    const key = s.employeeId || '';
    if (!empRows.has(key)) empRows.set(key, { employeeId: key || null, code: s.employeeCode, name: s.employeeName || (key ? '' : 'Not recorded'), ...emptyTotals() });
    addTotals(empRows.get(key), s);
  });
  const byEmployee = [...empRows.values()].map((e) => ({ employeeId: e.employeeId, code: e.code, name: e.name, ...shapeTotals(e) }))
    .sort((a, b) => b.salesProfit - a.salesProfit);

  // ── By product ──
  const prodRows = new Map();
  allSales.forEach((s) => s.lines.forEach((l) => {
    const key = (l.productNo || l.productName || '').toLowerCase();
    const r = prodRows.get(key) || { productNo: l.productNo, productName: l.productName, qty: 0, revenue: 0, cost: 0, profit: 0 };
    r.qty += l.qty; r.revenue += l.net; r.cost += l.cost; r.profit += l.profit;
    prodRows.set(key, r);
  }));
  const products = [...prodRows.values()]
    .map((r) => ({ ...r, revenue: round2(r.revenue), cost: round2(r.cost), profit: round2(r.profit), marginPercent: r.revenue > 0 ? round2((r.profit / r.revenue) * 100) : 0 }))
    .sort((a, b) => b.profit - a.profit);

  // ── Bill register ──
  const bills = [...allSales].sort((a, b) => new Date(b.date) - new Date(a.date)).map((s) => ({
    id: s.id,
    source: s.source,
    date: s.date,
    invoiceNo: s.invoiceNo,
    branchName: nameOfBranch(branchName.has(s.branchId) ? s.branchId : ''),
    customerName: s.customerName,
    customerNo: s.customerNo,
    employeeName: s.employeeName,
    employeeCode: s.employeeCode,
    paymentMethod: s.paymentMethod,
    items: s.lines.map((l) => ({ productNo: l.productNo, productName: l.productName, qty: l.qty, soldAt: round2(l.soldAt), costPrice: round2(l.costPrice), profit: round2(l.profit) })),
    itemsSold: s.itemsSold,
    netSales: round2(s.netSales),
    gst: round2(s.gst),
    revenue: round2(s.revenue),
    cost: round2(s.cogs),
    profit: round2(s.profit),
  }));

  return {
    summary,
    byDay,
    byBranch,
    byPayment,
    byEmployee,
    products: products.slice(0, MAX_ROWS),
    bills: bills.slice(0, MAX_ROWS),
    expenses: expenses.slice(0, MAX_ROWS),
    supplierPayments: supplierPayments.slice(0, MAX_ROWS),
    truncated: bills.length > MAX_ROWS || expenses.length > MAX_ROWS || supplierPayments.length > MAX_ROWS,
    branches: branches.map((b) => ({ id: String(b._id), name: b.name || '' })),
  };
}

function filtersOf(query) {
  return {
    employee_id: query.employee_id ? String(query.employee_id) : null,
    payment: query.payment ? String(query.payment) : null,
  };
}

exports.report = async (req, res) => {
  try {
    const range = parseRange(req.query);
    if (range.error) return res.status(400).json({ success: false, message: range.error });
    // Branch tokens only ever see their own branch
    const branch_id = req.user?.isBranch ? req.user.branch_id : (req.query.branch_id || null);
    const report = await buildFinancialReport({ shop_id: req.user.shop_id, branch_id, ...filtersOf(req.query), ...range });
    return res.json({ success: true, range: { from: range.from, to: range.to, days: range.days }, report });
  } catch (err) {
    console.error('financialReport.report error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Server-to-server (BillitServer shop-admin financial report)
exports.internalReport = async (req, res) => {
  try {
    if (!req.query.shop_id) return res.status(400).json({ success: false, message: 'shop_id required' });
    const range = parseRange(req.query);
    if (range.error) return res.status(400).json({ success: false, message: range.error });
    const report = await buildFinancialReport({ shop_id: req.query.shop_id, branch_id: req.query.branch_id || null, ...filtersOf(req.query), ...range });
    return res.json({ success: true, range: { from: range.from, to: range.to, days: range.days }, report });
  } catch (err) {
    console.error('financialReport.internalReport error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.buildFinancialReport = buildFinancialReport;

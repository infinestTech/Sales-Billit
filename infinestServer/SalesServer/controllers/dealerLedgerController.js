const crypto = require('crypto');
const mongoose = require('mongoose');
const Supplier = require('../models/supplier');
const SupplierCredit = require('../models/supplierCredit');

// Dealer (supplier) credit book for the branch portal: what the shop owes each dealer from credit purchases and
// opening credit, and day-by-day payments. A payment settles the dealer's bills oldest first (opening credit,
// then purchases by date) — the same rule as the Service app's supplier ledger. Branch tokens see only their
// branch's dealers and bills; owner tokens see the whole shop.

const PAY_METHODS = ['Cash', 'Gpay', 'Card', 'Bank Transfer', 'Cheque'];
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const outstandingOf = (c) => round2((Number(c.totalAmount) || 0) - (Number(c.paidAmount) || 0));
const isObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || '')) && /^[0-9a-fA-F]{24}$/.test(String(id));

function scope(req) {
  const q = { shop_id: req.user.shop_id };
  if (req.user.isBranch && req.user.branch_id) q.branch_id = String(req.user.branch_id);
  return q;
}

// Oldest first: opening credit, then by purchase date
const settleOrder = (a, b) =>
  (a.kind === 'opening' ? 0 : 1) - (b.kind === 'opening' ? 0 : 1) || new Date(a.createdAt) - new Date(b.createdAt);

const billLabel = (c) =>
  c.kind === 'opening' ? 'Opening credit'
    : c.branchSupply_id && c.branchSupply_id.billNo ? `Bill ${c.branchSupply_id.billNo}`
      : 'Credit purchase';

function startOfTodayIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + 330 * 60000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 330 * 60000);
}

async function findDealer(req, supplierId) {
  if (!isObjectId(supplierId)) return null;
  const q = { _id: supplierId, shop_id: req.user.shop_id };
  if (req.user.isBranch && req.user.branch_id) q.branch_id = String(req.user.branch_id);
  return Supplier.findOne(q).lean();
}

// GET /api/dealer-ledger — every dealer with credit totals, plus shop/branch totals
exports.summary = async (req, res) => {
  try {
    const dealerQ = { shop_id: req.user.shop_id };
    if (req.user.isBranch && req.user.branch_id) dealerQ.branch_id = String(req.user.branch_id);
    const [dealers, credits] = await Promise.all([
      Supplier.find(dealerQ).sort({ createdAt: -1 }).lean(),
      SupplierCredit.find(scope(req)).lean(),
    ]);
    const today = startOfTodayIST();
    const byDealer = {};
    let paidToday = 0;
    for (const c of credits) {
      const sid = String(c.supplier_id);
      const d = byDealer[sid] || (byDealer[sid] = { totalCredit: 0, totalPaid: 0, outstanding: 0, openBills: 0, bills: 0, lastPaymentAt: null });
      d.totalCredit += Number(c.totalAmount) || 0;
      d.totalPaid += Number(c.paidAmount) || 0;
      d.outstanding += outstandingOf(c);
      d.bills += 1;
      if (outstandingOf(c) > 0) d.openBills += 1;
      for (const p of c.payments || []) {
        const when = new Date(p.paidOn || p.createdAt);
        if (!d.lastPaymentAt || when > d.lastPaymentAt) d.lastPaymentAt = when;
        if (when >= today) paidToday += Number(p.amount) || 0;
      }
    }
    const rows = dealers.map((s) => {
      const d = byDealer[String(s._id)] || { totalCredit: 0, totalPaid: 0, outstanding: 0, openBills: 0, bills: 0, lastPaymentAt: null };
      return {
        _id: s._id,
        supplierName: s.supplierName,
        agencyName: s.agencyName,
        phoneNumber: s.phoneNumber,
        email: s.email || '',
        address: s.address,
        gstNumber: s.gstNumber,
        panNumber: s.panNumber,
        openingCredit: Number(s.openingCredit) || 0,
        createdAt: s.createdAt,
        totalCredit: round2(d.totalCredit),
        totalPaid: round2(d.totalPaid),
        outstanding: round2(d.outstanding),
        openBills: d.openBills,
        bills: d.bills,
        lastPaymentAt: d.lastPaymentAt,
      };
    });
    const totals = {
      dealers: rows.length,
      outstanding: round2(rows.reduce((s, r) => s + r.outstanding, 0)),
      totalCredit: round2(rows.reduce((s, r) => s + r.totalCredit, 0)),
      totalPaid: round2(rows.reduce((s, r) => s + r.totalPaid, 0)),
      dealersWithDues: rows.filter((r) => r.outstanding > 0).length,
      paidToday: round2(paidToday),
    };
    return res.json({ success: true, dealers: rows, totals, methods: PAY_METHODS });
  } catch (err) {
    console.error('dealer ledger summary error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/dealer-ledger/:supplierId — bills, payments (grouped per payment) and a running-balance statement
exports.ledger = async (req, res) => {
  try {
    const dealer = await findDealer(req, req.params.supplierId);
    if (!dealer) return res.status(404).json({ success: false, message: 'Dealer not found' });
    const credits = await SupplierCredit.find({ ...scope(req), supplier_id: dealer._id })
      .populate('branchSupply_id', 'billNo billDate')
      .lean();
    credits.sort(settleOrder);

    const bills = credits.map((c) => ({
      _id: c._id,
      kind: c.kind || 'purchase',
      label: billLabel(c),
      billDate: c.kind === 'opening' ? c.createdAt : (c.branchSupply_id && c.branchSupply_id.billDate) || c.createdAt,
      totalAmount: round2(c.totalAmount),
      paidAmount: round2(c.paidAmount),
      outstanding: outstandingOf(c),
      status: c.status,
      note: c.note || '',
    }));

    // One dealer payment may be spread over several bills (same batch); older payments have no batch
    const paymentMap = {};
    for (const c of credits) {
      for (const p of c.payments || []) {
        const key = p.batch || String(p._id);
        const entry = paymentMap[key] || (paymentMap[key] = {
          id: key, amount: 0, method: p.method || '', note: p.note || '', paidOn: p.paidOn || p.createdAt, allocations: [],
        });
        entry.amount = round2(entry.amount + (Number(p.amount) || 0));
        entry.allocations.push({ label: billLabel(c), amount: round2(p.amount) });
      }
    }
    const payments = Object.values(paymentMap).sort((a, b) => new Date(b.paidOn) - new Date(a.paidOn));

    // Statement: credits and payments by date with the running balance owed
    const events = [
      ...bills.map((b) => ({ type: 'credit', date: b.kind === 'opening' ? new Date(0) : b.billDate, sortDate: b.billDate, label: b.label, credit: b.totalAmount, paid: 0 })),
      ...payments.map((p) => ({ type: 'payment', date: p.paidOn, sortDate: p.paidOn, label: `Paid${p.method ? ` · ${p.method}` : ''}${p.note ? ` · ${p.note}` : ''}`, credit: 0, paid: p.amount })),
    ].sort((a, b) => new Date(a.date) - new Date(b.date));
    let balance = 0;
    const statement = events.map((e) => {
      balance = round2(balance + e.credit - e.paid);
      return { type: e.type, date: e.sortDate, label: e.label, credit: e.credit, paid: e.paid, balance };
    });

    return res.json({
      success: true,
      dealer,
      totals: {
        totalCredit: round2(bills.reduce((s, b) => s + b.totalAmount, 0)),
        totalPaid: round2(bills.reduce((s, b) => s + b.paidAmount, 0)),
        outstanding: round2(bills.reduce((s, b) => s + b.outstanding, 0)),
      },
      bills,
      payments,
      statement: statement.reverse(),
      methods: PAY_METHODS,
    });
  } catch (err) {
    console.error('dealer ledger error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/dealer-ledger/:supplierId/pay { amount, method, paidOn?, note? } — settles bills oldest first
exports.pay = async (req, res) => {
  try {
    const dealer = await findDealer(req, req.params.supplierId);
    if (!dealer) return res.status(404).json({ success: false, message: 'Dealer not found' });
    const amount = round2(req.body && req.body.amount);
    const method = String((req.body && req.body.method) || '').trim();
    const note = String((req.body && req.body.note) || '').trim().slice(0, 200);
    if (!(amount > 0)) return res.status(400).json({ success: false, message: 'Enter the amount paid' });
    if (!PAY_METHODS.includes(method)) return res.status(400).json({ success: false, message: 'Choose how the dealer was paid' });
    let paidOn = req.body && req.body.paidOn ? new Date(req.body.paidOn) : new Date();
    if (isNaN(paidOn.getTime())) return res.status(400).json({ success: false, message: 'Invalid payment date' });
    if (paidOn > new Date(Date.now() + 60000)) return res.status(400).json({ success: false, message: 'Payment date cannot be in the future' });

    const credits = await SupplierCredit.find({ ...scope(req), supplier_id: dealer._id, status: { $ne: 'settled' } });
    credits.sort(settleOrder);
    const outstanding = round2(credits.reduce((s, c) => s + outstandingOf(c), 0));
    if (outstanding <= 0) return res.status(400).json({ success: false, message: 'Nothing is due to this dealer' });
    if (amount > outstanding) {
      return res.status(400).json({ success: false, message: `Amount is more than the ₹${outstanding.toFixed(2)} due to this dealer` });
    }

    const batch = crypto.randomBytes(8).toString('hex');
    const createdBy = String(req.user.branch_id || req.user.userId || '');
    let left = amount;
    const allocations = [];
    for (const c of credits) {
      if (left <= 0) break;
      const due = outstandingOf(c);
      if (due <= 0) continue;
      const part = round2(Math.min(due, left));
      c.payments.push({ amount: part, method, note, paidOn, batch, createdBy });
      c.paidAmount = round2((Number(c.paidAmount) || 0) + part);
      c.status = outstandingOf(c) <= 0 ? 'settled' : 'partial';
      await c.save();
      allocations.push({ credit_id: c._id, amount: part });
      left = round2(left - part);
    }
    return res.json({ success: true, paid: amount, outstanding: round2(outstanding - amount), allocations });
  } catch (err) {
    console.error('dealer pay error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

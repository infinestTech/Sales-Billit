'use strict';
/**
 * Employee performance & combined business analytics.
 *
 * Joins three sources into one view per shop:
 *   - HR (BillitServer): employees, attendance, accrued wages (HrDailyAttendance.day_net_salary)
 *   - Sales (SalesServer, via internal API): sales attributed by the employee code entered at the POS
 *   - Service (BillitServer): repair jobs attributed by technician name ↔ employee code/name
 */

const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { Shop, Employee, HrDailyAttendance } = require('../models/mongoModels');
const { ensureEmployeeCodes } = require('../utils/employeeCodes');
const { resolveShopProductAccess } = require('../utils/shopProductAccess');
const { parsePeriod, IST_TZ } = require('../utils/periodRange');
const { fetchSalesSummary, fetchEmployeeSalesDetail, describeSalesError } = require('../utils/salesBridge');
const {
  getServiceByTechnician, attributeServiceToEmployees, getEmployeeServiceJobs, getServiceFinancials,
} = require('../utils/servicePerformance');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const unitOf = (e) => (e?.business_unit === 'sales' ? 'sales' : 'service');
const ZERO_SALES = { salesCount: 0, netSales: 0, totalAmount: 0, grossProfit: 0, itemsSold: 0, discount: 0, avgBillValue: 0, activeDays: 0 };
const ZERO_SERVICE = { jobs: 0, completed: 0, delivered: 0, returned: 0, revenue: 0, partsCost: 0, technicianNames: [] };
const ZERO_ATTENDANCE = { presentDays: 0, absentDays: 0, leaveDays: 0, lateDays: 0, lateMinutes: 0, workedMinutes: 0, accruedWages: 0 };

async function accessFor(shopId) {
  return (await resolveShopProductAccess(shopId)) || { service: true, sales: false };
}

async function attendanceByEmployee(shopId, from, to) {
  const rows = await HrDailyAttendance.aggregate([
    { $match: { shop_id: shopId, date: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: '$employee_id',
        presentDays: { $sum: { $cond: [{ $eq: ['$status', 'PRESENT'] }, 1, 0] } },
        absentDays: { $sum: { $cond: [{ $eq: ['$status', 'ABSENT'] }, 1, 0] } },
        leaveDays: { $sum: { $cond: [{ $eq: ['$status', 'LEAVE'] }, 1, 0] } },
        lateDays: { $sum: { $cond: ['$is_late', 1, 0] } },
        lateMinutes: { $sum: { $ifNull: ['$late_minutes', 0] } },
        workedMinutes: { $sum: { $ifNull: ['$total_worked_minutes', 0] } },
        accruedWages: { $sum: { $ifNull: ['$day_net_salary', 0] } },
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), { ...r, accruedWages: round2(r.accruedWages) }]));
}

/**
 * Builds one performance row per employee for the period.
 * Target progress is measured against the monthly target (multiplied for ranges longer than a month).
 */
async function buildPerformance(shopId, period, access) {
  await ensureEmployeeCodes(shopId);
  const warnings = [];
  const employees = await Employee.find({ shop_id: shopId }).lean();

  let salesSummary = null;
  if (access.sales) {
    try {
      salesSummary = await fetchSalesSummary(shopId, period.from, period.to);
    } catch (err) {
      warnings.push(`Sales data unavailable: ${describeSalesError(err)}`);
    }
  }
  const salesByEmp = new Map((salesSummary?.byEmployee || []).map((r) => [String(r.employeeId), r]));

  let serviceByEmp = new Map();
  let unlinkedTechnicians = [];
  if (access.service) {
    const techMap = await getServiceByTechnician(shopId, period.start, period.end);
    const attributed = attributeServiceToEmployees(techMap, employees);
    serviceByEmp = attributed.byEmployee;
    unlinkedTechnicians = attributed.unlinked;
  }

  const attendance = await attendanceByEmployee(shopId, period.from, period.to);
  const monthDays = moment.tz(period.from, 'YYYY-MM-DD', IST_TZ).daysInMonth();
  // Same rule as payroll: the full monthly target, scaled up only for ranges longer than a month
  const targetFactor = Math.max(1, period.days / monthDays);

  const rows = employees.map((e) => {
    const id = String(e._id);
    const sales = { ...ZERO_SALES, ...(salesByEmp.get(id) || {}) };
    const service = { ...ZERO_SERVICE, ...(serviceByEmp.get(id) || {}) };
    const att = { ...ZERO_ATTENDANCE, ...(attendance.get(id) || {}) };
    const inc = e.incentive || {};

    const salesTarget = round2((Number(inc.monthly_sales_target) || 0) * targetFactor);
    const targetAchievement = salesTarget > 0 ? round2((sales.netSales / salesTarget) * 100) : null;
    const salesCommission = round2(sales.netSales * (Number(inc.sales_commission_percent) || 0) / 100);
    const serviceCommission = round2(service.revenue * (Number(inc.service_commission_percent) || 0) / 100);
    const targetBonus = salesTarget > 0 && sales.netSales >= salesTarget ? round2(Number(inc.target_bonus) || 0) : 0;
    const incentive = round2(salesCommission + serviceCommission + targetBonus);

    const contribution = round2(sales.netSales + service.revenue);
    const grossContribution = round2(sales.grossProfit + service.revenue - service.partsCost);
    const cost = round2(att.accruedWages + incentive);

    return {
      employeeId: id,
      code: e.employee_code || '',
      name: e.name || e.employee_name || '',
      designation: e.designation || '',
      department: e.department || '',
      businessUnit: unitOf(e),
      isActive: e.is_active !== false,
      attendance: {
        presentDays: att.presentDays, absentDays: att.absentDays, leaveDays: att.leaveDays,
        lateDays: att.lateDays, lateMinutes: att.lateMinutes,
        workedHours: round2(att.workedMinutes / 60),
        accruedWages: att.accruedWages,
      },
      sales: {
        count: sales.salesCount, netSales: round2(sales.netSales), totalAmount: round2(sales.totalAmount),
        grossProfit: round2(sales.grossProfit), itemsSold: sales.itemsSold, discount: round2(sales.discount),
        avgBillValue: round2(sales.avgBillValue), activeDays: sales.activeDays || 0,
        target: salesTarget, targetAchievement,
      },
      service: {
        jobs: service.jobs, completed: service.completed, delivered: service.delivered, returned: service.returned,
        revenue: round2(service.revenue), partsCost: round2(service.partsCost),
        completionRate: service.jobs ? round2((service.completed / service.jobs) * 100) : null,
        technicianNames: service.technicianNames,
      },
      incentive: { salesCommission, serviceCommission, targetBonus, total: incentive },
      contribution,
      grossContribution,
      revenuePerPresentDay: att.presentDays ? round2(contribution / att.presentDays) : null,
      costToContribution: contribution > 0 ? round2((cost / contribution) * 100) : null,
    };
  })
    // Inactive employees are listed only when they did something in the period
    .filter((r) => r.isActive || r.contribution > 0 || r.sales.count > 0 || r.service.jobs > 0 || r.attendance.presentDays > 0)
    .sort((a, b) => b.contribution - a.contribution || b.sales.count - a.sales.count || a.name.localeCompare(b.name));

  let rank = 0;
  rows.forEach((r) => { r.rank = r.contribution > 0 ? ++rank : null; });

  return {
    rows,
    salesSummary,
    unattributedSales: salesSummary?.unattributed || { salesCount: 0, netSales: 0, totalAmount: 0 },
    unlinkedTechnicians: unlinkedTechnicians.slice(0, 20),
    warnings,
  };
}

const filterUnit = (rows, unit) => (unit === 'sales' || unit === 'service' ? rows.filter((r) => r.businessUnit === unit) : rows);

function totalsOf(rows) {
  const sum = (fn) => round2(rows.reduce((s, r) => s + (fn(r) || 0), 0));
  return {
    employees: rows.length,
    netSales: sum((r) => r.sales.netSales),
    salesCount: rows.reduce((s, r) => s + r.sales.count, 0),
    serviceRevenue: sum((r) => r.service.revenue),
    serviceJobs: rows.reduce((s, r) => s + r.service.jobs, 0),
    contribution: sum((r) => r.contribution),
    accruedWages: sum((r) => r.attendance.accruedWages),
    incentives: sum((r) => r.incentive.total),
    presentDays: rows.reduce((s, r) => s + r.attendance.presentDays, 0),
    lateDays: rows.reduce((s, r) => s + r.attendance.lateDays, 0),
  };
}

// GET /api/shop-admin/hr/performance?from&to&unit
async function getPerformance(req, res) {
  try {
    const period = parsePeriod(req.query);
    if (period.error) return res.status(400).json({ success: false, message: period.error });
    const access = await accessFor(req.shopId);
    const perf = await buildPerformance(req.shopId, period, access);
    const rows = filterUnit(perf.rows, req.query.unit);
    const shop = await Shop.findById(req.shopId).select('sales_settings').lean();
    return res.json({
      success: true,
      range: { from: period.from, to: period.to, days: period.days },
      access: { sales: !!access.sales, service: !!access.service },
      rows,
      totals: totalsOf(rows),
      unattributedSales: perf.unattributedSales,
      unlinkedTechnicians: perf.unlinkedTechnicians,
      posSettings: { requireEmployeeCode: !!shop?.sales_settings?.require_employee_code },
      warnings: perf.warnings,
    });
  } catch (err) {
    console.error('[Performance] getPerformance', err);
    return res.status(500).json({ success: false, message: 'Failed to load employee performance' });
  }
}

// GET /api/shop-admin/hr/performance/:id?from&to
async function getEmployeePerformance(req, res) {
  try {
    const period = parsePeriod(req.query);
    if (period.error) return res.status(400).json({ success: false, message: period.error });
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid employee id' });
    const employee = await Employee.findOne({ _id: req.params.id, shop_id: req.shopId }).lean();
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const access = await accessFor(req.shopId);
    const warnings = [];
    const [attendance, sales, serviceJobs] = await Promise.all([
      HrDailyAttendance.find({ shop_id: req.shopId, employee_id: employee._id, date: { $gte: period.from, $lte: period.to } })
        .sort({ date: 1 }).lean(),
      access.sales
        ? fetchEmployeeSalesDetail(req.shopId, employee._id, period.from, period.to).catch((err) => {
          warnings.push(`Sales data unavailable: ${describeSalesError(err)}`);
          return null;
        })
        : null,
      access.service ? getEmployeeServiceJobs(req.shopId, employee, period.start, period.end) : [],
    ]);

    return res.json({
      success: true,
      range: { from: period.from, to: period.to, days: period.days },
      employee: {
        employeeId: String(employee._id),
        code: employee.employee_code || '',
        name: employee.name || employee.employee_name || '',
        designation: employee.designation || '',
        businessUnit: unitOf(employee),
      },
      attendance: attendance.map((a) => ({
        date: a.date,
        status: a.status,
        checkIn: a.check_in_time || null,
        checkOut: a.check_out_time || null,
        lateMinutes: a.late_minutes || 0,
        workedHours: round2((a.total_worked_minutes || 0) / 60),
        wage: round2(a.day_net_salary || 0),
      })),
      sales,
      serviceJobs,
      warnings,
    });
  } catch (err) {
    console.error('[Performance] getEmployeePerformance', err);
    return res.status(500).json({ success: false, message: 'Failed to load employee details' });
  }
}

// GET /api/shop-admin/analytics/business?from&to — consolidated P&L for sales + service
async function getBusinessAnalytics(req, res) {
  try {
    const period = parsePeriod(req.query);
    if (period.error) return res.status(400).json({ success: false, message: period.error });
    const access = await accessFor(req.shopId);

    const [perf, service] = await Promise.all([
      buildPerformance(req.shopId, period, access),
      access.service ? getServiceFinancials(req.shopId, period.start, period.end) : null,
    ]);
    const sales = perf.salesSummary;

    // Payroll per segment; single-product shops carry the whole payroll on their only segment
    const payroll = { service: { wages: 0, incentives: 0 }, sales: { wages: 0, incentives: 0 } };
    perf.rows.forEach((r) => {
      const seg = !access.sales ? 'service' : !access.service ? 'sales' : r.businessUnit;
      payroll[seg].wages += r.attendance.accruedWages;
      payroll[seg].incentives += r.incentive.total;
    });
    ['service', 'sales'].forEach((k) => {
      payroll[k].wages = round2(payroll[k].wages);
      payroll[k].incentives = round2(payroll[k].incentives);
      payroll[k].total = round2(payroll[k].wages + payroll[k].incentives);
    });

    const segment = (revenue, directCost, expenses, pay) => {
      const grossProfit = round2(revenue - directCost);
      const netProfit = round2(grossProfit - expenses - pay);
      return {
        revenue: round2(revenue), directCost: round2(directCost), grossProfit,
        expenses: round2(expenses), payroll: round2(pay), netProfit,
        netMarginPercent: revenue > 0 ? round2((netProfit / revenue) * 100) : 0,
      };
    };
    const segments = {};
    if (service) segments.service = segment(service.revenue, service.partsCost, service.expenses, payroll.service.total);
    if (access.sales) {
      const t = sales?.totals || {};
      segments.sales = segment(t.netSales || 0, t.cogs || 0, t.expenses || 0, payroll.sales.total);
    }
    const combined = segment(
      Object.values(segments).reduce((s, x) => s + x.revenue, 0),
      Object.values(segments).reduce((s, x) => s + x.directCost, 0),
      Object.values(segments).reduce((s, x) => s + x.expenses, 0),
      Object.values(segments).reduce((s, x) => s + x.payroll, 0),
    );

    // Day-by-day revenue across both businesses
    const days = new Map();
    for (let d = moment.tz(period.from, 'YYYY-MM-DD', IST_TZ); d.format('YYYY-MM-DD') <= period.to; d.add(1, 'day')) {
      days.set(d.format('YYYY-MM-DD'), { date: d.format('YYYY-MM-DD'), serviceRevenue: 0, salesRevenue: 0, salesProfit: 0, salesCount: 0 });
    }
    (service?.byDay || []).forEach((r) => { if (days.has(r.date)) days.get(r.date).serviceRevenue = r.revenue; });
    (sales?.byDay || []).forEach((r) => {
      if (!days.has(r.date)) return;
      const d = days.get(r.date);
      d.salesRevenue = r.netSales; d.salesProfit = r.grossProfit; d.salesCount = r.salesCount;
    });
    const trend = [...days.values()].map((d) => ({ ...d, totalRevenue: round2(d.serviceRevenue + d.salesRevenue) }));

    const totals = totalsOf(perf.rows);
    return res.json({
      success: true,
      range: { from: period.from, to: period.to, days: period.days },
      access: { sales: !!access.sales, service: !!access.service },
      combined,
      segments,
      payroll,
      gstCollected: round2(sales?.totals?.gst || 0),
      trend,
      sales: sales ? {
        totals: sales.totals,
        byBranch: sales.byBranch,
        byPayment: sales.byPayment,
        byHour: sales.byHour,
        topProducts: sales.topProducts,
        unattributed: sales.unattributed,
      } : null,
      service: service ? {
        jobs: service.jobs,
        byPaymentMethod: service.byPaymentMethod,
        expenseCount: service.expenseCount,
      } : null,
      workforce: {
        ...totals,
        topPerformers: perf.rows.filter((r) => r.contribution > 0).slice(0, 5).map((r) => ({
          employeeId: r.employeeId, code: r.code, name: r.name, businessUnit: r.businessUnit,
          contribution: r.contribution, netSales: r.sales.netSales, serviceRevenue: r.service.revenue,
        })),
      },
      warnings: perf.warnings,
    });
  } catch (err) {
    console.error('[Performance] getBusinessAnalytics', err);
    return res.status(500).json({ success: false, message: 'Failed to load business analytics' });
  }
}

// GET/PATCH /api/shop-admin/shop-settings/pos
async function getPosSettings(req, res) {
  try {
    const shop = await Shop.findById(req.shopId).select('sales_settings').lean();
    return res.json({ success: true, data: { requireEmployeeCode: !!shop?.sales_settings?.require_employee_code } });
  } catch (err) {
    console.error('[Performance] getPosSettings', err);
    return res.status(500).json({ success: false, message: 'Failed to load POS settings' });
  }
}

async function updatePosSettings(req, res) {
  try {
    if (typeof req.body?.requireEmployeeCode !== 'boolean') {
      return res.status(400).json({ success: false, message: 'requireEmployeeCode must be true or false' });
    }
    const shop = await Shop.findByIdAndUpdate(
      req.shopId,
      { $set: { 'sales_settings.require_employee_code': req.body.requireEmployeeCode } },
      { new: true }
    ).select('sales_settings').lean();
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
    return res.json({ success: true, data: { requireEmployeeCode: !!shop.sales_settings?.require_employee_code } });
  } catch (err) {
    console.error('[Performance] updatePosSettings', err);
    return res.status(500).json({ success: false, message: 'Failed to update POS settings' });
  }
}

module.exports = {
  getPerformance,
  getEmployeePerformance,
  getBusinessAnalytics,
  getPosSettings,
  updatePosSettings,
};

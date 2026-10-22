'use strict';
/**
 * Shop-admin sales financial report. SalesServer builds the numbers (sales profit, expenses, dealer payments,
 * net profit, cash flow); this adds the plan check and the salesperson list used by the report filters.
 * The service side keeps its own report (GET /api/shop-admin/reports/financial); combo shops see both.
 */

const { Employee } = require('../models/mongoModels');
const { resolveShopProductAccess } = require('../utils/shopProductAccess');
const { parsePeriod } = require('../utils/periodRange');
const { fetchSalesFinancialReport, describeSalesError } = require('../utils/salesBridge');

const PAYMENT_MODES = ['Cash', 'Gpay', 'Card'];

// GET /api/shop-admin/reports/sales-financial?from&to[&branch_id&employee_id&payment]
async function getSalesFinancialReport(req, res) {
  try {
    const access = (await resolveShopProductAccess(req.shopId)) || { service: true, sales: false };
    if (!access.sales) return res.status(403).json({ success: false, message: 'Your plan does not include Sales' });

    const period = parsePeriod(req.query);
    if (period.error) return res.status(400).json({ success: false, message: period.error });
    const payment = PAYMENT_MODES.includes(req.query.payment) ? req.query.payment : undefined;

    const employees = await Employee.find({ shop_id: req.shopId }).select('name employee_name employee_code business_unit').sort({ name: 1 }).lean();

    let data;
    try {
      data = await fetchSalesFinancialReport(req.shopId, {
        from: period.from,
        to: period.to,
        branch_id: req.query.branch_id || undefined,
        employee_id: req.query.employee_id || undefined,
        payment,
      });
    } catch (err) {
      return res.status(502).json({ success: false, message: `Sales data unavailable: ${describeSalesError(err)}` });
    }

    return res.json({
      success: true,
      range: data.range || { from: period.from, to: period.to, days: period.days },
      access: { sales: !!access.sales, service: !!access.service },
      report: data.report,
      employees: employees.map((e) => ({ id: String(e._id), name: e.name || e.employee_name || '', code: e.employee_code || '', unit: e.business_unit || 'service' })),
    });
  } catch (err) {
    console.error('[FinancialReport] getSalesFinancialReport', err);
    return res.status(500).json({ success: false, message: 'Failed to load the sales financial report' });
  }
}

module.exports = { getSalesFinancialReport };

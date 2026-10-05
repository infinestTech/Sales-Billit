'use strict';
/**
 * Server-to-server calls from BillitServer to SalesServer analytics (x-internal-key).
 * SalesServer owns sale documents and their aggregation; BillitServer combines them with HR/service data.
 */

const axiosIPv4 = require('./axiosConfig');

const salesServerUrl = () => (process.env.SALES_SERVER_URL || 'http://127.0.0.1:9000').replace(/\/+$/, '');

async function internalGet(path, params) {
  const { data } = await axiosIPv4.get(`${salesServerUrl()}${path}`, {
    params,
    headers: { 'x-internal-key': process.env.INTERNAL_API_KEY },
    timeout: 15000,
  });
  if (!data || data.success === false) throw new Error(data?.message || 'Sales server returned an error');
  return data;
}

/** Totals, trends, branch/payment/product breakdowns and per-employee sales for a shop. */
async function fetchSalesSummary(shopId, from, to) {
  const data = await internalGet('/internal/sales-analytics/summary', { shop_id: String(shopId), from, to });
  return data.summary;
}

/** Day-wise trend, top products and recent bills for one employee. */
async function fetchEmployeeSalesDetail(shopId, employeeId, from, to) {
  const data = await internalGet('/internal/sales-analytics/employee', {
    shop_id: String(shopId), employee_id: String(employeeId), from, to,
  });
  return data.detail;
}

const describeSalesError = (err) => err?.response?.data?.message || err?.message || 'Sales server unavailable';

module.exports = { fetchSalesSummary, fetchEmployeeSalesDetail, describeSalesError };

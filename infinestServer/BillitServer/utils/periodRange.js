'use strict';
/**
 * Parses ?from=YYYY-MM-DD&to=YYYY-MM-DD (IST calendar days). Defaults to the current month to date.
 */

const moment = require('moment-timezone');

const IST_TZ = 'Asia/Kolkata';
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 366;

function parsePeriod(query = {}) {
  const today = moment().tz(IST_TZ);
  const fromStr = DAY_RE.test(query.from || '') ? query.from : today.clone().startOf('month').format('YYYY-MM-DD');
  const toStr = DAY_RE.test(query.to || '') ? query.to : today.format('YYYY-MM-DD');
  const start = moment.tz(fromStr, 'YYYY-MM-DD', true, IST_TZ);
  const end = moment.tz(toStr, 'YYYY-MM-DD', true, IST_TZ);
  if (!start.isValid() || !end.isValid()) return { error: 'from/to must be valid YYYY-MM-DD dates' };
  if (end.isBefore(start)) return { error: '"to" must be on or after "from"' };
  const days = end.diff(start, 'days') + 1;
  if (days > MAX_DAYS) return { error: `Date range cannot exceed ${MAX_DAYS} days` };
  return {
    from: fromStr,
    to: toStr,
    start: start.clone().startOf('day').toDate(),
    end: end.clone().endOf('day').toDate(),
    days,
  };
}

/** Calendar-month range for payroll (month 1-12). */
function monthPeriod(year, monthNum) {
  const start = moment.tz({ year, month: monthNum - 1, day: 1 }, IST_TZ).startOf('day');
  const end = start.clone().endOf('month');
  return {
    from: start.format('YYYY-MM-DD'),
    to: end.format('YYYY-MM-DD'),
    start: start.toDate(),
    end: end.toDate(),
    days: end.date(),
  };
}

module.exports = { IST_TZ, parsePeriod, monthPeriod };

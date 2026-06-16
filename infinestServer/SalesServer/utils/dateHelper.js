const moment = require('moment-timezone');

// Set Indian Standard Time as the default timezone
const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Get current IST date/time
 */
const getISTNow = () => {
  return moment().tz(IST_TIMEZONE);
};

/**
 * Get start of day in IST (00:00:00)
 */
const getISTStartOfDay = (date = null) => {
  if (date) {
    return moment(date).tz(IST_TIMEZONE).startOf('day').toDate();
  }
  return moment().tz(IST_TIMEZONE).startOf('day').toDate();
};

/**
 * Get end of day in IST (23:59:59.999)
 */
const getISTEndOfDay = (date = null) => {
  if (date) {
    return moment(date).tz(IST_TIMEZONE).endOf('day').toDate();
  }
  return moment().tz(IST_TIMEZONE).endOf('day').toDate();
};

/**
 * Get start and end of today in IST
 */
const getISTTodayRange = () => {
  const today = moment().tz(IST_TIMEZONE);
  return {
    startOfDay: today.clone().startOf('day').toDate(),
    endOfDay: today.clone().endOf('day').toDate(),
    today: today.toDate()
  };
};

/**
 * Convert any date to IST
 */
const convertToIST = (date) => {
  return moment(date).tz(IST_TIMEZONE).toDate();
};

/**
 * Get IST date range for X days ago
 */
const getISTDateRange = (daysAgo = 0) => {
  const targetDate = moment().tz(IST_TIMEZONE).subtract(daysAgo, 'days');
  return {
    startOfDay: targetDate.clone().startOf('day').toDate(),
    endOfDay: targetDate.clone().endOf('day').toDate()
  };
};

/**
 * Get IST date range between two dates
 */
const getISTRangeBetween = (startDate, endDate) => {
  return {
    start: moment(startDate).tz(IST_TIMEZONE).startOf('day').toDate(),
    end: moment(endDate).tz(IST_TIMEZONE).endOf('day').toDate()
  };
};

/**
 * Format date in IST timezone
 */
const formatIST = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
  return moment(date).tz(IST_TIMEZONE).format(format);
};

/**
 * Add days/months/years to IST date
 */
const addTimeIST = (amount, unit = 'days', startDate = null) => {
  if (startDate) {
    return moment(startDate).tz(IST_TIMEZONE).add(amount, unit).toDate();
  }
  return moment().tz(IST_TIMEZONE).add(amount, unit).toDate();
};

/**
 * Subtract days/months/years from IST date
 */
const subtractTimeIST = (amount, unit = 'days', startDate = null) => {
  if (startDate) {
    return moment(startDate).tz(IST_TIMEZONE).subtract(amount, unit).toDate();
  }
  return moment().tz(IST_TIMEZONE).subtract(amount, unit).toDate();
};

/**
 * Check if date is today in IST
 */
const isISTToday = (date) => {
  const { startOfDay, endOfDay } = getISTTodayRange();
  const checkDate = new Date(date);
  return checkDate >= startOfDay && checkDate <= endOfDay;
};

module.exports = {
  IST_TIMEZONE,
  getISTNow,
  getISTStartOfDay,
  getISTEndOfDay,
  getISTTodayRange,
  convertToIST,
  getISTDateRange,
  getISTRangeBetween,
  formatIST,
  addTimeIST,
  subtractTimeIST,
  isISTToday
};

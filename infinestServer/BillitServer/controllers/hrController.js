'use strict';
/**
 * HR Controller — day-wise wage system.
 *
 * Punch flow per employee per day:
 *   CHECK_IN  → LUNCH_OUT (after lunch threshold) → LUNCH_IN → CHECK_OUT
 *
 * Any punch within `duplicate_punch_window_minutes` of the last accepted
 * non-lunch punch (or within `lunch_break_minutes` after LUNCH_OUT) is stored
 * with type=DUPLICATE and does not advance the state machine.
 *
 * Salary = daily_salary × present_days − Σ(per-day late deduction)
 *          per-day late deduction = (late_minutes / 60) × late_policy.deduction_per_hour
 *          (capped at one day's salary so a single late day cannot go negative).
 */

const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { Shop, Employee, HrPunch, HrDailyAttendance, HrSalaryRecord } = require('../models/mongoModels');
const { formatIST } = require('../utils/dateHelper');

const IST_TZ = 'Asia/Kolkata';
const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayIST() {
  return formatIST(new Date(), 'YYYY-MM-DD');
}

function toObjectId(id) {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(String(id)) : null;
}

function getShopId(req) {
  const raw = req.shopId
    || req.query?.shopId || req.query?.shop_id
    || req.body?.shopId  || req.body?.shop_id;
  return toObjectId(raw);
}

function requireShop(req, res) {
  const shopId = getShopId(req);
  if (!shopId) {
    res.status(401).json({ success: false, message: 'Shop context missing. Please log in again.' });
    return null;
  }
  return shopId;
}

function parseTime(timeStr) {
  const [h, m] = (timeStr || '09:00').split(':').map(Number);
  return { h: h || 0, m: m || 0 };
}

/** Compute auto working hours per day from start and end HH:MM strings. */
function computeWorkingHours(startStr, endStr) {
  const s = parseTime(startStr);
  const e = parseTime(endStr);
  let mins = (e.h * 60 + e.m) - (s.h * 60 + s.m);
  if (mins < 0) mins += 24 * 60; // shift crosses midnight
  return Math.round((mins / 60) * 100) / 100;
}

/** Same calendar day (IST) as referenceDate, at the given HH:MM. */
function todayAt(timeStr, referenceDate) {
  const base = referenceDate ? moment(referenceDate).tz(IST_TZ) : moment().tz(IST_TZ);
  const { h, m } = parseTime(timeStr);
  return base.clone().startOf('day').hours(h).minutes(m).seconds(0).milliseconds(0).toDate();
}

/** Working days in a month for the employee's weekly off. */
function workingDaysInMonth(year, monthNum, weeklyOff = ['SUN']) {
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dayName = DAY_NAMES[new Date(year, monthNum - 1, d).getDay()];
    if (!weeklyOff.includes(dayName)) count++;
  }
  return count;
}

async function getShopHrSettings(shopId) {
  const shop = await Shop.findById(shopId).select('hr_settings').lean();
  const defaults = {
    duplicate_punch_window_minutes: 180,
    lunch_threshold_time: '12:00',
    lunch_break_minutes: 30,
  };
  return { ...defaults, ...(shop?.hr_settings || {}) };
}

// ─── Form ↔ DB mappers ────────────────────────────────────────────────────────

function mapFormToDb(form, shopId) {
  const out = {
    shop_id: shopId,
    employee_name: form.name || form.employee_name,
    mobile_number: form.phone || form.mobile_number,
    is_active: form.isActive !== undefined ? form.isActive : true,
    name: form.name,
    phone: form.phone,
    email: form.email,
    address: form.address,
    joining_date: form.joiningDate ? new Date(form.joiningDate) : undefined,
    department: form.department,
    designation: form.designation,
    daily_salary: Number(form.dailySalary ?? form.daily_salary) || 0,
    shift: form.shift ? {
      name: form.shift.name || 'General',
      start_time: form.shift.startTime || form.shift.start_time || '09:00',
      end_time: form.shift.endTime || form.shift.end_time || '18:00',
      grace_period_minutes: Number(form.shift.gracePeriodMinutes ?? form.shift.grace_period_minutes ?? 15),
    } : undefined,
    working_days_per_week: Number(form.workingDaysPerWeek ?? form.working_days_per_week) || 6,
    weekly_off: form.weeklyOff || form.weekly_off || ['SUN'],
    late_policy: form.latePolicy ? {
      grace_period_minutes: Number(form.latePolicy.gracePeriodMinutes ?? form.latePolicy.grace_period_minutes ?? 15),
      deduction_per_hour: Number(form.latePolicy.deductionPerHour ?? form.latePolicy.deduction_per_hour) || 0,
    } : undefined,
    device_pin: form.esslDeviceUserId || form.device_pin,
  };
  return out;
}

function mapDbToFrontend(emp) {
  const e = emp.toObject ? emp.toObject() : emp;
  const shift = e.shift || {};
  const startTime = shift.start_time || '09:00';
  const endTime = shift.end_time || '18:00';
  return {
    _id: e._id,
    employeeId: e._id,
    shopId: e.shop_id,
    isActive: e.is_active !== false,
    name: e.name || e.employee_name || '',
    phone: e.phone || e.mobile_number || '',
    email: e.email || '',
    address: e.address || '',
    joiningDate: e.joining_date,
    department: e.department || '',
    designation: e.designation || '',
    dailySalary: e.daily_salary || 0,
    shift: {
      name: shift.name || 'General',
      startTime,
      endTime,
      workingHours: computeWorkingHours(startTime, endTime),
      gracePeriodMinutes: shift.grace_period_minutes ?? 15,
    },
    workingDaysPerWeek: e.working_days_per_week || 6,
    weeklyOff: e.weekly_off || ['SUN'],
    latePolicy: {
      gracePeriodMinutes: e.late_policy?.grace_period_minutes ?? 15,
      deductionPerHour: e.late_policy?.deduction_per_hour ?? 0,
    },
    esslDeviceUserId: e.device_pin || '',
    createdAt: e.created_at,
  };
}

// ─── Employee CRUD ────────────────────────────────────────────────────────────

async function listEmployees(req, res) {
  try {
    const shopId = requireShop(req, res); if (!shopId) return;
    const isActive = req.query.isActive;
    const query = { shop_id: shopId };
    if (isActive === 'true') query.is_active = true;
    if (isActive === 'false') query.is_active = false;
    const employees = await Employee.find(query).sort({ created_at: -1 }).lean();
    return res.json({ success: true, data: employees.map(mapDbToFrontend) });
  } catch (err) {
    console.error('[HR listEmployees]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch employees' });
  }
}

async function createEmployee(req, res) {
  try {
    const shopId = requireShop(req, res); if (!shopId) return;
    const data = mapFormToDb(req.body, shopId);
    if (!data.name && !data.employee_name) {
      return res.status(400).json({ success: false, message: 'Employee name is required' });
    }
    if (!(data.daily_salary > 0)) {
      return res.status(400).json({ success: false, message: 'Daily salary must be greater than zero' });
    }
    const emp = await Employee.create(data);
    return res.status(201).json({ success: true, data: mapDbToFrontend(emp) });
  } catch (err) {
    console.error('[HR createEmployee]', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to create employee' });
  }
}

async function updateEmployee(req, res) {
  try {
    const shopId = requireShop(req, res); if (!shopId) return;
    const empOid = toObjectId(req.params.id);
    if (!empOid) return res.status(400).json({ success: false, message: 'Invalid employee id' });
    const emp = await Employee.findOne({ _id: empOid, shop_id: shopId });
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
    const updates = mapFormToDb(req.body, shopId);
    delete updates._id;
    Object.assign(emp, updates);
    await emp.save();
    return res.json({ success: true, data: mapDbToFrontend(emp) });
  } catch (err) {
    console.error('[HR updateEmployee]', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to update employee' });
  }
}

async function deactivateEmployee(req, res) {
  try {
    const shopId = requireShop(req, res); if (!shopId) return;
    const empOid = toObjectId(req.params.id);
    if (!empOid) return res.status(400).json({ success: false, message: 'Invalid employee id' });
    const emp = await Employee.findOneAndUpdate(
      { _id: empOid, shop_id: shopId },
      { is_active: false },
      { new: true }
    );
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
    return res.json({ success: true, message: 'Employee deactivated', data: mapDbToFrontend(emp) });
  } catch (err) {
    console.error('[HR deactivateEmployee]', err);
    return res.status(500).json({ success: false, message: 'Failed to deactivate employee' });
  }
}

async function reactivateEmployee(req, res) {
  try {
    const shopId = requireShop(req, res); if (!shopId) return;
    const empOid = toObjectId(req.params.id);
    if (!empOid) return res.status(400).json({ success: false, message: 'Invalid employee id' });
    const emp = await Employee.findOneAndUpdate(
      { _id: empOid, shop_id: shopId },
      { is_active: true },
      { new: true }
    );
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
    return res.json({ success: true, message: 'Employee reactivated', data: mapDbToFrontend(emp) });
  } catch (err) {
    console.error('[HR reactivateEmployee]', err);
    return res.status(500).json({ success: false, message: 'Failed to reactivate employee' });
  }
}

async function deleteEmployee(req, res) {
  try {
    const shopId = requireShop(req, res); if (!shopId) return;
    const empOid = toObjectId(req.params.id);
    if (!empOid) return res.status(400).json({ success: false, message: 'Invalid employee id' });
    const emp = await Employee.findOne({ _id: empOid, shop_id: shopId });
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
    await Promise.all([
      Employee.deleteOne({ _id: empOid, shop_id: shopId }),
      HrPunch.deleteMany({ employee_id: empOid }),
      HrDailyAttendance.deleteMany({ employee_id: empOid }),
      HrSalaryRecord.deleteMany({ employee_id: empOid }),
    ]);
    return res.json({ success: true, message: 'Employee and related records deleted' });
  } catch (err) {
    console.error('[HR deleteEmployee]', err);
    return res.status(500).json({ success: false, message: 'Failed to delete employee' });
  }
}

// ─── Punch state machine ──────────────────────────────────────────────────────

/**
 * Decide the next punch type given today's prior punches and shop HR settings.
 * Returns one of: CHECK_IN, LUNCH_OUT, LUNCH_IN, CHECK_OUT, DUPLICATE.
 */
function decidePunchType(now, todayPunches, hrSettings) {
  const dupWinMs = (hrSettings.duplicate_punch_window_minutes || 180) * 60_000;
  const lunchBreakMs = (hrSettings.lunch_break_minutes || 30) * 60_000;

  // Ignore previous DUPLICATE entries when looking at "last accepted" state.
  const accepted = todayPunches.filter(p => p.punch_type !== 'DUPLICATE');

  if (accepted.length === 0) return 'CHECK_IN';
  const last = accepted[accepted.length - 1];
  const delta = now.getTime() - new Date(last.punch_time).getTime();

  if (last.punch_type === 'CHECK_OUT') return 'DUPLICATE';

  if (last.punch_type === 'CHECK_IN') {
    if (delta < dupWinMs) return 'DUPLICATE';
    const lunchThreshold = todayAt(hrSettings.lunch_threshold_time || '12:00', now);
    const hadLunchToday = accepted.some(p => p.punch_type === 'LUNCH_OUT');
    if (!hadLunchToday && now >= lunchThreshold) return 'LUNCH_OUT';
    return 'CHECK_OUT';
  }

  if (last.punch_type === 'LUNCH_OUT') {
    if (delta < lunchBreakMs) return 'DUPLICATE';
    return 'LUNCH_IN';
  }

  if (last.punch_type === 'LUNCH_IN') {
    if (delta < dupWinMs) return 'DUPLICATE';
    return 'CHECK_OUT';
  }

  return 'DUPLICATE';
}

/**
 * Recompute the daily summary from the full set of accepted punches.
 */
function buildDailySummary(employee, punches, hrSettings) {
  const accepted = punches.filter(p => p.punch_type !== 'DUPLICATE')
    .sort((a, b) => new Date(a.punch_time) - new Date(b.punch_time));

  const checkIn  = accepted.find(p => p.punch_type === 'CHECK_IN');
  const checkOut = [...accepted].reverse().find(p => p.punch_type === 'CHECK_OUT');
  const lunchOut = accepted.find(p => p.punch_type === 'LUNCH_OUT');
  const lunchIn  = accepted.find(p => p.punch_type === 'LUNCH_IN');

  let lunchMinutes = 0;
  if (lunchOut && lunchIn) {
    lunchMinutes = Math.max(0, Math.floor(
      (new Date(lunchIn.punch_time) - new Date(lunchOut.punch_time)) / 60_000
    ));
  } else if (lunchOut && !lunchIn) {
    // assume default lunch break if employee hasn't punched back yet
    lunchMinutes = hrSettings.lunch_break_minutes || 30;
  }

  let workedMinutes = 0;
  if (checkIn && checkOut) {
    workedMinutes = Math.max(0,
      Math.floor((new Date(checkOut.punch_time) - new Date(checkIn.punch_time)) / 60_000) - lunchMinutes
    );
  }

  let isLate = false;
  let lateMinutes = 0;
  let lateDeduction = 0;
  if (checkIn) {
    const graceMin = employee.late_policy?.grace_period_minutes
      ?? employee.shift?.grace_period_minutes ?? 15;
    const shiftStart = todayAt(employee.shift?.start_time || '09:00', checkIn.punch_time);
    const lateGraceMs = shiftStart.getTime() + graceMin * 60_000;
    if (new Date(checkIn.punch_time).getTime() > lateGraceMs) {
      isLate = true;
      // late_minutes is measured from the actual shift start (not from grace end)
      lateMinutes = Math.floor((new Date(checkIn.punch_time).getTime() - shiftStart.getTime()) / 60_000);
      const perHour = employee.late_policy?.deduction_per_hour || 0;
      const dailySalary = employee.daily_salary || 0;
      lateDeduction = Math.min(dailySalary, Math.round((lateMinutes / 60) * perHour));
    }
  }

  const status = checkIn ? 'PRESENT' : 'ABSENT';

  return {
    status,
    check_in_time:  checkIn?.punch_time,
    check_out_time: checkOut?.punch_time,
    lunch_out_time: lunchOut?.punch_time,
    lunch_in_time:  lunchIn?.punch_time,
    lunch_minutes:  lunchMinutes,
    total_worked_minutes: workedMinutes,
    is_late: isLate,
    late_minutes: lateMinutes,
    late_deduction: lateDeduction,
  };
}

/**
 * Public entry point: record a punch and refresh the daily summary.
 */
async function processPunch(shopId, employeeId, source, _overridePunchType, punchTimeOverride) {
  const shopOid = toObjectId(shopId);
  const empOid  = toObjectId(employeeId);
  if (!shopOid || !empOid) throw new Error('Invalid shopId or employeeId');

  const now = punchTimeOverride ? new Date(punchTimeOverride) : new Date();
  const dateStr = formatIST(now, 'YYYY-MM-DD');

  const employee = await Employee.findOne({ _id: empOid, shop_id: shopOid }).lean();
  if (!employee) throw new Error('Employee not found');

  const hrSettings = await getShopHrSettings(shopOid);

  const todayPunches = await HrPunch.find({ employee_id: empOid, date: dateStr })
    .sort({ punch_time: 1 }).lean();

  const punchType = decidePunchType(now, todayPunches, hrSettings);

  // For CHECK_IN, compute lateness on the punch record itself for audit.
  let isLate = false;
  let lateMinutes = 0;
  if (punchType === 'CHECK_IN') {
    const graceMin = employee.late_policy?.grace_period_minutes
      ?? employee.shift?.grace_period_minutes ?? 15;
    const shiftStart = todayAt(employee.shift?.start_time || '09:00', now);
    if (now.getTime() > shiftStart.getTime() + graceMin * 60_000) {
      isLate = true;
      lateMinutes = Math.floor((now.getTime() - shiftStart.getTime()) / 60_000);
    }
  }

  const punch = await HrPunch.create({
    shop_id: shopOid,
    employee_id: empOid,
    date: dateStr,
    punch_time: now,
    punch_type: punchType,
    source,
    is_late: isLate,
    late_minutes: lateMinutes,
  });

  // If this punch was a duplicate we do NOT change the daily summary.
  if (punchType === 'DUPLICATE') {
    return {
      punch, punchType, duplicate: true,
      message: 'Duplicate punch ignored — already recorded recently.',
    };
  }

  const allPunches = [...todayPunches, punch.toObject ? punch.toObject() : punch];
  const summary = buildDailySummary(employee, allPunches, hrSettings);

  await HrDailyAttendance.findOneAndUpdate(
    { employee_id: empOid, date: dateStr },
    { $set: { shop_id: shopOid, ...summary, source, updated_at: new Date() } },
    { upsert: true, new: true }
  );

  return {
    punch,
    punchType,
    isLate: summary.is_late,
    lateMinutes: summary.late_minutes,
    lateDeduction: summary.late_deduction,
    lunchMinutes: summary.lunch_minutes,
    workedMinutes: summary.total_worked_minutes,
    status: summary.status,
    message: `${punchType.replace('_', ' ')} recorded at ${now.toLocaleTimeString('en-IN')}`,
  };
}

async function softwarePunch(req, res) {
  try {
    const shopId = requireShop(req, res); if (!shopId) return;
    const { employeeId, source = 'SOFTWARE' } = req.body;
    if (!employeeId) return res.status(400).json({ success: false, message: 'employeeId required' });
    const result = await processPunch(shopId, employeeId, source, null, null);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[HR softwarePunch]', err);
    return res.status(500).json({ success: false, message: err.message || 'Punch failed' });
  }
}

// ─── Manual marking ───────────────────────────────────────────────────────────

async function manualMark(req, res) {
  try {
    const shopId = requireShop(req, res); if (!shopId) return;
    const { employeeId, date, status, leaveType, notes } = req.body;
    if (!employeeId || !date || !status) {
      return res.status(400).json({ success: false, message: 'employeeId, date and status required' });
    }
    const valid = ['PRESENT', 'ABSENT', 'LEAVE', 'HOLIDAY'];
    if (!valid.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${valid.join(', ')}` });
    }
    const empOid = toObjectId(employeeId);
    if (!empOid) return res.status(400).json({ success: false, message: 'Invalid employeeId' });
    const rec = await HrDailyAttendance.findOneAndUpdate(
      { employee_id: empOid, date },
      { $set: { shop_id: shopId, status, source: 'MANUAL', notes: notes || leaveType || '', updated_at: new Date() } },
      { upsert: true, new: true }
    );
    return res.json({ success: true, data: rec });
  } catch (err) {
    console.error('[HR manualMark]', err);
    return res.status(500).json({ success: false, message: 'Failed to mark attendance' });
  }
}

// ─── Attendance queries ───────────────────────────────────────────────────────

function attendanceToFrontend(rec, employee) {
  const r = rec.toObject ? rec.toObject() : rec;
  return {
    _id: r._id,
    employeeId: employee?._id || r.employee_id,
    employee: employee ? {
      _id: employee._id,
      name: employee.name || employee.employee_name || '',
      department: employee.department || '',
      designation: employee.designation || '',
    } : r.employee_id,
    date: r.date,
    status: r.status,
    firstPunchTime: r.check_in_time,
    lastPunchTime:  r.check_out_time,
    checkInTime:    r.check_in_time,
    checkOutTime:   r.check_out_time,
    lunchOutTime:   r.lunch_out_time,
    lunchInTime:    r.lunch_in_time,
    lunchMinutes:   r.lunch_minutes || 0,
    isLate:         !!r.is_late,
    lateMinutes:    r.late_minutes || 0,
    lateDeduction:  r.late_deduction || 0,
    totalWorkMinutes: r.total_worked_minutes || 0,
    source: r.source,
    notes: r.notes,
  };
}

async function getDailyAttendance(req, res) {
  try {
    const shopId = requireShop(req, res); if (!shopId) return;
    const date = req.query.date || todayIST();
    const records = await HrDailyAttendance.find({ shop_id: shopId, date })
      .populate('employee_id', 'name employee_name phone mobile_number department designation shift')
      .lean();
    const empIds = records.map(r => r.employee_id?._id).filter(Boolean);
    const punches = await HrPunch.find({ shop_id: shopId, date, employee_id: { $in: empIds } }).lean();
    const punchMap = {};
    punches.forEach(p => {
      const key = p.employee_id.toString();
      (punchMap[key] = punchMap[key] || []).push(p);
    });
    const data = records.map(r => ({
      ...attendanceToFrontend(r, r.employee_id),
      punches: (punchMap[r.employee_id?._id?.toString()] || []).map(p => ({
        _id: p._id,
        time: p.punch_time,
        type: p.punch_type,
        source: p.source,
        isLate: p.is_late,
        lateMinutes: p.late_minutes,
      })),
    }));
    return res.json({ success: true, data, date });
  } catch (err) {
    console.error('[HR getDailyAttendance]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch attendance' });
  }
}

async function getMonthlyAttendance(req, res) {
  try {
    const shopId = requireShop(req, res); if (!shopId) return;
    const { id: employeeId } = req.params;
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ success: false, message: 'month and year required' });
    const empOid = toObjectId(employeeId);
    if (!empOid) return res.status(400).json({ success: false, message: 'Invalid employeeId' });
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const records = await HrDailyAttendance.find({
      shop_id: shopId,
      employee_id: empOid,
      date: { $regex: `^${monthStr}` }
    }).sort({ date: 1 }).lean();

    const summary = {
      present: records.filter(r => r.status === 'PRESENT').length,
      absent: records.filter(r => r.status === 'ABSENT').length,
      leave: records.filter(r => r.status === 'LEAVE').length,
      lateDays: records.filter(r => r.is_late).length,
      totalLateMinutes: records.reduce((s, r) => s + (r.late_minutes || 0), 0),
      totalLateDeduction: records.reduce((s, r) => s + (r.late_deduction || 0), 0),
      totalLunchMinutes: records.reduce((s, r) => s + (r.lunch_minutes || 0), 0),
      totalWorkedMinutes: records.reduce((s, r) => s + (r.total_worked_minutes || 0), 0),
    };
    return res.json({
      success: true,
      data: records.map(r => attendanceToFrontend(r)),
      summary,
    });
  } catch (err) {
    console.error('[HR getMonthlyAttendance]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch monthly attendance' });
  }
}

async function getAttendanceReport(req, res) {
  try {
    const shopId = requireShop(req, res); if (!shopId) return;
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ success: false, message: 'month and year required' });
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const employees = await Employee.find({ shop_id: shopId, is_active: true }).lean();
    const records = await HrDailyAttendance.find({ shop_id: shopId, date: { $regex: `^${monthStr}` } }).lean();

    const recMap = {};
    records.forEach(r => {
      const key = r.employee_id.toString();
      (recMap[key] = recMap[key] || []).push(r);
    });

    const data = employees.map(emp => {
      const empRecords = recMap[emp._id.toString()] || [];
      return {
        employee: mapDbToFrontend(emp),
        present: empRecords.filter(r => r.status === 'PRESENT').length,
        absent: empRecords.filter(r => r.status === 'ABSENT').length,
        leave: empRecords.filter(r => r.status === 'LEAVE').length,
        lateEntries: empRecords.filter(r => r.is_late).length,
        totalLateMinutes: empRecords.reduce((s, r) => s + (r.late_minutes || 0), 0),
        totalLateDeduction: empRecords.reduce((s, r) => s + (r.late_deduction || 0), 0),
        totalLunchMinutes: empRecords.reduce((s, r) => s + (r.lunch_minutes || 0), 0),
        records: empRecords.map(r => attendanceToFrontend(r)),
      };
    });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[HR getAttendanceReport]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch report' });
  }
}

// ─── Salary calc ──────────────────────────────────────────────────────────────

async function buildMonthlyAttendanceSummary(empOid, monthStr) {
  const records = await HrDailyAttendance.find({
    employee_id: empOid,
    date: { $regex: `^${monthStr}` }
  }).lean();
  return {
    records,
    present_days: records.filter(r => r.status === 'PRESENT').length,
    absent_days:  records.filter(r => r.status === 'ABSENT').length,
    leave_days:   records.filter(r => r.status === 'LEAVE').length,
    total_late_entries: records.filter(r => r.is_late).length,
    total_late_minutes: records.reduce((s, r) => s + (r.late_minutes || 0), 0),
    total_late_deduction: records.reduce((s, r) => s + (r.late_deduction || 0), 0),
  };
}

function calculateSalary(employee, summary, year, monthNum) {
  const daily = employee.daily_salary || 0;
  const workingDays = workingDaysInMonth(year, monthNum, employee.weekly_off || ['SUN']);
  const earnedBase = Math.round(daily * summary.present_days * 100) / 100;
  const lateDeduction = Math.round(summary.total_late_deduction * 100) / 100;
  const netSalary = Math.max(0, Math.round((earnedBase - lateDeduction) * 100) / 100);

  return {
    daily_salary: daily,
    total_working_days: workingDays,
    present_days: summary.present_days,
    absent_days: summary.absent_days,
    leave_days: summary.leave_days,
    total_late_entries: summary.total_late_entries,
    total_late_minutes: summary.total_late_minutes,
    earned_base: earnedBase,
    late_deduction: lateDeduction,
    net_salary: netSalary,
  };
}

function mapSalaryToFrontend(rec) {
  const r = rec.toObject ? rec.toObject() : rec;
  const empRaw = r.employee_id;
  const employee = (empRaw && typeof empRaw === 'object' && !empRaw.toString)
    ? {
        name: empRaw.name || empRaw.employee_name || '',
        department: empRaw.department || '',
        designation: empRaw.designation || '',
      }
    : null;
  const employeeId = empRaw?._id ? empRaw._id.toString() : (empRaw ? empRaw.toString() : null);

  const earnings = [{ name: 'Earned (Daily × Present)', amount: r.earned_base || 0 }];
  const deductions = [];
  if ((r.late_deduction || 0) > 0) {
    deductions.push({
      name: 'Late Entry Deduction',
      amount: r.late_deduction,
      reason: `${r.total_late_entries || 0} late day(s), ${r.total_late_minutes || 0} late minutes`,
    });
  }

  return {
    _id: r._id,
    employeeId,
    employee,
    month: r.month_number,
    year: r.year,
    status: r.status || 'DRAFT',
    presentDays: r.present_days || 0,
    absentDays: r.absent_days || 0,
    leaveDays: r.leave_days || 0,
    lateDays: r.total_late_entries || 0,
    totalLateMinutes: r.total_late_minutes || 0,
    dailySalary: r.daily_salary || 0,
    earnedBase: r.earned_base || 0,
    earnings,
    totalEarnings: r.earned_base || 0,
    deductions,
    totalDeductions: r.late_deduction || 0,
    lateDeduction: r.late_deduction || 0,
    netSalary: r.net_salary || 0,
    paidAt: r.paid_at || null,
    paidAmount: r.paid_amount || 0,
  };
}

async function generateSalary(req, res) {
  try {
    const shopId = requireShop(req, res); if (!shopId) return;
    const { employeeId, month, year } = req.body;
    if (!employeeId || !month || !year) {
      return res.status(400).json({ success: false, message: 'employeeId, month and year required' });
    }
    const monthNum = parseInt(month);
    const yearNum  = parseInt(year);
    const monthStr = `${yearNum}-${String(monthNum).padStart(2, '0')}`;
    const empOid   = toObjectId(employeeId);
    if (!empOid) return res.status(400).json({ success: false, message: 'Invalid employeeId' });

    const employee = await Employee.findOne({ _id: empOid, shop_id: shopId }).lean();
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const summary = await buildMonthlyAttendanceSummary(empOid, monthStr);
    const calc    = calculateSalary(employee, summary, yearNum, monthNum);

    const record = await HrSalaryRecord.findOneAndUpdate(
      { employee_id: empOid, month: monthStr },
      {
        $set: {
          shop_id: shopId,
          year: yearNum,
          month_number: monthNum,
          ...calc,
          status: 'DRAFT',
          updated_at: new Date(),
        }
      },
      { upsert: true, new: true }
    );

    const populated = await HrSalaryRecord.findById(record._id)
      .populate('employee_id', 'name employee_name department designation')
      .lean();
    return res.json({ success: true, data: mapSalaryToFrontend(populated) });
  } catch (err) {
    console.error('[HR generateSalary]', err);
    return res.status(500).json({ success: false, message: 'Failed to generate salary' });
  }
}

async function generateBulkSalary(req, res) {
  try {
    const shopId = requireShop(req, res); if (!shopId) return;
    const { month, year } = req.body;
    if (!month || !year) return res.status(400).json({ success: false, message: 'month and year required' });
    const monthNum = parseInt(month);
    const yearNum  = parseInt(year);
    const monthStr = `${yearNum}-${String(monthNum).padStart(2, '0')}`;

    const employees = await Employee.find({ shop_id: shopId, is_active: true }).lean();
    const results = [];
    for (const emp of employees) {
      try {
        const summary = await buildMonthlyAttendanceSummary(emp._id, monthStr);
        const calc    = calculateSalary(emp, summary, yearNum, monthNum);
        const record  = await HrSalaryRecord.findOneAndUpdate(
          { employee_id: emp._id, month: monthStr },
          {
            $set: {
              shop_id: shopId,
              year: yearNum,
              month_number: monthNum,
              ...calc,
              status: 'DRAFT',
              updated_at: new Date(),
            }
          },
          { upsert: true, new: true }
        );
        results.push({ employeeId: emp._id.toString(), name: emp.name || emp.employee_name, success: true, netSalary: record.net_salary });
      } catch (e) {
        results.push({ employeeId: emp._id.toString(), name: emp.name || emp.employee_name, success: false, error: e.message });
      }
    }
    const successList = results.filter(r => r.success);
    const failedList  = results.filter(r => !r.success);
    return res.json({
      success: true,
      result: { success: successList, failed: failedList },
      generated: successList.length,
    });
  } catch (err) {
    console.error('[HR generateBulkSalary]', err);
    return res.status(500).json({ success: false, message: 'Failed to generate bulk salary' });
  }
}

async function getSalaryReport(req, res) {
  try {
    const shopId = requireShop(req, res); if (!shopId) return;
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ success: false, message: 'month and year required' });
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const records = await HrSalaryRecord.find({ shop_id: shopId, month: monthStr })
      .populate('employee_id', 'name employee_name department designation daily_salary')
      .lean();

    const totalEarned = records.reduce((s, r) => s + (r.earned_base || 0), 0);
    const totalLateDeduction = records.reduce((s, r) => s + (r.late_deduction || 0), 0);
    const totalNetSalary = records.reduce((s, r) => s + (r.net_salary || 0), 0);

    const summary = {
      totalEmployees: records.length,
      totalEarned: Math.round(totalEarned * 100) / 100,
      totalLateDeduction: Math.round(totalLateDeduction * 100) / 100,
      totalDeductions: Math.round(totalLateDeduction * 100) / 100,
      totalNetSalary: Math.round(totalNetSalary * 100) / 100,
      paid: records.filter(r => r.status === 'PAID').length,
      pending: records.filter(r => r.status !== 'PAID').length,
    };
    return res.json({ success: true, data: records.map(mapSalaryToFrontend), summary });
  } catch (err) {
    console.error('[HR getSalaryReport]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch salary report' });
  }
}

async function getSalaryRecord(req, res) {
  try {
    const shopId = requireShop(req, res); if (!shopId) return;
    const { id: employeeId } = req.params;
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ success: false, message: 'month and year required' });
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const record = await HrSalaryRecord.findOne({
      employee_id: toObjectId(employeeId), month: monthStr, shop_id: shopId
    })
      .populate('employee_id', 'name employee_name department designation')
      .lean();
    if (!record) return res.status(404).json({ success: false, message: 'Salary record not found. Generate it first.' });
    return res.json({ success: true, data: mapSalaryToFrontend(record) });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch salary record' });
  }
}

async function finalizeSalary(req, res) {
  try {
    const shopId = requireShop(req, res); if (!shopId) return;
    const { id: employeeId } = req.params;
    const { month, year } = req.body;
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const record = await HrSalaryRecord.findOneAndUpdate(
      { employee_id: toObjectId(employeeId), month: monthStr, shop_id: shopId, status: 'DRAFT' },
      { $set: { status: 'FINALIZED', updated_at: new Date() } },
      { new: true }
    );
    if (!record) return res.status(404).json({ success: false, message: 'Record not found or already finalized' });
    return res.json({ success: true, data: record });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to finalize salary' });
  }
}

async function markSalaryPaid(req, res) {
  try {
    const shopId = requireShop(req, res); if (!shopId) return;
    const { id: employeeId } = req.params;
    const { month, year, paidAmount } = req.body;
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const record = await HrSalaryRecord.findOneAndUpdate(
      { employee_id: toObjectId(employeeId), month: monthStr, shop_id: shopId },
      { $set: { status: 'PAID', paid_at: new Date(), paid_amount: paidAmount || 0, updated_at: new Date() } },
      { new: true }
    );
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });
    return res.json({ success: true, data: record });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to mark salary as paid' });
  }
}

// ─── HR shop-level settings ───────────────────────────────────────────────────

async function getHrSettings(req, res) {
  try {
    const shopId = requireShop(req, res); if (!shopId) return;
    const settings = await getShopHrSettings(shopId);
    return res.json({
      success: true,
      data: {
        duplicatePunchWindowMinutes: settings.duplicate_punch_window_minutes,
        lunchThresholdTime: settings.lunch_threshold_time,
        lunchBreakMinutes: settings.lunch_break_minutes,
      },
    });
  } catch (err) {
    console.error('[HR getHrSettings]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch HR settings' });
  }
}

async function updateHrSettings(req, res) {
  try {
    const shopId = requireShop(req, res); if (!shopId) return;
    const { duplicatePunchWindowMinutes, lunchThresholdTime, lunchBreakMinutes } = req.body;
    const update = {};
    if (duplicatePunchWindowMinutes !== undefined) {
      const v = Number(duplicatePunchWindowMinutes);
      if (!(v >= 0 && v <= 24 * 60)) return res.status(400).json({ success: false, message: 'duplicatePunchWindowMinutes must be 0–1440' });
      update['hr_settings.duplicate_punch_window_minutes'] = v;
    }
    if (lunchThresholdTime !== undefined) {
      if (!/^\d{2}:\d{2}$/.test(String(lunchThresholdTime))) return res.status(400).json({ success: false, message: 'lunchThresholdTime must be HH:MM' });
      update['hr_settings.lunch_threshold_time'] = String(lunchThresholdTime);
    }
    if (lunchBreakMinutes !== undefined) {
      const v = Number(lunchBreakMinutes);
      if (!(v >= 0 && v <= 240)) return res.status(400).json({ success: false, message: 'lunchBreakMinutes must be 0–240' });
      update['hr_settings.lunch_break_minutes'] = v;
    }
    await Shop.findByIdAndUpdate(shopId, { $set: update });
    const settings = await getShopHrSettings(shopId);
    return res.json({
      success: true,
      message: 'HR settings updated',
      data: {
        duplicatePunchWindowMinutes: settings.duplicate_punch_window_minutes,
        lunchThresholdTime: settings.lunch_threshold_time,
        lunchBreakMinutes: settings.lunch_break_minutes,
      },
    });
  } catch (err) {
    console.error('[HR updateHrSettings]', err);
    return res.status(500).json({ success: false, message: 'Failed to update HR settings' });
  }
}

module.exports = {
  // Employee
  listEmployees, createEmployee, updateEmployee, deactivateEmployee, reactivateEmployee, deleteEmployee,
  // Attendance
  processPunch, softwarePunch, manualMark, getDailyAttendance, getMonthlyAttendance, getAttendanceReport,
  // Salary
  generateSalary, generateBulkSalary, getSalaryReport, getSalaryRecord, finalizeSalary, markSalaryPaid,
  // Settings
  getHrSettings, updateHrSettings,
};

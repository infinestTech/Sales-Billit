'use strict';
/**
 * HR Controller
 * Handles employee management, attendance punch tracking, and salary calculation.
 * Works for both eSSL M20 biometric punches and software (manual) punches.
 */

const mongoose = require('mongoose');
const { Employee, HrPunch, HrDailyAttendance, HrSalaryRecord } = require('../models/mongoModels');
const { formatIST } = require('../utils/dateHelper');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayIST() {
  return formatIST(new Date(), 'YYYY-MM-DD');
}

function toObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
}

/** Parse "HH:MM" string into {h, m} */
function parseTime(timeStr) {
  const [h, m] = (timeStr || '09:00').split(':').map(Number);
  return { h: h || 0, m: m || 0 };
}

/** Get today's date as Date at a given HH:MM (local server time treated as IST) */
function todayAt(timeStr, referenceDate) {
  const base = referenceDate ? new Date(referenceDate) : new Date();
  const { h, m } = parseTime(timeStr);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
}

/** Get number of working days in a month for an employee */
function workingDaysInMonth(year, monthNum, weeklyOff = ['SUN']) {
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dayName = dayNames[new Date(year, monthNum - 1, d).getDay()];
    if (!weeklyOff.includes(dayName)) count++;
  }
  return count;
}

/** Map frontend camelCase employee form to DB snake_case */
function mapFormToDb(form, shopId) {
  return {
    shop_id: shopId,
    // Legacy compat
    employee_name: form.name || form.employee_name,
    mobile_number: form.phone || form.mobile_number,
    // HR fields
    is_active: form.isActive !== undefined ? form.isActive : true,
    name: form.name,
    phone: form.phone,
    email: form.email,
    address: form.address,
    joining_date: form.joiningDate ? new Date(form.joiningDate) : undefined,
    department: form.department,
    designation: form.designation,
    gross_salary: Number(form.grossSalary) || 0,
    pay_components: (form.payComponents || []).map(c => ({
      name: c.name,
      type: c.type,
      calculation_type: c.calculationType,
      value: Number(c.value) || 0,
      is_active: c.isActive !== false,
    })),
    shift: form.shift ? {
      name: form.shift.name,
      start_time: form.shift.startTime,
      end_time: form.shift.endTime,
      working_hours: Number(form.shift.workingHours) || 8,
      grace_period_minutes: Number(form.shift.gracePeriodMinutes) || 15,
    } : undefined,
    working_days_per_week: Number(form.workingDaysPerWeek) || 6,
    weekly_off: form.weeklyOff || ['SUN'],
    permission_policy: form.permissionPolicy ? {
      max_hours_per_month: Number(form.permissionPolicy.maxHoursPerMonth) || 2,
      deduction_type: form.permissionPolicy.deductionType || 'PROPORTIONAL',
      deduction_amount_per_hour: Number(form.permissionPolicy.deductionAmountPerHour) || 0,
    } : undefined,
    late_policy: form.latePolicy ? {
      grace_period_minutes: Number(form.latePolicy.gracePeriodMinutes) || 15,
      deduction_type: form.latePolicy.deductionType || 'PROPORTIONAL',
      deduction_amount_per_late: Number(form.latePolicy.deductionAmountPerLate) || 0,
      half_day_after_n_lates: Number(form.latePolicy.halfDayAfterNLates) || 3,
    } : undefined,
    paid_leaves_per_year: Number(form.paidLeavesPerYear) || 12,
    // device_pin is set separately via eSSL panel; map esslDeviceUserId if provided
    device_pin: form.esslDeviceUserId || form.device_pin,
  };
}

/** Map DB employee document to frontend camelCase format */
function mapDbToFrontend(emp) {
  const e = emp.toObject ? emp.toObject() : emp;
  return {
    _id: e._id,
    employeeId: e._id,          // frontend uses employeeId
    shopId: e.shop_id,
    isActive: e.is_active !== false,
    name: e.name || e.employee_name || '',
    phone: e.phone || e.mobile_number || '',
    email: e.email || '',
    address: e.address || '',
    bloodGroup: e.blood_group || '',
    joiningDate: e.joining_date,
    department: e.department || '',
    designation: e.designation || '',
    grossSalary: e.gross_salary || e.daily_salary || 0,
    payComponents: (e.pay_components || []).map(c => ({
      name: c.name,
      type: c.type,
      calculationType: c.calculation_type,
      value: c.value,
      isActive: c.is_active,
    })),
    shift: e.shift ? {
      name: e.shift.name,
      startTime: e.shift.start_time,
      endTime: e.shift.end_time,
      workingHours: e.shift.working_hours,
      gracePeriodMinutes: e.shift.grace_period_minutes,
    } : { name: 'General', startTime: '09:00', endTime: '18:00', workingHours: 8, gracePeriodMinutes: 15 },
    workingDaysPerWeek: e.working_days_per_week || 6,
    weeklyOff: e.weekly_off || ['SUN'],
    permissionPolicy: e.permission_policy ? {
      maxHoursPerMonth: e.permission_policy.max_hours_per_month,
      deductionType: e.permission_policy.deduction_type,
      deductionAmountPerHour: e.permission_policy.deduction_amount_per_hour,
    } : { maxHoursPerMonth: 2, deductionType: 'PROPORTIONAL', deductionAmountPerHour: 0 },
    latePolicy: e.late_policy ? {
      gracePeriodMinutes: e.late_policy.grace_period_minutes,
      deductionType: e.late_policy.deduction_type,
      deductionAmountPerLate: e.late_policy.deduction_amount_per_late,
      halfDayAfterNLates: e.late_policy.half_day_after_n_lates,
    } : { gracePeriodMinutes: 15, deductionType: 'PROPORTIONAL', deductionAmountPerLate: 0, halfDayAfterNLates: 3 },
    paidLeavesPerYear: e.paid_leaves_per_year || 12,
    esslDeviceUserId: e.device_pin || '',
    createdAt: e.created_at,
  };
}

// ─── Employee CRUD ────────────────────────────────────────────────────────────

async function listEmployees(req, res) {
  try {
    const shopId = toObjectId(req.shopId || req.query.shopId);
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
    const shopId = toObjectId(req.shopId || req.body.shopId);
    const data = mapFormToDb(req.body, shopId);
    // Require at least a name
    if (!data.name && !data.employee_name) {
      return res.status(400).json({ success: false, message: 'Employee name is required' });
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
    const shopId = toObjectId(req.shopId);
    const { id } = req.params;
    const emp = await Employee.findOne({ _id: toObjectId(id), shop_id: shopId });
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
    const updates = mapFormToDb(req.body, shopId);
    Object.assign(emp, updates);
    await emp.save();
    return res.json({ success: true, data: mapDbToFrontend(emp) });
  } catch (err) {
    console.error('[HR updateEmployee]', err);
    return res.status(500).json({ success: false, message: 'Failed to update employee' });
  }
}

async function deactivateEmployee(req, res) {
  try {
    const emp = await Employee.findOneAndUpdate(
      { _id: toObjectId(req.params.id), shop_id: toObjectId(req.shopId) },
      { is_active: false },
      { new: true }
    );
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
    return res.json({ success: true, message: 'Employee deactivated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to deactivate employee' });
  }
}

async function reactivateEmployee(req, res) {
  try {
    const emp = await Employee.findOneAndUpdate(
      { _id: toObjectId(req.params.id), shop_id: toObjectId(req.shopId) },
      { is_active: true },
      { new: true }
    );
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
    return res.json({ success: true, message: 'Employee reactivated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to reactivate employee' });
  }
}

// ─── Attendance Punch Logic ───────────────────────────────────────────────────

/**
 * Process a punch event — works for both SOFTWARE and ESSL_M20 sources.
 * Returns the resulting punch record and updated daily summary.
 *
 * Punch type resolution:
 *   No daily record yet          → CHECK_IN
 *   Has CHECK_IN, no open PERM   → PERMISSION_OUT (temporary leave)
 *   Has open PERMISSION_OUT      → PERMISSION_IN (returning from permission)
 *   Explicit check-out request   → CHECK_OUT
 */
async function processPunch(shopId, employeeId, source, overridePunchType, punchTimeOverride) {
  const shopOid = toObjectId(shopId);
  const empOid = toObjectId(employeeId);
  const now = punchTimeOverride || new Date();
  const dateStr = formatIST(now, 'YYYY-MM-DD');

  const employee = await Employee.findOne({ _id: empOid, shop_id: shopOid }).lean();
  if (!employee) throw new Error('Employee not found');

  // Get today's punches
  const todayPunches = await HrPunch.find({ employee_id: empOid, date: dateStr }).sort({ punch_time: 1 }).lean();
  const daily = await HrDailyAttendance.findOne({ employee_id: empOid, date: dateStr });

  let punchType = overridePunchType;

  if (!punchType) {
    if (todayPunches.length === 0) {
      punchType = 'CHECK_IN';
    } else {
      const lastPunch = todayPunches[todayPunches.length - 1];
      if (lastPunch.punch_type === 'PERMISSION_OUT') {
        punchType = 'PERMISSION_IN';
      } else {
        punchType = 'PERMISSION_OUT';
      }
    }
  }

  // Check for late entry on CHECK_IN
  let isLate = false;
  let lateMinutes = 0;
  if (punchType === 'CHECK_IN') {
    const graceMinutes = employee.late_policy?.grace_period_minutes ?? employee.shift?.grace_period_minutes ?? 15;
    const shiftStart = employee.shift?.start_time || '09:00';
    const { h, m } = parseTime(shiftStart);
    const shiftStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m + graceMinutes, 0, 0);
    if (now > shiftStartDate) {
      isLate = true;
      lateMinutes = Math.floor((now - shiftStartDate) / 60000);
    }
  }

  // Save punch log
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

  // Update or create daily attendance summary
  const allPunches = [...todayPunches, { punch_type: punchType, punch_time: now, is_late: isLate, late_minutes: lateMinutes }];

  const checkIn = allPunches.find(p => p.punch_type === 'CHECK_IN');
  const checkOut = allPunches.filter(p => p.punch_type === 'CHECK_OUT').pop();

  // Calculate total permission minutes from PERMISSION_OUT/IN pairs
  let totalPermissionMinutes = 0;
  let permOut = null;
  for (const p of allPunches) {
    if (p.punch_type === 'PERMISSION_OUT') permOut = p;
    if (p.punch_type === 'PERMISSION_IN' && permOut) {
      totalPermissionMinutes += Math.floor((new Date(p.punch_time) - new Date(permOut.punch_time)) / 60000);
      permOut = null;
    }
  }

  const dailyUpdate = {
    status: checkIn ? 'PRESENT' : 'ABSENT',
    check_in_time: checkIn?.punch_time,
    check_out_time: checkOut?.punch_time,
    is_late: isLate || (daily?.is_late ?? false),
    late_minutes: Math.max(lateMinutes, daily?.late_minutes ?? 0),
    total_permission_minutes: totalPermissionMinutes,
    source,
    updated_at: new Date(),
  };

  await HrDailyAttendance.findOneAndUpdate(
    { employee_id: empOid, date: dateStr },
    { $set: { shop_id: shopOid, ...dailyUpdate } },
    { upsert: true, new: true }
  );

  return {
    punch,
    punchType,
    isLate,
    lateMinutes,
    totalPermissionMinutes,
    message: `${punchType.replace('_', ' ')} recorded at ${now.toLocaleTimeString('en-IN')}`,
  };
}

async function softwarePunch(req, res) {
  try {
    const shopId = req.shopId;
    const { employeeId, source = 'SOFTWARE', punchType } = req.body;
    if (!employeeId) return res.status(400).json({ success: false, message: 'employeeId required' });
    const result = await processPunch(shopId, employeeId, source, punchType || null, null);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[HR softwarePunch]', err);
    return res.status(500).json({ success: false, message: err.message || 'Punch failed' });
  }
}

async function manualMark(req, res) {
  try {
    const shopId = toObjectId(req.shopId);
    const { employeeId, date, status, leaveType, notes } = req.body;
    if (!employeeId || !date || !status) {
      return res.status(400).json({ success: false, message: 'employeeId, date and status required' });
    }
    const validStatuses = ['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'HOLIDAY'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${validStatuses.join(', ')}` });
    }
    const rec = await HrDailyAttendance.findOneAndUpdate(
      { employee_id: toObjectId(employeeId), date },
      { $set: { shop_id: shopId, status, source: 'MANUAL', notes: notes || leaveType || '', updated_at: new Date() } },
      { upsert: true, new: true }
    );
    return res.json({ success: true, data: rec });
  } catch (err) {
    console.error('[HR manualMark]', err);
    return res.status(500).json({ success: false, message: 'Failed to mark attendance' });
  }
}

async function getDailyAttendance(req, res) {
  try {
    const shopId = toObjectId(req.shopId || req.query.shopId);
    const date = req.query.date || todayIST();
    const records = await HrDailyAttendance.find({ shop_id: shopId, date })
      .populate('employee_id', 'name employee_name phone mobile_number department designation shift')
      .lean();
    // Enrich with today's punches
    const empIds = records.map(r => r.employee_id?._id);
    const punches = await HrPunch.find({ shop_id: shopId, date, employee_id: { $in: empIds } }).lean();
    const punchMap = {};
    punches.forEach(p => {
      const key = p.employee_id.toString();
      if (!punchMap[key]) punchMap[key] = [];
      punchMap[key].push(p);
    });
    const data = records.map(r => ({
      ...r,
      employee: r.employee_id,
      punches: punchMap[r.employee_id?._id?.toString()] || [],
    }));
    return res.json({ success: true, data, date });
  } catch (err) {
    console.error('[HR getDailyAttendance]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch attendance' });
  }
}

async function getMonthlyAttendance(req, res) {
  try {
    const shopId = toObjectId(req.shopId);
    const { id: employeeId } = req.params;
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ success: false, message: 'month and year required' });
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const records = await HrDailyAttendance.find({
      shop_id: shopId,
      employee_id: toObjectId(employeeId),
      date: { $regex: `^${monthStr}` }
    }).sort({ date: 1 }).lean();

    const summary = {
      present: records.filter(r => r.status === 'PRESENT').length,
      absent: records.filter(r => r.status === 'ABSENT').length,
      halfDay: records.filter(r => r.status === 'HALF_DAY').length,
      leave: records.filter(r => r.status === 'LEAVE').length,
      lateEntries: records.filter(r => r.is_late).length,
      totalPermissionMinutes: records.reduce((s, r) => s + (r.total_permission_minutes || 0), 0),
    };
    return res.json({ success: true, data: records, summary });
  } catch (err) {
    console.error('[HR getMonthlyAttendance]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch monthly attendance' });
  }
}

async function getAttendanceReport(req, res) {
  try {
    const shopId = toObjectId(req.shopId || req.query.shopId);
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ success: false, message: 'month and year required' });
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const employees = await Employee.find({ shop_id: shopId, is_active: true }).lean();
    const records = await HrDailyAttendance.find({ shop_id: shopId, date: { $regex: `^${monthStr}` } }).lean();

    const recMap = {};
    records.forEach(r => {
      const key = r.employee_id.toString();
      if (!recMap[key]) recMap[key] = [];
      recMap[key].push(r);
    });

    const data = employees.map(emp => {
      const empRecords = recMap[emp._id.toString()] || [];
      return {
        employee: mapDbToFrontend(emp),
        present: empRecords.filter(r => r.status === 'PRESENT').length,
        absent: empRecords.filter(r => r.status === 'ABSENT').length,
        halfDay: empRecords.filter(r => r.status === 'HALF_DAY').length,
        leave: empRecords.filter(r => r.status === 'LEAVE').length,
        lateEntries: empRecords.filter(r => r.is_late).length,
        totalPermissionMinutes: empRecords.reduce((s, r) => s + (r.total_permission_minutes || 0), 0),
        records: empRecords,
      };
    });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[HR getAttendanceReport]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch report' });
  }
}

// ─── Salary Calculation ───────────────────────────────────────────────────────

function calculateSalary(employee, attendanceSummary, year, monthNum) {
  const gross = employee.gross_salary || 0;
  const workingDays = workingDaysInMonth(year, monthNum, employee.weekly_off || ['SUN']);
  const presentDays = attendanceSummary.present + (attendanceSummary.halfDay * 0.5);
  const dailyRate = workingDays > 0 ? gross / workingDays : 0;
  const earnedBase = dailyRate * presentDays;

  // Pay components
  const components = (employee.pay_components || []).filter(c => c.is_active !== false);
  let totalEarnings = 0;
  let totalDeductions = 0;
  components.forEach(c => {
    const amt = c.calculation_type === 'PERCENTAGE' ? (gross * c.value) / 100 : c.value;
    if (c.type === 'EARNING') totalEarnings += amt;
    else totalDeductions += amt;
  });

  // Late deductions
  const lateCount = attendanceSummary.lateEntries || 0;
  let lateDeduction = 0;
  const lp = employee.late_policy;
  if (lp) {
    if (lp.deduction_type === 'FIXED') {
      lateDeduction = lateCount * (lp.deduction_amount_per_late || 0);
    } else {
      // Proportional: each late = half day deduction for every N lates
      const halfDays = Math.floor(lateCount / (lp.half_day_after_n_lates || 3));
      lateDeduction = halfDays * dailyRate * 0.5;
    }
  }

  // Permission deductions
  const permMinutes = attendanceSummary.totalPermissionMinutes || 0;
  const permHours = permMinutes / 60;
  let permDeduction = 0;
  const pp = employee.permission_policy;
  if (pp && permHours > (pp.max_hours_per_month || 0)) {
    const excessHours = permHours - (pp.max_hours_per_month || 0);
    if (pp.deduction_type === 'FIXED') {
      permDeduction = excessHours * (pp.deduction_amount_per_hour || 0);
    } else {
      const hourlyRate = gross / (workingDays * (employee.shift?.working_hours || 8));
      permDeduction = excessHours * hourlyRate;
    }
  }

  const netSalary = Math.max(0, earnedBase + totalEarnings - totalDeductions - lateDeduction - permDeduction);

  return {
    gross_salary: gross,
    earned_base: Math.round(earnedBase * 100) / 100,
    total_earnings: Math.round(totalEarnings * 100) / 100,
    total_working_days: workingDays,
    present_days: presentDays,
    absent_days: attendanceSummary.absent,
    half_day_count: attendanceSummary.halfDay || 0,
    leave_days: attendanceSummary.leave || 0,
    total_late_entries: lateCount,
    total_permission_minutes: permMinutes,
    late_deduction: Math.round(lateDeduction * 100) / 100,
    permission_deduction: Math.round(permDeduction * 100) / 100,
    other_deductions: Math.round(totalDeductions * 100) / 100,
    net_salary: Math.round(netSalary * 100) / 100,
    pay_components_snapshot: components.map(c => ({ name: c.name, type: c.type, calculation_type: c.calculation_type, value: c.value })),
  };
}

/** Convert a HrSalaryRecord DB document/lean object to camelCase for frontend */
function mapSalaryToFrontend(rec) {
  const r = rec.toObject ? rec.toObject() : rec;
  const gross = r.gross_salary || 0;
  const workingDays = r.total_working_days || 1;
  const presentDays = (r.present_days || 0) + (r.half_day_count || 0) * 0.5;

  // Compute earned_base if not stored (backward compat)
  const earnedBase = (r.earned_base != null && r.earned_base > 0)
    ? r.earned_base
    : (workingDays > 0 ? (gross / workingDays) * presentDays : 0);

  // Build earnings / deductions arrays from snapshot
  const earningComponents = (r.pay_components_snapshot || []).filter(c => c.type === 'EARNING');
  const deductionComponents = (r.pay_components_snapshot || []).filter(c => c.type === 'DEDUCTION');

  const earnings = [
    { name: 'Earned Base', amount: Math.round(earnedBase * 100) / 100 },
    ...earningComponents.map(c => ({
      name: c.name,
      amount: Math.round((c.calculation_type === 'PERCENTAGE' ? (gross * c.value) / 100 : c.value) * 100) / 100,
    })),
  ];
  const totalEarnings = earnings.reduce((s, e) => s + e.amount, 0);

  const deductions = [
    ...deductionComponents.map(c => ({
      name: c.name,
      amount: Math.round((c.calculation_type === 'PERCENTAGE' ? (gross * c.value) / 100 : c.value) * 100) / 100,
    })),
  ];
  if (r.late_deduction > 0) {
    deductions.push({ name: 'Late Entry Deduction', reason: `${r.total_late_entries} late entries`, amount: r.late_deduction });
  }
  if (r.permission_deduction > 0) {
    deductions.push({ name: 'Permission Hours Deduction', amount: r.permission_deduction });
  }
  const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);

  // Resolve populated employee_id
  const empRaw = r.employee_id;
  const employee = (empRaw && typeof empRaw === 'object' && !empRaw.toString)
    ? {
        name: empRaw.name || empRaw.employee_name || '',
        department: empRaw.department || '',
        designation: empRaw.designation || '',
      }
    : null;

  const employeeId = empRaw?._id ? empRaw._id.toString() : (empRaw ? empRaw.toString() : null);

  return {
    _id: r._id,
    employeeId,
    employee,
    month: r.month_number,    // frontend does: new Date(year, month - 1)
    year: r.year,
    status: r.status || 'DRAFT',
    // Attendance
    presentDays: r.present_days || 0,
    absentDays: r.absent_days || 0,
    halfDays: r.half_day_count || 0,
    paidLeaveDays: r.leave_days || 0,
    lateDays: r.total_late_entries || 0,
    totalPermissionMinutes: r.total_permission_minutes || 0,
    // Salary breakdown
    grossSalary: gross,
    earnings,
    totalEarnings: Math.round(totalEarnings * 100) / 100,
    deductions,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    netSalary: r.net_salary || 0,
    paidAt: r.paid_at || null,
    paidAmount: r.paid_amount || 0,
  };
}

async function generateSalary(req, res) {
  try {
    const shopId = toObjectId(req.shopId);
    const { employeeId, month, year } = req.body;
    if (!employeeId || !month || !year) {
      return res.status(400).json({ success: false, message: 'employeeId, month and year required' });
    }
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    const monthStr = `${yearNum}-${String(monthNum).padStart(2, '0')}`;

    const employee = await Employee.findOne({ _id: toObjectId(employeeId), shop_id: shopId }).lean();
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const records = await HrDailyAttendance.find({
      employee_id: toObjectId(employeeId),
      date: { $regex: `^${monthStr}` }
    }).lean();

    const summary = {
      present: records.filter(r => r.status === 'PRESENT').length,
      absent: records.filter(r => r.status === 'ABSENT').length,
      halfDay: records.filter(r => r.status === 'HALF_DAY').length,
      leave: records.filter(r => r.status === 'LEAVE').length,
      lateEntries: records.filter(r => r.is_late).length,
      totalPermissionMinutes: records.reduce((s, r) => s + (r.total_permission_minutes || 0), 0),
    };

    const calc = calculateSalary(employee, summary, yearNum, monthNum);

    const record = await HrSalaryRecord.findOneAndUpdate(
      { employee_id: toObjectId(employeeId), month: monthStr },
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
    const shopId = toObjectId(req.shopId || req.body.shopId);
    const { month, year } = req.body;
    if (!month || !year) return res.status(400).json({ success: false, message: 'month and year required' });

    const employees = await Employee.find({ shop_id: shopId, is_active: true }).lean();
    const results = [];

    for (const emp of employees) {
      try {
        const monthNum = parseInt(month);
        const yearNum = parseInt(year);
        const monthStr = `${yearNum}-${String(monthNum).padStart(2, '0')}`;
        const records = await HrDailyAttendance.find({
          employee_id: emp._id,
          date: { $regex: `^${monthStr}` }
        }).lean();
        const summary = {
          present: records.filter(r => r.status === 'PRESENT').length,
          absent: records.filter(r => r.status === 'ABSENT').length,
          halfDay: records.filter(r => r.status === 'HALF_DAY').length,
          leave: records.filter(r => r.status === 'LEAVE').length,
          lateEntries: records.filter(r => r.is_late).length,
          totalPermissionMinutes: records.reduce((s, r) => s + (r.total_permission_minutes || 0), 0),
        };
        const calc = calculateSalary(emp, summary, yearNum, monthNum);
        const record = await HrSalaryRecord.findOneAndUpdate(
          { employee_id: emp._id, month: monthStr },
          { $set: { shop_id: shopId, year: yearNum, month_number: monthNum, ...calc, status: 'DRAFT', updated_at: new Date() } },
          { upsert: true, new: true }
        );
        results.push({ employeeId: emp._id.toString(), name: emp.name || emp.employee_name, success: true, netSalary: record.net_salary });
      } catch (e) {
        results.push({ employeeId: emp._id.toString(), name: emp.name || emp.employee_name, success: false, error: e.message });
      }
    }

    const successList = results.filter(r => r.success);
    const failedList = results.filter(r => !r.success);
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
    const shopId = toObjectId(req.shopId || req.query.shopId);
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ success: false, message: 'month and year required' });
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const records = await HrSalaryRecord.find({ shop_id: shopId, month: monthStr })
      .populate('employee_id', 'name employee_name department designation gross_salary')
      .lean();

    const totalGross = records.reduce((s, r) => s + (r.gross_salary || 0), 0);
    const totalNetSalary = records.reduce((s, r) => s + (r.net_salary || 0), 0);
    const totalLateDeduction = records.reduce((s, r) => s + (r.late_deduction || 0), 0);
    const totalPermissionDeduction = records.reduce((s, r) => s + (r.permission_deduction || 0), 0);
    const totalOtherDeductions = records.reduce((s, r) => s + (r.other_deductions || 0), 0);
    const totalAbsenceDeduction = records.reduce((s, r) => {
      const wd = r.total_working_days || 1;
      const pd = (r.present_days || 0) + (r.half_day_count || 0) * 0.5;
      const eb = r.earned_base != null && r.earned_base > 0
        ? r.earned_base
        : (wd > 0 ? (r.gross_salary || 0) / wd * pd : 0);
      return s + Math.max(0, (r.gross_salary || 0) - eb);
    }, 0);

    const summary = {
      totalEmployees: records.length,
      totalGross,
      totalNetSalary,
      totalDeductions: totalAbsenceDeduction + totalLateDeduction + totalPermissionDeduction + totalOtherDeductions,
      totalAbsenceDeduction: Math.round(totalAbsenceDeduction * 100) / 100,
      totalLateDeduction: Math.round(totalLateDeduction * 100) / 100,
      totalPermissionDeduction: Math.round(totalPermissionDeduction * 100) / 100,
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
    const shopId = toObjectId(req.shopId);
    const { id: employeeId } = req.params;
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ success: false, message: 'month and year required' });
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const record = await HrSalaryRecord.findOne({ employee_id: toObjectId(employeeId), month: monthStr, shop_id: shopId })
      .populate('employee_id', 'name employee_name department designation').lean();
    if (!record) return res.status(404).json({ success: false, message: 'Salary record not found. Generate it first.' });
    return res.json({ success: true, data: mapSalaryToFrontend(record) });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch salary record' });
  }
}

async function finalizeSalary(req, res) {
  try {
    const shopId = toObjectId(req.shopId);
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
    const shopId = toObjectId(req.shopId);
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

module.exports = {
  // Employee
  listEmployees, createEmployee, updateEmployee, deactivateEmployee, reactivateEmployee,
  // Attendance
  processPunch, softwarePunch, manualMark, getDailyAttendance, getMonthlyAttendance, getAttendanceReport,
  // Salary
  generateSalary, generateBulkSalary, getSalaryReport, getSalaryRecord, finalizeSalary, markSalaryPaid,
};

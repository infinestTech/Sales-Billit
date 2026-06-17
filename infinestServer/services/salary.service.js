const SalaryRecord  = require('../models/SalaryRecord.model');
const AttendancePunch = require('../models/AttendancePunch.model');
const Employee      = require('../models/Employee.model');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function getWorkingDaysInMonth(month, year, weeklyOff = ['SUN']) {
  const totalDays = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= totalDays; d++) {
    const dayName = DAY_NAMES[new Date(year, month - 1, d).getDay()];
    if (!weeklyOff.includes(dayName)) count++;
  }
  return count;
}

// ─── Monthly salary calculator ─────────────────────────────────────────────────

/**
 * Calculates or recalculates salary for an employee for a given month/year.
 * Creates or updates a SalaryRecord document (DRAFT status).
 */
async function calculateMonthlySalary(employeeId, month, year, generatedBy = null) {
  const employee = await Employee.findOne({ employeeId, isActive: true });
  if (!employee) throw new Error(`Employee "${employeeId}" not found or inactive`);

  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate   = new Date(Date.UTC(year, month, 0));

  const attendanceRecords = await AttendancePunch.find({
    employee: employee._id,
    date: { $gte: startDate, $lte: endDate }
  });

  // ── Attendance summary ────────────────────────────────────────────────────
  const totalWorkingDays = getWorkingDaysInMonth(month, year, employee.weeklyOff);
  let presentDays = 0, absentDays = 0, halfDays = 0;
  let leaveDays = 0, paidLeaveDays = 0;
  let lateDays = 0, totalLateMinutes = 0, totalPermissionMinutes = 0;

  const monthlyPaidLeaveQuota = Math.floor(employee.paidLeavesPerYear / 12);
  let paidLeaveCounter = 0;

  for (const rec of attendanceRecords) {
    switch (rec.status) {
      case 'PRESENT':    presentDays++;                         break;
      case 'HALF_DAY':   halfDays++; presentDays += 0.5;        break;
      case 'LEAVE':
        leaveDays++;
        if (paidLeaveCounter < monthlyPaidLeaveQuota) {
          paidLeaveDays++;
          paidLeaveCounter++;
        }
        break;
      case 'HOLIDAY':
      case 'WEEKLY_OFF': presentDays++;                         break;
      default:                                                   break;
    }
    if (rec.isLate) { lateDays++; totalLateMinutes += rec.lateMinutes || 0; }
    totalPermissionMinutes += rec.totalPermissionMinutes || 0;
  }

  // Days with no record = absent
  const recordedDays = attendanceRecords.filter(
    r => !['WEEKLY_OFF', 'HOLIDAY'].includes(r.status)
  ).length;
  absentDays = Math.max(0, totalWorkingDays - recordedDays - leaveDays);

  // ── Per-unit salary rates ─────────────────────────────────────────────────
  const dailySalary     = employee.grossSalary / totalWorkingDays;
  const perMinuteSalary = dailySalary / (employee.shift.workingHours * 60);

  // ── Earnings from pay components ──────────────────────────────────────────
  const earnings = [];
  let totalEarnings = 0;

  const earningComponents = employee.payComponents.filter(
    c => c.isActive && c.type === 'EARNING'
  );

  if (earningComponents.length > 0) {
    for (const comp of earningComponents) {
      const amount = comp.calculationType === 'PERCENTAGE'
        ? (employee.grossSalary * comp.value) / 100
        : comp.value;
      earnings.push({ name: comp.name, amount });
      totalEarnings += amount;
    }
  } else {
    // No components configured — treat gross as single earning
    earnings.push({ name: 'Gross Salary', amount: employee.grossSalary });
    totalEarnings = employee.grossSalary;
  }

  // ── Deductions ────────────────────────────────────────────────────────────
  const deductions = [];

  // 1. Configured deduction components (PF, ESI, etc.)
  for (const comp of employee.payComponents.filter(c => c.isActive && c.type === 'DEDUCTION')) {
    const amount = comp.calculationType === 'PERCENTAGE'
      ? (employee.grossSalary * comp.value) / 100
      : comp.value;
    deductions.push({ name: comp.name, amount, reason: 'Configured deduction' });
  }

  // 2. Absence deduction
  const effectiveAbsentDays = absentDays + (halfDays * 0.5) - paidLeaveDays;
  const absenceDeduction = Math.max(0, effectiveAbsentDays * dailySalary);
  if (absenceDeduction > 0) {
    deductions.push({
      name: 'Absence Deduction',
      amount: absenceDeduction,
      reason: `${absentDays} absent + ${halfDays} half-days - ${paidLeaveDays} paid leaves`
    });
  }

  // 3. Permission hours deduction (excess beyond monthly allowance)
  const policy = employee.permissionPolicy;
  const maxPermissionMinutes = (policy.maxHoursPerMonth || 2) * 60;
  const excessPermissionMinutes = Math.max(0, totalPermissionMinutes - maxPermissionMinutes);
  let permissionDeduction = 0;

  if (excessPermissionMinutes > 0) {
    if (policy.deductionAmountPerHour > 0) {
      permissionDeduction = (excessPermissionMinutes / 60) * policy.deductionAmountPerHour;
    } else {
      // Proportional deduction from salary
      permissionDeduction = excessPermissionMinutes * perMinuteSalary;
    }
    deductions.push({
      name: 'Permission Hours Deduction',
      amount: permissionDeduction,
      reason: `${Math.round(excessPermissionMinutes)} excess permission minutes (allowed: ${policy.maxHoursPerMonth}h/month)`
    });
  }

  // 4. Late entry deduction
  let lateDeduction = 0;
  const latePolicy = employee.latePolicy;

  if (latePolicy.deductionType === 'FIXED_PER_LATE') {
    lateDeduction = lateDays * (latePolicy.deductionAmountPerLate || 0);
  } else if (latePolicy.deductionType === 'PROPORTIONAL') {
    lateDeduction = totalLateMinutes * perMinuteSalary;
  } else if (latePolicy.deductionType === 'HALF_DAY_AFTER_N') {
    const halfDayCount = Math.floor(lateDays / (latePolicy.halfDayAfterNLates || 3));
    lateDeduction = halfDayCount * (dailySalary / 2);
  }

  if (lateDeduction > 0) {
    deductions.push({
      name: 'Late Entry Deduction',
      amount: lateDeduction,
      reason: `${lateDays} late day(s), ${totalLateMinutes} total late minutes`
    });
  }

  const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);
  const netSalary = Math.max(0, totalEarnings - totalDeductions);

  // ── Upsert record ─────────────────────────────────────────────────────────
  const salaryData = {
    employeeId,
    month, year,
    totalWorkingDays,
    presentDays,
    absentDays,
    halfDays,
    leaveDays,
    paidLeaveDays,
    lateDays,
    totalLateMinutes,
    totalPermissionMinutes,
    grossSalary: employee.grossSalary,
    earnings,
    totalEarnings,
    deductions,
    totalDeductions,
    absenceDeduction,
    permissionDeduction,
    lateDeduction,
    netSalary,
    shopId: employee.shopId,
    generatedBy,
    status: 'DRAFT'
  };

  return SalaryRecord.findOneAndUpdate(
    { employee: employee._id, month, year },
    { ...salaryData, employee: employee._id },
    { upsert: true, new: true, runValidators: true }
  );
}

// ─── Bulk salary generation ────────────────────────────────────────────────────

async function generateBulkSalary(shopId, month, year, generatedBy = null) {
  const employees = await Employee.find({ shopId, isActive: true });
  const results = { success: [], failed: [] };

  for (const emp of employees) {
    try {
      const record = await calculateMonthlySalary(emp.employeeId, month, year, generatedBy);
      results.success.push({
        employeeId: emp.employeeId,
        name: emp.name,
        netSalary: record.netSalary
      });
    } catch (err) {
      results.failed.push({ employeeId: emp.employeeId, name: emp.name, error: err.message });
    }
  }

  return results;
}

module.exports = { calculateMonthlySalary, generateBulkSalary, getWorkingDaysInMonth };

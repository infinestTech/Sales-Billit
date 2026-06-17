const AttendancePunch = require('../models/AttendancePunch.model');
const Employee = require('../models/Employee.model');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDateOnly(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function shiftBoundary(employee, date, timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(date);
  // Use local date parts for shift boundary (punch times arrive in local time)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0);
}

// ─── Core punch processor ──────────────────────────────────────────────────────

/**
 * Records a single punch for an employee.
 * Punch type (IN/OUT) is determined by strict alternating rule:
 *   - No previous punch today  → IN
 *   - Last punch was IN        → OUT
 *   - Last punch was OUT       → IN
 *
 * @param {string} employeeId - logical employee ID
 * @param {Date}   punchTime
 * @param {string} source     - 'ESSL' | 'SOFTWARE'
 * @param {string} remark
 */
async function processPunch(employeeId, punchTime, source = 'SOFTWARE', remark = '') {
  const employee = await Employee.findOne({ employeeId, isActive: true });
  if (!employee) throw new Error(`Employee "${employeeId}" not found or inactive`);

  const punchDate = getDateOnly(punchTime);

  let record = await AttendancePunch.findOne({ employee: employee._id, date: punchDate });
  if (!record) {
    const scheduledStart = shiftBoundary(employee, punchTime, employee.shift.startTime);
    record = new AttendancePunch({
      employee: employee._id,
      employeeId: employee.employeeId,
      date: punchDate,
      scheduledStartTime: scheduledStart,
      scheduledWorkMinutes: employee.shift.workingHours * 60,
      shopId: employee.shopId
    });
  }

  // Determine alternating type
  const lastPunch = record.punches[record.punches.length - 1];
  const type = !lastPunch || lastPunch.type === 'OUT' ? 'IN' : 'OUT';

  record.punches.push({ time: punchTime, source, type, remark });

  recomputeAttendance(record, employee);
  await record.save();
  return record;
}

// ─── Recompute derived fields ──────────────────────────────────────────────────

function recomputeAttendance(record, employee) {
  const punches = [...record.punches].sort((a, b) => new Date(a.time) - new Date(b.time));
  if (punches.length === 0) return;

  record.firstPunchTime = punches[0].time;
  record.lastPunchTime  = punches[punches.length - 1].time;

  // ── Late entry ────────────────────────────────────────────────────────────
  const gracePeriodMs = (employee.latePolicy.gracePeriodMinutes || 15) * 60_000;
  const firstIn = new Date(punches[0].time);
  const scheduledStart = new Date(record.scheduledStartTime);

  if (firstIn > new Date(scheduledStart.getTime() + gracePeriodMs)) {
    record.lateMinutes = Math.floor((firstIn - scheduledStart) / 60_000);
    record.isLate = true;
  } else {
    record.lateMinutes = 0;
    record.isLate = false;
  }

  // ── Permission segments ────────────────────────────────────────────────────
  // Any OUT→IN pair where the OUT happens during the work window (not end-of-day)
  const shiftEnd = shiftBoundary(employee, record.date, employee.shift.endTime);
  const segments = [];
  let totalPermissionMinutes = 0;

  for (let i = 0; i < punches.length - 1; i++) {
    const curr = punches[i];
    const next = punches[i + 1];
    if (curr.type === 'OUT' && next.type === 'IN') {
      const outTime = new Date(curr.time);
      const inTime  = new Date(next.time);
      // Mid-shift only: OUT must happen before shift end
      if (outTime < shiftEnd) {
        const durationMinutes = Math.floor((inTime - outTime) / 60_000);
        segments.push({ outTime, inTime, durationMinutes });
        totalPermissionMinutes += durationMinutes;
      }
    }
  }

  record.permissionSegments    = segments;
  record.totalPermissionMinutes = totalPermissionMinutes;

  // ── Total work minutes ─────────────────────────────────────────────────────
  const lastPunch = punches[punches.length - 1];
  if (lastPunch.type === 'OUT') {
    const raw = Math.floor((new Date(lastPunch.time) - firstIn) / 60_000);
    record.totalWorkMinutes = Math.max(0, raw - totalPermissionMinutes);
  } else {
    record.totalWorkMinutes = 0; // still inside, finalize on next OUT
  }

  // ── Source ────────────────────────────────────────────────────────────────
  const sources = [...new Set(punches.map(p => p.source))];
  record.source = sources.length > 1 ? 'MIXED' : sources[0];

  // ── Status ────────────────────────────────────────────────────────────────
  const scheduled = record.scheduledWorkMinutes || (employee.shift.workingHours * 60);
  if (record.totalWorkMinutes > 0) {
    const ratio = record.totalWorkMinutes / scheduled;
    record.status = ratio >= 0.85 ? 'PRESENT' : ratio >= 0.45 ? 'HALF_DAY' : 'ABSENT';
  }
}

// ─── Monthly attendance query ──────────────────────────────────────────────────

async function getMonthlyAttendance(employeeId, month, year) {
  const employee = await Employee.findOne({ employeeId });
  if (!employee) throw new Error('Employee not found');

  return AttendancePunch.find({
    employee: employee._id,
    date: {
      $gte: new Date(Date.UTC(year, month - 1, 1)),
      $lte: new Date(Date.UTC(year, month, 0))
    }
  }).sort({ date: 1 });
}

// ─── Manual attendance override ────────────────────────────────────────────────

async function markManualAttendance(employeeId, date, status, leaveType, userId) {
  const employee = await Employee.findOne({ employeeId });
  if (!employee) throw new Error('Employee not found');

  const attendanceDate = getDateOnly(date);
  let record = await AttendancePunch.findOne({ employee: employee._id, date: attendanceDate });

  if (!record) {
    record = new AttendancePunch({
      employee: employee._id,
      employeeId,
      date: attendanceDate,
      shopId: employee.shopId
    });
  }

  record.status = status;
  if (leaveType) record.leaveType = leaveType;
  await record.save();
  return record;
}

// ─── ESSL bulk import ──────────────────────────────────────────────────────────

/**
 * Accepts array of ESSL raw punch records:
 *   [{ userId, punchTime, remark? }, ...]
 * userId is matched against employee.esslDeviceUserId or employee.employeeId.
 */
async function importEsslAttendance(esslRecords) {
  const results = { success: 0, failed: 0, errors: [] };

  for (const rec of esslRecords) {
    try {
      if (!rec.userId || !rec.punchTime) throw new Error('userId and punchTime are required');

      const employee = await Employee.findOne({
        $or: [
          { esslDeviceUserId: String(rec.userId) },
          { employeeId: String(rec.userId) }
        ],
        isActive: true
      });

      if (!employee) {
        results.failed++;
        results.errors.push(`ESSL userId "${rec.userId}" not mapped to any active employee`);
        continue;
      }

      await processPunch(employee.employeeId, new Date(rec.punchTime), 'ESSL', rec.remark || '');
      results.success++;
    } catch (err) {
      results.failed++;
      results.errors.push(`userId=${rec.userId}: ${err.message}`);
    }
  }

  return results;
}

module.exports = {
  processPunch,
  recomputeAttendance,
  getMonthlyAttendance,
  markManualAttendance,
  importEsslAttendance,
  getDateOnly,
  shiftBoundary
};

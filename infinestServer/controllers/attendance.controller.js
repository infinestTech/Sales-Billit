const AttendancePunch = require('../models/AttendancePunch.model');
const {
  processPunch,
  getMonthlyAttendance,
  markManualAttendance,
  importEsslAttendance
} = require('../services/attendance.service');

// POST /attendance/punch
// Body: { employeeId, punchTime?, source?, remark? }
exports.punch = async (req, res) => {
  try {
    const { employeeId, punchTime, source, remark } = req.body;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'employeeId is required' });
    }
    const time   = punchTime ? new Date(punchTime) : new Date();
    const record = await processPunch(employeeId, time, source || 'SOFTWARE', remark || '');
    const last   = record.punches[record.punches.length - 1];

    res.json({
      success: true,
      punchType:            last.type,
      punchTime:            last.time,
      isLate:               record.isLate,
      lateMinutes:          record.lateMinutes,
      totalPermissionMinutes: record.totalPermissionMinutes,
      status:               record.status,
      message: last.type === 'IN'
        ? (record.isLate ? `Marked IN — ${record.lateMinutes} min late` : 'Marked IN — On time')
        : 'Marked OUT'
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// GET /attendance/daily?date=YYYY-MM-DD&shopId=
exports.getAttendanceByDate = async (req, res) => {
  try {
    const { date, shopId } = req.query;
    if (!date) return res.status(400).json({ success: false, message: 'date is required' });

    const d = new Date(date);
    const filter = {
      date: {
        $gte: new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())),
        $lte: new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59))
      }
    };
    if (shopId) filter.shopId = shopId;

    const records = await AttendancePunch.find(filter)
      .populate('employee', 'name employeeId department designation shift')
      .sort({ employeeId: 1 });

    res.json({ success: true, count: records.length, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /attendance/:employeeId/monthly?month=M&year=YYYY
exports.getEmployeeAttendance = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'month and year are required' });
    }

    const records = await getMonthlyAttendance(employeeId, parseInt(month), parseInt(year));

    const summary = {
      present:               records.filter(r => r.status === 'PRESENT').length,
      absent:                records.filter(r => r.status === 'ABSENT').length,
      halfDay:               records.filter(r => r.status === 'HALF_DAY').length,
      leave:                 records.filter(r => r.status === 'LEAVE').length,
      lateDays:              records.filter(r => r.isLate).length,
      totalLateMinutes:      records.reduce((s, r) => s + (r.lateMinutes || 0), 0),
      totalPermissionMinutes: records.reduce((s, r) => s + (r.totalPermissionMinutes || 0), 0)
    };

    res.json({ success: true, summary, count: records.length, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /attendance/manual
// Body: { employeeId, date, status, leaveType? }
exports.markManual = async (req, res) => {
  try {
    const { employeeId, date, status, leaveType } = req.body;
    if (!employeeId || !date || !status) {
      return res.status(400).json({ success: false, message: 'employeeId, date, status are required' });
    }
    const record = await markManualAttendance(employeeId, date, status, leaveType, req.user?._id);
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// POST /attendance/essl/import
// Body: { records: [{ userId, punchTime, remark? }] }
exports.importEssl = async (req, res) => {
  try {
    const { records } = req.body;
    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ success: false, message: 'records array is required' });
    }
    const result = await importEsslAttendance(records);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /attendance/report?shopId=&month=M&year=YYYY
exports.getAttendanceReport = async (req, res) => {
  try {
    const { shopId, month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'month and year are required' });
    }

    const filter = {
      date: {
        $gte: new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1)),
        $lte: new Date(Date.UTC(parseInt(year), parseInt(month), 0))
      }
    };
    if (shopId) filter.shopId = shopId;

    const records = await AttendancePunch.find(filter)
      .populate('employee', 'name employeeId department designation')
      .sort({ employeeId: 1, date: 1 });

    // Group by employee
    const grouped = {};
    for (const rec of records) {
      const key = rec.employeeId;
      if (!grouped[key]) {
        grouped[key] = {
          employee: rec.employee,
          employeeId: rec.employeeId,
          present: 0, absent: 0, halfDay: 0, leave: 0,
          lateDays: 0, totalLateMinutes: 0, totalPermissionMinutes: 0,
          days: []
        };
      }
      const g = grouped[key];
      g.days.push(rec);
      if (rec.status === 'PRESENT')   g.present++;
      else if (rec.status === 'ABSENT')    g.absent++;
      else if (rec.status === 'HALF_DAY')  g.halfDay++;
      else if (rec.status === 'LEAVE')     g.leave++;
      if (rec.isLate) { g.lateDays++; g.totalLateMinutes += rec.lateMinutes || 0; }
      g.totalPermissionMinutes += rec.totalPermissionMinutes || 0;
    }

    res.json({ success: true, count: Object.keys(grouped).length, data: Object.values(grouped) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

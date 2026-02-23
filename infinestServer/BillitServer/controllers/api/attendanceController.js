const { Attendance, Employee } = require('../../models/mongoModels');
const { formatIST } = require('../../utils/dateHelper');

// Helper to get today string in YYYY-MM-DD format (IST)
function todayString() {
  return formatIST(new Date(), 'YYYY-MM-DD');
}

// List employees with today's attendance status
async function listTodayAttendance(req, res) {
  try {
    const { shopId } = req.params;
    const date = req.query.date || todayString();

    if (!shopId) return res.status(400).json({ success: false, message: 'shopId param required.' });
    if (req.user?.shop_id && req.user.shop_id !== shopId) {
      return res.status(403).json({ success: false, message: 'Token shop mismatch.' });
    }

    const employees = await Employee.find({ shop_id: shopId }).lean();
    const employeeIds = employees.map(e => e._id);
    const attendanceRecords = await Attendance.find({ employee_id: { $in: employeeIds }, date }).lean();
    // fetch permissions for the date and aggregate
    const { Permission } = require('../../models/mongoModels');
    const permissionRecords = await Permission.find({ employee_id: { $in: employeeIds }, date }).lean();

    const attendanceMap = {};
    attendanceRecords.forEach(r => { attendanceMap[r.employee_id.toString()] = r; });

    // build permission map per employee: total seconds and whether active
    const permissionMap = {};
    permissionRecords.forEach(p => {
      const key = p.employee_id.toString();
      if (!permissionMap[key]) permissionMap[key] = { totalSeconds: 0, active: false, activeStartedAt: null };
      if (p.duration_seconds && p.duration_seconds > 0) permissionMap[key].totalSeconds += p.duration_seconds;
      if (!p.end_time) {
        permissionMap[key].active = true;
        permissionMap[key].activeStartedAt = p.start_time;
      }
    });

    const merged = employees.map(e => {
      const rec = attendanceMap[e._id.toString()];
      const perm = permissionMap[e._id.toString()] || { totalSeconds: 0, active: false, activeStartedAt: null };
      return {
        ...e,
        attendance: rec ? { status: rec.status, locked: rec.locked, created_at: rec.created_at } : null,
        permissionSummary: {
          totalSeconds: perm.totalSeconds,
          active: perm.active,
          activeStartedAt: perm.activeStartedAt
        }
      };
    });

    return res.json({ success: true, data: merged, date });
  } catch (err) {
    console.error('[listTodayAttendance] Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// Mark attendance once; if already exists and locked, prevent change
async function markAttendance(req, res) {
  try {
    const { shop_id, employee_id, status, date } = req.body;
    if (!shop_id || !employee_id || !status) {
      return res.status(400).json({ success: false, message: 'shop_id, employee_id and status required.' });
    }
    if (!['present', 'absent'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }
    if (req.user?.shop_id && req.user.shop_id !== shop_id) {
      return res.status(403).json({ success: false, message: 'Token shop mismatch.' });
    }

    const requestedDate = date || todayString();
    const today = todayString();
    if (requestedDate !== today) {
      return res.status(400).json({ success: false, message: "Can only mark attendance for today's date." });
    }
    let existing = await Attendance.findOne({ employee_id, date: requestedDate });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Attendance already marked for today.', data: existing });
    }

    const record = await Attendance.create({ shop_id, employee_id, status, date: requestedDate, locked: true });
    return res.json({ success: true, data: record });
  } catch (err) {
    console.error('[markAttendance] Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

module.exports = { listTodayAttendance, markAttendance };

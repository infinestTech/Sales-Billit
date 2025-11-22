const { Attendance, Employee } = require('../../models/mongoModels');

// Helper to get today string in YYYY-MM-DD format
function todayString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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

    const attendanceMap = {};
    attendanceRecords.forEach(r => { attendanceMap[r.employee_id.toString()] = r; });

    const merged = employees.map(e => {
      const rec = attendanceMap[e._id.toString()];
      return {
        ...e,
        attendance: rec ? { status: rec.status, locked: rec.locked } : null
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
    const { shop_id, employee_id, status } = req.body;
    if (!shop_id || !employee_id || !status) {
      return res.status(400).json({ success: false, message: 'shop_id, employee_id and status required.' });
    }
    if (!['present', 'absent'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }
    if (req.user?.shop_id && req.user.shop_id !== shop_id) {
      return res.status(403).json({ success: false, message: 'Token shop mismatch.' });
    }

    const date = todayString();
    let existing = await Attendance.findOne({ employee_id, date });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Attendance already marked for today.', data: existing });
    }

    const record = await Attendance.create({ shop_id, employee_id, status, date, locked: true });
    return res.json({ success: true, data: record });
  } catch (err) {
    console.error('[markAttendance] Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

module.exports = { listTodayAttendance, markAttendance };

const { Permission } = require('../../models/mongoModels');

function todayString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Start permission: create a new Permission with start_time
async function startPermission(req, res) {
  try {
    const { shop_id, employee_id, date } = req.body;
    if (!shop_id || !employee_id) return res.status(400).json({ success: false, message: 'shop_id and employee_id required.' });
    const d = date || todayString();
    const today = todayString();
    if (d !== today) {
      return res.status(400).json({ success: false, message: "Can only start permission for today's date." });
    }

    // Check for existing open permission for this employee and date
    const open = await Permission.findOne({ employee_id, date: d, end_time: { $exists: false } });
    if (open) return res.status(409).json({ success: false, message: 'Permission already started.' });

    const record = await Permission.create({ shop_id, employee_id, date: d, start_time: new Date() });
    return res.json({ success: true, data: record });
  } catch (err) {
    console.error('[startPermission] Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// End permission: set end_time on latest open permission and compute duration
async function endPermission(req, res) {
  try {
    const { shop_id, employee_id, date } = req.body;
    if (!shop_id || !employee_id) return res.status(400).json({ success: false, message: 'shop_id and employee_id required.' });
    const d = date || todayString();
    const today = todayString();
    if (d !== today) {
      return res.status(400).json({ success: false, message: "Can only end permission for today's date." });
    }

    const open = await Permission.findOne({ employee_id, date: d, end_time: { $exists: false } });
    if (!open) return res.status(404).json({ success: false, message: 'No active permission session found.' });

    open.end_time = new Date();
    open.duration_seconds = Math.max(0, Math.round((open.end_time - open.start_time) / 1000));
    await open.save();

    return res.json({ success: true, data: open });
  } catch (err) {
    console.error('[endPermission] Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

module.exports = { startPermission, endPermission };
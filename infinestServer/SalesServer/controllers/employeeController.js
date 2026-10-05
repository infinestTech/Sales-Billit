const mongoose = require('mongoose');
const EmployeeRef = require('../models/employeeRef');
const Shop = require('../models/shop');

const normalizeCode = (raw) => String(raw || '').trim().toUpperCase().replace(/\s+/g, '');

// employees.shop_id is an ObjectId (BillitServer); Sales tokens carry it as a string
const shopMatch = (shop_id) => {
  const ids = [String(shop_id)];
  if (mongoose.Types.ObjectId.isValid(String(shop_id))) ids.push(new mongoose.Types.ObjectId(String(shop_id)));
  return { $in: ids };
};

const toPublic = (e) => ({
  id: String(e._id),
  code: e.employee_code || '',
  name: e.name || e.employee_name || '',
  designation: e.designation || '',
  businessUnit: e.business_unit === 'sales' ? 'sales' : 'service',
});

/** Active employee of the shop with this code, or null. */
async function resolveEmployeeByCode(shop_id, rawCode) {
  const code = normalizeCode(rawCode);
  if (!code || !shop_id) return null;
  const emp = await EmployeeRef.findOne({
    shop_id: shopMatch(shop_id),
    employee_code: code,
    is_active: { $ne: false }
  }).lean();
  return emp ? toPublic(emp) : null;
}

async function isEmployeeCodeRequired(shop_id) {
  if (!mongoose.Types.ObjectId.isValid(String(shop_id))) return false;
  const shop = await Shop.findById(String(shop_id)).select('sales_settings').lean();
  return !!shop?.sales_settings?.require_employee_code;
}

// GET /api/employees/lookup?code=EMP001
exports.lookupEmployee = async (req, res) => {
  try {
    const code = normalizeCode(req.query.code);
    if (!code) return res.status(400).json({ success: false, message: 'code is required' });
    const employee = await resolveEmployeeByCode(req.user.shop_id, code);
    if (!employee) return res.status(404).json({ success: false, message: `No active employee with code ${code}` });
    return res.json({ success: true, employee });
  } catch (err) {
    console.error('lookupEmployee error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/employees — active employees (code + name only) for report filters
exports.listEmployees = async (req, res) => {
  try {
    const rows = await EmployeeRef.find({
      shop_id: shopMatch(req.user.shop_id),
      is_active: { $ne: false },
      employee_code: { $type: 'string', $ne: '' }
    }).select('employee_code name employee_name designation business_unit').sort({ employee_code: 1 }).lean();
    return res.json({ success: true, employees: rows.map(toPublic) });
  } catch (err) {
    console.error('listEmployees error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/employees/pos-config — POS rules configured by the shop admin
exports.posConfig = async (req, res) => {
  try {
    return res.json({ success: true, requireEmployeeCode: await isEmployeeCodeRequired(req.user.shop_id) });
  } catch (err) {
    console.error('posConfig error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.normalizeCode = normalizeCode;
exports.resolveEmployeeByCode = resolveEmployeeByCode;
exports.isEmployeeCodeRequired = isEmployeeCodeRequired;

const SalaryRecord = require('../models/SalaryRecord.model');
const Employee     = require('../models/Employee.model');
const { calculateMonthlySalary, generateBulkSalary } = require('../services/salary.service');

// POST /salary/generate
// Body: { employeeId, month, year }
exports.generateSalary = async (req, res) => {
  try {
    const { employeeId, month, year } = req.body;
    if (!employeeId || !month || !year) {
      return res.status(400).json({ success: false, message: 'employeeId, month, year are required' });
    }
    const record = await calculateMonthlySalary(
      employeeId, parseInt(month), parseInt(year), req.user?._id
    );
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// POST /salary/generate-bulk
// Body: { shopId, month, year }
exports.generateBulkSalary = async (req, res) => {
  try {
    const { shopId, month, year } = req.body;
    if (!shopId || !month || !year) {
      return res.status(400).json({ success: false, message: 'shopId, month, year are required' });
    }
    const result = await generateBulkSalary(
      shopId, parseInt(month), parseInt(year), req.user?._id
    );
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /salary/:employeeId?month=M&year=YYYY
exports.getSalaryRecord = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'month and year are required' });
    }

    const emp = await Employee.findOne({ employeeId });
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });

    const record = await SalaryRecord.findOne({
      employee: emp._id,
      month: parseInt(month),
      year:  parseInt(year)
    }).populate('employee', 'name employeeId department designation grossSalary shift');

    if (!record) {
      return res.status(404).json({ success: false, message: 'Salary record not found. Run generate first.' });
    }
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /salary/report?shopId=&month=M&year=YYYY
exports.getSalaryReport = async (req, res) => {
  try {
    const { shopId, month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'month and year are required' });
    }

    const filter = { month: parseInt(month), year: parseInt(year) };
    if (shopId) filter.shopId = shopId;

    const records = await SalaryRecord.find(filter)
      .populate('employee', 'name employeeId department designation')
      .sort({ employeeId: 1 });

    const summary = {
      totalEmployees:          records.length,
      totalGross:              records.reduce((s, r) => s + r.grossSalary, 0),
      totalDeductions:         records.reduce((s, r) => s + r.totalDeductions, 0),
      totalAbsenceDeduction:   records.reduce((s, r) => s + r.absenceDeduction, 0),
      totalPermissionDeduction: records.reduce((s, r) => s + r.permissionDeduction, 0),
      totalLateDeduction:      records.reduce((s, r) => s + r.lateDeduction, 0),
      totalNetSalary:          records.reduce((s, r) => s + r.netSalary, 0)
    };

    res.json({ success: true, summary, count: records.length, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /salary/:employeeId/finalize
// Body: { month, year }
exports.finalizeSalary = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month, year } = req.body;

    const emp = await Employee.findOne({ employeeId });
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });

    const record = await SalaryRecord.findOneAndUpdate(
      { employee: emp._id, month: parseInt(month), year: parseInt(year) },
      { status: 'FINALIZED' },
      { new: true }
    );
    if (!record) return res.status(404).json({ success: false, message: 'Salary record not found' });
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /salary/:employeeId/mark-paid
// Body: { month, year, paidDate? }
exports.markSalaryPaid = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month, year, paidDate } = req.body;

    const emp = await Employee.findOne({ employeeId });
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });

    const record = await SalaryRecord.findOneAndUpdate(
      { employee: emp._id, month: parseInt(month), year: parseInt(year) },
      { status: 'PAID', paidDate: paidDate ? new Date(paidDate) : new Date() },
      { new: true }
    );
    if (!record) return res.status(404).json({ success: false, message: 'Salary record not found' });
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

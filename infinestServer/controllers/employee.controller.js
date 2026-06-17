const Employee = require('../models/Employee.model');

exports.createEmployee = async (req, res) => {
  try {
    const employee = new Employee(req.body);
    await employee.save();
    res.status(201).json({ success: true, data: employee });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Employee ID already exists' });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getAllEmployees = async (req, res) => {
  try {
    const { shopId, isActive, department } = req.query;
    const filter = {};
    if (shopId)              filter.shopId = shopId;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (department)          filter.department = department;

    const employees = await Employee.find(filter).sort({ name: 1 });
    res.json({ success: true, count: employees.length, data: employees });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getEmployee = async (req, res) => {
  try {
    const employee = await Employee.findOne({ employeeId: req.params.employeeId });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    res.json({ success: true, data: employee });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    // Prevent accidental ID change
    delete req.body.employeeId;
    const employee = await Employee.findOneAndUpdate(
      { employeeId: req.params.employeeId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    res.json({ success: true, data: employee });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.deactivateEmployee = async (req, res) => {
  try {
    const employee = await Employee.findOneAndUpdate(
      { employeeId: req.params.employeeId },
      { isActive: false },
      { new: true }
    );
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    res.json({ success: true, message: 'Employee deactivated', data: employee });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.reactivateEmployee = async (req, res) => {
  try {
    const employee = await Employee.findOneAndUpdate(
      { employeeId: req.params.employeeId },
      { isActive: true },
      { new: true }
    );
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    res.json({ success: true, message: 'Employee reactivated', data: employee });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

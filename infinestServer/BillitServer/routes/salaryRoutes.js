const express = require('express');
const router = express.Router();
const { SalaryConfig, SalaryRecord, Employee, Attendance, Permission } = require('../models/mongoModels');

// ==============================
// 💰 SALARY CONFIGURATION ROUTES
// ==============================

// Get salary configuration for a shop
router.get('/config', async (req, res) => {
  try {
    const { shop_id } = req.query;

    if (!shop_id) {
      return res.status(400).json({ success: false, message: 'shop_id is required' });
    }

    let config = await SalaryConfig.findOne({ shop_id });

    // Create default config if doesn't exist
    if (!config) {
      config = await SalaryConfig.create({
        shop_id,
        permission_deduction_percentage: 10,
        salary_calculation_method: 'daily_rate',
        hours_per_day: 8
      });
    }

    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update salary configuration
router.put('/config', async (req, res) => {
  try {
    const { shop_id, permission_deduction_percentage, salary_calculation_method, hours_per_day } = req.body;

    if (!shop_id) {
      return res.status(400).json({ success: false, message: 'shop_id is required' });
    }

    const config = await SalaryConfig.findOneAndUpdate(
      { shop_id },
      {
        permission_deduction_percentage,
        salary_calculation_method,
        hours_per_day,
        updated_at: new Date()
      },
      { new: true, upsert: true }
    );

    res.json({ success: true, config, message: 'Salary configuration updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==============================
// 👤 EMPLOYEE DAILY WAGE ROUTES
// ==============================

// Update employee daily wage
router.put('/employee/:employeeId/daily-salary', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { daily_salary } = req.body;

    if (daily_salary === undefined || daily_salary < 0) {
      return res.status(400).json({ success: false, message: 'Valid daily wage is required' });
    }

    const employee = await Employee.findByIdAndUpdate(
      employeeId,
      { daily_salary },
      { new: true }
    );

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    res.json({ success: true, employee, message: 'Daily wage updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==============================
// 💵 DAILY WAGE CALCULATION & RECORDS
// ==============================

// Calculate payment for an employee for a specific period (month)
// Note: This is a DAILY WAGE system - payment = days worked × daily wage rate
router.post('/calculate', async (req, res) => {
  try {
    const { shop_id, employee_id, month } = req.body; // month format: YYYY-MM

    if (!shop_id || !employee_id || !month) {
      return res.status(400).json({ 
        success: false, 
        message: 'shop_id, employee_id, and month (YYYY-MM) are required' 
      });
    }

    // Validate month format
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(month)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid month format. Use YYYY-MM' 
      });
    }

    const [year, monthNum] = month.split('-').map(Number);
    
    // Get employee details
    const employee = await Employee.findById(employee_id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    if (employee.daily_salary === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please set daily wage for this employee first' 
      });
    }

    // Get salary config
    const config = await SalaryConfig.findOne({ shop_id });
    const permissionDeductionPercentage = config?.permission_deduction_percentage || 10;
    const hoursPerDay = config?.hours_per_day || 8;

    // Get total days in month
    const totalDaysInMonth = new Date(year, monthNum, 0).getDate();

    // Get attendance records for the month
    const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(totalDaysInMonth).padStart(2, '0')}`;

    const attendanceRecords = await Attendance.find({
      employee_id,
      date: { $gte: startDate, $lte: endDate }
    });

    const presentDays = attendanceRecords.filter(a => a.status === 'present').length;
    const absentDays = attendanceRecords.filter(a => a.status === 'absent').length;

    // Get permission records for the month
    const permissionRecords = await Permission.find({
      employee_id,
      date: { $gte: startDate, $lte: endDate }
    });

    // Calculate total permission hours
    let totalPermissionSeconds = 0;
    permissionRecords.forEach(perm => {
      if (perm.end_time) {
        const duration = (new Date(perm.end_time) - new Date(perm.start_time)) / 1000;
        totalPermissionSeconds += duration;
      } else if (perm.duration_seconds) {
        totalPermissionSeconds += perm.duration_seconds;
      }
    });

    const totalPermissionHours = totalPermissionSeconds / 3600;

    // ========================================
    // DAILY WAGE CALCULATION
    // ========================================
    // Base Payment = Days Worked × Daily Wage Rate
    const baseSalary = presentDays * employee.daily_salary;
    
    // Calculate hourly rate from daily wage
    // Hourly Rate = Daily Wage ÷ Hours Per Day
    const hourlyRate = employee.daily_salary / hoursPerDay;
    
    // Calculate deduction for permission hours
    // Permission Deduction = Permission Hours × Hourly Rate × (Deduction % ÷ 100)
    const permissionDeductionAmount = totalPermissionHours * hourlyRate * (permissionDeductionPercentage / 100);
    
    const totalDeductions = permissionDeductionAmount;
    const netSalary = Math.max(0, baseSalary - totalDeductions);

    // Create or update salary record
    const salaryRecord = await SalaryRecord.findOneAndUpdate(
      { employee_id, month },
      {
        shop_id,
        year,
        month_number: monthNum,
        total_days_in_month: totalDaysInMonth,
        present_days: presentDays,
        absent_days: absentDays,
        total_permission_hours: parseFloat(totalPermissionHours.toFixed(2)),
        permission_deduction_amount: parseFloat(permissionDeductionAmount.toFixed(2)),
        daily_salary_rate: employee.daily_salary,
        base_salary: parseFloat(baseSalary.toFixed(2)),
        total_deductions: parseFloat(totalDeductions.toFixed(2)),
        net_salary: parseFloat(netSalary.toFixed(2)),
        calculated_at: new Date(),
        updated_at: new Date()
      },
      { new: true, upsert: true }
    );

    // Populate employee details
    await salaryRecord.populate('employee_id', 'employee_name mobile_number');

    res.json({ 
      success: true, 
      salaryRecord,
      calculation: {
        presentDays,
        absentDays,
        dailySalary: employee.daily_salary,
        baseSalary: parseFloat(baseSalary.toFixed(2)),
        permissionHours: parseFloat(totalPermissionHours.toFixed(2)),
        permissionDeduction: parseFloat(permissionDeductionAmount.toFixed(2)),
        netSalary: parseFloat(netSalary.toFixed(2))
      },
      message: 'Salary calculated successfully' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Get salary records for a shop (with filters)
router.get('/records', async (req, res) => {
  try {
    const { shop_id, month, employee_id, payment_status } = req.query;

    if (!shop_id) {
      return res.status(400).json({ success: false, message: 'shop_id is required' });
    }

    const query = { shop_id };
    
    if (month) query.month = month;
    if (employee_id) query.employee_id = employee_id;
    if (payment_status) query.payment_status = payment_status;

    const records = await SalaryRecord.find(query)
      .populate('employee_id', 'employee_name mobile_number daily_salary')
      .sort({ month: -1, 'employee_id.employee_name': 1 });

    res.json({ success: true, records });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get salary record for specific employee and month
router.get('/record', async (req, res) => {
  try {
    const { employee_id, month } = req.query;

    if (!employee_id || !month) {
      return res.status(400).json({ 
        success: false, 
        message: 'employee_id and month are required' 
      });
    }

    const record = await SalaryRecord.findOne({ employee_id, month })
      .populate('employee_id', 'employee_name mobile_number daily_salary address blood_group');

    res.json({ success: true, record });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update payment status for a salary record
router.put('/record/:recordId/payment', async (req, res) => {
  try {
    const { recordId } = req.params;
    const { paid_amount, payment_status, payment_method, payment_notes } = req.body;

    const updateData = {
      updated_at: new Date()
    };

    if (paid_amount !== undefined) updateData.paid_amount = paid_amount;
    if (payment_status) updateData.payment_status = payment_status;
    if (payment_method) updateData.payment_method = payment_method;
    if (payment_notes !== undefined) updateData.payment_notes = payment_notes;
    
    if (payment_status === 'paid') {
      updateData.payment_date = new Date();
      updateData.locked = true;
    }

    const record = await SalaryRecord.findByIdAndUpdate(
      recordId,
      updateData,
      { new: true }
    ).populate('employee_id', 'employee_name mobile_number');

    if (!record) {
      return res.status(404).json({ success: false, message: 'Salary record not found' });
    }

    res.json({ success: true, record, message: 'Payment status updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Calculate salary for all employees in a shop for a specific month
router.post('/calculate-all', async (req, res) => {
  try {
    const { shop_id, month } = req.body;

    if (!shop_id || !month) {
      return res.status(400).json({ 
        success: false, 
        message: 'shop_id and month (YYYY-MM) are required' 
      });
    }

    // Get all employees for the shop
    const employees = await Employee.find({ shop_id });

    const results = [];
    const errors = [];

    for (const employee of employees) {
      try {
        // Skip if daily salary not set
        if (employee.daily_salary === 0) {
          errors.push({
            employee_id: employee._id,
            employee_name: employee.employee_name,
            error: 'Daily salary not set'
          });
          continue;
        }

        // Calculate salary (reuse the logic from /calculate)
        const [year, monthNum] = month.split('-').map(Number);
        const config = await SalaryConfig.findOne({ shop_id });
        const permissionDeductionPercentage = config?.permission_deduction_percentage || 10;
        
        const totalDaysInMonth = new Date(year, monthNum, 0).getDate();
        const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(totalDaysInMonth).padStart(2, '0')}`;

        const attendanceRecords = await Attendance.find({
          employee_id: employee._id,
          date: { $gte: startDate, $lte: endDate }
        });

        const presentDays = attendanceRecords.filter(a => a.status === 'present').length;
        const absentDays = attendanceRecords.filter(a => a.status === 'absent').length;

        const permissionRecords = await Permission.find({
          employee_id: employee._id,
          date: { $gte: startDate, $lte: endDate }
        });

        let totalPermissionSeconds = 0;
        permissionRecords.forEach(perm => {
          if (perm.end_time) {
            const duration = (new Date(perm.end_time) - new Date(perm.start_time)) / 1000;
            totalPermissionSeconds += duration;
          } else if (perm.duration_seconds) {
            totalPermissionSeconds += perm.duration_seconds;
          }
        });

        const totalPermissionHours = totalPermissionSeconds / 3600;
        const baseSalary = presentDays * employee.daily_salary;
        const hourlyRate = employee.daily_salary / 8;
        const permissionDeductionAmount = totalPermissionHours * hourlyRate * (permissionDeductionPercentage / 100);
        const totalDeductions = permissionDeductionAmount;
        const netSalary = Math.max(0, baseSalary - totalDeductions);

        const salaryRecord = await SalaryRecord.findOneAndUpdate(
          { employee_id: employee._id, month },
          {
            shop_id,
            year,
            month_number: monthNum,
            total_days_in_month: totalDaysInMonth,
            present_days: presentDays,
            absent_days: absentDays,
            total_permission_hours: parseFloat(totalPermissionHours.toFixed(2)),
            permission_deduction_amount: parseFloat(permissionDeductionAmount.toFixed(2)),
            daily_salary_rate: employee.daily_salary,
            base_salary: parseFloat(baseSalary.toFixed(2)),
            total_deductions: parseFloat(totalDeductions.toFixed(2)),
            net_salary: parseFloat(netSalary.toFixed(2)),
            calculated_at: new Date(),
            updated_at: new Date()
          },
          { new: true, upsert: true }
        );

        results.push({
          employee_id: employee._id,
          employee_name: employee.employee_name,
          net_salary: netSalary
        });
      } catch (err) {
        errors.push({
          employee_id: employee._id,
          employee_name: employee.employee_name,
          error: err.message
        });
      }
    }

    res.json({ 
      success: true, 
      message: `Calculated salaries for ${results.length} employees`,
      results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Get salary summary for dashboard
router.get('/summary', async (req, res) => {
  try {
    const { shop_id, month } = req.query;

    if (!shop_id) {
      return res.status(400).json({ success: false, message: 'shop_id is required' });
    }

    const query = { shop_id };
    if (month) query.month = month;

    const records = await SalaryRecord.find(query);

    const summary = {
      total_employees: records.length,
      total_base_salary: records.reduce((sum, r) => sum + r.base_salary, 0),
      total_deductions: records.reduce((sum, r) => sum + r.total_deductions, 0),
      total_net_salary: records.reduce((sum, r) => sum + r.net_salary, 0),
      total_paid: records.reduce((sum, r) => sum + r.paid_amount, 0),
      pending_payment: records.reduce((sum, r) => sum + (r.net_salary - r.paid_amount), 0),
      by_status: {
        unpaid: records.filter(r => r.payment_status === 'unpaid').length,
        partial: records.filter(r => r.payment_status === 'partial').length,
        paid: records.filter(r => r.payment_status === 'paid').length
      }
    };

    res.json({ success: true, summary });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

const mongoose = require('mongoose');

const EarningLineSchema = new mongoose.Schema({
  name: { type: String },
  amount: { type: Number, default: 0 }
}, { _id: false });

const DeductionLineSchema = new mongoose.Schema({
  name: { type: String },
  amount: { type: Number, default: 0 },
  reason: { type: String }
}, { _id: false });

const SalaryRecordSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  employeeId: { type: String, required: true },

  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },

  // Attendance summary for the month
  totalWorkingDays: { type: Number, default: 0 },
  presentDays: { type: Number, default: 0 },
  absentDays: { type: Number, default: 0 },
  halfDays: { type: Number, default: 0 },
  leaveDays: { type: Number, default: 0 },
  paidLeaveDays: { type: Number, default: 0 },
  lateDays: { type: Number, default: 0 },
  totalLateMinutes: { type: Number, default: 0 },
  totalPermissionMinutes: { type: Number, default: 0 },

  // Earnings
  grossSalary: { type: Number, default: 0 },
  earnings: { type: [EarningLineSchema], default: [] },
  totalEarnings: { type: Number, default: 0 },

  // Deductions
  deductions: { type: [DeductionLineSchema], default: [] },
  totalDeductions: { type: Number, default: 0 },
  absenceDeduction: { type: Number, default: 0 },
  permissionDeduction: { type: Number, default: 0 },
  lateDeduction: { type: Number, default: 0 },

  // Net Pay
  netSalary: { type: Number, default: 0 },

  status: { type: String, enum: ['DRAFT', 'FINALIZED', 'PAID'], default: 'DRAFT' },
  paidDate: { type: Date },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  remarks: { type: String, trim: true },

  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' }
}, { timestamps: true });

SalaryRecordSchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });
SalaryRecordSchema.index({ shopId: 1, month: 1, year: 1 });

module.exports = mongoose.model('SalaryRecord', SalaryRecordSchema);

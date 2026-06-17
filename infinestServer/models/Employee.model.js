const mongoose = require('mongoose');

const PayComponentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['EARNING', 'DEDUCTION'], required: true },
  calculationType: { type: String, enum: ['FIXED', 'PERCENTAGE'], default: 'FIXED' },
  value: { type: Number, required: true }, // fixed amount or % of gross
  isActive: { type: Boolean, default: true }
}, { _id: false });

const ShiftSchema = new mongoose.Schema({
  name: { type: String, default: 'General' },
  startTime: { type: String, required: true },  // "09:00" (HH:mm 24h)
  endTime: { type: String, required: true },    // "18:00"
  workingHours: { type: Number, required: true }, // e.g. 8
  gracePeriodMinutes: { type: Number, default: 15 }
}, { _id: false });

const PermissionPolicySchema = new mongoose.Schema({
  maxHoursPerMonth: { type: Number, default: 2 },
  deductionType: { type: String, enum: ['PER_HOUR', 'PROPORTIONAL', 'NONE'], default: 'PROPORTIONAL' },
  deductionAmountPerHour: { type: Number, default: 0 } // 0 = auto from daily salary
}, { _id: false });

const LatePolicySchema = new mongoose.Schema({
  gracePeriodMinutes: { type: Number, default: 15 },
  deductionType: { type: String, enum: ['NONE', 'FIXED_PER_LATE', 'HALF_DAY_AFTER_N', 'PROPORTIONAL'], default: 'PROPORTIONAL' },
  deductionAmountPerLate: { type: Number, default: 0 },
  halfDayAfterNLates: { type: Number, default: 3 } // convert to half-day after N lates in a month
}, { _id: false });

const EmployeeSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true, trim: true },
  esslDeviceUserId: { type: String, trim: true }, // mapped ID on ESSL biometric device

  // Personal Info
  name: { type: String, required: true, trim: true },
  phone: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  address: { type: String, trim: true },
  joiningDate: { type: Date, required: true },
  department: { type: String, trim: true },
  designation: { type: String, trim: true },

  // Pay Details
  grossSalary: { type: Number, required: true, min: 0 },
  payComponents: { type: [PayComponentSchema], default: [] },

  // Shift / Working Hours
  shift: { type: ShiftSchema, required: true },
  workingDaysPerWeek: { type: Number, default: 6 },
  weeklyOff: { type: [{ type: String, enum: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] }], default: ['SUN'] },

  // Permission Policy
  permissionPolicy: { type: PermissionPolicySchema, default: () => ({}) },

  // Late Entry Policy
  latePolicy: { type: LatePolicySchema, default: () => ({}) },

  // Leave
  paidLeavesPerYear: { type: Number, default: 12 },

  isActive: { type: Boolean, default: true },
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' }
}, { timestamps: true });

EmployeeSchema.index({ employeeId: 1 });
EmployeeSchema.index({ esslDeviceUserId: 1 });
EmployeeSchema.index({ shopId: 1, isActive: 1 });

module.exports = mongoose.model('Employee', EmployeeSchema);

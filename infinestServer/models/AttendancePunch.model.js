const mongoose = require('mongoose');

/**
 * Each document = one employee's attendance for one calendar day.
 * Punches array holds every IN/OUT event for that day.
 *
 * Punch flow (alternating IN / OUT):
 *   1st punch  → IN  (arrival / report time)
 *   2nd punch  → OUT (leaving during shift = permission hours start)
 *   3rd punch  → IN  (return = permission hours stop)
 *   … repeatable mid-day …
 *   last punch → OUT (end of day)
 *
 * Late entry = firstPunch.time > scheduledStartTime + gracePeriod
 * Permission hours = sum of all OUT-IN pairs that fall within shift window
 */

const PunchEntrySchema = new mongoose.Schema({
  time: { type: Date, required: true },
  source: { type: String, enum: ['ESSL', 'SOFTWARE'], required: true },
  type: { type: String, enum: ['IN', 'OUT'], required: true },
  remark: { type: String, trim: true, default: '' }
}, { _id: true });

const PermissionSegmentSchema = new mongoose.Schema({
  outTime: { type: Date },
  inTime: { type: Date },
  durationMinutes: { type: Number, default: 0 }
}, { _id: false });

const AttendancePunchSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  employeeId: { type: String, required: true }, // denormalized for query speed
  date: { type: Date, required: true },          // UTC midnight (date-only key)

  punches: { type: [PunchEntrySchema], default: [] },

  // First and last punch cached
  firstPunchTime: { type: Date },
  lastPunchTime: { type: Date },

  // Late entry
  scheduledStartTime: { type: Date },   // employee shift start on this date
  lateMinutes: { type: Number, default: 0 },
  isLate: { type: Boolean, default: false },

  // Permission hours (mid-shift exits)
  permissionSegments: { type: [PermissionSegmentSchema], default: [] },
  totalPermissionMinutes: { type: Number, default: 0 },

  // Work time
  totalWorkMinutes: { type: Number, default: 0 },
  scheduledWorkMinutes: { type: Number, default: 0 },

  // Day status
  status: {
    type: String,
    enum: ['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'HOLIDAY', 'WEEKLY_OFF'],
    default: 'PRESENT'
  },
  leaveType: { type: String, trim: true },

  // Source of punches
  source: { type: String, enum: ['ESSL', 'SOFTWARE', 'MIXED'], default: 'SOFTWARE' },

  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' }
}, { timestamps: true });

AttendancePunchSchema.index({ employee: 1, date: 1 }, { unique: true });
AttendancePunchSchema.index({ employeeId: 1, date: 1 });
AttendancePunchSchema.index({ shopId: 1, date: 1 });

module.exports = mongoose.model('AttendancePunch', AttendancePunchSchema);

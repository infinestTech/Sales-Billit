const mongoose = require("mongoose");
const { PAYMENT_METHOD_ENUM } = require("../constants/paymentMethods");

// ==============================
// 📦 Role Schema (Tracks Roles)
// ==============================
const roleSchema = new mongoose.Schema({
  mysql_user_id: { type: String, required: true, unique: true },
  role: { type: String, enum: ["manager", "shop_owner"], required: true },
  shop_type: { type: String, enum: ["separate_shop", "branch"], required: true },
  isComplete: { type: Boolean, default: false },
  mongoPlanId: { type: String, ref: "Plan" }, // ✅ Changed from ObjectId to String
  mongoCategoryId: { type: String, ref: "PlanCategory" }, // ✅ Changed from ObjectId to String
  created_at: { type: Date, default: Date.now }
});


// ==============================
// 👤 User Schema (Product-Specific Users)
// ==============================
const userSchema = new mongoose.Schema({
  mysql_user_id: { type: String, required: true, unique: true },
  role_id: { type: mongoose.Schema.Types.ObjectId, ref: "Role", required: true },
  isSubscriptionActive: { type: Boolean, default: true }, // ✅ New field
  trialExpiryDate: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }, // 1 month trial
  hasUsedTrial: { type: Boolean, default: false }, // Track if user already used trial
  created_at: { type: Date, default: Date.now }
});        

// ==============================
// 👑 Manager Schema
// ==============================
const managerSchema = new mongoose.Schema({
  mysql_user_id: { type: String, required: true, unique: true },
  plan_id: { type: String, required: true }, // ID from MySQL
  branch_limit: { type: Number, required: true },
  branches: [{ type: mongoose.Schema.Types.ObjectId, ref: "Branch" }],
  invite_code: { type: String, unique: true, required: true }, // 👈 Moved here
  created_at: { type: Date, default: Date.now }
});

// ==============================
// 🏢 Branch Schema
// ==============================
const branchSchema = new mongoose.Schema({
  manager_id: { type: mongoose.Schema.Types.ObjectId, ref: "Manager", required: true },
  branch_name: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

// ==============================
// 🛍️ Shop Schema
// ==============================
const shopSchema = new mongoose.Schema({
  mysql_user_id: { type: String, required: true, unique: true },
  role_id: { type: mongoose.Schema.Types.ObjectId, ref: "Role", required: true },
  shop_name: { type: String, required: true },
  location: { type: String, required: true },
  phone: { type: String }, // ✅ Add this line
  email: { type: String },
  address: { type: String },
  owner_name: { type: String }, // ✅ new field for MySQL name
  revenue_visible_to_users: { type: Boolean, default: true }, // Toggle: show/hide revenue & analytics for regular users
  // eSSL M20 Biometric Attendance Integration
  use_essl_attendance: { type: Boolean, default: false }, // When true, use ADMS device; hide built-in attendance
  essl_device_serial: { type: String, trim: true }, // Registered device serial number (SN)
  // HR / attendance behaviour — editable from the shop-admin portal
  hr_settings: {
    // Any punch within this many minutes of the previous accepted punch is treated as a duplicate.
    duplicate_punch_window_minutes: { type: Number, default: 180 },
    // Any check-out after this time of day is treated as the start of lunch.
    lunch_threshold_time: { type: String, default: '12:00' }, // HH:MM (24h)
    // Fixed lunch duration in minutes; punches inside this window after LUNCH_OUT are ignored.
    lunch_break_minutes: { type: Number, default: 30 }
  },
  // WhatsApp / MSG91 messaging config. Master `enabled` plus per-event toggles.
  whatsapp: {
    enabled: { type: Boolean, default: false },
    rate_per_message: { type: Number, default: 0.5 },
    events: {
      record_created: { type: Boolean, default: true },
      mobiles_appended: { type: Boolean, default: true },
      mobile_ready: { type: Boolean, default: true },
      mobile_delivered: { type: Boolean, default: true },
      mobile_returned: { type: Boolean, default: false },
      balance_reminder: { type: Boolean, default: true }
    }
  },
  created_at: { type: Date, default: Date.now }
});

// ==============================
// 🧾 Dealer Schema
// ==============================
const dealerSchema = new mongoose.Schema({
  shop_id: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
  client_name: { type: String, required: true },
  mobile_number: { type: String, required: true },
  bill_no: { type: String },
  customer_type: { type: String, default: "Dealer" },
  balance_amount: { type: Number, default: 0 },
  estimated_cost: { type: Number, default: 0 },
  no_of_mobile: { type: Number, default: 0 },
  vendors: [{
    vendor_name: { type: String, required: true },
    vendor_number: { type: String, required: true },
    mobile_count: { type: Number, default: 0 },
    created_at: { type: Date, default: Date.now }
  }],
  created_at: { type: Date, default: Date.now }
});
dealerSchema.index({ shop_id: 1 });


// ==============================
// 🔔 Notification Schema
// ==============================
const notificationSchema = new mongoose.Schema({
  shop_id: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
  type: { type: String, enum: ["success", "error", "info", "warning"], default: "info" },
  message: { type: String, required: true },
  created_at: { type: Date, default: Date.now, index: { expires: '7d' } } // auto-delete after 7 days
});


// ==============================
// 🧍 Customer Schema
// ==============================
const customerSchema = new mongoose.Schema({
  shop_id: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
  client_name: { type: String, required: true },
  mobile_number: { type: String, required: true },
  bill_no: { type: String },
  customer_type: { type: String, default: "Customer" },
  no_of_mobile: { type: Number, default: 0 },
  balance_amount: { type: Number, default: 0 },
  estimated_cost: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
});
customerSchema.index({ shop_id: 1 });

// ==============================
// 📱 Mobile Schema
// ==============================
const mobileSchema = new mongoose.Schema({
  shop_id: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  dealer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Dealer" },
  mobile_name: { type: String, required: true },
  model: { type: String }, // ✅ New field for mobile model
  imei: { type: String },
  issue: { type: String },
  technician_name: { type: String },
  added_date: { type: Date, default: Date.now },
  update_date: { type: Date },
  ready: { type: Boolean, default: false },
  delivered: { type: Boolean, default: false },
  returned: { type: Boolean, default: false },
  paid_amount: { type: Number, default: 0 }, // Customer payment amount (legacy, kept for backward compatibility)
  payment: { type: String, enum: ["cash", "UPI", "card", "UPI-h", "UPI-s", "Cash + Card", "UPI H + CASH", "UPI S + CASH", "UPI H + CARD", "UPI S + CARD", ""], default: "" },
  // Split payment tracking
  payments: [{
    amount: { type: Number, required: true },
    method: { type: String, required: true },
    date: { type: Date, default: Date.now }
  }],
  total_paid: { type: Number, default: 0 }, // Sum of all payment entries
  delivery_date: { type: Date },
  // Supplier-related fields for tracking product/supplier usage
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier" },
  supplierName: { type: String },
  productName: { type: String },
  quantity: { type: Number },
  supplier_amount: { type: Number, default: 0 }, // Amount paid to supplier (separate from customer payment)
  paymentMethod: { type: String, enum: PAYMENT_METHOD_ENUM, default: "" }, // Payment method for supplier transactions
  warranty: { type: String, enum: ["warranty", "no-warranty", ""], default: "" }, // Warranty status
  created_at: { type: Date, default: Date.now }
});

// Indexes for customer-details aggregation:
// - mobiles-first grouping uses shop_id prefix; customer_id/dealer_id for the $group key
mobileSchema.index({ shop_id: 1, customer_id: 1 });
mobileSchema.index({ shop_id: 1, dealer_id: 1 });

// ==============================
// 🔧 Technician Schema
// ==============================
const technicianSchema = new mongoose.Schema({
  shop_id: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
  technician_name: { type: String, required: true },
  mobile_number: { type: String, required: true },
  assigned_mobiles: [{ type: mongoose.Schema.Types.ObjectId, ref: "Mobile" }],
  created_at: { type: Date, default: Date.now }
});

// ==============================
// 📂 Plan Category (Sales, Service...)
// ==============================
const planCategorySchema = new mongoose.Schema({
  _id: {
    type: String, // 👈 Use string-based constant ID
    required: true
  },
  name: {
    type: String,
    enum: ["Sales", "Service", "Sales + Service"],
    required: true,
    unique: true
  },
  created_at: { type: Date, default: Date.now }
});


// ==============================
// 📦 Plan (Basic, Gold, Premium)
// ==============================
const planSchema = new mongoose.Schema({
  _id: {
    type: String, // 👈 Use string-based constant ID
    required: true
  },
  category_id: {
    type: String, // 👈 Reference will now also be a string
    ref: "PlanCategory",
    required: true
  },
  name: { type: String, enum: ["Basic", "Gold", "Premium", "Trial", "Combo"], required: true },
  description: String,
  branchLimit: { type: Number, required: true },
  originalPrice: String,
  price: String,
  savePercentage: Number,
  term: String,
  bonusOffer: String,
  renewalPrice: String,
  renewalTerm: String,
  isPopular: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});



// ==============================
// ✅ Feature Schema - REMOVED
// Features are now provided to all users during 10-day trial
// ==============================





const productSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  category: { type: String },
  costPrice: { type: Number, required: true },
  sellingPrice: { type: Number },
  quantity: { type: Number, required: true },
  totalCost: { type: Number, required: true }, // should be calculated on save
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier" },
  paymentMethod: { type: String, enum: PAYMENT_METHOD_ENUM, default: "Cash" },
  addedDate: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

productSchema.pre("save", function (next) {
  this.totalCost = this.costPrice * this.quantity;
  next();
});

// ==============================
// 🧾 Supplier Schema
// ==============================
const supplierSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  supplierName: { type: String, required: true, trim: true },
  agencyName: { type: String, trim: true },
  phoneNumber: { type: String, trim: true },
  address: { type: String, trim: true },
  totalAmount: { type: Number, default: 0 },
  lastPaymentMethod: { type: String, enum: PAYMENT_METHOD_ENUM, default: "" },
  createdAt: { type: Date, default: Date.now }
});

// ==============================
// 🧾 Supplier History Schema
// ==============================
const supplierHistorySchema = new mongoose.Schema({
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  changeDate: { type: Date, default: Date.now },
  changeType: { type: String, enum: ["ADMIN_EDIT", "NOTE"], required: true },
  message: { type: String, default: "" },
  totalAmount: { type: Number },
  // amount paid in this change (if this history entry represents a payment)
  paidAmount: { type: Number },
  // previous total before this change
  previousAmount: { type: Number },
  paymentMethod: { type: String, enum: PAYMENT_METHOD_ENUM, default: "" }
});


const productHistorySchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  changeDate: { type: Date, default: Date.now },
  changeType: { type: String, enum: ["ADD", "REMOVE", "EDIT", "SELL", "RESTOCK"], required: true },
  quantity: { type: Number, required: true },
  costPrice: { type: Number, required: true },
  paidAmount: { type: Number },
  notes: { type: String }
});

const expenseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  amount: { type: Number, required: true },
  paymentMethod: { type: String, enum: PAYMENT_METHOD_ENUM, default: "Cash" },
  createdAt: { type: Date, default: Date.now }
});


const dailySummarySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: Date, required: true, unique: true },
  totalRevenue: { type: Number, required: true },
  totalExpense: { type: Number, required: true },
  netRevenue: { type: Number, required: true }
});


// ==============================
// ✅ Export All Models
// ==============================
const Role = mongoose.model("Role", roleSchema);
const User = mongoose.model("User", userSchema);
const Manager = mongoose.model("Manager", managerSchema);
const Branch = mongoose.model("Branch", branchSchema);
const Shop = mongoose.model("Shop", shopSchema);
const Dealer = mongoose.model("Dealer", dealerSchema);
const Customer = mongoose.model("Customer", customerSchema);
const Mobile = mongoose.model("Mobile", mobileSchema);
const Technician = mongoose.model("Technician", technicianSchema);
const PlanCategory = mongoose.model("PlanCategory", planCategorySchema);
const Plan = mongoose.model("Plan", planSchema);
// Feature model removed - using 10-day trial instead
const Product = mongoose.model("Product", productSchema);
const Notification = mongoose.model("Notification", notificationSchema);
const ProductHistory = mongoose.model("ProductHistory", productHistorySchema);
const SupplierHistory = mongoose.model("SupplierHistory", supplierHistorySchema);
// ==============================
// 🧾 Admin Sale Schema
// ==============================
const adminSaleItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  productNo: { type: String },
  productName: { type: String },
  qty: { type: Number, default: 0 },
  sellingPrice: { type: Number, default: 0 },
  lineTotal: { type: Number, default: 0 }
}, { _id: false });

const adminSaleSchema = new mongoose.Schema({
  shop_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
  branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  seller_id: { type: String },
  customerNo: { type: String, default: '' },
  items: { type: [adminSaleItemSchema], default: [] },
  totalAmount: { type: Number, default: 0 },
  paymentMethod: { type: String, default: 'online' },
  bank_id: { type: String, default: '' },
  createdBy: { type: String, default: '' }
}, { timestamps: true });

// Indexes for queries
adminSaleSchema.index({ shop_id: 1 });
adminSaleSchema.index({ branch_id: 1 });

// ==============================
// 📱 Mobile Brand Schema
// ==============================
const mobileBrandSchema = new mongoose.Schema({
  shop_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
  brand_name: { type: String, required: true, trim: true },
  is_custom: { type: Boolean, default: false }, // true if added by user, false if seeded
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// Compound index to ensure unique brand per shop
mobileBrandSchema.index({ shop_id: 1, brand_name: 1 }, { unique: true });

// ==============================
// 🔧 Mobile Issue Schema
// ==============================
const mobileIssueSchema = new mongoose.Schema({
  shop_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
  issue_name: { type: String, required: true, trim: true },
  issue_category: { type: String, default: 'General' }, // e.g., Hardware, Software, Screen, Battery, etc.
  estimated_repair_time: { type: Number, default: 1 }, // in days
  is_custom: { type: Boolean, default: false }, // true if added by user, false if seeded
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// Compound index to ensure unique issue per shop
mobileIssueSchema.index({ shop_id: 1, issue_name: 1 }, { unique: true });

// ==============================
// 👥 Employee Schema
// ==============================
const employeeSchema = new mongoose.Schema({
  shop_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  // Legacy simple fields (kept for backward compat with existing built-in attendance)
  employee_name: { type: String, trim: true },
  mobile_number: { type: String, trim: true },
  address: { type: String, default: '' },
  blood_group: { type: String, default: '' },
  // Day-wise wage — employee earns this amount for each day they are present.
  daily_salary: { type: Number, default: 0 },
  device_pin: { type: String, trim: true }, // eSSL M20 biometric PIN

  // ── HR fields ────────────────────────────────────────────────────────
  is_active: { type: Boolean, default: true },
  name: { type: String, trim: true },
  phone: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  joining_date: { type: Date },
  department: { type: String, trim: true },
  designation: { type: String, trim: true },

  // Shift — working_hours is auto-derived from start/end at read time, not stored as truth.
  shift: {
    name: { type: String, default: 'General' },
    start_time: { type: String, default: '09:00' }, // HH:MM 24h — reporting time
    end_time: { type: String, default: '18:00' },   // HH:MM 24h
    grace_period_minutes: { type: Number, default: 15 }
  },
  working_days_per_week: { type: Number, default: 6 },
  weekly_off: [{ type: String }], // e.g. ['SUN']

  // Late entry policy — single rule: ₹ deducted per hour late (proportional).
  late_policy: {
    grace_period_minutes: { type: Number, default: 15 },
    deduction_per_hour: { type: Number, default: 0 } // ₹ per hour late, prorated by minute
  },

  created_at: { type: Date, default: Date.now }
}, { minimize: false, strict: false });

// Index for shop queries
employeeSchema.index({ shop_id: 1 });
employeeSchema.index({ shop_id: 1, is_active: 1 });

// ==============================
// 🕐 HR Attendance Punch Log
// Records every individual punch event (check-in, lunch-out, lunch-in, check-out, duplicate)
// Works for both SOFTWARE punches and eSSL M20 device punches.
// ==============================
const hrPunchSchema = new mongoose.Schema({
  shop_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  employee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  punch_time: { type: Date, required: true },
  // CHECK_IN -> LUNCH_OUT -> LUNCH_IN -> CHECK_OUT. DUPLICATE entries are
  // recorded for audit but do not influence the daily summary.
  punch_type: { type: String, enum: ['CHECK_IN', 'CHECK_OUT', 'LUNCH_OUT', 'LUNCH_IN', 'DUPLICATE'], required: true },
  source: { type: String, enum: ['SOFTWARE', 'ESSL_M20', 'MANUAL'], default: 'SOFTWARE' },
  is_late: { type: Boolean, default: false },
  late_minutes: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
});
hrPunchSchema.index({ shop_id: 1, date: 1 });
hrPunchSchema.index({ employee_id: 1, date: 1 });

// ==============================
// 📅 HR Daily Attendance Summary
// One record per employee per day — aggregated from punches.
// ==============================
const hrDailyAttendanceSchema = new mongoose.Schema({
  shop_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  employee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  status: { type: String, enum: ['PRESENT', 'ABSENT', 'LEAVE', 'HOLIDAY'], default: 'ABSENT' },
  check_in_time: { type: Date },
  check_out_time: { type: Date },
  lunch_out_time: { type: Date },
  lunch_in_time: { type: Date },
  is_late: { type: Boolean, default: false },
  late_minutes: { type: Number, default: 0 },
  late_deduction: { type: Number, default: 0 }, // ₹ deducted for lateness on this day
  day_net_salary: { type: Number, default: 0 }, // daily_salary − late_deduction; set on checkout
  lunch_minutes: { type: Number, default: 0 },
  total_worked_minutes: { type: Number, default: 0 },
  source: { type: String, enum: ['SOFTWARE', 'ESSL_M20', 'MANUAL'], default: 'SOFTWARE' },
  notes: { type: String },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});
hrDailyAttendanceSchema.index({ employee_id: 1, date: 1 }, { unique: true });
hrDailyAttendanceSchema.index({ shop_id: 1, date: 1 });

// ==============================
// 💵 HR Salary Record
// Monthly salary calculation per employee.
// ==============================
const hrSalaryRecordSchema = new mongoose.Schema({
  shop_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  employee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  month: { type: String, required: true },      // YYYY-MM
  year: { type: Number, required: true },
  month_number: { type: Number, required: true }, // 1-12
  // Attendance summary
  total_working_days: { type: Number, default: 0 },
  present_days: { type: Number, default: 0 },
  absent_days: { type: Number, default: 0 },
  leave_days: { type: Number, default: 0 },
  total_late_entries: { type: Number, default: 0 },
  total_late_minutes: { type: Number, default: 0 },
  // Salary — earned = daily_salary × present_days, late = sum of per-day late deductions
  daily_salary: { type: Number, default: 0 },
  earned_base: { type: Number, default: 0 },
  late_deduction: { type: Number, default: 0 },
  net_salary: { type: Number, default: 0 },
  // Payment
  status: { type: String, enum: ['DRAFT', 'FINALIZED', 'PAID'], default: 'DRAFT' },
  paid_at: { type: Date },
  paid_amount: { type: Number, default: 0 },
  notes: { type: String },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { strict: false });
hrSalaryRecordSchema.index({ employee_id: 1, month: 1 }, { unique: true });
hrSalaryRecordSchema.index({ shop_id: 1, month: 1 });
hrSalaryRecordSchema.index({ shop_id: 1, status: 1 });

// ==============================
// 🗓️ Attendance Schema (Daily Status)
// ==============================
const attendanceSchema = new mongoose.Schema({
  shop_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  employee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  date: { type: String, required: true }, // Store as YYYY-MM-DD string for simplicity
  status: { type: String, enum: ['present', 'absent'], required: true },
  locked: { type: Boolean, default: true }, // once marked true, prevents changes
  source: { type: String, enum: ['manual', 'essl_m20'], default: 'manual' }, // origin of this record
  check_in_time: { type: Date }, // populated when source is essl_m20
  check_out_time: { type: Date }, // populated when source is essl_m20
  created_at: { type: Date, default: Date.now }
});

// Compound indexes - no duplicate indexes
attendanceSchema.index({ employee_id: 1, date: 1 }, { unique: true });
attendanceSchema.index({ shop_id: 1 });

// ==============================
// 🏪 Shop Admin Schema (Centralized Monitoring)
// ==============================
const shopAdminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true }, // Will be hashed
  shop_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Shop' }], // Multiple shops
  email: { type: String, trim: true },
  phone: { type: String, trim: true },
  full_name: { type: String, trim: true },
  is_active: { type: Boolean, default: true },
  last_login: { type: Date },
  current_shop_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' }, // Currently selected shop
  created_by: { type: String }, // infinest admin email who created this
  sessionLimit: { type: Number, default: 1 }, // ✅ Maximum concurrent sessions allowed
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// Index for faster lookups
shopAdminSchema.index({ username: 1, is_active: 1 });

// ==============================
// 📡 eSSL Device Schema
// Registered ADMS devices per shop
// ==============================
const esslDeviceSchema = new mongoose.Schema({
  shop_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  device_serial: { type: String, required: true, trim: true, unique: true }, // Hardware SN
  device_name: { type: String, trim: true, default: 'eSSL M20' },
  firmware_version: { type: String, trim: true },
  last_seen: { type: Date }, // Last heartbeat/connection timestamp
  last_activity: { type: String }, // Description of last action
  is_active: { type: Boolean, default: true },
  // Cursor returned to the device as ATTLOGStamp so it only sends new records.
  // Starts at 0 (send all history on first connection), updated after each push.
  attlog_stamp: { type: Number, default: 0 },
  // Last time we successfully pushed a SET OPTION DateTime command to the
  // device.  We re-sync periodically so the device clock cannot drift away
  // from IST (e.g. if it auto-syncs from a non-IST NTP server).
  last_time_sync: { type: Date },
  // Compensation offset (in minutes) added to every incoming punch_time.
  // Use this when the device firmware refuses to honor the SET OPTION DateTime
  // command and keeps reporting timestamps in the wrong timezone.  Example:
  // device reports UTC but we want IST  →  set to 330  (5 h 30 m).
  time_offset_minutes: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
});
esslDeviceSchema.index({ shop_id: 1 });
// Note: device_serial unique index is already declared via `unique: true` on the field — no separate .index() needed.

// ==============================
// 🕐 eSSL Punch Log Schema
// Raw punch records received from ADMS device before processing
// ==============================
const esslPunchLogSchema = new mongoose.Schema({
  shop_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  device_serial: { type: String, required: true, trim: true },
  device_pin: { type: String, required: true, trim: true }, // Pin from device
  employee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }, // Resolved after match
  punch_time: { type: Date, required: true }, // Parsed from device DateTime field
  punch_type: { type: String, enum: ['check_in', 'check_out', 'break_out', 'break_in', 'overtime_in', 'overtime_out', 'unknown'], default: 'unknown' },
  verify_type: { type: Number }, // 1=FP, 4=PW, 15=Face — stored for audit, never exposed externally
  raw_line: { type: String }, // Original raw ATTLOG line (for debugging)
  processed: { type: Boolean, default: false }, // Whether this created an Attendance record
  created_at: { type: Date, default: Date.now }
});
esslPunchLogSchema.index({ shop_id: 1, punch_time: -1 });
esslPunchLogSchema.index({ device_serial: 1, punch_time: -1 });
esslPunchLogSchema.index({ employee_id: 1, punch_time: -1 });

// Index removed - already unique on shop_id in schema definition

const AdminSale = mongoose.model('AdminSale', adminSaleSchema);
const Expense = mongoose.model("Expense", expenseSchema);
const DailySummary = mongoose.model("DailySummary", dailySummarySchema);
const MobileBrand = mongoose.model("MobileBrand", mobileBrandSchema);
const MobileIssue = mongoose.model("MobileIssue", mobileIssueSchema);
const Employee = mongoose.model("Employee", employeeSchema);
const Attendance = mongoose.model("Attendance", attendanceSchema);
const ShopAdmin = mongoose.model("ShopAdmin", shopAdminSchema);
const Supplier = mongoose.model("Supplier", supplierSchema);
const EsslDevice = mongoose.model("EsslDevice", esslDeviceSchema);
const EsslPunchLog = mongoose.model("EsslPunchLog", esslPunchLogSchema);
const HrPunch = mongoose.model("HrPunch", hrPunchSchema);
const HrDailyAttendance = mongoose.model("HrDailyAttendance", hrDailyAttendanceSchema);
const HrSalaryRecord = mongoose.model("HrSalaryRecord", hrSalaryRecordSchema);

// ==============================
// 💬 WhatsApp send log
// ==============================
const whatsAppLogSchema = new mongoose.Schema({
  shop_id: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", index: true },
  event: { type: String, required: true, index: true },
  to: { type: String, required: true },
  template: { type: String },
  vars: { type: mongoose.Schema.Types.Mixed },
  status: { type: String, enum: ["sent", "skipped", "error"], default: "sent" },
  message_id: { type: String },
  error: { type: String },
  created_at: { type: Date, default: Date.now, index: { expires: '30d' } }
});
const WhatsAppLog = mongoose.model("WhatsAppLog", whatsAppLogSchema);

module.exports = {
  Role, User, Manager, Branch, Shop, Dealer, Customer, Notification, Mobile, Technician,
  PlanCategory, Plan, DailySummary, Expense, ProductHistory, Product,
  MobileBrand, MobileIssue, AdminSale, SupplierHistory, Employee, Attendance, ShopAdmin, Supplier,
  EsslDevice, EsslPunchLog, HrPunch, HrDailyAttendance, HrSalaryRecord,
  WhatsAppLog
};

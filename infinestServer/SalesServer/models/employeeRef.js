const mongoose = require('mongoose');

// Read-only view of BillitServer's HR `employees` collection (same Mongo database).
// BillitServer owns writes; SalesServer only resolves salesperson codes entered at the POS.
const employeeRefSchema = new mongoose.Schema({
  shop_id: mongoose.Schema.Types.ObjectId,
  employee_code: String,
  name: String,
  employee_name: String,
  designation: String,
  business_unit: String,
  is_active: Boolean
}, { strict: false, collection: 'employees', autoIndex: false });

module.exports = mongoose.models.EmployeeRef || mongoose.model('EmployeeRef', employeeRefSchema);

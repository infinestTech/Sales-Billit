const { Employee } = require('../../models/mongoModels');

// Add a new employee
async function addEmployee(req, res) {
  try {
    const { shop_id, employee_name, mobile_number, address, blood_group } = req.body;

    if (!shop_id || !employee_name || !mobile_number) {
      return res.status(400).json({ success: false, message: 'shop_id, employee_name and mobile_number are required.' });
    }

    // Optional authorization consistency check
    if (req.user?.shop_id && req.user.shop_id !== shop_id) {
      return res.status(403).json({ success: false, message: 'Token shop mismatch.' });
    }

    const employee = await Employee.create({
      shop_id,
      employee_name,
      mobile_number,
      address: address || '',
      blood_group: blood_group || ''
    });

    return res.json({ success: true, data: employee });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Duplicate employee (mobile already exists for shop).' });
    }
    console.error('[addEmployee] Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// List employees for a shop
async function listEmployees(req, res) {
  try {
    const { shopId } = req.params;
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'shopId param required.' });
    }

    if (req.user?.shop_id && req.user.shop_id !== shopId) {
      return res.status(403).json({ success: false, message: 'Token shop mismatch.' });
    }

    const employees = await Employee.find({ shop_id: shopId }).sort({ created_at: -1 });
    return res.json({ success: true, data: employees });
  } catch (err) {
    console.error('[listEmployees] Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

module.exports = { addEmployee, listEmployees };
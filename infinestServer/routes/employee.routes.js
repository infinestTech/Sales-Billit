const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/employee.controller');

// CRUD
router.post('/',                         ctrl.createEmployee);
router.get('/',                          ctrl.getAllEmployees);
router.get('/:employeeId',               ctrl.getEmployee);
router.put('/:employeeId',               ctrl.updateEmployee);
router.patch('/:employeeId/deactivate',  ctrl.deactivateEmployee);
router.patch('/:employeeId/reactivate',  ctrl.reactivateEmployee);

module.exports = router;

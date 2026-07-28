const express = require("express");
const router = express.Router();
const authenticateToken = require("../utils/authMiddleware");
const { Shop } = require("../models/mongoModels");

// Return the WhatsApp config (enabled + events) for the authenticated user's shop
router.get("/shop/whatsapp-config", authenticateToken, async (req, res) => {
  try {
    const shop = await Shop.findById(req.user.shop_id).select("whatsapp").lean();
    if (!shop) return res.status(404).json({ error: "Shop not found" });
    const wa = shop.whatsapp || {};
    return res.json({ enabled: !!wa.enabled, events: wa.events || {} });
  } catch (err) {
    console.error("shop/whatsapp-config error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

const { createCustomerController } = require("../controllers/api/createCustomerController");
router.post("/createcustomer", authenticateToken, createCustomerController);
const { searchCustomersByMobile } = require("../controllers/api/searchCustomersByMobileController");
router.post("/search-customers-by-mobile", authenticateToken, searchCustomersByMobile);
const { createDealer } = require("../controllers/api/createDealerController");
router.post("/createdealer",authenticateToken, createDealer);
const { getAllDealers } = require("../controllers/api/getAllDealersController");
router.post("/dealers", authenticateToken, getAllDealers);
const { getDealerVendors } = require("../controllers/api/getDealerVendorsController");
router.post("/dealer-vendors", authenticateToken, getDealerVendors);



const { updateDealer } = require("../controllers/api/updateDealerController");


router.post("/updatedealer",authenticateToken, updateDealer);


const { getTodayRecords } = require("../controllers/api/getTodayRecordsController");


router.post("/recordsToday",authenticateToken, getTodayRecords);




const { getTodayProductRevenue } = require("../controllers/api/getTodayProductRevenueController");


router.post("/products/revenueToday",authenticateToken, getTodayProductRevenue);




const { updateDailySummary } = require("../controllers/api/updateDailySummaryController");


router.post("/daily-summary/update",authenticateToken, updateDailySummary);




const { updateBalance } = require("../controllers/api/updateBalanceController");


router.post("/updateBalance",authenticateToken, updateBalance);


const { toggleMobileStatus } = require("../controllers/api/toggleMobileStatusController");


router.post("/toggle-status",authenticateToken, toggleMobileStatus);


const { updatePaidAmount } = require("../controllers/api/updatePaidAmountController");


router.post("/update-paid-amount",authenticateToken, updatePaidAmount);


const { addPaymentEntry } = require("../controllers/api/addPaymentEntryController");
router.post("/add-payment-entry", authenticateToken, addPaymentEntry);

const { deletePaymentEntry } = require("../controllers/api/deletePaymentEntryController");
router.post("/delete-payment-entry", authenticateToken, deletePaymentEntry);


const { getFilteredRecords } = require("../controllers/api/getFilteredRecordsController");


router.post("/records",authenticateToken, getFilteredRecords);




const { allUpdateBalance } = require("../controllers/api/allUpdateBalanceController");


router.post("/allUpdateBalance",authenticateToken, allUpdateBalance);


const { allUpdateEstimatedCost } = require("../controllers/api/allUpdateEstimatedCostController");


router.post("/allUpdateEstimatedCost", authenticateToken, allUpdateEstimatedCost);


const { sendBalanceReminder } = require("../controllers/api/sendBalanceReminderController");


router.post("/sendBalanceReminder", authenticateToken, sendBalanceReminder);


const { getCustomerBalances } = require("../controllers/api/getCustomerBalancesController");


router.post("/customers/balance",authenticateToken, getCustomerBalances);



const { addNotification } = require("../controllers/api/addNotificationController");


router.post("/notifications/add", authenticateToken, addNotification);


const { getNotifications } = require("../controllers/api/getNotificationsController");
router.get("/notifications", authenticateToken, getNotifications);


const { deleteNotification } = require("../controllers/api/deleteNotificationController");


router.delete("/notifications/delete", authenticateToken, deleteNotification);
const { clearAllNotifications } = require("../controllers/api/clearAllNotificationsController");


router.delete("/notifications/clear", authenticateToken, clearAllNotifications);



const { getDealerBalances } = require("../controllers/api/getDealerBalancesController");


router.post("/dealers/balance",authenticateToken, getDealerBalances);


const { clearBalance } = require("../controllers/api/clearBalanceController");


router.put("/invoices/clearBalance",authenticateToken, clearBalance);




const { updateInvoiceBalance } = require("../controllers/api/updateInvoiceBalanceController");


router.put("/invoices/updateBalance",authenticateToken,  updateInvoiceBalance);




const { addProduct } = require("../controllers/api/addProductController");


router.post("/products/add",authenticateToken, addProduct);




const { getProductHistory } = require("../controllers/api/getProductHistoryController");


router.post("/products/history/:productId",authenticateToken, getProductHistory);




const { listProducts } = require("../controllers/api/listProductsController");
router.post("/products/list",authenticateToken, listProducts);


const { sellProduct } = require("../controllers/api/sellProductController");
router.post("/products/sell",authenticateToken, sellProduct);

const { increaseStock } = require("../controllers/billitController");
router.post("/products/increase-stock", authenticateToken, increaseStock);

const { adminSell } = require('../controllers/api/adminSellController');
router.post('/products/admin-sell', authenticateToken, adminSell);




const { getTodayExpenses } = require("../controllers/api/getTodayExpensesController");


router.post("/expenses/today",authenticateToken, getTodayExpenses);




const { getDailySummaryRevenue } = require("../controllers/api/getDailySummaryRevenueController");


router.post("/daily-summary",authenticateToken, getDailySummaryRevenue);






const { addExpense } = require("../controllers/api/addExpenseController");
router.post("/expenses/add",authenticateToken, addExpense);




const { fetchAllData } = require("../controllers/api/fetchAllDataController");


router.post("/fetchAllData",authenticateToken, fetchAllData);




const { deleteMobileInvoice } = require("../controllers/api/deleteMobileInvoiceController");


router.delete("/invoices/:clientId/:mobileIndex",authenticateToken, deleteMobileInvoice);




const { updateTechnician } = require("../controllers/api/updateTechnicianController");


router.put("/updateTechnician/:id",authenticateToken, updateTechnician);






const { sendWhatsappBill, upload } = require("../controllers/api/sendWhatsappBillController");


// Route for sending PDF via WhatsApp
router.post("/send-whatsapp-bill", upload.single("pdf"), sendWhatsappBill);






const {viewPublicReceiptController} = require("../controllers/api/viewReceiptController")

// Add this new route WITHOUT authentication middleware
router.get("/receipt/public/:id", viewPublicReceiptController);




// =============================
// Supplier Routes (BillitServer)
// =============================
const { addSupplier, listSuppliers } = require("../controllers/api/supplierController");
router.post("/suppliers/add", authenticateToken, addSupplier);
router.post("/suppliers/list", authenticateToken, listSuppliers);
const { getSupplierHistory, updateSupplier } = require("../controllers/api/supplierController");
router.post("/suppliers/history", authenticateToken, getSupplierHistory);
router.post("/suppliers/update", authenticateToken, updateSupplier);
console.log("[billitRoutes] Supplier routes registered: POST /api/suppliers/add, POST /api/suppliers/list");
console.log("[billitRoutes] Supplier routes registered: POST /api/suppliers/history");
console.log("[billitRoutes] Supplier routes registered: POST /api/suppliers/update");




// ======================================
// 📱 Mobile Brands & Issues Routes
// ======================================
const { getMobileBrands, addMobileBrand, getMobileIssues, addMobileIssue } = require("../controllers/billitController");

// Mobile Brands
router.get("/mobile-brands/:shopId", authenticateToken, getMobileBrands);
router.post("/mobile-brands", authenticateToken, addMobileBrand);

// Mobile Issues  
router.get("/mobile-issues/:shopId", authenticateToken, getMobileIssues);
router.post("/mobile-issues", authenticateToken, addMobileIssue);

// ======================================
// 🧾 Bill Number Management Routes
// ======================================
const { generateNextBillNumber, checkBillNumberExists } = require("../controllers/api/billNumberController");

// Generate next sequential bill number
router.post("/next-bill-number", authenticateToken, generateNextBillNumber);

// Check if bill number exists
router.post("/check-bill-number", authenticateToken, checkBillNumberExists);

// ======================================
// 👥 Employee Routes
// ======================================
const { addEmployee, listEmployees } = require("../controllers/api/employeeController");
router.post("/employees/add", authenticateToken, addEmployee);
router.get("/employees/:shopId", authenticateToken, listEmployees);

// ======================================
// 🗓️ Attendance Routes
// ======================================
const { listTodayAttendance, markAttendance } = require("../controllers/api/attendanceController");
router.get("/employees/attendance/:shopId", authenticateToken, listTodayAttendance); // optional ?date=YYYY-MM-DD
router.post("/employees/attendance/mark", authenticateToken, markAttendance);

module.exports = router;




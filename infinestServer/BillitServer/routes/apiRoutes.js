const express = require('express');
const multer = require("multer");
const router = express.Router();
const { downloadFullBackup, viewBackup } = require('../controllers/api/backupDownloadController');
const authenticateToken = require('../utils/authMiddleware'); // same as records
const authMySQLToken = require('../utils/authMySQLToken');
const { Plan } = require('../models/mongoModels');
const upload = multer(); // buffer upload


const { updateShopPlanLimitController } = require("../controllers/api/updateShopPlanLimitController");


// Secure this with your INTERNAL AUTH middleware
router.post("/update-shop-plan-limit", authMySQLToken, updateShopPlanLimitController);




const { getDashboardSummary } = require("../controllers/api/summaryController");
router.post("/dashboard/summary", authenticateToken, getDashboardSummary);

const { getDashboardSummaryPublic } = require("../controllers/api/summaryController");
router.get("/dashboard/summary/get/:shop_id", getDashboardSummaryPublic);


const { getDashboardRecords, getDashboardRecordsPublic } = require("../controllers/api/dashboardRecordsController");
router.post("/dashboard/records", authenticateToken, getDashboardRecords);

router.get("/dashboard/records/get/:shop_id", getDashboardRecordsPublic);

const { getAnalyticsData } = require("../controllers/api/analyticsController");
router.post("/dashboard/analytics", authenticateToken, getAnalyticsData);
router.get("/analytics", authenticateToken, getAnalyticsData);
router.post("/backup/download", authenticateToken, downloadFullBackup);
router.post("/backup/view", upload.single("file"), viewBackup);

// Plan related routes
router.get('/plans/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;
    
    if (!categoryId) {
      return res.status(400).json({ message: "Category ID is required" });
    }

    // Find all plans for the given category
    const plans = await Plan.find({ category_id: categoryId }).sort({ price: 1 });
    
    if (!plans || plans.length === 0) {
      return res.status(404).json({ message: "No plans found for this category" });
    }
    
    res.json(plans);
  } catch (err) {
    console.error("Error fetching plans by category:", err);
    res.status(500).json({ message: "Failed to fetch plans", error: err.message });
  }
});

router.get('/plan/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ message: "Plan ID is required" });
    }

    const plan = await Plan.findOne({ _id: id });
    
    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }
    
    res.json(plan);
  } catch (err) {
    console.error("Error fetching plan details:", err);
    res.status(500).json({ message: "Failed to fetch plan details", error: err.message });
  }
});


module.exports = router;

const express = require('express');
const router = express.Router();
const { User, Role } = require('../models/mongoModels');
const authenticateToken = require("../utils/authMiddleware");

// Return all premium features for users within 10-day trial
router.get('/user/features', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        // Find user to check trial status
        const user = await User.findOne({ mysql_user_id: userId }).populate('role_id');
        
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // Check if trial is still active
        const now = new Date();
        const isTrialActive = user.trialExpiryDate && now < user.trialExpiryDate;
        
        // Always return all premium features during trial
        const allFeatures = [
            {
                feature_key: "allow_paper_billing",
                type: "boolean",
                enabled: true,
                description: "Paper billing allowed"
            },
            {
                feature_key: "allow_whatsapp_billing",
                type: "boolean",
                enabled: true,
                description: "WhatsApp billing allowed"
            },
            {
                feature_key: "dashboard_enabled",
                type: "boolean",
                enabled: true,
                description: "Dashboard enabled"
            },
            {
                feature_key: "expense_tracker_enabled",
                type: "boolean",
                enabled: true,
                description: "Expense tracker enabled"
            },
            {
                feature_key: "product_inventory_enabled",
                type: "boolean",
                enabled: true,
                description: "Product inventory enabled"
            },
            {
                feature_key: "notifications_enabled",
                type: "boolean",
                enabled: true,
                description: "Notifications enabled"
            },
            {
                feature_key: "analytics_dashboard_enabled",
                type: "boolean",
                enabled: true,
                description: "Advanced analytics dashboard enabled"
            },
            {
                feature_key: "show_ads",
                type: "boolean",
                enabled: false,
                description: "Ads removed"
            },
            {
                feature_key: "entry_limit",
                type: "limit",
                config: {
                    totalPages: 60,
                    entriesPerPage: 15
                },
                description: "60 pages × 15 records"
            },
            {
                feature_key: "dealer_mobile_create_limit",
                type: "limit",
                config: {
                    maxPerCreation: 30
                },
                description: "Dealer mobile creation limit: 30"
            }
        ];
        
        res.json({ 
            success: true, 
            features: allFeatures,
            trial: {
                isActive: isTrialActive,
                expiryDate: user.trialExpiryDate,
                daysRemaining: isTrialActive ? Math.ceil((user.trialExpiryDate - now) / (1000 * 60 * 60 * 24)) : 0
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching features." });
    }
});


module.exports = router;





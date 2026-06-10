const express = require('express');
const router = express.Router();
const requireUser = require('../middleware/requireUser');
const { Feature } = require('../models/feature'); // Use local Feature model
const axios = require('axios').create({ family: 4, timeout: 10000 });

// Get user features based on their plan
router.get('/api/user/features', requireUser, async (req, res) => {
  try {
    const { mongoPlanId, userId } = req.user;
    
    console.log('🔍 Feature request - User plan:', mongoPlanId, 'User ID:', userId);
    
    if (!mongoPlanId) {
      return res.status(400).json({ 
        error: 'User plan not found. Please ensure you have a valid subscription.' 
      });
    }

    // Combo plans include all Sales Premium features — map them to the equivalent sales plan
    // so Feature lookups in MongoDB (which are seeded under sales-* IDs) work correctly.
    const comboFeaturePlanMap = {
      'combo-premium':        'sales-premium',
      'combo-premium-yearly': 'sales-premium-yearly',
    };
    const featurePlanId = comboFeaturePlanMap[mongoPlanId] || mongoPlanId;

    // Check if user is on Basic plan (10-day trial)
    const isBasicPlan = featurePlanId === 'sales-basic';
    
    // For Basic plan users, check trial status from CommonDB
    let trialInfo = null;
    if (isBasicPlan && userId) {
      try {
        const trialRes = await axios.get(
          `${process.env.AUTH_SERVER_URL}/internal-get-trial-status/${userId}`,
          {
            headers: { 'x-internal-key': process.env.INTERNAL_API_KEY }
          }
        );
        if (trialRes.data) {
          trialInfo = trialRes.data;
          console.log('🔍 Trial info:', trialInfo);
        }
      } catch (trialErr) {
        console.warn('⚠️ Could not fetch trial status:', trialErr.message);
      }
    }

    // During active trial period, return all premium features
    const isTrialActive = trialInfo && trialInfo.isActive;
    
    if (isTrialActive) {
      console.log('✅ Active trial - returning exact premium plan features');
      // Return exact same features and limits as Premium plan during trial
      const allPremiumFeatures = [
        {
          feature_key: "suppliers_enabled",
          type: "boolean",
          enabled: true,
          description: "Supplier Management enabled"
        },
        {
          feature_key: "bank_accounts_enabled",
          type: "boolean",
          enabled: true,
          description: "Bank Account Management enabled"
        },
        {
          feature_key: "payment_history_enabled",
          type: "boolean",
          enabled: true,
          description: "Payment History enabled"
        },
        {
          feature_key: "gst_calculator_enabled",
          type: "boolean",
          enabled: true,
          description: "GST Calculator enabled"
        },
        {
          feature_key: "branch_management_enabled",
          type: "boolean",
          enabled: true,
          description: "Branch Management enabled"
        },
        {
          feature_key: "supply_history_enabled",
          type: "boolean",
          enabled: true,
          description: "Supply History enabled"
        },
        {
          feature_key: "sales_analytics_enabled",
          type: "boolean",
          enabled: true,
          description: "Sales Analytics enabled"
        },
        {
          feature_key: "stock_management_enabled",
          type: "boolean",
          enabled: true,
          description: "Stock Management enabled"
        },
        {
          feature_key: "supplier_limit",
          type: "limit",
          config: {
            maxSuppliers: 10  // Same as Premium plan
          },
          description: "10 suppliers (same as Premium plan)"
        },
        {
          feature_key: "bank_account_limit",
          type: "limit",
          config: {
            maxBankAccounts: 5  // Same as Premium plan
          },
          description: "5 bank accounts (same as Premium plan)"
        },
        {
          feature_key: "product_inventory_limit",
          type: "limit",
          config: {
            maxProducts: 150  // Same as Premium plan
          },
          description: "150 products (same as Premium plan)"
        }
      ];
      
      return res.json({
        success: true,
        userPlan: mongoPlanId,
        features: allPremiumFeatures,
        totalFeatures: allPremiumFeatures.length,
        trial: trialInfo
      });
    }

    // Otherwise, fetch features from database
    console.log('🔍 Fetching features for plan:', featurePlanId, '(userPlan:', mongoPlanId, ')');
    const features = await Feature.find({ plan_id: featurePlanId }).lean().maxTimeMS(5000);
    console.log('🔍 Found features:', features.length);
    
    // Also return the user's plan for context
    res.json({
      success: true,
      userPlan: mongoPlanId,
      features: features,
      totalFeatures: features.length,
      trial: trialInfo
    });

  } catch (error) {
    console.error('❌ Error fetching user features:', error);
    res.status(500).json({ 
      error: 'Failed to fetch features',
      message: error.message 
    });
  }
});

// Get specific feature by key
router.get('/api/user/features/:featureKey', requireUser, async (req, res) => {
  try {
    const { mongoPlanId } = req.user;
    const { featureKey } = req.params;
    
    if (!mongoPlanId) {
      return res.status(400).json({ 
        error: 'User plan not found. Please ensure you have a valid subscription.' 
      });
    }

    // Map combo plans to their sales-premium equivalent for feature lookups
    const comboFeaturePlanMap = { 'combo-premium': 'sales-premium', 'combo-premium-yearly': 'sales-premium-yearly' };
    const featurePlanId = comboFeaturePlanMap[mongoPlanId] || mongoPlanId;

    const feature = await Feature.findOne({ 
      plan_id: featurePlanId, 
      feature_key: featureKey 
    }).lean();
    
    if (!feature) {
      return res.status(404).json({ 
        error: 'Feature not found for your plan',
        featureKey,
        userPlan: mongoPlanId
      });
    }

    res.json({
      success: true,
      feature: feature,
      userPlan: mongoPlanId
    });

  } catch (error) {
    console.error('❌ Error fetching specific feature:', error);
    res.status(500).json({ 
      error: 'Failed to fetch feature',
      message: error.message 
    });
  }
});

// Check if a specific feature is enabled
router.get('/api/user/features/:featureKey/enabled', requireUser, async (req, res) => {
  try {
    const { mongoPlanId } = req.user;
    const { featureKey } = req.params;
    
    if (!mongoPlanId) {
      return res.status(400).json({ 
        error: 'User plan not found',
        enabled: false
      });
    }

    // Map combo plans to their sales-premium equivalent for feature lookups
    const comboFeaturePlanMap = { 'combo-premium': 'sales-premium', 'combo-premium-yearly': 'sales-premium-yearly' };
    const featurePlanId = comboFeaturePlanMap[mongoPlanId] || mongoPlanId;

    const feature = await Feature.findOne({ 
      plan_id: featurePlanId, 
      feature_key: featureKey 
    }).lean();
    
    const isEnabled = feature?.enabled ?? false;

    res.json({
      success: true,
      featureKey,
      enabled: isEnabled,
      userPlan: mongoPlanId,
      feature: feature || null
    });

  } catch (error) {
    console.error('❌ Error checking feature enabled status:', error);
    res.status(500).json({ 
      error: 'Failed to check feature status',
      enabled: false,
      message: error.message 
    });
  }
});

// Get feature limits for a specific feature
router.get('/api/user/features/:featureKey/limits', requireUser, async (req, res) => {
  try {
    const { mongoPlanId } = req.user;
    const { featureKey } = req.params;
    
    if (!mongoPlanId) {
      return res.status(400).json({ 
        error: 'User plan not found',
        limits: {}
      });
    }

    // Map combo plans to their sales-premium equivalent for feature lookups
    const comboFeaturePlanMap = { 'combo-premium': 'sales-premium', 'combo-premium-yearly': 'sales-premium-yearly' };
    const featurePlanId = comboFeaturePlanMap[mongoPlanId] || mongoPlanId;

    const feature = await Feature.findOne({ 
      plan_id: featurePlanId, 
      feature_key: featureKey 
    }).lean();
    
    if (!feature || feature.type !== 'limit') {
      return res.status(404).json({ 
        error: 'Limit feature not found for your plan',
        featureKey,
        userPlan: mongoPlanId,
        limits: {}
      });
    }

    res.json({
      success: true,
      featureKey,
      limits: feature.config || {},
      userPlan: mongoPlanId,
      description: feature.description
    });

  } catch (error) {
    console.error('❌ Error fetching feature limits:', error);
    res.status(500).json({ 
      error: 'Failed to fetch feature limits',
      limits: {},
      message: error.message 
    });
  }
});

// Debug endpoint to check user info and features
router.get('/api/debug/user-info', requireUser, async (req, res) => {
  try {
    const { mongoPlanId, userId, shop_id } = req.user;
    
    // Map combo plans to their sales-premium equivalent for feature lookups
    const comboFeaturePlanMap = { 'combo-premium': 'sales-premium', 'combo-premium-yearly': 'sales-premium-yearly' };
    const featurePlanId = comboFeaturePlanMap[mongoPlanId] || mongoPlanId;

    // Get features for this plan
    const features = await Feature.find({ plan_id: featurePlanId }).lean();
    
    res.json({
      debug: true,
      userInfo: {
        userId,
        shop_id,
        mongoPlanId,
        featurePlanId,
        hasFeatures: features.length > 0
      },
      features: features,
      featureKeys: features.map(f => f.feature_key),
      enabledBooleanFeatures: features.filter(f => f.type === 'boolean' && f.enabled).map(f => f.feature_key),
      limitFeatures: features.filter(f => f.type === 'limit').map(f => ({ key: f.feature_key, config: f.config }))
    });

  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
    res.status(500).json({ 
      debug: true,
      error: 'Debug failed',
      message: error.message 
    });
  }
});

module.exports = router;

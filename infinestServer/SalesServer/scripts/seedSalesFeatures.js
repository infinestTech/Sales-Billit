/**
 * Seed Sales Features for different plans
 * Run this script to populate the Feature collection with plan-specific features
 * 
 * Usage: node scripts/seedSalesFeatures.js
 */

const mongoose = require('mongoose');
const { Feature } = require('../models/feature');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.BILLIT_MONGO_URI || 'mongodb://127.0.0.1:27017/billit_db';

// Feature definitions - Only Premium plan features
// Basic plan users get these same features during 10-day trial
// After trial expires, they must upgrade to Premium to continue
const PREMIUM_FEATURES = [
    // Premium plan has all features enabled
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
    // Limits for Premium plan (higher than Gold)
    {
      feature_key: "supplier_limit",
      type: "limit",
      config: {
        maxSuppliers: 100
      },
      description: "Premium plan: 100 suppliers maximum"
    },
    {
      feature_key: "bank_account_limit",
      type: "limit",
      config: {
        maxBankAccounts: 5
      },
      description: "Premium plan: 5 bank accounts maximum"
    },
    {
      feature_key: "product_inventory_limit",
      type: "limit",
      config: {
        maxProducts: 150
      },
      description: "Premium plan: 150 products maximum"
    },
    {
      feature_key: "branch_limit",
      type: "limit",
      config: {
        maxBranches: 5
      },
      description: "Premium plan: 5 branches maximum"
    }
];

const SALES_FEATURES = {
  'sales-premium':        PREMIUM_FEATURES,
  // Yearly variant — same entitlements as monthly premium
  'sales-premium-yearly': PREMIUM_FEATURES,
};

async function seedFeatures() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing features
    console.log('🗑️  Clearing existing features...');
    await Feature.deleteMany({});
    console.log('✅ Cleared existing features');

    // Insert features for each plan
    for (const [planId, features] of Object.entries(SALES_FEATURES)) {
      console.log(`\n📦 Seeding features for ${planId}...`);
      
      const featureDocs = features.map(feature => ({
        plan_id: planId,
        ...feature
      }));

      await Feature.insertMany(featureDocs);
      console.log(`✅ Seeded ${featureDocs.length} features for ${planId}`);
    }

    console.log('\n✨ Feature seeding completed successfully!');
    
    // Display summary
    const totalFeatures = await Feature.countDocuments();
    console.log(`\n📊 Total features in database: ${totalFeatures}`);
    
    for (const planId of Object.keys(SALES_FEATURES)) {
      const count = await Feature.countDocuments({ plan_id: planId });
      console.log(`   - ${planId}: ${count} features`);
    }

  } catch (error) {
    console.error('❌ Error seeding features:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the seeder
seedFeatures();

const mongoose = require('mongoose');
const { Plan, Feature, PlanCategory } = require('./models/mongoModels');

// MongoDB connection URI for production VPS
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/billit_production';

// PLAN CATEGORIES (exact from local data)
const planCategories = [
  {
    "_id": "Sales",
    "__v": 0,
    "created_at": "2025-07-18T21:02:37.039Z",
    "name": "Sales"
  },
  {
    "_id": "Service",
    "__v": 0,
    "created_at": "2025-07-18T21:02:37.103Z",
    "name": "Service"
  },
  {
    "_id": "Sales_Service",
    "__v": 0,
    "created_at": "2025-07-18T21:02:37.114Z",
    "name": "Sales + Service"
  },
  {
    "_id": "Manager",
    "__v": 0,
    "created_at": "2025-07-18T21:02:37.117Z",
    "name": "Manager"
  },
  {
    "_id": "Enterprise",
    "__v": 0,
    "created_at": "2025-08-30T18:16:46.053Z",
    "name": "Enterprise"
  }
];

// PLANS DATA (exact from local data)
const plans = [
  {
    "_id": "sales-basic",
    "__v": 0,
    "category_id": "Sales",
    "created_at": "2025-08-30T18:16:46.235Z",
    "isPopular": false,
    "name": "Basic",
    "price": "0",
    "term": "Free Plan",
    "branchLimit": 1
  },
  {
    "_id": "sales-gold",
    "__v": 0,
    "category_id": "Sales",
    "created_at": "2025-08-30T18:16:46.243Z",
    "isPopular": false,
    "name": "Gold",
    "price": "299",
    "term": "Monthly Plan",
    "branchLimit": 1
  },
  {
    "_id": "sales-premium",
    "__v": 0,
    "category_id": "Sales",
    "created_at": "2025-08-30T18:16:46.251Z",
    "isPopular": false,
    "name": "Premium",
    "price": "399",
    "term": "Monthly Plan",
    "branchLimit": 1
  },
  {
    "_id": "enterprise-basic",
    "__v": 0,
    "category_id": "Enterprise",
    "created_at": "2025-08-30T18:16:46.265Z",
    "isPopular": false,
    "name": "Basic",
    "price": "0",
    "term": "Free Plan",
    "branchLimit": 5
  },
  {
    "_id": "enterprise-gold",
    "__v": 0,
    "category_id": "Enterprise",
    "created_at": "2025-08-30T18:16:46.274Z",
    "isPopular": false,
    "name": "Gold",
    "price": "999",
    "term": "Monthly Plan",
    "branchLimit": 10
  },
  {
    "_id": "enterprise-premium",
    "__v": 0,
    "category_id": "Enterprise",
    "created_at": "2025-08-30T18:16:46.286Z",
    "isPopular": false,
    "name": "Premium",
    "price": "1499",
    "term": "Monthly Plan",
    "branchLimit": 50
  },
  {
    "_id": "service-basic",
    "__v": 0,
    "bonusOffer": null,
    "branchLimit": 1,
    "category_id": "Service",
    "created_at": "2025-09-09T05:52:44.564Z",
    "description": "Ideal for new mobile repair shops starting out with basic restrictions and ads.",
    "isPopular": false,
    "name": "Basic",
    "originalPrice": "199",
    "price": "0",
    "renewalPrice": "Free with ads",
    "renewalTerm": "LifeTime",
    "savePercentage": 100,
    "term": "Free Plan"
  },
  {
    "_id": "service-gold",
    "__v": 0,
    "bonusOffer": "null",
    "branchLimit": 1,
    "category_id": "Service",
    "created_at": "2025-09-09T05:52:44.639Z",
    "description": "For growing shops needing smart workflow tools with advanced features.",
    "isPopular": true,
    "name": "Gold",
    "originalPrice": "999",
    "price": "399",
    "renewalPrice": "399",
    "renewalTerm": "per month",
    "savePercentage": 60,
    "term": "Monthly Plan"
  },
  {
    "_id": "service-premium",
    "__v": 0,
    "bonusOffer": "null",
    "branchLimit": 1,
    "category_id": "Service",
    "created_at": "2025-09-09T05:52:44.654Z",
    "description": "Best for high-volume service centers or chains with premium features.",
    "isPopular": false,
    "name": "Premium",
    "originalPrice": "1999",
    "price": "499",
    "renewalPrice": "499",
    "renewalTerm": "per month",
    "savePercentage": 75,
    "term": "Monthly Plan"
  }
];

// FEATURES DATA (exact from local data)
const features = [
  {
    "_id": "68bfc0aca1815bd5628643bc",
    "plan_id": "service-basic",
    "feature_key": "entry_limit",
    "type": "limit",
    "config": {
      "totalPages": 30,
      "entriesPerPage": 15
    },
    "description": "30 pages × 15 records",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643bd",
    "plan_id": "service-basic",
    "feature_key": "dealer_mobile_create_limit",
    "type": "limit",
    "config": {
      "maxPerCreation": 5
    },
    "description": "Dealer mobile creation limit: 5",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643be",
    "plan_id": "service-basic",
    "feature_key": "allow_paper_billing",
    "type": "boolean",
    "enabled": true,
    "description": "Paper billing allowed",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643bf",
    "plan_id": "service-basic",
    "feature_key": "allow_whatsapp_billing",
    "type": "boolean",
    "enabled": false,
    "description": "WhatsApp billing not allowed",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643c0",
    "plan_id": "service-basic",
    "feature_key": "dashboard_enabled",
    "type": "boolean",
    "enabled": false,
    "description": "Dashboard disabled",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643c1",
    "plan_id": "service-basic",
    "feature_key": "expense_tracker_enabled",
    "type": "boolean",
    "enabled": false,
    "description": "Expense tracker disabled",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643c2",
    "plan_id": "service-basic",
    "feature_key": "product_inventory_enabled",
    "type": "boolean",
    "enabled": false,
    "description": "Product inventory disabled",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643c3",
    "plan_id": "service-basic",
    "feature_key": "notifications_enabled",
    "type": "boolean",
    "enabled": false,
    "description": "Notifications enabled",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643c4",
    "plan_id": "service-basic",
    "feature_key": "analytics_dashboard_enabled",
    "type": "boolean",
    "enabled": false,
    "description": "Advanced analytics dashboard disabled",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643c5",
    "plan_id": "service-basic",
    "feature_key": "show_ads",
    "type": "boolean",
    "enabled": true,
    "description": "Ads displayed",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643c9",
    "plan_id": "service-gold",
    "feature_key": "entry_limit",
    "type": "limit",
    "config": {
      "totalPages": 1,
      "entriesPerPage": 15
    },
    "description": "40 pages × 15 records",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643ca",
    "plan_id": "service-gold",
    "feature_key": "dealer_mobile_create_limit",
    "type": "limit",
    "config": {
      "maxPerCreation": 10
    },
    "description": "Dealer mobile creation limit: 10",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643cb",
    "plan_id": "service-gold",
    "feature_key": "allow_paper_billing",
    "type": "boolean",
    "enabled": true,
    "description": "Paper billing allowed",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643cc",
    "plan_id": "service-gold",
    "feature_key": "allow_whatsapp_billing",
    "type": "boolean",
    "enabled": true,
    "description": "WhatsApp billing allowed",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643cd",
    "plan_id": "service-gold",
    "feature_key": "dashboard_enabled",
    "type": "boolean",
    "enabled": true,
    "description": "Dashboard enabled",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643ce",
    "plan_id": "service-gold",
    "feature_key": "expense_tracker_enabled",
    "type": "boolean",
    "enabled": false,
    "description": "Expense tracker enabled",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643cf",
    "plan_id": "service-gold",
    "feature_key": "product_inventory_enabled",
    "type": "boolean",
    "enabled": false,
    "description": "Product inventory enabled",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643d0",
    "plan_id": "service-gold",
    "feature_key": "notifications_enabled",
    "type": "boolean",
    "enabled": true,
    "description": "Notifications enabled",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643d1",
    "plan_id": "service-gold",
    "feature_key": "analytics_dashboard_enabled",
    "type": "boolean",
    "enabled": false,
    "description": "Advanced analytics dashboard disabled",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643d2",
    "plan_id": "service-gold",
    "feature_key": "show_ads",
    "type": "boolean",
    "enabled": false,
    "description": "Ads removed",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643d6",
    "plan_id": "service-premium",
    "feature_key": "entry_limit",
    "type": "limit",
    "config": {
      "totalPages": 60,
      "entriesPerPage": 15
    },
    "description": "60 pages × 15 records",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643d7",
    "plan_id": "service-premium",
    "feature_key": "dealer_mobile_create_limit",
    "type": "limit",
    "config": {
      "maxPerCreation": 30
    },
    "description": "Dealer mobile creation limit: 30",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643d8",
    "plan_id": "service-premium",
    "feature_key": "allow_paper_billing",
    "type": "boolean",
    "enabled": true,
    "description": "Paper billing allowed",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643d9",
    "plan_id": "service-premium",
    "feature_key": "allow_whatsapp_billing",
    "type": "boolean",
    "enabled": true,
    "description": "WhatsApp billing allowed",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643da",
    "plan_id": "service-premium",
    "feature_key": "dashboard_enabled",
    "type": "boolean",
    "enabled": true,
    "description": "Dashboard enabled",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643db",
    "plan_id": "service-premium",
    "feature_key": "expense_tracker_enabled",
    "type": "boolean",
    "enabled": true,
    "description": "Expense tracker enabled",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643dc",
    "plan_id": "service-premium",
    "feature_key": "product_inventory_enabled",
    "type": "boolean",
    "enabled": true,
    "description": "Product inventory enabled",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643dd",
    "plan_id": "service-premium",
    "feature_key": "notifications_enabled",
    "type": "boolean",
    "enabled": true,
    "description": "Notifications enabled",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643de",
    "plan_id": "service-premium",
    "feature_key": "analytics_dashboard_enabled",
    "type": "boolean",
    "enabled": true,
    "description": "Advanced analytics dashboard enabled",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643df",
    "plan_id": "service-premium",
    "feature_key": "show_ads",
    "type": "boolean",
    "enabled": false,
    "description": "Ads removed",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643e3",
    "plan_id": "sales-basic",
    "feature_key": "sales_products_limit",
    "type": "limit",
    "config": {
      "totalPages": 5
    },
    "description": "5 products",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643e4",
    "plan_id": "sales-basic",
    "feature_key": "show_ads",
    "type": "boolean",
    "enabled": true,
    "description": "Ads shown",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643e8",
    "plan_id": "sales-gold",
    "feature_key": "sales_products_limit",
    "type": "limit",
    "config": {
      "totalPages": 100
    },
    "description": "100 products",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643e9",
    "plan_id": "sales-gold",
    "feature_key": "sales_analytics",
    "type": "boolean",
    "enabled": true,
    "description": "Basic analytics",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643ea",
    "plan_id": "sales-gold",
    "feature_key": "show_ads",
    "type": "boolean",
    "enabled": false,
    "description": "No ads",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643ee",
    "plan_id": "sales-premium",
    "feature_key": "sales_products_limit",
    "type": "limit",
    "config": {
      "totalPages": 999999
    },
    "description": "Unlimited products",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643ef",
    "plan_id": "sales-premium",
    "feature_key": "sales_analytics",
    "type": "boolean",
    "enabled": true,
    "description": "Advanced analytics",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643f0",
    "plan_id": "sales-premium",
    "feature_key": "priority_support",
    "type": "boolean",
    "enabled": true,
    "description": "Priority support",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643f4",
    "plan_id": "enterprise-basic",
    "feature_key": "branch_limit",
    "type": "limit",
    "config": {
      "totalPages": 2
    },
    "description": "2 branches",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643f5",
    "plan_id": "enterprise-basic",
    "feature_key": "roles",
    "type": "boolean",
    "enabled": true,
    "description": "Basic roles",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643f9",
    "plan_id": "enterprise-gold",
    "feature_key": "branch_limit",
    "type": "limit",
    "config": {
      "totalPages": 10
    },
    "description": "10 branches",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643fa",
    "plan_id": "enterprise-gold",
    "feature_key": "security",
    "type": "boolean",
    "enabled": true,
    "description": "SSO & audit logs",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643fb",
    "plan_id": "enterprise-gold",
    "feature_key": "support",
    "type": "boolean",
    "enabled": true,
    "description": "Priority support",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd5628643ff",
    "plan_id": "enterprise-premium",
    "feature_key": "branch_limit",
    "type": "limit",
    "config": {
      "totalPages": 999999
    },
    "description": "Unlimited branches",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd562864400",
    "plan_id": "enterprise-premium",
    "feature_key": "sla",
    "type": "boolean",
    "enabled": true,
    "description": "SLA + dedicated manager",
    "__v": 0
  },
  {
    "_id": "68bfc0aca1815bd562864401",
    "plan_id": "enterprise-premium",
    "feature_key": "integrations",
    "type": "boolean",
    "enabled": true,
    "description": "Custom integrations",
    "__v": 0
  }
];

// Seeding function for VPS
async function seedVPSDatabase() {
  try {
    console.log('🚀 Starting VPS Database Seeding...');
    
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to production MongoDB');

    // Clean existing data
    console.log('\n🗑️  Cleaning existing data...');
    await Feature.deleteMany({});
    await Plan.deleteMany({});
    await PlanCategory.deleteMany({});
    console.log('✅ Cleaned existing data');

    // Seed Plan Categories
    console.log('\n📂 Seeding Plan Categories...');
    for (const category of planCategories) {
      try {
        const result = await PlanCategory.create(category);
        console.log(`✅ Created category: ${result.name}`);
      } catch (error) {
        console.log(`❌ Error creating category ${category.name}:`, error.message);
      }
    }

    // Seed Plans
    console.log('\n📋 Seeding Plans...');
    for (const plan of plans) {
      try {
        const result = await Plan.create(plan);
        console.log(`✅ Created plan: ${result.category_id}/${result.name} - ₹${result.price}`);
      } catch (error) {
        console.log(`❌ Error creating plan ${plan.name}:`, error.message);
      }
    }

    // Seed Features
    console.log('\n⚡ Seeding Features...');
    for (const feature of features) {
      try {
        const result = await Feature.create(feature);
        console.log(`✅ Created feature: ${result.plan_id}/${result.feature_key}`);
      } catch (error) {
        console.log(`❌ Error creating feature ${feature.feature_key}:`, error.message);
      }
    }

    console.log('\n🎉 VPS Database seeding completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Categories: ${planCategories.length}`);
    console.log(`   - Plans: ${plans.length}`);
    console.log(`   - Features: ${features.length}`);
    
    console.log('\n✅ Verification:');
    console.log('📂 Plan Categories:');
    planCategories.forEach(cat => console.log(`   - ${cat.name} (${cat._id})`));
    
    console.log('\n📦 Plans by Category:');
    const plansByCategory = {};
    plans.forEach(plan => {
      if (!plansByCategory[plan.category_id]) plansByCategory[plan.category_id] = [];
      plansByCategory[plan.category_id].push(`${plan.name} - ₹${plan.price}`);
    });
    Object.keys(plansByCategory).forEach(catId => {
      console.log(`   ${catId}:`);
      plansByCategory[catId].forEach(plan => console.log(`     - ${plan}`));
    });
    
    console.log('\n🔧 Features Summary:');
    const featuresByPlan = {};
    features.forEach(feature => {
      if (!featuresByPlan[feature.plan_id]) featuresByPlan[feature.plan_id] = 0;
      featuresByPlan[feature.plan_id]++;
    });
    Object.keys(featuresByPlan).forEach(planId => {
      console.log(`   ${planId}: ${featuresByPlan[planId]} features`);
    });
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the seeding function if called directly
if (require.main === module) {
  seedVPSDatabase();
}

module.exports = { seedVPSDatabase, planCategories, plans, features };

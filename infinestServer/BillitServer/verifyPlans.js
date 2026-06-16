require('dotenv').config();
const mongoose = require('mongoose');
const { Plan } = require('./models/mongoModels');

const MONGO_URI = process.env.BILLIT_MONGO_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/billit_db';

async function verifyPlans() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    console.log('   URI:', MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'));
    
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check for yearly plans
    const yearlyPlans = [
      'sales-premium-yearly',
      'service-premium-yearly',
      'combo-premium-yearly'
    ];

    console.log('🔍 Checking for yearly plans...\n');
    
    for (const planId of yearlyPlans) {
      const plan = await Plan.findOne({ _id: planId });
      if (plan) {
        console.log(`✅ Found: ${planId}`);
        console.log(`   Name: ${plan.name}`);
        console.log(`   Price: ₹${plan.price}`);
        console.log(`   Category: ${plan.category_id}\n`);
      } else {
        console.log(`❌ Missing: ${planId}\n`);
      }
    }

    // Count all plans
    const totalPlans = await Plan.countDocuments();
    console.log(`📊 Total plans in database: ${totalPlans}`);
    console.log('   Expected: 8 (2 sales + 2 service + 2 combo monthly+yearly each, including trials)\n');

    if (totalPlans < 8) {
      console.log('⚠️  WARNING: Missing plans detected!');
      console.log('   Run the seeder script to populate the database:');
      console.log('   $ node vpsSeederSimple.js\n');
    } else {
      console.log('✅ All plans appear to be present!\n');
    }

    // List all plans
    console.log('📋 All plans in database:');
    const allPlans = await Plan.find({}).select('_id name price category_id').sort({ category_id: 1, price: 1 });
    allPlans.forEach(plan => {
      console.log(`   ${plan._id.padEnd(25)} | ${plan.name.padEnd(20)} | ₹${String(plan.price).padStart(5)} | ${plan.category_id}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run verification
if (require.main === module) {
  verifyPlans();
}

module.exports = { verifyPlans };

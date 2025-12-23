/**
 * Migration script to add compound unique index on (shop_id, email) 
 * to the SalesBranch collection to prevent duplicate branch emails.
 * 
 * Run this once after deploying the model changes.
 * 
 * Usage: node scripts/add-branch-email-unique-index.js
 */

const mongoose = require('mongoose');

// Load environment variables if using dotenv
require('dotenv').config({ path: '../.env' });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/billit_db';

async function addUniqueIndex() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('salesbranches');

    console.log('📊 Checking existing indexes...');
    const existingIndexes = await collection.indexes();
    console.log('Current indexes:', existingIndexes.map(idx => idx.name));

    // Check if the unique compound index already exists
    const uniqueIndexExists = existingIndexes.some(
      idx => idx.key && idx.key.shop_id === 1 && idx.key.email === 1 && idx.unique === true
    );

    if (uniqueIndexExists) {
      console.log('✅ Compound unique index on (shop_id, email) already exists');
    } else {
      console.log('📝 Creating compound unique index on (shop_id, email)...');
      
      // First, check for duplicates before creating the index
      console.log('🔍 Checking for duplicate emails within shops...');
      const duplicates = await collection.aggregate([
        {
          $group: {
            _id: { shop_id: '$shop_id', email: '$email' },
            count: { $sum: 1 },
            ids: { $push: '$_id' }
          }
        },
        {
          $match: { count: { $gt: 1 } }
        }
      ]).toArray();

      if (duplicates.length > 0) {
        console.log('⚠️  WARNING: Found duplicate emails that need to be resolved:');
        duplicates.forEach(dup => {
          console.log(`  Shop: ${dup._id.shop_id}, Email: ${dup._id.email}, Count: ${dup.count}`);
          console.log(`  Document IDs: ${dup.ids.join(', ')}`);
        });
        console.log('\n❌ Cannot create unique index. Please resolve duplicates first.');
        console.log('   You may need to manually delete or update duplicate entries.');
        process.exit(1);
      } else {
        console.log('✅ No duplicates found');
      }

      // Create the unique compound index
      await collection.createIndex(
        { shop_id: 1, email: 1 }, 
        { unique: true, name: 'shop_id_email_unique' }
      );
      console.log('✅ Successfully created compound unique index on (shop_id, email)');
    }

    console.log('\n📊 Final indexes:');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the migration
addUniqueIndex();

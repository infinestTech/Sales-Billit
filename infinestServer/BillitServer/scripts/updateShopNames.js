/**
 * Migration Script: Update Shop Names
 * This script updates existing shops that have "Not Provided" as shop_name
 * with proper shop names derived from owner names or sets a default
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Shop } = require('../models/mongoModels');

async function updateShopNames() {
    try {
        // Connect to MongoDB
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(process.env.BILLIT_MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Find all shops with "Not Provided" as shop_name
        const shopsToUpdate = await Shop.find({
            $or: [
                { shop_name: "Not Provided" },
                { shop_name: { $exists: false } },
                { shop_name: "" }
            ]
        });

        console.log(`📋 Found ${shopsToUpdate.length} shops to update`);

        let updated = 0;
        for (const shop of shopsToUpdate) {
            const newShopName = shop.owner_name 
                ? `${shop.owner_name}'s Shop` 
                : `Shop ${shop.mysql_user_id.substring(0, 6)}`;
            
            const newLocation = (!shop.location || shop.location === "Not Provided")
                ? "Location Not Set"
                : shop.location;

            shop.shop_name = newShopName;
            shop.location = newLocation;
            await shop.save();
            
            console.log(`✅ Updated: ${shop._id} -> Name: "${newShopName}", Location: "${newLocation}"`);
            updated++;
        }

        console.log(`\n🎉 Successfully updated ${updated} shops`);
        
        // Display all shops after update
        const allShops = await Shop.find({});
        console.log('\n📊 All Shops After Update:');
        allShops.forEach(shop => {
            console.log(`  - ${shop.shop_name} (${shop.location}) - Owner: ${shop.owner_name || 'N/A'}`);
        });

    } catch (error) {
        console.error('❌ Migration error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run migration
updateShopNames();

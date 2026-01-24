const { PrismaClient } = require('@prisma/client');
const moment = require('moment-timezone');

const prisma = new PrismaClient();

async function migrateBasicPlans() {
  try {
    console.log('🔄 Starting Basic plan migration...\n');
    console.log('⚠️  This will update all ACTIVE Basic plan subscriptions with NULL endDate');
    console.log('    to have a 10-day trial period from their start date.\n');

    // Find all ACTIVE Basic plan subscriptions with NULL endDate
    const basicSubs = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        endDate: null
      },
      include: {
        plan: true,
        User: {
          select: {
            email: true,
            name: true
          }
        }
      }
    });

    console.log(`📊 Found ${basicSubs.length} subscriptions with NULL endDate\n`);

    if (basicSubs.length === 0) {
      console.log('✅ No subscriptions to migrate. All set!');
      return;
    }

    let updatedCount = 0;
    let skippedCount = 0;

    for (const sub of basicSubs) {
      if (sub.plan.name === 'Basic') {
        // Calculate 10 days from startDate
        const newEndDate = moment(sub.startDate)
          .tz('Asia/Kolkata')
          .add(10, 'days')
          .toDate();

        const now = moment().tz('Asia/Kolkata');
        const isAlreadyExpired = moment(newEndDate).isBefore(now);

        await prisma.subscription.update({
          where: { id: sub.id },
          data: { 
            endDate: newEndDate,
            // If trial already expired based on calculation, mark as EXPIRED
            status: isAlreadyExpired ? 'EXPIRED' : 'ACTIVE'
          }
        });

        console.log(`${isAlreadyExpired ? '⏰' : '✅'} Updated subscription ${sub.id}`);
        if (sub.User && sub.User[0]) {
          console.log(`   User: ${sub.User[0].email} (${sub.User[0].name || 'N/A'})`);
        } else {
          console.log(`   User ID: ${sub.userId}`);
        }
        console.log(`   Start: ${moment(sub.startDate).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss')}`);
        console.log(`   New End: ${moment(newEndDate).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss')}`);
        if (isAlreadyExpired) {
          console.log(`   ⚠️  Trial already expired - marked as EXPIRED`);
        }
        console.log('');
        updatedCount++;
      } else {
        console.log(`⏭️  Skipped subscription ${sub.id} - Plan: ${sub.plan.name} (not Basic)`);
        skippedCount++;
      }
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`   ✅ Updated: ${updatedCount} Basic plan subscriptions`);
    console.log(`   ⏭️  Skipped: ${skippedCount} non-Basic subscriptions`);
    console.log(`   📝 Total processed: ${basicSubs.length}`);
    console.log(`\n✅ Migration complete!\n`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Confirmation prompt
console.log('⚠️  WARNING: This script will modify your database!');
console.log('   Make sure you have backed up your database before proceeding.');
console.log('\n🔄 Starting migration in 3 seconds...\n');

setTimeout(() => {
  migrateBasicPlans()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}, 3000);

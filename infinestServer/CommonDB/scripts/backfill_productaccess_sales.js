// Backfill script: ensure ProductAccess.product = 'SALES' for users
// who have an ACTIVE SALES subscription.
// Usage: node scripts/backfill_productaccess_sales.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔎 Backfilling ProductAccess for SALES...');

  // Find all users with ACTIVE SALES subscriptions
  const subs = await prisma.subscription.findMany({
    where: { product: 'SALES', status: 'ACTIVE' },
    select: { userId: true }
  });

  const userIds = [...new Set(subs.map(s => s.userId))];
  console.log(`Found ${userIds.length} users with ACTIVE SALES subscription.`);

  let updated = 0;
  for (const userId of userIds) {
    const existing = await prisma.productAccess.findFirst({
      where: { userId, product: 'SALES' }
    });
    if (existing) continue;

    // If they have SERVICE access but should be SALES, delete SERVICE and insert SALES
    const serviceAccess = await prisma.productAccess.findFirst({
      where: { userId, product: 'SERVICE' }
    });
    if (serviceAccess) {
      await prisma.productAccess.delete({ where: { id: serviceAccess.id } });
    }

    await prisma.productAccess.create({ data: { userId, product: 'SALES' } });
    updated++;
  }

  console.log(`✅ Backfill complete. Added/updated ${updated} ProductAccess rows for SALES.`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});

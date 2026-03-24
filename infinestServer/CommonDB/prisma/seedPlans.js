// Seed MySQL Plan table with entries mapped to Mongo plans/categories
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Plans to upsert - Only Basic and Premium for each product
  const plans = [
    // Service
    { name: 'Trial', price: 99, duration: 'MONTHLY', branchLimit: 1, mongoPlanId: 'service-basic', mongoCategoryId: 'Service' },
    { name: 'Premium', price: 499, duration: 'MONTHLY', branchLimit: 1, mongoPlanId: 'service-premium', mongoCategoryId: 'Service' },
    // Sales
    { name: 'Sales Trial', price: 99, duration: 'MONTHLY', branchLimit: 0, mongoPlanId: 'sales-basic', mongoCategoryId: 'Sales' },
    { name: 'Sales Premium', price: 399, duration: 'MONTHLY', branchLimit: 5, mongoPlanId: 'sales-premium', mongoCategoryId: 'Sales' },
    // Combo (Sales + Service)
    { name: 'Combo', price: 899, duration: 'MONTHLY', branchLimit: 5, mongoPlanId: 'combo-premium', mongoCategoryId: 'Sales_Service' },
  ];

  for (const p of plans) {
    const existing = await prisma.plan.findFirst({ where: { mongoPlanId: p.mongoPlanId } });
    if (!existing) {
      await prisma.plan.create({ data: p });
      console.log(`✅ Created MySQL plan: ${p.name} (${p.mongoPlanId})`);
    } else {
      await prisma.plan.update({
        where: { id: existing.id },
        data: {
          name: p.name,
          price: p.price,
          duration: p.duration,
          branchLimit: p.branchLimit,
          mongoCategoryId: p.mongoCategoryId,
        }
      });
      console.log(`🔄 Updated MySQL plan: ${p.name} (${p.mongoPlanId})`);
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });

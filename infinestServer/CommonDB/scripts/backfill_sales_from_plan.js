// Infer SALES from plan metadata and fix Subscription.product and ProductAccess
// Usage: node scripts/backfill_sales_from_plan.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function isSalesPlan(plan) {
  const fields = [plan?.name, plan?.mongoCategoryId, plan?.mongoPlanId]
    .filter(Boolean)
    .map(s => String(s).toLowerCase());
  return fields.some(s => s.includes('sales'));
}

async function main() {
  console.log('🔧 Backfilling SALES using plan metadata...');

  const activeSubs = await prisma.subscription.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, userId: true, product: true, planId: true }
  });

  let updatedSubs = 0;
  let updatedAccess = 0;

  for (const sub of activeSubs) {
    // Load plan data safely (relation may be inconsistent)
    let plan = null;
    if (sub.planId) {
      plan = await prisma.plan.findUnique({
        where: { id: sub.planId },
        select: { id: true, name: true, mongoCategoryId: true, mongoPlanId: true }
      });
    }

    if (!plan || !isSalesPlan(plan)) continue;

    // Fix subscription.product if not SALES
  if (sub.product !== 'SALES') {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { product: 'SALES' }
      });
      updatedSubs++;
    }

    // Ensure ProductAccess has SALES exactly once
  const hasSales = await prisma.productAccess.findFirst({ where: { userId: sub.userId, product: 'SALES' } });
    if (!hasSales) {
      // Delete SERVICE access if present
      await prisma.productAccess.deleteMany({ where: { userId: sub.userId, product: 'SERVICE' } });
      await prisma.productAccess.create({ data: { userId: sub.userId, product: 'SALES' } });
      updatedAccess++;
    }
  }

  console.log(`✅ Done. Updated subscriptions: ${updatedSubs}, fixed product access: ${updatedAccess}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });

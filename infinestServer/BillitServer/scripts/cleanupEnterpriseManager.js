/**
 * cleanupEnterpriseManager.js
 *
 * Safely removes the deprecated "Enterprise" and "Manager" plan categories
 * (and their plans + features) from BOTH databases:
 *   - MongoDB (billit_db):  Plan, PlanCategory, Feature collections
 *   - MySQL   (CommonDB):   Plan table (only rows tied to those categories)
 *
 * Safety:
 *   - Aborts deletion of any plan that still has an ACTIVE subscription
 *     in MySQL (so existing customer data is never broken).
 *   - Aborts deletion of any plan whose mongoPlanId is referenced by a
 *     MongoDB Role document.
 *   - DRY-RUN by default: prints what it WOULD delete. Pass --apply to
 *     actually delete.
 *
 * Run from BillitServer:
 *   node scripts/cleanupEnterpriseManager.js           # dry run (preview)
 *   node scripts/cleanupEnterpriseManager.js --apply   # actually delete
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const path = require('path');
const mongoose = require('mongoose');
const { Plan, PlanCategory, Role } = require('../models/mongoModels');

// Feature model — declared inline because vpsSeederSimple defines it that way too
const Feature =
  mongoose.models.Feature ||
  mongoose.model(
    'Feature',
    new mongoose.Schema(
      {
        plan_id: { type: String, required: true },
        feature_key: { type: String, required: true },
        type: { type: String, enum: ['boolean', 'limit'], required: true },
        enabled: { type: Boolean },
        config: mongoose.Schema.Types.Mixed,
        description: { type: String },
      },
      { timestamps: true }
    )
  );

// MySQL via Prisma (CommonDB)
let prisma = null;
try {
  const { PrismaClient } = require(path.join(
    __dirname,
    '../../CommonDB/node_modules/@prisma/client'
  ));
  prisma = new PrismaClient();
} catch (err) {
  console.warn('⚠️  Could not load Prisma client from CommonDB:', err.message);
  console.warn('    MySQL cleanup will be skipped. Mongo cleanup will still run.\n');
}

const MONGO_URI =
  process.env.BILLIT_MONGO_URI ||
  process.env.MONGO_URI ||
  'mongodb://127.0.0.1:27017/billit_db';

const DEAD_CATEGORIES = ['Enterprise', 'Manager'];
const DEAD_PLAN_IDS = [
  'enterprise-basic',
  'enterprise-gold',
  'enterprise-premium',
  // Defensive: in case any legacy manager-* plan exists
  'manager-basic',
  'manager-premium',
];
// Features for plans that were referenced in old seeder but never existed
const DEAD_FEATURE_PLAN_IDS = ['sales-gold', 'service-gold'];

const APPLY = process.argv.includes('--apply');

function header(t) {
  console.log(`\n══════════════ ${t} ══════════════`);
}

async function main() {
  console.log(
    `\n🧹  Cleanup ${APPLY ? '(APPLY MODE — will delete!)' : '(DRY RUN — no changes)'}\n`
  );

  // ── Connect MongoDB ─────────────────────────────────────────────────────
  await mongoose.connect(MONGO_URI);
  console.log('✅  Connected to MongoDB');

  // ── Step 1: gather all plan IDs that match dead criteria ────────────────
  const planDocs = await Plan.find({
    $or: [
      { _id: { $in: DEAD_PLAN_IDS } },
      { category_id: { $in: DEAD_CATEGORIES } },
    ],
  }).lean();

  const planIds = planDocs.map((p) => p._id);
  header('Mongo plans matched for removal');
  if (!planIds.length) {
    console.log('   (none)');
  } else {
    planDocs.forEach((p) =>
      console.log(`   • ${p._id.padEnd(22)} category=${p.category_id}  name=${p.name}`)
    );
  }

  // ── Step 2: safety check — any Mongo Role pointing to these plans? ──────
  let blockingRoles = [];
  if (planIds.length) {
    blockingRoles = await Role.find({ mongoPlanId: { $in: planIds } })
      .select('mysql_user_id mongoPlanId mongoCategoryId')
      .lean();
  }

  header('Mongo Role references (must be 0 to delete)');
  if (blockingRoles.length) {
    blockingRoles.forEach((r) =>
      console.log(
        `   ⛔ user=${r.mysql_user_id}  plan=${r.mongoPlanId}  category=${r.mongoCategoryId}`
      )
    );
  } else {
    console.log('   ✅  No Role documents reference these plans.');
  }

  // ── Step 3: safety check — any MySQL Subscription active on these? ──────
  let blockingSubs = [];
  let mysqlPlanRows = [];
  if (prisma) {
    try {
      mysqlPlanRows = await prisma.plan.findMany({
        where: {
          OR: [
            { mongoCategoryId: { in: DEAD_CATEGORIES } },
            { mongoPlanId: { in: DEAD_PLAN_IDS } },
          ],
        },
      });
      header('MySQL plan rows matched for removal');
      if (!mysqlPlanRows.length) {
        console.log('   (none)');
      } else {
        mysqlPlanRows.forEach((p) =>
          console.log(
            `   • ${p.id}  name=${p.name}  mongoPlanId=${p.mongoPlanId}  category=${p.mongoCategoryId}`
          )
        );
      }

      if (mysqlPlanRows.length) {
        const mysqlPlanIds = mysqlPlanRows.map((p) => p.id);
        blockingSubs = await prisma.subscription.findMany({
          where: { planId: { in: mysqlPlanIds } },
          select: { id: true, userId: true, planId: true, status: true },
        });
        header('MySQL Subscription references (must be 0 to delete)');
        if (blockingSubs.length) {
          blockingSubs.forEach((s) =>
            console.log(
              `   ⛔ sub=${s.id}  user=${s.userId}  plan=${s.planId}  status=${s.status}`
            )
          );
        } else {
          console.log('   ✅  No Subscription rows reference these plans.');
        }
      }
    } catch (err) {
      console.warn('⚠️  MySQL check failed:', err.message);
      console.warn('    Aborting — fix DB connection first.');
      await mongoose.disconnect();
      process.exit(1);
    }
  }

  // ── Step 4: decide whether to proceed ───────────────────────────────────
  const blocked = blockingRoles.length > 0 || blockingSubs.length > 0;
  if (blocked) {
    header('RESULT');
    console.log(
      '❌  Cleanup aborted — some records still reference these plans.'
    );
    console.log(
      '    Migrate / cancel those subscriptions before re-running this script.'
    );
    await mongoose.disconnect();
    if (prisma) await prisma.$disconnect();
    process.exit(1);
  }

  if (!APPLY) {
    header('RESULT (dry run)');
    console.log('✅  Safe to delete. Re-run with  --apply  to actually remove.');
    console.log('\n    Mongo will delete:');
    console.log(`      - ${planDocs.length} Plan document(s)`);
    console.log(`      - ${DEAD_CATEGORIES.length} PlanCategory document(s) (Enterprise, Manager)`);
    console.log(
      `      - Feature documents for plan_ids: ${[
        ...DEAD_PLAN_IDS,
        ...DEAD_FEATURE_PLAN_IDS,
      ].join(', ')}`
    );
    if (prisma) {
      console.log(`    MySQL will delete:`);
      console.log(`      - ${mysqlPlanRows.length} Plan row(s)`);
    }
    await mongoose.disconnect();
    if (prisma) await prisma.$disconnect();
    process.exit(0);
  }

  // ── Step 5: APPLY ───────────────────────────────────────────────────────
  header('APPLYING DELETIONS');

  if (planIds.length) {
    const r = await Plan.deleteMany({ _id: { $in: planIds } });
    console.log(`   🗑  Mongo Plan: deleted ${r.deletedCount}`);
  }

  const rCat = await PlanCategory.deleteMany({ _id: { $in: DEAD_CATEGORIES } });
  console.log(`   🗑  Mongo PlanCategory: deleted ${rCat.deletedCount}`);

  const rFeat = await Feature.deleteMany({
    plan_id: { $in: [...DEAD_PLAN_IDS, ...DEAD_FEATURE_PLAN_IDS] },
  });
  console.log(`   🗑  Mongo Feature: deleted ${rFeat.deletedCount}`);

  if (prisma && mysqlPlanRows.length) {
    const mysqlPlanIds = mysqlPlanRows.map((p) => p.id);
    const rMy = await prisma.plan.deleteMany({
      where: { id: { in: mysqlPlanIds } },
    });
    console.log(`   🗑  MySQL Plan: deleted ${rMy.count}`);
  }

  header('DONE');
  console.log('✅  Cleanup complete.\n');

  await mongoose.disconnect();
  if (prisma) await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('\n❌  Cleanup failed:', err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  if (prisma) {
    try {
      await prisma.$disconnect();
    } catch (_) {}
  }
  process.exit(1);
});

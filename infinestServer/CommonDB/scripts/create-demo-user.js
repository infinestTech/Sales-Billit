/**
 * create-demo-user.js
 *
 * Interactively creates a demo/test user account with a custom subscription
 * end date, bypassing Razorpay payment entirely.
 *
 * Run from the CommonDB directory:
 *   node scripts/create-demo-user.js
 *
 * Note: MongoDB user profile (Role/Shop) is created automatically on first login.
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const readline = require('readline');
const bcrypt   = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ─── Derive product + access grants from mongoCategoryId ──────────────────────
// Combo plans are stored as product="BILLIT" (SERVICE subscription) in MySQL,
// and separately granted SALES ProductAccess — mirroring the payment flow.
function planMeta(mongoCategoryId) {
  if (mongoCategoryId === 'Sales_Service') return { product: 'BILLIT', access: ['BILLIT', 'SALES'] };
  if (mongoCategoryId === 'Sales')         return { product: 'SALES',  access: ['SALES']           };
  // Service / anything else
  return { product: 'BILLIT', access: ['BILLIT'] };
}

// ─── Readline helpers ─────────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const ask = (question) =>
  new Promise((resolve) => rl.question(question, (ans) => resolve(ans)));

/** Keeps prompting until a non-empty value is entered. */
const askRequired = async (label) => {
  let value = '';
  while (!value.trim()) {
    value = await ask(`  ${label}: `);
    if (!value.trim()) console.log(`  ⚠  ${label} is required.\n`);
  }
  return value.trim();
};

/** Prompts for a password without echoing the characters (Windows-safe fallback). */
const askPassword = async () => {
  // readline on Windows doesn't support muting natively; show a warning instead.
  console.log('  ⚠  Password will be visible while typing on this terminal.\n');
  return askRequired('Password');
};

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║      Infinest  –  Demo Account Creator    ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  // ── Load plans from MySQL at runtime ─────────────────────────────────────
  const dbPlans = await prisma.plan.findMany({
    where: { mongoPlanId: { not: null } },
    orderBy: { createdAt: 'asc' },
  }).catch(() => []);

  if (!dbPlans.length) {
    rl.close();
    console.error('❌  No plans found in the database.');
    console.error('    Run  npm run db:seed:plans  from the CommonDB directory first, then retry.\n');
    process.exit(1);
  }

  // Enrich each DB plan with product/access metadata derived from category
  const PLANS = dbPlans.map((p, i) => {
    const { product, access } = planMeta(p.mongoCategoryId);
    const priceLabel = `₹${Number(p.price)}/${p.duration === 'YEARLY' ? 'yr' : 'mo'}`;
    return { num: i + 1, dbPlan: p, mongoPlanId: p.mongoPlanId, mongoCategoryId: p.mongoCategoryId, name: p.name, price: priceLabel, product, access };
  });

  // ── Step 1: User details ──────────────────────────────────────────────────
  console.log('[ Step 1 / 3 ]  User Details\n');

  const email    = await askRequired('Email');
  const name     = await askRequired('Full Name');

  const usernameRaw = (await ask('  Username  (leave blank → auto-generated from email): ')).trim();
  const username = usernameRaw || email.split('@')[0];

  const phoneRaw = (await ask('  Phone      (optional – press Enter to skip): ')).trim();
  const phone    = phoneRaw || null;

  const password = await askPassword();

  // ── Step 2: Plan selection ────────────────────────────────────────────────
  console.log('\n[ Step 2 / 3 ]  Subscription Plan\n');
  console.log('  #   Plan Name                       Price        Category');
  console.log('  ─   ────────────────────────────    ─────────    ──────────────');
  PLANS.forEach(({ num, name: n, price, mongoCategoryId }) => {
    console.log(`  ${num}   ${n.padEnd(36)}${price.padEnd(13)}${mongoCategoryId}`);
  });
  console.log('');

  let selectedPlan = null;
  while (!selectedPlan) {
    const input = (await ask(`  Select plan [1-${PLANS.length}]: `)).trim();
    const num   = parseInt(input, 10);
    selectedPlan = PLANS.find((p) => p.num === num);
    if (!selectedPlan) console.log(`  ⚠  Please enter a number between 1 and ${PLANS.length}.\n`);
  }

  // ── Step 3: Subscription end date ────────────────────────────────────────
  console.log('\n[ Step 3 / 3 ]  Subscription End Date\n');
  console.log('  Enter a future date  →  YYYY-MM-DD   (e.g. 2026-12-31)');
  console.log('  OR enter days        →  a number     (e.g. 90 = 90 days from today)\n');

  let endDate = null;
  while (!endDate) {
    const input = (await ask('  End date or days: ')).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      const d = new Date(`${input}T23:59:59.000Z`);
      if (isNaN(d.getTime()))    { console.log('  ⚠  Not a valid date.\n'); continue; }
      if (d <= new Date())       { console.log('  ⚠  Date must be in the future.\n'); continue; }
      endDate = d;
    } else if (/^\d+$/.test(input)) {
      const days = parseInt(input, 10);
      if (days <= 0) { console.log('  ⚠  Must be greater than 0.\n'); continue; }
      endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    } else {
      console.log('  ⚠  Enter a date (YYYY-MM-DD) or a number of days.\n');
    }
  }

  // ── Confirmation ──────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────');
  console.log('  Review before creating:');
  console.log(`  Email     : ${email}`);
  console.log(`  Name      : ${name}`);
  console.log(`  Username  : ${username}`);
  console.log(`  Phone     : ${phone ?? '(none)'}`);
  console.log(`  Plan      : ${selectedPlan.name}  (${selectedPlan.mongoPlanId})`);
  console.log(`  Access    : ${selectedPlan.access.join(' + ')}`);
  console.log(`  Expires   : ${endDate.toISOString().split('T')[0]}`);
  console.log('─────────────────────────────────────────────────────\n');

  const confirm = (await ask('  Proceed? (y/n): ')).trim().toLowerCase();
  rl.close();

  if (confirm !== 'y' && confirm !== 'yes') {
    console.log('\n  Aborted. No changes were made.\n');
    process.exit(0);
  }

  // ── Create account ────────────────────────────────────────────────────────
  console.log('\n  Creating account...\n');

  try {
    // Check for duplicates
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(phone ? [{ phone }] : []),
        ],
      },
    });

    if (existing) {
      console.error(`❌  A user already exists with email "${email}"${phone ? ` or phone "${phone}"` : ''}.`);
      process.exit(1);
    }

    // Plan was already confirmed to exist in DB (loaded from DB above)
    const plan = selectedPlan.dbPlan;

    // 1. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 2. Create User
    const user = await prisma.user.create({
      data: {
        username,
        email,
        phone,
        password: hashedPassword,
        name,
      },
    });
    console.log(`  ✅  User created          → ${user.id}`);

    // 3. Create Subscription
    const subscription = await prisma.subscription.create({
      data: {
        userId:  user.id,
        planId:  plan.id,
        product: selectedPlan.product,
        status:  'ACTIVE',
        endDate,
      },
    });
    console.log(`  ✅  Subscription created   → ${subscription.id}  (expires ${endDate.toISOString().split('T')[0]})`);

    // 4. Link subscription to user
    await prisma.user.update({
      where: { id: user.id },
      data:  { subscriptionId: subscription.id },
    });

    // 5. Create ProductAccess rows
    for (const product of selectedPlan.access) {
      await prisma.productAccess.create({ data: { userId: user.id, product } });
      console.log(`  ✅  Product access granted → ${product}`);
    }

    // 6. Audit log
    await prisma.subscriptionLog.create({
      data: {
        userId:         user.id,
        subscriptionId: subscription.id,
        action:         'SUBSCRIPTION_STARTED',
        message:        `Demo account created manually via create-demo-user.js. Plan: ${selectedPlan.name}.`,
        metadata: {
          createdBy:       'create-demo-user.js',
          mongoPlanId:     selectedPlan.mongoPlanId,
          mongoCategoryId: selectedPlan.mongoCategoryId,
          endDate:         endDate.toISOString(),
          noPayment:       true,
        },
      },
    });
    console.log('  ✅  Subscription log recorded');

    // ── Done ──────────────────────────────────────────────────────────────
    console.log('\n╔═════════════════════════════════════════════════╗');
    console.log('║   ✅  Demo Account Created Successfully!         ║');
    console.log('╚═════════════════════════════════════════════════╝');
    console.log(`\n  Email    : ${email}`);
    console.log(`  Password : ${password}`);
    console.log(`  Plan     : ${selectedPlan.name}`);
    console.log(`  Access   : ${selectedPlan.access.join(' + ')}`);
    console.log(`  Expires  : ${endDate.toISOString().split('T')[0]}`);
    console.log('\n  ℹ  MongoDB profile (Role/Shop) is created automatically on the user\'s first login.\n');

  } catch (err) {
    console.error('\n❌  Failed to create account:', err.message);
    if (err.code === 'P2002') {
      const field = err.meta?.target ?? 'unknown field';
      console.error(`    Duplicate value on: ${field}`);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});

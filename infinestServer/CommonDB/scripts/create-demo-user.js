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

// ─── Plan definitions ─────────────────────────────────────────────────────────
// Each entry maps to a MySQL Plan row (looked up by mongoPlanId at runtime).
// 'product'  → stored in Subscription.product (used by access-check endpoints)
// 'access'   → ProductAccess rows to create (Prisma enum: BILLIT | SALES | SERVICE | FUTURE_PRODUCT)
const PLANS = [
  { num: 1, mongoPlanId: 'service-basic',           name: 'Service Trial',          mongoCategoryId: 'Service',       price: '₹99/mo',   product: 'BILLIT', access: ['BILLIT'] },
  { num: 2, mongoPlanId: 'service-premium',          name: 'Service Premium',         mongoCategoryId: 'Service',       price: '₹499/mo',  product: 'BILLIT', access: ['BILLIT'] },
  { num: 3, mongoPlanId: 'service-premium-yearly',   name: 'Service Premium Yearly',  mongoCategoryId: 'Service',       price: '₹4990/yr', product: 'BILLIT', access: ['BILLIT'] },
  { num: 4, mongoPlanId: 'sales-basic',              name: 'Sales Trial',             mongoCategoryId: 'Sales',         price: '₹99/mo',   product: 'SALES',  access: ['SALES']  },
  { num: 5, mongoPlanId: 'sales-premium',            name: 'Sales Premium',           mongoCategoryId: 'Sales',         price: '₹499/mo',  product: 'SALES',  access: ['SALES']  },
  { num: 6, mongoPlanId: 'sales-premium-yearly',     name: 'Sales Premium Yearly',    mongoCategoryId: 'Sales',         price: '₹4990/yr', product: 'SALES',  access: ['SALES']  },
  { num: 7, mongoPlanId: 'combo-premium',            name: 'Combo (Service + Sales)', mongoCategoryId: 'Sales_Service', price: '₹899/mo',  product: 'BILLIT', access: ['BILLIT', 'SALES'] },
  { num: 8, mongoPlanId: 'combo-premium-yearly',     name: 'Combo Yearly',            mongoCategoryId: 'Sales_Service', price: '₹8990/yr', product: 'BILLIT', access: ['BILLIT', 'SALES'] },
];

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
      // ISO date string
      const d = new Date(`${input}T23:59:59.000Z`);
      if (isNaN(d.getTime()))    { console.log('  ⚠  Not a valid date.\n'); continue; }
      if (d <= new Date())       { console.log('  ⚠  Date must be in the future.\n'); continue; }
      endDate = d;
    } else if (/^\d+$/.test(input)) {
      // Number of days
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

    // Resolve MySQL plan row
    const plan = await prisma.plan.findFirst({ where: { mongoPlanId: selectedPlan.mongoPlanId } });
    if (!plan) {
      console.error(`❌  Plan "${selectedPlan.mongoPlanId}" not found in the database.`);
      console.error('    Run  npm run db:seed:plans  from the CommonDB directory first.');
      process.exit(1);
    }

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

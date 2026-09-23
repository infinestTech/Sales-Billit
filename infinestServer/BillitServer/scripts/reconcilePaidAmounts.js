/**
 * Migration Script: Reconcile Paid Amounts
 * Fixes Mobile records where paid_amount/total_paid was edited directly (e.g. via the shop-admin
 * "All Records" inline edit, before payments[] reconciliation existed) without updating the
 * underlying payments[] split-payment history. This left "Payment Breakdown" views (which sum
 * payments[]) out of sync with the Paid Amount column (which reads total_paid/paid_amount).
 *
 * Run once with: node scripts/reconcilePaidAmounts.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Mobile } = require('../models/mongoModels');

function reconcilePayments(existingPayments, newTotal, fallbackMethod) {
    const payments = Array.isArray(existingPayments) ? existingPayments.map(p => ({ ...(p.toObject ? p.toObject() : p) })) : [];
    if (payments.length === 0) {
        if (newTotal > 0) payments.push({ amount: newTotal, method: fallbackMethod || 'Cash', date: new Date() });
    } else if (payments.length === 1) {
        payments[0].amount = newTotal;
    } else {
        const currentTotal = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const delta = newTotal - currentTotal;
        const lastIdx = payments.length - 1;
        payments[lastIdx].amount = Math.max(0, (Number(payments[lastIdx].amount) || 0) + delta);
    }
    return payments;
}

async function reconcilePaidAmounts() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(process.env.BILLIT_MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const mobiles = await Mobile.find({});
        console.log(`📋 Scanning ${mobiles.length} mobile records`);

        let fixed = 0;
        for (const mobile of mobiles) {
            const target = Number(mobile.paid_amount || mobile.total_paid || 0);
            const paymentsSum = Array.isArray(mobile.payments)
                ? mobile.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
                : 0;

            if (paymentsSum === target && Number(mobile.total_paid || 0) === target) continue;

            mobile.payments = reconcilePayments(mobile.payments, target, mobile.payment);
            mobile.total_paid = target;
            mobile.paid_amount = target;
            await mobile.save();

            console.log(`✅ Reconciled: ${mobile._id} -> ₹${target} (was payments sum ₹${paymentsSum})`);
            fixed++;
        }

        console.log(`\n🎉 Reconciled ${fixed} mobile record(s) out of ${mobiles.length}`);
    } catch (err) {
        console.error('❌ Reconciliation failed:', err);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

reconcilePaidAmounts();

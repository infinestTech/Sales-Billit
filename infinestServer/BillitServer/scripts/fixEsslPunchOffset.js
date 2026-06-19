/**
 * fixEsslPunchOffset.js
 *
 * One-time / repeatable migration to add a fixed time offset (in minutes) to
 * every eSSL punch and the derived attendance rows for ONE device.
 *
 * Use this when an eSSL M20 has been recording wrong-timezone timestamps
 * (e.g. UTC instead of IST) and you want to correct the historical data so
 * reports look right.
 *
 * Run from BillitServer:
 *   # Preview (dry-run, no writes) — shifts everything from device SN by +330m:
 *   node scripts/fixEsslPunchOffset.js --sn EUF7250700029 --offset 330
 *
 *   # Actually apply:
 *   node scripts/fixEsslPunchOffset.js --sn EUF7250700029 --offset 330 --apply
 *
 *   # Only fix punches created since a date (recommended — avoid touching old
 *   # correct data):
 *   node scripts/fixEsslPunchOffset.js --sn EUF7250700029 --offset 330 \
 *        --since 2026-06-01 --apply
 *
 * Tables updated:
 *   - EsslPunchLog.punch_time
 *   - Attendance.check_in_time / check_out_time   (where source = 'essl_m20')
 *   - HrPunch.punch_time                          (where source = 'ESSL_M20')
 *   - HrDailyAttendance.check_in_time / check_out_time (where source = 'ESSL_M20')
 *
 * Idempotency: NOT idempotent.  Running twice shifts by 2x.  Use --since to
 * scope the run, and only run --apply once per dataset.
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const {
  EsslDevice,
  EsslPunchLog,
  Attendance,
  HrPunch,
  HrDailyAttendance,
} = require('../models/mongoModels');

function parseArgs() {
  const args = { apply: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--sn') args.sn = argv[++i];
    else if (a === '--offset') args.offset = parseInt(argv[++i], 10);
    else if (a === '--since') args.since = argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs();
  if (!args.sn) {
    console.error('Usage: node scripts/fixEsslPunchOffset.js --sn <DEVICE_SN> --offset <MINUTES> [--since YYYY-MM-DD] [--apply]');
    process.exit(1);
  }
  if (!Number.isFinite(args.offset) || args.offset === 0) {
    console.error('Error: --offset must be a non-zero integer (minutes).');
    process.exit(1);
  }

  const mongoUri = process.env.BILLIT_MONGO_URI || process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('Error: BILLIT_MONGO_URI / MONGO_URI / MONGODB_URI not set in .env');
    process.exit(1);
  }

  console.log(`\n--- eSSL Punch Time Offset Migration ---`);
  console.log(`Device SN : ${args.sn}`);
  console.log(`Offset    : ${args.offset} minutes (${(args.offset / 60).toFixed(2)} hours)`);
  console.log(`Since     : ${args.since || '(all history)'}`);
  console.log(`Mode      : ${args.apply ? 'APPLY (writes will be performed)' : 'DRY-RUN (no writes)'}`);
  console.log(`-----------------------------------------\n`);

  await mongoose.connect(mongoUri);

  const device = await EsslDevice.findOne({ device_serial: args.sn });
  if (!device) {
    console.error(`No device found with SN=${args.sn}`);
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`Device found: shop_id=${device.shop_id}  name="${device.device_name}"`);

  const offsetMs = args.offset * 60 * 1000;
  const sinceDate = args.since ? new Date(`${args.since}T00:00:00Z`) : null;

  // ── 1. EsslPunchLog ────────────────────────────────────────────────────────
  const punchQuery = { device_serial: args.sn };
  if (sinceDate) punchQuery.punch_time = { $gte: sinceDate };
  const punchCount = await EsslPunchLog.countDocuments(punchQuery);
  console.log(`EsslPunchLog rows to shift : ${punchCount}`);

  // ── 2. Attendance (legacy, source=essl_m20) ────────────────────────────────
  const attQuery = { shop_id: device.shop_id, source: 'essl_m20' };
  if (sinceDate) attQuery.check_in_time = { $gte: sinceDate };
  const attCount = await Attendance.countDocuments(attQuery);
  console.log(`Attendance rows to shift   : ${attCount}`);

  // ── 3. HrPunch (source=ESSL_M20) ───────────────────────────────────────────
  const hrQuery = { shop_id: device.shop_id, source: 'ESSL_M20' };
  if (sinceDate) hrQuery.punch_time = { $gte: sinceDate };
  const hrCount = await HrPunch.countDocuments(hrQuery);
  console.log(`HrPunch rows to shift      : ${hrCount}`);

  // ── 4. HrDailyAttendance (source=ESSL_M20) ─────────────────────────────────
  const hrDailyQuery = { shop_id: device.shop_id, source: 'ESSL_M20' };
  if (sinceDate) hrDailyQuery.check_in_time = { $gte: sinceDate };
  const hrDailyCount = await HrDailyAttendance.countDocuments(hrDailyQuery);
  console.log(`HrDailyAttendance rows     : ${hrDailyCount}`);

  if (!args.apply) {
    console.log(`\nDRY-RUN complete. Re-run with --apply to perform writes.\n`);
    await mongoose.disconnect();
    return;
  }

  console.log(`\nApplying writes...`);

  // Mongo cannot do field += offset on Date types in updateMany without
  // aggregation pipelines — use $set with $add and $toDate (Mongo 4.2+).
  async function shiftDates(Model, filter, fields) {
    const pipeline = [{
      $set: Object.fromEntries(fields.map(f => [
        f,
        {
          $cond: [
            { $ifNull: [`$${f}`, false] },
            { $toDate: { $add: [{ $toLong: `$${f}` }, offsetMs] } },
            null,
          ],
        },
      ])),
    }];
    const r = await Model.updateMany(filter, pipeline);
    return r.modifiedCount || r.nModified || 0;
  }

  const r1 = await shiftDates(EsslPunchLog,     punchQuery,    ['punch_time']);
  console.log(`  EsslPunchLog       shifted: ${r1}`);

  const r2 = await shiftDates(Attendance,       attQuery,      ['check_in_time', 'check_out_time']);
  console.log(`  Attendance         shifted: ${r2}`);

  const r3 = await shiftDates(HrPunch,          hrQuery,       ['punch_time']);
  console.log(`  HrPunch            shifted: ${r3}`);

  const r4 = await shiftDates(HrDailyAttendance, hrDailyQuery, ['check_in_time', 'check_out_time']);
  console.log(`  HrDailyAttendance  shifted: ${r4}`);

  console.log(`\nDone.\n`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});

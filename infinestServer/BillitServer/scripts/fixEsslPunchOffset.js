/**
 * fixEsslPunchOffset.js
 *
 * Repair migration: add a fixed time offset (in minutes) to every eSSL punch
 * from ONE device in a time window, then rebuild the derived attendance rows.
 *
 * Use this when an eSSL M20 has been recording wrong-timezone timestamps
 * (e.g. UTC instead of IST — the old TimeZone=0 handshake) and you want to
 * correct the historical data so reports look right.
 *
 * Run from BillitServer:
 *   # Preview (dry-run, no writes):
 *   node scripts/fixEsslPunchOffset.js --sn EUF7250700029 --offset 330 \
 *        --since 2026-10-01 --until "2026-10-30 10:30"
 *
 *   # Actually apply:
 *   node scripts/fixEsslPunchOffset.js --sn EUF7250700029 --offset 330 \
 *        --since 2026-10-01 --until "2026-10-30 10:30" --apply
 *
 * --since / --until are IST ("YYYY-MM-DD" or "YYYY-MM-DD HH:mm") and compare
 * against the STORED (wrong) punch_time.  --until is required: set it to the
 * moment the fixed server went live so correct punches after it stay untouched.
 *
 * Rows updated:
 *   - EsslPunchLog.punch_time                       (this device)
 *   - Attendance check_in/out_time + date           (legacy, source = 'essl_m20')
 *   - HrPunch.punch_time + date                     (source = 'ESSL_M20')
 *   - HrDailyAttendance                             rebuilt from the shifted
 *     HrPunch rows (times, lateness, deduction, day pay); manual overrides kept
 *
 * Attendance / HrPunch are matched by the device's shop.  If that shop has
 * another device whose punches were already correct, do not run this.
 *
 * Idempotency: NOT idempotent.  Running twice on the same window shifts by 2x.
 * Salary records already generated for the affected months must be
 * regenerated afterwards.
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const moment = require('moment-timezone');
const {
  EsslDevice,
  EsslPunchLog,
  Attendance,
  Employee,
  HrPunch,
  HrDailyAttendance,
} = require('../models/mongoModels');
const { formatIST } = require('../utils/dateHelper');
const {
  getShopHrSettings, attendanceDateFor, buildDailySummary, applyManualStatus,
} = require('../controllers/hrController');

const IST_TZ = 'Asia/Kolkata';

function parseArgs() {
  const args = { apply: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--sn') args.sn = argv[++i];
    else if (a === '--offset') args.offset = parseInt(argv[++i], 10);
    else if (a === '--since') args.since = argv[++i];
    else if (a === '--until') args.until = argv[++i];
  }
  return args;
}

function parseIST(str) {
  const m = moment.tz(str, ['YYYY-MM-DD HH:mm', 'YYYY-MM-DD'], true, IST_TZ);
  return m.isValid() ? m.toDate() : null;
}

async function main() {
  const args = parseArgs();
  const usage = 'Usage: node scripts/fixEsslPunchOffset.js --sn <DEVICE_SN> --offset <MINUTES> --until "YYYY-MM-DD HH:mm" [--since YYYY-MM-DD] [--apply]';
  if (!args.sn || !args.until) {
    console.error(usage);
    process.exit(1);
  }
  if (!Number.isFinite(args.offset) || args.offset === 0) {
    console.error('Error: --offset must be a non-zero integer (minutes).');
    process.exit(1);
  }
  const sinceDate = args.since ? parseIST(args.since) : null;
  const untilDate = parseIST(args.until);
  if ((args.since && !sinceDate) || !untilDate) {
    console.error('Error: --since / --until must be "YYYY-MM-DD" or "YYYY-MM-DD HH:mm" (IST).');
    process.exit(1);
  }

  const mongoUri = process.env.BILLIT_MONGO_URI || process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('Error: BILLIT_MONGO_URI not set in .env');
    process.exit(1);
  }

  console.log(`\n--- eSSL Punch Time Offset Migration ---`);
  console.log(`Device SN : ${args.sn}`);
  console.log(`Offset    : ${args.offset} minutes (${(args.offset / 60).toFixed(2)} hours)`);
  console.log(`Window    : ${sinceDate ? formatIST(sinceDate) : '(all history)'} → ${formatIST(untilDate)} IST (stored times)`);
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
  const window = sinceDate ? { $gte: sinceDate, $lt: untilDate } : { $lt: untilDate };

  const punchQuery = { device_serial: args.sn, punch_time: window };
  const attQuery = { shop_id: device.shop_id, source: 'essl_m20', check_in_time: window };
  const hrQuery = { shop_id: device.shop_id, source: 'ESSL_M20', punch_time: window };

  const [punchCount, attCount, hrCount] = await Promise.all([
    EsslPunchLog.countDocuments(punchQuery),
    Attendance.countDocuments(attQuery),
    HrPunch.countDocuments(hrQuery),
  ]);
  console.log(`EsslPunchLog rows to shift : ${punchCount}`);
  console.log(`Attendance rows to shift   : ${attCount}`);
  console.log(`HrPunch rows to shift      : ${hrCount}`);

  const sample = await EsslPunchLog.find(punchQuery).sort({ punch_time: -1 }).limit(5).lean();
  for (const p of sample) {
    console.log(`  e.g. ${formatIST(p.punch_time)} → ${formatIST(new Date(p.punch_time.getTime() + offsetMs))}`);
  }

  if (!args.apply) {
    console.log(`\nDRY-RUN complete. Re-run with --apply to perform writes.\n`);
    await mongoose.disconnect();
    return;
  }

  console.log(`\nApplying writes...`);

  // ── 1. EsslPunchLog ────────────────────────────────────────────────────────
  const r1 = await EsslPunchLog.updateMany(punchQuery, [
    { $set: { punch_time: { $add: ['$punch_time', offsetMs] } } },
  ]);
  console.log(`  EsslPunchLog       shifted: ${r1.modifiedCount}`);

  // ── 2. Attendance (legacy) — times and the IST date they fall on ───────────
  const attRows = await Attendance.find(attQuery).lean();
  let attShifted = 0;
  for (const row of attRows) {
    const checkIn = new Date(row.check_in_time.getTime() + offsetMs);
    const update = { check_in_time: checkIn, date: formatIST(checkIn, 'YYYY-MM-DD') };
    if (row.check_out_time) update.check_out_time = new Date(row.check_out_time.getTime() + offsetMs);
    try {
      await Attendance.updateOne({ _id: row._id }, { $set: update });
      attShifted++;
    } catch (err) {
      console.warn(`  Attendance ${row._id} (${row.date} → ${update.date}) not moved: ${err.message}`);
    }
  }
  console.log(`  Attendance         shifted: ${attShifted}`);

  // ── 3. HrPunch — times and attendance date ─────────────────────────────────
  const hrRows = await HrPunch.find(hrQuery).lean();
  const employees = new Map();
  const hrSettings = await getShopHrSettings(device.shop_id);
  const touchedDays = new Set();
  for (const row of hrRows) {
    const key = row.employee_id.toString();
    if (!employees.has(key)) employees.set(key, await Employee.findById(row.employee_id).lean());
    const employee = employees.get(key);
    const punchTime = new Date(row.punch_time.getTime() + offsetMs);
    const date = employee ? attendanceDateFor(punchTime, employee, hrSettings) : row.date;
    if (date !== row.date) {
      console.warn(`  HrPunch ${row._id} moves day ${row.date} → ${date}; check that employee's days by hand.`);
    }
    await HrPunch.updateOne({ _id: row._id }, { $set: { punch_time: punchTime, date } });
    touchedDays.add(`${key}|${date}`);
  }
  console.log(`  HrPunch            shifted: ${hrRows.length}`);

  // ── 4. HrDailyAttendance — rebuilt from the corrected punches ──────────────
  let rebuilt = 0;
  for (const dayKey of touchedDays) {
    const [empId, date] = dayKey.split('|');
    const employee = employees.get(empId);
    if (!employee) continue;
    const [punches, existingDay] = await Promise.all([
      HrPunch.find({ employee_id: employee._id, date }).lean(),
      HrDailyAttendance.findOne({ employee_id: employee._id, date }).select('status manual_override').lean(),
    ]);
    const summary = buildDailySummary(employee, punches, hrSettings, date);
    if (existingDay?.manual_override) applyManualStatus(summary, existingDay.status, employee);

    // Keep the check-in punch's own late flag in step with the day.
    const checkIn = punches
      .filter(p => p.punch_type === 'CHECK_IN')
      .sort((a, b) => a.punch_time - b.punch_time)[0];
    if (checkIn) {
      await HrPunch.updateOne(
        { _id: checkIn._id },
        { $set: { is_late: summary.is_late, late_minutes: summary.late_minutes } }
      );
    }

    await HrDailyAttendance.findOneAndUpdate(
      { employee_id: employee._id, date },
      { $set: { shop_id: device.shop_id, ...summary, updated_at: new Date() } },
      { upsert: true }
    );
    rebuilt++;
  }
  console.log(`  HrDailyAttendance  rebuilt: ${rebuilt}`);

  console.log(`\nDone. Regenerate salary for the affected months.\n`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});

/**
 * ADMS Controller — eSSL M20 / ZKTeco Biometric Device Integration
 *
 * Implements the ADMS (Automatic Data Master Server) protocol that eSSL / ZKTeco
 * devices use to communicate with a cloud server over HTTP/HTTPS.
 *
 * Protocol flow:
 *  1. Device sends GET /iclock/cdata?SN=<serial>&options=all  → server returns config
 *  2. Device pushes POST /iclock/cdata?SN=<serial>&table=ATTLOG → server stores punches
 *  3. Device polls GET /iclock/getrequest?SN=<serial>          → server sends commands
 *  4. Device ACKs  POST /iclock/devicecmd?SN=<serial>          → server marks cmd done
 *
 * Security notes:
 *  - Device serial is validated against registered EsslDevice documents.
 *  - An optional shared HMAC secret (ADMS_DEVICE_SECRET env var) can be used for
 *    extra verification on the initial handshake.
 *  - Biometric verify-type codes are stored for audit only and are NEVER returned
 *    to any frontend API.
 *  - All inputs are sanitised; ATTLOG lines are parsed strictly.
 */

'use strict';

const crypto = require('crypto');
const moment = require('moment-timezone');
const { EsslDevice, EsslPunchLog, Employee, Attendance, Shop } = require('../models/mongoModels');
const { formatIST } = require('../utils/dateHelper');
const { processPunch } = require('./hrController');

const IST_TZ = 'Asia/Kolkata';

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Determine punch type from the InOutCode field in ATTLOG.
 * Reference: ZKTeco ADMS documentation §4.2
 *
 * NOTE: Many eSSL M20 devices have no F1..F4 in/out keys configured, so they
 * always send InOutCode = 0 (or always 1) for every fingerprint punch.  In that
 * case we return 'auto' and the HR layer decides check_in / check_out based on
 * punch order for the day.
 */
function resolvePunchType(inOutCode) {
  switch (String(inOutCode).trim()) {
    case '0': return 'check_in';
    case '1': return 'check_out';
    case '4': return 'break_out';
    case '5': return 'break_in';
    case '2': return 'overtime_in';
    case '3': return 'overtime_out';
    default:  return 'unknown';
  }
}

/**
 * Parse a single raw ATTLOG line.
 * Format: PIN\tDateTime\tVerifyCode\tInOutCode\tReserved\tWorkCode
 * Returns null if the line is malformed.
 *
 * IMPORTANT: The device sends the timestamp in its local timezone (IST for us).
 * Node's `new Date("YYYY-MM-DD HH:MM:SS")` parses that string as the host
 * server's local time — and Hetzner is in Europe (UTC+1/UTC+2).  We therefore
 * explicitly parse the string in Asia/Kolkata so the stored UTC instant is
 * correct regardless of where the server lives.
 */
function parseAttLogLine(line) {
  if (!line || !line.trim()) return null;
  const parts = line.trim().split('\t');
  if (parts.length < 4) return null;

  const [pin, dateTimeStr, verifyCode, inOutCode] = parts;
  if (!pin || !dateTimeStr) return null;

  if (!/^\d{1,10}$/.test(pin.trim())) return null;

  // Parse "YYYY-MM-DD HH:MM:SS" or "YYYY/MM/DD HH:MM:SS" as IST wall-clock time.
  const normalised = dateTimeStr.trim().replace(/\//g, '-');
  const m = moment.tz(normalised, ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD HH:mm'], true, IST_TZ);
  if (!m.isValid()) return null;
  const punchTime = m.toDate();

  return {
    device_pin: pin.trim(),
    punch_time: punchTime,
    verify_type: parseInt(verifyCode, 10) || 0,
    punch_type: resolvePunchType(inOutCode),
    raw_line: line.trim(),
  };
}

/**
 * Convert a punch datetime to an IST date string (YYYY-MM-DD).
 * Matches the format stored in the Attendance schema.
 */
function punchDateString(punchTime) {
  return formatIST(punchTime, 'YYYY-MM-DD');
}

/**
 * Verify HMAC signature when ADMS_DEVICE_SECRET is set.
 * The device SN is used as the message; the signature is expected in
 * the X-Device-Signature header (hex encoded HMAC-SHA256).
 */
function verifyDeviceSignature(sn, signature) {
  const secret = process.env.ADMS_DEVICE_SECRET;
  if (!secret) return true; // Signature check disabled when secret not configured
  if (!signature) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(sn)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
}

// ─── Handshake / Heartbeat ─────────────────────────────────────────────────────

/**
 * GET /iclock/cdata?SN=<serial>&options=all
 *
 * Initial contact from device. Server responds with configuration options
 * in the plain-text ADMS format the device expects.
 */
async function handleHandshake(req, res) {
  try {
    const sn = (req.query.SN || '').trim();
    if (!sn) return res.status(400).send('ERROR: Missing SN\n');

    // Optional HMAC verification
    if (!verifyDeviceSignature(sn, req.headers['x-device-signature'])) {
      return res.status(403).send('ERROR: Invalid signature\n');
    }

    // Lookup registered device
    const device = await EsslDevice.findOne({ device_serial: sn });
    if (!device) {
      // Device not yet registered — auto-register if ADMS_AUTO_REGISTER=true
      if (process.env.ADMS_AUTO_REGISTER === 'true') {
        await EsslDevice.create({
          shop_id: null, // Will be linked manually via shop-admin settings
          device_serial: sn,
          device_name: 'eSSL M20 (pending)',
          last_seen: new Date(),
          last_activity: 'Auto-registered on first contact',
          is_active: false, // Inactive until linked to a shop
        });
      }
      // Return minimal response — device cannot push data until linked to a shop
      return res.status(200).send(
        `GET OPTION FROM:${sn}\nATTLOGStamp=0\nErrorDelay=30\nDelay=60\nRealtime=1\nEncrypt=0\n`
      );
    }

    if (!device.is_active) {
      return res.status(403).send('ERROR: Device is disabled\n');
    }

    // Update heartbeat
    device.last_seen = new Date();
    device.last_activity = 'Heartbeat';
    if (req.query.pushver) device.firmware_version = req.query.pushver;
    // Persist the current ATTLOG stamp so we don't re-send all history on reconnect.
    // We advance the stamp AFTER each successful push (see handleDataPush).
    await device.save();

    // Respond with configuration.
    //
    // Date=<IST>  ← CRITICAL: explicitly sync the device clock to current IST.
    //   Without this the eSSL M20 auto-syncs from Hetzner NTP (UTC+0/UTC+2)
    //   and its display clock shifts to European time.  Providing Date= forces
    //   the device to set its RTC to our IST wall-clock on every heartbeat.
    //
    // TimeZone=0  ← tell the device the server is UTC+0.
    //   The iClock Proxy firmware ADDS the TimeZone value to the device's local
    //   display time before putting it in the ATTLOG.  If we set TimeZone=5.5
    //   (IST offset), the device adds another 5.5 h on top of its already-IST
    //   clock, giving IST+11h which is totally wrong.  With TimeZone=0 the
    //   firmware sends the raw device-clock value (IST), which our parser then
    //   correctly interprets as Asia/Kolkata.
    //
    // ATTLOGStamp — use last_seen epoch so the device only sends NEW records
    //   after every reconnect instead of replaying the entire history.
    //   On first connection (no stamp) we use 0 to get all-time history once.
    const attlogStamp = device.attlog_stamp || 0;
    const istNow = moment().tz(IST_TZ).format('YYYY-MM-DD HH:mm:ss');
    const response = [
      `GET OPTION FROM:${sn}`,
      `ATTLOGStamp=${attlogStamp}`,
      'OperLogStamp=9999',
      'ErrorDelay=30',
      'Delay=10',
      'TransTimes=00:00;14:05',
      'TransInterval=1',
      'TransFlag=TransData AttLog',
      'TimeZone=0',
      `Date=${istNow}`,
      'Realtime=1',
      'Encrypt=0',
    ].join('\n') + '\n';

    return res.status(200).send(response);
  } catch (err) {
    console.error('[ADMS handshake] Error:', err);
    return res.status(500).send('ERROR: Internal server error\n');
  }
}

// ─── Attendance Data Push ──────────────────────────────────────────────────────

/**
 * POST /iclock/cdata?SN=<serial>&table=ATTLOG&Stamp=<timestamp>
 *
 * Device pushes raw attendance records. Body is plain-text with one
 * ATTLOG line per row. Server parses, validates, stores punch logs,
 * and upserts Attendance records.
 */
async function handleDataPush(req, res) {
  try {
    const sn = (req.query.SN || '').trim();
    const table = (req.query.table || '').trim().toUpperCase();

    if (!sn) return res.status(400).send('ERROR: Missing SN\n');

    if (!verifyDeviceSignature(sn, req.headers['x-device-signature'])) {
      return res.status(403).send('ERROR: Invalid signature\n');
    }

    const device = await EsslDevice.findOne({ device_serial: sn, is_active: true });
    if (!device || !device.shop_id) {
      return res.status(403).send('ERROR: Device not registered or not linked to a shop\n');
    }

    // Only handle ATTLOG pushes
    if (table !== 'ATTLOG') {
      // Acknowledge other tables (OPERLOG, etc.) without processing
      return res.status(200).send('OK\n');
    }

    const rawBody = typeof req.body === 'string' ? req.body : req.body?.toString?.() || '';
    const lines = rawBody.split('\n').filter(Boolean);

    // Fetch employees for this shop once and build a pin→employee map
    const employees = await Employee.find({ shop_id: device.shop_id }).lean();
    const pinMap = {};
    employees.forEach(e => {
      if (e.device_pin) pinMap[e.device_pin] = e;
    });

    let accepted = 0;
    let skipped = 0;

    for (const line of lines) {
      const parsed = parseAttLogLine(line);
      if (!parsed) { skipped++; continue; }

      const employee = pinMap[parsed.device_pin] || null;

      // Many M20 devices send the same InOutCode for every fingerprint scan.
      // Defer the real classification to the HR layer and derive a useful value
      // for the legacy Attendance row below.
      const deviceClaimsCheckIn  = parsed.punch_type === 'check_in';
      const deviceClaimsCheckOut = parsed.punch_type === 'check_out';

      // Store raw punch log (even for unknown PINs for later reconciliation).
      // We persist the device's claim so audit logs are honest; the HR/Attendance
      // tables get the *resolved* punch type computed from punch order below.
      const punchLog = await EsslPunchLog.create({
        shop_id: device.shop_id,
        device_serial: sn,
        device_pin: parsed.device_pin,
        employee_id: employee?._id || undefined,
        punch_time: parsed.punch_time,
        punch_type: parsed.punch_type,
        verify_type: parsed.verify_type, // audit only, never exposed to frontend
        raw_line: parsed.raw_line,
        processed: false,
      });

      if (!employee) { skipped++; continue; }

      // Derive attendance date
      const dateStr = punchDateString(parsed.punch_time);

      // Upsert Attendance record for that date.
      // Resolution rule: if no row yet for today → first punch is check_in.
      // Otherwise → it's a check_out (overwrites any existing check_out so the
      // last punch of the day wins).
      try {
        const existing = await Attendance.findOne({
          employee_id: employee._id,
          date: dateStr,
        });

        if (!existing) {
          await Attendance.create({
            shop_id: device.shop_id,
            employee_id: employee._id,
            date: dateStr,
            status: 'present',
            locked: false,
            source: 'essl_m20',
            check_in_time: parsed.punch_time,
          });
        } else {
          const update = { source: 'essl_m20' };
          // First punch ever for this day filled check_in; everything after is check_out.
          if (!existing.check_in_time) {
            update.check_in_time = parsed.punch_time;
          } else {
            update.check_out_time = parsed.punch_time;
          }
          await Attendance.findByIdAndUpdate(existing._id, { $set: update });
        }

        // Mark punch log as processed
        await EsslPunchLog.findByIdAndUpdate(punchLog._id, { processed: true });

        // Feed into HR daily attendance system (non-blocking).
        // overridePunchType=null lets processPunch decide via its state machine.
        processPunch(
          device.shop_id.toString(),
          employee._id.toString(),
          'ESSL_M20',
          null,
          parsed.punch_time,
        ).catch(err => console.error('[ADMS] HR processPunch error:', err.message));

        accepted++;
      } catch (dbErr) {
        console.error('[ADMS push] DB error for punch:', dbErr.message);
        skipped++;
      }
    }

    // Update device activity and advance the ATTLOG stamp so the device won't
    // re-send the same records on the next push.  We use the epoch (seconds)
    // of the last accepted punch as the new stamp.
    device.last_seen = new Date();
    device.last_activity = `Received ${accepted} punch(es)`;
    if (accepted > 0) {
      // Stamp = seconds since Unix epoch of "now" (device uses this as a cursor).
      device.attlog_stamp = Math.floor(Date.now() / 1000);
    }
    await device.save();

    // ADMS protocol response: "OK\n<number_accepted>"
    return res.status(200).send(`OK\n${accepted}\n`);
  } catch (err) {
    console.error('[ADMS data push] Error:', err);
    return res.status(500).send('ERROR: Internal server error\n');
  }
}

// ─── Command Polling ───────────────────────────────────────────────────────────

/**
 * GET /iclock/getrequest?SN=<serial>
 *
 * Device polls for pending commands. Currently we have no command queue,
 * so we always respond with an empty OK. This handler is present for
 * protocol completeness and future extensibility (e.g., time sync, reboot).
 */
async function handleGetRequest(req, res) {
  try {
    const sn = (req.query.SN || '').trim();
    if (!sn) return res.status(400).send('ERROR: Missing SN\n');

    const device = await EsslDevice.findOne({ device_serial: sn });
    if (device) {
      device.last_seen = new Date();
      await device.save();
    }

    // No pending commands
    return res.status(200).send('OK\n');
  } catch (err) {
    console.error('[ADMS getrequest] Error:', err);
    return res.status(500).send('ERROR: Internal server error\n');
  }
}

// ─── Command Acknowledgment ────────────────────────────────────────────────────

/**
 * POST /iclock/devicecmd?SN=<serial>
 *
 * Device acknowledges a command previously returned by getrequest.
 */
async function handleDeviceCmd(req, res) {
  try {
    const sn = (req.query.SN || '').trim();
    if (!sn) return res.status(400).send('ERROR: Missing SN\n');
    // Acknowledge
    return res.status(200).send('OK\n');
  } catch (err) {
    console.error('[ADMS devicecmd] Error:', err);
    return res.status(500).send('ERROR: Internal server error\n');
  }
}

// ─── Shop Admin API helpers ────────────────────────────────────────────────────

/**
 * GET /api/shop-admin/essl/devices  (called from shop-admin portal)
 * Returns device info for current shop.
 */
async function getDevicesForShop(shopId) {
  return EsslDevice.find({ shop_id: shopId }).select('-__v').lean();
}

/**
 * GET /api/shop-admin/essl/punch-logs  (called from shop-admin portal)
 * Returns recent raw punch logs for a shop. verify_type is excluded.
 */
async function getPunchLogsForShop(shopId, limit = 100) {
  const logs = await EsslPunchLog.find({ shop_id: shopId })
    .select('-verify_type -raw_line -__v')
    .sort({ punch_time: -1 })
    .limit(limit)
    .populate('employee_id', 'employee_name name mobile_number device_pin')
    .lean();

  // Compute the resolved punch type per (employee, date) by punch order.
  // Odd-indexed punch = check_in, even-indexed = check_out (1st, 3rd, 5th... in,
  // 2nd, 4th, 6th... out).  This matches the HR state machine.
  // We need to scan ALL punches for each (employee, day) appearing in the
  // returned slice, so build the day-keys first then fetch the full day.
  const dayKeys = new Set();
  for (const l of logs) {
    if (!l.employee_id?._id) continue;
    const d = formatIST(l.punch_time, 'YYYY-MM-DD');
    dayKeys.add(`${l.employee_id._id}|${d}`);
  }

  const indexByLogId = new Map();
  for (const key of dayKeys) {
    const [empId, date] = key.split('|');
    const dayStart = require('moment-timezone').tz(date, 'YYYY-MM-DD', 'Asia/Kolkata').startOf('day').toDate();
    const dayEnd   = require('moment-timezone').tz(date, 'YYYY-MM-DD', 'Asia/Kolkata').endOf('day').toDate();
    const allDay = await EsslPunchLog.find({
      shop_id: shopId,
      employee_id: empId,
      punch_time: { $gte: dayStart, $lte: dayEnd },
    }).sort({ punch_time: 1 }).select('_id punch_time').lean();
    allDay.forEach((p, idx) => {
      indexByLogId.set(p._id.toString(), idx % 2 === 0 ? 'check_in' : 'check_out');
    });
  }

  return logs.map(l => ({
    ...l,
    // Resolved type used by the UI; falls back to device's claim for unlinked PINs.
    punch_type: l.employee_id?._id
      ? (indexByLogId.get(l._id.toString()) || l.punch_type)
      : l.punch_type,
  }));
}

module.exports = {
  handleHandshake,
  handleDataPush,
  handleGetRequest,
  handleDeviceCmd,
  getDevicesForShop,
  getPunchLogsForShop,
};

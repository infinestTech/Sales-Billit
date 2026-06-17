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
const { EsslDevice, EsslPunchLog, Employee, Attendance, Shop } = require('../models/mongoModels');
const { formatIST } = require('../utils/dateHelper');

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Determine punch type from the InOutCode field in ATTLOG.
 * Reference: ZKTeco ADMS documentation §4.2
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
 */
function parseAttLogLine(line) {
  if (!line || !line.trim()) return null;
  const parts = line.trim().split('\t');
  if (parts.length < 4) return null;

  const [pin, dateTimeStr, verifyCode, inOutCode] = parts;
  if (!pin || !dateTimeStr) return null;

  // Sanitise PIN — digits only (max 10 chars)
  if (!/^\d{1,10}$/.test(pin.trim())) return null;

  // Parse datetime: "YYYY-MM-DD HH:MM:SS" or "YYYY/MM/DD HH:MM:SS"
  const normalised = dateTimeStr.trim().replace(/\//g, '-');
  const punchTime = new Date(normalised);
  if (isNaN(punchTime.getTime())) return null;

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
    await device.save();

    // Respond with configuration
    // ATTLOGStamp=0 tells the device to send ALL records; in production you would
    // track the highest stamp and send that value so the device only sends new records.
    const response = [
      `GET OPTION FROM:${sn}`,
      'ATTLOGStamp=0',
      'OperLogStamp=0',
      'ErrorDelay=30',
      'Delay=10',
      'TransTimes=00:00;14:05',
      'TransInterval=1',
      'TransFlag=TransData AttLog OpLog EnrollUser',
      'TimeZone=5.5',
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

      // Store raw punch log (even for unknown PINs for later reconciliation)
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

      // Upsert Attendance record for that date
      try {
        const existing = await Attendance.findOne({
          employee_id: employee._id,
          date: dateStr,
        });

        if (!existing) {
          // First punch for this day → create as present
          await Attendance.create({
            shop_id: device.shop_id,
            employee_id: employee._id,
            date: dateStr,
            status: 'present',
            locked: false, // ADMS records remain unlocked so check-out can update them
            source: 'essl_m20',
            check_in_time: parsed.punch_type === 'check_in' ? parsed.punch_time : undefined,
            check_out_time: parsed.punch_type === 'check_out' ? parsed.punch_time : undefined,
          });
        } else {
          // Update check-in / check-out times on existing record
          const update = { source: 'essl_m20' };
          if (parsed.punch_type === 'check_in' && !existing.check_in_time) {
            update.check_in_time = parsed.punch_time;
          }
          if (parsed.punch_type === 'check_out') {
            update.check_out_time = parsed.punch_time;
          }
          await Attendance.findByIdAndUpdate(existing._id, { $set: update });
        }

        // Mark punch log as processed
        await EsslPunchLog.findByIdAndUpdate(punchLog._id, { processed: true });
        accepted++;
      } catch (dbErr) {
        console.error('[ADMS push] DB error for punch:', dbErr.message);
        skipped++;
      }
    }

    // Update device activity
    device.last_seen = new Date();
    device.last_activity = `Received ${accepted} punch(es)`;
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
  return EsslPunchLog.find({ shop_id: shopId })
    .select('-verify_type -raw_line -__v')
    .sort({ punch_time: -1 })
    .limit(limit)
    .populate('employee_id', 'employee_name mobile_number device_pin')
    .lean();
}

module.exports = {
  handleHandshake,
  handleDataPush,
  handleGetRequest,
  handleDeviceCmd,
  getDevicesForShop,
  getPunchLogsForShop,
};

/**
 * ADMS Routes — eSSL M20 Biometric Device Communication
 *
 * These routes are intentionally NOT protected by JWT because the eSSL M20
 * device does not support Bearer-token auth.  Security is provided by:
 *   1. HTTPS (TLS) in production — ensures data in transit is encrypted.
 *   2. Device serial number validation against EsslDevice collection.
 *   3. Optional HMAC-SHA256 signature (X-Device-Signature header) via
 *      ADMS_DEVICE_SECRET env variable.
 *   4. Rate limiting to mitigate flooding / enumeration attacks.
 *
 * Mount this router BEFORE express.json() so raw text bodies are available.
 */

'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  handleHandshake,
  handleDataPush,
  handleGetRequest,
  handleDeviceCmd,
} = require('../controllers/admsController');

const router = express.Router();

// ── Rate limiting ──────────────────────────────────────────────────────────────
// Devices heartbeat every ~10 s; allow generous burst.
// Malicious actors cannot flood the endpoint without hitting this limit.
const admsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,            // 2 req/s sustained — well above any single device need
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this address, please slow down.',
});

// ── Text body parser for ADMS ──────────────────────────────────────────────────
// The device sends plain-text ATTLOG data, not JSON.
// We need text/plain body parsing specifically for the data-push route.
const textBodyParser = express.text({ type: '*/*', limit: '512kb' });

// ── Routes ─────────────────────────────────────────────────────────────────────

// Handshake / heartbeat  — GET ?SN=<serial>&options=all
router.get('/cdata', admsLimiter, handleHandshake);

// Attendance data push   — POST ?SN=<serial>&table=ATTLOG
router.post('/cdata', admsLimiter, textBodyParser, handleDataPush);

// Command polling        — GET ?SN=<serial>
router.get('/getrequest', admsLimiter, handleGetRequest);

// Command acknowledgment — POST ?SN=<serial>
router.post('/devicecmd', admsLimiter, express.text({ type: '*/*' }), handleDeviceCmd);

module.exports = router;

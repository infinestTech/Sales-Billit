/**
 * MSG91 WhatsApp helper.
 *
 * Single entry-point: sendWaEvent({ shopId, event, to, vars })
 *
 *   - Loads the shop, checks `shop.whatsapp.enabled` and the per-event toggle.
 *   - Looks up the template name from env (MSG91_TPL_<EVENT>).
 *   - POSTs to MSG91 WhatsApp Bulk API.
 *   - Logs every attempt to WhatsAppLog (status: sent | skipped | error).
 *   - NEVER throws — caller can fire-and-forget. Returns { status, ... }.
 *
 * Required env vars (set by user later):
 *   MSG91_AUTH_KEY              — MSG91 auth key
 *   MSG91_INTEGRATED_NUMBER     — WhatsApp Business number registered with MSG91
 *   MSG91_NAMESPACE             — WhatsApp template namespace
 *   MSG91_LANG_CODE             — defaults to "en"
 *   MSG91_TPL_RECORD_CREATED
 *   MSG91_TPL_MOBILES_APPENDED
 *   MSG91_TPL_READY
 *   MSG91_TPL_DELIVERED
 *   MSG91_TPL_RETURNED
 *   MSG91_TPL_BALANCE_REMINDER
 */

const axios = require("axios");
const { Shop, WhatsAppLog } = require("../models/mongoModels");

const MSG91_URL =
  "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/";

const EVENT_TEMPLATE_ENV = {
  record_created: "MSG91_TPL_RECORD_CREATED",
  mobiles_appended: "MSG91_TPL_MOBILES_APPENDED",
  mobile_ready: "MSG91_TPL_READY",
  mobile_delivered: "MSG91_TPL_DELIVERED",
  mobile_returned: "MSG91_TPL_RETURNED",
  balance_reminder: "MSG91_TPL_BALANCE_REMINDER",
};

// Normalize to E.164 without "+", default country India (91) if 10 digits.
function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits; // pass through whatever the user stored
}

function buildBodyComponents(vars) {
  const components = {};
  Object.keys(vars || {}).forEach((key, idx) => {
    // MSG91 expects body_1, body_2, ... in order. Allow callers to either pass
    // an ordered object or already-named body_N keys.
    const isPositional = /^body_\d+$/.test(key);
    const componentKey = isPositional ? key : `body_${idx + 1}`;
    components[componentKey] = {
      type: "text",
      value: vars[key] == null ? "" : String(vars[key]),
    };
  });
  return components;
}

async function logAttempt(entry) {
  try {
    await WhatsAppLog.create(entry);
  } catch (err) {
    console.error("[msg91] log write failed:", err.message);
  }
}

/**
 * @param {Object} opts
 * @param {string|ObjectId} opts.shopId
 * @param {string} opts.event   — key in EVENT_TEMPLATE_ENV
 * @param {string} opts.to      — customer phone (any format)
 * @param {Object} opts.vars    — { name: 'X', amount: '500', ... } or { body_1: ... }
 * @returns {Promise<{status: 'sent'|'skipped'|'error', reason?: string, messageId?: string}>}
 */
async function sendWaEvent({ shopId, event, to, vars = {} }) {
  const base = { shop_id: shopId, event, to: String(to || ""), vars };

  if (!EVENT_TEMPLATE_ENV[event]) {
    const reason = `Unknown event '${event}'`;
    await logAttempt({ ...base, status: "skipped", error: reason });
    return { status: "skipped", reason };
  }

  const phone = normalizePhone(to);
  if (!phone) {
    const reason = "Invalid recipient phone";
    await logAttempt({ ...base, status: "skipped", error: reason });
    return { status: "skipped", reason };
  }

  let shop;
  try {
    shop = await Shop.findById(shopId).lean();
  } catch (err) {
    await logAttempt({ ...base, status: "error", error: err.message });
    return { status: "error", reason: err.message };
  }
  if (!shop) {
    const reason = "Shop not found";
    await logAttempt({ ...base, status: "skipped", error: reason });
    return { status: "skipped", reason };
  }

  const wa = shop.whatsapp || {};
  if (!wa.enabled) {
    const reason = "WhatsApp disabled for shop";
    await logAttempt({ ...base, status: "skipped", error: reason });
    return { status: "skipped", reason };
  }
  if (wa.events && wa.events[event] === false) {
    const reason = `Event '${event}' disabled for shop`;
    await logAttempt({ ...base, status: "skipped", error: reason });
    return { status: "skipped", reason };
  }

  const authKey = process.env.MSG91_AUTH_KEY;
  const integratedNumber = process.env.MSG91_INTEGRATED_NUMBER;
  const namespace = process.env.MSG91_NAMESPACE || null;
  const templateName = process.env[EVENT_TEMPLATE_ENV[event]];
  const langCode = process.env.MSG91_LANG_CODE || "en";

  if (!authKey || !integratedNumber || !templateName) {
    const reason = "MSG91 env vars not configured";
    await logAttempt({ ...base, status: "skipped", error: reason, template: templateName });
    return { status: "skipped", reason };
  }

  const payload = {
    integrated_number: integratedNumber,
    content_type: "template",
    payload: {
      messaging_product: "whatsapp",
      type: "template",
      template: {
        name: templateName,
        language: { code: langCode, policy: "deterministic" },
        namespace,
        to_and_components: [
          {
            to: [phone],
            components: buildBodyComponents(vars),
          },
        ],
      },
    },
  };

  try {
    const resp = await axios.post(MSG91_URL, payload, {
      headers: {
        authkey: authKey,
        "Content-Type": "application/json",
      },
      timeout: 8000,
    });
    const messageId =
      resp.data?.message_id ||
      resp.data?.data?.message_id ||
      resp.data?.requestId ||
      undefined;
    await logAttempt({
      ...base,
      status: "sent",
      template: templateName,
      message_id: messageId,
    });
    return { status: "sent", messageId };
  } catch (err) {
    const reason = err.response?.data
      ? JSON.stringify(err.response.data).slice(0, 500)
      : err.message;
    await logAttempt({
      ...base,
      status: "error",
      template: templateName,
      error: reason,
    });
    return { status: "error", reason };
  }
}

// Wrapper: call from request handlers without await; never blocks or throws.
function fireWaEvent(opts) {
  console.log(`[msg91] queued event=${opts.event} to=${opts.to} shopId=${opts.shopId}`);
  setImmediate(() => {
    sendWaEvent(opts)
      .then((r) => {
        console.log(`[msg91] result event=${opts.event} status=${r.status}${r.reason ? ` reason=${r.reason}` : ''}${r.messageId ? ` id=${r.messageId}` : ''}`);
      })
      .catch((err) => {
        console.error("[msg91] sendWaEvent unexpected error:", err);
      });
  });
}

module.exports = { sendWaEvent, fireWaEvent };

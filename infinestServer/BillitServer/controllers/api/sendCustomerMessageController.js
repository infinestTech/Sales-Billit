const mongoose = require("mongoose");
const { Customer, Dealer, Mobile, Shop } = require("../../models/mongoModels");
const { sendWaEvent, normalizePhone } = require("../../utils/msg91Whatsapp");

const MAX_MESSAGE_LENGTH = 1000;

// WhatsApp rejects template parameters containing new lines, tabs or more than 4 consecutive spaces
const toTemplateParam = (text) =>
  String(text)
    .replace(/\r?\n+/g, " ")
    .replace(/\t/g, " ")
    .replace(/ {4,}/g, "   ")
    .trim();

// India numbers must be 91 + a 10-digit mobile starting 6-9; other countries 11-15 digits
const isValidWhatsappNumber = (digits) =>
  /^\d{11,15}$/.test(digits) && (!digits.startsWith("91") || /^91[6-9]\d{9}$/.test(digits));

// Translates MSG91 / sendWaEvent outcomes into owner-friendly errors
const describeFailure = (result) => {
  const reason = String(result.reason || "");
  if (result.status === "skipped") {
    if (/disabled for shop/i.test(reason)) {
      return { http: 403, error: "WhatsApp messaging is not enabled for your shop. Please contact support to enable it." };
    }
    if (/env vars not configured/i.test(reason)) {
      return { http: 503, error: "WhatsApp service is not configured yet. Please contact support." };
    }
    if (/invalid recipient phone/i.test(reason)) {
      return { http: 400, error: "The customer's phone number is not a valid WhatsApp number." };
    }
    return { http: 400, error: "WhatsApp message was not sent." };
  }
  const status = result.httpStatus;
  if (status === 401 || status === 403 || /authkey|authenticat|unauthori[sz]ed/i.test(reason)) {
    return { http: 502, error: "WhatsApp service authentication failed. Please contact support." };
  }
  if (status === 429 || /rate.?limit|too many/i.test(reason)) {
    return { http: 429, error: "Too many WhatsApp messages right now. Please wait a minute and try again." };
  }
  if (/template/i.test(reason)) {
    return { http: 502, error: "The WhatsApp message template is not approved or does not match. Please contact support." };
  }
  if (!status) {
    return { http: 504, error: "Could not reach the WhatsApp service. Please check your connection and try again." };
  }
  return { http: 502, error: "WhatsApp service could not send the message. Please try again later." };
};

// POST /api/whatsapp/send-message { recordId, message, phone?, customerName? }
// The recipient is always the customer/dealer that owns the record in this shop;
// `phone` / `customerName` from the browser are not trusted for routing.
const sendCustomerMessage = async (req, res) => {
  try {
    const { recordId, message } = req.body || {};
    const shopId = req.user?.shop_id;

    if (!shopId) return res.status(401).json({ error: "Shop not found in your session. Please log in again." });
    if (!recordId || !mongoose.Types.ObjectId.isValid(recordId)) {
      return res.status(400).json({ error: "Invalid record." });
    }

    const text = typeof message === "string" ? toTemplateParam(message) : "";
    if (!text) return res.status(400).json({ error: "Please enter a message." });
    if (text.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).` });
    }

    const mobile = await Mobile.findOne({ _id: recordId, shop_id: shopId }).select("customer_id dealer_id").lean();
    if (!mobile) return res.status(404).json({ error: "Record not found." });

    let recipient = null;
    if (mobile.customer_id) {
      const customer = await Customer.findOne({ _id: mobile.customer_id, shop_id: shopId })
        .select("client_name mobile_number whatsapp_number")
        .lean();
      if (customer) {
        recipient = {
          name: customer.client_name,
          phone: (customer.whatsapp_number && customer.whatsapp_number.trim()) || customer.mobile_number,
        };
      }
    } else if (mobile.dealer_id) {
      const dealer = await Dealer.findOne({ _id: mobile.dealer_id, shop_id: shopId })
        .select("client_name mobile_number")
        .lean();
      if (dealer) recipient = { name: dealer.client_name, phone: dealer.mobile_number };
    }
    if (!recipient) return res.status(404).json({ error: "Customer for this record was not found." });
    if (!recipient.phone || !String(recipient.phone).trim()) {
      return res.status(400).json({ error: "This customer has no phone number saved." });
    }

    const phone = normalizePhone(recipient.phone);
    if (!phone || !isValidWhatsappNumber(phone)) {
      return res.status(400).json({ error: "The customer's phone number is not a valid WhatsApp number." });
    }

    const shop = await Shop.findById(shopId).select("shop_name owner_name phone").lean();
    if (!shop) return res.status(404).json({ error: "Shop not found." });

    // WhatsApp rejects empty template parameters, so each one needs a fallback
    const shopName = toTemplateParam(shop.shop_name || shop.owner_name || "") || "Our Service Center";
    const shopPhone = toTemplateParam(shop.phone || "") || "-";

    const result = await sendWaEvent({
      shopId,
      event: "customer_message",
      to: phone,
      // Template fixel_customer_message: {{1}} customer name, {{2}} owner's message, {{3}} shop name, {{4}} shop contact
      vars: {
        customer_name: toTemplateParam(recipient.name || "") || "Customer",
        message: text,
        shop_name: shopName,
        shop_phone: shopPhone,
      },
      logVars: { customer_name: recipient.name || "", record_id: String(recordId), message_length: text.length },
    });

    if (result.status === "sent") {
      return res.status(200).json({ success: true, message: "WhatsApp message sent successfully", messageId: result.messageId });
    }

    const { http, error } = describeFailure(result);
    console.warn(`[wa] customer_message not sent shop=${shopId} record=${recordId} status=${result.status} http=${result.httpStatus || "-"}`);
    return res.status(http).json({ success: false, error });
  } catch (err) {
    console.error("[wa] customer_message error:", err.message);
    return res.status(500).json({ success: false, error: "Something went wrong while sending the message." });
  }
};

module.exports = { sendCustomerMessage };

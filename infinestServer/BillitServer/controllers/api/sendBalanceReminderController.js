const { Customer, Dealer, Shop } = require("../../models/mongoModels");
const { sendWaEvent } = require("../../utils/msg91Whatsapp");

// POST /api/sendBalanceReminder { id, type }
// Manually trigger a WhatsApp balance-due reminder for a customer or dealer.
const sendBalanceReminder = async (req, res) => {
  const { id, type } = req.body;

  if (!id || !type) {
    return res.status(400).json({ error: "Missing id or type" });
  }
  if (!["Customer", "Dealer"].includes(type)) {
    return res.status(400).json({ error: "Invalid type" });
  }

  try {
    const Model = type === "Customer" ? Customer : Dealer;
    const record = await Model.findById(id).lean();
    if (!record) {
      return res.status(404).json({ error: `${type} not found` });
    }

    const shop = await Shop.findById(record.shop_id).lean();
    if (!shop) {
      return res.status(404).json({ error: "Shop not found" });
    }

    if (!record.balance_amount || record.balance_amount <= 0) {
      return res
        .status(400)
        .json({ error: "No outstanding balance for this record" });
    }

    const result = await sendWaEvent({
      shopId: shop._id,
      event: "balance_reminder",
      to: record.mobile_number,
      // {{1}} customer_name {{2}} shop_name {{3}} bill_no {{4}} balance_amount {{5}} shop_phone
      vars: {
        customer_name: record.client_name,
        shop_name: shop.shop_name || "",
        bill_no: record.bill_no || "-",
        balance_amount: String(record.balance_amount || 0),
        shop_phone: shop.phone || "",
      },
    });

    if (result.status === "sent") {
      return res.status(200).json({ message: "Reminder sent", ...result });
    }
    return res.status(202).json({ message: "Reminder not sent", ...result });
  } catch (err) {
    console.error("[wa] balance reminder error:", err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
};

module.exports = { sendBalanceReminder };

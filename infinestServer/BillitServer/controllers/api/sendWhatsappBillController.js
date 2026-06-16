const express = require("express");
const multer = require("multer");
const { Customer, Dealer, Shop } = require("../../models/mongoModels");
const { MessageMedia } = require("whatsapp-web.js");

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Make sure this client is globally available and initialized in your server setup
const whatsappClient = global.whatsappClient;

const sendWhatsappBill = async (req, res) => {
  try {
    const { clientId, clientType, shop_id } = req.body;
    const fileBuffer = req.file?.buffer;

    console.log("📩 Inputs received:", { clientId, clientType, shop_id });

    if (!clientId || !clientType || !shop_id || !fileBuffer) {
      return res.status(400).json({ error: "Missing required fields or PDF file." });
    }

    const Model = clientType === "Customer" ? Customer : Dealer;
    const client = await Model.findById(clientId);
    const shop = await Shop.findById(shop_id);

    if (!client || !shop || !shop.phone || !client.mobile_number) {
      return res.status(404).json({ error: "Client or Shop not valid." });
    }

    const base64Data = fileBuffer.toString("base64");
    const media = new MessageMedia("application/pdf", base64Data, "Receipt.pdf");

    const whatsappNumber = `91${client.mobile_number.replace(/\D/g, "").replace(/^0+/, "")}@c.us`;
    const introMessage = `Hi ${client.client_name}, here is your receipt from ${shop.shop_name}`;

    console.log("📤 Sending to:", whatsappNumber);

    await whatsappClient.sendMessage(whatsappNumber, introMessage);
    await whatsappClient.sendMessage(whatsappNumber, media);

    return res.status(200).json({ success: true, message: "WhatsApp PDF sent." });
  } catch (error) {
    console.error("❌ Error sending WhatsApp PDF:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  sendWhatsappBill,
  upload
};
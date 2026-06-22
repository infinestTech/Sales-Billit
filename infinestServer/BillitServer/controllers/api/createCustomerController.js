
const { Customer, Mobile, Shop } = require("../../models/mongoModels");
const moment = require("moment-timezone");
const { fireWaEvent } = require("../../utils/msg91Whatsapp");


// POST /api/createcustomer
const createCustomerController = async (req, res) => {
  try {
    const {
      clientName,
      mobileNumber,
      customerType,
      noOfMobile,
      billNo,
      balanceAmount,
      estimatedCost,
      MobileName,
      technicianname,
      technician,
      userId, // shop_id
      existingCustomerId, // if set, append mobiles to existing customer (no new record)
    } = req.body;

    const techName = technician || technicianname || "";

    if (!MobileName || !userId) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    // Validate every mobile entry has a mobile_name
    const invalidMobile = MobileName.findIndex((m) => !m.mobileName || !String(m.mobileName).trim())
    if (invalidMobile !== -1) {
      return res.status(400).json({ error: `Row ${invalidMobile + 1}: Mobile Name is required.` })
    }

    // --- APPEND TO EXISTING CUSTOMER -----------------------------------------
    if (existingCustomerId) {
      const existing = await Customer.findOne({ _id: existingCustomerId, shop_id: userId });
      if (!existing) {
        return res.status(404).json({ error: "Existing customer not found." });
      }

      const appendPromises = MobileName.map((mobile) => {
        const istDate = moment.tz(mobile.date, "Asia/Kolkata").startOf("day").toDate();
        return Mobile.create({
          shop_id: userId,
          customer_id: existing._id,
          mobile_name: mobile.mobileName,
          model: mobile.model || "",
          imei: mobile.imei || "",
          issue: mobile.issues || null,
          added_date: istDate,
          technician_name: techName,
        });
      });

      await Promise.all(appendPromises);

      existing.no_of_mobile = (existing.no_of_mobile || 0) + MobileName.length;
      if (estimatedCost !== undefined && estimatedCost !== null && estimatedCost !== "") {
        existing.estimated_cost = (existing.estimated_cost || 0) + Number(estimatedCost);
      }
      await existing.save();

      // Fire WA event: mobiles appended to existing customer
      try {
        const shopDoc = await Shop.findById(userId).lean();
        const mobileList = MobileName
          .map((m) => m.mobileName + (m.model ? ` ${m.model}` : ""))
          .join(", ");
        fireWaEvent({
          shopId: userId,
          event: "mobiles_appended",
          to: existing.mobile_number,
          vars: {
            customer_name: existing.client_name,
            shop_name: shopDoc?.shop_name || "",
            bill_no: existing.bill_no || "-",
            mobile_list: mobileList,
            shop_phone: shopDoc?.phone || "",
          },
        });
      } catch (waErr) {
        console.error("[wa] mobiles_appended trigger failed:", waErr.message);
      }

      return res.status(200).json({
        message: "Mobiles added to existing customer successfully.",
        customer: existing,
        appended: true,
      });
    }

    // --- CREATE NEW CUSTOMER --------------------------------------------------
    if (!clientName || !mobileNumber || !customerType) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const shop = await Shop.findById(userId);
    if (!shop) {
      return res.status(404).json({ error: "Shop not found." });
    }

    // Enforce record limit check
    if (shop.record_limit && shop.record_count >= shop.record_limit) {
      return res.status(403).json({
        error: "You have reached your plan's record limit. Please upgrade your plan to add more records."
      });
    }

    const customer = await Customer.create({
      shop_id: userId,
      client_name: clientName,
      mobile_number: mobileNumber,
      customer_type: customerType,
      no_of_mobile: noOfMobile,
      bill_no: billNo || null,
      balance_amount: balanceAmount || 0,
      estimated_cost: Number(estimatedCost) || 0,
    });

    const mobilePromises = MobileName.map((mobile) => {
      const istDate = moment.tz(mobile.date, "Asia/Kolkata").startOf("day").toDate();
      return Mobile.create({
        shop_id: userId,
        customer_id: customer._id,
        mobile_name: mobile.mobileName,
        model: mobile.model || "",
        imei: mobile.imei || "",
        issue: mobile.issues || null,
        added_date: istDate,
        technician_name: techName,
      });
    });

    await Promise.all(mobilePromises);

    // Increment record_count
    shop.record_count += 1;
    await shop.save();

    // Fire WA event: record created
    try {
      const mobileList = MobileName
        .map((m) => m.mobileName + (m.model ? ` ${m.model}` : ""))
        .join(", ");
      fireWaEvent({
        shopId: userId,
        event: "record_created",
        to: mobileNumber,
        vars: {
          customer_name: clientName,
          shop_name: shop.shop_name || "",
          bill_no: billNo || "-",
          mobile_list: mobileList,
          mobile_count: String(MobileName.length),
          estimated_cost: String(Number(estimatedCost) || 0),
          shop_phone: shop.phone || "",
        },
      });
    } catch (waErr) {
      console.error("[wa] record_created trigger failed:", waErr.message);
    }

    return res.status(201).json({
      message: "Customer and associated mobiles created successfully.",
      customer,
    });

  } catch (error) {
    console.error("Error creating customer:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
};


module.exports = { createCustomerController };

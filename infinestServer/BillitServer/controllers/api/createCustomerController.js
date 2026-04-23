

const { Customer, Mobile, Shop } = require("../../models/mongoModels");
const moment = require("moment-timezone");


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
      MobileName,
      technicianname,
      userId // shop_id
    } = req.body;


    if (!clientName || !mobileNumber || !customerType || !MobileName || !userId) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    // Validate every mobile entry has a mobile_name
    const invalidMobile = MobileName.findIndex((m) => !m.mobileName || !String(m.mobileName).trim())
    if (invalidMobile !== -1) {
      return res.status(400).json({ error: `Row ${invalidMobile + 1}: Mobile Name is required.` })
    }


    const shop = await Shop.findById(userId);
    if (!shop) {
      return res.status(404).json({ error: "Shop not found." });
    }


    // 🚩 Enforce record limit check
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
    });


    // Create related mobile records
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
        technician_name: technicianname || ""
      });
    });


    await Promise.all(mobilePromises);


    // 🚩 Increment record_count
    shop.record_count += 1;
    await shop.save();


    return res.status(201).json({
      message: "Customer and associated mobiles created successfully.",
      customer,
    });


  } catch (error) {
    console.error("❌ Error creating customer:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
};


module.exports = { createCustomerController };




const { Dealer, Mobile } = require("../../models/mongoModels");

// POST /api/updatedealer
const updateDealer = async (req, res) => {
  const { dealerId, noOfMobile, billNo, MobileName, technicianname, vendorName, vendorNumber } = req.body;

  try {
    // Validate required fields
    if (!dealerId || !noOfMobile || !billNo || !Array.isArray(MobileName)) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    // Find dealer
    const dealer = await Dealer.findById(dealerId);
    if (!dealer) {
      return res.status(404).json({ error: "Dealer not found." });
    }

    // Update dealer data
    dealer.no_of_mobile += noOfMobile;
    dealer.bill_no = billNo;

    // Add vendor details if provided
    if (vendorName && vendorNumber) {
      if (!dealer.vendors) {
        dealer.vendors = [];
      }
      dealer.vendors.push({
        vendor_name: vendorName,
        vendor_number: vendorNumber,
        mobile_count: Array.isArray(MobileName) ? MobileName.length : (parseInt(noOfMobile) || 0),
        created_at: new Date()
      });
    }

    await dealer.save();

    // Add mobile entries
    const mobilePromises = MobileName.map((mobile) => {
      if (!mobile.mobileName || !mobile.issues || !mobile.date) {
        throw new Error("Each mobile entry must have mobileName, issues, and date.");
      }

      return Mobile.create({
        shop_id: dealer.shop_id, // from dealer document
        dealer_id: dealer._id,
        mobile_name: mobile.mobileName,
        model: mobile.model || "",
        imei: mobile.imei || "",
        issue: mobile.issues,
        added_date: new Date(mobile.date),
        technician_name: technicianname,
      });
    });

    await Promise.all(mobilePromises);

    return res.status(201).json({
      message: "Dealer and associated mobiles updated successfully.",
    });
  } catch (error) {
    console.error("Error updating dealer:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
    });
  }
};

module.exports = { updateDealer };

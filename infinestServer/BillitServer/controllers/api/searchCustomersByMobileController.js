const { Customer } = require("../../models/mongoModels");

// POST /api/search-customers-by-mobile
// Returns existing customers whose mobile_number contains the search term
const searchCustomersByMobile = async (req, res) => {
  try {
    const { mobileNumber, userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId." });
    }

    if (!mobileNumber || mobileNumber.trim().length < 3) {
      return res.status(200).json({ customers: [] });
    }

    // Search for customers in this shop whose mobile number contains the query
    const customers = await Customer.find({
      shop_id: userId,
      mobile_number: { $regex: mobileNumber.trim(), $options: "i" },
    })
      .select("client_name mobile_number bill_no created_at")
      .sort({ created_at: -1 })
      .limit(8);

    // Deduplicate by mobile_number, keeping most recent entry per number
    const seen = new Map();
    for (const c of customers) {
      if (!seen.has(c.mobile_number)) {
        seen.set(c.mobile_number, {
          id: c._id,
          clientName: c.client_name,
          mobileNumber: c.mobile_number,
          lastBillNo: c.bill_no,
          lastVisit: c.created_at,
        });
      }
    }

    return res.status(200).json({ customers: Array.from(seen.values()) });
  } catch (error) {
    console.error("❌ Error searching customers by mobile:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
};

module.exports = { searchCustomersByMobile };

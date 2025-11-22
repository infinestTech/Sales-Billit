const { Customer, Dealer, Shop, Mobile } = require("../../models/mongoModels");

const viewReceiptController = async (req, res) => {
  try {
    const { id } = req.body;

    const mobile = await Mobile.findById(id).lean();
    if (!mobile) return res.status(404).json({ message: "Mobile not found" });

    const client =
      (mobile.customer_id && await Customer.findById(mobile.customer_id).lean()) ||
      (mobile.dealer_id && await Dealer.findById(mobile.dealer_id).lean());

    if (!client) return res.status(404).json({ message: "Client not found" });

    const shop = await Shop.findById(mobile.shop_id).lean();
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const mobileQuery = {
      shop_id: mobile.shop_id,
      ...(mobile.customer_id ? { customer_id: mobile.customer_id } : { dealer_id: mobile.dealer_id }),
    };

    let mobileList;
    if (mobile.bill_no) {
      mobileQuery.bill_no = mobile.bill_no;
      mobileList = await Mobile.find(mobileQuery).lean();
      if (mobileList.length === 0) {
        delete mobileQuery.bill_no;
        mobileList = await Mobile.find(mobileQuery).lean();
      }
    } else {
      mobileList = await Mobile.find(mobileQuery).lean();
    }

    const mobileRecords = mobileList.map((m) => ({
      mobile_name: m.mobile_name,
      issue: m.issue || "N/A",
      added_date: m.added_date || null,
      delivery_date: m.delivery_date || null,
      returned: m.returned || false,
      delivered: m.delivered || false,
      ready: m.ready || false,
  paid_amount: m.paid_amount || 0,
  _id: m._id, // Include ID for receipt links
    }));

    res.json({
      owner_name: shop.owner_name || "N/A",
      shop_name: shop.shop_name || shop.owner_name || "N/A", // Added shop_name
      shop_phone: shop.phone || "N/A",
      shop_email: shop.email || null, // Added shop_email
      shop_address: shop.address || null, // Added shop_address
      client_name: client.client_name || "N/A",
      mobile_number: client.mobile_number || "N/A",
      bill_no: client.bill_no || mobile.bill_no || "N/A",
      added_date: mobile.added_date || new Date(),
      MobileName: mobileRecords,
    });
  } catch (err) {
    console.error("❌ Error in viewReceiptController:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// NEW: Public version without authentication
const viewPublicReceiptController = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate the ID format (basic MongoDB ObjectId validation)
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid receipt ID format" });
    }

    const mobile = await Mobile.findById(id).lean();
    if (!mobile) return res.status(404).json({ message: "Receipt not found" });

    const client =
      (mobile.customer_id && await Customer.findById(mobile.customer_id).lean()) ||
      (mobile.dealer_id && await Dealer.findById(mobile.dealer_id).lean());

    if (!client) return res.status(404).json({ message: "Client not found" });

    const shop = await Shop.findById(mobile.shop_id).lean();
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const mobileQuery = {
      shop_id: mobile.shop_id,
      ...(mobile.customer_id ? { customer_id: mobile.customer_id } : { dealer_id: mobile.dealer_id }),
    };

    let mobileList;
    if (mobile.bill_no) {
      mobileQuery.bill_no = mobile.bill_no;
      mobileList = await Mobile.find(mobileQuery).lean();
      if (mobileList.length === 0) {
        delete mobileQuery.bill_no;
        mobileList = await Mobile.find(mobileQuery).lean();
      }
    } else {
      mobileList = await Mobile.find(mobileQuery).lean();
    }

    const mobileRecords = mobileList.map((m) => ({
      mobile_name: m.mobile_name,
      model: m.model || "",
      issue: m.issue || "N/A",
      added_date: m.added_date || null,
      delivery_date: m.delivery_date || null,
      returned: m.returned || false,
      delivered: m.delivered || false,
      ready: m.ready || false,
  paid_amount: m.paid_amount || 0,
  _id: m._id,
    }));

    // Return multiple possible address fields
    res.json({
      owner_name: shop.owner_name || "N/A",
      shop_name: shop.shop_name || shop.owner_name || "N/A",
      shop_phone: shop.phone || "N/A",
      shop_email: shop.email || null,
      shop_address: shop.address || null,
      location: shop.location || null, // Include location field
      address: shop.address || null,   // Include generic address field
      client_name: client.client_name || "N/A",
      mobile_number: client.mobile_number || "N/A",
      bill_no: client.bill_no || mobile.bill_no || "N/A",
      added_date: mobile.added_date || new Date(),
      MobileName: mobileRecords,
    });
  } catch (err) {
    console.error("❌ Error in viewPublicReceiptController:", err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { viewReceiptController, viewPublicReceiptController };
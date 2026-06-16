const { Customer, Mobile } = require("../../models/mongoModels");

const getCustomerBalances = async (req, res) => {
  const { shop_id } = req.body;

  if (!shop_id) {
    return res.status(400).json({ error: "Shop ID is required." });
  }

  try {
    // Fetch customers with balance > 0
    const customers = await Customer.find({
      shop_id,
      balance_amount: { $gt: 0 },
    }).select("client_name mobile_number balance_amount bill_no no_of_mobile")
      .lean();

    // Fetch mobiles for all customer IDs
    const customerIds = customers.map(c => c._id);
    const mobiles = await Mobile.find({
      customer_id: { $in: customerIds }
    }).select("mobile_name model issue added_date customer_id").lean();

    // Group mobiles by customer_id
    const mobilesByCustomer = {};
    mobiles.forEach(mobile => {
      const cid = mobile.customer_id.toString();
      if (!mobilesByCustomer[cid]) mobilesByCustomer[cid] = [];
      mobilesByCustomer[cid].push({
        mobileName: mobile.mobile_name,
        model: mobile.model,
        issue: mobile.issue,
        addedDate: mobile.added_date,
      });
    });

    // Merge mobiles into customers
    const result = customers.map(c => ({
      id: c._id,
      clientName: c.client_name,
      mobileNumber: c.mobile_number,
      balanceAmount: c.balance_amount,
      billNo: c.bill_no,
      noOfMobile: c.no_of_mobile,
      mobiles: mobilesByCustomer[c._id.toString()] || []
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching customer balances:", error);
    res.status(500).json({ error: "Failed to fetch customer balances." });
  }
};

module.exports = { getCustomerBalances };

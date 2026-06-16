const { Customer, Dealer, Mobile } = require("../../models/mongoModels");

const fetchAllData = async (req, res) => {
  const { shop_id } = req.body;

  if (!shop_id) {
    return res.status(400).json({ error: "Shop ID is required." });
  }

  try {
    // Fetch customers
    const customers = await Customer.find({ shop_id }).lean();
    const customerIds = customers.map(c => c._id);

    // Fetch dealers
    const dealers = await Dealer.find({ shop_id }).lean();
    const dealerIds = dealers.map(d => d._id);

    // Fetch all mobiles linked to those customers and dealers
    const mobiles = await Mobile.find({
      $or: [
        { customer_id: { $in: customerIds } },
        { dealer_id: { $in: dealerIds } }
      ]
    }).lean();

    // Group mobiles by customer_id
    const mobilesByCustomer = {};
    const mobilesByDealer = {};

    mobiles.forEach((m) => {
      if (m.customer_id) {
        const id = m.customer_id.toString();
        if (!mobilesByCustomer[id]) mobilesByCustomer[id] = [];
        mobilesByCustomer[id].push(m);
      }
      if (m.dealer_id) {
        const id = m.dealer_id.toString();
        if (!mobilesByDealer[id]) mobilesByDealer[id] = [];
        mobilesByDealer[id].push(m);
      }
    });

    // Merge mobiles into customers and dealers
    const customersWithMobiles = customers.map((c) => ({
      ...c,
      mobiles: mobilesByCustomer[c._id.toString()] || [],
    }));

    const dealersWithMobiles = dealers.map((d) => ({
      ...d,
      mobiles: mobilesByDealer[d._id.toString()] || [],
    }));

    return res.status(200).json({ customers: customersWithMobiles, dealers: dealersWithMobiles });
  } catch (error) {
    console.error("Error fetching data:", error.message);
    return res.status(500).json({ error: "Failed to fetch data. Please try again later." });
  }
};

module.exports = { fetchAllData };

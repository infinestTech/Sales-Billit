const { Dealer, Mobile } = require("../../models/mongoModels");

const getDealerBalances = async (req, res) => {
  const { shop_id } = req.body;

  if (!shop_id) {
    return res.status(400).json({ error: "Shop ID is required." });
  }

  try {
    // Get dealers with balance > 0
    const dealers = await Dealer.find({
      shop_id,
      balance_amount: { $gt: 0 }
    }).select("client_name mobile_number balance_amount no_of_mobile bill_no")
      .lean();

    const dealerIds = dealers.map(d => d._id);

    // Get related mobiles
    const mobiles = await Mobile.find({
      dealer_id: { $in: dealerIds }
    }).select("dealer_id mobile_name model issue ready delivered returned paid_amount").lean();

    // Group mobiles by dealer
    const mobilesByDealer = {};
    mobiles.forEach(m => {
      const did = m.dealer_id.toString();
      if (!mobilesByDealer[did]) mobilesByDealer[did] = [];
      mobilesByDealer[did].push({
        id: m._id,
        mobileName: m.mobile_name,
        model: m.model,
        issue: m.issue,
        ready: m.ready,
        delivered: m.delivered,
        returned: m.returned,
        paidAmount: m.paid_amount,
      });
    });

    // Combine dealer + mobiles
    const result = dealers.map(d => ({
      id: d._id,
      clientName: d.client_name,
      mobileNumber: d.mobile_number,
      balanceAmount: d.balance_amount,
      noOfMobile: d.no_of_mobile,
      billNo: d.bill_no,
      mobiles: mobilesByDealer[d._id.toString()] || []
    }));

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching dealer balances:", error);
    return res.status(500).json({ error: "Failed to fetch dealer balances." });
  }
};

module.exports = { getDealerBalances };

const { Customer, Dealer, Mobile, ProductHistory, Shop } = require("../../models/mongoModels");
const moment = require("moment-timezone");


const getTodayRecords = async (req, res) => {
  try {
    const { shop_id, userId } = req.body;
    const actualUserId = userId || shop_id;


    if (!actualUserId) {
      return res.status(400).json({ error: "Shop ID is required." });
    }


    const today = moment().tz("Asia/Kolkata");
    const startOfDay = today.startOf('day').toDate();
    const endOfDay = today.endOf('day').toDate();


    const todayRange = { $gte: startOfDay, $lte: endOfDay };

    // Revenue only needs mobiles that can contribute today: a payment dated today, or (legacy, no payments)
    // added/created today. The exact rule is still applied below, so this is a safe superset.
    const [mobiles, revenueMobiles, shopDoc] = await Promise.all([
      Mobile.find({
        shop_id: actualUserId,
        added_date: todayRange
      }).lean(),
      Mobile.find({
        shop_id: actualUserId,
        $or: [
          { "payments.date": todayRange },
          { added_date: todayRange },
          { created_at: todayRange }
        ]
      }).select("payments added_date created_at total_paid paid_amount").lean(),
      Shop.findById(actualUserId).select('revenue_visible_to_users').lean()
    ]);

    const customerIds = [...new Set(mobiles.filter((m) => m.customer_id).map((m) => String(m.customer_id)))];
    const dealerIds = [...new Set(mobiles.filter((m) => m.dealer_id).map((m) => String(m.dealer_id)))];

    const [customers, dealers] = await Promise.all([
      customerIds.length
        ? Customer.find({ shop_id: actualUserId, _id: { $in: customerIds } }).sort({ _id: 1 }).lean()
        : [],
      dealerIds.length
        ? Dealer.find({ shop_id: actualUserId, _id: { $in: dealerIds } }).sort({ _id: 1 }).lean()
        : []
    ]);


    const mobilesByCustomer = {};
    const mobilesByDealer = {};


    mobiles.forEach((m) => {
      if (m.customer_id) {
        if (!mobilesByCustomer[m.customer_id]) mobilesByCustomer[m.customer_id] = [];
        mobilesByCustomer[m.customer_id].push(m);
      }
      if (m.dealer_id) {
        if (!mobilesByDealer[m.dealer_id]) mobilesByDealer[m.dealer_id] = [];
        mobilesByDealer[m.dealer_id].push(m);
      }
    });


    let todayRevenue = 0;
    revenueMobiles.forEach((m) => {
      if (m.payments && m.payments.length > 0) {
        // Sum up all payments made today (regardless of when mobile was created)
        const todaysPayments = m.payments.filter(p => {
          const paymentDate = new Date(p.date);
          return paymentDate >= startOfDay && paymentDate <= endOfDay;
        });
        todayRevenue += todaysPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      } else {
        // Fallback for legacy data: if mobile was created today and has no payments array
        if (new Date(m.added_date || m.created_at) >= startOfDay && new Date(m.added_date || m.created_at) <= endOfDay) {
          todayRevenue += (m.total_paid || m.paid_amount || 0);
        }
      }
    });


    const records = [
      ...customers
        .filter((c) => mobilesByCustomer[c._id]?.length)
        .map((c) => ({
          id: c._id,
          clientName: c.client_name,
          mobileNumber: c.mobile_number,
          billNo: c.bill_no || "N/A",
          balanceAmount: c.balance_amount ?? 0,
          estimatedCost: c.estimated_cost ?? 0,
          createdAt: c.created_at,
          customerType: "Customer",
          mobiles: mobilesByCustomer[c._id]
        })),
      ...dealers
        .filter((d) => mobilesByDealer[d._id]?.length)
        .map((d) => ({
          id: d._id,
          clientName: d.client_name,
          mobileNumber: d.mobile_number,
          billNo: d.bill_no || "N/A",
          balanceAmount: d.balance_amount ?? 0,
          estimatedCost: d.estimated_cost ?? 0,
          createdAt: d.created_at,
          customerType: "Dealer",
          mobiles: mobilesByDealer[d._id]
        }))
    ];


    // Check if revenue is visible to users for this shop
    const revenueVisible = shopDoc?.revenue_visible_to_users !== false; // default true


    res.status(200).json({
      records,
      todayRevenue: revenueVisible ? todayRevenue : 0,
      revenueVisible
    });
  } catch (error) {
    console.error("❌ Error fetching today's records:", error);
    res.status(500).json({ error: "Failed to fetch records." });
  }
};


module.exports = { getTodayRecords };





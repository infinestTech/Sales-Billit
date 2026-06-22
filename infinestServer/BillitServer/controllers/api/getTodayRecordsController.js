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


    const customers = await Customer.find({ shop_id: actualUserId }).lean();
    const dealers = await Dealer.find({ shop_id: actualUserId }).lean();


    // Fetch mobiles added today
    const mobiles = await Mobile.find({
      shop_id: actualUserId,
      added_date: { $gte: startOfDay, $lte: endOfDay }
    }).lean();


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


    // Calculate today's revenue from payments made TODAY (same logic as shop-admin portal)
    // Fetch ALL mobiles to capture all payments made today
    const allMobiles = await Mobile.find({
      shop_id: actualUserId
    }).lean();

    let todayRevenue = 0;
    allMobiles.forEach((m) => {
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
    const shopDoc = await Shop.findById(actualUserId).select('revenue_visible_to_users').lean();
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





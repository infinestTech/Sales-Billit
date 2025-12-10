const { Customer, Dealer, Mobile, ProductHistory } = require("../../models/mongoModels");
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


    // Calculate revenue from mobiles created today based on TODAY'S PAYMENTS ONLY
    let mobileRevenue = 0;
    
    mobiles.forEach((m) => {
      // For mobiles created today, sum up payments made today
      if (m.payments && m.payments.length > 0) {
        const todaysPayments = m.payments.filter(p => {
          const paymentDate = new Date(p.date);
          return paymentDate >= startOfDay && paymentDate <= endOfDay;
        });
        mobileRevenue += todaysPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      } else {
        // Fallback for legacy data without payments array
        mobileRevenue += (m.total_paid || m.paid_amount || 0);
      }
    });


    // ✅ Fetch ALL mobiles (to capture payments made today on older mobiles)
    const allMobiles = await Mobile.find({
      shop_id: actualUserId
    }).lean();


    // ✅ Calculate revenue from payments made TODAY on mobiles NOT created today
    let updatedMobileRevenue = 0;
    
    allMobiles.forEach((m) => {
      // Skip mobiles created today (already counted above)
      if (m.added_date >= startOfDay && m.added_date <= endOfDay) {
        return;
      }
      
      // Count only payments made TODAY on older mobiles
      if (m.payments && m.payments.length > 0) {
        const todaysPayments = m.payments.filter(p => {
          const paymentDate = new Date(p.date);
          return paymentDate >= startOfDay && paymentDate <= endOfDay;
        });
        updatedMobileRevenue += todaysPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      }
    });


    // Product sales revenue for today
    const productRevenueAgg = await ProductHistory.aggregate([
      {
        $match: {
          changeType: "SELL",
          changeDate: { $gte: startOfDay, $lte: endOfDay }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$paidAmount" }
        }
      }
    ]);
    const productRevenue = productRevenueAgg[0]?.total || 0;


    // ✅ Final correct revenue calculation:
    const todayRevenue = mobileRevenue + updatedMobileRevenue + productRevenue;


    const records = [
      ...customers
        .filter((c) => mobilesByCustomer[c._id]?.length)
        .map((c) => ({
          id: c._id,
          clientName: c.client_name,
          mobileNumber: c.mobile_number,
          billNo: c.bill_no || "N/A",
          balanceAmount: c.balance_amount ?? 0,
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
          createdAt: d.created_at,
          customerType: "Dealer",
          mobiles: mobilesByDealer[d._id]
        }))
    ];


    res.status(200).json({
      records,
      todayRevenue
    });
  } catch (error) {
    console.error("❌ Error fetching today's records:", error);
    res.status(500).json({ error: "Failed to fetch records." });
  }
};


module.exports = { getTodayRecords };





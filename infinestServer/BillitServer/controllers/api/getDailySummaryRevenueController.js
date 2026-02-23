const { Customer, Dealer, Mobile, ProductHistory, Product } = require("../../models/mongoModels");
const { getISTStartOfDay, getISTEndOfDay } = require("../../utils/dateHelper");

const getDailySummaryRevenue = async (req, res) => {
  try {
    const { shop_id, date } = req.body;

    if (!shop_id || !date) {
      return res.status(400).json({ error: "shop_id and date are required" });
    }

    // Use IST boundaries for the given date
    const start = getISTStartOfDay(new Date(date));
    const end = getISTEndOfDay(new Date(date));

    // 1️⃣ Fetch customers & dealers (in case needed for advanced analytics later)
    const customers = await Customer.find({ shop_id }).lean();
    const dealers = await Dealer.find({ shop_id }).lean();

    // 2️⃣ Get ALL mobile records to check payments made on this specific date
    const allMobiles = await Mobile.find({
      shop_id
    }).lean();

    // Calculate mobile revenue by checking ONLY payments made on the specified date
    let serviceRevenue = 0;
    
    allMobiles.forEach((mobile) => {
      if (mobile.payments && mobile.payments.length > 0) {
        // Filter payments made on this specific date
        const paymentsOnDate = mobile.payments.filter(p => {
          const paymentDate = new Date(p.date);
          return paymentDate >= start && paymentDate <= end;
        });
        // Sum up only the payments made on this date
        serviceRevenue += paymentsOnDate.reduce((sum, p) => sum + (p.amount || 0), 0);
      } else {
        // Fallback for legacy data: if mobile was created on this date and has no payments array
        if (mobile.added_date >= start && mobile.added_date <= end) {
          serviceRevenue += (mobile.total_paid || mobile.paid_amount || 0);
        }
      }
    });

    // 5️⃣ Get STOCK REVENUE (product sales)
    const products = await Product.find({ userId: shop_id }).select("_id").lean();
    const productIds = products.map(p => p._id);

    const productHistory = await ProductHistory.find({
      productId: { $in: productIds },
      changeType: "SELL",
      changeDate: { $gte: start, $lte: end },
    }).lean();

    const stockRevenue = productHistory.reduce((sum, entry) => sum + (entry.paidAmount || 0), 0);

    // 6️⃣ Calculate total revenue
    const totalRevenue = serviceRevenue + stockRevenue;

    // 7️⃣ Return all three revenue values
    return res.status(200).json({ 
      totalRevenue,
      serviceRevenue,
      stockRevenue
    });
  } catch (error) {
    console.error("❌ Error fetching daily summary:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { getDailySummaryRevenue };
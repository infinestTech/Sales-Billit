const { ProductHistory } = require("../../models/mongoModels");
const { getISTTodayRange } = require("../../utils/dateHelper");

const getTodayProductRevenue = async (req, res) => {
  try {
    const { userId } = req.body; // 👈 treat as shop_id

    if (!userId) {
      return res.status(400).json({ error: "Shop ID is required." });
    }

    const { startOfDay, endOfDay } = getISTTodayRange();

    const result = await ProductHistory.aggregate([
      {
        $match: {
          changeType: "SELL",
          changeDate: { $gte: startOfDay, $lte: endOfDay },
          userId: userId  // 👈 this is shop_id
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$paidAmount" }
        }
      }
    ]);

    return res.json({ revenue: result[0]?.totalRevenue || 0 });
  } catch (error) {
    console.error("Failed to fetch product revenue:", error.message);
    return res.status(500).json({ error: "Error fetching product revenue." });
  }
};

module.exports = { getTodayProductRevenue };

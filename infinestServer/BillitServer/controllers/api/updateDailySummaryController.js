const { Expense, DailySummary } = require("../../models/mongoModels");
const { getISTStartOfDay, getISTEndOfDay } = require("../../utils/dateHelper");

const updateDailySummary = async (req, res) => {
  const { userId, date, todayRevenue } = req.body; // userId = shop_id

  if (!userId || !date || todayRevenue === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Use IST timezone boundaries for the given date
  const dayStart = getISTStartOfDay(new Date(date));
  const dayEnd = getISTEndOfDay(new Date(date));

  try {
    // 1. Sum today's expenses
    const expenseSum = await Expense.aggregate([
      {
        $match: {
          userId: userId, // shop_id
          createdAt: { $gte: dayStart, $lte: dayEnd }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);

    const totalExpense = expenseSum[0]?.total || 0;
    const netRevenue = todayRevenue - totalExpense;

    // 2. Upsert daily summary
    const existing = await DailySummary.findOne({ userId, date: new Date(date) });

    if (existing) {
      existing.totalRevenue = todayRevenue;
      existing.totalExpense = totalExpense;
      existing.netRevenue = netRevenue;
      await existing.save();
    } else {
      await DailySummary.create({
        userId,
        date: new Date(date),
        totalRevenue: todayRevenue,
        totalExpense,
        netRevenue,
      });
    }

    return res.status(200).json({
      success: true,
      totalExpense,
      netRevenue,
    });
  } catch (error) {
    console.error("Failed to update Daily Summary:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { updateDailySummary };

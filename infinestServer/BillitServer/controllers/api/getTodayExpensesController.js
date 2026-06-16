const { Expense } = require("../../models/mongoModels");
const { getISTStartOfDay, getISTEndOfDay, formatIST } = require("../../utils/dateHelper");

const getTodayExpenses = async (req, res) => {
  const { shop_id, date } = req.body;

  if (!shop_id) {
    return res.status(400).json({ error: "Shop ID is required." });
  }

  try {
    const targetDate = date || formatIST(new Date(), 'YYYY-MM-DD');
    // Use IST boundaries for the target date
    const start = getISTStartOfDay(new Date(targetDate));
    const end = getISTEndOfDay(new Date(targetDate));

    const expenses = await Expense.find({
      userId: shop_id,
      createdAt: { $gte: start, $lte: end }
    }).sort({ createdAt: -1 });

    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

    return res.status(200).json({ expenses, totalAmount });
  } catch (error) {
    console.error("Error fetching expenses:", error);
    return res.status(500).json({ error: "Failed to fetch expenses." });
  }
};

module.exports = { getTodayExpenses };

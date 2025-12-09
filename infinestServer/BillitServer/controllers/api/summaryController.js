const { Mobile, Expense, Shop, Customer, Dealer, Product } = require("../../models/mongoModels");


// POST version (already present)
exports.getDashboardSummary = async (req, res) => {
  try {
    const { shop_id } = req.body;


    const [mobiles, expenses, products, customers, dealers] = await Promise.all([
      Mobile.find({ shop_id }).lean(),
      Expense.find({ shop_id }).lean(),
      Product.find({ shop_id }).lean(),
      Customer.find({ shop_id }).lean(),
      Dealer.find({ shop_id }).lean(),
    ]);


    const today = new Date();
    today.setHours(0, 0, 0, 0);


    const todayMobiles = mobiles.filter(m => new Date(m.added_date) >= today);
    const todayRevenue = todayMobiles.reduce((sum, m) => sum + (m.total_paid || m.paid_amount || 0), 0);
    const todayExpenses = expenses.filter(e => new Date(e.date) >= today);
    const todayExpenseAmount = todayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);


    res.json({
      todayRevenue,
      todayExpenseAmount,
      mobiles,
      products,
      customers,
      dealers,
      summaryDate: new Date()
    });
  } catch (error) {
    console.error("Summary Fetch Error:", error);
    res.status(500).json({ message: "Error fetching dashboard data" });
  }
};


// NEW GET version (public, for Power BI)
exports.getDashboardSummaryPublic = async (req, res) => {
  try {
    const { shop_id } = req.params;


    const [mobiles, expenses, products, customers, dealers] = await Promise.all([
      Mobile.find({ shop_id }).lean(),
      Expense.find({ shop_id }).lean(),
      Product.find({ shop_id }).lean(),
      Customer.find({ shop_id }).lean(),
      Dealer.find({ shop_id }).lean(),
    ]);


    const today = new Date();
    today.setHours(0, 0, 0, 0);


    const todayMobiles = mobiles.filter(m => new Date(m.added_date) >= today);
    const todayRevenue = todayMobiles.reduce((sum, m) => sum + (m.total_paid || m.paid_amount || 0), 0);
    const todayExpenses = expenses.filter(e => new Date(e.date) >= today);
    const todayExpenseAmount = todayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);


    res.json({
      todayRevenue,
      todayExpenseAmount,
      mobiles,
      products,
      customers,
      dealers,
      summaryDate: new Date()
    });
  } catch (error) {
    console.error("Public Summary Fetch Error:", error);
    res.status(500).json({ message: "Error fetching dashboard data (public)" });
  }
};





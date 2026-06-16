const { Expense } = require("../../models/mongoModels");


const addExpense = async (req, res) => {
  const { shop_id, title, amount, createdAt, paymentMethod } = req.body;


  if (!shop_id || !title || !amount) {
    return res.status(400).json({ error: "Missing required fields." });
  }


  try {
    const expense = await Expense.create({
      userId: shop_id,
      title,
      amount,
      paymentMethod: ["upi", "cash"].includes(String(paymentMethod || '').toLowerCase())
        ? String(paymentMethod).toLowerCase()
        : "cash",
      createdAt: createdAt ? new Date(createdAt) : undefined,
    });


    return res.status(200).json({ success: true, expense });
  } catch (error) {
    console.error("Error adding expense:", error);
    return res.status(500).json({ error: "Failed to add expense." });
  }
};


module.exports = { addExpense };


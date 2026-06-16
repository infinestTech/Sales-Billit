const { Customer, Dealer } = require("../../models/mongoModels");

const clearBalance = async (req, res) => {
  const { id, type } = req.body;

  if (!id || !type) {
    return res.status(400).json({ error: "Missing required fields: id or type." });
  }

  try {
    if (type === "Customer") {
      await Customer.findByIdAndUpdate(id, { balance_amount: 0 });
      return res.json({ success: true, message: "Customer balance cleared." });
    } else if (type === "Dealer") {
      await Dealer.findByIdAndUpdate(id, { balance_amount: 0 });
      return res.json({ success: true, message: "Dealer balance cleared." });
    } else {
      return res.status(400).json({ error: "Invalid type. Must be 'Customer' or 'Dealer'." });
    }
  } catch (error) {
    console.error("Error clearing balance amount:", error);
    return res.status(500).json({
      error: "An error occurred while clearing balance amount.",
    });
  }
};

module.exports = { clearBalance };

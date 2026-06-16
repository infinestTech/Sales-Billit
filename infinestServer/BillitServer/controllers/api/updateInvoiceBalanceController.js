const { Customer, Dealer } = require("../../models/mongoModels");

const updateInvoiceBalance = async (req, res) => {
  const { id, balanceAmount, type } = req.body;

  if (!id || balanceAmount === undefined || !type) {
    return res.status(400).json({ error: "Missing required fields: id, balanceAmount, or type." });
  }

  try {
    if (type === "Customer") {
      const updatedCustomer = await Customer.findByIdAndUpdate(
        id,
        { balance_amount: parseInt(balanceAmount, 10) },
        { new: true }
      );
      if (!updatedCustomer) {
        return res.status(404).json({ error: "Customer not found." });
      }
      return res.json({ success: true, updatedCustomer });
    }

    if (type === "Dealer") {
      const updatedDealer = await Dealer.findByIdAndUpdate(
        id,
        { balance_amount: parseInt(balanceAmount, 10) },
        { new: true }
      );
      if (!updatedDealer) {
        return res.status(404).json({ error: "Dealer not found." });
      }
      return res.json({ success: true, updatedDealer });
    }

    return res.status(400).json({ error: "Invalid type. Must be 'Customer' or 'Dealer'." });
  } catch (error) {
    console.error("Error updating balance amount:", error);
    return res.status(500).json({ error: "An error occurred while updating balance amount." });
  }
};

module.exports = { updateInvoiceBalance };

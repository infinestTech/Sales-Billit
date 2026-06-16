const { Customer, Dealer } = require("../../models/mongoModels");

const updateBalance = async (req, res) => {
  const { id, balanceAmount, type } = req.body;

  // Validate inputs
  if (!id || balanceAmount === undefined || !type) {
    return res.status(400).json({ message: "Missing id, balanceAmount, or type" });
  }

  if (!["Customer", "Dealer"].includes(type)) {
    return res.status(400).json({ message: "Invalid type. Must be 'Customer' or 'Dealer'" });
  }

  try {
    const model = type === "Customer" ? Customer : Dealer;

    // Check if record exists
    const existingRecord = await model.findById(id);
    if (!existingRecord) {
      return res.status(404).json({ message: `Record with id ${id} not found in ${type}` });
    }

    // Update balance amount
    existingRecord.balance_amount = parseInt(balanceAmount);
    await existingRecord.save();

    // Fetch all records of this type (filtered by shop_id)
    const allRecords = await model.find({ shop_id: existingRecord.shop_id });

    return res.status(200).json({
      message: `${type} balance updated successfully`,
      data: allRecords,
    });
  } catch (error) {
    console.error(`Error updating ${type.toLowerCase()} balance:`, error);
    return res.status(500).json({
      message: `Failed to update ${type.toLowerCase()} balance`,
      error: error.message,
    });
  }
};

module.exports = { updateBalance };

const { Customer, Dealer } = require("../../models/mongoModels");

const allUpdateEstimatedCost = async (req, res) => {
  const { id, estimatedCost, type } = req.body;

  if (!id || estimatedCost === undefined || !type) {
    return res.status(400).json({ message: "Missing id, estimatedCost, or type" });
  }

  if (!["Customer", "Dealer"].includes(type)) {
    return res.status(400).json({ message: "Invalid type. Must be 'Customer' or 'Dealer'" });
  }

  try {
    const model = type === "Customer" ? Customer : Dealer;

    const existingRecord = await model.findById(id);
    if (!existingRecord) {
      return res.status(404).json({ message: `Record with id ${id} not found in ${type}` });
    }

    existingRecord.estimated_cost = parseInt(estimatedCost) || 0;
    await existingRecord.save();

    return res.status(200).json({
      message: `${type} estimated cost updated successfully`,
      estimated_cost: existingRecord.estimated_cost,
    });
  } catch (error) {
    console.error(`Error updating ${type.toLowerCase()} estimated cost:`, error);
    return res.status(500).json({
      message: `Failed to update ${type.toLowerCase()} estimated cost`,
      error: error.message,
    });
  }
};

module.exports = { allUpdateEstimatedCost };

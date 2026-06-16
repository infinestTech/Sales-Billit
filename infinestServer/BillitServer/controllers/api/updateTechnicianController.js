const { Mobile } = require("../../models/mongoModels");

const updateTechnician = async (req, res) => {
  const { id } = req.params;
  const { technicianName } = req.body;

  // Technician name is optional. If not provided, store as empty string.
  const technicianValue = technicianName || "";

  try {
    const updatedMobile = await Mobile.findByIdAndUpdate(
      id,
  { technician_name: technicianValue },
      { new: true }
    );

    if (!updatedMobile) {
      return res.status(404).json({ error: "Mobile record not found." });
    }

    return res.status(200).json({
      message: "Technician name updated successfully",
      updatedMobile,
    });
  } catch (error) {
    console.error("Error updating technician name:", error);
    return res.status(500).json({ error: "Failed to update technician name" });
  }
};

module.exports = { updateTechnician };


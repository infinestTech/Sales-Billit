const { Mobile } = require("../../models/mongoModels");

const deletePaymentEntry = async (req, res) => {
  const { id, paymentId } = req.body;

  if (!id || !paymentId) {
    return res.status(400).json({ error: "Missing required parameters: id, paymentId" });
  }

  try {
    const existingMobile = await Mobile.findById(id);
    if (!existingMobile) {
      return res.status(404).json({ error: "Mobile not found" });
    }

    if (!existingMobile.payments || existingMobile.payments.length === 0) {
      return res.status(400).json({ error: "No payments found for this mobile" });
    }

    // Filter out the payment entry
    existingMobile.payments = existingMobile.payments.filter(
      payment => payment._id.toString() !== paymentId.toString()
    );

    // Recalculate total paid amount
    const totalPaid = existingMobile.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    existingMobile.total_paid = totalPaid;

    // Update the document
    await existingMobile.save();

    return res.status(200).json({ 
      success: true, 
      updatedMobile: existingMobile 
    });
  } catch (error) {
    console.error("Error deleting payment entry:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { deletePaymentEntry };

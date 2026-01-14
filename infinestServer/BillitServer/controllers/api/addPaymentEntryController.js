const { Mobile } = require("../../models/mongoModels");
const { DEFAULT_PAYMENT_METHOD } = require("../../constants/paymentMethods");

const addPaymentEntry = async (req, res) => {
  const { id, amount, method, date } = req.body;

  if (!id || amount === undefined || !method || !date) {
    return res.status(400).json({ error: "Missing required parameters: id, amount, method, date" });
  }

  try {
    const existingMobile = await Mobile.findById(id);
    if (!existingMobile) {
      return res.status(404).json({ error: "Mobile not found" });
    }

    // Initialize payments array if it doesn't exist
    if (!existingMobile.payments) {
      existingMobile.payments = [];
    }

    // Migrate old single payment data if exists
    if (existingMobile.paid_amount && existingMobile.payments.length === 0) {
      existingMobile.payments.push({
        amount: Number(existingMobile.paid_amount),
        method: existingMobile.payment || DEFAULT_PAYMENT_METHOD,
        date: existingMobile.update_date || new Date()
      });
    }

    // Add new payment entry
    existingMobile.payments.push({
      amount: Number(amount),
      method: method,
      date: new Date(date)
    });

    // Calculate total paid amount
    const totalPaid = existingMobile.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    existingMobile.total_paid = totalPaid;

    // Update the update_date to track when payment was added
    existingMobile.update_date = new Date();

    // Update the document
    await existingMobile.save();

    return res.status(200).json({ 
      success: true, 
      updatedMobile: existingMobile 
    });
  } catch (error) {
    console.error("Error adding payment entry:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { addPaymentEntry };

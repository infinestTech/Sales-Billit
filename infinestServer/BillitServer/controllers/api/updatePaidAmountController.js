const { Mobile } = require("../../models/mongoModels");

// Reconciles the split payments[] history to a new total so aggregations (Payment Breakdown, etc.)
// stay in sync with paid_amount/total_paid no matter which entry point changed the total.
const reconcilePayments = (existingPayments, newTotal, fallbackMethod) => {
  const payments = Array.isArray(existingPayments) ? existingPayments.map(p => ({ ...(p.toObject ? p.toObject() : p) })) : [];
  if (payments.length === 0) {
    if (newTotal > 0) payments.push({ amount: newTotal, method: fallbackMethod || 'Cash', date: new Date() });
  } else if (payments.length === 1) {
    payments[0].amount = newTotal;
  } else {
    const currentTotal = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const delta = newTotal - currentTotal;
    const lastIdx = payments.length - 1;
    payments[lastIdx].amount = Math.max(0, (Number(payments[lastIdx].amount) || 0) + delta);
  }
  return payments;
};


const updatePaidAmount = async (req, res) => {
  const { id, paidAmount, updateDate, payment, supplierId, supplierName, productName, quantity, supplierAmount, paymentMethod, warranty } = req.body;


  if (!id || paidAmount === undefined || !updateDate) {
    return res.status(400).json({ error: "Missing required parameters" });
  }


  try {
    const existingMobile = await Mobile.findById(id);
    if (!existingMobile) {
      return res.status(404).json({ error: "Mobile not found" });
    }

    const newPaidAmount = Number(paidAmount);

      const updatePayload = {
        paid_amount: newPaidAmount,
        update_date: new Date(updateDate),
        delivery_date: existingMobile.delivery_date,
      };

      // Keep the split payments[] history (and its total_paid) in sync with the new paid amount
      if (newPaidAmount !== Number(existingMobile.total_paid || existingMobile.paid_amount || 0)) {
        updatePayload.payments = reconcilePayments(existingMobile.payments, newPaidAmount, payment || existingMobile.payment);
        updatePayload.total_paid = newPaidAmount;
      }

      // Accept and persist any non-empty payment string (trimmed).
      // This allows frontend to send new types like card, Gpay-h, Gpay-s, Cash + Card, etc.
      if (typeof payment === "string" && payment.trim() !== "") {
        updatePayload.payment = payment.trim();
      }

      // Optionally persist supplier/product details so UI shows them after refresh
      if (supplierId !== undefined) updatePayload.supplierId = supplierId;
      if (supplierName !== undefined) updatePayload.supplierName = supplierName;
      if (productName !== undefined) updatePayload.productName = productName;
      if (quantity !== undefined) updatePayload.quantity = quantity;
      if (supplierAmount !== undefined) updatePayload.supplier_amount = Number(supplierAmount);
      if (paymentMethod !== undefined) updatePayload.paymentMethod = paymentMethod;
      if (warranty !== undefined) updatePayload.warranty = warranty;


    const updatedMobile = await Mobile.findByIdAndUpdate(
      id,
      updatePayload,
      { new: true }
    );


    return res.status(200).json({ success: true, updatedMobile });
  } catch (error) {
    console.error("Error updating paid amount:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};


module.exports = { updatePaidAmount };





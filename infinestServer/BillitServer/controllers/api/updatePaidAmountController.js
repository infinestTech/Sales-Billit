const { Mobile } = require("../../models/mongoModels");


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


      const updatePayload = {
        paid_amount: Number(paidAmount),
        update_date: new Date(updateDate),
        delivery_date: existingMobile.delivery_date,
      };

      // Accept and persist any non-empty payment string (trimmed).
      // This allows frontend to send new types like card, UPI-h, UPI-s, Cash + Card, etc.
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





const { Customer, Dealer, Mobile } = require("../../models/mongoModels");

const deleteMobileInvoice = async (req, res) => {
  const { clientId, mobileIndex } = req.params;

  try {
    const customer = await Customer.findById(clientId).lean();
    const dealer = await Dealer.findById(clientId).lean();

    const client = customer || dealer;
    const isCustomer = !!customer;

    if (!client) {
      return res.status(404).json({ message: "Client record not found." });
    }

    // Fetch mobiles separately to respect `mobileIndex`
    const mobiles = await Mobile.find(
      isCustomer ? { customer_id: clientId } : { dealer_id: clientId }
    ).sort({ created_at: 1 }).lean(); // Ensure consistent order

    if (!mobiles[mobileIndex]) {
      return res.status(404).json({ message: "Mobile record not found at specified index." });
    }

    const mobileToDelete = mobiles[mobileIndex];

    if (mobiles.length === 1) {
      // Delete mobile + customer/dealer
      await Mobile.deleteOne({ _id: mobileToDelete._id });

      if (isCustomer) {
        await Customer.findByIdAndDelete(clientId);
      } else {
        await Dealer.findByIdAndDelete(clientId);
      }

      return res.status(200).json({ message: "Entire client record deleted successfully." });
    } else {
      // Delete just the selected mobile
      await Mobile.deleteOne({ _id: mobileToDelete._id });

      // Update noOfMobile count
      if (isCustomer) {
        await Customer.findByIdAndUpdate(clientId, { $inc: { no_of_mobile: -1 } });
      } else {
        await Dealer.findByIdAndUpdate(clientId, { $inc: { no_of_mobile: -1 } });
      }

      return res.status(200).json({ message: "Specific mobile record deleted successfully." });
    }
  } catch (error) {
    console.error("Error deleting mobile record:", error);
    return res.status(500).json({
      message: "An error occurred while deleting the mobile record.",
    });
  }
};

module.exports = { deleteMobileInvoice };

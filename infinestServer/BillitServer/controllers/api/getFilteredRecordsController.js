const { Customer, Dealer, Mobile, Shop } = require("../../models/mongoModels");




const getFilteredRecords = async (req, res) => {
  try {
    const {
      shopId,         // ✅ frontend sends `shopId` now
      clientName,
      mobileName,
      customerType,
      fromDate,
      toDate,
      billNo,
      mobileDate
    } = req.body;




    if (!shopId) {
      console.error("Shop ID is required but missing in request body.");
      return res.status(400).json({ error: "Shop ID is required." });
    }




    // ✅ Mongo filters use `shop_id` because that's your schema field
    const mobileFilters = { shop_id: shopId };
    const customerFilters = { shop_id: shopId };
    const dealerFilters = { shop_id: shopId };




    if (mobileName) {
      mobileFilters.mobile_name = { $regex: mobileName, $options: "i" };
    }
const shop = await Shop.findById(shopId).select("owner_name phone address");




if (!shop) {
  return res.status(404).json({ error: "Shop not found." });
}




    if (fromDate && toDate) {
      mobileFilters.added_date = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate),
      };
    }




    if (mobileDate) {
      mobileFilters.added_date = new Date(mobileDate);
    }




    if (clientName) {
      customerFilters.client_name = { $regex: clientName, $options: "i" };
      dealerFilters.client_name = { $regex: clientName, $options: "i" };
    }




    if (customerType) {
      customerFilters.customer_type = customerType;
      dealerFilters.customer_type = customerType;
    }




    if (billNo) {
      customerFilters.bill_no = { $regex: billNo, $options: "i" };
      dealerFilters.bill_no = { $regex: billNo, $options: "i" };
    }




    // Fetch matching customers and dealers
    const customers = await Customer.find(customerFilters)
      .select("client_name mobile_number bill_no balance_amount customer_type");




    const dealers = await Dealer.find(dealerFilters)
      .select("client_name mobile_number bill_no balance_amount customer_type");




    const customerIds = customers.map(c => c._id);
    const dealerIds = dealers.map(d => d._id);




    // Fetch mobiles linked to customers or dealers
    const mobiles = await Mobile.find({
      ...mobileFilters,
      $or: [
        { customer_id: { $in: customerIds } },
        { dealer_id: { $in: dealerIds } },
      ]
    }).select(
      "mobile_name issue ready delivered returned paid_amount added_date delivery_date customer_id dealer_id payment"
    );




   // console.log(`Fetched ${mobiles.length} mobile records`);




   return res.status(200).json({
  mobiles,
  customers,
  dealers,
  shopOwnerName: shop.owner_name || "Not Provided",
  shopPhone: shop.phone || "Not Provided",
  shopaddress: shop.address || "Not Provided"
});
  } catch (error) {
    console.error("Error fetching records:", error.message);
    return res.status(500).json({ error: "Failed to fetch records." });
  }
};




module.exports = { getFilteredRecords };













const { Shop, Customer, Dealer, Mobile, ProductHistory, Product, Expense, DailySummary, MobileBrand, MobileIssue } = require("../models/mongoModels");
const { getISTTodayRange, getISTStartOfDay, getISTEndOfDay, formatIST } = require("../utils/dateHelper");

// ======================================
// ✅ Create Customer Controller
// ======================================
const createCustomer = async (req, res) => {
  try {
    const {
      clientName,
      mobileNumber,
      customerType,
      noOfMobile,
      billNo,
      balanceAmount,
      MobileName,
      technicianname,
      userId // 🟡 This is shop_id
    } = req.body;

    if (!clientName || !mobileNumber || !customerType || !MobileName || !userId) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid shop_id format." });
    }

    const shopExists = await Shop.findById(userId);
    if (!shopExists) {
      return res.status(404).json({ error: "Shop not found." });
    }

    const existingCustomer = await Customer.findOne({ mobile_number: mobileNumber });
    if (existingCustomer) {
      return res.status(400).json({ error: "Customer with this mobile number already exists." });
    }

    const customer = await Customer.create({
      client_name: clientName,
      mobile_number: mobileNumber,
      customer_type: customerType,
      no_of_mobile: noOfMobile,
      bill_no: billNo || null,
      balance_amount: balanceAmount || 0,
      shop_id: shopExists._id
    });

    const mobilePromises = MobileName.map((mobile) =>
      Mobile.create({
        mobile_name: mobile.mobileName,
        issue: mobile.issues || null,
        added_date: new Date(mobile.date),
        customer_id: customer._id,
        shop_id: shopExists._id,
        technician_name: technicianname || ""
      })
    );

    await Promise.all(mobilePromises);

    res.status(201).json({
      message: "Customer and associated mobiles created successfully.",
      customer
    });
  } catch (error) {
    console.error("Error creating customer:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

// ======================================
// ✅ Create Dealer Controller
// ======================================
const createDealer = async (req, res) => {
  try {
    const { clientName, mobileNumber, userId } = req.body;

    if (!clientName || !mobileNumber || !userId) {
      return res.status(400).json({ error: "Missing required fields: clientName, mobileNumber, or userId." });
    }

    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid shop_id format." });
    }

    const shopExists = await Shop.findById(userId);
    if (!shopExists) {
      return res.status(404).json({ error: "Shop not found." });
    }

    const existingDealer = await Dealer.findOne({ mobile_number: mobileNumber });
    if (existingDealer) {
      return res.status(400).json({ error: "Dealer with this mobile number already exists." });
    }

    const newDealer = await Dealer.create({
      client_name: clientName,
      mobile_number: mobileNumber,
      shop_id: shopExists._id,
      no_of_mobile: 0,
      customer_type: "Dealer",
      balance_amount: 0
    });

    res.status(201).json({ message: "Dealer created successfully.", dealer: newDealer });
  } catch (error) {
    console.error("Error creating dealer:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};


const getAllDealers = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID (shop_id) is required." });
    }

    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid userId format." });
    }

    const dealers = await Dealer.find({ shop_id: userId }).select("id client_name mobile_number");

    res.status(200).json(dealers);
  } catch (error) {
    console.error("Error fetching dealers:", error.message);
    res.status(500).json({ error: "Failed to fetch dealers. Please try again later." });
  }
};


// ======================================
// ✅ Get Records (Customers, Dealers, Mobiles)
// ======================================
const getRecords = async (req, res) => {
  try {
    const {
      userId,
      clientName,
      mobileName,
      customerType,
      fromDate,
      toDate,
      billNo,
      mobileDate
    } = req.body;

    if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Valid shop_id (userId) is required." });
    }

    const shopExists = await Shop.findById(userId);
    if (!shopExists) {
      return res.status(404).json({ error: "Shop not found." });
    }

    // 🔍 Build filters
    const customerFilters = { shop_id: userId };
    const dealerFilters = { shop_id: userId };
    const mobileFilters = { shop_id: userId };

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

    if (mobileName) {
      mobileFilters.mobile_name = { $regex: mobileName, $options: "i" };
    }

    if (mobileDate) {
      mobileFilters.added_date = {
        $gte: new Date(mobileDate),
        $lt: new Date(new Date(mobileDate).getTime() + 24 * 60 * 60 * 1000)
      };
    } else if (fromDate && toDate) {
      mobileFilters.added_date = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate)
      };
    }

    // 📦 Get customers and dealers
    const customers = await Customer.find(customerFilters).lean();
    const dealers = await Dealer.find(dealerFilters).lean();

    const customerIds = customers.map(c => c._id);
    const dealerIds = dealers.map(d => d._id);

    // 📱 Get mobiles linked to customers and dealers
    const mobiles = await Mobile.find({
      ...mobileFilters,
      $or: [
        { customer_id: { $in: customerIds } },
        { dealer_id: { $in: dealerIds } }
      ]
    }).lean();

    res.status(200).json({
      mobiles,
      customers,
      dealers
    });
  } catch (error) {
    console.error("Error fetching records:", error);
    res.status(500).json({ error: "Failed to fetch records." });
  }
};


const getTodayRecords = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Valid userId (shop_id) is required." });
    }

    const shop = await Shop.findById(userId);
    if (!shop) {
      return res.status(404).json({ error: "Shop not found." });
    }

    const { startOfDay, endOfDay } = getISTTodayRange();

    // 1. Fetch customers with today's mobiles
    const customers = await Customer.find({ shop_id: userId }).lean();
    const dealers = await Dealer.find({ shop_id: userId }).lean();

    const customerIds = customers.map(c => c._id);
    const dealerIds = dealers.map(d => d._id);

    const mobiles = await Mobile.find({
      shop_id: userId,
      added_date: { $gte: startOfDay, $lte: endOfDay },
      $or: [
        { customer_id: { $in: customerIds } },
        { dealer_id: { $in: dealerIds } }
      ]
    }).lean();

    // Group mobiles under respective customers/dealers
    const customerMap = {};
    customers.forEach(c => (customerMap[c._id] = { ...c, mobiles: [] }));

    const dealerMap = {};
    dealers.forEach(d => (dealerMap[d._id] = { ...d, mobiles: [] }));

    mobiles.forEach(m => {
      if (m.customer_id && customerMap[m.customer_id]) {
        customerMap[m.customer_id].mobiles.push(m);
      } else if (m.dealer_id && dealerMap[m.dealer_id]) {
        dealerMap[m.dealer_id].mobiles.push(m);
      }
    });

    // Combine customer and dealer records
    const records = [
      ...Object.values(customerMap).map(c => ({
        id: c._id,
        clientName: c.client_name,
        mobileNumber: c.mobile_number,
        billNo: c.bill_no || "N/A",
        balanceAmount: c.balance_amount ?? 0,
        createdAt: c.created_at,
        customerType: "Customer",
        mobiles: c.mobiles
      })),
      ...Object.values(dealerMap).map(d => ({
        id: d._id,
        clientName: d.client_name,
        mobileNumber: d.mobile_number,
        billNo: d.bill_no || "N/A",
        balanceAmount: d.balance_amount ?? 0,
        createdAt: d.created_at,
        customerType: "Dealer",
        mobiles: d.mobiles
      }))
    ];

    // 2. Calculate revenue from mobiles
    const mobileRevenue = mobiles.reduce((sum, m) => sum + (m.paid_amount || 0), 0);

    // 3. Product revenue from ProductHistory
    const productRevenueResult = await ProductHistory.aggregate([
      {
        $match: {
          changeType: "SELL",
          changeDate: { $gte: startOfDay, $lte: endOfDay }
        }
      },
      {
        $group: {
          _id: null,
          totalPaid: { $sum: "$paidAmount" }
        }
      }
    ]);

    const productRevenue = productRevenueResult.length > 0 ? productRevenueResult[0].totalPaid : 0;

    return res.status(200).json({
      records,
      todayRevenue: mobileRevenue + productRevenue
    });

  } catch (error) {
    console.error("Error fetching today's records:", error);
    return res.status(500).json({ error: "Failed to fetch records." });
  }
};

const getTodaySales = async (req, res) => {
  try {
    const { startOfDay, endOfDay } = getISTTodayRange();

    const salesResult = await Mobile.aggregate([
      {
        $match: {
          delivery_date: { $gte: startOfDay, $lte: endOfDay }
        }
      },
      {
        $group: {
          _id: null,
          totalPaidAmount: { $sum: "$paid_amount" }
        }
      }
    ]);

    const totalPaidAmount = salesResult[0]?.totalPaidAmount || 0;

    res.status(200).json({
      message: "✅ Today's total paid amount calculated successfully",
      totalPaidAmount
    });
  } catch (error) {
    console.error("❌ Error fetching today's sales:", error);
    res.status(500).json({ message: "Failed to fetch today's sales", error });
  }
};

const updateBalance = async (req, res) => {
  const { id, balanceAmount, type } = req.body;

  if (!id || balanceAmount === undefined || !type) {
    return res.status(400).json({ message: "Missing id, balanceAmount, or type" });
  }

  if (!["Customer", "Dealer"].includes(type)) {
    return res.status(400).json({ message: "Invalid type. Must be 'Customer' or 'Dealer'" });
  }

  try {
    const Model = type === "Customer" ? Customer : Dealer;

    // ✅ Check for valid ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid MongoDB ObjectId format" });
    }

    // ✅ Check if the document exists
    const existing = await Model.findById(id);
    if (!existing) {
      return res.status(404).json({ message: `${type} with id ${id} not found` });
    }

    // ✅ Update balance_amount field
    await Model.findByIdAndUpdate(id, {
      balance_amount: parseInt(balanceAmount)
    });

    // ✅ Fetch all records of this type
    const allRecords = await Model.find().select("client_name mobile_number balance_amount");

    res.status(200).json({
      message: `${type} balance updated successfully`,
      data: allRecords
    });

  } catch (error) {
    console.error(`Error updating ${type} balance:`, error.message);
    res.status(500).json({
      message: `Failed to update ${type} balance`,
      error: error.message
    });
  }
};


const fetchAllData = async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "User ID (shop_id) is required." });
  }

  if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ error: "Invalid MongoDB ObjectId format." });
  }

  try {
    // Fetch customers linked to shop_id and populate mobiles manually
    const customers = await Customer.find({ shop_id: userId });
    const dealers = await Dealer.find({ shop_id: userId });

    const customerIds = customers.map((c) => c._id);
    const dealerIds = dealers.map((d) => d._id);

    const mobiles = await Mobile.find({
      $or: [
        { customer_id: { $in: customerIds } },
        { dealer_id: { $in: dealerIds } }
      ]
    });

    // Attach mobile records to customers
    const customersWithMobiles = customers.map((customer) => ({
      ...customer.toObject(),
      mobiles: mobiles.filter((m) => m.customer_id?.toString() === customer._id.toString())
    }));

    // Attach mobile records to dealers
    const dealersWithMobiles = dealers.map((dealer) => ({
      ...dealer.toObject(),
      mobiles: mobiles.filter((m) => m.dealer_id?.toString() === dealer._id.toString())
    }));

    res.status(200).json({ customers: customersWithMobiles, dealers: dealersWithMobiles });
  } catch (error) {
    console.error("Error fetching data:", error.message);
    res.status(500).json({ error: "Failed to fetch data. Please try again later." });
  }
};

// =====================================
// 🧾 Delete Mobile or Entire Client
// =====================================
const deleteMobileOrClient = async (req, res) => {
  const { clientId, mobileIndex } = req.params;

  if (!clientId || !mobileIndex) {
    return res.status(400).json({ message: "Missing clientId or mobileIndex" });
  }

  if (!clientId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ message: "Invalid clientId format." });
  }

  try {
    // Check in Customer
    const customer = await Customer.findById(clientId);
    const dealer = await Dealer.findById(clientId);

    const isCustomer = !!customer;
    const isDealer = !!dealer;

    if (!isCustomer && !isDealer) {
      return res.status(404).json({ message: "Client not found." });
    }

    const mobileFilter = isCustomer ? { customer_id: clientId } : { dealer_id: clientId };
    const mobiles = await Mobile.find(mobileFilter);

    if (mobiles.length === 0) {
      return res.status(404).json({ message: "No mobiles found for this client." });
    }

    const index = parseInt(mobileIndex);

    if (mobiles.length === 1) {
      // Delete entire client and mobile(s)
      await Mobile.deleteMany(mobileFilter);
      isCustomer
        ? await Customer.findByIdAndDelete(clientId)
        : await Dealer.findByIdAndDelete(clientId);

      return res.status(200).json({ message: "Entire client record deleted." });
    }

    // Delete specific mobile
    const mobileToDelete = mobiles[index];
    if (!mobileToDelete) {
      return res.status(404).json({ message: "Mobile record not found at this index." });
    }

    await Mobile.findByIdAndDelete(mobileToDelete._id);

    // Update no_of_mobile count
    if (isCustomer) {
      await Customer.findByIdAndUpdate(clientId, { no_of_mobile: mobiles.length - 1 });
    } else {
      await Dealer.findByIdAndUpdate(clientId, { no_of_mobile: mobiles.length - 1 });
    }

    return res.status(200).json({ message: "Specific mobile record deleted." });

  } catch (error) {
    console.error("❌ Error deleting mobile or client:", error);
    res.status(500).json({ message: "Failed to delete mobile or client." });
  }
};


const getCustomersWithBalance = async (req, res) => {
  const { userId } = req.body;

  if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ error: "Valid shop ID (userId) is required." });
  }

  try {
    const customers = await Customer.find({
      shop_id: userId,
      balance_amount: { $gt: 0 }
    })
    .select("client_name mobile_number balance_amount bill_no no_of_mobile")
    .lean();

    const enrichedCustomers = await Promise.all(
      customers.map(async (customer) => {
        const mobiles = await Mobile.find({ customer_id: customer._id })
          .select("mobile_name model issue added_date -_id")
          .lean();

        return {
          ...customer,
          mobiles,
        };
      })
    );

    res.status(200).json(enrichedCustomers);
  } catch (error) {
    console.error("❌ Error fetching customer balances:", error);
    res.status(500).json({ error: "Failed to fetch customer balances." });
  }
};

const getDealersWithBalance = async (req, res) => {
  const { userId } = req.body;

  if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ error: "Valid shop ID (userId) is required." });
  }

  try {
    // Step 1: Find all dealers with balance > 0 for this shop
    const dealers = await Dealer.find({
      shop_id: userId,
      balance_amount: { $gt: 0 }
    })
      .select("client_name mobile_number balance_amount no_of_mobile bill_no")
      .lean();

    // Step 2: Populate each dealer's mobiles
    const enrichedDealers = await Promise.all(
      dealers.map(async (dealer) => {
        const mobiles = await Mobile.find({ dealer_id: dealer._id })
          .select("mobile_name model issue ready delivered returned paid_amount")
          .lean();

        return {
          ...dealer,
          mobiles,
        };
      })
    );

    res.status(200).json(enrichedDealers);
  } catch (error) {
    console.error("❌ Error fetching dealer balances:", error);
    res.status(500).json({ error: "Failed to fetch dealer balances." });
  }
};



const updateBalanceAmount = async (req, res) => {
  const { id, balanceAmount, type } = req.body;

  if (!id || !balanceAmount || !type) {
    return res.status(400).json({ error: "Missing id, balanceAmount, or type." });
  }

  if (!["Customer", "Dealer"].includes(type)) {
    return res.status(400).json({ error: "Invalid type. Must be 'Customer' or 'Dealer'." });
  }

  try {
    const Model = type === "Customer" ? Customer : Dealer;

    const updatedRecord = await Model.findByIdAndUpdate(
      id,
      { balance_amount: parseInt(balanceAmount, 10) },
      { new: true }
    );

    if (!updatedRecord) {
      return res.status(404).json({ error: `${type} not found with id ${id}` });
    }

    return res.json({ success: true, updatedRecord });
  } catch (error) {
    console.error("Error updating balance amount:", error);
    res.status(500).json({ error: "An error occurred while updating balance amount." });
  }
};

const clearBalanceAmount = async (req, res) => {
  const { id, type } = req.body;

  if (!id || !type) {
    return res.status(400).json({ error: "Missing id or type." });
  }

  if (!["Customer", "Dealer"].includes(type)) {
    return res.status(400).json({ error: "Invalid type. Must be 'Customer' or 'Dealer'." });
  }

  try {
    const Model = type === "Customer" ? Customer : Dealer;

    const updated = await Model.findByIdAndUpdate(
      id,
      { balance_amount: 0 },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: `${type} not found.` });
    }

    res.json({
      success: true,
      message: `${type} balance cleared.`,
      updatedRecord: updated
    });
  } catch (error) {
    console.error("Error clearing balance amount:", error);
    res.status(500).json({ error: "An error occurred while clearing balance amount." });
  }
};

const updatePaidAmount = async (req, res) => {
  const { id, paidAmount, updateDate, payment, supplierId, supplierName, productName, quantity } = req.body;

  if (!id || paidAmount === undefined || !updateDate) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    const existingMobile = await Mobile.findById(id);
    if (!existingMobile) {
      return res.status(404).json({ error: "Mobile not found" });
    }

    // Prepare update object
    const updateFields = {
      paid_amount: paidAmount,
      update_date: new Date(updateDate),
      delivery_date: existingMobile.delivery_date
    };

    // Add payment method if provided
    if (payment !== undefined && payment !== null) {
      updateFields.payment = payment;
    }

    // Optionally persist supplier/product details so UI shows them after refresh
    if (supplierId !== undefined) updateFields.supplierId = supplierId;
    if (supplierName !== undefined) updateFields.supplierName = supplierName;
    if (productName !== undefined) updateFields.productName = productName;
    if (quantity !== undefined) updateFields.quantity = quantity;

    // Keep the old delivery date, update paid amount, payment method and update date
    const updatedMobile = await Mobile.findByIdAndUpdate(
      id,
      updateFields,
      { new: true }
    );

    res.status(200).json({ success: true, updatedMobile });
  } catch (error) {
    console.error("Error updating paid amount:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const toggleDeliveryStatus = async (req, res) => {
  const { id, delivered } = req.body;

  if (!id || typeof delivered !== "boolean") {
    return res.status(400).json({ error: "Invalid parameters" });
  }

  try {
    const updatedMobile = await Mobile.findByIdAndUpdate(
      id,
      {
        delivered,
        delivery_date: delivered ? new Date() : null
      },
      { new: true }
    );

    if (!updatedMobile) {
      return res.status(404).json({ error: "Mobile not found" });
    }

    res.status(200).json({ success: true, updatedMobile });
  } catch (error) {
    console.error("Error toggling delivery status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const toggleMobileStatus = async (req, res) => {
  const { id, field } = req.body;

  if (!id || !field) {
    return res.status(400).json({ error: "Missing required parameters: id or field" });
  }

  if (!["ready", "delivered", "returned"].includes(field)) {
    return res.status(400).json({ error: "Invalid field parameter" });
  }

  try {
    const mobile = await Mobile.findById(id);
    if (!mobile) {
      return res.status(404).json({ error: "Mobile record not found" });
    }

    const newValue = !mobile[field];
    const updateData = { [field]: newValue };

    if (field === "delivered") {
      updateData.delivery_date = newValue ? new Date() : null;
    }

    const updatedMobile = await Mobile.findByIdAndUpdate(id, updateData, { new: true });

    res.status(200).json({ success: true, updatedMobile });
  } catch (error) {
    console.error("Error toggling status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const addProduct = async (req, res) => {
  const { name, category, costPrice, sellingPrice, quantity, userId } = req.body;

  if (!name || !costPrice || !quantity || !userId) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const totalCost = costPrice * quantity;

    const newProduct = await Product.create({
      name,
      category,
      costPrice,
      sellingPrice,
      quantity,
      totalCost,
      userId
    });

    await ProductHistory.create({
      productId: newProduct._id,
      changeType: "ADD",
      quantity,
      costPrice,
      notes: "Initial stock added"
    });

    res.status(201).json({ message: 'Product added successfully.', product: newProduct });
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(500).json({ error: "Failed to add product." });
  }
};

const listProducts = async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required." });
  }

  try {
    const products = await Product.find({ userId })
      .sort({ updatedAt: -1 }); // Descending order

    res.status(200).json({ products });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Failed to fetch products." });
  }
};


const getProductHistory = async (req, res) => {
  const { productId } = req.params;

  if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ error: "Invalid productId format." });
  }

  try {
    const history = await ProductHistory.find({ productId })
      .sort({ changeDate: -1 });

    res.status(200).json({ history });
  } catch (error) {
    console.error("Error fetching product history:", error);
    res.status(500).json({ error: "Failed to fetch history." });
  }
};

const getFilteredProductHistory = async (req, res) => {
  const { productId } = req.params;
  const { fromDate, toDate, changeType } = req.body;

  if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ error: "Invalid productId format." });
  }

  const filters = { productId };

  if (fromDate && toDate) {
    filters.changeDate = {
      $gte: new Date(fromDate),
      $lte: new Date(toDate),
    };
  }

  if (changeType) {
    filters.changeType = changeType;
  }

  try {
    const history = await ProductHistory.find(filters).sort({ changeDate: -1 });
    res.status(200).json({ history });
  } catch (error) {
    console.error("Error fetching filtered history:", error);
    res.status(500).json({ error: "Failed to fetch product history." });
  }
};

const increaseStock = async (req, res) => {
  const { productId, quantityToAdd, costPrice } = req.body;

  if (!productId || !quantityToAdd || !costPrice) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ error: "Invalid productId format." });
  }

  try {
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ error: "Product not found." });
    }

    const updatedQuantity = product.quantity + parseInt(quantityToAdd);
    const updatedTotalCost = updatedQuantity * costPrice;

    // Update product quantity and total cost
    await Product.findByIdAndUpdate(productId, {
      quantity: updatedQuantity,
      totalCost: updatedTotalCost,
      costPrice: costPrice,
      updatedAt: new Date(),
    });

    // Create history entry
    await ProductHistory.create({
      productId: product._id,
      changeType: "RESTOCK",
      quantity: quantityToAdd,
      costPrice: costPrice,
      notes: "Stock increased",
    });

    res.status(200).json({ message: "Stock increased successfully.", product: { ...product.toObject(), quantity: updatedQuantity } });
  } catch (error) {
    console.error("Error increasing stock:", error);
    res.status(500).json({ error: "Failed to increase stock." });
  }
};

const sellProduct = async (req, res) => {
  const { productId, quantitySold, paidAmount } = req.body;

  if (!productId || !quantitySold || paidAmount === undefined) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ error: "Invalid productId format." });
  }

  try {
    const product = await Product.findById(productId);

    if (!product || product.quantity < quantitySold) {
      return res.status(400).json({ error: "Insufficient stock or invalid product." });
    }

    const updatedQuantity = product.quantity - quantitySold;
    const updatedTotalCost = updatedQuantity * product.costPrice;

    // Update product quantity and total cost
    await Product.findByIdAndUpdate(productId, {
      quantity: updatedQuantity,
      totalCost: updatedTotalCost,
      updatedAt: new Date(),
    });

    // Create history entry
    await ProductHistory.create({
      productId: product._id,
      changeType: "SELL",
      quantity: quantitySold,
      costPrice: product.costPrice,
      paidAmount,
      notes: "Product sold",
    });

    res.status(200).json({ message: "Product sold successfully." });
  } catch (error) {
    console.error("Error selling product:", error);
    res.status(500).json({ error: "Failed to process sale." });
  }
};


const getProductRevenueToday = async (req, res) => {
  try {
    const { startOfDay, endOfDay } = getISTTodayRange();

    const result = await ProductHistory.aggregate([
      {
        $match: {
          changeType: "SELL",
          changeDate: { $gte: startOfDay, $lte: endOfDay }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$paidAmount" }
        }
      }
    ]);

    const revenue = result[0]?.totalRevenue || 0;

    res.json({ revenue });
  } catch (error) {
    console.error("Failed to fetch product revenue:", error.message);
    res.status(500).json({ error: "Error fetching product revenue." });
  }
};


const addExpense = async (req, res) => {
  try {
    const { userId, title, amount, createdAt } = req.body;

    if (!userId || !title || !amount) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid shop_id format." });
    }

    const expense = await Expense.create({
      userId,
      title,
      amount,
      createdAt: createdAt ? new Date(createdAt) : new Date()
    });

    res.status(201).json({ message: "Expense added successfully.", expense });
  } catch (error) {
    console.error("❌ Error adding expense:", error);
    res.status(500).json({ error: "Failed to add expense." });
  }
};

const getTodayExpenses = async (req, res) => {
  try {
    const { userId, date } = req.body;

    if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Valid shop ID (userId) is required." });
    }

    const targetDate = date || formatIST(new Date(), 'YYYY-MM-DD');
    const start = getISTStartOfDay(new Date(targetDate));
    const end = getISTEndOfDay(new Date(targetDate));

    const expenses = await Expense.find({
      userId,
      createdAt: { $gte: start, $lte: end }
    }).sort({ createdAt: -1 });

    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

    res.status(200).json({ expenses, totalAmount });
  } catch (error) {
    console.error("❌ Error fetching today's expenses:", error);
    res.status(500).json({ error: "Failed to fetch expenses." });
  }
};

const updateDailySummary = async (req, res) => {
  const { userId, date, todayRevenue } = req.body;

  if (!userId || !date || todayRevenue === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const dayStart = getISTStartOfDay(new Date(date));
  const dayEnd = getISTEndOfDay(new Date(date));

  try {
    const expenses = await Expense.find({
      userId,
      createdAt: { $gte: dayStart, $lte: dayEnd },
    });

    const totalExpense = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const netRevenue = todayRevenue - totalExpense;

    await DailySummary.findOneAndUpdate(
      { userId, date: new Date(date) },
      {
        $set: {
          totalRevenue: todayRevenue,
          totalExpense,
          netRevenue,
        },
      },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true, totalExpense, netRevenue });
  } catch (error) {
    console.error("❌ Failed to update Daily Summary:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getAllDailySummaries = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid or missing shop_id." });
    }

    const summaries = await DailySummary.find({ userId })
      .sort({ date: -1 }); // Descending order

    res.status(200).json({ summaries });
  } catch (err) {
    console.error("Error fetching daily summaries:", err);
    res.status(500).json({ error: "Failed to fetch summaries." });
  }
};


const getDailySummary = async (req, res) => {
  try {
    const { userId, date } = req.body;

    if (!userId || !date || !userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Valid userId and date are required" });
    }

    const start = getISTStartOfDay(new Date(date));
    const end = getISTEndOfDay(new Date(date));

    // ✅ Fetch mobile records for customers and dealers of this shop
    const customers = await Customer.find({ shop_id: userId }).lean();
    const dealers = await Dealer.find({ shop_id: userId }).lean();

    const customerIds = customers.map(c => c._id);
    const dealerIds = dealers.map(d => d._id);

    const mobiles = await Mobile.find({
      added_date: { $gte: start, $lte: end },
      $or: [
        { customer_id: { $in: customerIds } },
        { dealer_id: { $in: dealerIds } }
      ]
    });

    const mobileRevenue = mobiles.reduce((sum, m) => sum + (m.paid_amount || 0), 0);

    // ✅ Fetch product sales revenue
    const products = await Product.find({ userId }).select("_id");
    const productIds = products.map(p => p._id);

    const productHistory = await ProductHistory.find({
      productId: { $in: productIds },
      changeType: "SELL",
      changeDate: { $gte: start, $lte: end }
    });

    const productRevenue = productHistory.reduce((sum, p) => sum + (p.paidAmount || 0), 0);

    const totalRevenue = mobileRevenue + productRevenue;

    res.status(200).json({ totalRevenue });
  } catch (error) {
    console.error("Error fetching daily summary:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ======================================
// 📱 Mobile Brands Management
// ======================================

// Get all mobile brands for a shop
const getMobileBrands = async (req, res) => {
  try {
    const { shopId } = req.params;

    if (!shopId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid shop ID format." });
    }

    const brands = await MobileBrand.find({ 
      $or: [{ shop_id: shopId }, { shop_id: null }], // Get shop-specific and global brands
      is_active: true 
    }).sort({ brand_name: 1 });

    res.status(200).json({ brands });
  } catch (error) {
    console.error("Error fetching mobile brands:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Add custom mobile brand
const addMobileBrand = async (req, res) => {
  try {
    const { shopId, brandName } = req.body;

    if (!shopId || !brandName) {
      return res.status(400).json({ error: "Shop ID and brand name are required." });
    }

    if (!shopId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid shop ID format." });
    }

    // Check if brand already exists for this shop
    const existingBrand = await MobileBrand.findOne({
      shop_id: shopId,
      brand_name: { $regex: new RegExp(`^${brandName}$`, 'i') }
    });

    if (existingBrand) {
      return res.status(400).json({ error: "Brand already exists for this shop." });
    }

    const newBrand = await MobileBrand.create({
      shop_id: shopId,
      brand_name: brandName.trim(),
      is_custom: true,
      is_active: true
    });

    res.status(201).json({ 
      message: "Mobile brand added successfully", 
      brand: newBrand 
    });
  } catch (error) {
    console.error("Error adding mobile brand:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ======================================
// 🔧 Mobile Issues Management  
// ======================================

// Get all mobile issues for a shop
const getMobileIssues = async (req, res) => {
  try {
    const { shopId } = req.params;

    if (!shopId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid shop ID format." });
    }

    const issues = await MobileIssue.find({ 
      $or: [{ shop_id: shopId }, { shop_id: null }], // Get shop-specific and global issues
      is_active: true 
    }).sort({ issue_category: 1, issue_name: 1 });

    // Group issues by category
    const groupedIssues = issues.reduce((acc, issue) => {
      const category = issue.issue_category || 'General';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(issue);
      return acc;
    }, {});

    res.status(200).json({ issues, groupedIssues });
  } catch (error) {
    console.error("Error fetching mobile issues:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Add custom mobile issue
const addMobileIssue = async (req, res) => {
  try {
    const { shopId, issueName, issueCategory, estimatedRepairTime } = req.body;

    if (!shopId || !issueName) {
      return res.status(400).json({ error: "Shop ID and issue name are required." });
    }

    if (!shopId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid shop ID format." });
    }

    // Check if issue already exists for this shop
    const existingIssue = await MobileIssue.findOne({
      shop_id: shopId,
      issue_name: { $regex: new RegExp(`^${issueName}$`, 'i') }
    });

    if (existingIssue) {
      return res.status(400).json({ error: "Issue already exists for this shop." });
    }

    const newIssue = await MobileIssue.create({
      shop_id: shopId,
      issue_name: issueName.trim(),
      issue_category: issueCategory || 'General',
      estimated_repair_time: estimatedRepairTime || 1,
      is_custom: true,
      is_active: true
    });

    res.status(201).json({ 
      message: "Mobile issue added successfully", 
      issue: newIssue 
    });
  } catch (error) {
    console.error("Error adding mobile issue:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  createCustomer, getCustomersWithBalance, updateBalanceAmount, clearBalanceAmount,addProduct,
  listProducts, getProductHistory,getFilteredProductHistory, sellProduct, increaseStock, getProductRevenueToday ,
addExpense, getTodayExpenses, updateDailySummary, getAllDailySummaries, getDailySummary,
  createDealer, getDealersWithBalance,updatePaidAmount,toggleDeliveryStatus,toggleMobileStatus,
  getAllDealers,getRecords,getTodayRecords,getTodaySales,updateBalance,fetchAllData , deleteMobileOrClient,
  getMobileBrands, addMobileBrand, getMobileIssues, addMobileIssue
};

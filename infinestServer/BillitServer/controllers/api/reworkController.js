const { Customer, Dealer, Mobile, ReworkRecord } = require("../../models/mongoModels");
const { getISTStartOfDay, getISTEndOfDay, getISTRangeBetween } = require("../../utils/dateHelper");

// Search delivered mobiles eligible to be added to the Rework list, with optional filters.
const searchDeliveredMobiles = async (req, res) => {
  try {
    const { shopId, clientName, mobileName, mobileNumber, imei, fromDate, toDate } = req.body;

    if (!shopId) {
      return res.status(400).json({ error: "Shop ID is required." });
    }

    const customerFilters = { shop_id: shopId };
    const dealerFilters = { shop_id: shopId };
    if (clientName) {
      customerFilters.client_name = { $regex: clientName, $options: "i" };
      dealerFilters.client_name = { $regex: clientName, $options: "i" };
    }
    if (mobileNumber) {
      customerFilters.mobile_number = { $regex: mobileNumber, $options: "i" };
      dealerFilters.mobile_number = { $regex: mobileNumber, $options: "i" };
    }

    const [customers, dealers] = await Promise.all([
      Customer.find(customerFilters).select("client_name mobile_number customer_type"),
      Dealer.find(dealerFilters).select("client_name mobile_number customer_type"),
    ]);
    const clientsById = new Map();
    customers.forEach((c) => clientsById.set(String(c._id), c));
    dealers.forEach((d) => clientsById.set(String(d._id), d));

    const mobileFilters = { shop_id: shopId, delivered: true };
    if (mobileName) mobileFilters.mobile_name = { $regex: mobileName, $options: "i" };
    if (imei) mobileFilters.imei = { $regex: imei, $options: "i" };

    if (clientName || mobileNumber) {
      const customerIds = customers.map((c) => c._id);
      const dealerIds = dealers.map((d) => d._id);
      mobileFilters.$or = [
        { customer_id: { $in: customerIds } },
        { dealer_id: { $in: dealerIds } },
      ];
    }

    if (fromDate && toDate) {
      const { start, end } = getISTRangeBetween(new Date(fromDate), new Date(toDate));
      mobileFilters.delivery_date = { $gte: start, $lte: end };
    } else if (fromDate) {
      mobileFilters.delivery_date = { $gte: getISTStartOfDay(new Date(fromDate)) };
    } else if (toDate) {
      mobileFilters.delivery_date = { $lte: getISTEndOfDay(new Date(toDate)) };
    }

    const mobiles = await Mobile.find(mobileFilters)
      .select(
        "mobile_name model imei issue technician_name added_date delivery_date has_warranty warranty_months warranty_expiry_date productName supplierName customer_id dealer_id"
      )
      .sort({ delivery_date: -1 })
      .limit(200);

    // Flag mobiles that already have an active (non-completed) rework entry so the UI can disable "Add"
    const activeReworkMobileIds = new Set(
      (
        await ReworkRecord.find({
          shop_id: shopId,
          mobile_id: { $in: mobiles.map((m) => m._id) },
          status: { $ne: "completed" },
        }).select("mobile_id")
      ).map((r) => String(r.mobile_id))
    );

    const results = mobiles
      .map((m) => {
        const client = clientsById.get(String(m.customer_id || m.dealer_id));
        if ((clientName || mobileNumber) && !client) return null;
        return {
          _id: m._id,
          mobile_name: m.mobile_name,
          model: m.model || "",
          imei: m.imei || "",
          issue: m.issue || "",
          technician_name: m.technician_name || "",
          added_date: m.added_date,
          delivery_date: m.delivery_date,
          has_warranty: m.has_warranty || false,
          warranty_months: m.warranty_months || null,
          warranty_expiry_date: m.warranty_expiry_date || null,
          productName: m.productName || "",
          supplierName: m.supplierName || "",
          client_name: client?.client_name || "N/A",
          mobile_number: client?.mobile_number || "N/A",
          customer_type: client?.customer_type || "Customer",
          customer_id: m.customer_id || null,
          dealer_id: m.dealer_id || null,
          already_in_rework: activeReworkMobileIds.has(String(m._id)),
        };
      })
      .filter(Boolean);

    return res.status(200).json({ mobiles: results });
  } catch (error) {
    console.error("Error searching delivered mobiles:", error.message);
    return res.status(500).json({ error: "Failed to search delivered mobiles." });
  }
};

// Add a delivered mobile to the Rework list with the customer's new complaint.
const addReworkRecord = async (req, res) => {
  try {
    const { shopId, mobileId, complaint } = req.body;
    if (!shopId || !mobileId || !complaint || !complaint.trim()) {
      return res.status(400).json({ error: "Shop ID, mobile ID and complaint are required." });
    }

    const mobile = await Mobile.findOne({ _id: mobileId, shop_id: shopId });
    if (!mobile) {
      return res.status(404).json({ error: "Mobile record not found." });
    }

    const client =
      (mobile.customer_id && (await Customer.findById(mobile.customer_id))) ||
      (mobile.dealer_id && (await Dealer.findById(mobile.dealer_id)));

    const reworkRecord = await ReworkRecord.create({
      shop_id: shopId,
      mobile_id: mobile._id,
      customer_id: mobile.customer_id || null,
      dealer_id: mobile.dealer_id || null,
      client_name: client?.client_name || "N/A",
      mobile_number: client?.mobile_number || "N/A",
      customer_type: client?.customer_type || "Customer",
      mobile_name: mobile.mobile_name,
      model: mobile.model || "",
      imei: mobile.imei || "",
      previous_issue: mobile.issue || "",
      previous_added_date: mobile.added_date,
      previous_delivery_date: mobile.delivery_date,
      technician_name: mobile.technician_name || "",
      has_warranty: mobile.has_warranty || false,
      warranty_months: mobile.warranty_months || null,
      warranty_expiry_date: mobile.warranty_expiry_date || null,
      productName: mobile.productName || "",
      supplierName: mobile.supplierName || "",
      complaint: complaint.trim(),
      status: "added",
    });

    return res.status(201).json({ reworkRecord });
  } catch (error) {
    console.error("Error adding rework record:", error.message);
    return res.status(500).json({ error: "Failed to add rework record." });
  }
};

// List rework records for a shop, optionally filtered by status.
const getReworkRecords = async (req, res) => {
  try {
    const { shopId, status } = req.body;
    if (!shopId) {
      return res.status(400).json({ error: "Shop ID is required." });
    }

    const filters = { shop_id: shopId };
    if (status && status !== "all") filters.status = status;

    const records = await ReworkRecord.find(filters).sort({ added_date: -1 });
    return res.status(200).json({ records });
  } catch (error) {
    console.error("Error fetching rework records:", error.message);
    return res.status(500).json({ error: "Failed to fetch rework records." });
  }
};

// Move a rework record between states: added -> working_on -> completed (or back).
const updateReworkStatus = async (req, res) => {
  try {
    const { id, status } = req.body;
    const validStatuses = ["added", "working_on", "completed"];
    if (!id || !validStatuses.includes(status)) {
      return res.status(400).json({ error: "A valid rework ID and status are required." });
    }

    const update = { status };
    if (status === "working_on") update.started_at = new Date();
    if (status === "completed") update.completed_at = new Date();

    const reworkRecord = await ReworkRecord.findByIdAndUpdate(id, update, { new: true });
    if (!reworkRecord) {
      return res.status(404).json({ error: "Rework record not found." });
    }

    return res.status(200).json({ reworkRecord });
  } catch (error) {
    console.error("Error updating rework status:", error.message);
    return res.status(500).json({ error: "Failed to update rework status." });
  }
};

module.exports = { searchDeliveredMobiles, addReworkRecord, getReworkRecords, updateReworkStatus };

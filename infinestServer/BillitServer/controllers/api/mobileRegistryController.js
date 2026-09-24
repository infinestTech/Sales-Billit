const mongoose = require("mongoose");
const { Mobile, Customer, Dealer } = require("../../models/mongoModels");
const { getISTStartOfDay, getISTEndOfDay } = require("../../utils/dateHelper");

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const STATUS_MATCHERS = {
  notReady: { processing: false, ready: false, delivered: false, returned: false, should_be_returned: false },
  processing: { processing: true, ready: false },
  readyNotDelivered: { ready: true, delivered: false },
  shouldBeReturned: { should_be_returned: true, returned: false },
  returned: { returned: true },
  delivered: { delivered: true },
};

// POST /api/mobile-registry — paginated, filterable listing so large shops (1000s of mobiles)
// never load more than one page of documents at a time.
const getMobileRegistry = async (req, res) => {
  try {
    const shopId = req.user?.shop_id;
    if (!shopId) return res.status(400).json({ error: "Shop ID is required." });

    const {
      clientName,
      customerType, // "" | "Customer" | "Dealer"
      mobileName,
      model,
      imei,
      technician,
      billNo,
      status, // "" (all) | notReady | processing | readyNotDelivered | shouldBeReturned | returned | delivered
      dateFrom,
      dateTo,
    } = req.body || {};

    const page = Math.max(1, parseInt(req.body?.page, 10) || 1);
    // Bulk PDF export is an explicit, infrequent user action — allow a much larger bounded
    // batch for it than the default page size used for normal browsing.
    const isExport = !!req.body?.forExport;
    const limit = isExport
      ? Math.min(3000, Math.max(1, parseInt(req.body?.limit, 10) || 500))
      : Math.min(100, Math.max(1, parseInt(req.body?.limit, 10) || 20));

    const mobileMatch = { shop_id: new mongoose.Types.ObjectId(shopId) };

    if (mobileName) mobileMatch.mobile_name = { $regex: escapeRegex(mobileName), $options: "i" };
    if (model) mobileMatch.model = { $regex: escapeRegex(model), $options: "i" };
    if (imei) mobileMatch.imei = { $regex: escapeRegex(imei), $options: "i" };
    if (technician) mobileMatch.technician_name = { $regex: escapeRegex(technician), $options: "i" };

    if (dateFrom || dateTo) {
      mobileMatch.added_date = {};
      if (dateFrom) mobileMatch.added_date.$gte = getISTStartOfDay(new Date(dateFrom));
      if (dateTo) mobileMatch.added_date.$lte = getISTEndOfDay(new Date(dateTo));
    }

    if (status && STATUS_MATCHERS[status]) {
      Object.assign(mobileMatch, STATUS_MATCHERS[status]);
    }

    // client_name / bill_no live on Customer/Dealer, not Mobile — resolve to ids first so the
    // Mobile query (which does the heavy pagination) only ever runs against shop_id + ids.
    if (clientName || billNo) {
      const clientQuery = { shop_id: shopId };
      if (clientName) clientQuery.client_name = { $regex: escapeRegex(clientName), $options: "i" };
      if (billNo) clientQuery.bill_no = { $regex: escapeRegex(billNo), $options: "i" };

      const [matchingCustomers, matchingDealers] = await Promise.all([
        customerType === "Dealer" ? [] : Customer.find(clientQuery).select("_id").lean(),
        customerType === "Customer" ? [] : Dealer.find(clientQuery).select("_id").lean(),
      ]);

      const custIds = matchingCustomers.map((c) => c._id);
      const dealIds = matchingDealers.map((d) => d._id);

      if (custIds.length === 0 && dealIds.length === 0) {
        return res.json({ success: true, mobiles: [], total: 0, page, totalPages: 0, limit });
      }

      mobileMatch.$or = [
        ...(custIds.length ? [{ customer_id: { $in: custIds } }] : []),
        ...(dealIds.length ? [{ dealer_id: { $in: dealIds } }] : []),
      ];
    } else if (customerType === "Customer") {
      mobileMatch.customer_id = { $exists: true, $ne: null };
    } else if (customerType === "Dealer") {
      mobileMatch.dealer_id = { $exists: true, $ne: null };
    }

    const [total, mobiles] = await Promise.all([
      Mobile.countDocuments(mobileMatch),
      Mobile.find(mobileMatch)
        .sort({ added_date: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select(
          "mobile_name model imei issue technician_name added_date processing ready delivered returned should_be_returned customer_id dealer_id images payments total_paid paid_amount"
        )
        .lean(),
    ]);

    // Only resolve client names for the ids present on this single page — never the whole shop.
    const custIds = mobiles.filter((m) => m.customer_id).map((m) => m.customer_id);
    const dealIds = mobiles.filter((m) => m.dealer_id).map((m) => m.dealer_id);

    const [custDocs, dealDocs] = await Promise.all([
      custIds.length ? Customer.find({ _id: { $in: custIds } }).select("client_name").lean() : [],
      dealIds.length ? Dealer.find({ _id: { $in: dealIds } }).select("client_name").lean() : [],
    ]);

    const clientMap = {};
    custDocs.forEach((c) => (clientMap[c._id.toString()] = { clientName: c.client_name, customerType: "Customer" }));
    dealDocs.forEach((d) => (clientMap[d._id.toString()] = { clientName: d.client_name, customerType: "Dealer" }));

    const data = mobiles.map((m) => {
      const clientKey = (m.customer_id || m.dealer_id || "").toString();
      const client = clientMap[clientKey] || {};
      return {
        id: m._id,
        clientId: clientKey,
        clientName: client.clientName || "Unknown",
        customerType: client.customerType || (m.customer_id ? "Customer" : "Dealer"),
        mobileName: m.mobile_name,
        model: m.model || "",
        imei: m.imei || "",
        issues: m.issue || "No issues specified",
        technician: m.technician_name || "",
        isProcessing: m.processing,
        isReady: m.ready,
        isDelivered: m.delivered,
        isReturn: m.returned,
        isShouldBeReturned: m.should_be_returned,
        addedDate: m.added_date,
        hasImages: Array.isArray(m.images) && m.images.length > 0,
        totalPaid:
          Number(m.total_paid) ||
          (Array.isArray(m.payments) ? m.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0) : 0) ||
          Number(m.paid_amount) ||
          0,
      };
    });

    return res.json({
      success: true,
      mobiles: data,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      limit,
    });
  } catch (error) {
    console.error("Error fetching mobile registry:", error);
    return res.status(500).json({ error: "Failed to fetch mobile registry." });
  }
};

module.exports = { getMobileRegistry };

const { Customer, Dealer, Mobile, Shop } = require("../../models/mongoModels");
const { getISTStartOfDay, getISTEndOfDay, getISTRangeBetween } = require("../../utils/dateHelper");

const MOBILE_FIELDS =
  "mobile_name model imei issue processing ready delivered returned should_be_returned paid_amount added_date delivery_date has_warranty warranty_months warranty_expiry_date customer_id dealer_id payment productName supplierName quantity supplierId supplier_amount payments total_paid";

const CLIENT_FIELDS = "client_name mobile_number whatsapp_number bill_no balance_amount estimated_cost customer_type";

// Above this many prefetched client ids, the $in list costs more than it saves
const MAX_PREFETCH_IDS = 5000;

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const containsRegex = (value) => ({ $regex: escapeRegex(value), $options: "i" });

const isTrue = (field) => ({ $eq: [field, true] });

// Row order per (shop, filters), reused for page 2+ so paging doesn't regroup every mobile.
// Page 1 (initial load / Search) always recomputes, so it is never staler than one browse session.
const ORDER_CACHE_TTL_MS = 2 * 60 * 1000;
const ORDER_CACHE_MAX = 20;
const orderCache = new Map();
// Mobile-view entries also carry per-row stats, so keep fewer of them
const MOBILE_CACHE_MAX = 8;
const mobileEntriesCache = new Map();

const readCache = (cache, key) => {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ORDER_CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit;
};

const writeCache = (cache, max, key, value) => {
  cache.delete(key);
  cache.set(key, { ...value, at: Date.now() });
  while (cache.size > max) {
    cache.delete(cache.keys().next().value);
  }
};

/**
 * Groups matching mobiles by owning customer/dealer inside MongoDB and returns the ordered
 * row keys plus status totals. Row membership and order mirror the old browser-side grouping.
 */
const computeRowOrder = async ({ shopOid, mobileFilters, clientFilters }) => {
  const match = { shop_id: shopOid, ...mobileFilters };

  // Same customer/dealer sets the legacy mode used, but only their ids
  const [custDocs, dealDocs] = await Promise.all([
    Customer.find({ shop_id: shopOid, ...clientFilters }).select("_id").lean(),
    Dealer.find({ shop_id: shopOid, ...clientFilters }).select("_id").lean(),
  ]);
  if (custDocs.length === 0 && dealDocs.length === 0) {
    return { order: [], totals: null };
  }
  const custIds = custDocs.map((c) => c._id);
  const dealIds = dealDocs.map((d) => d._id);

  // Selective text filters: narrow the mobile scan to the matching clients up front
  const hasTextFilter = clientFilters.client_name || clientFilters.mobile_number || clientFilters.bill_no;
  if (hasTextFilter && custIds.length + dealIds.length <= MAX_PREFETCH_IDS) {
    match.$or = [{ customer_id: { $in: custIds } }, { dealer_id: { $in: dealIds } }];
  }

  const active = { $and: [{ $not: [isTrue("$returned")] }, { $not: [isTrue("$should_be_returned")] }] };
  const flag = (cond) => ({ $cond: [cond, 1, 0] });

  const [result] = await Mobile.aggregate([
    { $match: match },
    {
      $project: {
        added_date: 1,
        returnCount: flag(isTrue("$returned")),
        shouldBeReturnedCount: flag({ $and: [{ $not: [isTrue("$returned")] }, isTrue("$should_be_returned")] }),
        notReadyFalseCount: flag({ $and: [active, { $not: [isTrue("$ready")] }] }),
        processingCount: flag({ $and: [active, { $not: [isTrue("$ready")] }, isTrue("$processing")] }),
        notReadyCount: flag({ $and: [active, isTrue("$ready")] }),
        deliveredCount: flag({ $and: [active, isTrue("$delivered")] }),
        notDeliveredFalseCount: flag({ $and: [active, { $not: [isTrue("$delivered")] }] }),
        // A mobile belongs to its customer row and/or its dealer row, same as the old client-side grouping
        owners: {
          $concatArrays: [
            { $cond: [{ $ifNull: ["$customer_id", false] }, [{ c: "$customer_id", d: null }], []] },
            { $cond: [{ $ifNull: ["$dealer_id", false] }, [{ c: null, d: "$dealer_id" }], []] },
          ],
        },
      },
    },
    { $unwind: "$owners" },
    {
      $group: {
        _id: "$owners",
        // Document $min compares `k` (_id) first, so this picks the earliest-inserted mobile's date
        first: { $min: { k: "$_id", d: "$added_date" } },
        returnCount: { $sum: "$returnCount" },
        shouldBeReturnedCount: { $sum: "$shouldBeReturnedCount" },
        notReadyFalseCount: { $sum: "$notReadyFalseCount" },
        processingCount: { $sum: "$processingCount" },
        notReadyCount: { $sum: "$notReadyCount" },
        deliveredCount: { $sum: "$deliveredCount" },
        notDeliveredFalseCount: { $sum: "$notDeliveredFalseCount" },
      },
    },
    // Keep only rows whose customer/dealer exists in this shop and matches the client filters
    { $match: { $or: [{ "_id.c": { $in: custIds } }, { "_id.d": { $in: dealIds } }] } },
    {
      $addFields: {
        ownerId: { $ifNull: ["$_id.c", "$_id.d"] },
        isDealer: { $cond: [{ $ifNull: ["$_id.c", false] }, 0, 1] },
        firstDate: "$first.d",
      },
    },
    { $sort: { firstDate: -1, isDealer: 1, ownerId: 1 } },
    {
      $facet: {
        order: [{ $project: { _id: 0, ownerId: 1, isDealer: 1 } }],
        totals: [
          {
            $group: {
              _id: null,
              notReadyCount: { $sum: "$notReadyCount" },
              processingCount: { $sum: "$processingCount" },
              deliveredCount: { $sum: "$deliveredCount" },
              notReadyFalseCount: { $sum: "$notReadyFalseCount" },
              notDeliveredFalseCount: { $sum: "$notDeliveredFalseCount" },
              returnCount: { $sum: "$returnCount" },
              shouldBeReturnedCount: { $sum: "$shouldBeReturnedCount" },
            },
          },
        ],
      },
    },
  ]);

  const totals = result?.totals?.[0] || null;
  if (totals) delete totals._id;
  return {
    order: (result?.order || []).map((r) => `${r.isDealer ? "d" : "c"}_${r.ownerId}`),
    totals,
  };
};

/**
 * Paginated mode: one page of rows plus the total row count and status totals for all rows.
 */
const getPagedRecords = async ({ shopOid, mobileFilters, clientFilters, page, limit }) => {
  const cacheKey = JSON.stringify({ s: String(shopOid), m: mobileFilters, c: clientFilters });
  let grouped = page > 1 ? readCache(orderCache, cacheKey) : null;
  if (!grouped) {
    grouped = await computeRowOrder({ shopOid, mobileFilters, clientFilters });
    writeCache(orderCache, ORDER_CACHE_MAX, cacheKey, grouped);
  }

  const total = grouped.order.length;
  const totals = grouped.totals;
  const rows = grouped.order.slice((page - 1) * limit, page * limit);

  if (rows.length === 0) return { rows: [], total, totals };

  const pageCustIds = rows.filter((k) => k.startsWith("c_")).map((k) => k.slice(2));
  const pageDealIds = rows.filter((k) => k.startsWith("d_")).map((k) => k.slice(2));
  const [pageCustomers, pageDealers, pageMobiles] = await Promise.all([
    pageCustIds.length ? Customer.find({ _id: { $in: pageCustIds } }).select(CLIENT_FIELDS).lean() : [],
    pageDealIds.length ? Dealer.find({ _id: { $in: pageDealIds } }).select(CLIENT_FIELDS).lean() : [],
    Mobile.find({
      shop_id: shopOid,
      ...mobileFilters,
      $or: [{ customer_id: { $in: pageCustIds } }, { dealer_id: { $in: pageDealIds } }],
    })
      .select(MOBILE_FIELDS)
      .sort({ _id: 1 })
      .lean(),
  ]);
  const clientsByKey = new Map([
    ...pageCustomers.map((c) => [`c_${c._id}`, c]),
    ...pageDealers.map((d) => [`d_${d._id}`, d]),
  ]);

  const byOwner = new Map();
  const push = (key, m) => {
    if (!byOwner.has(key)) byOwner.set(key, []);
    byOwner.get(key).push(m);
  };
  for (const m of pageMobiles) {
    if (m.customer_id) push(`c_${m.customer_id}`, m);
    if (m.dealer_id) push(`d_${m.dealer_id}`, m);
  }

  return {
    rows: rows
      .map((key) => {
        const client = clientsByKey.get(key);
        return client ? { ...client, MobileName: byOwner.get(key) || [] } : null;
      })
      .filter(Boolean),
    total,
    totals,
  };
};

// Stat slots for mobile-view entries, matching summarizeMobiles() in the mobile UI
const S_PENDING = 0, S_PROCESSING = 1, S_READY = 2, S_DELIVERED = 3, S_RETURNED = 4, S_SBR = 5, S_TOTAL = 6;
const EMPTY_STATS = [0, 0, 0, 0, 0, 0, 0];

/**
 * Mobile-view grouping. Mirrors the old MobileRecordsList browser logic:
 * every customer/dealer matching the client filters is a row (even with 0 matching mobiles),
 * a mobile belongs to its customer if it has customer_id, otherwise to its dealer,
 * and rows sort by their first mobile's added_date (rows without one sort last).
 */
const computeMobileEntries = async ({ shopOid, mobileFilters, clientFilters }) => {
  const [custDocs, dealDocs] = await Promise.all([
    Customer.find({ shop_id: shopOid, ...clientFilters }).select("_id balance_amount").sort({ _id: 1 }).lean(),
    Dealer.find({ shop_id: shopOid, ...clientFilters }).select("_id balance_amount").sort({ _id: 1 }).lean(),
  ]);
  const totals = { pending: 0, processing: 0, ready: 0, delivered: 0, returned: 0, shouldBeReturned: 0, balance: 0 };
  if (custDocs.length === 0 && dealDocs.length === 0) return { entries: [], totals };

  const match = { shop_id: shopOid, ...mobileFilters };
  const hasTextFilter = clientFilters.client_name || clientFilters.mobile_number || clientFilters.bill_no;
  if (hasTextFilter && custDocs.length + dealDocs.length <= MAX_PREFETCH_IDS) {
    match.$or = [
      { customer_id: { $in: custDocs.map((c) => c._id) } },
      { dealer_id: { $in: dealDocs.map((d) => d._id) } },
    ];
  }

  const notRet = { $not: [isTrue("$returned")] };
  const notSbr = { $not: [isTrue("$should_be_returned")] };
  const notDel = { $not: [isTrue("$delivered")] };
  const notReady = { $not: [isTrue("$ready")] };
  const flag = (cond) => ({ $sum: { $cond: [cond, 1, 0] } });

  const groups = await Mobile.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          o: { $ifNull: ["$customer_id", "$dealer_id"] },
          t: { $cond: [{ $ifNull: ["$customer_id", false] }, "c", "d"] },
        },
        // Document $min compares `k` (_id) first, so this picks the earliest-inserted mobile's date
        first: { $min: { k: "$_id", d: "$added_date" } },
        returned: flag(isTrue("$returned")),
        sbr: flag({ $and: [notRet, isTrue("$should_be_returned")] }),
        delivered: flag({ $and: [notRet, notSbr, isTrue("$delivered")] }),
        ready: flag({ $and: [notRet, notSbr, notDel, isTrue("$ready")] }),
        processing: flag({ $and: [notRet, notSbr, notDel, notReady, isTrue("$processing")] }),
        pending: flag({ $and: [notRet, notSbr, notDel, notReady, { $not: [isTrue("$processing")] }] }),
        total: { $sum: 1 },
      },
    },
  ]);

  const byKey = new Map();
  for (const g of groups) {
    if (g._id.o) byKey.set(`${g._id.t}_${g._id.o}`, g);
  }

  const toEntry = (type, doc) => {
    const key = `${type}_${doc._id}`;
    const g = byKey.get(key);
    const firstDate = g?.first?.d ? new Date(g.first.d).getTime() : 0;
    return {
      key,
      date: Number.isNaN(firstDate) ? 0 : firstDate,
      type: type === "c" ? 0 : 1,
      id: String(doc._id),
      balance: Number(doc.balance_amount || 0),
      s: g ? [g.pending, g.processing, g.ready, g.delivered, g.returned, g.sbr, g.total] : EMPTY_STATS,
    };
  };

  const entries = [...custDocs.map((c) => toEntry("c", c)), ...dealDocs.map((d) => toEntry("d", d))];
  entries.sort((a, b) => b.date - a.date || a.type - b.type || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  for (const e of entries) {
    totals.pending += e.s[S_PENDING];
    totals.processing += e.s[S_PROCESSING];
    totals.ready += e.s[S_READY];
    totals.delivered += e.s[S_DELIVERED];
    totals.returned += e.s[S_RETURNED];
    totals.shouldBeReturned += e.s[S_SBR];
    totals.balance += e.balance;
  }
  return { entries, totals };
};

const CHIP_TESTS = {
  pending: (e) => e.s[S_PENDING] > 0,
  processing: (e) => e.s[S_PROCESSING] > 0,
  ready: (e) => e.s[S_READY] > 0,
  delivered: (e) => e.s[S_TOTAL] > 0 && e.s[S_DELIVERED] === e.s[S_TOTAL],
  shouldBeReturned: (e) => e.s[S_SBR] > 0,
  returned: (e) => e.s[S_RETURNED] > 0,
  balance: (e) => e.balance > 0,
};

/**
 * Paginated mobile-view mode: quick search (`q`) and status chip are applied on the server.
 * Totals always cover every row for the applied filters, independent of `q`/`chip`.
 */
const getMobileViewPage = async ({ shopOid, mobileFilters, clientFilters, page, limit, q, chip, fresh }) => {
  const cacheKey = JSON.stringify({ s: String(shopOid), m: mobileFilters, c: clientFilters });
  let data = fresh ? null : readCache(mobileEntriesCache, cacheKey);
  if (!data) {
    data = await computeMobileEntries({ shopOid, mobileFilters, clientFilters });
    writeCache(mobileEntriesCache, MOBILE_CACHE_MAX, cacheKey, data);
  }

  let list = data.entries;
  const query = String(q || "").trim();
  if (query && list.length) {
    const re = containsRegex(query);
    const mobileMatch = { shop_id: shopOid, ...mobileFilters, $or: [{ mobile_name: re }, { imei: re }] };
    const clientMatch = { shop_id: shopOid, ...clientFilters, $or: [{ client_name: re }, { mobile_number: re }, { bill_no: re }] };
    const [cq, dq, mc, md] = await Promise.all([
      Customer.find(clientMatch).select("_id").lean(),
      Dealer.find(clientMatch).select("_id").lean(),
      Mobile.distinct("customer_id", { ...mobileMatch, customer_id: { $ne: null } }),
      Mobile.distinct("dealer_id", { ...mobileMatch, customer_id: null, dealer_id: { $ne: null } }),
    ]);
    const hits = new Set([
      ...cq.map((c) => `c_${c._id}`),
      ...dq.map((d) => `d_${d._id}`),
      ...mc.map((id) => `c_${id}`),
      ...md.map((id) => `d_${id}`),
    ]);
    list = list.filter((e) => hits.has(e.key));
  }
  if (Object.prototype.hasOwnProperty.call(CHIP_TESTS, chip)) list = list.filter(CHIP_TESTS[chip]);

  const total = list.length;
  const pageEntries = list.slice((page - 1) * limit, page * limit);
  if (pageEntries.length === 0) return { records: [], total, totals: data.totals };

  const pageCustIds = pageEntries.filter((e) => e.type === 0).map((e) => e.id);
  const pageDealIds = pageEntries.filter((e) => e.type === 1).map((e) => e.id);
  const [pageCustomers, pageDealers, pageMobiles] = await Promise.all([
    pageCustIds.length ? Customer.find({ _id: { $in: pageCustIds } }).select(CLIENT_FIELDS).lean() : [],
    pageDealIds.length ? Dealer.find({ _id: { $in: pageDealIds } }).select(CLIENT_FIELDS).lean() : [],
    Mobile.find({
      shop_id: shopOid,
      ...mobileFilters,
      $or: [
        { customer_id: { $in: pageCustIds } },
        { customer_id: null, dealer_id: { $in: pageDealIds } },
      ],
    })
      .select(MOBILE_FIELDS)
      .sort({ _id: 1 })
      .lean(),
  ]);

  const clients = new Map([
    ...pageCustomers.map((c) => [`c_${c._id}`, { ...c, customer_type: "Customer" }]),
    ...pageDealers.map((d) => [`d_${d._id}`, { ...d, customer_type: "Dealer" }]),
  ]);
  const mobilesByKey = new Map();
  for (const m of pageMobiles) {
    const key = m.customer_id ? `c_${m.customer_id}` : `d_${m.dealer_id}`;
    if (!mobilesByKey.has(key)) mobilesByKey.set(key, []);
    mobilesByKey.get(key).push(m);
  }

  return {
    records: pageEntries
      .map((e) => (clients.has(e.key) ? { ...clients.get(e.key), mobiles: mobilesByKey.get(e.key) || [] } : null))
      .filter(Boolean),
    total,
    totals: data.totals,
  };
};




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
      mobileDate,
      mobileNumber,
      page,
      limit,
      view,
      q,
      chip,
      fresh
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
      mobileFilters.mobile_name = containsRegex(mobileName);
    }
const shop = await Shop.findById(shopId).select("owner_name phone address").lean();




if (!shop) {
  return res.status(404).json({ error: "Shop not found." });
}




    // Handle date filters - mobileDate takes precedence over date range
    // Use IST timezone boundaries to ensure correct date matching for Indian users
    if (mobileDate) {
      // If specific mobile date is provided, use exact date match in IST
      const startOfDay = getISTStartOfDay(new Date(mobileDate));
      const endOfDay = getISTEndOfDay(new Date(mobileDate));
      mobileFilters.added_date = {
        $gte: startOfDay,
        $lte: endOfDay,
      };
    } else if (fromDate && toDate) {
      // Otherwise use date range if provided, with IST boundaries
      const { start, end } = getISTRangeBetween(new Date(fromDate), new Date(toDate));
      mobileFilters.added_date = {
        $gte: start,
        $lte: end,
      };
    }




    if (clientName) {
      customerFilters.client_name = containsRegex(clientName);
      dealerFilters.client_name = containsRegex(clientName);
    }

    if (mobileNumber) {
      customerFilters.mobile_number = containsRegex(mobileNumber);
      dealerFilters.mobile_number = containsRegex(mobileNumber);
    }




    if (customerType) {
      customerFilters.customer_type = customerType;
      dealerFilters.customer_type = customerType;
    }




    if (billNo) {
      customerFilters.bill_no = containsRegex(billNo);
      dealerFilters.bill_no = containsRegex(billNo);
    }

    const shopInfo = {
      shopOwnerName: shop.owner_name || "Not Provided",
      shopPhone: shop.phone || "Not Provided",
      shopaddress: shop.address || "Not Provided",
    };

    // Paginated mode (desktop All Records). Callers that omit `page` get the legacy full payload.
    if (page !== undefined && page !== null) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 7));
      const { shop_id: _omit, ...clientFilters } = customerFilters;
      const { shop_id: _omitMobile, ...mobileOnlyFilters } = mobileFilters;

      if (view === "mobile") {
        const mobileLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const result = await getMobileViewPage({
          shopOid: shop._id,
          mobileFilters: mobileOnlyFilters,
          clientFilters,
          page: pageNum,
          limit: mobileLimit,
          q: typeof q === "string" ? q : "",
          chip: typeof chip === "string" ? chip : "all",
          fresh: fresh === true,
        });
        return res.status(200).json({
          records: result.records,
          total: result.total,
          page: pageNum,
          limit: mobileLimit,
          hasMore: pageNum * mobileLimit < result.total,
          totals: result.totals,
          ...shopInfo,
        });
      }

      const { rows, total, totals } = await getPagedRecords({
        shopOid: shop._id,
        mobileFilters: mobileOnlyFilters,
        clientFilters,
        page: pageNum,
        limit: limitNum,
      });

      return res.status(200).json({
        records: rows,
        total,
        page: pageNum,
        limit: limitNum,
        totals: totals || {
          notReadyCount: 0,
          processingCount: 0,
          deliveredCount: 0,
          notReadyFalseCount: 0,
          notDeliveredFalseCount: 0,
          returnCount: 0,
          shouldBeReturnedCount: 0,
        },
        ...shopInfo,
      });
    }




    // Fetch matching customers and dealers
    const [customers, dealers] = await Promise.all([
      Customer.find(customerFilters).select(CLIENT_FIELDS).lean(),
      Dealer.find(dealerFilters).select(CLIENT_FIELDS).lean(),
    ]);




    const customerIds = customers.map(c => c._id);
    const dealerIds = dealers.map(d => d._id);




    // Fetch mobiles linked to customers or dealers
    const mobiles = await Mobile.find({
      ...mobileFilters,
      $or: [
        { customer_id: { $in: customerIds } },
        { dealer_id: { $in: dealerIds } },
      ]
    }).select(MOBILE_FIELDS).lean();




   // console.log(`Fetched ${mobiles.length} mobile records`);




   return res.status(200).json({
  mobiles,
  customers,
  dealers,
  ...shopInfo
});
  } catch (error) {
    console.error("Error fetching records:", error.message);
    return res.status(500).json({ error: "Failed to fetch records." });
  }
};




module.exports = { getFilteredRecords };













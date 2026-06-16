const { Mobile, Customer, Dealer } = require("../../models/mongoModels");

// Shared logic
async function computeDashboardRecords(shop_id, fromDate, toDate) {
    const query = { shop_id };

    if (fromDate || toDate) {
        query.added_date = {};
        if (fromDate) query.added_date.$gte = new Date(fromDate);
        if (toDate) query.added_date.$lte = new Date(toDate);
    }

    const [mobiles, customers, dealers] = await Promise.all([
        Mobile.find(query).lean(),
        Customer.find({ shop_id }).lean(),
        Dealer.find({ shop_id }).lean()
    ]);

    const totalMobiles = mobiles.length;
    const readyCount = mobiles.filter(m => m.ready).length;
    const notReadyCount = mobiles.filter(m => !m.ready).length;
    const deliveredCount = mobiles.filter(m => m.delivered).length;
    const notDeliveredCount = mobiles.filter(m => !m.delivered).length;
    const returnedCount = mobiles.filter(m => m.returned).length;
    const customersCount = customers.length;
    const dealersCount = dealers.length;

    return {
        totalMobiles,
        readyCount,
        notReadyCount,
        deliveredCount,
        notDeliveredCount,
        returnedCount,
        customersCount,
        dealersCount,
        mobiles,
        customers,
        dealers,
        computedAt: new Date()
    };
}

// POST (frontend with token)
exports.getDashboardRecords = async (req, res) => {
    try {
        const { shop_id, fromDate, toDate } = req.body;
        if (!shop_id) return res.status(400).json({ message: "shop_id required" });

        const data = await computeDashboardRecords(shop_id, fromDate, toDate);
        res.json(data);
    } catch (error) {
        console.error("Dashboard Records Fetch Error (POST):", error);
        res.status(500).json({ message: "Error fetching dashboard records" });
    }
}

// GET (Power BI/public testing)
exports.getDashboardRecordsPublic = async (req, res) => {
    try {
        const { shop_id } = req.params;
        const { fromDate, toDate } = req.query;
        if (!shop_id) return res.status(400).json({ message: "shop_id required in URL" });

        const data = await computeDashboardRecords(shop_id, fromDate, toDate);
        res.json(data);
    } catch (error) {
        console.error("Dashboard Records Fetch Error (GET):", error);
        res.status(500).json({ message: "Error fetching dashboard records (public)" });
    }
};
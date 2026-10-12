// Supplier credit ledger + spare stock tracking shared by the shop-admin supplier screens.
// Everything is derived from data both portals already write, so the user portal stays the source of
// truth for the balance (Supplier.totalAmount) and the spare stock (Product / ProductHistory).
const { Product, ProductHistory, SupplierHistory, Mobile } = require("../models/mongoModels");
const { SupplierPurchase } = require("../models/supplierPurchase");

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const toPaise = (n) => Math.round((Number(n) || 0) * 100);
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// "Added: <spare> x<qty> - ₹<amount>" is what the user-portal "use spare on a repair" flows log
const REPAIR_CREDIT_RE = /^Added:\s*(.*?)\s+x(\d+)\s+-\s+₹\s*([\d.]+)/i;
const FROM_STOCK_MARK = "from stock";

// Validates [{ productId?, name, quantity, costPrice }] and returns normalized items + total
function normalizeItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) return { error: "Add at least one product" };
  const items = [];
  for (const [i, raw] of rawItems.entries()) {
    const name = String(raw?.name || "").trim();
    const quantity = Number(raw?.quantity);
    const costPrice = Number(raw?.costPrice);
    if (!name) return { error: `Row ${i + 1}: product name is required` };
    if (!Number.isInteger(quantity) || quantity <= 0) return { error: `Row ${i + 1}: quantity must be a whole number above 0` };
    if (!Number.isFinite(costPrice) || costPrice < 0) return { error: `Row ${i + 1}: enter a valid purchase price` };
    const price = round2(costPrice);
    items.push({ productId: raw?.productId || null, name, quantity, costPrice: price, total: round2(quantity * price) });
  }
  const total = round2(items.reduce((s, it) => s + it.total, 0));
  return { items, total };
}

// Adds the items to the service spares inventory, linked to the supplier.
// A row with productId tops up that spare (only if it belongs to this shop and supplier); otherwise a new spare is created.
async function stockItems({ shopId, supplierId, items, purchaseType, date, note }) {
  const stored = [];
  const created = [];
  try {
    for (const it of items) {
      let product = null;
      let createdNew = false;
      if (it.productId) {
        product = await Product.findOne({ _id: it.productId, userId: shopId, supplierId });
      }
      if (product) {
        product.quantity = (Number(product.quantity) || 0) + it.quantity;
        product.costPrice = it.costPrice;
        product.totalCost = product.quantity * it.costPrice;
        product.updatedAt = new Date();
        await product.save();
        await ProductHistory.create({
          productId: product._id, changeDate: date, changeType: "RESTOCK",
          quantity: it.quantity, costPrice: it.costPrice, notes: note
        });
      } else {
        product = await Product.create({
          userId: shopId,
          name: it.name,
          costPrice: it.costPrice,
          quantity: it.quantity,
          totalCost: it.total,
          supplierId,
          paymentMethod: purchaseType === "credit" ? "credit" : "cash",
          addedDate: date
        });
        created.push(product._id);
        createdNew = true;
        await ProductHistory.create({
          productId: product._id, changeDate: date, changeType: "ADD",
          quantity: it.quantity, costPrice: it.costPrice, notes: note
        });
      }
      stored.push({ productId: product._id, name: product.name, quantity: it.quantity, costPrice: it.costPrice, total: it.total, createdNew });
    }
  } catch (err) {
    // Best-effort cleanup of spares created in this call so a failed save doesn't leave orphan stock
    if (created.length) {
      await Product.deleteMany({ _id: { $in: created } }).catch(() => {});
      await ProductHistory.deleteMany({ productId: { $in: created } }).catch(() => {});
    }
    throw err;
  }
  return stored;
}

// Oldest-first settlement: the outstanding balance is assumed to belong to the newest credit purchases,
// which is the same as applying every payment (from either portal) to the oldest purchase first.
function allocateSettlement(creditEntries, outstanding) {
  let remaining = toPaise(Math.max(0, outstanding));
  const sorted = [...creditEntries].sort((a, b) => new Date(b.date) - new Date(a.date));
  for (const e of sorted) {
    const totalP = toPaise(e.total);
    const unpaidP = Math.min(totalP, remaining);
    remaining -= unpaidP;
    e.unpaid = unpaidP / 100;
    e.paid = (totalP - unpaidP) / 100;
    e.status = unpaidP === 0 ? "paid" : unpaidP === totalP ? "unpaid" : "partial";
  }
  return remaining / 100; // balance not explained by any tracked purchase (e.g. manual edits)
}

async function buildSupplierLedger(shopId, supplier) {
  const supplierId = supplier._id;
  const [purchases, products, historyMsgs] = await Promise.all([
    SupplierPurchase.find({ userId: shopId, supplierId }).sort({ date: 1, _id: 1 }).lean(),
    Product.find({ userId: shopId, supplierId }).lean(),
    SupplierHistory.find({ userId: shopId, supplierId }).sort({ changeDate: 1, _id: 1 }).lean()
  ]);

  const productIds = products.map((p) => p._id);
  const productHistory = productIds.length
    ? await ProductHistory.find({ productId: { $in: productIds } }).sort({ changeDate: 1 }).lean()
    : [];
  const historyByProduct = new Map();
  for (const h of productHistory) {
    const k = String(h.productId);
    if (!historyByProduct.has(k)) historyByProduct.set(k, []);
    historyByProduct.get(k).push(h);
  }

  // Spares created by a shop-admin bill are already covered by that bill
  const trackedProductIds = new Set();
  purchases.forEach((p) => p.items.forEach((it) => it.productId && it.createdNew && trackedProductIds.add(String(it.productId))));

  // 1) Bills entered from shop-admin
  const entries = purchases.map((p) => ({
    id: String(p._id),
    source: p.kind === "opening" ? "opening" : "purchase",
    purchaseType: p.purchaseType,
    paymentMethod: p.paymentMethod || "",
    billNo: p.billNo || "",
    date: p.date,
    total: round2(p.totalAmount),
    items: p.items.map((it) => ({ productId: it.productId ? String(it.productId) : null, name: it.name, quantity: it.quantity, costPrice: it.costPrice, total: it.total })),
    notes: p.notes || ""
  }));

  // 2) Spares bought on credit from the user-portal inventory page (one spare per purchase)
  for (const p of products) {
    if (p.paymentMethod !== "credit" || trackedProductIds.has(String(p._id))) continue;
    const add = (historyByProduct.get(String(p._id)) || []).find((h) => h.changeType === "ADD");
    const qty = Number(add?.quantity ?? p.quantity) || 0;
    const cost = Number(add?.costPrice ?? p.costPrice) || 0;
    entries.push({
      id: `product-${p._id}`,
      source: "spare",
      purchaseType: "credit",
      paymentMethod: "credit",
      billNo: "",
      date: add?.changeDate || p.addedDate,
      total: round2(qty * cost),
      items: [{ productId: String(p._id), name: p.name, quantity: qty, costPrice: cost, total: round2(qty * cost) }],
      notes: "Added from Service Inventory"
    });
  }

  // 3) Spares bought on credit straight onto a repair (not from stock)
  for (const h of historyMsgs) {
    const m = REPAIR_CREDIT_RE.exec(h.message || "");
    if (!m || (h.message || "").toLowerCase().includes(FROM_STOCK_MARK) || typeof h.totalAmount !== "number") continue;
    const amount = round2(m[3]);
    if (amount <= 0) continue;
    entries.push({
      id: `history-${h._id}`,
      source: "repair",
      purchaseType: "credit",
      paymentMethod: "credit",
      billNo: "",
      date: h.changeDate,
      total: amount,
      items: [{ productId: null, name: m[1], quantity: Number(m[2]) || 0, costPrice: null, total: amount }],
      notes: "Spare bought for a repair"
    });
  }

  const creditEntries = entries.filter((e) => e.purchaseType === "credit");
  entries.filter((e) => e.purchaseType === "cash").forEach((e) => { e.paid = e.total; e.unpaid = 0; e.status = "paid"; });
  const outstanding = round2(supplier.totalAmount);
  const untrackedBalance = round2(allocateSettlement(creditEntries, outstanding));
  entries.sort((a, b) => new Date(b.date) - new Date(a.date));

  const payments = historyMsgs
    .filter((h) => Number(h.paidAmount) > 0)
    .map((h) => ({
      id: String(h._id),
      date: h.changeDate,
      amount: round2(h.paidAmount),
      paymentMethod: h.paymentMethod || "",
      previousAmount: typeof h.previousAmount === "number" ? round2(h.previousAmount) : null,
      balanceAfter: typeof h.totalAmount === "number" ? round2(h.totalAmount) : null,
      note: h.message || ""
    }))
    .reverse();

  // Per-spare stock movement, plus the repairs that recorded this spare
  const names = [...new Set(products.map((p) => p.name).filter(Boolean))];
  const repairs = names.length
    ? await Mobile.find({
      shop_id: shopId,
      $or: names.map((n) => ({ productName: { $regex: `^\\s*${escapeRegex(n.trim())}\\s*$`, $options: "i" } }))
    })
      .select("productName quantity mobile_name model update_date created_at customer_id dealer_id supplierName")
      .populate("customer_id", "client_name")
      .populate("dealer_id", "client_name")
      .sort({ update_date: -1, created_at: -1 })
      .limit(500)
      .lean()
    : [];

  const stock = products.map((p) => {
    const hist = historyByProduct.get(String(p._id)) || [];
    const sum = (types) => hist.filter((h) => types.includes(h.changeType)).reduce((s, h) => s + (Number(h.quantity) || 0), 0);
    const key = String(p.name || "").trim().toLowerCase();
    const usedOn = repairs
      .filter((r) => String(r.productName || "").trim().toLowerCase() === key)
      .slice(0, 25)
      .map((r) => ({
        mobileId: String(r._id),
        client: r.customer_id?.client_name || r.dealer_id?.client_name || "",
        device: [r.mobile_name, r.model].filter(Boolean).join(" "),
        quantity: Number(r.quantity) || 1,
        date: r.update_date || r.created_at
      }));
    return {
      productId: String(p._id),
      name: p.name,
      costPrice: round2(p.costPrice),
      purchasedQty: sum(["ADD", "RESTOCK"]),
      usedQty: sum(["SELL", "USE_SPARE"]),
      returnedQty: sum(["RETURN_TO_SUPPLIER"]),
      inStock: Number(p.quantity) || 0,
      paymentMethod: p.paymentMethod || "",
      usedOn
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const totalCreditPurchased = round2(creditEntries.reduce((s, e) => s + e.total, 0));
  return {
    supplier: {
      _id: String(supplier._id),
      supplierName: supplier.supplierName,
      agencyName: supplier.agencyName || "",
      phoneNumber: supplier.phoneNumber || "",
      address: supplier.address || "",
      openingCredit: round2(supplier.openingCredit),
      openingCreditDate: supplier.openingCreditDate || null,
      totalAmount: outstanding,
      createdAt: supplier.createdAt
    },
    summary: {
      openingCredit: round2(supplier.openingCredit),
      outstanding,
      totalCreditPurchased,
      totalPaid: round2(payments.reduce((s, p) => s + p.amount, 0)),
      unpaidPurchases: creditEntries.filter((e) => e.status !== "paid").length,
      untrackedBalance,
      stockValue: round2(stock.reduce((s, it) => s + it.inStock * it.costPrice, 0))
    },
    purchases: entries,
    payments,
    stock
  };
}

module.exports = { normalizeItems, stockItems, buildSupplierLedger, allocateSettlement, toPaise, round2, REPAIR_CREDIT_RE, FROM_STOCK_MARK };

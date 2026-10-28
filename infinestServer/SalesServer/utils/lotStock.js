/**
 * Lot stock: pouches and tempered glass bought in bulk and stocked by price category instead of
 * as individual products (e.g. tempered glass "D8" = ₹18–50, 1000 pieces).
 *
 * Categories are a shop-wide list on the shared Shop document:
 *   Shop.sales_settings.lot_categories = [{ id, type: 'temper' | 'pouch', name: 'D8', minPrice, maxPrice }]
 * A category is stocked as one item with productNo `TEMPER-D8` / `POUCH-D8` (the barcode value) unless
 * the purchase names its own product code,
 * carrying lotType + lotCategory. Each branch holds a single BranchStock row per category; every
 * purchase or supply tops that row up and averages its cost per piece. The POS shows the category's
 * current price range and starts the unit price at its minimum.
 */
const Shop = require('../models/shop');

const LOT_TYPES = {
  temper: { label: 'Tempered Glass', code: 'TEMPER' },
  pouch: { label: 'Pouch', code: 'POUCH' },
};

const isLotType = (type) => Object.prototype.hasOwnProperty.call(LOT_TYPES, type);

/** Any name the shop likes ("D+", "Gorila glass 9H"): trimmed, single spaces, at most 60 characters. '' when empty. */
function normalizeLotName(name) {
  return String(name == null ? '' : name).trim().replace(/\s+/g, ' ').slice(0, 60);
}

/** Optional product code typed on a lot purchase; '' means "use the category's default code". */
const normalizeLotCode = (code) => String(code == null ? '' : code).trim().replace(/\s+/g, ' ').slice(0, 60);

const lotProductNo = (type, name) => `${LOT_TYPES[type].code}-${String(name).replace(/ /g, '-')}`;
const lotProductName = (type, name) => `${LOT_TYPES[type].label} ${name}`;
/** Stable id of a branch's stock row for a lot product code ("branch_" keeps it out of admin supply lists). */
const branchLotProductId = (branchId, type, productNo) => `branch_lot_${branchId}_${type}_${productNo}`;

async function loadLotCategories(shopId) {
  const shop = await Shop.findById(shopId).select('sales_settings.lot_categories').lean();
  const list = shop && shop.sales_settings && Array.isArray(shop.sales_settings.lot_categories)
    ? shop.sales_settings.lot_categories : [];
  return list.filter((c) => c && isLotType(c.type) && c.name);
}

const findLotCategory = (list, type, name) => {
  const n = normalizeLotName(name);
  const lower = n.toLowerCase();
  return list.find((c) => c.type === type && c.name === n)
    || list.find((c) => c.type === type && String(c.name).toLowerCase() === lower) || null;
};

/** Validates a lot reference from a client payload: { lotType, lotCategory } -> category or an error. */
function resolveLotRef(list, lotType, lotCategory) {
  if (!isLotType(lotType)) return { error: 'Unknown lot type' };
  const category = findLotCategory(list, lotType, lotCategory);
  if (!category) return { error: `${LOT_TYPES[lotType].label} category "${lotCategory}" does not exist` };
  return { category };
}

/** Adds the category's current price range (priceMin / priceMax) to lot stock rows. */
async function withLotRanges(rows, shopId) {
  if (!Array.isArray(rows) || !rows.some((r) => r && r.lotType)) return rows;
  const list = await loadLotCategories(shopId);
  return rows.map((r) => {
    if (!r || !r.lotType) return r;
    const c = findLotCategory(list, r.lotType, r.lotCategory);
    return { ...r, priceMin: c ? c.minPrice : null, priceMax: c ? c.maxPrice : null };
  });
}

module.exports = {
  LOT_TYPES, isLotType, normalizeLotName, normalizeLotCode, lotProductNo, lotProductName, branchLotProductId,
  loadLotCategories, findLotCategory, resolveLotRef, withLotRanges,
};

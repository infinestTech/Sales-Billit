const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const requireUser = require('../middleware/requireUser');
const Shop = require('../models/shop');
const { LOT_TYPES, isLotType, normalizeLotName, lotProductNo, loadLotCategories } = require('../utils/lotStock');

// Pouch / tempered glass price categories (utils/lotStock.js). Shop-wide; owner and branch tokens can manage them.

const toFrontend = (c) => ({
  id: c.id, type: c.type, name: c.name, minPrice: c.minPrice, maxPrice: c.maxPrice,
  typeLabel: LOT_TYPES[c.type].label, productNo: lotProductNo(c.type, c.name),
});

function parseRange(body) {
  const min = Number(body.minPrice);
  const max = Number(body.maxPrice);
  if (!Number.isFinite(min) || min < 0) return { error: 'Minimum price must be 0 or more' };
  if (!Number.isFinite(max) || max < min) return { error: 'Maximum price must be at least the minimum price' };
  return { minPrice: Math.round(min * 100) / 100, maxPrice: Math.round(max * 100) / 100 };
}

const saveList = (shopId, list) =>
  Shop.updateOne({ _id: shopId }, { $set: { 'sales_settings.lot_categories': list } });

router.get('/api/lot-categories', requireUser, async (req, res) => {
  try {
    const list = await loadLotCategories(req.user.shop_id);
    const sorted = list.slice().sort((a, b) => a.type.localeCompare(b.type) || a.minPrice - b.minPrice || a.name.localeCompare(b.name));
    return res.json({ success: true, categories: sorted.map(toFrontend) });
  } catch (err) {
    console.error('lot-categories list error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Failed to load categories' });
  }
});

router.post('/api/lot-categories', requireUser, async (req, res) => {
  try {
    const body = req.body || {};
    if (!isLotType(body.type)) return res.status(400).json({ success: false, message: 'Type must be temper or pouch' });
    const name = normalizeLotName(body.name);
    if (!name) return res.status(400).json({ success: false, message: 'Enter a category name' });
    const range = parseRange(body);
    if (range.error) return res.status(400).json({ success: false, message: range.error });

    const list = await loadLotCategories(req.user.shop_id);
    if (list.some((c) => c.type === body.type && String(c.name).toLowerCase() === name.toLowerCase())) {
      return res.status(409).json({ success: false, message: `${LOT_TYPES[body.type].label} category ${name} already exists` });
    }
    const category = { id: crypto.randomBytes(6).toString('hex'), type: body.type, name, ...range };
    await saveList(req.user.shop_id, [...list, category]);
    return res.status(201).json({ success: true, category: toFrontend(category) });
  } catch (err) {
    console.error('lot-categories create error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Failed to save the category' });
  }
});

// Only the price range can change: the name is part of the barcode already printed on labels.
router.patch('/api/lot-categories/:id', requireUser, async (req, res) => {
  try {
    const range = parseRange(req.body || {});
    if (range.error) return res.status(400).json({ success: false, message: range.error });
    const list = await loadLotCategories(req.user.shop_id);
    const idx = list.findIndex((c) => c.id === req.params.id);
    if (idx < 0) return res.status(404).json({ success: false, message: 'Category not found' });
    const next = list.slice();
    next[idx] = { ...list[idx], ...range };
    await saveList(req.user.shop_id, next);
    return res.json({ success: true, category: toFrontend(next[idx]) });
  } catch (err) {
    console.error('lot-categories update error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Failed to update the category' });
  }
});

// Stock already held keeps its rows; the POS just stops showing a price range for it.
router.delete('/api/lot-categories/:id', requireUser, async (req, res) => {
  try {
    const list = await loadLotCategories(req.user.shop_id);
    if (!list.some((c) => c.id === req.params.id)) return res.status(404).json({ success: false, message: 'Category not found' });
    await saveList(req.user.shop_id, list.filter((c) => c.id !== req.params.id));
    return res.json({ success: true });
  } catch (err) {
    console.error('lot-categories delete error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Failed to delete the category' });
  }
});

module.exports = router;

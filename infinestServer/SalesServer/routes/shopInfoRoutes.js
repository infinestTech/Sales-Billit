const express = require('express');
const router = express.Router();
const requireUser = require('../middleware/requireUser');
const Shop = require('../models/shop');

// Shop display name for printed labels; works for owner and branch tokens
router.get('/api/shop-info', requireUser, async (req, res) => {
  try {
    const shop = await Shop.findById(req.user.shop_id).lean();
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
    const shopName = shop.shop_name || (shop.owner_name ? `${shop.owner_name}'s Shop` : '');
    return res.json({ success: true, shopName, location: shop.location || '' });
  } catch (err) {
    console.error('shop-info error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const requireUser = require('../middleware/requireUser');
const Shop = require('../models/shop');
const { parsePriceCipher } = require('../utils/priceCipher');

// Shop display name, contact and price code cipher for printed labels / receipts; works for owner and branch tokens
router.get('/api/shop-info', requireUser, async (req, res) => {
  try {
    const shop = await Shop.findById(req.user.shop_id).lean();
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
    const shopName = shop.shop_name || (shop.owner_name ? `${shop.owner_name}'s Shop` : '');
    // Price code cipher set from the branch portal (10 chars for digits 1234567890, '' = not set up)
    const { cipher: priceCipher = '' } = parsePriceCipher((shop.sales_settings && shop.sales_settings.price_cipher) || '');
    return res.json({
      success: true,
      shopName,
      location: shop.location || '',
      email: shop.email || '',
      phone: shop.phone || '',
      priceCipher
    });
  } catch (err) {
    console.error('shop-info error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Branch portal "Price Code" screen: one cipher for the whole shop (labels and inventory in every branch use it)
router.patch('/api/shop-info/price-cipher', requireUser, async (req, res) => {
  try {
    const parsed = parsePriceCipher(req.body && req.body.cipher);
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
    const shop = await Shop.findByIdAndUpdate(
      req.user.shop_id,
      { $set: { 'sales_settings.price_cipher': parsed.cipher } },
      { new: true }
    ).lean();
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
    return res.json({ success: true, priceCipher: (shop.sales_settings && shop.sales_settings.price_cipher) || '' });
  } catch (err) {
    console.error('price-cipher update error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Failed to save the price code' });
  }
});

module.exports = router;

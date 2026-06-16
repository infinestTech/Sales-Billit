const WhatsappContact = require('../models/whatsappContact');

exports.createContact = async (req, res) => {
  try {
    const { shop_id, userId } = req.user || {};
    if (!shop_id) return res.status(400).json({ success: false, message: 'Shop missing' });

    const { name = '', number = '', district = '' } = req.body || {};
    if (!name || !number || !district) return res.status(400).json({ success: false, message: 'name, number and district are required' });

    const doc = await WhatsappContact.create({
      shop_id,
      name,
      number,
      district,
      createdBy: String(userId || ''),
      updatedBy: String(userId || ''),
    });

    return res.json({ success: true, contact: doc });
  } catch (err) {
    console.error('createContact error:', err.message || err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.listContacts = async (req, res) => {
  try {
    const { shop_id } = req.user || {};
    if (!shop_id) return res.status(400).json({ success: false, message: 'Shop missing' });

    const contacts = await WhatsappContact.find({ shop_id }).sort({ createdAt: -1 }).lean();

    // Aggregate WhatsappSale totals by customerNo for this shop
    try {
      const WhatsappSale = require('../models/whatsappSale');
      const agg = await WhatsappSale.aggregate([
        { $match: { shop_id: shop_id } },
        { $group: { _id: { $ifNull: ["$customerNo", ""] }, total: { $sum: { $ifNull: ["$totalAmount", 0] } } } }
      ]).allowDiskUse(true);
      const map = new Map((agg || []).map(a => [String(a._id || '').replace(/[^0-9]/g, ''), Number(a.total || 0)]));
      // attach purchaseAmount to each contact by normalizing numbers
      const enriched = contacts.map(c => {
        const norm = (c.number || '').toString().replace(/[^0-9]/g, '');
        const val = map.get(norm) || 0;
        return { ...c, purchaseAmount: Number(val) };
      });
      return res.json({ success: true, contacts: enriched });
    } catch (e) {
      console.error('listContacts: aggregation failed', e && e.message || e);
      // fallback: return contacts with zero purchaseAmount
      const enriched = contacts.map(c => ({ ...c, purchaseAmount: 0 }));
      return res.json({ success: true, contacts: enriched });
    }
  } catch (err) {
    console.error('listContacts error:', err.message || err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

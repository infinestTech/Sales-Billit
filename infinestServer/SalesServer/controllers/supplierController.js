const Supplier = require('../models/supplier');


exports.createSupplier = async (req, res) => {
  try {
    const { shop_id, userId } = req.user || {};
    if (!shop_id) return res.status(400).json({ success: false, message: 'Shop missing' });


    const {
      supplierName = '',
      agencyName = '',
      phoneNumber = '',
      address = '',
      gstNumber = '',
      panNumber = ''
    } = req.body || {};


    // Check supplier limit from plan features (if any)
    try {
      const Feature = require('../models/feature');
      const mongoPlanId = req.user.mongoPlanId;
      if (mongoPlanId) {
        const limitFeature = await Feature.findOne({ plan_id: mongoPlanId, feature_key: 'suppliers_limit' }).lean();
        if (limitFeature && limitFeature.type === 'limit' && limitFeature.config && typeof limitFeature.config.maxSuppliers === 'number') {
          const currentCount = await Supplier.countDocuments({ shop_id });
          if (currentCount >= limitFeature.config.maxSuppliers) {
            return res.status(403).json({ success: false, message: `Supplier limit reached (${currentCount}/${limitFeature.config.maxSuppliers})` });
          }
        }
      }
    } catch (e) {
      console.warn('Could not enforce supplier limit:', e.message);
    }


    const doc = await Supplier.create({
      shop_id,
      supplierName,
      agencyName,
      phoneNumber,
      address,
      gstNumber,
      panNumber,
      createdBy: String(userId || ''),
      updatedBy: String(userId || ''),
    });


    return res.json({ success: true, supplier: doc });
  } catch (err) {
    console.error('createSupplier error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};


exports.listSuppliers = async (req, res) => {
  try {
    const { shop_id } = req.user || {};
    if (!shop_id) return res.status(400).json({ success: false, message: 'Shop missing' });


    const suppliers = await Supplier.find({ shop_id }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, suppliers });
  } catch (err) {
    console.error('listSuppliers error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};





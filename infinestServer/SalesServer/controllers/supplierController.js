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


    // If this is a branch user, allow access regardless of plan feature flag / limits
    // Branch tokens are intended for branch-level operations and should not be blocked
    // by the parent shop's subscription checks in this controller.
    if (!req.user?.isBranch) {
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
    } else {
      console.log('Branch user creating supplier - skipping plan limit checks');
    }


    const supplierData = {
      shop_id,
      supplierName,
      agencyName,
      phoneNumber,
      address,
      gstNumber,
      panNumber,
      createdBy: String(userId || ''),
      updatedBy: String(userId || ''),
    };

    // If branch token provided, attach branch info to the supplier document
    if (req.user?.isBranch) {
      supplierData.branch_id = String(req.user.branch_id || '');
      supplierData.branch_name = String(req.user.branchName || '');
    }

    const doc = await Supplier.create(supplierData);


    return res.json({ success: true, supplier: doc });
  } catch (err) {
    console.error('createSupplier error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};


exports.listSuppliers = async (req, res) => {
  try {
    // Branch tokens include shop_id; fall back to shop_id on user when available
    const shop_id = req.user?.shop_id || (req.user && req.user.branch_id ? req.user.shop_id : null);
    if (!shop_id) return res.status(400).json({ success: false, message: 'Shop missing' });

    // Build query: admin users get all suppliers, branch users should only see their branch's suppliers
    const query = { shop_id };
    // If branch user, restrict to their branch
    if (req.user?.isBranch) {
      query.branch_id = String(req.user.branch_id || '');
    }
    // Admins may request only branch-created suppliers via ?only_branch=1
    if (!req.user?.isBranch && String(req.query.only_branch || '') === '1') {
      query.branch_id = { $ne: '' };
    }

    const suppliers = await Supplier.find(query).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, suppliers });
  } catch (err) {
    console.error('listSuppliers error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};





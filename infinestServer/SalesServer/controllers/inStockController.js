const InStock = require('../models/inStock');

// Helper function to get product inventory limit
async function getProductInventoryLimit(userId, shopId, mongoPlanId) {
  try {
    const { Feature } = require('../models/feature');
    const feature = await Feature.findOne({ 
      plan_id: 'sales-premium',
      feature_key: 'product_inventory_limit' 
    });
    
    if (feature?.config?.maxProducts) {
      return feature.config.maxProducts;
    }
    return 150; // Fallback
  } catch (err) {
    console.error('Error fetching product inventory limit:', err.message);
    return 150;
  }
}

exports.createInStock = async (req, res) => {
  try {
  console.debug('createInStock payload items:', JSON.stringify(req.body.items || []));
  const { shop_id, userId } = req.user || {};
    if (!shop_id) return res.status(400).json({ success: false, message: 'Shop missing' });


  // Branch users are not allowed to create in-stock entries via this endpoint
  if (req.user.isBranch) return res.status(403).json({ success: false, message: 'Branches cannot create in-stock entries' });


  const { supplier_id, supplierAmount = 0, gstAmount = 0, items = [], purchaseType = 'normal', creditAmount = 0 } = req.body || {};
    if (!supplier_id) return res.status(400).json({ success: false, message: 'supplier_id is required' });
    if (purchaseType === 'credit' && (!creditAmount || Number(creditAmount) <= 0)) {
      return res.status(400).json({ success: false, message: 'Credit amount is required for credit purchases' });
    }

  // Check product inventory limit
  const productLimit = await getProductInventoryLimit(userId, shop_id, req.user.mongoPlanId);
  
  // Count existing unique products across all InStock documents
  const existingDocs = await InStock.find({ shop_id }).lean();
  const existingProducts = new Set();
  existingDocs.forEach(doc => {
    doc.items.forEach(item => {
      if (item.productNo) {
        existingProducts.add(item.productNo);
      }
    });
  });
  
  // Count new unique products being added
  const newProducts = new Set();
  items.forEach(item => {
    if (item.productNo && !existingProducts.has(item.productNo)) {
      newProducts.add(item.productNo);
    }
  });
  
  const totalUniqueProducts = existingProducts.size + newProducts.size;
  
  console.log(`📦 Product creation check: ${totalUniqueProducts}/${productLimit} (adding ${newProducts.size} new products)`);
  
  if (totalUniqueProducts > productLimit) {
    return res.status(403).json({ 
      success: false, 
      message: `Product inventory limit reached. Your plan allows ${productLimit} unique products. You currently have ${existingProducts.size} products and are trying to add ${newProducts.size} new ones.` 
    });
  }


  const doc = await InStock.create({
      shop_id,
      supplier_id,
      purchaseType: purchaseType || 'normal',
      creditAmount: purchaseType === 'credit' ? (Number(creditAmount) || 0) : 0,
      supplierAmount: Number(supplierAmount) || 0,
      gstAmount: Number(gstAmount) || 0,
      items: (items || []).map(i => {
        // Helper to generate random alphanumeric string (3-6 chars)
        function randomProductNo() {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
          const len = Math.floor(Math.random() * 4) + 3; // 3 to 6
          let str = '';
          for (let j = 0; j < len; j++) {
            str += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return str;
        }
        // Use manual input as-is, only auto-generate if blank
        // Determine totalQuantity: prefer explicit imes length (for mobiles) if provided, else use quantity
        const imesArray = Array.isArray(i.imes) ? i.imes.map(x => (x || '').toString()) : [];
        const computedTotalQ = imesArray.length > 0 ? imesArray.length : (Number(i.quantity) || 1);
        return {
          productNo: i.productNo && i.productNo.trim() ? i.productNo : randomProductNo(),
          productName: i.productName || '',
          brand: i.brand || '',
          model: i.model || '',
          quantity: Number(i.quantity) || 1,
          totalQuantity: computedTotalQ,
          imes: imesArray,
          costPrice: Number(i.costPrice) || 0,
          sellingPrice: Number(i.sellingPrice) || 0,
          validity: i.validity ? new Date(i.validity) : undefined,
        };
      }),
      createdBy: String(userId || ''),
      updatedBy: String(userId || ''),
    });
  console.debug('createInStock saved doc items:', JSON.stringify(doc.items || []));

    // If credit purchase, create a SupplierCredit entry
    let creditEntry = null;
    if (purchaseType === 'credit' && Number(creditAmount) > 0) {
      const SupplierCredit = require('../models/supplierCredit');
      creditEntry = await SupplierCredit.create({
        shop_id,
        supplier_id,
        inStock_id: doc._id,
        totalAmount: Number(creditAmount),
        note: `Credit purchase - Stock entry`,
        createdBy: String(userId || ''),
      });
    }

    return res.json({ success: true, entry: doc, credit: creditEntry });
  } catch (err) {
    console.error('createInStock error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};


exports.listInStock = async (req, res) => {
  try {
  const { shop_id } = req.user || {};
  const gstOnly = req.query.gstOnly === '1';
    if (!shop_id) return res.status(400).json({ success: false, message: 'Shop missing' });
    // If branch user, restrict to their branch entries
    if (req.user.isBranch) {
      const entries = await InStock.find({ shop_id })
        .sort({ createdAt: -1 })
        .populate('supplier_id', 'supplierName agencyName')
        .lean();
      return res.json({ success: true, entries });
    }


    let entries = await InStock.find({ shop_id })
      .sort({ createdAt: -1 })
      .populate('supplier_id', 'supplierName agencyName')
      .lean();
    if (gstOnly) {
      entries = entries.filter(e => Number(e.gstAmount) > 0);
    }
    // For each returned entry, compute for each item how much was shipped
    // to branches by comparing totalQuantity vs current quantity.
    try {
      try { console.debug('FLOW listInStock: entries fetched', { shop_id, count: Array.isArray(entries) ? entries.length : 0 }); } catch (__) {}
      const enriched = (entries || []).map(e => {
        const items = (Array.isArray(e.items) ? e.items : []).map(it => {
          const totalQ = Number(it.totalQuantity || it.quantity || 0);
          const currentQ = Number(it.quantity || 0);
          const shippedQty = Math.max(0, totalQ - currentQ);
          try { console.debug('DEBUG inStock item imes', { productNo: it.productNo, imesCount: Array.isArray(it.imes) ? it.imes.length : 0 }); } catch (__) {}
          return { ...it, totalQuantity: totalQ, shippedQty };
        });
        return { ...e, items };
      });
      return res.json({ success: true, entries: enriched });
    } catch (err) {
      console.error('listInStock enrich error:', err && err.message ? err.message : err);
      return res.json({ success: true, entries });
    }
  } catch (err) {
    console.error('listInStock error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};





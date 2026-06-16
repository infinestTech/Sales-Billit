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


// Re-stock (increase quantity of) a single item inside an InStock entry.
// Admin (non-branch) only. Identifies the item by productNo within the entry.
// Body: { addQty: Number (>0), costPrice?: Number, imes?: string[] }
exports.restockItem = async (req, res) => {
  try {
    const { shop_id, userId } = req.user || {};
    if (!shop_id) return res.status(400).json({ success: false, message: 'Shop missing' });
    if (req.user.isBranch) return res.status(403).json({ success: false, message: 'Branches cannot restock items' });

    const { entryId, productNo } = req.params;
    const { addQty, costPrice, imes } = req.body || {};
    const inc = Number(addQty);
    if (!entryId || !productNo) return res.status(400).json({ success: false, message: 'entryId and productNo are required' });
    if (!inc || inc <= 0 || !Number.isFinite(inc)) {
      return res.status(400).json({ success: false, message: 'addQty must be a positive number' });
    }

    const doc = await InStock.findOne({ _id: entryId, shop_id });
    if (!doc) return res.status(404).json({ success: false, message: 'Stock entry not found' });

    const item = (doc.items || []).find(it => String(it.productNo) === String(productNo));
    if (!item) return res.status(404).json({ success: false, message: 'Item not found in entry' });

    // Increase both current quantity and the original totalQuantity so
    // shipped/sold calculations remain consistent.
    item.quantity = Number(item.quantity || 0) + inc;
    item.totalQuantity = Number(item.totalQuantity || 0) + inc;

    // Optional cost price update (only if a valid number is provided)
    if (costPrice !== undefined && costPrice !== null && costPrice !== '' && Number.isFinite(Number(costPrice))) {
      item.costPrice = Number(costPrice);
    }

    // Optional: append new IMEIs for mobile-type items
    if (Array.isArray(imes) && imes.length > 0) {
      const cleaned = imes.map(x => (x || '').toString().trim()).filter(Boolean);
      if (cleaned.length > 0) {
        item.imes = Array.isArray(item.imes) ? item.imes.concat(cleaned) : cleaned;
      }
    }

    doc.updatedBy = String(userId || '');
    await doc.save();

    return res.json({ success: true, entry: doc });
  } catch (err) {
    console.error('restockItem error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};


// Delete a single item from an InStock entry. If the entry has no more
// items after the removal, delete the entire entry. Admin (non-branch) only.
exports.deleteItem = async (req, res) => {
  try {
    const { shop_id } = req.user || {};
    if (!shop_id) return res.status(400).json({ success: false, message: 'Shop missing' });
    if (req.user.isBranch) return res.status(403).json({ success: false, message: 'Branches cannot delete stock items' });

    const { entryId, productNo } = req.params;
    if (!entryId || !productNo) return res.status(400).json({ success: false, message: 'entryId and productNo are required' });

    const doc = await InStock.findOne({ _id: entryId, shop_id });
    if (!doc) return res.status(404).json({ success: false, message: 'Stock entry not found' });

    const before = (doc.items || []).length;
    doc.items = (doc.items || []).filter(it => String(it.productNo) !== String(productNo));
    if (doc.items.length === before) {
      return res.status(404).json({ success: false, message: 'Item not found in entry' });
    }

    if (doc.items.length === 0) {
      await InStock.deleteOne({ _id: doc._id });
      return res.json({ success: true, deletedEntry: true });
    }

    await doc.save();
    return res.json({ success: true, entry: doc, deletedEntry: false });
  } catch (err) {
    console.error('deleteItem error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};


// Delete an entire InStock entry. Admin (non-branch) only.
exports.deleteEntry = async (req, res) => {
  try {
    const { shop_id } = req.user || {};
    if (!shop_id) return res.status(400).json({ success: false, message: 'Shop missing' });
    if (req.user.isBranch) return res.status(403).json({ success: false, message: 'Branches cannot delete stock entries' });

    const { entryId } = req.params;
    if (!entryId) return res.status(400).json({ success: false, message: 'entryId is required' });

    const result = await InStock.deleteOne({ _id: entryId, shop_id });
    if (!result || result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Stock entry not found' });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('deleteEntry error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};





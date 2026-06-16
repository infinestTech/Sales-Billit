const WhatsappStock = require('../models/whatsappStock');

// Create or update a whatsapp stock record for a shop
const mongoose = require('mongoose');

async function createWhatsappStock(req, res) {
  try {
    const shop_id = req.user && req.user.shop_id;
    if (!shop_id) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const body = req.body || {};
    const productNo = (body.productNo || '').toString().trim();
    if (!productNo) return res.status(400).json({ success: false, message: 'productNo required' });

    const data = {
      shop_id,
      productNo,
      productName: body.productName || body.product_name || '',
      brand: body.brand || '',
      model: body.model || '',
      supplyQty: Number(body.supplyQty || body.supply_qty || 0),
      sellPercent: Number(body.sellPercent || body.sell_percent || 0),
      totalCost: Number(body.totalCost || body.total_cost || 0),
      createdBy: req.user.userId || req.user.branch_id || ''
    };

  // compute unit cost and sellingPrice similarly to BranchSupply controller
  const costUnit = Number(body.costPrice || body.cost || body.totalCostPrice || body.totalCost || 0);
  const pct = Number(data.sellPercent || 0);
  const unitRaw = (pct != null && pct !== 0) ? (costUnit * (1 + (pct / 100))) : (Number(body.sellingPrice) || 0);
  const unit = Number(Number(unitRaw || 0).toFixed(2));
  data.costPrice = costUnit;
  data.sellingPrice = unit;

    // Determine supplyQty for use below
    const supplyQty = Number(data.supplyQty || 0);

  // normalize shop_id for queries
  const shopQuery = (mongoose.Types.ObjectId.isValid(shop_id) ? new mongoose.Types.ObjectId(shop_id) : shop_id);
  // ensure created data uses the normalized shop id type
  data.shop_id = shopQuery;
  // Find InStock item for validation (by productId or productNo)
    let inStockQty = null;
    let inStockDocId = null, inStockIdx = null;
    if (body.productId && String(body.productId).includes('_')) {
      const [docId, idxStr] = String(body.productId).split('_');
      const idx = Number(idxStr);
      if (docId && Number.isInteger(idx)) {
  const InStock = require('../models/inStock');
  const central = await InStock.findOne({ _id: docId, shop_id: shopQuery }).lean();
        if (central && Array.isArray(central.items) && central.items[idx]) {
          inStockQty = Number(central.items[idx].quantity || 0);
          inStockDocId = docId;
          inStockIdx = idx;
        }
      }
    } else if (productNo) {
  const InStock = require('../models/inStock');
  const centralDoc = await InStock.findOne({ shop_id: shopQuery, 'items.productNo': productNo }).lean();
      if (centralDoc && Array.isArray(centralDoc.items)) {
        const idx = centralDoc.items.findIndex(it => String(it.productNo || '') === String(productNo));
        if (idx >= 0) {
          inStockQty = Number(centralDoc.items[idx].quantity || 0);
          inStockDocId = centralDoc._id;
          inStockIdx = idx;
        }
      }
    }

  // Upsert: if a record for shop_id + productNo exists, update it; else create
  const existing = await WhatsappStock.findOne({ shop_id: shopQuery, productNo });
    if (existing) {
      // Treat supplied supplyQty as an incremental transfer amount.
      const transfer = Number(supplyQty || 0);
      if (transfer > 0 && inStockQty !== null && transfer > inStockQty) {
        return res.status(400).json({ success: false, message: `Not enough stock. Available: ${inStockQty}` });
      }

      // persist the updated whatsapp stock record (accumulate supplyQty)
      existing.supplyQty = Number(existing.supplyQty || 0) + transfer;
      existing.sellPercent = data.sellPercent;
      existing.totalCost = data.totalCost;
      existing.costPrice = data.costPrice;
      existing.sellingPrice = data.sellingPrice;
      existing.updatedBy = data.createdBy;
      await existing.save();

      // If transfer > 0, decrement the source inventory by transfer amount.
      if (transfer > 0) {
        const change = -Number(transfer);
        try {
          // Prefer explicit InStock doc/idx if found
          if (inStockDocId && Number.isInteger(inStockIdx)) {
            const InStock = require('../models/inStock');
            const path = `items.${inStockIdx}.quantity`;
            const resUpdate = await InStock.updateOne({ _id: inStockDocId, shop_id: shopQuery }, { $inc: { [path]: change } });
            console.log('whatsappStock:update(inStock) ->', { inStockDocId, inStockIdx, transfer, matched: resUpdate.matchedCount, modified: resUpdate.modifiedCount });
            try {
              const debugDoc = await InStock.findById(inStockDocId).lean();
              console.log('whatsappStock:debug inStockDoc', { id: debugDoc && debugDoc._id, shop_id: debugDoc && debugDoc.shop_id, itemsLen: debugDoc && debugDoc.items && debugDoc.items.length, targetItem: debugDoc && debugDoc.items && debugDoc.items[inStockIdx] });
            } catch (__) { console.error('whatsappStock:debug fetch inStock failed', __); }
            // clamp
            try {
              const after = await InStock.findOne({ _id: inStockDocId, shop_id: shopQuery }).lean();
              const q = Number((after && after.items && after.items[inStockIdx] && after.items[inStockIdx].quantity) || 0);
              if (q < 0) await InStock.updateOne({ _id: inStockDocId, shop_id: shopQuery }, { $set: { [path]: 0 } });
            } catch (__) {}
          } else {
            // Try central by productNo
            if (productNo) {
              const InStock = require('../models/inStock');
              const centralDoc = await InStock.findOne({ shop_id: shopQuery, 'items.productNo': productNo }).lean();
              if (centralDoc && Array.isArray(centralDoc.items)) {
                const idx = centralDoc.items.findIndex(it => String(it.productNo || '') === String(productNo));
                if (idx >= 0) {
                  const path = `items.${idx}.quantity`;
                  const resUpdate = await InStock.updateOne({ _id: centralDoc._id, shop_id: shopQuery }, { $inc: { [path]: change } });
                  console.log('whatsappStock:update(inStock by productNo) ->', { centralId: centralDoc._id, idx, transfer, matched: resUpdate.matchedCount, modified: resUpdate.modifiedCount });
                  try {
                    const debugDoc = await InStock.findById(centralDoc._id).lean();
                    console.log('whatsappStock:debug centralDoc', { id: debugDoc && debugDoc._id, shop_id: debugDoc && debugDoc.shop_id, itemsLen: debugDoc && debugDoc.items && debugDoc.items.length, targetItem: debugDoc && debugDoc.items && debugDoc.items[idx] });
                  } catch (__) { console.error('whatsappStock:debug fetch centralDoc failed', __); }
                  try {
                    const after = await InStock.findOne({ _id: centralDoc._id, shop_id: shopQuery }).lean();
                    const q = Number((after && after.items && after.items[idx] && after.items[idx].quantity) || 0);
                    if (q < 0) await InStock.updateOne({ _id: centralDoc._id, shop_id: shopQuery }, { $set: { [path]: 0 } });
                  } catch (__) {}
                } else {
                  throw new Error('central item index not found');
                }
              } else {
                throw new Error('central doc not found');
              }
            }

            // Fallback to BranchStock
            try {
              const BranchStock = require('../models/branchStock');
              const filterBy = (existing.productId || productNo || '').toString();
              if (filterBy) {
                let row = await BranchStock.findOne({ shop_id: shopQuery, productId: filterBy }).lean();
                if (!row) row = await BranchStock.findOne({ shop_id: shopQuery, productNo: filterBy }).lean();
                if (row) {
                  const resUpdate = await BranchStock.updateOne({ _id: row._id }, { $inc: { qty: change } });
                  console.log('whatsappStock:update(branch) ->', { rowId: row._id, delta: change, matched: resUpdate.matchedCount, modified: resUpdate.modifiedCount });
                  try {
                    const afterRow = await BranchStock.findById(row._id).lean();
                    if ((afterRow.qty || 0) < 0) await BranchStock.updateOne({ _id: row._id }, { $set: { qty: 0 } });
                  } catch (__) {}
                }
              }
            } catch (ee) {
              console.error('createWhatsappStock: failed to adjust BranchStock for update', ee && ee.message || ee);
            }
          }
        } catch (e) {
          console.error('createWhatsappStock: failed to adjust inventory for update', e && e.message || e);
        }
      }

      return res.json({ success: true, message: 'Updated', row: existing });
    }

    // Creating new whatsapp stock
    if (inStockQty !== null && supplyQty > inStockQty) {
      return res.status(400).json({ success: false, message: `Not enough stock. Available: ${inStockQty}` });
    }

    const created = await WhatsappStock.create(data);

    // decrement source inventory by supplyQty (if > 0)
    if (supplyQty > 0) {
      try {
        const change = -Number(supplyQty);
        if (inStockDocId && Number.isInteger(inStockIdx)) {
          const InStock = require('../models/inStock');
          const path = `items.${inStockIdx}.quantity`;
            const resUpdate = await InStock.updateOne({ _id: inStockDocId, shop_id: shopQuery }, { $inc: { [path]: change } });
            console.log('whatsappStock:create(inStock by productId) ->', { docId: inStockDocId, idx: inStockIdx, supplyQty, matched: resUpdate.matchedCount, modified: resUpdate.modifiedCount });
                try {
                  const after = await InStock.findOne({ _id: inStockDocId, shop_id: shopQuery }).lean();
                  const q = Number((after && after.items && after.items[inStockIdx] && after.items[inStockIdx].quantity) || 0);
                  console.log('whatsappStock:update(inStock) after ->', { inStockDocId, inStockIdx, quantity: q });
                  if (q < 0) await InStock.updateOne({ _id: inStockDocId, shop_id: shopQuery }, { $set: { [path]: 0 } });
                } catch (__) { console.error('whatsappStock:update(inStock) clamp error', __); }
        } else if (productNo) {
          const InStock = require('../models/inStock');
          const centralDoc = await InStock.findOne({ shop_id: shopQuery, 'items.productNo': productNo }).lean();
          if (centralDoc && Array.isArray(centralDoc.items)) {
            const idx = centralDoc.items.findIndex(it => String(it.productNo || '') === String(productNo));
            if (idx >= 0) {
              const path = `items.${idx}.quantity`;
                const resUpdate = await InStock.updateOne({ _id: centralDoc._id, shop_id: shopQuery }, { $inc: { [path]: change } });
                console.log('whatsappStock:create(inStock by productNo) ->', { centralId: centralDoc._id, idx, supplyQty, matched: resUpdate.matchedCount, modified: resUpdate.modifiedCount });
              try {
                const after = await InStock.findOne({ _id: centralDoc._id, shop_id: shopQuery }).lean();
                const q = Number((after && after.items && after.items[idx] && after.items[idx].quantity) || 0);
                if (q < 0) await InStock.updateOne({ _id: centralDoc._id, shop_id: shopQuery }, { $set: { [path]: 0 } });
              } catch (__) {}
            }
          } else {
            // fallback to BranchStock
            try {
              const BranchStock = require('../models/branchStock');
              const pidCandidate = created.productId || created.productNo || '';
              let row = null;
              if (pidCandidate) {
                row = await BranchStock.findOne({ shop_id: shopQuery, productId: pidCandidate }).lean();
                if (!row) row = await BranchStock.findOne({ shop_id: shopQuery, productNo: pidCandidate }).lean();
              } else if (created.productNo) {
                row = await BranchStock.findOne({ shop_id: shopQuery, productNo: created.productNo }).lean();
              }
              if (row) {
                  const resUpdate = await BranchStock.updateOne({ _id: row._id }, { $inc: { qty: change } });
                  console.log('whatsappStock:create(branch) ->', { rowId: row._id, supplyQty, matched: resUpdate.matchedCount, modified: resUpdate.modifiedCount });
                try {
                  const afterRow = await BranchStock.findById(row._id).lean();
                  if ((afterRow.qty || 0) < 0) await BranchStock.updateOne({ _id: row._id }, { $set: { qty: 0 } });
                } catch (__) {}
              }
            } catch (ee) {
              console.error('createWhatsappStock: failed to decrement BranchStock for new record', ee && ee.message || ee);
            }
          }
        }
      } catch (e) {
        console.error('createWhatsappStock: failed to decrement inventory for new record', e && e.message || e);
      }
    }

    return res.json({ success: true, message: 'Created', row: created });
  } catch (err) {
    console.error('createWhatsappStock error', err && err.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function listWhatsappStock(req, res) {
  try {
    const shop_id = req.user && req.user.shop_id;
    if (!shop_id) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const shopQuery = (mongoose.Types.ObjectId.isValid(shop_id) ? new mongoose.Types.ObjectId(shop_id) : shop_id);
  const rows = await WhatsappStock.find({ shop_id: shopQuery }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, rows });
  } catch (err) {
    console.error('listWhatsappStock error', err && err.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = { createWhatsappStock, listWhatsappStock };

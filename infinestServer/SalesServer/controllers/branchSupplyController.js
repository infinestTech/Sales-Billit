const mongoose = require('mongoose');
const Branch = require('../models/branch');
const InStock = require('../models/inStock');

// Use canonical BranchStock model (includes `imes` field)
const BranchStock = require('../models/branchStock');

const BranchSupply = mongoose.model('BranchSupply', new mongoose.Schema({
  shop_id: { type: String, index: true },
  branch_id: { type: String, index: true },
  branch_name: { type: String, default: '' },
  supplier_id: { type: String, default: '' },
  supplierName: { type: String, default: '' },

  supplierAmount: { type: Number, default: 0 },
  gstAmount: { type: Number, default: 0 },
  items: { type: Array, default: [] }, // { productName, productId, qty, unitSellingPrice, value, costPrice, totalCostPrice }
  totalSupplyValue: { type: Number, default: 0 },
  totalSupplyCost: { type: Number, default: 0 },
  createdBy: { type: String },
  createdByType: { type: String, default: 'admin' }, // 'admin' or 'branch'
}, { timestamps: true }));

  // helper: test if a string looks like a valid MongoDB ObjectId (24 hex chars)
  function isValidObjectId(id) {
    return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
  }

// Helper to compute value: sellingPrice * qty
function computeItemValue(unitSellingPrice, qty) {
  const v = (Number(unitSellingPrice) || 0) * (Number(qty) || 0);
  return Number(Number(v).toFixed(2));
}

exports.createBranchSupply = async (req, res) => {
  try {
    const shop_id = req.user.shop_id;
    // Allow branch users to omit branch_id in the request body — default to their branch
    let branch_id = req.body.branch_id;
    if (req.user && req.user.isBranch && req.user.branch_id) {
      branch_id = req.user.branch_id;
    }
    const branch_name = req.user && req.user.branchName ? req.user.branchName : (req.body.branch_name || '');
    const supplier_id = req.body.supplier_id || '';
    const supplierAmount = Number(req.body.supplierAmount) || 0;
    const gstAmount = Number(req.body.gstAmount) || 0;
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    try { console.debug('FLOW createBranchSupply: incoming', { shop_id, branch_id, itemsCount: items.length }); } catch (__) {}
  if (!branch_id) return res.status(400).json({ success: false, message: 'branch_id required' });
    if (items.length === 0) return res.status(400).json({ success: false, message: 'items required' });

    // Prepare items with computed selling value and cost totals
    let total = 0;
    let totalCost = 0;
    const prepared = items.map(i => {
      const qty = Number(i.qty) || 0;
      const costUnit = Number(i.costPrice) || 0;
      const pct = (i.pct != null) ? Number(i.pct) : null;
      // compute selling price from pct if provided, otherwise use provided sellingPrice
      const unitRaw = (pct != null) ? (costUnit * (1 + (pct / 100))) : (Number(i.sellingPrice) || 0);
      const unit = Number(Number(unitRaw).toFixed(2));
      const value = computeItemValue(unit, qty);
      const totalCostPrice = Number(Number(costUnit * qty).toFixed(2));
      total += value;
      totalCost += totalCostPrice;
      // Determine a stable productId. If client provided one (central ref), use it.
      // For branch-only items (no productId), generate a unique productId so multiple
      // branch adds do not collide and overwrite previous branch-only rows.
      let pid = i.productId || i._id || null;
      if (!pid) {
        // include branch_id to help identify origin; make unique by timestamp+rand
        const rand = Math.random().toString(36).slice(2, 8);
        const bid = branch_id || 'nb';
        pid = `branch_${bid}_${Date.now()}_${rand}`;
      }
      const out = {
        productId: pid,
        productNo: i.productNo || '',
        productName: i.productName || i.name || '',
        brand: i.brand || i.mfg || '',
        model: i.model || i.modelNo || '',
        qty,
        unitSellingPrice: unit,
        value,
        costPrice: costUnit,
        totalCostPrice,
        pct: pct,
        validity: i.validity ? new Date(i.validity) : null
      };
      // include imes only when client provided them (non-empty)
      if (Array.isArray(i.imes) && i.imes.length) out.imes = i.imes.slice(0, qty);
      return out;
    });

    // Validate supplied IMEs against central InStock when productId references central docs
    for (const it of prepared) {
      try {
        const pid = String(it.productId || '');
        if (pid.includes('_') && Array.isArray(it.imes) && it.imes.length) {
          const [docId, idxStr] = pid.split('_');
          const idx = Number(idxStr);
          if (docId && Number.isInteger(idx)) {
            const central = await InStock.findById(docId).lean();
            const centralIt = (central && Array.isArray(central.items) && central.items[idx]) ? central.items[idx] : null;
            const centralImes = Array.isArray(centralIt && centralIt.imes) ? centralIt.imes : [];
            const invalid = it.imes.filter(i => !centralImes.includes(i));
            if (invalid.length) {
              return res.status(400).json({ success: false, message: `Invalid IMEs for product ${it.productName || it.productId}: ${invalid.join(', ')}` });
            }
          }
        }
      } catch (e) {
        // ignore per-item validation errors and continue; other checks will catch problems
      }
    }

    // Resolve supplierName when id provided
    let supplierName = '';
    try {
      if (supplier_id) {
        const Supplier = require('../models/supplier');
        const sdoc = await Supplier.findById(supplier_id).lean();
        if (sdoc) supplierName = sdoc.supplierName || sdoc.agencyName || '';
      }
    } catch (e) {
      // ignore
    }
    // Update BranchStock FIRST, then create BranchSupply record only for items that succeeded.
    // This prevents orphan supply records when BranchStock updates fail.
    const successfulItems = [];
    for (const it of prepared) {
      try {
      const filter = { shop_id: String(shop_id), branch_id: String(branch_id), productId: String(it.productId) };
      const setObj = {
        productNo: it.productNo || '',
        productName: it.productName,
        sellingPrice: Number(Number(it.unitSellingPrice || 0).toFixed(2)),
        brand: it.brand,
        model: it.model,
        validity: it.validity,
        costPrice: it.costPrice
      };
      const update = { $set: setObj, $inc: { qty: it.qty } };

      // If this item references a central InStock item, try to fetch productNo from central
      try {
        const pid = String(it.productId || '');
        if ((!update.$set.productNo || update.$set.productNo === '') && pid.includes('_')) {
          const [docId, idxStr] = pid.split('_');
          const idx = Number(idxStr);
          if (docId && Number.isInteger(idx)) {
            const central = await InStock.findById(docId).lean();
            if (central && Array.isArray(central.items) && central.items[idx]) {
              const centralIt = central.items[idx];
              if (centralIt && centralIt.productNo) {
                update.$set.productNo = centralIt.productNo;
              }
            }
          }
        }
      } catch (e) {
        // ignore central fetch errors; proceed with existing productNo
      }

      await BranchStock.findOneAndUpdate(filter, update, { upsert: true, new: true });
      successfulItems.push(it);

      // If client provided imes, merge them into BranchStock.
      if (Array.isArray(it.imes) && it.imes.length) {
        try {
          await BranchStock.findOneAndUpdate(filter, { $addToSet: { imes: { $each: it.imes } } });
        } catch (e) {
          // ignore merge errors
        }
      }

      // Decrement the central InStock quantity so central and branch stay consistent.
      try {
        const pid = String(it.productId || '');
        if (pid.includes('_')) {
          const [docId, idxStr] = pid.split('_');
          const idx = Number(idxStr);
          if (docId && Number.isInteger(idx)) {
            // If IMEs were supplied, remove them from the central item's imes array.
            if (Array.isArray(it.imes) && it.imes.length) {
              try {
                await InStock.updateOne({ _id: docId }, { $pullAll: { [`items.${idx}.imes`]: it.imes } });
              } catch (e) {
                console.error('pullAll error', e && e.message ? e.message : e);
              }
            }
            // Re-fetch central doc to calculate correct quantity and remaining imes
            const central = await InStock.findById(docId).lean();
            if (central && Array.isArray(central.items) && central.items[idx]) {
              const currentItem = central.items[idx];
              const currentQty = Number(currentItem.quantity || currentItem.qty || 0);
              const remainingImes = Array.isArray(currentItem.imes) ? currentItem.imes : [];
              const newQty = Array.isArray(currentItem.imes) && currentItem.imes.length ? remainingImes.length : Math.max(0, currentQty - Number(it.qty || 0));
              const qtyPath = `items.${idx}.quantity`;
              const imesPath = `items.${idx}.imes`;
              const setObj2 = { [qtyPath]: newQty };
              if (Array.isArray(currentItem.imes)) setObj2[imesPath] = remainingImes;
              await InStock.findByIdAndUpdate(docId, { $set: setObj2 });
            }
          }
        }
      } catch (e) {
        console.error('createBranchSupply: failed to decrement central InStock for', it.productId, e && e.message ? e.message : e);
      }
      } catch (itemErr) {
        console.error('createBranchSupply: BranchStock update failed for item', it.productId, itemErr && itemErr.message ? itemErr.message : itemErr);
      }
    }

    if (successfulItems.length === 0) {
      return res.status(500).json({ success: false, message: 'Failed to update branch stock for any items' });
    }

    // Recalculate totals based on items that actually updated
    let successTotal = 0, successTotalCost = 0;
    successfulItems.forEach(si => { successTotal += (si.value || 0); successTotalCost += (si.totalCostPrice || 0); });

    // Create supply record only after BranchStock updates succeed
    const supply = await BranchSupply.create({
      shop_id: String(shop_id),
      branch_id: String(branch_id),
      branch_name,
      supplier_id,
      supplierName,
      supplierAmount,
      gstAmount,
      items: successfulItems,
      totalSupplyValue: successTotal,
      totalSupplyCost: successTotalCost,
      createdBy: req.user.userId || req.user.branch_id || '',
      createdByType: req.user && req.user.isBranch ? 'branch' : 'admin'
    });

  // Backfill productNo into saved supply items if missing
  try {
    for (let i = 0; i < (supply.items || []).length; i++) {
      const it = supply.items[i];
      const pid = String(it.productId || '');
      if ((!it.productNo || it.productNo === '') && pid.includes('_')) {
        const [docId, idxStr] = pid.split('_');
        const idx = Number(idxStr);
        if (docId && Number.isInteger(idx)) {
          const central = await InStock.findById(docId).lean();
          if (central && Array.isArray(central.items) && central.items[idx]) {
            const centralIt = central.items[idx];
            if (centralIt && centralIt.productNo) {
              await BranchSupply.findByIdAndUpdate(supply._id, { $set: { ['items.' + i + '.productNo']: centralIt.productNo } });
              await BranchStock.findOneAndUpdate({ shop_id: String(shop_id), branch_id: String(branch_id), productId: it.productId }, { $set: { productNo: centralIt.productNo } });
              supply.items[i].productNo = centralIt.productNo;
            }
          }
        }
      }
    }
  } catch (e) {
    // ignore backfill errors
  }

  const updatedRows = await BranchStock.find({ shop_id: String(shop_id), branch_id: String(branch_id) }).lean();
  const freshSupply = await BranchSupply.findById(supply._id).lean();
  try { console.debug('FLOW createBranchSupply: returning', { supplyId: freshSupply._id, updatedRowsCount: Array.isArray(updatedRows) ? updatedRows.length : 0 }); } catch (__) {}
  return res.json({ success: true, supply: freshSupply || supply, rows: updatedRows, gstAmount: gstAmount || 0 });
  } catch (err) {
    console.error('createBranchSupply error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// List current stock for a branch (or all branches if not provided)
exports.listBranchStock = async (req, res) => {
  try {
    const shop_id = req.user.shop_id;
  // optional query filters
  const productNoFilter = (req.query.productNo || req.query.product_no || '').toString();
  const customerNo = (req.query.customerNo || req.query.customer_no || '').toString();
    let branch_id = req.query.branch_id || null;
    
    // If this is a branch user, force filter to their branch only
    if (req.user.isBranch && req.user.branch_id) {
      branch_id = req.user.branch_id;
    }
    
    const onlyBranch = (req.query.only_branch === '1' || req.query.only_branch === 'true');

    // If client requests only branch-specific stock, return BranchStock rows only
    if (onlyBranch) {
      const bid = branch_id || req.user.branch_id || null;
      try { console.debug('FLOW listBranchStock: incoming onlyBranch', { shop_id, branch_id: bid }); } catch (__) {}
      if (!bid) return res.json({ success: true, rows: [] });
      let rowsOnly = await BranchStock.find({ shop_id: String(shop_id), branch_id: String(bid) }).lean();
      try { console.debug('FLOW listBranchStock: branch rows fetched', { count: Array.isArray(rowsOnly) ? rowsOnly.length : 0 }); } catch (__) {}

      // If some branch rows are missing brand/model/validity, try to backfill from central InStock
  const needFill = rowsOnly.filter(r => (!r.brand || r.brand === '') || (!r.model || r.model === '') || !r.validity || (!r.productNo || r.productNo === ''));
      if (needFill.length > 0) {
        // collect central doc ids referenced by productId like '<docId>_<idx>'
        const docIds = Array.from(new Set(needFill.map(r => {
          try {
            if (String(r.productId).includes('_')) {
              const maybe = String(r.productId).split('_')[0];
              return isValidObjectId(maybe) ? maybe : null;
            }
            return null;
          } catch(e) { return null; }
        }).filter(Boolean)));
        if (docIds.length > 0) {
          const centralDocs = await InStock.find({ _id: { $in: docIds } }).lean();
          const centralMap = {};
          (centralDocs || []).forEach(d => { centralMap[String(d._id)] = d; });

          rowsOnly = rowsOnly.map(r => {
            try {
              if (((!r.brand || r.brand === '') || (!r.model || r.model === '') || !r.validity || (!r.productNo || r.productNo === '')) && String(r.productId).includes('_')) {
                const [docId, idxStr] = String(r.productId).split('_');
                const idx = Number(idxStr);
                const doc = centralMap[docId];
                if (doc && Array.isArray(doc.items) && Number.isInteger(idx) && doc.items[idx]) {
                  const it = doc.items[idx];
                  if (!r.brand || r.brand === '') r.brand = it.brand || r.brand || '';
                  if (!r.model || r.model === '') r.model = it.model || r.model || '';
                    if (!r.validity) r.validity = it.validity || r.validity || null;
                    if (!r.productNo || r.productNo === '') r.productNo = it.productNo || r.productNo || '';
                    // DO NOT backfill central imes into branch rows here. Branch IMEs are branch-scoped
                    // and copying central IMEs into branch rows can cause stale/incorrect IME lists to appear
                    // in branch views. (Keep other backfills like brand/model/validity/productNo.)
                }
              }
            } catch (e) {
              // ignore fill errors
            }
            return r;
          });

          // Persist any productNo backfills into BranchStock so subsequent requests include it
          // Do not persist imes from central into BranchStock.
          try {
            for (const r of rowsOnly) {
              try {
                if (r.productNo && String(r.productId || '').includes('_')) {
                  const setObj = { productNo: r.productNo };
                  await BranchStock.findOneAndUpdate({ shop_id: String(shop_id), branch_id: String(bid), productId: r.productId }, { $set: setObj });
                }
              } catch (e) { /* ignore individual update errors */ }
            }
          } catch (e) { /* ignore persistence errors */ }
        }
      }

      // apply server-side productNo filter if provided
      let rowsFiltered = rowsOnly;
      if (productNoFilter) {
        const needle = productNoFilter.toLowerCase();
        rowsFiltered = rowsOnly.filter(r => (String(r.productNo || '').toLowerCase().includes(needle)));
      }
      try { console.debug('FLOW listBranchStock: returning onlyBranch rows', { count: Array.isArray(rowsFiltered) ? rowsFiltered.length : 0 }); } catch (__) {}
      return res.json({ success: true, rows: rowsFiltered, customerNo: customerNo || null });
    }

    const q = { shop_id: String(shop_id) };
    if (branch_id) q.branch_id = String(branch_id);
    let rows = await BranchStock.find(q).lean();

    // Build an aggregated list of central InStock items (flatten items[])
    const centralDocs = await InStock.find({ shop_id }).lean();
    const centralAgg = [];
    (centralDocs || []).forEach(doc => {
      const docId = doc._id ? String(doc._id) : '';
      const items = Array.isArray(doc.items) ? doc.items : [];
      items.forEach((it, idx) => {
        const qty = (it.quantity ?? it.qty ?? 0);
        const costPrice = (it.costPrice ?? it.cost ?? 0);
          centralAgg.push({
          shop_id,
          branch_id: branch_id || '',
          productId: `${docId}_${idx}`,
          productNo: it.productNo || '',
          productName: it.productName || it.name || '',
          brand: it.brand || '',
          model: it.model || '',
          qty: qty,
          costPrice: costPrice,
          sellingPrice: (it.sellingPrice ?? it.price ?? it.costPrice ?? 0),
          validity: it.validity || null,
          totalCostPrice: (Number(qty) * Number(costPrice || 0)),
          imes: Array.isArray(it.imes) ? it.imes : [],
          // expose centralImes for frontend dropdowns that need to show central IMEs
          centralImes: Array.isArray(it.imes) ? it.imes : [],
          // explicit alias to indicate central-only IMEs
          centralOnlyImes: Array.isArray(it.imes) ? it.imes : []
        });
      });
    });

    // If client explicitly requests central-only (useful for dropdowns that should show
    // only available central items), return the centralAgg directly.
    const onlyCentral = (req.query.only_central === '1' || req.query.only_central === 'true');
    if (onlyCentral) {
      let rowsCentral = centralAgg;
      // apply productNo filter if provided
      if (productNoFilter) {
        const needle = productNoFilter.toLowerCase();
        rowsCentral = (rowsCentral || []).filter(r => (String(r.productNo || '').toLowerCase().includes(needle)));
      }
      try { console.debug('FLOW listBranchStock: returning central-only rows', { count: Array.isArray(rowsCentral) ? rowsCentral.length : 0 }); } catch (__) {}
      return res.json({ success: true, rows: rowsCentral, customerNo: customerNo || null });
    }

    // If a branch is requested, merge central items with branch-specific rows
  if (branch_id) {
      const branchRows = await BranchStock.find({ shop_id: String(shop_id), branch_id: String(branch_id) }).lean();
      const branchMap = {};
      (branchRows || []).forEach(br => { branchMap[String(br.productId)] = br; });

      // Merge: prefer central list but override qty/sellingPrice from branch when present
      const merged = centralAgg.map(c => {
        const br = branchMap[c.productId];
        const centralQty = Number(c.qty || 0);
        const branchQty = br ? Number(br.qty || 0) : 0;
        const totalQty = centralQty + branchQty;
        const costPrice = br ? (br.costPrice ?? c.costPrice) : c.costPrice;
        return {
          shop_id,
          branch_id,
          productId: c.productId,
          productNo: c.productNo || (br ? br.productNo : '') || '',
          productName: c.productName,
          brand: c.brand,
          model: c.model,
          // expose central and branch qty separately
          centralQty: centralQty,
          branchQty: branchQty,
          // Total qty = central qty + branch qty
          qty: totalQty,
          // costPrice prefer branch then central
          costPrice: costPrice,
          // Selling price: branch override if present, else central sellingPrice
          sellingPrice: br ? (br.sellingPrice ?? c.sellingPrice) : c.sellingPrice,
          validity: br ? (br.validity || c.validity) : c.validity,
          totalCostPrice: Number(totalQty) * Number(costPrice || 0),
          // include imes only from branch rows. Do NOT fall back to central imes for branch views.
          imes: Array.isArray(br && br.imes) && br.imes.length ? br.imes : [],
          // keep central imes available for display (do not persist them into branch rows)
          centralImes: Array.isArray(c.imes) ? c.imes : [],
          // explicit central-only IME list
          centralOnlyImes: Array.isArray(c.imes) ? c.imes : []
        };
      });


      // Include any branch-only items that don't exist in centralAgg
      const centralIds = new Set(centralAgg.map(c => String(c.productId)));
      (branchRows || []).forEach(br => {
        if (!centralIds.has(String(br.productId))) {
          const qty = br.qty ?? 0;
          const costPrice = br.costPrice ?? 0;
          merged.push({
            shop_id,
            branch_id,
            productId: br.productId,
            productNo: br.productNo || '',
            productName: br.productName || '',
            brand: br.brand || '',
            model: br.model || '',
            qty: qty,
            costPrice: costPrice,
            sellingPrice: br.sellingPrice ?? 0,
            validity: br.validity || null,
            totalCostPrice: Number(qty) * Number(costPrice || 0),
            imes: Array.isArray(br.imes) ? br.imes : []
          });
        }
      });

      rows = merged;
    } else {
      // No branch requested: return central aggregated items
      rows = centralAgg;
    }

    // apply productNo filter if provided
    if (productNoFilter) {
      const needle = productNoFilter.toLowerCase();
      rows = (rows || []).filter(r => (String(r.productNo || '').toLowerCase().includes(needle)));
    }

    try { console.debug('FLOW listBranchStock: returning merged rows', { count: Array.isArray(rows) ? rows.length : 0 }); } catch (__) {}
    return res.json({ success: true, rows, customerNo: customerNo || null });
  } catch (err) {
    console.error('listBranchStock error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// List supplies for the shop (admin view) with optional pagination and filters
// Query params supported:
//  - branch_id (optional; forced for branch users)
//  - page (1-based), limit (page size)
//  - from (ISO date) and to (ISO date) to filter createdAt range
//  - supplier_id to filter supplies created from a specific supplier
exports.listSuppliesForShop = async (req, res) => {
  try {
    const shop_id = req.user.shop_id;
    let branch_id = req.query.branch_id || null;

    // If this is a branch user, force filter to their branch only
    if (req.user.isBranch && req.user.branch_id) {
      branch_id = req.user.branch_id;
    }

    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit || '50', 10)));
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;
    const supplier_id = req.query.supplier_id || null;

    const query = { shop_id: String(shop_id) };
    if (branch_id) query.branch_id = String(branch_id);
    if (supplier_id) query.supplier_id = supplier_id;
    if (from || to) {
      query.createdAt = {};
      if (from && !isNaN(from.getTime())) query.createdAt.$gte = from;
      if (to && !isNaN(to.getTime())) query.createdAt.$lte = to;
    }

    const total = await BranchSupply.countDocuments(query);
    const supplies = await BranchSupply.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();

    // Enrich items by backfilling brand/model/validity and supplier from central InStock docs
    const docIds = new Set();
    (supplies || []).forEach(s => {
      (Array.isArray(s.items) ? s.items : []).forEach(it => {
        try {
          if (String(it.productId || '').includes('_')) {
            const maybe = String(it.productId).split('_')[0];
            if (isValidObjectId(maybe)) docIds.add(maybe);
          }
        } catch (e) {}
      });
    });

    let populatedSupplies = supplies;
    if (docIds.size > 0) {
      const docs = await InStock.find({ _id: { $in: Array.from(docIds) } }).populate('supplier_id', 'supplierName agencyName').lean();
      const docMap = {};
      (docs || []).forEach(d => { docMap[String(d._id)] = d; });

      populatedSupplies = (supplies || []).map(s => {
        const items = (Array.isArray(s.items) ? s.items : []).map(it => {
          try {
            if (String(it.productId || '').includes('_')) {
              const [docId, idxStr] = String(it.productId).split('_');
              const idx = Number(idxStr);
              const doc = docMap[docId];
              if (doc && Array.isArray(doc.items) && Number.isInteger(idx) && doc.items[idx]) {
                const centralItem = doc.items[idx];
                // backfill fields only if missing
                if (!it.brand || it.brand === '') it.brand = centralItem.brand || it.brand || '';
                if (!it.model || it.model === '') it.model = centralItem.model || it.model || '';
                if (!it.validity) it.validity = centralItem.validity || it.validity || null;
                if (!it.productNo || it.productNo === '') it.productNo = centralItem.productNo || it.productNo || '';
                // supplier name from central doc
                it.supplierName = (doc.supplier_id && (doc.supplier_id.supplierName || doc.supplier_id.agencyName)) || it.supplierName || '';
              }
            }
          } catch (e) {
            // ignore
          }
          return it;
        });
        return { ...s, items };
      });
    }

    return res.json({ success: true, supplies: populatedSupplies, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('listSuppliesForShop error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get a single supply by id (admin or branch-scoped)
exports.getSupplyById = async (req, res) => {
  try {
    const shop_id = req.user.shop_id;
    const supplyId = req.params && req.params.id ? req.params.id : null;
    if (!supplyId) return res.status(400).json({ success: false, message: 'supply id required' });

    const supply = await BranchSupply.findOne({ _id: supplyId, shop_id }).lean();
    if (!supply) return res.status(404).json({ success: false, message: 'supply not found' });

    // If branch user, ensure they can only access their branch's supply
    if (req.user.isBranch && req.user.branch_id && String(supply.branch_id) !== String(req.user.branch_id)) {
      return res.status(403).json({ success: false, message: 'forbidden' });
    }

    // Backfill item fields from central InStock if needed (same logic as list)
    const docIds = new Set();
    (Array.isArray(supply.items) ? supply.items : []).forEach(it => {
      try {
        if (String(it.productId || '').includes('_')) {
          const maybe = String(it.productId).split('_')[0];
          if (isValidObjectId(maybe)) docIds.add(maybe);
        }
      } catch (e) {}
    });

    let populated = supply;
    if (docIds.size > 0) {
      const docs = await InStock.find({ _id: { $in: Array.from(docIds) } }).populate('supplier_id', 'supplierName agencyName').lean();
      const docMap = {};
      (docs || []).forEach(d => { docMap[String(d._id)] = d; });

      populated = { ...supply, items: (Array.isArray(supply.items) ? supply.items : []).map(it => {
        try {
          if (String(it.productId || '').includes('_')) {
            const [docId, idxStr] = String(it.productId).split('_');
            const idx = Number(idxStr);
            const doc = docMap[docId];
            if (doc && Array.isArray(doc.items) && Number.isInteger(idx) && doc.items[idx]) {
              const centralItem = doc.items[idx];
              if (!it.brand || it.brand === '') it.brand = centralItem.brand || it.brand || '';
              if (!it.model || it.model === '') it.model = centralItem.model || it.model || '';
              if (!it.validity) it.validity = centralItem.validity || it.validity || null;
              if (!it.productNo || it.productNo === '') it.productNo = centralItem.productNo || it.productNo || '';
              it.supplierName = (doc.supplier_id && (doc.supplier_id.supplierName || doc.supplier_id.agencyName)) || it.supplierName || '';
            }
          }
        } catch (e) {}
        return it;
      }) };
    }

    return res.json({ success: true, supply: populated });
  } catch (err) {
    console.error('getSupplyById error:', err.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

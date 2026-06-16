#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');
const WhatsappController = require('../controllers/whatsappStockController');
const InStock = require('../models/inStock');
const WhatsappStock = require('../models/whatsappStock');

function question(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(prompt, ans => { rl.close(); resolve(ans); }));
}

async function run() {
  const MONGO_URI = process.env.BILLIT_MONGO_URI || 'mongodb://127.0.0.1:27017/billit_db';
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

  const productNo = String((await question('Enter productNo: ')).trim());
  if (!productNo) { console.log('productNo required'); process.exit(1); }

  // find central item
  const centralDoc = await InStock.findOne({ 'items.productNo': productNo }).lean();
  if (!centralDoc) { console.log('No InStock doc found for productNo', productNo); await mongoose.disconnect(); process.exit(1); }
  const idx = centralDoc.items.findIndex(it => String(it.productNo || '') === String(productNo));
  if (idx < 0) { console.log('Item not found in InStock doc'); await mongoose.disconnect(); process.exit(1); }

  console.log('\nCurrent quantity for', productNo, 'is', centralDoc.items[idx].quantity);

  const supplyStr = String((await question('Enter supplyQty to transfer: ')).trim());
  const supplyQty = Number(supplyStr || 0);
  if (!Number.isFinite(supplyQty) || supplyQty <= 0) { console.log('supplyQty must be a positive number'); await mongoose.disconnect(); process.exit(1); }

  if (supplyQty > Number(centralDoc.items[idx].quantity || 0)) {
    console.log('Requested supplyQty is greater than available. Aborting.');
    await mongoose.disconnect(); process.exit(1);
  }

  // prepare mock req/res for controller
  const mockReq = { user: { shop_id: String(centralDoc.shop_id), userId: 'interactive-run' }, body: { productNo, supplyQty } };
  const mockRes = {
    _status: 200,
    status(code) { this._status = code; return this; },
    json(obj) { this._body = obj; console.log('\nController response status=', this._status || 200, 'body=', JSON.stringify(obj)); return obj; }
  };

  // ensure we call create flow (delete existing WhatsappStock row for this shop+product) so controller performs create path
  try { await WhatsappStock.deleteOne({ shop_id: String(centralDoc.shop_id), productNo }); } catch (e) { /* ignore */ }

  console.log('\nTransferring', supplyQty, 'units for', productNo, '...');
  await WhatsappController.createWhatsappStock(mockReq, mockRes);

  const afterDoc = await InStock.findById(centralDoc._id).lean();
  console.log('\nAfter transfer, quantity for', productNo, 'is', afterDoc.items[idx].quantity);

  await mongoose.disconnect();
}

run().catch(err => { console.error('interactive script error', err && err.message || err); process.exit(1); });

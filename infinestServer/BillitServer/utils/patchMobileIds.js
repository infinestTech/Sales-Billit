const mongoose = require('mongoose');
const { Customer, Dealer } = require('../models/mongoModels'); // ✅ Use your shared models

async function patchMobileIds(Model, label) {
  const docs = await Model.find({});
  for (const doc of docs) {
    let changed = false;
    const updatedMobiles = (doc.MobileName || []).map((m) => {
      if (!m._id) {
        changed = true;
        m._id = new mongoose.Types.ObjectId();
      }
      return m;
    });

    if (changed) {
      doc.MobileName = updatedMobiles;
      await doc.save();
      console.log(`✅ Patched ${label}: ${doc.client_name || doc.dealer_name}`);
    }
  }
}

async function runPatch() {
  console.log("🔄 Running mobile ID patch...");
  await patchMobileIds(Customer, "Customer");
  await patchMobileIds(Dealer, "Dealer");
  console.log("✅ Patch complete");
}

module.exports = runPatch;

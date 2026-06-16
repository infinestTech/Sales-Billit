const { Mobile, Customer, Dealer } = require('../../models/mongoModels');
const JSZip = require("jszip");
const fs = require("fs");
const path = require("path");


// controllers/backupController.js
exports.downloadFullBackup = async (req, res) => {
  try {
    const { shopId } = req.body;
    if (!shopId) return res.status(400).json({ message: "Missing shopId" });


    const mobiles = await Mobile.find({ shop_id: shopId }).lean();


    const customerIds = mobiles.map(m => m.customer_id).filter(Boolean);
    const dealerIds = mobiles.map(m => m.dealer_id).filter(Boolean);


    const customers = await Customer.find({ _id: { $in: customerIds } }).lean();
    const dealers = await Dealer.find({ _id: { $in: dealerIds } }).lean();


    const data = { mobiles, customers, dealers };


    const zip = new JSZip();
    zip.file("backup.json", JSON.stringify(data));
    const content = await zip.generateAsync({ type: "nodebuffer" });


    const filename = `backup_all_${Date.now()}.bkb`;
    const filePath = path.join(__dirname, "../../temp", filename);


    fs.writeFileSync(filePath, content);
    res.download(filePath, filename, () => fs.unlinkSync(filePath));
  } catch (err) {
    console.error("Download backup failed:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};




exports.viewBackup = async (req, res) => {
  try {
    const zip = new JSZip();
    const { buffer } = req.file;


    const result = await zip.loadAsync(buffer);
    const content = await result.file("backup.json").async("string");


    const parsed = JSON.parse(content);
    res.json(parsed);
  } catch (err) {
    console.error("Backup view failed:", err.message);
    res.status(400).json({ message: "Invalid backup file" });
  }
};

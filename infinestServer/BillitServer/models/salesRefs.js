const mongoose = require("mongoose");

// Read-only views of SalesServer collections (same Mongo database), used to render sales invoice PDFs.
// The schemas live in SalesServer (models/sale.js, models/branch.js) — never write through these.
const looseSchema = () => new mongoose.Schema({}, { strict: false });

const SalesSaleRef = mongoose.models.SalesSaleRef || mongoose.model("SalesSaleRef", looseSchema(), "sales");
const SalesBranchRef = mongoose.models.SalesBranchRef || mongoose.model("SalesBranchRef", looseSchema(), "salesbranches");

module.exports = { SalesSaleRef, SalesBranchRef };

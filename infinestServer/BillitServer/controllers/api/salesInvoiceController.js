const { Shop } = require("../../models/mongoModels");
const { SalesSaleRef, SalesBranchRef } = require("../../models/salesRefs");
const { generateSalesInvoicePdfBuffer } = require("../../utils/salesInvoicePdf");
const { isValidSalesInvoiceSig, salesInvoiceUrl } = require("../../utils/salesInvoiceLink");
const { sendWaEvent } = require("../../utils/msg91Whatsapp");
const { describeFailure } = require("./sendCustomerMessageController");

const isObjectId = (id) => typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);

async function loadSaleContext(saleId) {
  const sale = await SalesSaleRef.findById(saleId).lean();
  if (!sale) return null;
  const [shop, branch] = await Promise.all([
    isObjectId(String(sale.shop_id)) ? Shop.findById(sale.shop_id).lean() : null,
    isObjectId(String(sale.branch_id)) ? SalesBranchRef.findById(sale.branch_id).lean() : null,
  ]);
  return { sale, shop, branch };
}

const invoiceLabel = (sale) => (sale.invoiceNo ? String(sale.invoiceNo) : String(sale._id).slice(-6).toUpperCase());

// GET /api/sales-invoice/pdf/:id?sig=  — public (MSG91 downloads it), protected by the HMAC in `sig`
const getSalesInvoicePdf = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id) || !isValidSalesInvoiceSig(id, req.query.sig)) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    const ctx = await loadSaleContext(id);
    if (!ctx || !ctx.shop) return res.status(404).json({ message: "Invoice not found" });

    const pdf = await generateSalesInvoicePdfBuffer(ctx);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Invoice-${invoiceLabel(ctx.sale)}.pdf"`);
    res.setHeader("Content-Length", pdf.length);
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.send(pdf);
  } catch (err) {
    console.error("❌ Sales invoice PDF error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Item summary for the template's "device" placeholders: "KOSA NECKBAND KS13" + "(+2 more items)"
function itemSummary(items) {
  const list = Array.isArray(items) ? items : [];
  const first = list[0] ? String(list[0].productName || list[0].productNo || "Item") : "Items";
  const qty = list.reduce((s, it) => s + (Number(it.qty) || 0), 0);
  const more = list.length > 1 ? `(+${list.length - 1} more item${list.length > 2 ? "s" : ""})` : `x${qty || 1}`;
  return { first, more };
}

// POST /api/internal/sales-bill/whatsapp  { saleId, shopId }  (x-internal-key, called by SalesServer)
// Sends the sale's A4 invoice PDF to the customer with the `sales_bill` event (admin switch per shop).
const sendSalesBillWhatsapp = async (req, res) => {
  try {
    const { saleId, shopId } = req.body || {};
    if (!isObjectId(String(saleId || "")) || !shopId) return res.status(400).json({ success: false, error: "Invalid sale." });

    const ctx = await loadSaleContext(saleId);
    if (!ctx || String(ctx.sale.shop_id) !== String(shopId) || !ctx.shop) {
      return res.status(404).json({ success: false, error: "Sale not found." });
    }
    const { sale, shop, branch } = ctx;
    if (!sale.customerNo) return res.status(400).json({ success: false, error: "This sale has no customer mobile number." });

    const pdfUrl = salesInvoiceUrl(String(sale._id));
    if (!pdfUrl) return res.status(503).json({ success: false, error: "WhatsApp billing is not configured yet (BILLIT_BACKEND_URL). Please contact support." });

    const no = invoiceLabel(sale);
    const { first, more } = itemSummary(sale.items);
    const total = Number(sale.totalAmount) || 0;
    const splits = Array.isArray(sale.paymentSplits) ? sale.paymentSplits : [];
    const received = splits.length ? splits.reduce((s, p) => s + (Number(p.amount) || 0), 0) : Number(sale.amountPaid) || total;
    const location = /^location not set$/i.test(String(shop.location || "").trim()) ? "" : shop.location;

    // Same 10 placeholders, in order, as the service "delivered" template (MSG91_TPL_DELIVERED):
    // {{1}} customer {{2}} shop {{3}} item {{4}} item detail {{5}} bill no {{6}} total paid
    // {{7}} payment method {{8}} balance {{9}} shop address {{10}} shop phone
    const vars = {
      customer_name: sale.customerName || "Customer",
      shop_name: branch?.name || shop.shop_name || "",
      mobile_name: first,
      model: more,
      bill_no: no,
      total_paid: received.toFixed(2),
      payment_method: sale.paymentMethod || "-",
      balance_amount: Math.max(0, total - received).toFixed(2),
      shop_address: branch?.address || shop.address || location || "-",
      shop_phone: branch?.phoneNumber || shop.phone || "-",
    };

    const result = await sendWaEvent({
      shopId: shop._id,
      event: "sales_bill",
      to: sale.customerNo,
      vars,
      header: { type: "document", value: pdfUrl, filename: `Invoice-${no}.pdf` },
      logVars: { ...vars, sale_id: String(sale._id) },
    });
    if (result.status === "sent") return res.json({ success: true, status: "sent", messageId: result.messageId || null });
    const { http, error } = describeFailure(result);
    const message = /disabled for shop/i.test(String(result.reason)) && /sales_bill/.test(String(result.reason))
      ? "WhatsApp billing is not enabled for your shop. Please contact support to enable it."
      : error;
    return res.status(http).json({ success: false, status: result.status, error: message });
  } catch (err) {
    console.error("❌ Sales bill WhatsApp error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

// GET /api/internal/sales-invoice/link/:id  (x-internal-key, called by SalesServer for the POS "A4" button)
// Built here so the link uses BillitServer's public BILLIT_BACKEND_URL, not SalesServer's internal address.
const getSalesInvoiceLink = (req, res) => {
  const { id } = req.params;
  if (!isObjectId(id)) return res.status(400).json({ success: false, error: "Invalid sale." });
  const url = salesInvoiceUrl(id);
  if (!url) return res.status(503).json({ success: false, error: "Invoice PDF link is not configured (BILLIT_BACKEND_URL)." });
  return res.json({ success: true, url });
};

module.exports = { getSalesInvoicePdf, sendSalesBillWhatsapp, getSalesInvoiceLink };

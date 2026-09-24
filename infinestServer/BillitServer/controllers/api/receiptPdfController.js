const { Customer, Dealer, Shop, Mobile } = require("../../models/mongoModels");
const { generateReceiptPdfBuffer } = require("../../utils/receiptPdf");

// Public endpoint (no auth) — generates the A4 receipt PDF on the fly so it can be
// referenced as a document URL in outbound WhatsApp template messages (e.g. delivery notice).
const getReceiptPdf = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid receipt ID format" });
    }

    const mobile = await Mobile.findById(id).lean();
    if (!mobile) return res.status(404).json({ message: "Receipt not found" });

    const client =
      (mobile.customer_id && (await Customer.findById(mobile.customer_id).lean())) ||
      (mobile.dealer_id && (await Dealer.findById(mobile.dealer_id).lean()));
    if (!client) return res.status(404).json({ message: "Client not found" });

    const shop = await Shop.findById(mobile.shop_id).lean();
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    const mobileQuery = {
      shop_id: mobile.shop_id,
      ...(mobile.customer_id ? { customer_id: mobile.customer_id } : { dealer_id: mobile.dealer_id }),
    };

    let mobileList;
    if (mobile.bill_no) {
      mobileQuery.bill_no = mobile.bill_no;
      mobileList = await Mobile.find(mobileQuery).lean();
      if (mobileList.length === 0) {
        delete mobileQuery.bill_no;
        mobileList = await Mobile.find(mobileQuery).lean();
      }
    } else {
      mobileList = await Mobile.find(mobileQuery).lean();
    }
    if (mobileList.length === 0) mobileList = [mobile];

    const billNo = client.bill_no || mobile.bill_no || "N/A";
    const pdfBuffer = await generateReceiptPdfBuffer({
      shop,
      client,
      mobiles: mobileList,
      billNo,
      termsAndConditions: shop.terms_and_conditions || "",
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Receipt-${billNo}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error("❌ Error generating receipt PDF:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = { getReceiptPdf };

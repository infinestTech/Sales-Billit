const { Mobile, Customer, Shop } = require("../../models/mongoModels");
const { fireWaEvent } = require("../../utils/msg91Whatsapp");

// Map field -> WA event for the (false -> true) transition only.
const FIELD_TO_EVENT = {
  ready: "mobile_ready",
  delivered: "mobile_delivered",
  returned: "mobile_returned",
};


const toggleMobileStatus = async (req, res) => {
  const { id, field } = req.body;


  if (!id || !field) {
    return res.status(400).json({ error: "Missing required parameters: id or field" });
  }


  if (!["ready", "delivered", "returned"].includes(field)) {
    return res.status(400).json({ error: "Invalid field parameter" });
  }


  try {
    const mobile = await Mobile.findById(id);
    if (!mobile) {
      return res.status(404).json({ error: "Mobile record not found" });
    }

    const prev = {
      ready: !!mobile.ready,
      delivered: !!mobile.delivered,
      returned: !!mobile.returned,
    };


    let updateData = {};


    if (field === "returned") {
      const isReady = prev.ready;
      const isDelivered = prev.delivered;


      if (!isReady && !isDelivered) {
        // Directly toggle returned
        updateData.returned = !prev.returned;
      } else {
        // If either ready or delivered is true, set both to false and set returned to true
        updateData.ready = false;
        updateData.delivered = false;
        updateData.delivery_date = null; // clear delivery date
        updateData.returned = true;
      }
    } else if (field === "delivered") {
      const newValue = !prev.delivered;
      updateData.delivered = newValue;
      updateData.delivery_date = newValue ? new Date() : null;
    } else if (field === "ready") {
      updateData.ready = !prev.ready;
    }


    const updatedMobile = await Mobile.findByIdAndUpdate(id, updateData, { new: true });

    // ---- WhatsApp triggers (only on false -> true transitions) ----
    try {
      const transitions = ["ready", "delivered", "returned"].filter(
        (f) => updateData[f] === true && prev[f] === false
      );

      if (transitions.length && mobile.customer_id) {
        const customer = await Customer.findById(mobile.customer_id).lean();
        const shop = customer ? await Shop.findById(customer.shop_id).lean() : null;

        if (customer && shop) {
          const totalPaid =
            updatedMobile?.total_paid ||
            (Array.isArray(updatedMobile?.payments)
              ? updatedMobile.payments.reduce((s, p) => s + (p.amount || 0), 0)
              : 0) ||
            updatedMobile?.paid_amount ||
            0;

          const paymentMethods = Array.isArray(updatedMobile?.payments)
            ? [...new Set(updatedMobile.payments.map((p) => p.method).filter(Boolean))].join(", ")
            : (updatedMobile?.payment || "");

          transitions.forEach((f) => {
            const event = FIELD_TO_EVENT[f];
            // Vars are positional — order must exactly match the MSG91 template placeholders.
            let vars;
            if (event === "mobile_ready") {
              // {{1}} customer_name {{2}} shop_name {{3}} mobile_name {{4}} model
              // {{5}} bill_no {{6}} shop_address {{7}} shop_phone
              vars = {
                customer_name: customer.client_name,
                shop_name: shop.shop_name || "",
                mobile_name: updatedMobile.mobile_name || "",
                model: updatedMobile.model || "",
                bill_no: customer.bill_no || "-",
                shop_address: shop.address || "",
                shop_phone: shop.phone || "",
              };
            } else if (event === "mobile_delivered") {
              // {{1}} customer_name {{2}} shop_name {{3}} mobile_name {{4}} model
              // {{5}} bill_no {{6}} total_paid {{7}} payment_method {{8}} balance_amount
              // {{9}} shop_address {{10}} shop_phone
              vars = {
                customer_name: customer.client_name,
                shop_name: shop.shop_name || "",
                mobile_name: updatedMobile.mobile_name || "",
                model: updatedMobile.model || "",
                bill_no: customer.bill_no || "-",
                total_paid: String(totalPaid),
                payment_method: paymentMethods || "-",
                balance_amount: String(customer.balance_amount || 0),
                shop_address: shop.address || "",
                shop_phone: shop.phone || "",
              };
            } else {
              // mobile_returned
              // {{1}} customer_name {{2}} shop_name {{3}} mobile_name {{4}} model
              // {{5}} bill_no {{6}} shop_address {{7}} shop_phone
              vars = {
                customer_name: customer.client_name,
                shop_name: shop.shop_name || "",
                mobile_name: updatedMobile.mobile_name || "",
                model: updatedMobile.model || "",
                bill_no: customer.bill_no || "-",
                shop_address: shop.address || "",
                shop_phone: shop.phone || "",
              };
            }

            fireWaEvent({
              shopId: shop._id,
              event,
              to: customer.mobile_number,
              vars,
            });
          });
        }
      }
    } catch (waErr) {
      console.error("[wa] toggleMobileStatus trigger failed:", waErr.message);
    }


    return res.status(200).json({ success: true, updatedMobile });
  } catch (error) {
    console.error("Error toggling status:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};


module.exports = { toggleMobileStatus };





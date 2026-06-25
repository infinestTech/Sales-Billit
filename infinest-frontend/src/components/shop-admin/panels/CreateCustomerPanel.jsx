"use client";
import { useEffect, useState } from "react";
import { UserPlus, Save } from "lucide-react";
import shopAdminApi from "../shopAdminApi";
import { PanelHeader, PanelCard, Btn, Field, Input, Toast, useToast } from "./_ui";
import MobileEntries, { emptyMobile } from "./MobileEntries";

export default function CreateCustomerPanel({ currentShopId }) {
  const { toast, show, clear } = useToast();
  const [form, setForm] = useState({ clientName: "", mobileNumber: "", billNo: "", balanceAmount: 0, estimatedCost: 0 });
  const [mobiles, setMobiles] = useState([emptyMobile()]);
  const [submitting, setSubmitting] = useState(false);
  const [billLoading, setBillLoading] = useState(false);

  const fetchBill = async () => {
    setBillLoading(true);
    try {
      const r = await shopAdminApi.nextBillNumber("CUST");
      setForm(f => ({ ...f, billNo: r.billNumber }));
    } catch (e) { console.error(e); }
    setBillLoading(false);
  };

  useEffect(() => { if (currentShopId) fetchBill(); /* eslint-disable-next-line */ }, [currentShopId]);

  const submit = async () => {
    if (!form.clientName.trim() || !form.mobileNumber.trim()) { show("Name and mobile number required", "error"); return; }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        noOfMobile: mobiles.filter(m => m.mobile_name.trim()).length,
        MobileName: mobiles.filter(m => m.mobile_name.trim()),
      };
      await shopAdminApi.createCustomer(payload);
      show("Customer record created successfully");
      setForm({ clientName: "", mobileNumber: "", billNo: "", balanceAmount: 0, estimatedCost: 0 });
      setMobiles([emptyMobile()]);
      fetchBill();
    } catch (e) {
      show(e?.response?.data?.message || "Failed to create record", "error");
    }
    setSubmitting(false);
  };

  return (
    <div>
      <PanelHeader icon={UserPlus} title="Create Customer Record" subtitle="Add a new customer with mobile service entries" accent="emerald" />

      <PanelCard className="p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Customer Name" required>
            <Input value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} placeholder="John Doe" />
          </Field>
          <Field label="Mobile Number" required>
            <Input value={form.mobileNumber} onChange={e => setForm({ ...form, mobileNumber: e.target.value })} placeholder="9876543210" />
          </Field>
          <Field label="Bill Number" hint={billLoading ? "Generating..." : "Auto-generated"}>
            <Input value={form.billNo} onChange={e => setForm({ ...form, billNo: e.target.value })} />
          </Field>
          <Field label="Estimated Cost (₹)">
            <Input type="number" value={form.estimatedCost} onChange={e => setForm({ ...form, estimatedCost: e.target.value })} />
          </Field>
          <Field label="Balance Amount (₹)">
            <Input type="number" value={form.balanceAmount} onChange={e => setForm({ ...form, balanceAmount: e.target.value })} />
          </Field>
        </div>
      </PanelCard>

      <MobileEntries mobiles={mobiles} setMobiles={setMobiles} />

      <div className="flex justify-end mt-6">
        <Btn icon={Save} onClick={submit} disabled={submitting}>{submitting ? "Saving..." : "Create Record"}</Btn>
      </div>

      {toast && <Toast {...toast} onClose={clear} />}
    </div>
  );
}

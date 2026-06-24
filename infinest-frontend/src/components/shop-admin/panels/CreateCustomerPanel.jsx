"use client";
import { useEffect, useState } from "react";
import { UserPlus, Plus, Trash2, Save } from "lucide-react";
import shopAdminApi from "../shopAdminApi";
import { PanelHeader, PanelCard, Btn, Field, Input, Select, Toast, useToast } from "./_ui";

const PAYMENT_METHODS = ["Cash", "UPI", "Card", "Bank Transfer", "Cheque", "Other"];

export default function CreateCustomerPanel({ currentShopId }) {
  const { toast, show, clear } = useToast();
  const [form, setForm] = useState({ clientName: "", mobileNumber: "", billNo: "", balanceAmount: 0, estimatedCost: 0 });
  const [mobiles, setMobiles] = useState([{ mobile_name: "", model: "", imei: "", issue: "", paid_amount: 0, payment: "Cash" }]);
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

  const updateMobile = (i, k, v) => setMobiles(arr => arr.map((m, idx) => idx === i ? { ...m, [k]: v } : m));
  const addMobile = () => setMobiles(arr => [...arr, { mobile_name: "", model: "", imei: "", issue: "", paid_amount: 0, payment: "Cash" }]);
  const removeMobile = (i) => setMobiles(arr => arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr);

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
      setMobiles([{ mobile_name: "", model: "", imei: "", issue: "", paid_amount: 0, payment: "Cash" }]);
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

      <PanelCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800">Mobile Entries</h3>
          <Btn variant="outline" icon={Plus} onClick={addMobile}>Add Mobile</Btn>
        </div>
        <div className="space-y-3">
          {mobiles.map((m, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end p-3 bg-slate-50 rounded-xl">
              <div className="md:col-span-3"><Field label="Mobile Name"><Input value={m.mobile_name} onChange={e => updateMobile(i, "mobile_name", e.target.value)} /></Field></div>
              <div className="md:col-span-2"><Field label="Model"><Input value={m.model} onChange={e => updateMobile(i, "model", e.target.value)} /></Field></div>
              <div className="md:col-span-2"><Field label="IMEI"><Input value={m.imei} onChange={e => updateMobile(i, "imei", e.target.value)} /></Field></div>
              <div className="md:col-span-2"><Field label="Issue"><Input value={m.issue} onChange={e => updateMobile(i, "issue", e.target.value)} /></Field></div>
              <div className="md:col-span-1"><Field label="Paid"><Input type="number" value={m.paid_amount} onChange={e => updateMobile(i, "paid_amount", e.target.value)} /></Field></div>
              <div className="md:col-span-1"><Field label="Method">
                <Select value={m.payment} onChange={e => updateMobile(i, "payment", e.target.value)}>
                  {PAYMENT_METHODS.map(p => <option key={p} value={p}>{p}</option>)}
                </Select>
              </Field></div>
              <div className="md:col-span-1 flex justify-center">
                <button onClick={() => removeMobile(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" disabled={mobiles.length === 1}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-6">
          <Btn icon={Save} onClick={submit} disabled={submitting}>{submitting ? "Saving..." : "Create Record"}</Btn>
        </div>
      </PanelCard>

      {toast && <Toast {...toast} onClose={clear} />}
    </div>
  );
}

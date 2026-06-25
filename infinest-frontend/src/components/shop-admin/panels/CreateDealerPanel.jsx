"use client";
import { useEffect, useState } from "react";
import { Briefcase, Plus, Trash2, Save } from "lucide-react";
import shopAdminApi from "../shopAdminApi";
import { PanelHeader, PanelCard, Btn, Field, Input, Toast, useToast } from "./_ui";
import MobileEntries, { emptyMobile } from "./MobileEntries";

export default function CreateDealerPanel({ currentShopId }) {
  const { toast, show, clear } = useToast();
  const [form, setForm] = useState({ clientName: "", mobileNumber: "", billNo: "", balanceAmount: 0, estimatedCost: 0 });
  const [vendors, setVendors] = useState([{ vendor_name: "", vendor_number: "", mobile_count: 0 }]);
  const [mobiles, setMobiles] = useState([emptyMobile()]);
  const [submitting, setSubmitting] = useState(false);

  const fetchBill = async () => {
    try {
      const r = await shopAdminApi.nextBillNumber("DEAL");
      setForm(f => ({ ...f, billNo: r.billNumber }));
    } catch (e) { console.error(e); }
  };
  useEffect(() => { if (currentShopId) fetchBill(); /* eslint-disable-next-line */ }, [currentShopId]);

  const updateVendor = (i, k, v) => setVendors(arr => arr.map((x, idx) => idx === i ? { ...x, [k]: v } : x));
  const addVendor = () => setVendors(arr => [...arr, { vendor_name: "", vendor_number: "", mobile_count: 0 }]);
  const removeVendor = (i) => setVendors(arr => arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr);

  const submit = async () => {
    if (!form.clientName.trim() || !form.mobileNumber.trim()) { show("Name and mobile required", "error"); return; }
    setSubmitting(true);
    try {
      await shopAdminApi.createDealer({
        ...form,
        vendors: vendors.filter(v => v.vendor_name.trim()),
        MobileName: mobiles.filter(m => m.mobile_name.trim()),
      });
      show("Dealer record created");
      setForm({ clientName: "", mobileNumber: "", billNo: "", balanceAmount: 0, estimatedCost: 0 });
      setVendors([{ vendor_name: "", vendor_number: "", mobile_count: 0 }]);
      setMobiles([emptyMobile()]);
      fetchBill();
    } catch (e) { show(e?.response?.data?.message || "Failed", "error"); }
    setSubmitting(false);
  };

  return (
    <div>
      <PanelHeader icon={Briefcase} title="Create Dealer Record" subtitle="Add a new dealer with vendor breakdown" accent="purple" />
      <PanelCard className="p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Dealer Name" required><Input value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} /></Field>
          <Field label="Mobile Number" required><Input value={form.mobileNumber} onChange={e => setForm({ ...form, mobileNumber: e.target.value })} /></Field>
          <Field label="Bill Number"><Input value={form.billNo} onChange={e => setForm({ ...form, billNo: e.target.value })} /></Field>
          <Field label="Estimated Cost (₹)"><Input type="number" value={form.estimatedCost} onChange={e => setForm({ ...form, estimatedCost: e.target.value })} /></Field>
          <Field label="Balance Amount (₹)"><Input type="number" value={form.balanceAmount} onChange={e => setForm({ ...form, balanceAmount: e.target.value })} /></Field>
        </div>
      </PanelCard>
      <PanelCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800">Vendors</h3>
          <Btn variant="outline" icon={Plus} onClick={addVendor}>Add Vendor</Btn>
        </div>
        <div className="space-y-3">
          {vendors.map((v, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end p-3 bg-slate-50 rounded-xl">
              <div className="md:col-span-5"><Field label="Vendor Name"><Input value={v.vendor_name} onChange={e => updateVendor(i, "vendor_name", e.target.value)} /></Field></div>
              <div className="md:col-span-4"><Field label="Vendor Number"><Input value={v.vendor_number} onChange={e => updateVendor(i, "vendor_number", e.target.value)} /></Field></div>
              <div className="md:col-span-2"><Field label="Mobile Count"><Input type="number" value={v.mobile_count} onChange={e => updateVendor(i, "mobile_count", e.target.value)} /></Field></div>
              <div className="md:col-span-1 flex justify-center">
                <button onClick={() => removeVendor(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" disabled={vendors.length === 1}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </PanelCard>

      <div className="mb-6" />
      <MobileEntries mobiles={mobiles} setMobiles={setMobiles} />

      <div className="flex justify-end mt-6">
        <Btn icon={Save} onClick={submit} disabled={submitting}>{submitting ? "Saving..." : "Create Dealer"}</Btn>
      </div>
      {toast && <Toast {...toast} onClose={clear} />}
    </div>
  );
}

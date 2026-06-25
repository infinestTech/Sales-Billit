"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import shopAdminApi from "../shopAdminApi";
import { PanelCard, Btn, Field, Input, Select, Modal, Toast, useToast } from "./_ui";

// Empty mobile-entry row. Backend (shopAdminRoutes /records/customer & /records/dealer)
// reads m.mobile_name, m.model, m.imei, m.issue — paid/method are added later in All Records.
export const emptyMobile = () => ({ mobile_name: "", model: "", imei: "", issue: "" });

// Reusable mobile-entries editor shared by the Create Customer and Create Dealer panels.
// Mirrors the fixel portal's MobileEntryTable: brand + issue come from dropdowns of existing
// values, with an "Add Custom" (+) modal for each. No paid amount / payment method here.
export default function MobileEntries({ mobiles, setMobiles }) {
  const { toast, show, clear } = useToast();
  const [brands, setBrands] = useState([]);
  const [issues, setIssues] = useState([]);
  const [brandModal, setBrandModal] = useState(false);
  const [issueModal, setIssueModal] = useState(false);
  const [newBrand, setNewBrand] = useState("");
  const [newIssue, setNewIssue] = useState({ issueName: "", issueCategory: "General" });
  const [saving, setSaving] = useState(false);

  const loadBrands = async () => {
    try { const r = await shopAdminApi.mobileBrands(); setBrands(r.brands || []); }
    catch (e) { console.error("load brands", e); }
  };
  const loadIssues = async () => {
    try { const r = await shopAdminApi.mobileIssues(); setIssues(r.issues || []); }
    catch (e) { console.error("load issues", e); }
  };
  useEffect(() => { loadBrands(); loadIssues(); }, []);

  const update = (i, k, v) => setMobiles(arr => arr.map((m, idx) => idx === i ? { ...m, [k]: v } : m));
  const add = () => setMobiles(arr => [...arr, emptyMobile()]);
  const remove = (i) => setMobiles(arr => arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr);

  const saveBrand = async () => {
    if (!newBrand.trim()) { show("Brand name required", "error"); return; }
    setSaving(true);
    try {
      const r = await shopAdminApi.addMobileBrand(newBrand.trim());
      await loadBrands();
      show("Brand added");
      setBrandModal(false); setNewBrand("");
      // pre-select the new brand on the first empty row
      const name = r?.brand?.brand_name || newBrand.trim();
      setMobiles(arr => {
        const idx = arr.findIndex(m => !m.mobile_name.trim());
        return idx === -1 ? arr : arr.map((m, i) => i === idx ? { ...m, mobile_name: name } : m);
      });
    } catch (e) { show(e?.response?.data?.message || "Failed to add brand", "error"); }
    setSaving(false);
  };

  const saveIssue = async () => {
    if (!newIssue.issueName.trim()) { show("Issue name required", "error"); return; }
    setSaving(true);
    try {
      const r = await shopAdminApi.addMobileIssue(newIssue);
      await loadIssues();
      show("Issue added");
      setIssueModal(false);
      const name = r?.issue?.issue_name || newIssue.issueName.trim();
      setNewIssue({ issueName: "", issueCategory: "General" });
      setMobiles(arr => {
        const idx = arr.findIndex(m => !m.issue.trim());
        return idx === -1 ? arr : arr.map((m, i) => i === idx ? { ...m, issue: name } : m);
      });
    } catch (e) { show(e?.response?.data?.message || "Failed to add issue", "error"); }
    setSaving(false);
  };

  return (
    <PanelCard className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-800">Mobile Entries</h3>
        <Btn variant="outline" icon={Plus} onClick={add}>Add Mobile</Btn>
      </div>
      <div className="space-y-3">
        {mobiles.map((m, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end p-3 bg-slate-50 rounded-xl">
            <div className="md:col-span-3">
              <Field label="Mobile Name">
                <div className="flex items-center gap-1">
                  <Select value={m.mobile_name} onChange={e => update(i, "mobile_name", e.target.value)}>
                    <option value="">Select Brand</option>
                    {brands.map(b => <option key={b._id} value={b.brand_name}>{b.brand_name}{b.is_custom ? " (Custom)" : ""}</option>)}
                  </Select>
                  <button type="button" onClick={() => setBrandModal(true)} title="Add custom brand"
                    className="shrink-0 p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Plus className="h-4 w-4" /></button>
                </div>
              </Field>
            </div>
            <div className="md:col-span-2"><Field label="Model"><Input value={m.model} onChange={e => update(i, "model", e.target.value)} placeholder="Enter model" /></Field></div>
            <div className="md:col-span-2"><Field label="IMEI"><Input value={m.imei} onChange={e => update(i, "imei", e.target.value)} placeholder="Optional IMEI" /></Field></div>
            <div className="md:col-span-4">
              <Field label="Issue">
                <div className="flex items-center gap-1">
                  <Select value={m.issue} onChange={e => update(i, "issue", e.target.value)}>
                    <option value="">Select Issue</option>
                    {issues.map(is => <option key={is._id} value={is.issue_name}>{is.issue_name} ({is.issue_category}){is.is_custom ? " (Custom)" : ""}</option>)}
                  </Select>
                  <button type="button" onClick={() => setIssueModal(true)} title="Add custom issue"
                    className="shrink-0 p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Plus className="h-4 w-4" /></button>
                </div>
              </Field>
            </div>
            <div className="md:col-span-1 flex justify-center">
              <button type="button" onClick={() => remove(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" disabled={mobiles.length === 1}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={brandModal} onClose={() => setBrandModal(false)} title="Add Custom Brand">
        <div className="space-y-3">
          <Field label="Brand Name" required><Input value={newBrand} onChange={e => setNewBrand(e.target.value)} placeholder="e.g. OnePlus" /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="secondary" onClick={() => setBrandModal(false)}>Cancel</Btn>
            <Btn icon={Plus} onClick={saveBrand} disabled={saving}>{saving ? "Saving..." : "Add Brand"}</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={issueModal} onClose={() => setIssueModal(false)} title="Add Custom Issue">
        <div className="space-y-3">
          <Field label="Issue Name" required><Input value={newIssue.issueName} onChange={e => setNewIssue({ ...newIssue, issueName: e.target.value })} placeholder="e.g. Screen Replacement" /></Field>
          <Field label="Category"><Input value={newIssue.issueCategory} onChange={e => setNewIssue({ ...newIssue, issueCategory: e.target.value })} placeholder="e.g. Screen, Battery, Software" /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="secondary" onClick={() => setIssueModal(false)}>Cancel</Btn>
            <Btn icon={Plus} onClick={saveIssue} disabled={saving}>{saving ? "Saving..." : "Add Issue"}</Btn>
          </div>
        </div>
      </Modal>

      {toast && <Toast {...toast} onClose={clear} />}
    </PanelCard>
  );
}

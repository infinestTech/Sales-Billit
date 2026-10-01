'use client';
import React, { useRef, useState, useEffect } from "react";
import { useReactToPrint } from "react-to-print";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { IoCloseCircleOutline } from "react-icons/io5";
import { Receipt, Smartphone, ShieldCheck, ShieldOff, FileText, ArrowLeft, Printer, Download } from "lucide-react";
import authApi from "../authApi";
import api from "../api";
import { formatPaymentMethodLabel } from "@/constants/paymentMethods";
import { fetchMobileImages } from "@/utils/mobileImagesApi";

const DEFAULT_TERMS_AND_CONDITIONS = [
  "No guarantee for liquid / water damage.",
  "Collect your device within 30 days of completion.",
  "We are not responsible for any data loss.",
  "Advance payment required before ordering parts.",
];

// Formats a warranty value for display, e.g. "6 Months (till 12 Jun 2026)" or "No Warranty"
const formatWarranty = (mobile) => {
  if (!mobile?.has_warranty) return "No Warranty";
  const months = mobile.warranty_months;
  const expiry = mobile.warranty_expiry_date
    ? new Date(mobile.warranty_expiry_date).toLocaleDateString("en-IN")
    : null;
  return `${months ? `${months} Month${months === 1 ? "" : "s"}` : "Yes"}${expiry ? ` (till ${expiry})` : ""}`;
};

const RECEIPT_TYPE_OPTIONS = [
  { id: "a4", label: "A4 Invoice", description: "Full-page invoice with warranty & terms", icon: FileText },
  { id: "jobcard", label: "Job Card", description: "A5 landscape service job card", icon: Smartphone },
  { id: "thermal", label: "Thermal Receipt", description: "80mm receipt printer slip", icon: Printer },
];

// Sizing (mm) for the on-screen scaled preview — not the actual print/PDF dimensions
const MM_TO_PX = 3.7795275591;
const PREVIEW_STAGE_WIDTH = 460;
const PREVIEW_DIMENSIONS_MM = {
  jobcard: { w: 210, h: 148 },
  a4: { w: 210, h: 297 }, // per page; multiplied by the A4 page count
};

const getScaledPreviewStyle = (type, pageCount = 1) => {
  const dims = PREVIEW_DIMENSIONS_MM[type] || PREVIEW_DIMENSIONS_MM.a4;
  const contentWidth = dims.w * MM_TO_PX;
  const contentHeight = dims.h * MM_TO_PX * (type === 'a4' ? pageCount : 1);
  const scale = PREVIEW_STAGE_WIDTH / contentWidth;
  return { wrapperWidth: contentWidth * scale, wrapperHeight: contentHeight * scale, contentWidth, scale };
};

// Single Job Card for one mobile device (used when only 1 mobile is selected)
const SingleJobCard = ({ clientData, mobile, shopPhoneNumber, shopAddress, shopEmail, shopName, profilePhoto }) => {
  return (
    <div
      className="receipt-print-root bg-white p-2 border-2 border-gray-800"
      style={{
        width: '210mm',
        height: '148mm',
        fontFamily: 'Arial, sans-serif',
        fontSize: '10px',
      }}
    >
      {/* Header Section */}
      <div className="border-2 border-gray-800 p-2 mb-1">
        <div className="flex items-start justify-between">
          <div className="w-16 h-16 flex items-center justify-center bg-gray-50 flex-shrink-0">
            {profilePhoto ? (
              <img src={profilePhoto} alt="Shop Logo" className="w-full h-full object-cover" />
            ) : (
              <div className="text-xs text-gray-400 text-center">LOGO</div>
            )}
          </div>
          <div className="flex-1 text-center px-4">
            <h1 className="text-xl font-bold text-gray-800 uppercase leading-tight" style={{ color: '#8B4513' }}>
              {shopName || clientData.owner_name || "MOBILE SERVICE"}
            </h1>
            <p className="text-base text-gray-700 leading-tight">
              {shopAddress || "Address Not Provided"}
            </p>
            <p className="text-base text-gray-700 leading-tight">
              Ph: {shopPhoneNumber || "N/A"}
            </p>
            {shopEmail && shopEmail.trim() !== "" && shopEmail !== "N/A" && (
              <p className="text-base text-gray-700 leading-tight">
                Email: {shopEmail}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="border-2 border-gray-800 flex" style={{ height: '113mm' }}>
        {/* Left Column */}
        <div className="flex-1 flex flex-col" style={{ width: '70%' }}>
          <div className="border-b border-gray-800 px-2 py-1 flex" style={{ minHeight: '6mm' }}>
            <span className="text-sm font-semibold" style={{ minWidth: '110px' }}>Customer Name :</span>
            <span className="text-sm flex-1">{clientData.client_name || ""}</span>
          </div>
          <div className="border-b border-gray-800 px-2 py-1 flex" style={{ minHeight: '6mm' }}>
            <span className="text-sm font-semibold" style={{ minWidth: '110px' }}>Phone / Mobile No :</span>
            <span className="text-sm flex-1">{clientData.mobile_number || ""}</span>
          </div>
          <div className="border-b border-gray-800 px-2 py-1 flex" style={{ minHeight: '6mm' }}>
            <span className="text-sm font-semibold" style={{ minWidth: '110px' }}>Mobile Make :</span>
            <span className="text-sm flex-1">{mobile.mobile_name || ""}</span>
          </div>
          <div className="border-b border-gray-800 px-2 py-1 flex" style={{ minHeight: '6mm' }}>
            <span className="text-sm font-semibold" style={{ minWidth: '110px' }}>Model No. :</span>
            <span className="text-sm flex-1">{mobile.model || ""}</span>
          </div>
          <div className="border-b border-gray-800 px-2 py-1 flex" style={{ minHeight: '6mm' }}>
            <span className="text-sm font-semibold" style={{ minWidth: '110px' }}>IMEI No. :</span>
            <span className="text-sm flex-1">{mobile.imei || ""}</span>
          </div>
          <div className="border-b border-gray-800 px-2 py-1 flex" style={{ minHeight: '6mm' }}>
            <span className="text-sm font-semibold" style={{ minWidth: '110px' }}>Complaint :</span>
            <span className="text-sm flex-1">{mobile.issue || ""}</span>
          </div>
          <div className="border-b border-gray-800 px-2 py-1 flex items-center" style={{ minHeight: '6mm' }}>
            <span className="text-sm font-semibold" style={{ minWidth: '110px' }}>Flashing :</span>
            <div className="flex-1 flex justify-end items-center">
              <span className="text-xs text-gray-500 mr-1">Backup - Yes / No</span>
            </div>
          </div>
          <div className="border-b border-gray-800 px-2 py-1 flex" style={{ minHeight: '6mm' }}>
            <span className="text-sm font-semibold" style={{ minWidth: '110px' }}>Date of Delivery :</span>
            <span className="text-sm flex-1">{mobile.delivery_date ? new Date(mobile.delivery_date).toLocaleDateString("en-IN") : ""}</span>
          </div>
          <div className="border-b border-gray-800 px-2 py-1 flex" style={{ minHeight: '6mm' }}>
            <span className="text-sm font-semibold" style={{ minWidth: '110px' }}>Estimate Amount :</span>
            <span className="text-sm flex-1">{mobile.estimate_amount || ""}</span>
          </div>
          <div className="flex-1 flex items-end p-1">
            <span className="text-xs">For {shopName || clientData.owner_name || "MOBILE SERVICE"}</span>
          </div>
        </div>

        {/* Right Column - Job Card Info */}
        <div className="border-l-2 border-gray-800 flex flex-col" style={{ width: '30%' }}>
          <div className="bg-gray-100 p-1 text-center border-b border-gray-800">
            <h2 className="text-sm font-bold leading-tight" style={{ color: '#8B4513' }}>JOB CARD</h2>
          </div>
          <div className="p-1 border-b border-gray-800">
            <div className="text-xs font-semibold">Sl. No.</div>
            <div className="text-lg font-bold text-center">{clientData.bill_no || ""}</div>
          </div>
          <div className="px-1 py-0.5 border-b border-gray-800">
            <div className="text-xs">Comp. No. ................</div>
          </div>
          <div className="px-1 py-0.5 border-b border-gray-800">
            <div className="text-xs">Date : {new Date().toLocaleDateString("en-IN")}</div>
          </div>
          <div className="p-1 border-b border-gray-800">
            <div className="text-xs font-bold mb-0.5">ACCESSORIES</div>
            <div className="space-y-0.5 text-xs leading-tight">
              {['Battery', 'Back Door', 'Sim Card', 'Memory Card', 'Head Set', 'Charger', 'Bluetooth', 'Others'].map((item) => (
                <label key={item} className="flex items-center">
                  <input type="checkbox" className="mr-1" disabled style={{ width: '9px', height: '9px' }} />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="px-1 py-0.5 border-b border-gray-800 text-center text-xs leading-tight" />
          <div className="flex-1 p-1 flex flex-col justify-end">
            <div className="text-center text-xs">
              <div className="border-t border-gray-400 pt-0.5">Signature of Customer</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Multi-mobile Job Card: all mobiles on a single receipt with a table
const MultiMobileJobCard = ({ clientData, mobiles, shopPhoneNumber, shopAddress, shopEmail, shopName, profilePhoto }) => {
  return (
    <div
      className="receipt-print-root bg-white p-2 border-2 border-gray-800"
      style={{
        width: '210mm',
        minHeight: '148mm',
        fontFamily: 'Arial, sans-serif',
        fontSize: '10px',
      }}
    >
      {/* Header Section */}
      <div className="border-2 border-gray-800 p-2 mb-1">
        <div className="flex items-start justify-between">
          <div className="w-16 h-16 flex items-center justify-center bg-gray-50 flex-shrink-0">
            {profilePhoto ? (
              <img src={profilePhoto} alt="Shop Logo" className="w-full h-full object-cover" />
            ) : (
              <div className="text-xs text-gray-400 text-center">LOGO</div>
            )}
          </div>
          <div className="flex-1 text-center px-4">
            <h1 className="text-xl font-bold text-gray-800 uppercase leading-tight" style={{ color: '#8B4513' }}>
              {shopName || clientData.owner_name || "MOBILE SERVICE"}
            </h1>
            <p className="text-base text-gray-700 leading-tight">
              {shopAddress || "Address Not Provided"}
            </p>
            <p className="text-base text-gray-700 leading-tight">
              Ph: {shopPhoneNumber || "N/A"}
            </p>
            {shopEmail && shopEmail.trim() !== "" && shopEmail !== "N/A" && (
              <p className="text-base text-gray-700 leading-tight">
                Email: {shopEmail}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Customer Info & Job Card side by side */}
      <div className="border-2 border-gray-800 flex mb-1">
        <div className="flex-1 flex flex-col">
          <div className="border-b border-gray-800 px-2 py-1 flex" style={{ minHeight: '7mm' }}>
            <span className="text-sm font-semibold" style={{ minWidth: '130px' }}>Customer Name :</span>
            <span className="text-sm flex-1">{clientData.client_name || ""}</span>
          </div>
          <div className="px-2 py-1 flex" style={{ minHeight: '7mm' }}>
            <span className="text-sm font-semibold" style={{ minWidth: '130px' }}>Phone / Mobile No :</span>
            <span className="text-sm flex-1">{clientData.mobile_number || ""}</span>
          </div>
        </div>
        <div className="border-l-2 border-gray-800 flex flex-col items-center justify-center px-4" style={{ minWidth: '130px' }}>
          <div className="text-sm font-bold" style={{ color: '#8B4513' }}>JOB CARD</div>
          <div className="text-lg font-bold">{clientData.bill_no || ""}</div>
          <div className="text-xs text-gray-600">Date: {new Date().toLocaleDateString("en-IN")}</div>
        </div>
      </div>

      {/* Devices Table */}
      <div className="border-2 border-gray-800">
        <table className="w-full border-collapse" style={{ fontSize: '11px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f3f3' }}>
              <th className="border border-gray-800 px-2 py-2 text-left font-bold" style={{ width: '24px' }}>#</th>
              <th className="border border-gray-800 px-2 py-2 text-left font-bold">Mobile Make</th>
              <th className="border border-gray-800 px-2 py-2 text-left font-bold">Model</th>
              <th className="border border-gray-800 px-2 py-2 text-left font-bold">IMEI No.</th>
              <th className="border border-gray-800 px-2 py-2 text-left font-bold">Complaint</th>
              <th className="border border-gray-800 px-2 py-2 text-left font-bold">Date Added</th>
              <th className="border border-gray-800 px-2 py-2 text-left font-bold">Delivery Date</th>
              <th className="border border-gray-800 px-2 py-2 text-right font-bold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {mobiles.map((mobile, idx) => {
              const paid = mobile.total_paid || (mobile.payments && mobile.payments.length > 0 ? mobile.payments.reduce((sum, p) => sum + (p.amount || 0), 0) : 0) || mobile.paid_amount || 0;
              return (
                <tr key={mobile._id || idx}>
                  <td className="border border-gray-800 px-2 py-2 text-center">{idx + 1}</td>
                  <td className="border border-gray-800 px-2 py-2">{mobile.mobile_name || "-"}</td>
                  <td className="border border-gray-800 px-2 py-2">{mobile.model || "-"}</td>
                  <td className="border border-gray-800 px-2 py-2">{mobile.imei || "-"}</td>
                  <td className="border border-gray-800 px-2 py-2">{mobile.issue || "-"}</td>
                  <td className="border border-gray-800 px-2 py-2">{mobile.added_date ? new Date(mobile.added_date).toLocaleDateString("en-IN") : "-"}</td>
                  <td className="border border-gray-800 px-2 py-2">{mobile.delivery_date ? new Date(mobile.delivery_date).toLocaleDateString("en-IN") : "-"}</td>
                  <td className="border border-gray-800 px-2 py-2 text-right">₹{paid}</td>
                </tr>
              );
            })}
            {/* Total Row */}
            <tr style={{ backgroundColor: '#f9f9f9' }}>
              <td colSpan="7" className="border border-gray-800 px-2 py-2 text-right font-bold">Total</td>
              <td className="border border-gray-800 px-2 py-2 text-right font-bold">
                ₹{mobiles.reduce((sum, m) => {
                  const paid = m.total_paid || (m.payments && m.payments.length > 0 ? m.payments.reduce((s, p) => s + (p.amount || 0), 0) : 0) || m.paid_amount || 0;
                  return sum + paid;
                }, 0)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Bottom Section - Accessories & Details */}
      <div className="border-2 border-gray-800 mt-1 flex">
        {/* Left: Flashing & Note */}
        <div className="flex-1 flex flex-col border-r border-gray-800">
          <div className="border-b border-gray-800 px-2 py-1 flex items-center" style={{ minHeight: '6mm' }}>
            <span className="text-sm font-semibold" style={{ minWidth: '80px' }}>Flashing :</span>
            <div className="flex-1 flex justify-end items-center">
              <span className="text-xs text-gray-500">Backup - Yes / No</span>
            </div>
          </div>
          <div className="px-2 py-1 flex-1" style={{ minHeight: '12mm' }}>
            <span className="text-xs text-gray-500">Notes:</span>
          </div>
        </div>

        {/* Middle: Comp. No & Accessories */}
        <div className="flex flex-col border-r border-gray-800" style={{ minWidth: '160px' }}>
          <div className="px-2 py-0.5 border-b border-gray-800">
            <div className="text-xs">Comp. No. ................</div>
          </div>
          <div className="p-1">
            <div className="text-xs font-bold mb-0.5">ACCESSORIES</div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs leading-tight">
              {['Battery', 'Back Door', 'Sim Card', 'Memory Card', 'Head Set', 'Charger', 'Bluetooth', 'Others'].map((item) => (
                <label key={item} className="flex items-center">
                  <input type="checkbox" className="mr-0.5" disabled style={{ width: '9px', height: '9px' }} />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Estimate Amount */}
        <div className="flex flex-col items-center justify-center px-3" style={{ minWidth: '100px' }}>
          <div className="text-xs font-semibold text-gray-600">Estimate Amount</div>
          <div className="text-base font-bold mt-1">
            ₹{mobiles.reduce((sum, m) => {
              const paid = m.total_paid || (m.payments && m.payments.length > 0 ? m.payments.reduce((s, p) => s + (p.amount || 0), 0) : 0) || m.paid_amount || 0;
              return sum + paid;
            }, 0)}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-end mt-2 px-2" style={{ minHeight: '15mm' }}>
        <div>
          <span className="text-xs">For {shopName || clientData.owner_name || "MOBILE SERVICE"}</span>
        </div>
        <div className="text-center">
          <div className="border-t border-gray-400 pt-0.5 text-xs" style={{ minWidth: '120px' }}>
            Signature of Customer
          </div>
        </div>
      </div>
    </div>
  );
};

// Printable Receipt: single card for 1 mobile, multi-mobile table for 2+
const PrintableReceipt = React.forwardRef(({ clientData, shopPhoneNumber, shopAddress, shopEmail, shopName, profilePhoto }, ref) => {
  const mobiles = clientData.MobileName || [];

  if (mobiles.length <= 1) {
    return (
      <div ref={ref}>
        <SingleJobCard
          clientData={clientData}
          mobile={mobiles[0] || {}}
          shopPhoneNumber={shopPhoneNumber}
          shopAddress={shopAddress}
          shopEmail={shopEmail}
          shopName={shopName}
          profilePhoto={profilePhoto}
        />
      </div>
    );
  }

  return (
    <div ref={ref}>
      <MultiMobileJobCard
        clientData={clientData}
        mobiles={mobiles}
        shopPhoneNumber={shopPhoneNumber}
        shopAddress={shopAddress}
        shopEmail={shopEmail}
        shopName={shopName}
        profilePhoto={profilePhoto}
      />
    </div>
  );
});

PrintableReceipt.displayName = "PrintableReceipt";

// ─── Thermal Receipt (80mm paper) ───────────────────────────────────────────
const ThermalReceipt = ({ clientData, mobiles, shopPhoneNumber, shopAddress, shopEmail, shopName }) => {
  const totalPaid = mobiles.reduce((sum, m) => {
    const paid = m.total_paid || (m.payments && m.payments.length > 0 ? m.payments.reduce((s, p) => s + (p.amount || 0), 0) : 0) || m.paid_amount || 0;
    return sum + paid;
  }, 0);

  const dottedLine = '- - - - - - - - - - - - - - - - - - - - -';

  return (
    <div
      style={{
        width: '72mm',
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: '11px',
        lineHeight: '1.4',
        color: '#000',
        padding: '2mm 3mm',
        boxSizing: 'border-box',
      }}
    >
      {/* Shop Header */}
      <div style={{ textAlign: 'center', marginBottom: '2mm' }}>
        <div style={{ fontSize: '15px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
          {shopName || clientData.owner_name || "MOBILE SERVICE"}
        </div>
        <div style={{ fontSize: '10px', marginTop: '1mm' }}>
          {shopAddress || ""}
        </div>
        <div style={{ fontSize: '10px' }}>
          Ph: {shopPhoneNumber || "N/A"}
        </div>
        {shopEmail && shopEmail.trim() !== "" && shopEmail !== "N/A" && (
          <div style={{ fontSize: '9px' }}>{shopEmail}</div>
        )}
      </div>

      <div style={{ textAlign: 'center', fontSize: '9px', letterSpacing: '1px' }}>{dottedLine}</div>

      {/* Bill Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '1mm 0' }}>
        <span>Bill#: <strong>{clientData.bill_no || "N/A"}</strong></span>
        <span>{new Date().toLocaleDateString("en-IN")}</span>
      </div>

      {/* Customer Info */}
      <div style={{ fontSize: '10px', marginBottom: '1mm' }}>
        <div>Name: <strong>{clientData.client_name || ""}</strong></div>
        <div>Phone: {clientData.mobile_number || ""}</div>
      </div>

      <div style={{ textAlign: 'center', fontSize: '9px', letterSpacing: '1px' }}>{dottedLine}</div>

      {/* Devices */}
      {mobiles.map((mobile, idx) => {
        const paid = mobile.total_paid || (mobile.payments && mobile.payments.length > 0 ? mobile.payments.reduce((s, p) => s + (p.amount || 0), 0) : 0) || mobile.paid_amount || 0;
        return (
          <div key={mobile._id || idx} style={{ margin: '2mm 0' }}>
            {mobiles.length > 1 && (
              <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '0.5mm' }}>
                Device {idx + 1}:
              </div>
            )}
            <div style={{ fontSize: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Mobile</span>
                <span style={{ fontWeight: 'bold' }}>{mobile.mobile_name || "-"}</span>
              </div>
              {mobile.model && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Model</span>
                  <span>{mobile.model}</span>
                </div>
              )}
              {mobile.imei && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>IMEI</span>
                  <span style={{ fontSize: '9px' }}>{mobile.imei}</span>
                </div>
              )}
              {mobile.issue && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Issue</span>
                  <span>{mobile.issue}</span>
                </div>
              )}
              {mobile.delivery_date && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Delivery</span>
                  <span>{new Date(mobile.delivery_date).toLocaleDateString("en-IN")}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                <span>Amount</span>
                <span>Rs.{paid}</span>
              </div>
            </div>
            {mobiles.length > 1 && idx < mobiles.length - 1 && (
              <div style={{ textAlign: 'center', fontSize: '8px', color: '#666', margin: '1mm 0' }}>. . . . . . . . . . . . . . . . . .</div>
            )}
          </div>
        );
      })}

      <div style={{ textAlign: 'center', fontSize: '9px', letterSpacing: '1px' }}>{dottedLine}</div>

      {/* Total */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', margin: '2mm 0' }}>
        <span>TOTAL</span>
        <span>Rs.{totalPaid}</span>
      </div>

      <div style={{ textAlign: 'center', fontSize: '9px', letterSpacing: '1px' }}>{dottedLine}</div>

      {/* Payment method (show if single mobile) */}
      {mobiles.length === 1 && mobiles[0].paymentMethod && (
        <div style={{ fontSize: '10px', textAlign: 'center', margin: '1mm 0' }}>
          Paid via: {formatPaymentMethodLabel(mobiles[0].paymentMethod)}
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: 'center', margin: '3mm 0 1mm', fontSize: '10px' }}>
        <div style={{ fontWeight: 'bold' }}>Thank you for your visit!</div>
        <div style={{ fontSize: '8px', color: '#555', marginTop: '1mm' }}>
          * No guarantee for water damage
        </div>
        <div style={{ fontSize: '8px', color: '#555' }}>
          * Collect device within 30 days
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: '9px', letterSpacing: '1px', marginBottom: '2mm' }}>{dottedLine}</div>
    </div>
  );
};

// PrintableThermalReceipt: forwardRef wrapper for thermal printing
const PrintableThermalReceipt = React.forwardRef(({ clientData, shopPhoneNumber, shopAddress, shopEmail, shopName }, ref) => {
  const mobiles = clientData.MobileName || [];
  return (
    <div ref={ref}>
      <ThermalReceipt
        clientData={clientData}
        mobiles={mobiles}
        shopPhoneNumber={shopPhoneNumber}
        shopAddress={shopAddress}
        shopEmail={shopEmail}
        shopName={shopName}
      />
    </div>
  );
});
PrintableThermalReceipt.displayName = "PrintableThermalReceipt";

// ─── A4 Receipt (2 × A4 portrait: receipt + photos, then terms) ───────────────
// Background-image + contain instead of <img object-fit>, which html2canvas doesn't honour.
const A4PhotoBox = ({ url, label }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    if (!url) return;
    const img = new Image();
    img.onerror = () => setFailed(true);
    img.src = url;
  }, [url]);
  const showImage = url && !failed;
  return (
    <div style={{ flex: 1, maxWidth: '170px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ fontSize: '9px', color: '#666', textAlign: 'center', marginBottom: '2px' }}>{label.replace(' Photo', '')}</div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          border: '1px solid #999',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fff',
          backgroundImage: showImage ? `url("${url}")` : 'none',
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundOrigin: 'content-box',
          padding: '3px',
        }}
      >
        {!showImage && <span style={{ fontSize: '9px', color: '#999' }}>{label}</span>}
      </div>
    </div>
  );
};

const A4MobilePhotos = ({ mobiles, photosByMobile }) => {
  const n = mobiles.length;
  if (n === 0) return null;
  const cols = n === 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4;
  const rows = Math.ceil(n / cols);
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', borderTop: '1px solid #ddd', paddingTop: '6px' }}>
      <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#333', marginBottom: '6px' }}>Mobile Photos</div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          gap: '8px 14px',
        }}
      >
        {mobiles.map((m, idx) => {
          const photos = (m._id && photosByMobile[m._id]) || {};
          return (
            <div key={m._id || idx} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ flex: 1, minHeight: 0, maxHeight: '240px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <A4PhotoBox url={photos.front} label="Front Photo" />
                <A4PhotoBox url={photos.back} label="Back Photo" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const A4_PAGE_STYLE = {
  width: '210mm',
  height: '297mm',
  padding: '12mm 14mm',
  boxSizing: 'border-box',
  background: '#fff',
  overflow: 'hidden',
};

// Fixed geometry (px) for the terms-images grid; must match the pagination maths below.
const A4_CONTENT_H_PX = (297 - 24) * MM_TO_PX;
const TERMS_IMG_TITLE_MIN_H = 28;
const TERMS_IMG_TITLE_LINE_H = 13;
const TERMS_IMG_BOX_H = 150;
const TERMS_IMG_HEAD_H = 34;
const TERMS_IMG_GAP = 12;
const TERMS_IMG_COLS = 3;
// Conservative wrap estimate for 10px bold Arial in a ~215px cell, used only for pagination
const TERMS_IMG_TITLE_CHARS_PER_LINE = 30;

const termsTitleRowHeight = (row) => {
  const lines = Math.max(1, ...row.map((item) => Math.ceil((item?.title || '').length / TERMS_IMG_TITLE_CHARS_PER_LINE)));
  return Math.max(TERMS_IMG_TITLE_MIN_H, lines * TERMS_IMG_TITLE_LINE_H + 12);
};
const termsRowHeight = (row) => termsTitleRowHeight(row) + TERMS_IMG_BOX_H + 3; // + collapsed borders

// Shop terms often start with their own "Terms & Conditions:" line, which duplicates the printed heading.
const stripTermsHeading = (text) =>
  (text || '').replace(/^\s*terms\s*(?:&|&amp;|and)\s*conditions\s*:?[ \t]*(?:\r?\n)*/i, '');

// html2canvas measures font baselines with a 1px <img> in the *live* document; Tailwind preflight's
// `img { display: block }` breaks that measurement and shifts all captured text down.
const HTML2CANVAS_METRICS_IMG = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const HTML2CANVAS_OPTIONS = { scale: 2, useCORS: true, backgroundColor: '#ffffff' };

const captureToCanvas = async (node) => {
  const fix = document.createElement('style');
  fix.textContent = `img[src="${HTML2CANVAS_METRICS_IMG}"] { display: inline !important; }`;
  document.head.appendChild(fix);
  try {
    return await html2canvas(node, HTML2CANVAS_OPTIONS);
  } finally {
    fix.remove();
  }
};

// Fetches a (signed) URL and returns a data URL so html2canvas never re-requests cross-origin images.
const urlToDataUrl = async (url) => {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    return null;
  }
};

const TermsImagesGrid = ({ rows, withHeading }) => {
  const cellBorder = '1px solid #555';
  return (
    <div>
      {withHeading && (
        <div style={{ height: `${TERMS_IMG_HEAD_H}px`, boxSizing: 'border-box', borderTop: '1px solid #ddd', paddingTop: '8px', fontSize: '13px', fontWeight: 'bold', color: '#333' }}>
          Warranty Not Applicable
        </div>
      )}
      <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
        <colgroup>
          {Array.from({ length: TERMS_IMG_COLS }).map((_, i) => <col key={i} style={{ width: `${100 / TERMS_IMG_COLS}%` }} />)}
        </colgroup>
        <tbody>
          {rows.map((row, rIdx) => (
            <React.Fragment key={rIdx}>
              {/* Title row grows to the tallest wrapped title so no title is clipped */}
              <tr>
                {Array.from({ length: TERMS_IMG_COLS }).map((_, cIdx) => (
                  <td
                    key={cIdx}
                    style={{
                      border: cellBorder,
                      background: '#f0f0f0',
                      height: `${TERMS_IMG_TITLE_MIN_H}px`,
                      padding: '6px 8px',
                      verticalAlign: 'middle',
                      textAlign: 'center',
                      fontSize: '10px',
                      lineHeight: `${TERMS_IMG_TITLE_LINE_H}px`,
                      fontWeight: 'bold',
                      color: '#111',
                      whiteSpace: 'normal',
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                    }}
                  >
                    {row[cIdx]?.title || ''}
                  </td>
                ))}
              </tr>
              <tr>
                {Array.from({ length: TERMS_IMG_COLS }).map((_, cIdx) => {
                  const item = row[cIdx];
                  return (
                    <td key={cIdx} style={{ border: cellBorder, padding: 0, verticalAlign: 'top' }}>
                      <div
                        style={{
                          height: `${TERMS_IMG_BOX_H}px`,
                          boxSizing: 'border-box',
                          padding: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundImage: item?.url ? `url("${item.url}")` : 'none',
                          backgroundSize: 'contain',
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'center',
                          backgroundOrigin: 'content-box',
                        }}
                      >
                        {item && !item.url && <span style={{ fontSize: '9px', color: '#999' }}>Image unavailable</span>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Splits image rows across page 2 (after the terms) and extra pages, never splitting a row.
const paginateTermsImages = (termsImages, termsHeight) => {
  const rows = [];
  for (let i = 0; i < termsImages.length; i += TERMS_IMG_COLS) rows.push(termsImages.slice(i, i + TERMS_IMG_COLS));
  if (rows.length === 0) return { page2: null, extraPages: [] };

  // Greedily fills a page with whole rows (title + image) until the next one wouldn't fit
  const takeRows = (list, available) => {
    let used = 0;
    let count = 0;
    while (count < list.length && used + termsRowHeight(list[count]) <= available) {
      used += termsRowHeight(list[count]);
      count += 1;
    }
    return count;
  };

  const page2Cap = takeRows(rows, A4_CONTENT_H_PX - termsHeight - TERMS_IMG_GAP - TERMS_IMG_HEAD_H);
  const page2Rows = rows.slice(0, page2Cap);
  let rest = rows.slice(page2Cap);
  const extraPages = [];
  let needsHeading = page2Rows.length === 0;
  while (rest.length > 0) {
    const cap = Math.max(1, takeRows(rest, A4_CONTENT_H_PX - (needsHeading ? TERMS_IMG_HEAD_H : 0)));
    extraPages.push({ rows: rest.slice(0, cap), withHeading: needsHeading });
    rest = rest.slice(cap);
    needsHeading = false;
  }
  return { page2: page2Rows.length > 0 ? page2Rows : null, extraPages };
};

const A4Receipt = ({ clientData, mobiles, shopPhoneNumber, shopAddress, shopEmail, shopName, profilePhoto, termsAndConditions, photosByMobile = {}, termsImages = [], onPageCount }) => {
  const termsRef = useRef(null);
  const [termsHeight, setTermsHeight] = useState(0);
  useEffect(() => {
    if (termsRef.current) setTermsHeight(termsRef.current.offsetHeight);
  }, [termsAndConditions]);
  const { page2: termsImagesPage2, extraPages } = paginateTermsImages(termsImages, termsHeight);
  const pageCount = 2 + extraPages.length;
  useEffect(() => {
    if (onPageCount) onPageCount(pageCount);
  }, [pageCount, onPageCount]);

  const totalPaid = mobiles.reduce((sum, m) => {
    const paid = m.total_paid || (m.payments && m.payments.length > 0 ? m.payments.reduce((s, p) => s + (p.amount || 0), 0) : 0) || m.paid_amount || 0;
    return sum + paid;
  }, 0);
  const cell = { border: '1px solid #555', padding: '5px 7px', fontSize: '10px' };
  return (
    <div
      className="a4-receipt-root"
      style={{
        width: '210mm',
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: '#111',
        background: '#fff',
      }}
    >
      {/* Page 1: receipt + mobile photos */}
      <div className="a4-page" style={{ ...A4_PAGE_STYLE, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flexShrink: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '3px solid #222', paddingBottom: '12px', marginBottom: '10px' }}>
        <div style={{ width: '72px', height: '72px', flexShrink: 0, marginRight: '16px', border: '1px solid #ddd', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f7f7', overflow: 'hidden' }}>
          {profilePhoto ? (
            <img src={profilePhoto} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '9px', color: '#999', textAlign: 'center' }}>LOGO</span>
          )}
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '23px', fontWeight: 'bold', textTransform: 'uppercase', color: '#8B4513', letterSpacing: '1px' }}>
            {shopName || clientData.owner_name || 'MOBILE SERVICE CENTER'}
          </div>
          <div style={{ fontSize: '11px', color: '#555', marginTop: '3px' }}>{shopAddress || 'Address Not Provided'}</div>
          <div style={{ fontSize: '11px', color: '#555' }}>
            Ph: {shopPhoneNumber || 'N/A'}
            {shopEmail && shopEmail.trim() !== '' && shopEmail !== 'N/A' ? `  |  Email: ${shopEmail}` : ''}
          </div>
        </div>
      </div>

      {/* Title bar */}
      <div style={{ background: 'linear-gradient(135deg, #222 0%, #3a3a3a 100%)', color: '#fff', textAlign: 'center', padding: '7px', fontSize: '14px', fontWeight: 'bold', letterSpacing: '3px', marginBottom: '12px', borderRadius: '3px' }}>
        SERVICE RECEIPT / JOB CARD
      </div>

      {/* Bill info row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '11px', gap: '20px' }}>
        <div style={{ flex: 1, border: '1px solid #e2e2e2', borderRadius: '4px', padding: '8px 10px', background: '#fcfcfc' }}>
          <div style={{ marginBottom: '4px' }}><strong>Customer Name :</strong>&nbsp;{clientData.client_name || ''}</div>
          <div><strong>Phone / Mobile :</strong>&nbsp;{clientData.mobile_number || ''}</div>
        </div>
        <div style={{ flexShrink: 0, border: '1px solid #999', padding: '6px 14px', borderRadius: '4px', background: '#f9f9f9', textAlign: 'right' }}>
          <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#8B4513' }}>Bill No: {clientData.bill_no || 'N/A'}</div>
          <div style={{ color: '#555', marginTop: '2px' }}>Date: {new Date().toLocaleDateString('en-IN')}</div>
        </div>
      </div>

      {/* Devices table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th style={{ ...cell, textAlign: 'center', width: '28px' }}>#</th>
            <th style={cell}>Mobile Make</th>
            <th style={cell}>Model</th>
            <th style={cell}>IMEI No.</th>
            <th style={cell}>Complaint / Issue</th>
            <th style={{ ...cell, whiteSpace: 'nowrap' }}>Date Added</th>
            <th style={{ ...cell, whiteSpace: 'nowrap' }}>Delivery Date</th>
            <th style={{ ...cell, whiteSpace: 'nowrap' }}>Warranty</th>
            <th style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {mobiles.map((mobile, idx) => {
            const paid = mobile.total_paid || (mobile.payments && mobile.payments.length > 0 ? mobile.payments.reduce((s, p) => s + (p.amount || 0), 0) : 0) || mobile.paid_amount || 0;
            return (
              <tr key={mobile._id || idx} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ ...cell, textAlign: 'center' }}>{idx + 1}</td>
                <td style={cell}>{mobile.mobile_name || '-'}</td>
                <td style={cell}>{mobile.model || '-'}</td>
                <td style={cell}>{mobile.imei || '-'}</td>
                <td style={cell}>{mobile.issue || '-'}</td>
                <td style={cell}>{mobile.added_date ? new Date(mobile.added_date).toLocaleDateString('en-IN') : '-'}</td>
                <td style={cell}>{mobile.delivery_date ? new Date(mobile.delivery_date).toLocaleDateString('en-IN') : '-'}</td>
                <td style={{ ...cell, color: mobile.has_warranty ? '#166534' : '#888', fontWeight: mobile.has_warranty ? 600 : 400, whiteSpace: 'nowrap' }}>{formatWarranty(mobile)}</td>
                <td style={{ ...cell, textAlign: 'right' }}>₹{paid}</td>
              </tr>
            );
          })}
          <tr style={{ background: '#f0f0f0', fontWeight: 'bold' }}>
            <td colSpan={8} style={{ ...cell, textAlign: 'right', borderTop: '2px solid #333' }}>Total Amount</td>
            <td style={{ ...cell, textAlign: 'right', borderTop: '2px solid #333' }}>₹{totalPaid}</td>
          </tr>
        </tbody>
      </table>

      {/* Accessories & Notes */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', fontSize: '10px' }}>
        <div style={{ flex: 1, border: '1px solid #ccc', padding: '7px', borderRadius: '3px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px', fontSize: '11px' }}>ACCESSORIES RECEIVED</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, max-content)', justifyContent: 'start', columnGap: '18px', rowGap: '6px' }}>
            {/* Drawn boxes instead of <input type="checkbox">, which html2canvas renders misaligned */}
            {['Battery', 'Back Door', 'Sim Card', 'Memory Card', 'Head Set', 'Charger', 'Bluetooth', 'Others'].map((item) => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '12px', whiteSpace: 'nowrap' }}>
                <span style={{ display: 'block', width: '10px', height: '10px', border: '1px solid #777', borderRadius: '2px', boxSizing: 'border-box', flexShrink: 0 }} />
                <span style={{ display: 'block', fontSize: '10px', lineHeight: '12px' }}>{item}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '6px' }}>
            <strong>Flashing:</strong>&nbsp;<span style={{ color: '#777' }}>Backup — Yes &nbsp;/&nbsp; No</span>
          </div>
        </div>
        <div style={{ flex: 1, border: '1px solid #ccc', padding: '7px', borderRadius: '3px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px', fontSize: '11px' }}>REMARKS / NOTES</div>
          <div style={{ borderBottom: '1px dashed #bbb', minHeight: '22px', marginBottom: '6px' }} />
          <div style={{ borderBottom: '1px dashed #bbb', minHeight: '22px', marginBottom: '6px' }} />
          <div style={{ borderBottom: '1px dashed #bbb', minHeight: '22px' }} />
        </div>
      </div>
      </div>

      <A4MobilePhotos mobiles={mobiles} photosByMobile={photosByMobile} />
      </div>

      {/* Page 2: terms always start here */}
      <div className="a4-page" style={A4_PAGE_STYLE}>
      <div ref={termsRef} style={{ fontSize: '12px', color: '#555', borderTop: '1px solid #ddd', paddingTop: '8px', lineHeight: '1.7' }}>
        <div style={{ color: '#333', fontWeight: 'bold', marginBottom: '3px', fontSize: '13px' }}>Terms &amp; Conditions:</div>
        {stripTermsHeading(termsAndConditions).trim() !== '' ? (
          <div style={{ whiteSpace: 'pre-line' }}>{stripTermsHeading(termsAndConditions)}</div>
        ) : (
          <div>
            {DEFAULT_TERMS_AND_CONDITIONS.map((line, idx) => (
              <span key={idx}>{idx + 1}. {line} &nbsp;</span>
            ))}
          </div>
        )}
      </div>
      {termsImagesPage2 && (
        <div style={{ marginTop: `${TERMS_IMG_GAP}px` }}>
          <TermsImagesGrid rows={termsImagesPage2} withHeading />
        </div>
      )}
      </div>

      {extraPages.map((page, pIdx) => (
        <div key={pIdx} className="a4-page" style={A4_PAGE_STYLE}>
          <TermsImagesGrid rows={page.rows} withHeading={page.withHeading} />
        </div>
      ))}
    </div>
  );
};

const PrintableA4Receipt = React.forwardRef(({ clientData, shopPhoneNumber, shopAddress, shopEmail, shopName, profilePhoto, termsAndConditions, photosByMobile, termsImages, onPageCount }, ref) => {
  const mobiles = clientData.MobileName || [];
  return (
    <div ref={ref}>
      <A4Receipt
        clientData={clientData}
        mobiles={mobiles}
        shopPhoneNumber={shopPhoneNumber}
        shopAddress={shopAddress}
        shopEmail={shopEmail}
        shopName={shopName}
        profilePhoto={profilePhoto}
        termsAndConditions={termsAndConditions}
        photosByMobile={photosByMobile}
        termsImages={termsImages}
        onPageCount={onPageCount}
      />
    </div>
  );
});
PrintableA4Receipt.displayName = 'PrintableA4Receipt';

// PDF downloads for all receipt types are generated by capturing the printable DOM node
// with html2canvas and embedding it into a jsPDF document (see handleDownloadPDF below).

// Main Enhanced ReceiptGenerator Component with Mobile Selection
const ReceiptGenerator = ({ clientData, shopPhoneNumber, closeModal, shopAddress }) => {
  const receiptRef = useRef(null);
  const thermalRef = useRef(null);
  const a4Ref = useRef(null);
  const [shopEmail, setShopEmail] = useState(null);
  const [shopName, setShopName] = useState(null);
  const [profileAddress, setProfileAddress] = useState(null);
  const [profilePhoneNumber, setProfilePhoneNumber] = useState(null);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [activeReceiptType, setActiveReceiptType] = useState('a4'); // 'a4' | 'jobcard' | 'thermal'
  const [downloading, setDownloading] = useState(false);
  const [photosByMobile, setPhotosByMobile] = useState({});
  const [termsImages, setTermsImages] = useState([]);
  const [a4PageCount, setA4PageCount] = useState(2);

  // Mobile selection state
  const allMobiles = clientData.MobileName || [];
  const [selectedMobileIds, setSelectedMobileIds] = useState(() => {
    // Auto-select all if only 1 mobile, otherwise none
    if (allMobiles.length <= 1) return allMobiles.map((m, i) => m._id || `idx-${i}`);
    return [];
  });
  const [showReceipt, setShowReceipt] = useState(allMobiles.length <= 1);

  const toggleMobile = (id) => {
    setSelectedMobileIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedMobileIds(allMobiles.map((m, i) => m._id || `idx-${i}`));
  };

  const deselectAll = () => {
    setSelectedMobileIds([]);
  };

  const proceedToReceipt = () => {
    if (selectedMobileIds.length === 0) return;
    setShowReceipt(true);
  };

  const goBackToSelection = () => {
    setShowReceipt(false);
  };

  // Filtered client data with only selected mobiles
  const filteredClientData = {
    ...clientData,
    MobileName: allMobiles.filter((m, i) => selectedMobileIds.includes(m._id || `idx-${i}`)),
  };

  // Fetch shop details from profile
  useEffect(() => {
    const fetchShopDetails = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        
        const res = await authApi.get("/profile/get", {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (res.data && res.data.email) {
          setShopEmail(res.data.email);
        }
        if (res.data && res.data.name) {
          setShopName(res.data.name);
        }
        if (res.data && res.data.address) {
          setProfileAddress(res.data.address);
        }
        if (res.data && res.data.phone) {
          setProfilePhoneNumber(res.data.phone);
        }
        if (res.data) {
          let imageUrl = res.data.imageUrl || res.data.profile_photo || null;
          if (imageUrl) {
            if (imageUrl.startsWith('http')) {
              imageUrl = imageUrl.replace(/https?:\/\/(localhost|127\.0\.0\.1):\d+/, process.env.NEXT_PUBLIC_API_URL_AUTH);
              imageUrl = `${imageUrl}?t=${Date.now()}`;
            } else if (imageUrl.startsWith('/')) {
              imageUrl = `${process.env.NEXT_PUBLIC_API_URL_AUTH}${imageUrl}`;
            }
          }
          setProfilePhoto(imageUrl);
        }
      } catch (err) {
        console.error("Error fetching shop details:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchShopDetails();
  }, []);

  // Fetch shop-configured receipt Terms & Conditions
  useEffect(() => {
    const fetchReceiptTerms = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const res = await api.get("/api/shop/receipt-settings", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data && typeof res.data.termsAndConditions === "string") {
          setTermsAndConditions(res.data.termsAndConditions);
        }
        if (res.data && Array.isArray(res.data.termsImages) && res.data.termsImages.length > 0) {
          const inlined = await Promise.all(
            res.data.termsImages.map(async (img) => ({ id: img.id, title: img.title, url: await urlToDataUrl(img.url) }))
          );
          setTermsImages(inlined);
        }
      } catch (err) {
        console.error("Error fetching receipt terms:", err);
      }
    };

    fetchReceiptTerms();
  }, []);

  // Front/back photos for the A4 invoice, inlined as data URLs so html2canvas never re-requests
  // the signed R2 URLs (a cached non-CORS response made later downloads drop the photos).
  const selectedMobileKey = selectedMobileIds.join(',');
  useEffect(() => {
    if (!showReceipt) return;
    let cancelled = false;
    const ids = filteredClientData.MobileName.map((m) => m._id).filter(Boolean);
    Promise.all(
      ids.map(async (id) => {
        try {
          const { images } = await fetchMobileImages(id);
          const latest = (side) => [...images].reverse().find((img) => img.side === side)?.url || null;
          const [front, back] = await Promise.all([urlToDataUrl(latest('front')), urlToDataUrl(latest('back'))]);
          return [id, { front, back }];
        } catch (err) {
          return [id, {}];
        }
      })
    ).then((entries) => {
      if (!cancelled) setPhotosByMobile(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showReceipt, selectedMobileKey]);

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: `Receipt-${clientData.bill_no || 'Service'}`,
    pageStyle: `
      @page { size: A5 landscape; margin: 0; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; }
      .receipt-print-root { width: 210mm; height: 148mm; margin: 0 auto; }
    `,
    onAfterPrint: () => {
      console.log("Receipt printed successfully!");
    }
  });

  const handleA4Print = useReactToPrint({
    contentRef: a4Ref,
    documentTitle: `A4-Receipt-${clientData.bill_no || 'Service'}`,
    pageStyle: `
      @page { size: A4 portrait; margin: 0; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; }
      .a4-receipt-root { width: 210mm; margin: 0 auto; }
      .a4-page { page-break-after: always; break-after: page; }
      .a4-page:last-child { page-break-after: auto; break-after: auto; }
    `,
  });

  // Guarded print handler: wait briefly for the forwarded ref to mount before invoking print
  const printIfReady = () => {
    const maxAttempts = 12; // up to ~1.2s
    let attempts = 0;

    const attemptPrint = () => {
      attempts += 1;
      if (receiptRef && receiptRef.current) {
        handlePrint();
        return;
      }

      if (attempts < maxAttempts) {
        // small delay to allow React to mount the forwarded ref
        setTimeout(attemptPrint, 100);
        return;
      }

      console.warn('Print requested but receipt element did not mount in time. Please try again.');
    };

    attemptPrint();
  };

  const handleA4PrintIfReady = () => {
    const maxAttempts = 12;
    let attempts = 0;
    const attemptPrint = () => {
      attempts += 1;
      if (a4Ref && a4Ref.current) { handleA4Print(); return; }
      if (attempts < maxAttempts) { setTimeout(attemptPrint, 100); return; }
      console.warn('A4 print: element did not mount in time.');
    };
    attemptPrint();
  };

  // ─── Thermal Print ────────────────────────────────────────────────────────
  const handleThermalPrint = () => {
    const node = thermalRef && thermalRef.current;
    if (!node) {
      console.warn('Thermal receipt not mounted yet');
      return;
    }

    const thermalStyles = `
      @page { size: 80mm auto; margin: 0; }
      @media print {
        html, body { width: 80mm; margin: 0; padding: 0; }
        body { font-family: 'Courier New', Courier, monospace; color: #000; }
      }
    `;

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Thermal Receipt</title>` +
      `<style>${thermalStyles}</style></head>` +
      `<body>${node.outerHTML}</body></html>`;

    const w = window.open('', '_blank', 'width=350,height=600');
    if (!w) { alert('Popup blocked – allow popups to print thermal receipt'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); w.close(); } catch (e) { /* ignore */ } }, 400);
  };

  // Prints whichever receipt type is currently selected in the sidebar
  const handlePrintActive = () => {
    if (activeReceiptType === 'a4') return handleA4PrintIfReady();
    if (activeReceiptType === 'thermal') return handleThermalPrint();
    return printIfReady();
  };

  const REFS_BY_TYPE = { jobcard: receiptRef, a4: a4Ref, thermal: thermalRef };
  const PDF_PAGE_WIDTH_MM = { jobcard: 210, a4: 210, thermal: 80 };
  const DOWNLOAD_FILE_PREFIX = { jobcard: 'JobCard', a4: 'A4-Receipt', thermal: 'Thermal-Receipt' };

  // Unified PDF download: captures the actual (full-size, off-screen) printable node for the
  // active receipt type with html2canvas and embeds it into a correctly-sized jsPDF document.
  const handleDownloadPDF = async () => {
    const ref = REFS_BY_TYPE[activeReceiptType];
    const node = ref && ref.current;
    if (!node) {
      console.warn('Receipt element not mounted yet, please try again.');
      return;
    }
    setDownloading(true);
    const fileName = `${DOWNLOAD_FILE_PREFIX[activeReceiptType]}-${filteredClientData.bill_no || filteredClientData.client_name || 'Service'}.pdf`;
    try {
      if (activeReceiptType === 'a4') {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pages = node.querySelectorAll('.a4-page');
        for (let i = 0; i < pages.length; i++) {
          const pageCanvas = await captureToCanvas(pages[i]);
          if (i > 0) doc.addPage();
          doc.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297);
        }
        doc.save(fileName);
        return;
      }
      const canvas = await captureToCanvas(node);
      const imgData = canvas.toDataURL('image/png');
      const pageWidth = PDF_PAGE_WIDTH_MM[activeReceiptType];
      const pageHeight = (canvas.height * pageWidth) / canvas.width;
      const doc = new jsPDF({
        orientation: pageWidth <= pageHeight ? 'portrait' : 'landscape',
        unit: 'mm',
        format: [pageWidth, pageHeight],
      });
      doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
      doc.save(fileName);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      {/* Loading State */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[9998] p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading receipt...</p>
          </div>
        </div>
      )}

      {/* Mobile Selection Step (shown when multiple mobiles and not yet proceeded) */}
      {!loading && !showReceipt && allMobiles.length > 1 && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[9998] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-xl">
              <div className="flex items-center gap-3">
                <div className="bg-white/15 p-2.5 rounded-lg">
                  <Smartphone size={22} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Select Mobiles for Receipt
                  </h2>
                  <p className="text-sm text-blue-100 mt-0.5">
                    {clientData.client_name} &nbsp;•&nbsp; Bill: {clientData.bill_no || "N/A"}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="text-white/80 hover:text-white transition-colors duration-200"
              >
                <IoCloseCircleOutline size={28} />
              </button>
            </div>

            {/* Selection Controls */}
            <div className="px-6 pt-4 flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {selectedMobileIds.length} of {allMobiles.length} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-sm px-3 py-1.5 rounded-lg border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAll}
                  className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Mobile List */}
            <div className="p-6 space-y-3">
              {allMobiles.map((mobile, idx) => {
                const id = mobile._id || `idx-${idx}`;
                const isSelected = selectedMobileIds.includes(id);
                const paid = mobile.total_paid || (mobile.payments && mobile.payments.length > 0 ? mobile.payments.reduce((sum, p) => sum + (p.amount || 0), 0) : 0) || mobile.paid_amount || 0;

                return (
                  <div
                    key={id}
                    onClick={() => toggleMobile(id)}
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? "border-blue-500 bg-blue-50 shadow-md"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                    }`}
                  >
                    {/* Checkbox */}
                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white"
                    }`}>
                      {isSelected && (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                    {/* Mobile Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800 text-lg">{mobile.mobile_name || "Unknown"}</span>
                        {mobile.model && <span className="text-sm text-gray-500">({mobile.model})</span>}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-gray-600">
                        {mobile.issue && (
                          <span className="flex items-center gap-1">
                            <span className="text-red-500">●</span> {mobile.issue}
                          </span>
                        )}
                        {mobile.added_date && (
                          <span>Added: {new Date(mobile.added_date).toLocaleDateString("en-IN")}</span>
                        )}
                        {mobile.delivery_date && (
                          <span>Delivery: {new Date(mobile.delivery_date).toLocaleDateString("en-IN")}</span>
                        )}
                        {mobile.has_warranty ? (
                          <span className="flex items-center gap-1 text-emerald-600 font-medium">
                            <ShieldCheck size={14} /> {formatWarranty(mobile)}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-400">
                            <ShieldOff size={14} /> No Warranty
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Paid Amount */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm text-gray-500">Paid</div>
                      <div className="font-bold text-green-700">₹{paid}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer - Proceed Button */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button
                onClick={proceedToReceipt}
                disabled={selectedMobileIds.length === 0}
                className={`w-full py-3 rounded-lg font-semibold text-lg flex items-center justify-center gap-2 transition-all duration-200 ${
                  selectedMobileIds.length > 0
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                Generate Receipt for {selectedMobileIds.length} {selectedMobileIds.length === 1 ? "Mobile" : "Mobiles"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt View (after selection or when single mobile) */}
      {!loading && showReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[9998] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-5 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600 flex-shrink-0">
              <div className="flex items-center gap-3">
                {allMobiles.length > 1 && (
                  <button
                    onClick={goBackToSelection}
                    className="text-white/80 hover:text-white transition-colors duration-200 p-1"
                    title="Back to mobile selection"
                  >
                    <ArrowLeft size={22} />
                  </button>
                )}
                <div className="bg-white/15 p-2.5 rounded-lg">
                  <Receipt size={22} className="text-white" />
                </div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  Receipt Generator
                  {filteredClientData.MobileName.length > 1 && (
                    <span className="text-xs font-medium text-white bg-white/20 px-2 py-1 rounded-full">
                      {filteredClientData.MobileName.length} mobiles
                    </span>
                  )}
                </h2>
              </div>
              <button
                onClick={closeModal}
                className="text-white/80 hover:text-white transition-colors duration-200"
              >
                <IoCloseCircleOutline size={28} />
              </button>
            </div>

            {/* Body: sidebar + live preview */}
            <div className="flex-1 flex overflow-hidden">
              {/* Sidebar */}
              <div className="w-64 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
                <div className="p-4 overflow-y-auto flex-1">
                  <div className="text-xs font-semibold uppercase text-gray-400 mb-3 tracking-wide">Receipt Type</div>
                  <div className="space-y-2">
                    {RECEIPT_TYPE_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const isActive = activeReceiptType === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => setActiveReceiptType(opt.id)}
                          className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all duration-150 ${
                            isActive ? "border-blue-500 bg-blue-50 shadow-sm" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          <div className={`p-2 rounded-md flex-shrink-0 ${isActive ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"}`}>
                            <Icon size={18} />
                          </div>
                          <div className="min-w-0">
                            <div className={`text-sm font-semibold ${isActive ? "text-blue-700" : "text-gray-700"}`}>{opt.label}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sidebar action buttons */}
                <div className="p-4 border-t border-gray-200 space-y-2 flex-shrink-0">
                  <button
                    onClick={handlePrintActive}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors duration-200 font-medium text-sm"
                  >
                    <Printer size={17} />
                    Print
                  </button>
                  <button
                    onClick={handleDownloadPDF}
                    disabled={downloading}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors duration-200 font-medium text-sm"
                  >
                    <Download size={17} />
                    {downloading ? "Generating..." : "Download PDF"}
                  </button>
                </div>
              </div>

              {/* Preview stage */}
              <div className="flex-1 overflow-auto bg-gray-100 p-8 flex flex-col items-center">
                {activeReceiptType === "thermal" ? (
                  <div className="bg-white shadow-xl rounded-sm p-2" style={{ width: '320px' }}>
                    <PrintableThermalReceipt
                      clientData={filteredClientData}
                      shopPhoneNumber={profilePhoneNumber || shopPhoneNumber}
                      shopAddress={profileAddress || shopAddress}
                      shopEmail={shopEmail}
                      shopName={shopName}
                    />
                  </div>
                ) : (
                  (() => {
                    const { wrapperWidth, wrapperHeight, contentWidth, scale } = getScaledPreviewStyle(activeReceiptType, a4PageCount);
                    return (
                      <div className="bg-white shadow-xl rounded-sm" style={{ width: wrapperWidth, height: wrapperHeight, overflow: 'hidden' }}>
                        <div style={{ width: contentWidth, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                          {activeReceiptType === "jobcard" ? (
                            <PrintableReceipt
                              clientData={filteredClientData}
                              shopPhoneNumber={profilePhoneNumber || shopPhoneNumber}
                              shopAddress={profileAddress || shopAddress}
                              shopEmail={shopEmail}
                              shopName={shopName}
                              profilePhoto={profilePhoto}
                            />
                          ) : (
                            <PrintableA4Receipt
                              clientData={filteredClientData}
                              shopPhoneNumber={profilePhoneNumber || shopPhoneNumber}
                              shopAddress={profileAddress || shopAddress}
                              shopEmail={shopEmail}
                              shopName={shopName}
                              profilePhoto={profilePhoto}
                              termsAndConditions={termsAndConditions}
                              photosByMobile={photosByMobile}
                              termsImages={termsImages}
                              onPageCount={setA4PageCount}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })()
                )}
                <p className="text-xs text-gray-400 mt-4">Preview only — actual print/PDF size may differ slightly</p>
              </div>
            </div>

            {/* Hidden full-size printable nodes used for actual printing & PDF capture */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
              <PrintableReceipt
                ref={receiptRef}
                clientData={filteredClientData}
                shopPhoneNumber={profilePhoneNumber || shopPhoneNumber}
                shopAddress={profileAddress || shopAddress}
                shopEmail={shopEmail}
                shopName={shopName}
                profilePhoto={profilePhoto}
              />
            </div>
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
              <PrintableThermalReceipt
                ref={thermalRef}
                clientData={filteredClientData}
                shopPhoneNumber={profilePhoneNumber || shopPhoneNumber}
                shopAddress={profileAddress || shopAddress}
                shopEmail={shopEmail}
                shopName={shopName}
              />
            </div>
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
              <PrintableA4Receipt
                ref={a4Ref}
                clientData={filteredClientData}
                shopPhoneNumber={profilePhoneNumber || shopPhoneNumber}
                shopAddress={profileAddress || shopAddress}
                shopEmail={shopEmail}
                shopName={shopName}
                profilePhoto={profilePhoto}
                termsAndConditions={termsAndConditions}
                photosByMobile={photosByMobile}
                termsImages={termsImages}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReceiptGenerator;
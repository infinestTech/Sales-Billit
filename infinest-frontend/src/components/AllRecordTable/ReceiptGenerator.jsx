'use client';
import React, { useRef, useState, useEffect } from "react";
import { useReactToPrint } from "react-to-print";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { IoMdPrint } from "react-icons/io";
import { MdPreview } from "react-icons/md";
import { FaDownload, FaWhatsapp } from "react-icons/fa";
import { IoCloseCircleOutline } from "react-icons/io5";
import { BsPrinterFill } from "react-icons/bs";
import authApi from "../authApi";

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
          Paid via: {mobiles[0].paymentMethod}
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

// PDF Generation: single-mobile uses original job card layout, multi-mobile uses table layout on one page
const generateEnhancedPDF = (clientData, shopPhoneNumber, shopAddress, shopEmail, shopName, profilePhoto) => {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a5",
  });

  const mobiles = clientData.MobileName || [];
  const today = new Date().toLocaleDateString('en-IN');
  const pageWidth = 210;
  const pageHeight = 148;
  const margin = 4;
  const displayName = (shopName || clientData.owner_name || "MOBILE SERVICE").toUpperCase();

  // ---- Helper: draw shop header, returns yPosition after header ----
  const drawHeader = () => {
    let yPosition = margin + 1;
    const headerHeight = 22;
    doc.rect(margin + 2, yPosition, pageWidth - 2 * margin - 4, headerHeight);

    if (profilePhoto) {
      try { doc.addImage(profilePhoto, 'JPEG', margin + 3, yPosition + 1, 16, 16); }
      catch (e) { doc.rect(margin + 3, yPosition + 1, 16, 16); doc.setFontSize(5); doc.text('LOGO', margin + 11, yPosition + 10, { align: 'center' }); }
    } else {
      doc.rect(margin + 3, yPosition + 1, 16, 16);
      doc.setFontSize(5);
      doc.text('LOGO', margin + 11, yPosition + 10, { align: 'center' });
    }

    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(139, 69, 19);
    doc.text(displayName, pageWidth / 2, yPosition + 7.5, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(shopAddress || "Address Not Provided", pageWidth / 2, yPosition + 14, { align: 'center' });
    doc.text(`Ph: ${shopPhoneNumber || "N/A"}`, pageWidth / 2, yPosition + 18, { align: 'center' });
    if (shopEmail && shopEmail.trim() !== "" && shopEmail !== "N/A") {
      doc.text(`Email: ${shopEmail}`, pageWidth / 2, yPosition + 21, { align: 'center' });
    }
    return yPosition + headerHeight + 1;
  };

  if (mobiles.length <= 1) {
    // ---- Single mobile: original job card layout ----
    const mobile = mobiles[0] || {};
    doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);
    let yPosition = drawHeader();

    const contentHeight = pageHeight - yPosition - margin - 1;
    doc.rect(margin + 2, yPosition, pageWidth - 2 * margin - 4, contentHeight);
    const leftColWidth = (pageWidth - 2 * margin - 4) * 0.7;
    const rightColX = margin + 2 + leftColWidth;
    doc.line(rightColX, yPosition, rightColX, pageHeight - margin - 1);

    let leftY = yPosition;
    const rowHeight = 6.5;
    const labelWidth = 36;
    doc.setFontSize(7);

    const drawRow = (label, value) => {
      doc.setFont(undefined, 'bold');
      doc.line(margin + 2, leftY + rowHeight, rightColX, leftY + rowHeight);
      doc.text(label, margin + 3, leftY + 4.6);
      doc.setFont(undefined, 'normal');
      const lines = doc.splitTextToSize(value || '', leftColWidth - labelWidth - 5);
      doc.text(lines, margin + 3 + labelWidth, leftY + 4.6);
      leftY += rowHeight;
    };

    drawRow('Customer Name :', clientData.client_name || '');
    drawRow('Phone / Mobile No :', clientData.mobile_number || '');
    drawRow('Mobile Make :', mobile.mobile_name || '');
    drawRow('Model No. :', mobile.model || '');
    drawRow('IMEI No. :', mobile.imei || '');
    drawRow('Complaint :', mobile.issue || '');

    // Flashing row
    doc.setFont(undefined, 'bold');
    doc.line(margin + 2, leftY + rowHeight, rightColX, leftY + rowHeight);
    doc.text('Flashing :', margin + 3, leftY + 4.6);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(5.5);
    doc.text('Backup - Yes / No', rightColX - 20, leftY + 4.6);
    doc.setFontSize(7);
    leftY += rowHeight;

    drawRow('Date of Delivery :', mobile.delivery_date ? new Date(mobile.delivery_date).toLocaleDateString('en-IN') : '');
    drawRow('Estimate Amount :', mobile.estimate_amount || '');

    doc.setFontSize(6.5);
    doc.text(`For ${displayName}`, margin + 3, pageHeight - margin - 4);

    // Right column
    let rightY = yPosition;
    const rightColWidth = pageWidth - 2 * margin - 4 - leftColWidth;
    doc.setFillColor(240, 240, 240);
    doc.rect(rightColX, rightY, rightColWidth, 8, 'F');
    doc.line(rightColX, rightY + 8, pageWidth - margin - 2, rightY + 8);
    doc.setFontSize(9); doc.setFont(undefined, 'bold'); doc.setTextColor(139, 69, 19);
    doc.text('JOB CARD', rightColX + rightColWidth / 2, rightY + 5.5, { align: 'center' });
    doc.setTextColor(0, 0, 0); rightY += 8;

    doc.setFontSize(6.5); doc.setFont(undefined, 'bold');
    doc.text('Sl. No.', rightColX + 2, rightY + 3.5);
    doc.setFontSize(11);
    doc.text(clientData.bill_no || '', rightColX + rightColWidth / 2, rightY + 10, { align: 'center' });
    doc.line(rightColX, rightY + 13, pageWidth - margin - 2, rightY + 13); rightY += 13;

    doc.setFontSize(6); doc.setFont(undefined, 'normal');
    doc.text('Comp. No. ................', rightColX + 2, rightY + 3.5);
    doc.line(rightColX, rightY + 6, pageWidth - margin - 2, rightY + 6); rightY += 6;
    doc.text(`Date: ${today}`, rightColX + 2, rightY + 3.5);
    doc.line(rightColX, rightY + 6, pageWidth - margin - 2, rightY + 6); rightY += 6;

    doc.setFontSize(6.5); doc.setFont(undefined, 'bold');
    doc.text('ACCESSORIES', rightColX + 2, rightY + 3.5); rightY += 5;
    doc.setFontSize(6); doc.setFont(undefined, 'normal');
    const accessories = ['Battery', 'Back Door', 'Sim Card', 'Memory Card', 'Head Set', 'Charger', 'Bluetooth', 'Others'];
    accessories.forEach((item, idx) => {
      doc.rect(rightColX + 2, rightY + (idx * 2.8), 1.3, 1.3);
      doc.text(item, rightColX + 4, rightY + (idx * 2.8) + 1.1);
    });
    rightY += accessories.length * 2.8 + 1;
    doc.line(rightColX, rightY, pageWidth - margin - 2, rightY); rightY += 9;
    doc.line(rightColX, rightY, pageWidth - margin - 2, rightY);

    doc.setFontSize(6);
    doc.text('Signature of Customer', rightColX + rightColWidth / 2, pageHeight - margin - 4, { align: 'center' });
    doc.line(rightColX + 3, pageHeight - margin - 6, pageWidth - margin - 5, pageHeight - margin - 6);

  } else {
    // ---- Multi-mobile: single page with table of all devices ----
    doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);
    let yPosition = drawHeader();

    // Customer info + Job Card bar
    const infoHeight = 14;
    doc.rect(margin + 2, yPosition, pageWidth - 2 * margin - 4, infoHeight);
    const infoRightX = pageWidth - margin - 2 - 50;
    doc.line(infoRightX, yPosition, infoRightX, yPosition + infoHeight);

    doc.setFontSize(8); doc.setFont(undefined, 'bold');
    doc.text('Customer Name :', margin + 3, yPosition + 5);
    doc.setFont(undefined, 'normal');
    doc.text(clientData.client_name || '', margin + 3 + 32, yPosition + 5);

    doc.setFont(undefined, 'bold');
    doc.text('Phone / Mobile No :', margin + 3, yPosition + 11);
    doc.setFont(undefined, 'normal');
    doc.text(clientData.mobile_number || '', margin + 3 + 32, yPosition + 11);

    // Job card mini section on right
    doc.setFontSize(9); doc.setFont(undefined, 'bold'); doc.setTextColor(139, 69, 19);
    doc.text('JOB CARD', infoRightX + 25, yPosition + 5, { align: 'center' });
    doc.setTextColor(0, 0, 0); doc.setFontSize(10);
    doc.text(clientData.bill_no || '', infoRightX + 25, yPosition + 10, { align: 'center' });
    doc.setFontSize(6); doc.setFont(undefined, 'normal');
    doc.text(`Date: ${today}`, infoRightX + 25, yPosition + 13, { align: 'center' });

    yPosition += infoHeight + 1;

    // Devices table using autoTable
    const tableBody = mobiles.map((mobile, idx) => {
      const paid = mobile.total_paid || (mobile.payments && mobile.payments.length > 0 ? mobile.payments.reduce((s, p) => s + (p.amount || 0), 0) : 0) || mobile.paid_amount || 0;
      return [
        idx + 1,
        mobile.mobile_name || '-',
        mobile.model || '-',
        mobile.imei || '-',
        mobile.issue || '-',
        mobile.added_date ? new Date(mobile.added_date).toLocaleDateString('en-IN') : '-',
        mobile.delivery_date ? new Date(mobile.delivery_date).toLocaleDateString('en-IN') : '-',
        `Rs.${paid}`,
      ];
    });

    const totalPaid = mobiles.reduce((sum, m) => {
      const paid = m.total_paid || (m.payments && m.payments.length > 0 ? m.payments.reduce((s, p) => s + (p.amount || 0), 0) : 0) || m.paid_amount || 0;
      return sum + paid;
    }, 0);
    tableBody.push(['', '', '', '', '', '', 'Total', `Rs.${totalPaid}`]);

    autoTable(doc, {
      startY: yPosition,
      margin: { left: margin + 2, right: margin + 2 },
      head: [['#', 'Mobile Make', 'Model', 'IMEI No.', 'Complaint', 'Date Added', 'Delivery', 'Amount']],
      body: tableBody,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, lineColor: [80, 80, 80], lineWidth: 0.2, textColor: [0, 0, 0] },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        7: { halign: 'right' },
      },
      didParseCell: (data) => {
        // Bold total row
        if (data.row.index === tableBody.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [245, 245, 245];
        }
      },
    });

    const finalY = doc.lastAutoTable.finalY || yPosition + 30;

    // Bottom details section - Flashing, Accessories, Estimate Amount
    const bottomY = finalY + 2;
    const bottomHeight = 18;
    const contentWidth = pageWidth - 2 * margin - 4;
    const leftSectionW = contentWidth * 0.4;
    const midSectionW = contentWidth * 0.35;
    const rightSectionW = contentWidth * 0.25;

    doc.rect(margin + 2, bottomY, contentWidth, bottomHeight);
    // Left: Flashing
    doc.line(margin + 2 + leftSectionW, bottomY, margin + 2 + leftSectionW, bottomY + bottomHeight);
    // Mid: Accessories
    doc.line(margin + 2 + leftSectionW + midSectionW, bottomY, margin + 2 + leftSectionW + midSectionW, bottomY + bottomHeight);

    doc.setFontSize(7); doc.setFont(undefined, 'bold');
    doc.text('Flashing :', margin + 3, bottomY + 4);
    doc.setFont(undefined, 'normal'); doc.setFontSize(5.5);
    doc.text('Backup - Yes / No', margin + 3 + leftSectionW - 22, bottomY + 4);
    doc.setFontSize(6);
    doc.text('Comp. No. ................', margin + 3, bottomY + 9);
    doc.text('Notes:', margin + 3, bottomY + 14);

    // Middle: Accessories
    const accX = margin + 2 + leftSectionW + 2;
    doc.setFontSize(6.5); doc.setFont(undefined, 'bold');
    doc.text('ACCESSORIES', accX, bottomY + 4);
    doc.setFontSize(5.5); doc.setFont(undefined, 'normal');
    const accessories = ['Battery', 'Back Door', 'Sim Card', 'Memory Card', 'Head Set', 'Charger', 'Bluetooth', 'Others'];
    const accColWidth = midSectionW / 2 - 3;
    accessories.forEach((item, idx) => {
      const col = idx < 4 ? 0 : 1;
      const row = idx < 4 ? idx : idx - 4;
      const ax = accX + col * accColWidth;
      const ay = bottomY + 7 + row * 2.6;
      doc.rect(ax, ay, 1.3, 1.3);
      doc.text(item, ax + 2, ay + 1.1);
    });

    // Right: Estimate Amount
    const estX = margin + 2 + leftSectionW + midSectionW;
    doc.setFontSize(6.5); doc.setFont(undefined, 'bold');
    doc.text('Estimate Amount', estX + rightSectionW / 2, bottomY + 6, { align: 'center' });
    doc.setFontSize(10); doc.setFont(undefined, 'bold');
    doc.text(`Rs.${totalPaid}`, estX + rightSectionW / 2, bottomY + 13, { align: 'center' });

    // Footer
    const footerY = bottomY + bottomHeight + 6;
    doc.setFontSize(6.5); doc.setFont(undefined, 'normal');
    doc.text(`For ${displayName}`, margin + 3, Math.min(footerY, pageHeight - margin - 4));

    doc.setFontSize(6);
    const sigY = Math.min(footerY, pageHeight - margin - 4);
    doc.text('Signature of Customer', pageWidth - margin - 2 - 25, sigY, { align: 'center' });
    doc.line(pageWidth - margin - 2 - 40, sigY - 2, pageWidth - margin - 2 - 10, sigY - 2);
  }

  return doc;
};

// Main Enhanced ReceiptGenerator Component with Mobile Selection
const ReceiptGenerator = ({ clientData, shopPhoneNumber, closeModal, shopAddress }) => {
  const receiptRef = useRef(null);
  const thermalRef = useRef(null);
  const [previewURL, setPreviewURL] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [shopEmail, setShopEmail] = useState(null);
  const [shopName, setShopName] = useState(null);
  const [profileAddress, setProfileAddress] = useState(null);
  const [profilePhoneNumber, setProfilePhoneNumber] = useState(null);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [loading, setLoading] = useState(true);

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

  // Cleanup function to revoke object URLs
  useEffect(() => {
    return () => {
      if (previewURL) {
        URL.revokeObjectURL(previewURL);
      }
    };
  }, [previewURL]);

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

  // Manual print fallback: serialize the receipt node into a new window and print it
  const printManual = () => {
    try {
      const node = receiptRef && receiptRef.current;
      if (!node) return;
      // Attempt to include app stylesheet (if available) and provide fallback inline styles
      const cssHref = (typeof window !== 'undefined' && window.location) ? `${window.location.origin}/styles.css` : '/styles.css';
      const fallbackStyles = `
        body{font-family: Arial,Helvetica,sans-serif; margin:0; padding:8px; color:#111}
        .receipt-wrap{ width:80mm; box-sizing:border-box; margin:0 auto; }
        h2{ margin:0 0 6px; font-size:16px; text-align:center }
        .shop{ text-align:center; margin-bottom:6px }
        table{ width:100%; border-collapse:collapse; margin-top:6px; font-size:12px }
        th, td{ border:1px solid #333; padding:6px }
        thead th{ background:#f3f3f3; font-weight:700; }
        .right{ text-align:right }
        .total{ text-align:right; font-weight:700; margin-top:8px }
        footer{ margin-top:12px; text-align:center; font-size:11px; color:#555 }
      `;

      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt</title>` +
        `<link rel="stylesheet" href="${cssHref}">` +
        `<style>${fallbackStyles}</style></head><body><div class="receipt-wrap">${node.outerHTML}</div></body></html>`;
      const w = window.open('', '_blank');
      if (!w) { alert('Popup blocked: allow popups to print'); return; }
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => { try { w.print(); w.close(); } catch (e) { /* ignore */ } }, 300);
    } catch (e) {
      console.error('Manual print failed:', e);
    }
  };

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

  const handlePreview = () => {
    const finalAddress = profileAddress || shopAddress;
    const finalPhoneNumber = profilePhoneNumber || shopPhoneNumber;
    const doc = generateEnhancedPDF(filteredClientData, finalPhoneNumber, finalAddress, shopEmail, shopName, profilePhoto);
    const blob = doc.output("blob");
    const pdfURL = URL.createObjectURL(blob);
    setPreviewURL(pdfURL);
    setShowPreviewModal(true);
  };

  const handleDownloadPDF = () => {
    const finalAddress = profileAddress || shopAddress;
    const finalPhoneNumber = profilePhoneNumber || shopPhoneNumber;
    const doc = generateEnhancedPDF(filteredClientData, finalPhoneNumber, finalAddress, shopEmail, shopName, profilePhoto);
    const fileName = `JobCard-${filteredClientData.bill_no || filteredClientData.client_name || 'Service'}.pdf`;
    doc.save(fileName);
  };

  const handleWhatsApp = () => {
    const serviceMobile = filteredClientData?.MobileName?.find(item => !!item._id);
    if (!serviceMobile?._id) {
      alert("⚠️ Mobile ID missing. Please contact support.");
      return;
    }

    const customerMobile = filteredClientData.mobile_number.startsWith("91")
      ? filteredClientData.mobile_number
      : "91" + filteredClientData.mobile_number;

    const receiptLink = `${process.env.NEXT_PUBLIC_FRONTEND_URL}/receipt/${serviceMobile._id}`;
    const customer = filteredClientData.client_name || "";
    const shop = filteredClientData.owner_name || "INFINFEST MOBILE SERVICE";
    const billNumber = filteredClientData.bill_no || "N/A";

    const servicedMobiles = filteredClientData.MobileName.map((device, index) => {
      const paid = device.total_paid || (device.payments && device.payments.length > 0 ? device.payments.reduce((sum, p) => sum + (p.amount || 0), 0) : 0) || device.paid_amount || 0;
      return `${index + 1}. 📱 ${device.mobile_name} - ${device.issue || "General Service"} (Paid: ₹${paid})`;
    }).join("\n");

    const message = `🧾 *${shop}* - Service Receipt\n\n👤 Customer: ${customer}\n📞 Mobile: ${filteredClientData.mobile_number}\n🧾 Bill No: ${billNumber}\n\n📱 *Devices:*\n${servicedMobiles}\n\n🔗 View Online: ${receiptLink}\n\n✨ Thank you for choosing our service!`;

    window.open(`https://web.whatsapp.com/send?phone=${customerMobile}&text=${encodeURIComponent(message)}`, "_blank");
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
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  📱 Select Mobiles for Receipt
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Customer: <span className="font-semibold text-gray-700">{clientData.client_name}</span> &nbsp;|&nbsp; Bill: <span className="font-semibold text-gray-700">{clientData.bill_no || "N/A"}</span>
                </p>
              </div>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-red-600 transition-colors duration-200"
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
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                {allMobiles.length > 1 && (
                  <button
                    onClick={goBackToSelection}
                    className="text-gray-500 hover:text-blue-600 transition-colors duration-200 p-1"
                    title="Back to mobile selection"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  🧾 Receipt Generator
                  {filteredClientData.MobileName.length > 1 && (
                    <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                      {filteredClientData.MobileName.length} mobiles
                    </span>
                  )}
                </h2>
              </div>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-red-600 transition-colors duration-200"
              >
                <IoCloseCircleOutline size={28} />
              </button>
            </div>

            {/* Receipt Preview */}
            <div className="p-6 bg-gray-50">
              <div className="mb-6 space-y-4">
                <PrintableReceipt
                  ref={receiptRef}
                  clientData={filteredClientData}
                  shopPhoneNumber={profilePhoneNumber || shopPhoneNumber}
                  shopAddress={profileAddress || shopAddress}
                  shopEmail={shopEmail}
                  shopName={shopName}
                  profilePhoto={profilePhoto}
                />

                {/* Hidden thermal receipt for printing (off-screen) */}
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
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap justify-center gap-3">
                <button 
                  onClick={printIfReady} 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <IoMdPrint size={20} />
                  <span className="font-medium">Print</span>
                </button>

                <button 
                  onClick={handleThermalPrint} 
                  className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <BsPrinterFill size={18} />
                  <span className="font-medium">Thermal Print</span>
                </button>

                <button 
                  onClick={handlePreview} 
                  className="bg-gray-700 hover:bg-gray-800 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <MdPreview size={20} />
                  <span className="font-medium">Preview</span>
                </button>

                <button 
                  onClick={handleDownloadPDF} 
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <FaDownload size={18} />
                  <span className="font-medium">Download</span>
                </button>

                <button 
                  onClick={handleWhatsApp}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <FaWhatsapp size={18} />
                  <span className="font-medium">WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[99999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl h-[90vh] rounded-xl shadow-2xl flex flex-col">
            {/* Preview Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">📄 Receipt Preview</h3>
              <div className="flex gap-2">
                <button 
                  onClick={handleDownloadPDF} 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200"
                >
                  <FaDownload size={16} />
                  Download
                </button>
                <button 
                  onClick={() => {
                    setShowPreviewModal(false);
                    if (previewURL) {
                      URL.revokeObjectURL(previewURL);
                      setPreviewURL(null);
                    }
                  }} 
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200"
                >
                  <IoCloseCircleOutline size={18} />
                  Close
                </button>
              </div>
            </div>

            {/* Preview Content */}
            <div className="flex-1 p-4">
              {previewURL ? (
                <iframe 
                  src={previewURL} 
                  title="PDF Preview" 
                  className="w-full h-full border rounded-lg shadow-inner"
                  style={{ minHeight: '500px' }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-gray-500">Loading preview...</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReceiptGenerator;
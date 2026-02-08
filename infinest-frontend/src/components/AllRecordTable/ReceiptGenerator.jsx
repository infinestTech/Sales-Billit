'use client';
import React, { useRef, useState, useEffect } from "react";
import { useReactToPrint } from "react-to-print";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { IoMdPrint } from "react-icons/io";
import { MdPreview } from "react-icons/md";
import { FaDownload, FaWhatsapp } from "react-icons/fa";
import { IoCloseCircleOutline } from "react-icons/io5";
import authApi from "../authApi";

// Enhanced Job Card Receipt Component
const PrintableReceipt = React.forwardRef(({ clientData, shopPhoneNumber, shopAddress, shopEmail, shopName, profilePhoto }, ref) => {
  const mobile = clientData.MobileName?.[0] || clientData.mobiles?.[0] || clientData.mobile || {};
  
  return (
    <div ref={ref} className="receipt-print-root bg-white p-2 border-2 border-gray-800" style={{ width: '210mm', height: '148mm', fontFamily: 'Arial, sans-serif', fontSize: '10px' }}>
      {/* Header Section */}
      <div className="border-2 border-gray-800 p-2 mb-1">
        <div className="flex items-start justify-between">
          {/* Logo/Profile Photo */}
          <div className="w-16 h-16 flex items-center justify-center bg-gray-50 flex-shrink-0">
            {profilePhoto ? (
              <img src={profilePhoto} alt="Shop Logo" className="w-full h-full object-cover" />
            ) : (
              <div className="text-xs text-gray-400 text-center">LOGO</div>
            )}
          </div>
          
          {/* Shop Details */}
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
        {/* Left Column - Customer & Device Details */}
        <div className="flex-1 flex flex-col" style={{ width: '70%' }}>
          {/* Customer Name */}
          <div className="border-b border-gray-800 px-2 py-1 flex" style={{ minHeight: '6mm' }}>
            <span className="text-sm font-semibold" style={{ minWidth: '110px' }}>Customer Name :</span>
            <span className="text-sm flex-1">{clientData.client_name || ""}</span>
          </div>

          {/* Phone */}
          <div className="border-b border-gray-800 px-2 py-1 flex" style={{ minHeight: '6mm' }}>
            <span className="text-sm font-semibold" style={{ minWidth: '110px' }}>Phone / Mobile No :</span>
            <span className="text-sm flex-1">{clientData.mobile_number || ""}</span>
          </div>

          {/* Mobile Make */}
          <div className="border-b border-gray-800 px-2 py-1 flex" style={{ minHeight: '6mm' }}>
            <span className="text-sm font-semibold" style={{ minWidth: '110px' }}>Mobile Make :</span>
            <span className="text-sm flex-1">{mobile.mobile_name || ""}</span>
          </div>

          {/* Model No */}
          <div className="border-b border-gray-800 px-2 py-1 flex" style={{ minHeight: '6mm' }}>
            <span className="text-sm font-semibold" style={{ minWidth: '110px' }}>Model No. :</span>
            <span className="text-sm flex-1">{mobile.model || ""}</span>
          </div>

          {/* IMEI No */}
          <div className="border-b border-gray-800 px-2 py-1 flex" style={{ minHeight: '6mm' }}>
            <span className="text-sm font-semibold" style={{ minWidth: '110px' }}>IMEI No. :</span>
            <span className="text-sm flex-1">{mobile.imei || ""}</span>
          </div>

          {/* Complaint */}
          <div className="border-b border-gray-800 px-2 py-1 flex" style={{ minHeight: '6mm' }}>
            <span className="text-sm font-semibold" style={{ minWidth: '110px' }}>Complaint :</span>
            <span className="text-sm flex-1">{mobile.issue || ""}</span>
          </div>

          {/* Flashing */}
          <div className="border-b border-gray-800 px-2 py-1 flex items-center" style={{ minHeight: '6mm' }}>
            <span className="text-sm font-semibold" style={{ minWidth: '110px' }}>Flashing :</span>
            <div className="flex-1 flex justify-end items-center">
              <span className="text-xs text-gray-500 mr-1">Backup - Yes / No</span>
            </div>
          </div>

          {/* Date of Delivery */}
          <div className="border-b border-gray-800 px-2 py-1 flex" style={{ minHeight: '6mm' }}>
            <span className="text-sm font-semibold" style={{ minWidth: '110px' }}>Date of Delivery :</span>
            <span className="text-sm flex-1">{mobile.delivery_date ? new Date(mobile.delivery_date).toLocaleDateString("en-IN") : ""}</span>
          </div>

          {/* Estimate Amount */}
          <div className="border-b border-gray-800 px-2 py-1 flex" style={{ minHeight: '6mm' }}>
            <span className="text-sm font-semibold" style={{ minWidth: '110px' }}>Estimate Amount :</span>
            <span className="text-sm flex-1">{mobile.estimate_amount || ""}</span>
          </div>

          {/* Footer - For Shop */}
          <div className="flex-1 flex items-end p-1">
            <span className="text-xs">For {shopName || clientData.owner_name || "MOBILE SERVICE"}</span>
          </div>
        </div>

        {/* Right Column - Job Card Info */}
        <div className="border-l-2 border-gray-800 flex flex-col" style={{ width: '30%' }}>
          {/* Job Card Header */}
          <div className="bg-gray-100 p-1 text-center border-b border-gray-800">
            <h2 className="text-sm font-bold leading-tight" style={{ color: '#8B4513' }}>JOB CARD</h2>
          </div>

          {/* Sl. No */}
          <div className="p-1 border-b border-gray-800">
            <div className="text-xs font-semibold">Sl. No.</div>
            <div className="text-lg font-bold text-center">{clientData.bill_no || ""}</div>
          </div>

          {/* Comp. No */}
          <div className="px-1 py-0.5 border-b border-gray-800">
            <div className="text-xs">Comp. No. ................</div>
          </div>

          {/* Date */}
          <div className="px-1 py-0.5 border-b border-gray-800">
            <div className="text-xs">Date : {new Date().toLocaleDateString("en-IN")}</div>
          </div>

          {/* Accessories */}
          <div className="p-1 border-b border-gray-800">
            <div className="text-xs font-bold mb-0.5">ACCESSORIES</div>
            <div className="space-y-0.5 text-xs leading-tight">
              <label className="flex items-center">
                <input type="checkbox" className="mr-1" disabled style={{ width: '9px', height: '9px' }} />
                <span>Battery</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-1" disabled style={{ width: '9px', height: '9px' }} />
                <span>Back Door</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-1" disabled style={{ width: '9px', height: '9px' }} />
                <span>Sim Card</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-1" disabled style={{ width: '9px', height: '9px' }} />
                <span>Memory Card</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-1" disabled style={{ width: '9px', height: '9px' }} />
                <span>Head Set</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-1" disabled style={{ width: '9px', height: '9px' }} />
                <span>Charger</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-1" disabled style={{ width: '9px', height: '9px' }} />
                <span>Bluetooth</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-1" disabled style={{ width: '9px', height: '9px' }} />
                <span>Others</span>
              </label>
            </div>
          </div>

          {/* Terms */}
          <div className="px-1 py-0.5 border-b border-gray-800 text-center text-xs leading-tight">
          </div>

          {/* Signature */}
          <div className="flex-1 p-1 flex flex-col justify-end">
            <div className="text-center text-xs">
              <div className="border-t border-gray-400 pt-0.5">Signature of Customer</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

PrintableReceipt.displayName = "PrintableReceipt";

// Enhanced PDF Generation - A5 Landscape Job Card Format
const generateEnhancedPDF = (clientData, shopPhoneNumber, shopAddress, shopEmail, shopName, profilePhoto) => {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a5", // A5 landscape: 210mm x 148mm
  });

  const mobile = clientData.MobileName?.[0] || clientData.mobiles?.[0] || clientData.mobile || {};
  const today = new Date().toLocaleDateString('en-IN');
  const pageWidth = 210;
  const pageHeight = 148;
  const margin = 4;
  let yPosition = margin;

  // Outer border
  doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);

  // Header Section with border
  yPosition += 1;
  const headerHeight = 22;
  doc.rect(margin + 2, yPosition, pageWidth - 2 * margin - 4, headerHeight);
  
  // Logo placeholder
  if (profilePhoto) {
    try {
      doc.addImage(profilePhoto, 'JPEG', margin + 3, yPosition + 1, 16, 16);
    } catch (e) {
      doc.rect(margin + 3, yPosition + 1, 16, 16);
      doc.setFontSize(5);
      doc.text('LOGO', margin + 11, yPosition + 10, { align: 'center' });
    }
  } else {
    doc.rect(margin + 3, yPosition + 1, 16, 16);
    doc.setFontSize(5);
    doc.text('LOGO', margin + 11, yPosition + 10, { align: 'center' });
  }

  // Shop name and details (centered)
  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(139, 69, 19); // Brown color
  const displayName = (shopName || clientData.owner_name || "MOBILE SERVICE").toUpperCase();
  doc.text(displayName, pageWidth / 2, yPosition + 7.5, { align: 'center' });
  
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(shopAddress || "Address Not Provided", pageWidth / 2, yPosition + 14, { align: 'center' });
  doc.text(`Ph: ${shopPhoneNumber || "N/A"}`, pageWidth / 2, yPosition + 18, { align: 'center' });
  if (shopEmail && shopEmail.trim() !== "" && shopEmail !== "N/A") {
    doc.text(`Email: ${shopEmail}`, pageWidth / 2, yPosition + 21, { align: 'center' });
  }
  
  yPosition += headerHeight + 1;

  // Main content border
  const contentHeight = pageHeight - yPosition - margin - 1;
  doc.rect(margin + 2, yPosition, pageWidth - 2 * margin - 4, contentHeight);

  // Left column width
  const leftColWidth = (pageWidth - 2 * margin - 4) * 0.7;
  const rightColX = margin + 2 + leftColWidth;

  // Vertical divider
  doc.line(rightColX, yPosition, rightColX, pageHeight - margin - 1);

  // LEFT COLUMN - Customer & Device Details
  let leftY = yPosition;
  const rowHeight = 6.5;
  const labelWidth = 36;
  
  doc.setFontSize(7);
  doc.setFont(undefined, 'bold');
  
  // Customer Name
  doc.line(margin + 2, leftY + rowHeight, rightColX, leftY + rowHeight);
  doc.text('Customer Name :', margin + 3, leftY + 4.6);
  doc.setFont(undefined, 'normal');
  const customerName = doc.splitTextToSize(clientData.client_name || '', leftColWidth - labelWidth - 5);
  doc.text(customerName, margin + 3 + labelWidth, leftY + 4.6);
  leftY += rowHeight;

  // Phone
  doc.setFont(undefined, 'bold');
  doc.line(margin + 2, leftY + rowHeight, rightColX, leftY + rowHeight);
  doc.text('Phone / Mobile No :', margin + 3, leftY + 4.6);
  doc.setFont(undefined, 'normal');
  doc.text(clientData.mobile_number || '', margin + 3 + labelWidth, leftY + 4.6);
  leftY += rowHeight;

  // Mobile Make
  doc.setFont(undefined, 'bold');
  doc.line(margin + 2, leftY + rowHeight, rightColX, leftY + rowHeight);
  doc.text('Mobile Make :', margin + 3, leftY + 4.6);
  doc.setFont(undefined, 'normal');
  const mobileName = doc.splitTextToSize(mobile.mobile_name || '', leftColWidth - labelWidth - 5);
  doc.text(mobileName, margin + 3 + labelWidth, leftY + 4.6);
  leftY += rowHeight;

  // Model No
  doc.setFont(undefined, 'bold');
  doc.line(margin + 2, leftY + rowHeight, rightColX, leftY + rowHeight);
  doc.text('Model No. :', margin + 3, leftY + 4.6);
  doc.setFont(undefined, 'normal');
  doc.text(mobile.model || '', margin + 3 + labelWidth, leftY + 4.6);
  leftY += rowHeight;

  // IMEI No
  doc.setFont(undefined, 'bold');
  doc.line(margin + 2, leftY + rowHeight, rightColX, leftY + rowHeight);
  doc.text('IMEI No. :', margin + 3, leftY + 4.6);
  doc.setFont(undefined, 'normal');
  doc.text(mobile.imei || '', margin + 3 + labelWidth, leftY + 4.6);
  leftY += rowHeight;

  // Complaint
  doc.setFont(undefined, 'bold');
  doc.line(margin + 2, leftY + rowHeight, rightColX, leftY + rowHeight);
  doc.text('Complaint :', margin + 3, leftY + 4.6);
  doc.setFont(undefined, 'normal');
  const issue = doc.splitTextToSize(mobile.issue || '', leftColWidth - labelWidth - 5);
  doc.text(issue, margin + 3 + labelWidth, leftY + 4.6);
  leftY += rowHeight;

  // Flashing
  doc.setFont(undefined, 'bold');
  doc.line(margin + 2, leftY + rowHeight, rightColX, leftY + rowHeight);
  doc.text('Flashing :', margin + 3, leftY + 4.6);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(5.5);
  doc.text('Backup - Yes / No', rightColX - 20, leftY + 4.6);
  doc.setFontSize(7);
  leftY += rowHeight;

  // Date of Delivery
  doc.setFont(undefined, 'bold');
  doc.line(margin + 2, leftY + rowHeight, rightColX, leftY + rowHeight);
  doc.text('Date of Delivery :', margin + 3, leftY + 4.6);
  doc.setFont(undefined, 'normal');
  doc.text(mobile.delivery_date ? new Date(mobile.delivery_date).toLocaleDateString('en-IN') : '', margin + 3 + labelWidth, leftY + 4.6);
  leftY += rowHeight;

  // Estimate Amount
  doc.setFont(undefined, 'bold');
  doc.line(margin + 2, leftY + rowHeight, rightColX, leftY + rowHeight);
  doc.text('Estimate Amount :', margin + 3, leftY + 4.6);
  doc.setFont(undefined, 'normal');
  doc.text(mobile.estimate_amount || '', margin + 3 + labelWidth, leftY + 4.6);
  leftY += rowHeight;

  // Footer - For Shop Name
  doc.setFontSize(6.5);
  doc.setFont(undefined, 'normal');
  doc.text(`For ${displayName}`, margin + 3, pageHeight - margin - 4);

  // RIGHT COLUMN - Job Card Info
  let rightY = yPosition;
  const rightColWidth = pageWidth - 2 * margin - 4 - leftColWidth;
  
  // Job Card Header
  doc.setFillColor(240, 240, 240);
  doc.rect(rightColX, rightY, rightColWidth, 8, 'F');
  doc.line(rightColX, rightY + 8, pageWidth - margin - 2, rightY + 8);
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(139, 69, 19);
  doc.text('JOB CARD', rightColX + rightColWidth / 2, rightY + 5.5, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  rightY += 8;

  // Sl. No
  doc.setFontSize(6.5);
  doc.setFont(undefined, 'bold');
  doc.text('Sl. No.', rightColX + 2, rightY + 3.5);
  doc.setFontSize(11);
  doc.text(clientData.bill_no || '', rightColX + rightColWidth / 2, rightY + 10, { align: 'center' });
  doc.line(rightColX, rightY + 13, pageWidth - margin - 2, rightY + 13);
  rightY += 13;

  // Comp. No
  doc.setFontSize(6);
  doc.setFont(undefined, 'normal');
  doc.text('Comp. No. ................', rightColX + 2, rightY + 3.5);
  doc.line(rightColX, rightY + 6, pageWidth - margin - 2, rightY + 6);
  rightY += 6;

  // Date
  doc.text(`Date: ${today}`, rightColX + 2, rightY + 3.5);
  doc.line(rightColX, rightY + 6, pageWidth - margin - 2, rightY + 6);
  rightY += 6;

  // Accessories
  doc.setFontSize(6.5);
  doc.setFont(undefined, 'bold');
  doc.text('ACCESSORIES', rightColX + 2, rightY + 3.5);
  rightY += 5;

  doc.setFontSize(6);
  doc.setFont(undefined, 'normal');
  const accessories = ['Battery', 'Back Door', 'Sim Card', 'Memory Card', 'Head Set', 'Charger', 'Bluetooth', 'Others'];
  accessories.forEach((item, idx) => {
    doc.rect(rightColX + 2, rightY + (idx * 2.8), 1.3, 1.3); // Checkbox
    doc.text(item, rightColX + 4, rightY + (idx * 2.8) + 1.1);
  });
  rightY += accessories.length * 2.8 + 1;
  doc.line(rightColX, rightY, pageWidth - margin - 2, rightY);
  rightY += 1;

  // Empty space instead of terms
  rightY += 8;
  doc.line(rightColX, rightY, pageWidth - margin - 2, rightY);

  // Signature
  doc.setFontSize(6);
  doc.text('Signature of Customer', rightColX + rightColWidth / 2, pageHeight - margin - 4, { align: 'center' });
  doc.line(rightColX + 3, pageHeight - margin - 6, pageWidth - margin - 5, pageHeight - margin - 6);

  return doc;
};

// Main Enhanced ReceiptGenerator Component
const ReceiptGenerator = ({ clientData, shopPhoneNumber, closeModal, shopAddress }) => {
  const receiptRef = useRef(null);
  const [previewURL, setPreviewURL] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [shopEmail, setShopEmail] = useState(null);
  const [shopName, setShopName] = useState(null);
  const [profileAddress, setProfileAddress] = useState(null);
  const [profilePhoneNumber, setProfilePhoneNumber] = useState(null);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const handlePreview = () => {
    const finalAddress = profileAddress || shopAddress;
    const finalPhoneNumber = profilePhoneNumber || shopPhoneNumber;
    const doc = generateEnhancedPDF(clientData, finalPhoneNumber, finalAddress, shopEmail, shopName, profilePhoto);
    const blob = doc.output("blob");
    const pdfURL = URL.createObjectURL(blob);
    setPreviewURL(pdfURL);
    setShowPreviewModal(true);
  };

  const handleDownloadPDF = () => {
    const finalAddress = profileAddress || shopAddress;
    const finalPhoneNumber = profilePhoneNumber || shopPhoneNumber;
    const doc = generateEnhancedPDF(clientData, finalPhoneNumber, finalAddress, shopEmail, shopName, profilePhoto);
    const fileName = `JobCard-${clientData.bill_no || clientData.client_name || 'Service'}.pdf`;
    doc.save(fileName);
  };

  const handleWhatsApp = () => {
    const serviceMobile = clientData?.MobileName?.find(item => !!item._id);
    if (!serviceMobile?._id) {
      alert("⚠️ Mobile ID missing. Please contact support.");
      return;
    }

    const customerMobile = clientData.mobile_number.startsWith("91")
      ? clientData.mobile_number
      : "91" + clientData.mobile_number;

    const receiptLink = `${process.env.NEXT_PUBLIC_FRONTEND_URL}/receipt/${serviceMobile._id}`;
    const customer = clientData.client_name || "";
    const shop = clientData.owner_name || "INFINFEST MOBILE SERVICE";
    const billNumber = clientData.bill_no || "N/A";

    const servicedMobiles = clientData.MobileName.map((device, index) => {
  const paid = device.total_paid || (device.payments && device.payments.length > 0 ? device.payments.reduce((sum, p) => sum + (p.amount || 0), 0) : 0) || device.paid_amount || 0;
  return `${index + 1}. 📱 ${device.mobile_name} - ${device.issue || "General Service"} (Paid: ₹${paid})`;
    }).join("\n");

    const message = `🧾 *${shop}* - Service Receipt\n\n👤 Customer: ${customer}\n📞 Mobile: ${clientData.mobile_number}\n🧾 Bill No: ${billNumber}\n\n📱 *Devices:*\n${servicedMobiles}\n\n🔗 View Online: ${receiptLink}\n\n✨ Thank you for choosing our service!`;

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

      {/* Main Modal */}
      {!loading && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[9998] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                🧾 Receipt Generator
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-red-600 transition-colors duration-200"
              >
                <IoCloseCircleOutline size={28} />
              </button>
            </div>

            {/* Receipt Preview */}
            <div className="p-6 bg-gray-50">
              <div className="mb-6">
                <PrintableReceipt
                  ref={receiptRef}
                  clientData={clientData}
                  shopPhoneNumber={profilePhoneNumber || shopPhoneNumber}
                  shopAddress={profileAddress || shopAddress}
                  shopEmail={shopEmail}
                  shopName={shopName}
                  profilePhoto={profilePhoto}
                />
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

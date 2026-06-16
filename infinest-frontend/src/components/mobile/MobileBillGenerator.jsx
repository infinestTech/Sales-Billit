'use client';

import React, { useRef, useState, useEffect } from "react";
import { useReactToPrint } from "react-to-print";
import { 
  Printer, 
  Download, 
  MessageCircle, 
  Eye, 
  X, 
  Share, 
  FileText,
  Phone,
  User,
  Calendar,
  Smartphone
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const MobileBillPreview = React.forwardRef(({ clientData, shopData }, ref) => (
  <div ref={ref} className="bg-white p-4 max-w-sm mx-auto text-sm font-mono print:shadow-none">
    {/* Header */}
    <div className="text-center border-b-2 border-gray-800 pb-3 mb-3">
      <h2 className="text-lg font-bold text-gray-800 mb-1">
        {shopData?.name || clientData.owner_name || "MOBILE SERVICE"}
      </h2>
      <p className="text-xs text-gray-600">
        📞 {shopData?.phone || "9876543210"}
      </p>
      {shopData?.email && (
        <p className="text-xs text-gray-600">
          📧 {shopData.email}
        </p>
      )}
      {shopData?.address && (
        <p className="text-xs text-gray-600">
          📍 {shopData.address}
        </p>
      )}
    </div>

    {/* Customer Details */}
    <div className="mb-3 space-y-1">
      <div className="flex justify-between">
        <span className="font-semibold text-gray-700">Customer:</span>
        <span className="text-gray-900">{clientData.client_name}</span>
      </div>
      <div className="flex justify-between">
        <span className="font-semibold text-gray-700">Mobile:</span>
        <span className="text-gray-900">{clientData.mobile_number}</span>
      </div>
      {clientData.bill_no && (
        <div className="flex justify-between">
          <span className="font-semibold text-gray-700">Bill No:</span>
          <span className="text-gray-900">{clientData.bill_no}</span>
        </div>
      )}
      <div className="flex justify-between">
        <span className="font-semibold text-gray-700">Date:</span>
        <span className="text-gray-900">{new Date().toLocaleDateString("en-IN")}</span>
      </div>
    </div>

    {/* Services Table */}
    <div className="mb-3">
      <h3 className="font-bold text-gray-800 mb-2 text-center border-b border-gray-300 pb-1">
        📱 DEVICES FOR SERVICE
      </h3>
      <table className="w-full border-collapse border border-gray-400 text-xs">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-400 px-1 py-1 text-left">#</th>
            <th className="border border-gray-400 px-1 py-1 text-left">Device</th>
            <th className="border border-gray-400 px-1 py-1 text-left">Issue</th>
          </tr>
        </thead>
        <tbody>
          {clientData.MobileName?.map((mobile, index) => (
            <tr key={index}>
              <td className="border border-gray-400 px-1 py-1 text-center">
                {index + 1}
              </td>
              <td className="border border-gray-400 px-1 py-1">
                {mobile.mobile_name}
              </td>
              <td className="border border-gray-400 px-1 py-1">
                {mobile.issue || "General Service"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Footer */}
    <div className="text-center border-t-2 border-gray-800 pt-3">
      <p className="text-xs text-gray-600 mb-1">
        ⭐ Thank you for choosing our service! ⭐
      </p>
      <p className="text-xs text-gray-500">
        Support: {shopData?.phone || "9876543210"}
      </p>
      <p className="text-xs text-gray-400 mt-1">
        Generated: {new Date().toLocaleString("en-IN")}
      </p>
    </div>
  </div>
));

MobileBillPreview.displayName = "MobileBillPreview";

const MobileBillGenerator = ({ isOpen, onClose, clientData, shopData }) => {
  const printRef = useRef();
  const [showPreview, setShowPreview] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Receipt-${clientData?.bill_no || clientData?.client_name || 'Service'}`,
    onBeforeGetContent: () => setIsGenerating(true),
    onAfterPrint: () => setIsGenerating(false),
  });

  const handleWhatsApp = () => {
    const serviceMobile = clientData?.MobileName?.find(item => !!item._id);
    if (!serviceMobile?._id) {
      alert("⚠️ Mobile ID missing. Cannot generate tracking link.");
      return;
    }

    const customerMobile = clientData.mobile_number.startsWith("91")
      ? clientData.mobile_number
      : "91" + clientData.mobile_number;

    const receiptLink = `${process.env.NEXT_PUBLIC_FRONTEND_URL}/receipt/${serviceMobile._id}`;
    const customer = clientData.client_name || "";
    const shop = shopData?.name || clientData.owner_name || "MOBILE SERVICE";
    const billNumber = clientData.bill_no || "N/A";

    const servicedMobiles = clientData.MobileName?.map((device, index) => {
      return `${index + 1}. 📱 ${device.mobile_name} - ${device.issue || "General Service"}`;
    }).join("\\n");

    const message = `🧾 *${shop}* - Service Receipt\\n\\n👤 Customer: ${customer}\\n📞 Mobile: ${clientData.mobile_number}\\n🧾 Bill No: ${billNumber}\\n\\n📱 *Devices:*\\n${servicedMobiles}\\n\\n🔗 View Online: ${receiptLink}\\n\\n✨ Thank you for choosing our service!`;

    window.open(`https://wa.me/${customerMobile}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleDownload = () => {
    // Create a simple text version for download
    const servicedMobiles = clientData.MobileName?.map((device, index) => {
      return `${index + 1}. ${device.mobile_name} - ${device.issue || "General Service"}`;
    }).join("\\n");

    const content = `${shopData?.name || 'MOBILE SERVICE'}\\n${'='.repeat(30)}\\n\\nCustomer: ${clientData.client_name}\\nMobile: ${clientData.mobile_number}\\nBill No: ${clientData.bill_no || 'N/A'}\\nDate: ${new Date().toLocaleDateString('en-IN')}\\n\\nDevices for Service:\\n${servicedMobiles}\\n\\nThank you for choosing our service!`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Receipt-${clientData?.bill_no || clientData?.client_name || 'Service'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen || !clientData) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-xl shadow-2xl max-h-full overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">Service Receipt</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Customer Info */}
        <div className="p-4 bg-gray-50 border-b">
          <div className="flex items-center space-x-3 mb-2">
            <User className="w-4 h-4 text-gray-600" />
            <span className="font-medium text-gray-900">{clientData.client_name}</span>
          </div>
          <div className="flex items-center space-x-3">
            <Phone className="w-4 h-4 text-gray-600" />
            <span className="text-gray-700">{clientData.mobile_number}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 space-y-3">
          <Button
            onClick={() => setShowPreview(!showPreview)}
            variant="outline"
            className="w-full flex items-center justify-center space-x-2"
          >
            <Eye className="w-4 h-4" />
            <span>{showPreview ? 'Hide Preview' : 'Show Preview'}</span>
          </Button>

          <div className="grid grid-cols-3 gap-2">
            <Button
              onClick={handlePrint}
              disabled={isGenerating}
              className="flex flex-col items-center space-y-1 h-auto py-3"
              variant="outline"
            >
              <Printer className="w-4 h-4" />
              <span className="text-xs">Print</span>
            </Button>

            <Button
              onClick={handleWhatsApp}
              className="flex flex-col items-center space-y-1 h-auto py-3 bg-green-600 hover:bg-green-700"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="text-xs">WhatsApp</span>
            </Button>

            <Button
              onClick={handleDownload}
              variant="outline"
              className="flex flex-col items-center space-y-1 h-auto py-3"
            >
              <Download className="w-4 h-4" />
              <span className="text-xs">Download</span>
            </Button>
          </div>
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="border-t border-gray-200 p-4">
            <MobileBillPreview 
              ref={printRef}
              clientData={clientData} 
              shopData={shopData} 
            />
          </div>
        )}

        {/* Hidden print component */}
        <div className="hidden">
          <MobileBillPreview 
            ref={printRef}
            clientData={clientData} 
            shopData={shopData} 
          />
        </div>
      </div>
    </div>
  );
};

export default MobileBillGenerator;

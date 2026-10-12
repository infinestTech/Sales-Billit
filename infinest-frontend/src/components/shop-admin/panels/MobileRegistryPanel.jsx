"use client";
import { Suspense } from "react";
import MobileNamePage from "@/components/MobileNamePageTable/MobileNamePage";
import shopAdminApi from "../shopAdminApi";

// Same Mobile Registry page as the user portal (/mobilename), backed by the shop-admin endpoints
const shopAdminRegistryClient = {
  list: (body) => shopAdminApi.registryList(body),
  dealerNames: () => shopAdminApi.registryDealerNames(),
  updateTechnician: (mobileId, technicianName) => shopAdminApi.registryUpdateTechnician(mobileId, technicianName),
  toggleStatus: (body) => shopAdminApi.registryToggleStatus(body),
  addPayment: (body) => shopAdminApi.registryAddPayment(body),
  fetchImages: async (mobileId) => {
    try {
      return await shopAdminApi.registryImages(mobileId);
    } catch (err) {
      throw new Error(err?.response?.data?.error || "Could not load images");
    }
  },
};

export default function MobileRegistryPanel({ currentShopId }) {
  if (!currentShopId) return null;
  return (
    <Suspense fallback={<div className="py-12 text-center text-gray-500">Loading mobile registry...</div>}>
      {/* key remounts the page (resetting filters) when the admin switches shop */}
      <MobileNamePage key={currentShopId} shopId={currentShopId} client={shopAdminRegistryClient} embedded />
    </Suspense>
  );
}

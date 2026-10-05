"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || "http://localhost:8000";
const REFRESH_MS = 6 * 60 * 60 * 1000; // Sales tokens live 12h; refresh well before expiry

const EMPTY = { token: "", planId: "", branchLimit: 0, loading: false, error: "" };

// Exchanges the shop-admin session for a SalesServer token scoped to the selected shop.
export default function useSalesSession(shopId, enabled) {
  const [state, setState] = useState(EMPTY);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled || !shopId) return;
    const id = ++requestId.current;
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const res = await axios.post(
        `${API_URL}/api/shop-admin/sales/token`,
        {},
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("shopAdminToken")}` },
          params: { shop_id: shopId },
        }
      );
      if (id !== requestId.current) return;
      setState({
        token: res.data.token,
        planId: res.data.mongoPlanId || "",
        branchLimit: Number(res.data.branchLimit) || 0,
        loading: false,
        error: "",
      });
    } catch (err) {
      if (id !== requestId.current) return;
      if (err?.response?.status === 401) {
        localStorage.clear();
        window.location.href = "/shop-admin-login";
        return;
      }
      setState({ ...EMPTY, error: err?.response?.data?.message || "Could not connect to the Sales server" });
    }
  }, [shopId, enabled]);

  useEffect(() => {
    requestId.current++;
    setState(EMPTY);
    if (!enabled || !shopId) return undefined;
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh, enabled, shopId]);

  return { ...state, refresh };
}

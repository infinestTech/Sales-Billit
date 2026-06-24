"use client";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL_BILLIT || "http://localhost:8000";
const BASE = `${API_URL}/api/shop-admin`;

const getCurrentShopId = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("currentShopId") || null;
};

const getToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("shopAdminToken") || null;
};

const buildConfig = (extra = {}) => {
  const token = getToken();
  const shopId = getCurrentShopId();
  return {
    headers: { Authorization: `Bearer ${token}`, ...(extra.headers || {}) },
    params: { shop_id: shopId, ...(extra.params || {}) },
    ...(extra.data !== undefined ? { data: extra.data } : {}),
  };
};

const handleAuthError = (err) => {
  if (err?.response?.status === 401 && typeof window !== "undefined") {
    localStorage.clear();
    window.location.href = "/shop-admin-login";
  }
  throw err;
};

const request = async (method, path, { params, data } = {}) => {
  try {
    const cfg = buildConfig({ params });
    const url = `${BASE}${path}`;
    let res;
    if (method === "get") res = await axios.get(url, cfg);
    else if (method === "delete") res = await axios.delete(url, { ...cfg, data });
    else res = await axios({ method, url, data, ...cfg });
    return res.data;
  } catch (err) {
    handleAuthError(err);
  }
};

const shopAdminApi = {
  // bill numbers
  nextBillNumber: (prefix) => request("post", "/records/next-bill-number", { data: { prefix } }),
  checkBillNumber: (billNumber) => request("post", "/records/check-bill-number", { data: { billNumber } }),

  // records / customers / dealers
  createCustomer: (payload) => request("post", "/records/customer", { data: payload }),
  createDealer: (payload) => request("post", "/records/dealer", { data: payload }),
  listRecords: () => request("get", "/records"),
  toggleMobileStatus: (mobileId, status, value) => request("post", "/records/toggle-status", { data: { mobileId, status, value } }),
  deleteMobile: (mobileId) => request("delete", `/records/mobile/${mobileId}`),
  updateBalance: (id, balanceAmount, type) => request("put", "/records/balance", { data: { id, balanceAmount, type } }),
  deleteCustomer: (id) => request("delete", `/records/customer/${id}`),
  deleteDealer: (id) => request("delete", `/records/dealer/${id}`),
  addPayment: (mobileId, amount, method) => request("post", "/records/payment", { data: { mobileId, amount, method } }),
  removePayment: (mobileId, paymentIndex) => request("delete", "/records/payment", { data: { mobileId, paymentIndex } }),

  // suppliers
  listSuppliers: () => request("get", "/suppliers"),
  createSupplier: (payload) => request("post", "/suppliers", { data: payload }),
  updateSupplier: (id, payload) => request("put", `/suppliers/${id}`, { data: payload }),
  deleteSupplier: (id) => request("delete", `/suppliers/${id}`),

  // products
  listProducts: () => request("get", "/products"),
  createProduct: (payload) => request("post", "/products", { data: payload }),
  updateProduct: (id, payload) => request("put", `/products/${id}`, { data: payload }),
  deleteProduct: (id) => request("delete", `/products/${id}`),
  sellProduct: (id, quantitySold, sellingPrice) => request("post", `/products/${id}/sell`, { data: { quantitySold, sellingPrice } }),
  restockProduct: (id, quantityToAdd) => request("post", `/products/${id}/restock`, { data: { quantityToAdd } }),

  // expenses
  listExpenses: (params) => request("get", "/expenses", { params }),
  createExpense: (payload) => request("post", "/expenses", { data: payload }),
  updateExpense: (id, payload) => request("put", `/expenses/${id}`, { data: payload }),
  deleteExpense: (id) => request("delete", `/expenses/${id}`),

  // balance summary
  balanceSummary: () => request("get", "/balance-summary"),

  // mobile registry
  mobileRegistry: () => request("get", "/mobile-registry"),

  // meta
  paymentMethods: () => request("get", "/meta/payment-methods"),
};

export default shopAdminApi;

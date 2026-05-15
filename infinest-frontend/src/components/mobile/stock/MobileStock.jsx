"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  ShoppingCart,
  History,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  X,
  RefreshCw,
} from "lucide-react"
import api from "@/components/api"
import BottomSheet from "../records/BottomSheet"
import { formatINR, formatDateTime, getShopIdFromToken } from "../records/utils"
import { logAndNotify, logError } from "@/utils/logger"
import { PAYMENT_METHOD_OPTIONS, DEFAULT_PAYMENT_METHOD } from "@/constants/paymentMethods"

const TABS = [
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "history", label: "History", icon: History },
]

export default function MobileStock({ shopId: shopIdProp }) {
  const shopId = shopIdProp || getShopIdFromToken()
  const [tab, setTab] = useState("inventory")
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showLowOnly, setShowLowOnly] = useState(false)

  const [showAddSheet, setShowAddSheet] = useState(false)
  const [detailProduct, setDetailProduct] = useState(null) // for sell / increase / view
  const [detailMode, setDetailMode] = useState("view") // view | sell | restock

  const fetchProducts = async () => {
    if (!shopId) return
    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      const res = await api.post(
        "/api/products/list",
        { shop_id: shopId },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setProducts(Array.isArray(res.data?.products) ? res.data.products : [])
    } catch (err) {
      logError("Failed to load products", err, shopId)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId])

  const filtered = useMemo(() => {
    let list = products
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q)
      )
    }
    if (showLowOnly) list = list.filter((p) => Number(p.quantity) <= 10)
    return list
  }, [products, search, showLowOnly])

  const stats = useMemo(() => {
    const totalProducts = products.length
    const totalValue = products.reduce(
      (s, p) => s + Number(p.costPrice || 0) * Number(p.quantity || 0),
      0
    )
    const lowStock = products.filter((p) => Number(p.quantity) <= 10).length
    const outOfStock = products.filter((p) => Number(p.quantity) <= 0).length
    return { totalProducts, totalValue, lowStock, outOfStock }
  }, [products])

  const openSell = (p) => {
    setDetailProduct(p)
    setDetailMode("sell")
  }
  const openRestock = (p) => {
    setDetailProduct(p)
    setDetailMode("restock")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="px-4 pt-3 pb-2">
          <div className="grid grid-cols-3 gap-2">
            <StatPill label="Items" value={stats.totalProducts} tone="blue" />
            <StatPill label="Value" value={formatINR(stats.totalValue)} tone="emerald" />
            <StatPill label="Low" value={stats.lowStock} tone={stats.lowStock ? "amber" : "gray"} />
          </div>
        </div>
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              className="w-full rounded-full border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-9 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
            <Chip active={!showLowOnly} onClick={() => setShowLowOnly(false)}>
              All
            </Chip>
            <Chip active={showLowOnly} onClick={() => setShowLowOnly(true)} tone="amber">
              <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
              Low stock {stats.lowStock ? `(${stats.lowStock})` : ""}
            </Chip>
            <button
              onClick={fetchProducts}
              className="ml-auto inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex border-t border-gray-100 bg-white">
          {TABS.map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-b-2 border-blue-600 text-indigo-600"
                    : "border-b-2 border-transparent text-gray-500"
                }`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Body */}
      {tab === "inventory" ? (
        <InventoryList
          loading={loading}
          products={filtered}
          onSell={openSell}
          onRestock={openRestock}
        />
      ) : (
        <HistoryView shopId={shopId} products={products} />
      )}

      {/* Floating Add */}
      <button
        onClick={() => setShowAddSheet(true)}
        className="fixed bottom-24 right-4 z-20 flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg active:scale-95"
      >
        <Plus className="h-5 w-5" /> Add Product
      </button>

      {showAddSheet && (
        <AddProductSheet
          shopId={shopId}
          onClose={() => setShowAddSheet(false)}
          onAdded={() => {
            setShowAddSheet(false)
            fetchProducts()
          }}
        />
      )}

      {detailProduct && (
        <ProductActionSheet
          product={detailProduct}
          shopId={shopId}
          mode={detailMode}
          onMode={setDetailMode}
          onClose={() => setDetailProduct(null)}
          onDone={() => {
            setDetailProduct(null)
            fetchProducts()
          }}
        />
      )}
    </div>
  )
}

function StatPill({ label, value, tone = "gray" }) {
  const toneMap = {
    blue: "bg-indigo-50 text-indigo-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    gray: "bg-gray-100 text-gray-700",
  }
  return (
    <div className={`rounded-xl px-3 py-2 ${toneMap[tone]}`}>
      <div className="text-[10px] font-medium uppercase tracking-wide opacity-70">
        {label}
      </div>
      <div className="truncate text-base font-bold">{value}</div>
    </div>
  )
}

function Chip({ children, active, onClick, tone }) {
  const base =
    "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap"
  const off = "border-gray-200 bg-white text-gray-600"
  const on =
    tone === "amber"
      ? "border-amber-300 bg-amber-50 text-amber-700"
      : "border-indigo-300 bg-indigo-50 text-indigo-700"
  return (
    <button onClick={onClick} className={`${base} ${active ? on : off}`}>
      {children}
    </button>
  )
}

function StockBadge({ qty }) {
  const n = Number(qty || 0)
  let cls = "bg-emerald-100 text-emerald-700"
  if (n <= 5) cls = "bg-red-100 text-red-700"
  else if (n <= 10) cls = "bg-amber-100 text-amber-700"
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {n} in stock
    </span>
  )
}

function InventoryList({ loading, products, onSell, onRestock }) {
  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-white" />
        ))}
      </div>
    )
  }
  if (!products.length) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <Package className="mb-3 h-12 w-12 text-gray-300" />
        <p className="font-medium text-gray-700">No products</p>
        <p className="text-sm text-gray-500">Tap "Add Product" to start your inventory.</p>
      </div>
    )
  }
  return (
    <div className="space-y-2 p-3 pb-32">
      {products.map((p) => (
        <div
          key={p._id}
          className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <h3 className="truncate text-base font-semibold text-gray-900">
                  {p.name}
                </h3>
                {Number(p.quantity) <= 5 && (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                )}
              </div>
              {p.category && (
                <p className="truncate text-xs text-gray-500">{p.category}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <StockBadge qty={p.quantity} />
                {p.sellingPrice ? (
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700">
                    Sell {formatINR(p.sellingPrice)}
                  </span>
                ) : null}
                {p.costPrice ? (
                  <span className="text-gray-500">
                    Cost {formatINR(p.costPrice)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => onRestock(p)}
              className="rounded-lg border border-gray-200 bg-white py-2 text-sm font-semibold text-gray-700 active:scale-[0.98]"
            >
              <Plus className="mr-1 inline h-4 w-4" /> Restock
            </button>
            <button
              onClick={() => onSell(p)}
              disabled={Number(p.quantity) <= 0}
              className="rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white disabled:opacity-50 active:scale-[0.98]"
            >
              <ShoppingCart className="mr-1 inline h-4 w-4" /> Sell
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---------- Add Product Sheet ---------- */
function AddProductSheet({ shopId, onClose, onAdded }) {
  const [form, setForm] = useState({
    name: "",
    category: "",
    costPrice: "",
    sellingPrice: "",
    quantity: "",
    supplierId: "",
    paymentMethod: DEFAULT_PAYMENT_METHOD,
  })
  const [suppliers, setSuppliers] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!shopId) return
    const token = localStorage.getItem("token")
    api
      .post(
        "/api/suppliers/list",
        { shop_id: shopId },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      .then((res) => setSuppliers(res.data?.suppliers || []))
      .catch(() => setSuppliers([]))
  }, [shopId])

  const valid =
    form.name.trim() &&
    Number(form.costPrice) > 0 &&
    Number(form.quantity) > 0

  const submit = async () => {
    if (!valid || saving) return
    setSaving(true)
    try {
      const token = localStorage.getItem("token")
      await api.post(
        "/api/products/add",
        {
          shop_id: shopId,
          name: form.name.trim(),
          category: form.category.trim(),
          costPrice: parseFloat(form.costPrice),
          sellingPrice: form.sellingPrice ? parseFloat(form.sellingPrice) : undefined,
          quantity: parseInt(form.quantity, 10),
          supplierId: form.supplierId || undefined,
          paymentMethod: form.paymentMethod,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      logAndNotify("Product added", "success", shopId)
      onAdded()
    } catch (err) {
      logError("Failed to add product", err, shopId)
      logAndNotify("Failed to add product", "error", shopId)
    } finally {
      setSaving(false)
    }
  }

  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <BottomSheet
      open
      onClose={onClose}
      title="Add Product"
      subtitle="New inventory item"
      footer={
        <button
          onClick={submit}
          disabled={!valid || saving}
          className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Product"}
        </button>
      }
    >
      <div className="space-y-3 pt-2">
        <Field label="Name *">
          <input
            value={form.name}
            onChange={upd("name")}
            placeholder="Product name"
            className="input"
          />
        </Field>
        <Field label="Category">
          <input
            value={form.category}
            onChange={upd("category")}
            placeholder="Optional"
            className="input"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost ₹ *">
            <input
              type="number"
              inputMode="decimal"
              value={form.costPrice}
              onChange={upd("costPrice")}
              className="input"
            />
          </Field>
          <Field label="Selling ₹">
            <input
              type="number"
              inputMode="decimal"
              value={form.sellingPrice}
              onChange={upd("sellingPrice")}
              className="input"
            />
          </Field>
        </div>
        <Field label="Quantity *">
          <input
            type="number"
            inputMode="numeric"
            value={form.quantity}
            onChange={upd("quantity")}
            className="input"
          />
        </Field>
        <Field label="Supplier">
          <select value={form.supplierId} onChange={upd("supplierId")} className="input">
            <option value="">— None —</option>
            {suppliers.map((s) => (
              <option key={s._id} value={s._id}>
                {s.supplierName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Payment Method">
          <select value={form.paymentMethod} onChange={upd("paymentMethod")} className="input">
            {PAYMENT_METHOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <style jsx>{`
        :global(.input) {
          width: 100%;
          border: 1px solid #e5e7eb;
          background: #f9fafb;
          border-radius: 0.75rem;
          padding: 0.625rem 0.875rem;
          font-size: 0.875rem;
        }
        :global(.input:focus) {
          outline: none;
          border-color: #3b82f6;
          background: white;
        }
      `}</style>
    </BottomSheet>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </span>
      {children}
    </label>
  )
}

/* ---------- Product Action Sheet (sell / restock) ---------- */
function ProductActionSheet({ product, shopId, mode, onMode, onClose, onDone }) {
  const [qty, setQty] = useState("")
  const [paid, setPaid] = useState("")
  const [cost, setCost] = useState(product.costPrice || "")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setQty("")
    setPaid("")
    setCost(product.costPrice || "")
  }, [mode, product])

  const inStock = Number(product.quantity || 0)
  const sellQty = Number(qty || 0)
  const sellAmt = Number(paid || 0)
  const restockQty = Number(qty || 0)
  const restockCost = Number(cost || 0)

  const sellValid = sellQty > 0 && sellQty <= inStock && sellAmt >= 0
  const restockValid = restockQty > 0 && restockCost > 0

  const doSell = async () => {
    if (!sellValid || saving) return
    setSaving(true)
    try {
      const token = localStorage.getItem("token")
      await api.post(
        "/api/products/sell",
        {
          shop_id: shopId,
          productId: product._id,
          quantitySold: sellQty,
          paidAmount: sellAmt,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      logAndNotify(`Sold ${sellQty} × ${product.name}`, "success", shopId)
      onDone()
    } catch (err) {
      logError("Failed to sell", err, shopId)
      logAndNotify("Failed to sell product", "error", shopId)
    } finally {
      setSaving(false)
    }
  }

  const doRestock = async () => {
    if (!restockValid || saving) return
    setSaving(true)
    try {
      const token = localStorage.getItem("token")
      await api.post(
        "/api/products/increase-stock",
        {
          shop_id: shopId,
          productId: product._id,
          quantityToAdd: restockQty,
          costPrice: restockCost,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      logAndNotify(`Added ${restockQty} units`, "success", shopId)
      onDone()
    } catch (err) {
      logError("Failed to restock", err, shopId)
      logAndNotify("Failed to restock", "error", shopId)
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={product.name}
      subtitle={`${inStock} in stock${
        product.sellingPrice ? ` • ${formatINR(product.sellingPrice)}` : ""
      }`}
      footer={
        mode === "sell" ? (
          <button
            onClick={doSell}
            disabled={!sellValid || saving}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Selling…" : `Sell ${sellQty || 0} for ${formatINR(sellAmt)}`}
          </button>
        ) : mode === "restock" ? (
          <button
            onClick={doRestock}
            disabled={!restockValid || saving}
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving
              ? "Adding…"
              : `Add ${restockQty || 0} units (${formatINR(restockQty * restockCost)})`}
          </button>
        ) : null
      }
    >
      {/* Mode tabs */}
      <div className="mb-4 mt-1 flex rounded-xl bg-gray-100 p-1">
        {[
          { id: "sell", label: "Sell" },
          { id: "restock", label: "Restock" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => onMode(t.id)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              mode === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode === "sell" ? (
        <div className="space-y-3">
          <Field label={`Quantity (max ${inStock})`}>
            <input
              type="number"
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              max={inStock}
              className="input"
            />
          </Field>
          <Field label="Paid amount ₹">
            <input
              type="number"
              inputMode="decimal"
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              placeholder={
                product.sellingPrice
                  ? String(Number(product.sellingPrice) * (sellQty || 1))
                  : "0"
              }
              className="input"
            />
          </Field>
          {sellQty > inStock && (
            <p className="text-xs font-semibold text-red-600">
              Only {inStock} available.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <Field label="Quantity to add">
            <input
              type="number"
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Cost price (per unit) ₹">
            <input
              type="number"
              inputMode="decimal"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              className="input"
            />
          </Field>
          {restockValid && (
            <div className="rounded-lg bg-indigo-50 p-3 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>New stock</span>
                <span className="font-bold text-gray-900">
                  {inStock + restockQty}
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Total cost</span>
                <span className="font-bold text-gray-900">
                  {formatINR(restockQty * restockCost)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  )
}

/* ---------- History View ---------- */
function HistoryView({ shopId, products }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState("all") // all|ADD|SELL
  const [productId, setProductId] = useState("all")
  const [showProductSheet, setShowProductSheet] = useState(false)

  const fetchHistory = async () => {
    if (!shopId || !products.length) return
    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      const targets =
        productId === "all" ? products : products.filter((p) => p._id === productId)
      const all = []
      const responses = await Promise.all(
        targets.map((p) =>
          api
            .post(
              `/api/products/history/${p._id}`,
              { shop_id: shopId },
              { headers: { Authorization: `Bearer ${token}` } }
            )
            .then((r) => ({ p, h: r.data?.history || [] }))
            .catch(() => ({ p, h: [] }))
        )
      )
      responses.forEach(({ p, h }) => {
        h.forEach((e) =>
          all.push({ ...e, productName: p.name, productId: p._id })
        )
      })
      all.sort((a, b) => new Date(b.changeDate) - new Date(a.changeDate))
      setHistory(all)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, productId, products.length])

  const filtered = filter === "all" ? history : history.filter((h) => h.changeType === filter)

  const stats = useMemo(() => {
    const adds = history.filter((h) => h.changeType === "ADD")
    const sells = history.filter((h) => h.changeType === "SELL")
    return {
      addedQty: adds.reduce((s, e) => s + Number(e.quantity || 0), 0),
      soldQty: sells.reduce((s, e) => s + Number(e.quantity || 0), 0),
    }
  }, [history])

  const selectedProductName =
    productId === "all"
      ? "All products"
      : products.find((p) => p._id === productId)?.name || "—"

  return (
    <div className="space-y-3 p-3 pb-32">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-emerald-50 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-700">
            <TrendingUp className="h-4 w-4" /> Added
          </div>
          <div className="mt-1 text-xl font-bold text-emerald-700">{stats.addedQty}</div>
        </div>
        <div className="rounded-xl bg-indigo-50 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-indigo-700">
            <TrendingDown className="h-4 w-4" /> Sold
          </div>
          <div className="mt-1 text-xl font-bold text-indigo-700">{stats.soldQty}</div>
        </div>
      </div>

      <button
        onClick={() => setShowProductSheet(true)}
        className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left"
      >
        <div>
          <div className="text-[10px] font-semibold uppercase text-gray-500">
            Product
          </div>
          <div className="truncate text-sm font-medium text-gray-900">
            {selectedProductName}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-gray-400" />
      </button>

      <div className="flex gap-2 overflow-x-auto">
        {[
          { id: "all", label: "All" },
          { id: "ADD", label: "Restocks" },
          { id: "SELL", label: "Sales" },
        ].map((c) => (
          <button
            key={c.id}
            onClick={() => setFilter(c.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              filter === c.id
                ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                : "border-gray-200 bg-white text-gray-600"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-white" />
          ))}
        </div>
      ) : !filtered.length ? (
        <div className="rounded-xl bg-white py-10 text-center text-sm text-gray-500">
          No history yet
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((e) => {
            const isAdd = e.changeType === "ADD"
            return (
              <li
                key={e._id}
                className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {e.productName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDateTime(e.changeDate)}
                    </p>
                    {e.notes && (
                      <p className="mt-1 truncate text-xs text-gray-500">{e.notes}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        isAdd
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-indigo-100 text-indigo-700"
                      }`}
                    >
                      {isAdd ? "+" : "-"}
                      {e.quantity}
                    </span>
                    {e.paidAmount != null && (
                      <div className="mt-1 text-xs text-gray-600">
                        {formatINR(e.paidAmount)}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {showProductSheet && (
        <BottomSheet
          open
          onClose={() => setShowProductSheet(false)}
          title="Filter by product"
        >
          <ul className="divide-y divide-gray-100">
            <li>
              <button
                onClick={() => {
                  setProductId("all")
                  setShowProductSheet(false)
                }}
                className="w-full px-1 py-3 text-left text-sm font-medium text-gray-700"
              >
                All products
              </button>
            </li>
            {products.map((p) => (
              <li key={p._id}>
                <button
                  onClick={() => {
                    setProductId(p._id)
                    setShowProductSheet(false)
                  }}
                  className={`w-full px-1 py-3 text-left text-sm ${
                    productId === p._id
                      ? "font-bold text-indigo-700"
                      : "text-gray-700"
                  }`}
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        </BottomSheet>
      )}
    </div>
  )
}

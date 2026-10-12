"use client";
import { Plus, Trash2, RefreshCw } from "lucide-react";

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const toPaise = (n) => Math.round((Number(n) || 0) * 100);
export const inr = (n) => `₹${round2(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

let rowSeq = 0;
export const newItemRow = () => ({ key: `row-${++rowSeq}`, productId: null, name: "", quantity: "", costPrice: "" });

// Line total uses the rounded unit price, matching the server
export const lineTotal = (row) => round2((Number(row.quantity) || 0) * round2(row.costPrice));
export const itemsTotal = (rows) => round2(rows.reduce((s, r) => s + lineTotal(r), 0));
export const itemsPayload = (rows) =>
  rows.map((r) => ({ productId: r.productId || undefined, name: r.name.trim(), quantity: Number(r.quantity), costPrice: Number(r.costPrice) }));

// Returns an error message for the first invalid row, or "" when every row is complete
export function validateItems(rows) {
  if (!rows.length) return "Add at least one product";
  for (const [i, r] of rows.entries()) {
    if (!r.name.trim()) return `Row ${i + 1}: enter the product name`;
    const q = Number(r.quantity);
    if (!Number.isInteger(q) || q <= 0) return `Row ${i + 1}: quantity must be a whole number above 0`;
    if (r.costPrice === "" || !(Number(r.costPrice) >= 0)) return `Row ${i + 1}: enter the purchase price`;
  }
  return "";
}

const cellInput = "w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500";

// Editable product list for a supplier bill. `spares` (this supplier's existing spares) lets a row
// restock an existing spare: typing its exact name links the row to it instead of creating a new spare.
export default function SupplierItemsEditor({ rows, onChange, spares = [], target = null }) {
  const update = (key, patch) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const onName = (row, name) => {
    const match = spares.find((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase());
    update(row.key, {
      name,
      productId: match ? match.productId : null,
      costPrice: match && row.costPrice === "" ? String(match.costPrice ?? "") : row.costPrice,
    });
  };

  const total = itemsTotal(rows);
  const diff = target == null ? 0 : round2(Number(target || 0) - total);
  const listId = "supplier-spares-list";

  return (
    <div>
      {spares.length > 0 && (
        <datalist id={listId}>
          {spares.map((s) => <option key={s.productId} value={s.name} />)}
        </datalist>
      )}
      <div className="hidden sm:grid grid-cols-12 gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 px-1 mb-1">
        <div className="col-span-5">Product</div>
        <div className="col-span-2">Qty</div>
        <div className="col-span-2">Price / unit</div>
        <div className="col-span-2 text-right">Total</div>
        <div className="col-span-1" />
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.key} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-12 sm:col-span-5 relative">
              <input
                className={cellInput}
                placeholder="e.g. Oppo A5 display"
                value={row.name}
                list={spares.length ? listId : undefined}
                onChange={(e) => onName(row, e.target.value)}
              />
              {row.productId && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
                  <RefreshCw className="h-3 w-3" /> Restock
                </span>
              )}
            </div>
            <input className={`${cellInput} col-span-4 sm:col-span-2`} type="number" min="1" step="1" placeholder="Qty"
              value={row.quantity} onChange={(e) => update(row.key, { quantity: e.target.value })} />
            <input className={`${cellInput} col-span-4 sm:col-span-2`} type="number" min="0" step="0.01" placeholder="₹ Price"
              value={row.costPrice} onChange={(e) => update(row.key, { costPrice: e.target.value })} />
            <div className="col-span-3 sm:col-span-2 text-right text-sm font-semibold text-slate-800">{inr(lineTotal(row))}</div>
            <button
              type="button"
              onClick={() => onChange(rows.length > 1 ? rows.filter((r) => r.key !== row.key) : [newItemRow()])}
              className="col-span-1 p-2 text-red-500 hover:bg-red-50 rounded-lg justify-self-end"
              title="Remove row"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
        <button type="button" onClick={() => onChange([...rows, newItemRow()])}
          className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800">
          <Plus className="h-4 w-4" /> Add product
        </button>
        <div className="text-sm text-slate-700">
          Products total: <span className="font-bold text-slate-900">{inr(total)}</span>
        </div>
      </div>

      {target != null && Number(target) > 0 && (
        toPaise(diff) === 0 ? (
          <div className="mt-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            ✓ Products total matches the opening credit
          </div>
        ) : (
          <div className="mt-2 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {diff > 0 ? `${inr(diff)} of the opening credit is not covered by products yet` : `Products exceed the opening credit by ${inr(-diff)}`}
          </div>
        )
      )}
    </div>
  );
}

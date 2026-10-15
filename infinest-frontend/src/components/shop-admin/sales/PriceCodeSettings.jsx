"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { KeyRound, Check, RotateCcw, Trash2, Info } from "lucide-react";
import shopAdminApi from "../shopAdminApi";
import { PRICE_CODE_DIGITS, encodePriceCode } from "./barcodeLabels";

// Shop-admin screen for the secret price code: the owner gives each digit (1 2 3 4 5 6 7 8 9 0) its own
// character. Labels and inventory then show the cost price written with those characters.
const DIGITS = PRICE_CODE_DIGITS.split("");
const EMPTY = DIGITS.map(() => "");
const EXAMPLES = [450, 1299, 8750, 15999];

const toSlots = (cipher) => {
  const chars = Array.from(String(cipher || ""));
  return chars.length === 10 ? chars : EMPTY.slice();
};
const cleanChar = (v) => {
  const c = Array.from(String(v || "").replace(/\s+/g, "")).pop() || "";
  return /[0-9]/.test(c) ? "" : c.toUpperCase();
};

export default function PriceCodeSettings({ shopId }) {
  const [saved, setSaved] = useState("");
  const [slots, setSlots] = useState(EMPTY.slice());
  const [quick, setQuick] = useState("");
  const [tryAmount, setTryAmount] = useState("1450");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null); // { type: 'ok' | 'err', text }
  const boxes = useRef([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    shopAdminApi.priceCode()
      .then((c) => { if (alive) { setSaved(c); setSlots(toSlots(c)); } })
      .catch(() => { if (alive) setNotice({ type: "err", text: "Could not load the price code" }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [shopId]);

  const cipher = slots.join("");
  const filled = slots.filter(Boolean).length;
  const duplicates = useMemo(() => {
    const seen = {};
    slots.forEach((c) => { if (c) seen[c] = (seen[c] || 0) + 1; });
    return new Set(Object.keys(seen).filter((c) => seen[c] > 1));
  }, [slots]);
  const complete = filled === 10 && duplicates.size === 0;
  const changed = cipher !== saved;
  const problem = filled === 0 ? "" : duplicates.size
    ? `"${[...duplicates].join('", "')}" is used for more than one digit — each digit needs its own character`
    : filled < 10 ? `${10 - filled} digit${10 - filled === 1 ? "" : "s"} still need a character` : "";

  const flash = (type, text) => { setNotice({ type, text }); setTimeout(() => setNotice(null), 3500); };

  const setSlot = (i, value) => {
    const c = cleanChar(value);
    setSlots((s) => s.map((x, j) => (j === i ? c : x)));
    if (c && i < 9) boxes.current[i + 1]?.focus();
  };

  const fillFrom = (text) => {
    const chars = Array.from(String(text || "").replace(/[\s0-9]+/g, "").toUpperCase()).slice(0, 10);
    setSlots(DIGITS.map((_, i) => chars[i] || ""));
  };

  const onBoxKey = (i, e) => {
    if (e.key === "Backspace" && !slots[i] && i > 0) { e.preventDefault(); boxes.current[i - 1]?.focus(); setSlot(i - 1, ""); }
    else if (e.key === "ArrowLeft" && i > 0) boxes.current[i - 1]?.focus();
    else if (e.key === "ArrowRight" && i < 9) boxes.current[i + 1]?.focus();
  };

  const onBoxPaste = (i, e) => {
    const text = e.clipboardData.getData("text");
    if (Array.from(text.trim()).length > 1) { e.preventDefault(); fillFrom(text); }
  };

  const save = async (next) => {
    setSaving(true);
    try {
      const c = await shopAdminApi.updatePriceCode(next);
      setSaved(c);
      setSlots(toSlots(c));
      setQuick("");
      try { window.dispatchEvent(new CustomEvent("price-cipher-updated")); } catch (_) {}
      flash("ok", c ? "Price code saved — new labels will use it" : "Price code removed");
    } catch (err) {
      flash("err", err?.response?.data?.message || "Could not save the price code");
    } finally {
      setSaving(false);
    }
  };

  const clearCode = () => {
    if (!window.confirm("Remove the price code? Labels will print without it until you set a new one.")) return;
    save("");
  };

  const previewCipher = complete ? cipher : "";
  const tryCode = previewCipher ? encodePriceCode(tryAmount, previewCipher) : "";

  if (loading) {
    return <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">Loading price code…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex rounded-lg bg-indigo-100 p-2 text-indigo-600"><KeyRound className="h-5 w-5" /></span>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Price Code</h2>
              <p className="mt-1 max-w-2xl text-sm text-gray-600">
                Give every digit its own secret letter or symbol. Barcode labels and inventory will show the cost
                price written in these letters, so your staff can read the purchase price but customers can't.
              </p>
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${saved ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
            {saved ? "Active" : "Not set up"}
          </span>
        </div>

        {notice && (
          <div role="status" className={`mt-4 rounded-lg px-4 py-2 text-sm ${notice.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {notice.text}
          </div>
        )}

        <div className="mt-6">
          <label htmlFor="price-code-quick" className="mb-1 block text-sm font-medium text-gray-700">
            Quick fill <span className="font-normal text-gray-400">— type a 10-letter word with no repeated letters</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="price-code-quick"
              value={quick}
              onChange={(e) => { setQuick(e.target.value.toUpperCase()); fillFrom(e.target.value); }}
              placeholder="e.g. COMPUTERSX"
              maxLength={20}
              autoComplete="off"
              className="h-11 w-full max-w-xs rounded-lg border-2 border-gray-200 px-3 font-mono text-base uppercase tracking-widest outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-gray-700">Digit → character</p>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-10" role="group" aria-label="Character for each digit">
            {DIGITS.map((d, i) => {
              const c = slots[i];
              const dup = c && duplicates.has(c);
              return (
                <div key={d} className="flex flex-col items-center">
                  <span className="mb-1 text-xs font-semibold text-gray-500">{d}</span>
                  <input
                    ref={(el) => { boxes.current[i] = el; }}
                    value={c}
                    onChange={(e) => setSlot(i, e.target.value)}
                    onKeyDown={(e) => onBoxKey(i, e)}
                    onPaste={(e) => onBoxPaste(i, e)}
                    onFocus={(e) => e.target.select()}
                    aria-label={`Character for digit ${d}`}
                    aria-invalid={dup || undefined}
                    autoComplete="off"
                    className={`h-12 w-full max-w-[3.25rem] rounded-lg border-2 text-center font-mono text-lg font-bold uppercase outline-none transition
                      ${dup ? "border-red-400 bg-red-50 text-red-700" : c ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-gray-200 bg-white text-gray-900"}
                      focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200`}
                  />
                </div>
              );
            })}
          </div>
          <p className={`mt-2 min-h-[1.25rem] text-sm ${problem ? "text-red-600" : "text-gray-500"}`}>
            {problem || (complete ? "All 10 digits have their own character." : "Letters and symbols only — numbers are not allowed.")}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => save(cipher)}
            disabled={!complete || !changed || saving}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check className="h-4 w-4" /> {saving ? "Saving…" : saved ? "Save changes" : "Save price code"}
          </button>
          {changed && (
            <button
              type="button"
              onClick={() => { setSlots(toSlots(saved)); setQuick(""); }}
              disabled={saving}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              <RotateCcw className="h-4 w-4" /> Undo changes
            </button>
          )}
          {saved && !changed && (
            <button
              type="button"
              onClick={clearCode}
              disabled={saving}
              className="inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" /> Remove price code
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900">Try it</h3>
          <p className="mt-1 text-sm text-gray-500">Cost price in rupees (paise are rounded off).</p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₹</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={tryAmount}
                onChange={(e) => setTryAmount(e.target.value)}
                aria-label="Cost price to encode"
                className="h-11 w-40 rounded-lg border-2 border-gray-200 pl-7 pr-3 outline-none focus:border-indigo-500"
              />
            </div>
            <span className="text-gray-400">→</span>
            <span className="min-w-[6rem] rounded-lg bg-indigo-50 px-4 py-2 font-mono text-xl font-bold tracking-widest text-indigo-700" aria-live="polite">
              {tryCode || "—"}
            </span>
          </div>
          {previewCipher && (
            <table className="mt-5 w-full text-sm">
              <tbody>
                {EXAMPLES.map((n) => (
                  <tr key={n} className="border-t border-gray-100">
                    <td className="py-2 text-gray-600">₹{n.toLocaleString("en-IN")}</td>
                    <td className="py-2 text-right font-mono font-semibold tracking-widest text-gray-900">{encodePriceCode(n, previewCipher)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="flex items-center gap-2 font-semibold text-gray-900"><Info className="h-4 w-4 text-indigo-500" /> How it works</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-600">
            <li>Nobody types a price code while adding stock — it is worked out from each product's cost price.</li>
            <li>It prints on every barcode label (A4 and thermal) and shows next to the cost in Product Inventory and in branch stock.</li>
            <li>Changing the code updates all labels printed from now on. Labels already stuck on products keep the old code, so reprint them if needed.</li>
            <li>Keep it secret: anyone who knows the letters can read your purchase prices.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

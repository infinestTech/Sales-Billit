import * as XLSX from "xlsx";

// Parses supplier tax invoices (Excel/CSV/JSON) shaped like:
// S.No | Code | Product | HSN | MRP | Rate | Qty | T.Value | CGST % | CGST Amt | SGST % | SGST Amt | Total
// plus optional Brand, Model, IMEI, Selling Price, Warranty (months), Warranty Details, Validity.

const ALIASES = {
  sno: ["s.no", "sno", "s no", "sl no", "sl.no", "#", "serial no"],
  productNo: ["code", "product code", "product no", "productno", "item code", "sku", "part no"],
  productName: ["product", "product name", "productname", "item", "item name", "description", "particulars"],
  hsn: ["hsn", "hsn code", "hsn/sac", "hsn sac", "sac"],
  mrp: ["mrp"],
  rate: ["rate", "unit price", "price", "cost price", "costprice", "purchase price"],
  quantity: ["qty", "quantity", "qnty"],
  taxableValue: ["t.value", "t value", "tvalue", "taxable value", "taxable", "taxable amt", "taxable amount"],
  cgstPercent: ["cgst %", "cgst%", "cgst rate", "cgstpercent", "cgst percent"],
  cgstAmount: ["cgst amt", "cgst amount", "cgstamount"],
  sgstPercent: ["sgst %", "sgst%", "sgst rate", "sgstpercent", "sgst percent"],
  sgstAmount: ["sgst amt", "sgst amount", "sgstamount"],
  igstPercent: ["igst %", "igst%", "igst rate", "igstpercent", "igst percent"],
  igstAmount: ["igst amt", "igst amount", "igstamount"],
  total: ["total", "amount", "net amount", "line total", "total amount"],
  sellingPrice: ["selling price", "sellingprice", "sale price", "sp"],
  brand: ["brand", "make"],
  model: ["model", "model no"],
  imei: ["imei", "imeis", "imei numbers", "imei no", "imes"],
  warrantyMonths: ["warranty (months)", "warranty months", "warrantymonths", "warranty"],
  warrantyDetails: ["warranty details", "warrantydetails", "warranty note"],
  validity: ["validity", "expiry", "expiry date", "valid till"],
};

const TAX_GROUPS = { cgst: ["cgstPercent", "cgstAmount"], sgst: ["sgstPercent", "sgstAmount"], igst: ["igstPercent", "igstAmount"] };

// A label either fills the whole cell ("Supplier") with the value in the next cell, or is followed by ":".
const META_LABELS = [
  { key: "supplierName", re: /^(supplier|supplier name|dealer|vendor|sold by)\s*(?::\s*(.*))?$/i },
  { key: "billNo", re: /^(bill\s*no\.?|invoice\s*no\.?|bill number|invoice number)\s*(?::\s*(.*))?$/i },
  { key: "billDate", re: /^(bill date|invoice date|date)\s*(?::\s*(.*))?$/i },
  { key: "billType", re: /^(bill type|payment type|purchase type)\s*(?::\s*(.*))?$/i },
  { key: "supplierGstin", re: /^(gstin|gst\s*no\.?)\s*(?::\s*(.*))?$/i },
];

const normalizeHeader = (h) =>
  String(h ?? "").toLowerCase().replace(/\*/g, "").replace(/[_\s]+/g, " ").trim();

const ALIAS_LOOKUP = Object.entries(ALIASES).reduce((acc, [field, list]) => {
  list.forEach((alias) => { acc[alias] = field; });
  return acc;
}, {});

export function toNumber(v) {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v).replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(n) ? n : 0;
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const text = (v) => (v === null || v === undefined ? "" : String(v).replace(/\s+/g, " ").trim());

function toDateString(v) {
  if (!v) return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = text(v);
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2}|[A-Za-z]{3})[-/.](\d{2,4})$/);
  if (dmy) {
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const m = /^\d+$/.test(dmy[2]) ? Number(dmy[2]) : months.indexOf(dmy[2].toLowerCase()) + 1;
    const y = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    if (m >= 1 && m <= 12) return `${y}-${String(m).padStart(2, "0")}-${String(dmy[1]).padStart(2, "0")}`;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

// Maps a header row to { columnIndex: field }. A bare "CGST" followed by a blank header
// cell is the invoice layout where the group spans "%" and "amount" sub-columns.
function mapHeaderRow(row) {
  const map = {};
  for (let i = 0; i < row.length; i++) {
    const h = normalizeHeader(row[i]);
    if (!h) continue;
    if (TAX_GROUPS[h]) {
      const [pct, amt] = TAX_GROUPS[h];
      if (i + 1 < row.length && !normalizeHeader(row[i + 1])) {
        map[i] = pct;
        map[i + 1] = amt;
        i++;
      } else {
        map[i] = amt;
      }
      continue;
    }
    const field = ALIAS_LOOKUP[h];
    if (field && !Object.values(map).includes(field)) map[i] = field;
  }
  return map;
}

function extractMeta(rows) {
  const meta = {};
  rows.forEach((row) => {
    row.forEach((cell, idx) => {
      const s = text(cell);
      if (!s) return;
      META_LABELS.forEach(({ key, re }) => {
        if (meta[key]) return;
        const m = s.match(re);
        if (!m) return;
        let value = text(m[2]);
        if (!value) {
          const next = row.slice(idx + 1).find((c) => text(c));
          value = next instanceof Date ? toDateString(next) : text(next);
        }
        if (value) meta[key] = value;
      });
    });
  });
  return meta;
}

function buildItem(raw, rowNumber) {
  const quantity = Math.round(toNumber(raw.quantity));
  const total = toNumber(raw.total);
  const taxable = toNumber(raw.taxableValue);
  const taxAmount = toNumber(raw.cgstAmount) + toNumber(raw.sgstAmount) + toNumber(raw.igstAmount);
  let rate = toNumber(raw.rate);
  if (!rate && quantity > 0) rate = total ? total / quantity : (taxable + taxAmount) / quantity;
  const lineTotal = total || rate * quantity;
  const gstAmount = taxAmount || (total && taxable ? total - taxable : 0);
  const gstPercent = toNumber(raw.cgstPercent) + toNumber(raw.sgstPercent) + toNumber(raw.igstPercent);
  const mrp = toNumber(raw.mrp);
  const selling = toNumber(raw.sellingPrice) || mrp;
  const imes = text(raw.imei).split(/[,;\s]+/).filter(Boolean);

  const errors = [];
  if (!text(raw.productName)) errors.push("Product name missing");
  if (!(quantity > 0)) errors.push("Qty must be greater than 0");
  if (imes.length > quantity && quantity > 0) errors.push(`${imes.length} IMEIs for qty ${quantity}`);

  return {
    rowNumber,
    productNo: text(raw.productNo),
    productName: text(raw.productName),
    brand: text(raw.brand),
    model: text(raw.model),
    hsn: text(raw.hsn),
    quantity,
    costPrice: round2(rate),
    sellingPrice: round2(selling),
    mrp: round2(mrp),
    gstPercent: round2(gstPercent),
    gstAmount: round2(gstAmount),
    lineTotal: round2(lineTotal),
    imes,
    warrantyMonths: Math.max(0, Math.round(toNumber(raw.warrantyMonths))),
    warrantyDetails: text(raw.warrantyDetails).slice(0, 300),
    validity: toDateString(raw.validity),
    errors,
  };
}

const SKIP_ROW = /^(sub\s*total|grand\s*total|total|round(ing)?\s*off|amount in words|taxable)/i;

function rowsToItems(rows) {
  let headerIndex = -1;
  let columnMap = null;
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const map = mapHeaderRow(rows[i] || []);
    const fields = Object.values(map);
    if (fields.includes("productName") && fields.includes("quantity")) {
      headerIndex = i;
      columnMap = map;
      break;
    }
  }
  if (headerIndex < 0) {
    throw new Error("Could not find the header row. The sheet needs at least 'Product' and 'Qty' columns (see the template).");
  }

  const meta = extractMeta(rows.slice(0, headerIndex));
  const items = [];
  for (let r = headerIndex + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const raw = {};
    Object.entries(columnMap).forEach(([idx, field]) => { raw[field] = row[idx]; });
    const name = text(raw.productName);
    const hasQty = toNumber(raw.quantity) > 0;
    if (!name && !hasQty) continue;
    if (SKIP_ROW.test(name) || (!name && SKIP_ROW.test(text(row.find((c) => text(c)))))) continue;
    // Product names that wrap onto the next line arrive as rows with only text in the product column
    if (name && !hasQty && !text(raw.productNo) && items.length) {
      const prev = items[items.length - 1].raw;
      prev.productName = `${text(prev.productName)} ${name}`.trim();
      continue;
    }
    items.push({ raw, rowNumber: r + 1 });
  }
  return { meta, items: items.map(({ raw, rowNumber }) => buildItem(raw, rowNumber)) };
}

function objectsToItems(list) {
  return list.map((obj, i) => {
    const raw = {};
    Object.entries(obj || {}).forEach(([k, v]) => {
      const h = normalizeHeader(k);
      const field = ALIAS_LOOKUP[h] || (ALIASES[k] ? k : null);
      if (field && raw[field] === undefined) raw[field] = Array.isArray(v) ? v.join(",") : v;
    });
    return buildItem(raw, i + 1);
  });
}

export function parseJsonText(content) {
  let data;
  try {
    data = JSON.parse(content);
  } catch (e) {
    throw new Error("Invalid JSON: " + e.message);
  }
  const list = Array.isArray(data) ? data : data?.items;
  if (!Array.isArray(list) || list.length === 0) throw new Error("JSON must be an array of items or an object with an 'items' array.");
  const meta = Array.isArray(data) ? {} : {
    supplierName: text(data.supplierName || data.supplier),
    billNo: text(data.billNo || data.invoiceNo),
    billDate: text(data.billDate || data.date),
    billType: text(data.billType),
    supplierGstin: text(data.supplierGstin || data.gstin),
  };
  return { meta, items: objectsToItems(list) };
}

export function parseSheetBuffer(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error("The file has no sheets.");
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "", blankrows: false });
  return rowsToItems(rows);
}

export async function parseInventoryFile(file) {
  const name = (file?.name || "").toLowerCase();
  if (name.endsWith(".json")) return parseJsonText(await file.text());
  if (/\.(xlsx|xls|csv)$/.test(name)) return parseSheetBuffer(await file.arrayBuffer());
  throw new Error("Unsupported file type. Upload .xlsx, .xls, .csv or .json");
}

export function summarize(items) {
  const valid = items.filter((i) => i.errors.length === 0);
  return {
    valid,
    invalid: items.filter((i) => i.errors.length > 0),
    totalQty: valid.reduce((s, i) => s + i.quantity, 0),
    supplierAmount: round2(valid.reduce((s, i) => s + i.lineTotal, 0)),
    gstAmount: round2(valid.reduce((s, i) => s + i.gstAmount, 0)),
  };
}

const TEMPLATE_HEADER = [
  "S.No", "Code", "Product", "HSN", "MRP", "Rate", "Qty", "T.Value",
  "CGST %", "CGST Amt", "SGST %", "SGST Amt", "Total",
  "Brand", "Model", "IMEI", "Selling Price", "Warranty (months)", "Warranty Details", "Validity",
];
const TEMPLATE_ROWS = [
  [1, "POR 2203", "iKonnect C Pro - Type C to 3.5mm Female", "85444999", 0, 149, 5, 631.36, "9%", 56.82, "9%", 56.82, 745, "Portronics", "iKonnect C Pro", "", 199, 6, "Brand warranty", ""],
  [2, "POR 1236", "Konnect B Micro - 1M Micro USB Nylon Braided Cable", "85444999", 499, 66, 10, 559.32, "9%", 50.34, "9%", 50.34, 660, "Portronics", "Konnect B", "", "", 6, "", ""],
];

export function downloadTemplate() {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Supplier", "Finetune Mobiles"],
    ["Bill No", "GST-R-373"],
    ["Bill Date", "19-09-2026"],
    ["Bill Type", "CREDIT"],
    [],
    TEMPLATE_HEADER,
    ...TEMPLATE_ROWS,
  ]);
  sheet["!cols"] = TEMPLATE_HEADER.map((h) => ({ wch: h === "Product" ? 42 : Math.max(10, h.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Inventory");
  XLSX.writeFile(wb, "inventory-import-template.xlsx");
}

export function downloadJsonTemplate() {
  const keys = ["sno", "code", "product", "hsn", "mrp", "rate", "qty", "taxableValue", "cgstPercent", "cgstAmount", "sgstPercent", "sgstAmount", "total", "brand", "model", "imei", "sellingPrice", "warrantyMonths", "warrantyDetails", "validity"];
  const sample = {
    supplierName: "Finetune Mobiles",
    billNo: "GST-R-373",
    billDate: "2026-09-19",
    billType: "CREDIT",
    items: TEMPLATE_ROWS.map((row) => Object.fromEntries(keys.map((k, i) => [k, row[i]]))),
  };
  const blob = new Blob([JSON.stringify(sample, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "inventory-import-template.json";
  a.click();
  URL.revokeObjectURL(url);
}

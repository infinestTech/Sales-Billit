# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

This is a multi-service monorepo for "Billit" / "Infinest" — a mobile-shop billing, sales, and HR/attendance SaaS. It is composed of **three independent Node/Express backends** and **two separate frontends**. There is no root-level orchestrator; each service has its own `package.json` and is started independently.

### Backends (`infinestServer/`)

| Service | Entry | Default port (env) | Datastore | Purpose |
|---|---|---|---|---|
| **CommonDB** | `server_auth.js` | `AUTH_PORT` (7000) | **MySQL via Prisma** | Auth (Google OAuth + JWT), users, subscriptions, plans, payments (Razorpay), product access. This is the identity & billing source of truth. |
| **BillitServer** | `server_Billit.js` | `BILLIT_PORT` | **MongoDB (Mongoose)** | Core billing app: shops, dealers, customers, mobiles, technicians, HR/attendance, eSSL biometric device ingestion (ADMS), WhatsApp bill sending, shop-admin. |
| **SalesServer** | `server_sales.js` | `SALES_PORT` (9000) | **MongoDB (Mongoose)**, shares `BILLIT_MONGO_URI` | Sales/inventory: suppliers, branches, stock, sales, bank txns, supplier credit, WhatsApp-driven sales/stock. |

Note the data split: **CommonDB is MySQL/Prisma; BillitServer and SalesServer are MongoDB/Mongoose** and share the same Mongo instance (`BILLIT_MONGO_URI`). The `infinestServer/{controllers,models,routes,services}` top-level dirs are mostly empty scaffolding — real code lives inside each service subdir.

### Frontends

- **`infinest-frontend/`** — the **main marketing + admin app**. Next.js 15 (App Router, `src/app/`), React 18, Redux Toolkit, Tailwind v3. Talks to backends via `NEXT_PUBLIC_API_URL_BILLIT` and `NEXT_PUBLIC_API_URL_AUTH`. The shop-admin dashboard lives in `src/components/shop-admin/` and is **plan-aware**: `GET /api/shop-admin/product-access` returns `{ service, sales }` (combo = both) and the sidebar/overview/HR render accordingly. Navigation is defined once in `shopAdminNav.js` and shared by the desktop sidebar and `MobileDashboard.jsx` (rendered below 1024px: bottom tabs Home/Service/Sales/HR, section hubs, a drawer mirroring the sidebar, and a Settings screen for revenue visibility, receipt T&C and the biometric device) — add new sections there so both layouts get them. Sales admin screens (ported from sales-frontend) live in `src/components/shop-admin/sales/`, styled by `salesScope.css` (sales-frontend `styles.css` with every rule prefixed by `.sales-scope`), and call SalesServer (`NEXT_PUBLIC_API_URL_SALES`) with a token from `POST /api/shop-admin/sales/token`.
- **`sales-frontend/`** — a **standalone sales POS UI for branch staff only** (the owner/admin portal moved into shop-admin; admin login now shows a "moved" screen linking to `VITE_SHOP_ADMIN_URL`). React + TypeScript (`src/App.tsx`). It is **not Next.js and not bundled** at dev time: `server.js` is a hand-rolled static file server (default port **3020**) that serves raw files and injects runtime config at `/src/config/env.js` from env vars (`VITE_SALES_API_URL`, `VITE_AUTH_API_URL`, `VITE_WHATSAPP_WEB_URL`). `npm run build` (`build.js`) just copies files into `dist/`. Client reads config from `window.ENV_CONFIG` / `window.SALES_URL`.

### Inter-service auth (two distinct mechanisms)

1. **User-facing JWT** — issued by CommonDB on login; verified by each service (`JWT_SECRET`, `JWT_ISSUER`). Shop-admin uses a separate `SHOP_ADMIN_JWT_SECRET`.
2. **Internal service-to-service key** — header `x-internal-key` checked against `INTERNAL_API_KEY` (see `CommonDB/middleware/internalAuth.js`). Used for server→server calls (e.g. plan-limit sync, feature lookups). When adding cross-service endpoints, follow the existing pattern of guarding with `internalAuth`/`authMySQLToken`.
3. **Shop-admin → Sales** — BillitServer resolves the shop's plan via CommonDB `GET /internal-user-product-access/:userId`, then asks SalesServer `POST /internal/shop-admin-token` (internal key) to sign a 12h Sales JWT for that shop. BillitServer needs `SALES_SERVER_URL`; SalesServer CORS needs the main frontend origin (`MAIN_FRONTEND_URL`).

4. **Service portal → Sales branch portal (combo only)** — `SwitchToSalesButton` (rendered by `app/(main)/layout.jsx`) asks `GET /api/shop-admin/sso/from-service/eligible`; `POST /api/shop-admin/sso/from-service` (Service JWT; optional `branch_id`, a multi-branch shop picks one first) lists branches via SalesServer `GET /internal/shop-branches` and gets a 60s single-use code from `POST /internal/branch-sso-code` (internal key). The browser opens `NEXT_PUBLIC_SALES_FRONTEND_URL/?sso=<code>#product-sales`; `sales-frontend/main.jsx` swaps it via `POST /auth/branch-sso` for a normal 2h `branch_token` (no branch password) carrying `via: 'service'`.
5. **Sales branch portal → Service portal** — `SwitchToServiceButton` (desktop `HeaderBar` / mobile header `actions`) shows for every **combo-plan** shop: it asks SalesServer `GET /api/service-switch` (`available` = CommonDB `/internal-user-product-access` says service + sales; `instant` = branch token with `via: 'service'`). Instant: SalesServer `POST /api/service-sso` signs a 60s single-use code with `INTERNAL_API_KEY + ':service-sso'`; the browser opens `SERVICE_APP_URL/service-sso?code=` (sales-frontend runtime config, env `VITE_SERVICE_APP_URL`), and that page posts it to BillitServer `POST /api/service-sso` (authRoutes), which re-checks the combo plan and issues the normal Service JWT + session, then opens `/application`. Branch-password sessions are not instant: the button opens `SERVICE_APP_URL/billit-login` so the owner signs in (staff never get the owner's Service session).

HR employees carry `business_unit` (`service` | `sales`; missing = service). HR endpoints accept `?unit=` (and `unit` in bulk-salary body) to scope combo shops.

### Supplier bill import (Excel / CSV / JSON)

- One parser for both portals: `infinest-frontend/src/components/shop-admin/sales/inventoryImport.js`. A file can hold several bills (one Excel sheet per bill, README/Summary sheets skipped; or a JSON array of invoices). `normalizeProductCodes` splits supplier codes reused for different products ("TWS" → "TWS-XXXX"). There is no price code column: price codes are derived from the cost price (see below). Legacy `priceCode` values stored on `InStock.items` / `BranchStock` / `BranchSupply.items` are no longer shown or printed.
- The branch portal uses a generated browser copy, `sales-frontend/src/utils/inventoryImport.js` (SheetJS from CDN in `index.html`). After editing the shop-admin parser run `node scripts/sync-shared.js` in `sales-frontend`.
- Shop-admin import → master inventory (`POST /api/in-stock`). Branch import (`BranchStockImport.jsx`) → branch stock via `POST /api/branch-supply` with `source: 'import'`: one `BranchSupply` per bill (`billNo`, `billDate`, `purchaseType`), codes the branch already bought are topped up (`branch_*` productIds only, never head-office rows), and credit bills create a `SupplierCredit` with `branchSupply_id`. Admin Supply History shows `source` = `supply` (sent from inventory), `import`, or `manual`.

### Barcode labels & POS scanning

- One helper for both portals: `infinest-frontend/src/components/shop-admin/sales/barcodeLabels.js` (branch copy `sales-frontend/src/utils/barcodeLabels.js`, generated by `node scripts/sync-shared.js`). `BarcodeSheet.jsx` (both copies) offers "A4 sheet" (2×4 layout, `buildA4Pdf`) and "Thermal label" (`buildThermalPdf`: one label per PDF page, size in localStorage `barcodeLabels.thermal`, Code 128 bars snapped to whole 203 DPI printer dots ≥ 0.25 mm, aspect ratio kept). The sheet has a search (name, product code or IMEI — an IMEI hit prints only the matching phones), an All/Mobiles/Accessories switch and a product picker: ticked products print on their own (otherwise everything matching), accessories set their label count there, and "Only this" downloads one product immediately. Every label (PDFs and preview) reads: shop name, `shortTitle` (first two words of the product name + ".."), bars, then `labelCodeLines` — IMEI (phones only), product code, price code.
- **Price code** — the encoded cost price, never entered by users. The cipher is set in the **branch portal** (Inventory → Price Code, `sales-frontend/src/views/PriceCodeSettings.jsx`, hash `#price-code`; SalesServer `PATCH /api/shop-info/price-cipher`, validated by SalesServer `utils/priceCipher.js`) — shop-admin no longer has this screen. One distinct non-digit character per digit in the order 1234567890, stored shop-wide as a 10-char string in `Shop.sales_settings.price_cipher`; SalesServer returns it as `priceCipher` from `GET /api/shop-info`. `encodePriceCode(costPrice, cipher)` (barcodeLabels.js; rupees rounded, plain digit-for-character swap) is applied when labels are built (`BarcodeSheet` sets `item.priceCode`) and under the cost column of shop-admin `InStockView` and branch `BranchInStock` — so changing the cipher changes every code. With no cipher, `BarcodeSheet` shows a warning and asks before downloading; its "Set up price code" goes to `#price-code` in the branch portal, or from shop-admin opens `NEXT_PUBLIC_SALES_FRONTEND_URL/#price-code` in a new tab.
- Barcodes encode the exact product number / IMEI (spaces and hyphens included). POS lookups use `resolvePosScan` / `findScanMatch`: exact match first, then a fallback ignoring case and non-alphanumerics so labels printed before the fix ("POR2203") still scan.

### POS payments & sale receipts (branch portal)

- Payment methods are **Cash, Gpay, Card and their combinations** (`Cash + Gpay`, `Cash + Card`, `Gpay + Card`, `Cash + Gpay + Card`). One list on each side: SalesServer `utils/paymentSplits.js` (`parsePayment` validates a sale) and `sales-frontend/src/components/PaymentSplitInput.jsx` (`window.SalesPayments`, `usePaymentSplit(total)` hook, `<PaymentSplitInput>`; also sets `window.__PAYMENT_METHODS__` for the expense forms). Older labels (`Gpay-H`, `Gpay S + CASH`, …) stay valid on existing records only.
- For a combination the cashier enters the amount per mode; the field not just typed in auto-fills with the remainder. Sales (`Sale`) and WhatsApp-stock sales (`WhatsappSale`) store `paymentSplits: [{ method, amount }]` summing to `totalAmount` (server absorbs ≤ ₹1 rounding into the last split) and `amountPaid`. Sales analytics `byPayment` totals per mode from the splits (older sales fall back to their label).
- Receipt: `sales-frontend/src/utils/salesReceipt.js` (`window.SalesReceipt.loadShop/buildHtml/print`) builds the 80 mm "Tax Invoice" used by ProductSales, MobileProductSales and ProductSell — branch name/address/phone/GSTIN (state derived from the GSTIN's first two digits), shop email, party name, date, `invoiceNo`, items with HSN/IMEI lines, Total / Received / Balance. `Sale.invoiceNo` is sequential per branch (`models/counter.js`, key `sale_invoice:<shop>:<branch>`, seeded from the branch's existing sale count). HSN comes from `BranchStock.hsn` (set on supply/import, backfilled from central `InStock`) and is snapshotted on `Sale.items[].hsn`.

### No selling price; financial report

- **Stock carries only a cost price** (shown as the price code to staff). Stock entry, bill import (both portals), Branch Supply and branch inventory have no selling price/markup; supplies and stock value are cost × qty, and SalesServer strips legacy `sellingPrice` from `/api/branch-stock` rows (`stockRows` in `branchSupplyController.js`). The POS cart starts each product's Unit Price at its cost; the salesperson edits it, and `Sale.items[].sellingPrice` is the price actually sold at, next to the `costPrice` snapshot (WhatsApp sales snapshot cost too).
- **Financial Report** (shop-admin nav item `report`, `FinancialReport.jsx`, plan-aware): sales only → Sales; service only → the existing service report (`serviceReportView` in `page.jsx` / `MobileDashboard.jsx`); combo → Sales / Service / Sales + Service. Filters: period, branch, salesperson, payment mode; PDF (jspdf-autotable) and Excel exports.
- Sales numbers: SalesServer `controllers/financialReportController.js` (`/api/financial-report`, `/internal/financial-report`) via BillitServer `GET /api/shop-admin/reports/sales-financial`. Sales profit = sold for (after discount, before GST) − cost; Net profit = sales profit − expenses (`BranchExpense`); dealer payments (`SupplierCredit.payments`) are cash flow only: Net cash flow = billed − dealer payments − expenses − second-hand phones bought. Sales without a cost snapshot fall back to the current branch stock cost; items with no cost at all are flagged.

### Dealers & dealer credits (branch portal)

- **Dealers** (`#supplier`, `sales-frontend/src/views/CreateSupplier.jsx`, used on desktop and mobile; styles in `src/utils/dealerUi.js`, classes `dl-`): list with balances, search/filter, and an "Add dealer" drawer. `POST /api/suppliers` accepts `openingCredit` (credit owed before using the app): stored on `Supplier.openingCredit` and recorded as a `SupplierCredit` with `kind: 'opening'`.
- **Dealer Credits** (`#dealer-credits`, `src/views/DealerCredits.jsx`, sidebar → Financial): SalesServer `controllers/dealerLedgerController.js` — `GET /api/dealer-ledger` (per-dealer totals + paid today), `GET /api/dealer-ledger/:supplierId` (bills, payments grouped per payment, running-balance statement), `POST /api/dealer-ledger/:supplierId/pay { amount, method, paidOn, note }`. A payment settles bills oldest first (opening credit, then purchases by date) — one `payments[]` entry per bill, sharing a `batch` id. Branch tokens are scoped to their own `branch_id`. Credit bills come from branch purchases marked "credit" (`POST /api/branch-supply`).

### WhatsApp billing for sales (MSG91) & the A4 sales invoice PDF

- **PDF** — BillitServer renders the A4 tax invoice for a branch-portal sale (`utils/salesInvoicePdf.js`, pdfkit + the Noto Sans ₹ font shared with the service receipt). It reads SalesServer's `sales` / `salesbranches` collections through read-only models (`models/salesRefs.js`). The PDF is public at `GET /api/sales-invoice/pdf/:id?sig=` (MSG91 downloads it); `sig` is an HMAC of the sale id with `INTERNAL_API_KEY`, computed identically by `utils/salesInvoiceLink.js` in both services. The POS "A4" button opens it via SalesServer `GET /api/sales/:id/invoice-link`, which asks BillitServer `GET /api/internal/sales-invoice/link/:id` (internal key) so the URL uses BillitServer's public `BILLIT_BACKEND_URL`, never SalesServer's internal one (`sales-frontend/src/utils/salesWhatsapp.js`; if popups are blocked it shows the PDF in the page's preview modal).
- **Send** — POS → SalesServer `POST /api/sales/:id/whatsapp` (branch token, own sale only) → BillitServer `POST /api/internal/sales-bill/whatsapp` (`x-internal-key`) → `sendWaEvent` with event `sales_bill`, the PDF as the template's document header. The template defaults to the service's delivered-receipt template (`MSG91_TPL_DELIVERED`, same 10 body placeholders — see `controllers/api/salesInvoiceController.js`); set `MSG91_TPL_SALES_BILL` to use a dedicated one. Every attempt is logged in `WhatsAppLog`, so it appears in the admin logs and per-shop WhatsApp invoice.
- **On/off** — super-admin dashboard → WhatsApp tab → per shop: master switch + "Sales bill — PDF invoice" (`Shop.whatsapp.events.sales_bill`). `sales_bill` is **opt-in** (`OPT_IN_EVENTS` in `utils/msg91Whatsapp.js`: missing = off). The POS reads `GET /api/sales/whatsapp-config`; when on it sends automatically after each sale and its WhatsApp button becomes "Send Bill" (resend); when off the button keeps the old web.whatsapp.com text share.
- SalesServer needs `BILLIT_BACKEND_URL` (BillitServer base URL, default `http://127.0.0.1:8000`); BillitServer's `BILLIT_BACKEND_URL` must be publicly reachable for MSG91 to fetch the PDF.

### Employee performance & business analytics (one system across services)

- **Employee code** — `Employee.employee_code` (unique per shop, auto `EMP###`, legacy rows backfilled on list; `utils/employeeCodes.js`). It is the join key everywhere.
- **Sales attribution** — the POS (`sales-frontend` `EmployeeCodeInput` used by ProductSales / MobileProductSales / ProductSell) shows a searchable "Sales Executive" dropdown (name, designation, code; list from `GET /api/employees`) and sends the chosen `employeeCode`; SalesServer resolves it read-only from the shared `employees` collection (`models/employeeRef.js`) and stores `employee_id/code/name` on `Sale`/`WhatsappSale`, plus a `costPrice` snapshot per item for profit. `Shop.sales_settings.require_employee_code` (toggled in shop-admin Performance) makes it mandatory.
- **Service attribution** — repair jobs are credited when `Mobile.technician_name` equals an employee's code or name (case-insensitive; `utils/servicePerformance.js`).
- **Analytics** — SalesServer aggregates sales (`/api/sales-analytics/*` for tokens, `/internal/sales-analytics/*` with `x-internal-key`). BillitServer combines them with attendance and service in `controllers/performanceController.js`: `GET /api/shop-admin/hr/performance[/:id]`, `GET /api/shop-admin/analytics/business` (sales + service P&L), `GET|PATCH /api/shop-admin/shop-settings/pos`. If SalesServer is unreachable these return `warnings` instead of failing.
- **Payroll** — `Employee.incentive` (sales/service commission %, monthly sales target + bonus) is added to `net_salary` during salary generation (`sales_commission`, `service_commission`, `target_bonus_earned`, `incentive_total` on `HrSalaryRecord`).

### Service suppliers: credit, stock bills & settlement (BillitServer)

- `Supplier.totalAmount` is the credit balance shown in both portals. Shop-admin adds `openingCredit` (optional; when set, the products behind it are required and must total it exactly), credit/cash purchases and payments (`/api/shop-admin/suppliers/:id/{ledger,purchases,pay}`).
- Bill items go into the service spares inventory (`Product` + `ProductHistory`, linked by `supplierId`) and are recorded as a `SupplierPurchase` (`models/supplierPurchase.js`). Payments are logged in `SupplierHistory` like the user portal's Pay Credit.
- `utils/supplierLedger.js` builds the ledger: settlement is oldest-first (outstanding balance belongs to the newest credit purchases), and also covers user-portal credit spares and repair credits (`Added: <name> x<qty> - ₹<amt>` history messages). Usage on repairs is matched by `Mobile.productName`.
- `supplierController.updateSupplier` skips the repair flow's credit increment when the spare was just taken from stock (recent `SELL`), so stock isn't charged twice.

### Request-ordering gotchas in BillitServer (`server_Billit.js`)

- `webhookRoutes` (Razorpay) and `admsRoutes` (eSSL device) are mounted **before `express.json()`** because they need the raw/text body (signature verification and plain-text device payloads respectively). Do not move `express.json()` above them.
- `app.set('trust proxy', 1)` is set for `express-rate-limit` behind nginx.

### Other conventions

- Axios is configured to **force IPv4** (`axios.create({ family: 4 })`) across services to avoid IPv6 localhost resolution issues; CommonDB additionally rewrites `https→http` for localhost. Use the shared `utils/axiosConfig` where present rather than raw axios.
- SalesServer accepts large JSON bodies (`EXPRESS_JSON_LIMIT`, default 50mb) for base64 file uploads and serves `/uploads` statically.
- Routes are registered imperatively inside each service's `routes/*.js` (e.g. BillitServer's `apiRoutes.js` is the central mount point); add new endpoints there.

## Common commands

```bash
# CommonDB (MySQL/Prisma) — run from infinestServer/CommonDB
npm start                      # node server_auth.js
npm run db:push                # prisma db push  (apply schema.prisma)
npm run db:generate            # prisma generate
npm run db:seed:plans          # seed subscription plans
npm run create:demo-user
# backfills: db:backfill:sales, db:backfill:sales:from-plan

# BillitServer (MongoDB) — run from infinestServer/BillitServer
npm start                      # node server_Billit.js

# SalesServer (MongoDB) — run from infinestServer/SalesServer
npm run dev                    # nodemon server_sales.js
npm start                      # node server_sales.js

# infinest-frontend (Next.js) — run from infinest-frontend
npm run dev                    # next dev (port 3000)
npm run build && npm start
npm run lint                   # next lint / eslint

# sales-frontend (static React/TS) — run from sales-frontend
npm run dev                    # node server.js (port 3020)
npm run build                  # build.js -> dist/
npm run prod                   # build + start
```

There is **no test suite** (BillitServer's `npm test` is a placeholder that exits 1). `BillitServer/test-bill-numbers.js` and `verifyPlans.js` are standalone scripts, not a test runner.

## Database changes

The Prisma schema is **only** `infinestServer/CommonDB/prisma/schema.prisma` (MySQL: `User`, `Subscription`, `Plan`, `Payment`, `ProductAccess`, `SubscriptionLog`). After editing it, run `npm run db:push` and `npm run db:generate` from `CommonDB`. The Mongo schemas are plain Mongoose models — BillitServer's are centralized in `models/mongoModels.js`; SalesServer has one file per model in `models/`.

## Key environment variables

Backends: `AUTH_PORT`, `BILLIT_PORT`, `SALES_PORT`, `DATABASE_URL` (MySQL), `BILLIT_MONGO_URI`, `JWT_SECRET`, `JWT_ISSUER`, `SHOP_ADMIN_JWT_SECRET`, `INTERNAL_API_KEY`, `GOOGLE_CLIENT_ID/SECRET`, `RAZORPAY_KEY_ID/KEY_SECRET/WEBHOOK_SECRET`, `ADMS_DEVICE_SECRET`, `*_SERVER_URL`/`*_BACKEND_URL`/`FRONTEND_URL` for CORS and callbacks.

Frontend (infinest): `NEXT_PUBLIC_API_URL_BILLIT`, `NEXT_PUBLIC_API_URL_AUTH`, `NEXT_PUBLIC_SALES_FRONTEND_URL`, `NEXT_PUBLIC_INTERNAL_API_KEY`. Frontend (sales): `VITE_SALES_API_URL`, `VITE_AUTH_API_URL`, `VITE_WHATSAPP_WEB_URL`.

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

- **`infinest-frontend/`** — the **main marketing + admin app**. Next.js 15 (App Router, `src/app/`), React 18, Redux Toolkit, Tailwind v3. Talks to backends via `NEXT_PUBLIC_API_URL_BILLIT` and `NEXT_PUBLIC_API_URL_AUTH`. The shop-admin dashboard lives in `src/components/shop-admin/` and is **plan-aware**: `GET /api/shop-admin/product-access` returns `{ service, sales }` (combo = both) and the sidebar/overview/HR render accordingly. Sales admin screens (ported from sales-frontend) live in `src/components/shop-admin/sales/`, styled by `salesScope.css` (sales-frontend `styles.css` with every rule prefixed by `.sales-scope`), and call SalesServer (`NEXT_PUBLIC_API_URL_SALES`) with a token from `POST /api/shop-admin/sales/token`.
- **`sales-frontend/`** — a **standalone sales POS UI for branch staff only** (the owner/admin portal moved into shop-admin; admin login now shows a "moved" screen linking to `VITE_SHOP_ADMIN_URL`). React + TypeScript (`src/App.tsx`). It is **not Next.js and not bundled** at dev time: `server.js` is a hand-rolled static file server (default port **3020**) that serves raw files and injects runtime config at `/src/config/env.js` from env vars (`VITE_SALES_API_URL`, `VITE_AUTH_API_URL`, `VITE_WHATSAPP_WEB_URL`). `npm run build` (`build.js`) just copies files into `dist/`. Client reads config from `window.ENV_CONFIG` / `window.SALES_URL`.

### Inter-service auth (two distinct mechanisms)

1. **User-facing JWT** — issued by CommonDB on login; verified by each service (`JWT_SECRET`, `JWT_ISSUER`). Shop-admin uses a separate `SHOP_ADMIN_JWT_SECRET`.
2. **Internal service-to-service key** — header `x-internal-key` checked against `INTERNAL_API_KEY` (see `CommonDB/middleware/internalAuth.js`). Used for server→server calls (e.g. plan-limit sync, feature lookups). When adding cross-service endpoints, follow the existing pattern of guarding with `internalAuth`/`authMySQLToken`.
3. **Shop-admin → Sales** — BillitServer resolves the shop's plan via CommonDB `GET /internal-user-product-access/:userId`, then asks SalesServer `POST /internal/shop-admin-token` (internal key) to sign a 12h Sales JWT for that shop. BillitServer needs `SALES_SERVER_URL`; SalesServer CORS needs the main frontend origin (`MAIN_FRONTEND_URL`).

HR employees carry `business_unit` (`service` | `sales`; missing = service). HR endpoints accept `?unit=` (and `unit` in bulk-salary body) to scope combo shops.

### Supplier bill import (Excel / CSV / JSON)

- One parser for both portals: `infinest-frontend/src/components/shop-admin/sales/inventoryImport.js`. A file can hold several bills (one Excel sheet per bill, README/Summary sheets skipped; or a JSON array of invoices). `normalizeProductCodes` splits supplier codes reused for different products ("TWS" → "TWS-XXXX").
- The branch portal uses a generated browser copy, `sales-frontend/src/utils/inventoryImport.js` (SheetJS from CDN in `index.html`). After editing the shop-admin parser run `node scripts/sync-inventory-import.js` in `sales-frontend`.
- Shop-admin import → master inventory (`POST /api/in-stock`). Branch import (`BranchStockImport.jsx`) → branch stock via `POST /api/branch-supply` with `source: 'import'`: one `BranchSupply` per bill (`billNo`, `billDate`, `purchaseType`), codes the branch already bought are topped up (`branch_*` productIds only, never head-office rows), and credit bills create a `SupplierCredit` with `branchSupply_id`. Admin Supply History shows `source` = `supply` (sent from inventory), `import`, or `manual`.

### Employee performance & business analytics (one system across services)

- **Employee code** — `Employee.employee_code` (unique per shop, auto `EMP###`, legacy rows backfilled on list; `utils/employeeCodes.js`). It is the join key everywhere.
- **Sales attribution** — the POS (`sales-frontend` `EmployeeCodeInput` used by ProductSales / MobileProductSales / ProductSell) sends `employeeCode`; SalesServer resolves it read-only from the shared `employees` collection (`models/employeeRef.js`) and stores `employee_id/code/name` on `Sale`/`WhatsappSale`, plus a `costPrice` snapshot per item for profit. `Shop.sales_settings.require_employee_code` (toggled in shop-admin Performance) makes it mandatory.
- **Service attribution** — repair jobs are credited when `Mobile.technician_name` equals an employee's code or name (case-insensitive; `utils/servicePerformance.js`).
- **Analytics** — SalesServer aggregates sales (`/api/sales-analytics/*` for tokens, `/internal/sales-analytics/*` with `x-internal-key`). BillitServer combines them with attendance and service in `controllers/performanceController.js`: `GET /api/shop-admin/hr/performance[/:id]`, `GET /api/shop-admin/analytics/business` (sales + service P&L), `GET|PATCH /api/shop-admin/shop-settings/pos`. If SalesServer is unreachable these return `warnings` instead of failing.
- **Payroll** — `Employee.incentive` (sales/service commission %, monthly sales target + bonus) is added to `net_salary` during salary generation (`sales_commission`, `service_commission`, `target_bonus_earned`, `incentive_total` on `HrSalaryRecord`).

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

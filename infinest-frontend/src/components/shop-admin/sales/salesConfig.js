// NEXT_PUBLIC_* is inlined at build time. Never fall back to localhost in a production build:
// a public page calling 127.0.0.1 is blocked by the browser (shows up as a CORS / ERR_FAILED error).
const FALLBACK = process.env.NODE_ENV === "production" ? "https://sales.mobilebillingsoftware.com" : "http://127.0.0.1:9000";
export const SALES_API_URL = (process.env.NEXT_PUBLIC_API_URL_SALES || FALLBACK).replace(/\/+$/, "");

import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Get today's date as YYYY-MM-DD in the browser's local timezone (IST for Indian users).
 * Unlike toISOString().split('T')[0], this won't show yesterday's date after midnight IST.
 */
export function getLocalDateString(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

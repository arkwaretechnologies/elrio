import { format } from "date-fns";

/** Firestore path segment: stores/{storeId}/dailyCounters/{yyyy-MM-dd} */
export function dailyCounterDocId(date: Date = new Date()): string {
  return format(date, "yyyy-MM-dd");
}

export function formatPickupNumber(n: number | undefined | null): string {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 1) return "—";
  return String(Math.floor(n));
}

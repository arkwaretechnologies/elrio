/** Random 7-digit integer (1_000_000 … 9_999_999), stored on each order/sale. */
export function generateOrderNumber(): number {
  return Math.floor(1_000_000 + Math.random() * 9_000_000);
}

/** Stable 7-digit numeric fallback from Firestore id for legacy rows without `orderNumber`. */
export function legacyNumericOrderFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return 1_000_000 + (h % 9_000_000);
}

/** Display as exactly 7 digits (leading zeros if needed). */
export function formatOrderNumberDisplay(orderNumber: number): string {
  const mod = Math.floor(Math.abs(orderNumber)) % 10_000_000;
  return String(mod).padStart(7, "0");
}

/**
 * Prefer stored numeric order number; otherwise derive from Firestore id so UI always shows 7 digits.
 */
export function displayOrderNumber(stored: number | undefined | null, firestoreId: string): string {
  const n =
    typeof stored === "number" && Number.isFinite(stored) && stored >= 0
      ? stored
      : legacyNumericOrderFromId(firestoreId);
  return formatOrderNumberDisplay(n);
}

/** Queue-only dismissals (Firestore docs unchanged). */

function storageKeyPaid(storeId: string): string {
  return `elrio-queue-dismiss-paid:${storeId}`;
}

function storageKeyUnpaid(storeId: string): string {
  return `elrio-queue-dismiss-unpaid:${storeId}`;
}

export function loadDismissedPaidSaleIds(storeId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(storageKeyPaid(storeId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

export function saveDismissedPaidSaleIds(storeId: string, ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKeyPaid(storeId), JSON.stringify([...ids]));
  } catch {
    /* quota */
  }
}

/** Open (unpaid) holds hidden from queue only — order stays active. */
export function loadDismissedOpenOrderIds(storeId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(storageKeyUnpaid(storeId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

export function saveDismissedOpenOrderIds(storeId: string, ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKeyUnpaid(storeId), JSON.stringify([...ids]));
  } catch {
    /* quota */
  }
}

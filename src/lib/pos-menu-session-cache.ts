import type { BaseProduct, Category, MenuItem } from "@/lib/types";

const KEY_PREFIX = "elrio-pos-menu-v1:";

export type PosMenuSessionPayload = {
  baseProducts: BaseProduct[];
  categories: Category[];
  menuItems: MenuItem[];
};

/** ~4.5MB safety margin under typical sessionStorage limits */
const MAX_BYTES = 4_500_000;

export function readPosMenuSessionCache(storeId: string): PosMenuSessionPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY_PREFIX + storeId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: number; data?: PosMenuSessionPayload };
    if (parsed.v !== 1 || !parsed.data?.baseProducts || !parsed.data?.categories) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function writePosMenuSessionCache(storeId: string, data: PosMenuSessionPayload): void {
  if (typeof window === "undefined") return;
  try {
    const payload = JSON.stringify({ v: 1, data });
    if (payload.length > MAX_BYTES) {
      console.warn("[POS] Menu cache skipped: payload too large for sessionStorage");
      return;
    }
    sessionStorage.setItem(KEY_PREFIX + storeId, payload);
  } catch (e) {
    console.warn("[POS] Menu cache write failed", e);
  }
}

export function clearPosMenuSessionCache(storeId: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY_PREFIX + storeId);
  } catch {
    /* noop */
  }
}

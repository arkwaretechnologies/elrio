import type { Sale } from "@/lib/types";

/** Latest non-voided sale for a floor-plan table (e.g. paid dine-in still seated). */
export function latestCompletedSaleForTable(sales: Sale[], tableId: string): Sale | undefined {
  const matches = sales.filter(
    (s) =>
      s.status !== "VOIDED" &&
      s.tableId != null &&
      String(s.tableId) === String(tableId),
  );
  if (matches.length === 0) return undefined;
  return matches.reduce((a, b) =>
    a.createdAt.getTime() >= b.createdAt.getTime() ? a : b,
  );
}

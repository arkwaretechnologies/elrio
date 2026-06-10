import type { OpenOrder, Sale } from "@/lib/types";

/** Badge label for open orders: explicit service type, else infer from table. */
export function openOrderServiceLabel(o: OpenOrder): "dine-in" | "takeout" {
  if (o.serviceType === "dine-in" || o.serviceType === "takeout") return o.serviceType;
  return o.tableId || o.tableLabel ? "dine-in" : "takeout";
}

/** Badge label for completed sales. */
export function saleServiceLabel(s: Sale): "dine-in" | "takeout" {
  if (s.serviceType === "dine-in" || s.serviceType === "takeout") return s.serviceType;
  return s.tableId || s.tableLabel ? "dine-in" : "takeout";
}

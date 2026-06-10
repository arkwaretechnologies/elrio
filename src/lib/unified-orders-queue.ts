import type { Sale } from "@/lib/types";
import { startOfDay, endOfDay, isWithinInterval } from "date-fns";
import type { DateRange } from "react-day-picker";

export type FulfillmentQueueItem = {
  createdAt: Date;
  sale: Sale;
};

/** Completed sales in range (excludes voided). When `date` is unset, all non-voided sales. */
export function filterPaidSalesInRange(sales: Sale[], date: DateRange | undefined): Sale[] {
  const active = sales.filter((s) => s.status !== "VOIDED");
  if (!date?.from) return active;
  const from = startOfDay(date.from);
  const to = date.to ? endOfDay(date.to) : endOfDay(date.from);
  return active.filter((s) =>
    isWithinInterval(new Date(s.createdAt), { start: from, end: to }),
  );
}

/** Oldest first — kitchen fulfillment queue by when the order was created. */
export function buildFulfillmentQueue(paidSalesInRange: Sale[]): FulfillmentQueueItem[] {
  return paidSalesInRange
    .map((s) => ({ createdAt: s.createdAt, sale: s }))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

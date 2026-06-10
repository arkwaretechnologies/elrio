"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { floorPlanTableSize, type FloorPlanTable, type OpenOrder, type Sale } from "@/lib/types";
import { latestCompletedSaleForTable } from "@/lib/table-sale";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { displayOrderNumber } from "@/lib/order-number";

function openOrderForTable(openOrders: OpenOrder[] | undefined, tableId: string): OpenOrder | undefined {
  if (!openOrders?.length) return undefined;
  return openOrders.find((o) => o.tableId != null && String(o.tableId) === String(tableId));
}

export function PosFloorPlan({
  storeId,
  selectedTableId,
  onSelectTable,
  onClearTakeout,
  openOrders,
  tableSales,
}: {
  storeId: string;
  selectedTableId: string | null;
  onSelectTable: (t: FloorPlanTable) => void;
  onClearTakeout: () => void;
  /** When set, tables with an unpaid order show as occupied (IDs from held orders). */
  openOrders?: OpenOrder[];
  /** Completed sales today with a table — paid dine-in guests still at the table. */
  tableSales?: Sale[];
}) {
  const [tables, setTables] = useState<FloorPlanTable[]>([]);

  useEffect(() => {
    const ref = doc(db, "stores", storeId);
    const unsub = onSnapshot(ref, (snap) => {
      const raw = snap.data()?.floorPlanTables;
      setTables(Array.isArray(raw) ? (raw as FloorPlanTable[]) : []);
    });
    return () => unsub();
  }, [storeId]);

  if (tables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center text-muted-foreground">
        <p className="font-medium text-foreground">No tables configured</p>
        <p className="mt-2 max-w-sm text-sm">
          Ask an admin to set up the floor plan under Super Admin → Table / Floor plan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Tap a table for this order. Optional — use Takeout if not dining in.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onClearTakeout}>
          Takeout / clear table
        </Button>
      </div>
      <div className="relative mx-auto min-h-[min(70vh,520px)] w-full rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/20">
        {tables.map((t) => {
          const selected = selectedTableId === t.id;
          const held = openOrderForTable(openOrders, t.id);
          const paidAtTable =
            !held && tableSales?.length
              ? latestCompletedSaleForTable(tableSales, t.id)
              : undefined;
          const { widthPct, heightPct } = floorPlanTableSize(t);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTable(t)}
              className={cn(
                "absolute box-border flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg border-2 px-1.5 py-1 text-sm font-semibold shadow-sm transition-colors",
                selected
                  ? "border-primary bg-primary text-primary-foreground ring-2 ring-primary/30"
                  : held
                      ? "border-amber-500 bg-amber-100 text-amber-950 hover:bg-amber-200/90 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-50 dark:hover:bg-amber-900"
                      : paidAtTable
                        ? "border-sky-500 bg-sky-100 text-sky-950 hover:bg-sky-200/90 dark:border-sky-600 dark:bg-sky-950 dark:text-sky-50 dark:hover:bg-sky-900"
                        : "border-border bg-card hover:bg-accent",
              )}
              style={{
                left: `${t.xPct}%`,
                top: `${t.yPct}%`,
                width: `${widthPct}%`,
                height: `${heightPct}%`,
                minWidth: 72,
                minHeight: 44,
              }}
            >
              <span className="line-clamp-2 w-full px-0.5 text-center leading-tight">{t.label}</span>
              {held ? (
                <>
                  <span
                    className={cn(
                      "max-w-full truncate px-0.5 font-mono text-[10px] font-normal leading-none",
                      selected ? "text-primary-foreground/90" : "text-amber-900 dark:text-amber-100",
                    )}
                    title={`Order #${displayOrderNumber(held.orderNumber, held.id)}`}
                  >
                    {displayOrderNumber(held.orderNumber, held.id)}
                  </span>
                  <span
                    className={cn(
                      "text-[9px] font-bold uppercase tracking-wide leading-none",
                      selected ? "text-primary-foreground/85" : "text-amber-800 dark:text-amber-200",
                    )}
                  >
                    Occupied
                  </span>
                </>
              ) : paidAtTable ? (
                <>
                  <span
                    className={cn(
                      "max-w-full truncate px-0.5 font-mono text-[10px] font-normal leading-none",
                      selected ? "text-primary-foreground/90" : "text-sky-900 dark:text-sky-100",
                    )}
                    title={`Order #${displayOrderNumber(paidAtTable.orderNumber, paidAtTable.id)}`}
                  >
                    {displayOrderNumber(paidAtTable.orderNumber, paidAtTable.id)}
                  </span>
                  <span
                    className={cn(
                      "text-[9px] font-bold uppercase tracking-wide leading-none",
                      selected ? "text-primary-foreground/85" : "text-sky-800 dark:text-sky-200",
                    )}
                  >
                    Paid · tap
                  </span>
                </>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

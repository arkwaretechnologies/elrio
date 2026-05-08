"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { floorPlanTableSize, type FloorPlanTable } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PosFloorPlan({
  storeId,
  selectedTableId,
  onSelectTable,
  onClearTakeout,
}: {
  storeId: string;
  selectedTableId: string | null;
  onSelectTable: (t: FloorPlanTable) => void;
  onClearTakeout: () => void;
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
          const { widthPct, heightPct } = floorPlanTableSize(t);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTable(t)}
              className={cn(
                "absolute box-border flex -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-lg border-2 px-2 py-1 text-sm font-semibold shadow-sm transition-colors",
                selected
                  ? "border-primary bg-primary text-primary-foreground ring-2 ring-primary/30"
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
              <span className="line-clamp-2 px-0.5 text-center leading-tight">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

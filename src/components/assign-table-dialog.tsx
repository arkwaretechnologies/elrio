"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PosFloorPlan } from "@/components/pos-floor-plan";
import type { FloorPlanTable } from "@/lib/types";

export function AssignTableDialog({
  open,
  onOpenChange,
  storeId,
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  onAssigned: (choice: { table: FloorPlanTable | null; serviceType: "dine-in" | "takeout" }) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign table</DialogTitle>
        </DialogHeader>
        <PosFloorPlan
          storeId={storeId}
          selectedTableId={null}
          onSelectTable={(t) => {
            onAssigned({ table: t, serviceType: "dine-in" });
            onOpenChange(false);
          }}
          onClearTakeout={() => {
            onAssigned({ table: null, serviceType: "takeout" });
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

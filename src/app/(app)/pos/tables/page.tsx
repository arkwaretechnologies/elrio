"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { usePosSession } from "@/context/pos-session-context";
import { useCart } from "@/context/cart-context";
import { useStoreFloorTables } from "@/hooks/use-store-floor-tables";
import { CartDisplay } from "@/components/cart-display";
import { CakeLoader } from "@/components/cake-loader";
import { PosFloorPlan } from "@/components/pos-floor-plan";
import { subscribeOpenOrders, deleteOpenOrder } from "@/services/open-order-service";
import type { FloorPlanTable, OpenOrder } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function heldOrderForTable(openOrders: OpenOrder[], table: FloorPlanTable): OpenOrder | undefined {
  return openOrders.find(
    (o) => o.tableId != null && String(o.tableId) === String(table.id)
  );
}

export default function PosTablesPage() {
  const { loading, currentStore } = useAuth();
  const { selectedTable, setSelectedTable } = usePosSession();
  const { cartItems, restoreCartFromSnapshot, clearCart } = useCart();
  const floorTables = useStoreFloorTables(currentStore?.id);
  const { toast } = useToast();
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [heldHydrateBlocked, setHeldHydrateBlocked] = useState<{
    table: FloorPlanTable;
    order: OpenOrder;
  } | null>(null);

  useEffect(() => {
    if (!currentStore) return;
    return subscribeOpenOrders(currentStore.id, setOpenOrders);
  }, [currentStore?.id]);

  const runHeldHydrate = useCallback(
    async (table: FloorPlanTable, order: OpenOrder) => {
      restoreCartFromSnapshot({
        items: order.items,
        manualDiscount: order.manualDiscount,
        seniorDiscountDetails: order.seniorDiscountDetails,
      });
      setSelectedTable(table);
      await deleteOpenOrder(order.id);
      toast({
        title: "Open order loaded",
        description: "Review the cart and take payment when ready.",
      });
    },
    [restoreCartFromSnapshot, setSelectedTable, toast]
  );

  const handleSelectTable = useCallback(
    (table: FloorPlanTable) => {
      if (selectedTable?.id === table.id) {
        return;
      }

      const held = heldOrderForTable(openOrders, table);
      if (held) {
        if (cartItems.length > 0) {
          setHeldHydrateBlocked({ table, order: held });
          return;
        }
        void runHeldHydrate(table, held);
        return;
      }

      if (cartItems.length > 0) {
        toast({
          title: "Switched table",
          description: "Cart cleared. Use Transfer in the cart to keep this order on another table.",
        });
      }
      clearCart();
      setSelectedTable(table);
    },
    [
      selectedTable?.id,
      openOrders,
      cartItems.length,
      clearCart,
      setSelectedTable,
      runHeldHydrate,
      toast,
    ]
  );

  const confirmHeldHydrateReplace = useCallback(async () => {
    if (!heldHydrateBlocked) return;
    const { table, order } = heldHydrateBlocked;
    setHeldHydrateBlocked(null);
    await runHeldHydrate(table, order);
  }, [heldHydrateBlocked, runHeldHydrate]);

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <CakeLoader />
        <p className="mt-4 text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!currentStore) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <p className="text-muted-foreground">Please select a store to begin.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 bg-background lg:grid-cols-4 lg:h-full">
        <div className="lg:col-span-3 lg:h-full lg:overflow-y-auto p-4 sm:p-6 lg:border-r lg:border-border/80">
          <h1 className="mb-4 text-xl font-semibold tracking-tight">Tables</h1>
          <PosFloorPlan
            storeId={currentStore.id}
            selectedTableId={selectedTable?.id ?? null}
            onSelectTable={handleSelectTable}
            onClearTakeout={() => setSelectedTable(null)}
          />
        </div>
        <aside className="flex flex-col border-t border-border/80 bg-gradient-to-b from-card to-secondary/40 shadow-[0_0_40px_-12px_hsl(199_89%_48%_/_0.18)] lg:col-span-1 lg:h-full lg:border-l lg:border-t-0">
          <CartDisplay
            selectedTable={selectedTable}
            onSelectedTableChange={setSelectedTable}
            tableTransferChoices={floorTables.length > 0 ? floorTables : undefined}
          />
        </aside>
      </div>

      <AlertDialog
        open={!!heldHydrateBlocked}
        onOpenChange={(open) => !open && setHeldHydrateBlocked(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace current cart?</AlertDialogTitle>
            <AlertDialogDescription>
              This table has an open order. Loading it will replace the items in your cart with that
              order. You can also clear the cart first, then tap the table again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmHeldHydrateReplace()}>
              Replace & load open order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

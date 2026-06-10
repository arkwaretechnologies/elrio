"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/cart-context";
import { usePosSession } from "@/context/pos-session-context";
import { deleteOpenOrder } from "@/services/open-order-service";
import type { FloorPlanTable, OpenOrder } from "@/lib/types";
import { openOrderServiceLabel } from "@/lib/order-service-label";
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

function tableChipFromOpenOrder(o: OpenOrder): FloorPlanTable | null {
  if (!o.tableId || !o.tableLabel) return null;
  return { id: o.tableId, label: o.tableLabel, xPct: 50, yPct: 50 };
}

type ResumeOpenOrderContextValue = {
  runResume: (o: OpenOrder) => Promise<void>;
  requestResume: (o: OpenOrder) => void;
};

const ResumeOpenOrderContext = createContext<ResumeOpenOrderContextValue | null>(null);

export function ResumeOpenOrderProvider({ children }: { children: React.ReactNode }) {
  const [resumeBlocked, setResumeBlocked] = useState<OpenOrder | null>(null);
  const { cartItems, restoreCartFromSnapshot } = useCart();
  const { setSelectedTable, setServiceMode } = usePosSession();
  const router = useRouter();
  const { toast } = useToast();

  const runResume = useCallback(
    async (o: OpenOrder) => {
      try {
        restoreCartFromSnapshot({
          items: o.items,
          manualDiscount: o.manualDiscount,
          seniorDiscountDetails: o.seniorDiscountDetails,
        });
        setSelectedTable(tableChipFromOpenOrder(o));
        const mode = openOrderServiceLabel(o);
        setServiceMode(mode === "dine-in" ? "dine-in" : "takeout");
        await deleteOpenOrder(o.id);
        toast({ title: "Order loaded" });
        router.push("/pos");
      } catch (e) {
        toast({
          variant: "destructive",
          title: "Could not resume order",
          description: e instanceof Error ? e.message : "Try again.",
        });
      }
    },
    [restoreCartFromSnapshot, router, setSelectedTable, setServiceMode, toast],
  );

  const requestResume = useCallback(
    (o: OpenOrder) => {
      if (cartItems.length > 0) {
        setResumeBlocked(o);
        return;
      }
      void runResume(o);
    },
    [cartItems.length, runResume],
  );

  const confirmResumeReplace = useCallback(async () => {
    if (!resumeBlocked) return;
    const o = resumeBlocked;
    setResumeBlocked(null);
    await runResume(o);
  }, [resumeBlocked, runResume]);

  return (
    <ResumeOpenOrderContext.Provider value={{ runResume, requestResume }}>
      {children}
      <AlertDialog open={!!resumeBlocked} onOpenChange={(open) => !open && setResumeBlocked(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace cart?</AlertDialogTitle>
            <AlertDialogDescription>
              Your cart has items. Loading this order replaces the current cart.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmResumeReplace()}>Replace</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ResumeOpenOrderContext.Provider>
  );
}

export function useResumeOpenOrder() {
  const ctx = useContext(ResumeOpenOrderContext);
  if (!ctx) {
    throw new Error("useResumeOpenOrder must be used within ResumeOpenOrderProvider");
  }
  return ctx;
}

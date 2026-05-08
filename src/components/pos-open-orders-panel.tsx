"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useCart } from "@/context/cart-context";
import { usePosSession } from "@/context/pos-session-context";
import { subscribeOpenOrders, deleteOpenOrder } from "@/services/open-order-service";
import type { FloorPlanTable, OpenOrder } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import { Clock, UtensilsCrossed, ShoppingBag, Trash2 } from "lucide-react";
import { tableChipDisplayText } from "@/lib/table-display";

function tableChipFromOpenOrder(o: OpenOrder): FloorPlanTable | null {
  if (!o.tableId || !o.tableLabel) return null;
  return { id: o.tableId, label: o.tableLabel, xPct: 50, yPct: 50 };
}

export function PosOpenOrdersPanel({ storeId }: { storeId: string }) {
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [cancelTarget, setCancelTarget] = useState<OpenOrder | null>(null);
  const [resumeBlocked, setResumeBlocked] = useState<OpenOrder | null>(null);
  const { cartItems, restoreCartFromSnapshot } = useCart();
  const { setSelectedTable } = usePosSession();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const unsub = subscribeOpenOrders(storeId, setOpenOrders);
    return () => unsub();
  }, [storeId]);

  const runResume = async (o: OpenOrder) => {
    try {
      restoreCartFromSnapshot({
        items: o.items,
        manualDiscount: o.manualDiscount,
        seniorDiscountDetails: o.seniorDiscountDetails,
      });
      setSelectedTable(tableChipFromOpenOrder(o));
      await deleteOpenOrder(o.id);
      toast({
        title: "Order loaded",
        description: "Review the cart and use Pay when the customer settles.",
      });
      router.push("/pos");
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not resume order",
        description: e instanceof Error ? e.message : "Try again.",
      });
    }
  };

  const handleResumeClick = (o: OpenOrder) => {
    if (cartItems.length > 0) {
      setResumeBlocked(o);
      return;
    }
    void runResume(o);
  };

  const confirmResumeReplace = async () => {
    if (!resumeBlocked) return;
    const o = resumeBlocked;
    setResumeBlocked(null);
    await runResume(o);
  };

  const handleCancelHeld = async () => {
    if (!cancelTarget) return;
    try {
      await deleteOpenOrder(cancelTarget.id);
      toast({ title: "Held order removed" });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not remove",
        description: e instanceof Error ? e.message : "Try again.",
      });
    } finally {
      setCancelTarget(null);
    }
  };

  if (openOrders.length === 0) {
    return (
      <Card className="mb-6 border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Open orders (pay later)</CardTitle>
          <CardDescription>
            No held orders. Use <strong>Pay later</strong> on the cart to keep an order open until the customer pays.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Open orders (pay later)</CardTitle>
          <CardDescription>
            These orders are not paid yet. Resume to collect payment on the POS, or remove if the guest cancelled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {openOrders.map((o) => (
            <div
              key={o.id}
              className="flex flex-col gap-3 rounded-lg border border-border/80 bg-card/50 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold tabular-nums text-primary">₱{o.total.toFixed(2)}</span>
                  {o.tableLabel ? (
                    <Badge variant="secondary" className="font-normal">
                      <UtensilsCrossed className="mr-1 h-3 w-3" />
                      {tableChipDisplayText(o.tableLabel)}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="font-normal">
                      <ShoppingBag className="mr-1 h-3 w-3" />
                      Takeout
                    </Badge>
                  )}
                </div>
                {o.note ? <p className="text-sm text-muted-foreground">{o.note}</p> : null}
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 shrink-0" />
                  {format(o.createdAt, "MMM d, h:mm a")}
                  {o.createdByName ? ` · ${o.createdByName}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button type="button" size="sm" onClick={() => handleResumeClick(o)}>
                  Resume & pay
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setCancelTarget(o)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove held order?</AlertDialogTitle>
            <AlertDialogDescription>
              This only deletes the held order. No sale is recorded and stock is unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelHeld} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!resumeBlocked} onOpenChange={(open) => !open && setResumeBlocked(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace current cart?</AlertDialogTitle>
            <AlertDialogDescription>
              Your cart has items. Resuming this held order will replace the current cart with the held order.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmResumeReplace()}>Replace & resume</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

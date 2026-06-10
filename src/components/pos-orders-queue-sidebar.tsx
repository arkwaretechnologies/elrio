"use client";

import { useEffect, useMemo, useState } from "react";
import type { Sale } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { buildFulfillmentQueue } from "@/lib/unified-orders-queue";
import { saleServiceLabel } from "@/lib/order-service-label";
import { formatPickupNumber } from "@/lib/pickup-number";
import { QueueMinutes } from "@/components/queue-minutes";
import { UtensilsCrossed, ShoppingBag } from "lucide-react";
import { TransactionItemsDialog } from "@/components/transaction-items-dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  loadDismissedPaidSaleIds,
  saveDismissedPaidSaleIds,
} from "@/lib/queue-paid-dismissals";

function ServiceMini({ sale }: { sale: Sale }) {
  const label = saleServiceLabel(sale);
  if (label === "dine-in") {
    return (
      <Badge className="border-amber-200 bg-amber-100 px-1.5 py-0 text-[10px] font-normal text-amber-950">
        <UtensilsCrossed className="mr-0.5 h-2.5 w-2.5" />
        In
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
      <ShoppingBag className="mr-0.5 h-2.5 w-2.5" />
      Out
    </Badge>
  );
}

export function PosOrdersQueueSidebar({
  storeId,
  paidSalesInRange,
}: {
  storeId: string;
  paidSalesInRange: Sale[];
}) {
  const { toast } = useToast();
  const [dismissedPaidIds, setDismissedPaidIds] = useState<Set<string>>(new Set());
  const [detailSale, setDetailSale] = useState<Sale | null>(null);

  useEffect(() => {
    setDismissedPaidIds(loadDismissedPaidSaleIds(storeId));
  }, [storeId]);

  const paidFiltered = useMemo(
    () => paidSalesInRange.filter((s) => !dismissedPaidIds.has(s.id)),
    [paidSalesInRange, dismissedPaidIds],
  );

  const queue = useMemo(() => buildFulfillmentQueue(paidFiltered), [paidFiltered]);

  const handleDone = (e: React.MouseEvent, sale: Sale) => {
    e.preventDefault();
    e.stopPropagation();
    setDismissedPaidIds((prev) => {
      const next = new Set(prev);
      next.add(sale.id);
      saveDismissedPaidSaleIds(storeId, next);
      return next;
    });
    toast({ title: "Removed from queue" });
  };

  const total = queue.length;

  return (
    <>
      <Card className="flex h-full min-h-[320px] flex-col lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)]">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base">Queue</CardTitle>
          <p className="text-xs text-muted-foreground">
            Orders to serve · {total === 0 ? "Empty" : `${total} in line`}
          </p>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 px-2 pb-4 pt-0">
          {queue.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No orders in queue.</p>
          ) : (
            <ScrollArea className="h-[min(60vh,520px)] pr-2 lg:h-[calc(100vh-12rem)]">
              <ul className="space-y-1.5">
                {queue.map((item, idx) => {
                  const { sale } = item;
                  return (
                    <li key={sale.id}>
                      <div className="flex flex-col gap-1 rounded-lg border border-border/80 bg-card p-1">
                        <button
                          type="button"
                          onClick={() => setDetailSale(sale)}
                          className={cn(
                            "flex w-full flex-col gap-1 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                            "hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-2xl font-extrabold tabular-nums text-primary">
                              #{formatPickupNumber(sale.pickupNumber)}
                            </span>
                            <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                              <QueueMinutes since={item.createdAt} />
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="font-semibold tabular-nums">₱{sale.total.toFixed(2)}</span>
                            <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                              · line #{idx + 1}
                            </span>
                            <ServiceMini sale={sale} />
                          </div>
                        </button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-8 w-full text-xs"
                          onClick={(e) => handleDone(e, sale)}
                        >
                          Done
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {detailSale ? (
        <TransactionItemsDialog
          sale={detailSale}
          isOpen
          onClose={() => setDetailSale(null)}
        />
      ) : null}
    </>
  );
}

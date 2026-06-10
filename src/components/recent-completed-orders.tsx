"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Eye, ShoppingBag, UtensilsCrossed } from "lucide-react";
import type { Sale } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TransactionItemsDialog } from "@/components/transaction-items-dialog";
import { formatPickupNumber } from "@/lib/pickup-number";
import { displayOrderNumber } from "@/lib/order-number";
import { saleServiceLabel } from "@/lib/order-service-label";

const PAGE_SIZE = 8;
/** Cap how many newest completed sales we consider (pagination runs within this list). */
const RECENT_POOL = 200;

function TypeBadge({ sale }: { sale: Sale }) {
  const label = saleServiceLabel(sale);
  if (label === "takeout") {
    return (
      <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
        <ShoppingBag className="mr-0.5 h-2.5 w-2.5" />
        Out
      </Badge>
    );
  }
  return (
    <Badge className="border-amber-200 bg-amber-100 px-1.5 py-0 text-[10px] font-normal text-amber-950">
      <UtensilsCrossed className="mr-0.5 h-2.5 w-2.5" />
      In
    </Badge>
  );
}

export function RecentCompletedOrders({ sales }: { sales: Sale[] }) {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Sale | null>(null);

  const completedRecent = useMemo(() => {
    return sales
      .filter((s) => s.status !== "VOIDED")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, RECENT_POOL);
  }, [sales]);

  const total = completedRecent.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * PAGE_SIZE;
  const rows = completedRecent.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
    setPage((p) => Math.min(p, maxPage));
  }, [total]);

  return (
    <>
      <Card className="border-dashed">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base font-semibold">Recent completed</CardTitle>
          <p className="text-xs text-muted-foreground">
            Newest completed sales (not voided), across all dates loaded for this store.
          </p>
        </CardHeader>
        <CardContent className="space-y-3 pb-4">
          {total === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No completed orders yet.</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-9 w-[128px] text-xs">Time</TableHead>
                      <TableHead className="h-9 w-[56px] text-xs">#</TableHead>
                      <TableHead className="h-9 w-[88px] text-xs">Ref</TableHead>
                      <TableHead className="h-9 w-[72px] text-xs">Type</TableHead>
                      <TableHead className="h-9 text-right text-xs">Total</TableHead>
                      <TableHead className="h-9 w-[52px] text-right text-xs" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((sale) => (
                      <TableRow
                        key={sale.id}
                        className="cursor-pointer text-sm hover:bg-muted/50"
                        onClick={() => setSelected(sale)}
                      >
                        <TableCell className="py-2 tabular-nums text-muted-foreground">
                          {format(sale.createdAt, "MMM d, h:mm a")}
                        </TableCell>
                        <TableCell className="py-2 text-lg font-bold tabular-nums text-primary">
                          #{formatPickupNumber(sale.pickupNumber)}
                        </TableCell>
                        <TableCell className="py-2 font-mono text-xs tabular-nums text-muted-foreground">
                          {displayOrderNumber(sale.orderNumber, sale.id)}
                        </TableCell>
                        <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                          <TypeBadge sale={sale} />
                        </TableCell>
                        <TableCell className="py-2 text-right font-semibold tabular-nums text-primary">
                          ₱{sale.total.toFixed(2)}
                        </TableCell>
                        <TableCell className="py-2 text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setSelected(sale)}
                            aria-label="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {total === 0
                    ? "—"
                    : `${pageStart + 1}–${Math.min(pageStart + rows.length, total)} of ${total}`}
                  {total >= RECENT_POOL ? ` (newest ${RECENT_POOL})` : ""}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 px-2"
                    disabled={safePage <= 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <span className="tabular-nums px-1">
                    {safePage + 1} / {pageCount}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 px-2"
                    disabled={safePage >= pageCount - 1}
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {selected ? (
        <TransactionItemsDialog
          sale={selected}
          isOpen
          onClose={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}

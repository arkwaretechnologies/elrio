"use client";

import { useEffect, useState } from "react";
import {
  deleteOpenOrder,
  updateOpenOrderAssignment,
} from "@/services/open-order-service";
import type { FloorPlanTable, OpenOrder } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { UtensilsCrossed, ShoppingBag, Printer } from "lucide-react";
import { tableChipDisplayText } from "@/lib/table-display";
import { openOrderServiceLabel } from "@/lib/order-service-label";
import { AssignTableDialog } from "@/components/assign-table-dialog";
import { OpenOrderItemsDialog } from "@/components/open-order-items-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useResumeOpenOrder } from "@/context/resume-open-order-context";

export function PosOpenOrdersPanel({
  storeId,
  openOrders,
}: {
  storeId: string;
  openOrders: OpenOrder[];
}) {
  const [cancelTarget, setCancelTarget] = useState<OpenOrder | null>(null);
  const [assignTarget, setAssignTarget] = useState<OpenOrder | null>(null);
  const [detailOrder, setDetailOrder] = useState<OpenOrder | null>(null);
  const { requestResume } = useResumeOpenOrder();
  const { toast } = useToast();

  const handleCancelHeld = async () => {
    if (!cancelTarget) return;
    try {
      await deleteOpenOrder(cancelTarget.id);
      toast({ title: "Order removed" });
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

  const ServiceBadge = ({ o }: { o: OpenOrder }) => {
    const label = openOrderServiceLabel(o);
    if (label === "dine-in") {
      return (
        <Badge className="w-fit border-amber-200 bg-amber-100 font-normal text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <UtensilsCrossed className="mr-1 h-3 w-3" />
          Dine-in
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="w-fit font-normal">
        <ShoppingBag className="mr-1 h-3 w-3" />
        Takeout
      </Badge>
    );
  };

  return (
    <>
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Unpaid</CardTitle>
        </CardHeader>
        <CardContent>
          {openOrders.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No unpaid orders.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[280px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openOrders.map((o) => (
                    <TableRow
                      key={o.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setDetailOrder(o)}
                    >
                      <TableCell className="align-top">
                        <div className="text-left">
                          <span className="font-semibold tabular-nums text-primary">₱{o.total.toFixed(2)}</span>
                          {o.note ? (
                            <span className="mt-1 block max-w-[200px] truncate text-xs text-muted-foreground">
                              {o.note}
                            </span>
                          ) : null}
                          {o.tableLabel ? (
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {tableChipDisplayText(o.tableLabel)}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <ServiceBadge o={o} />
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-wrap justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button type="button" size="sm" variant="outline" onClick={() => setAssignTarget(o)}>
                            Table
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() =>
                              toast({ title: "Kitchen print", description: "Not connected yet." })
                            }
                          >
                            <Printer className="h-3.5 w-3.5" />
                            Print
                          </Button>
                          <Button type="button" size="sm" variant="destructive" onClick={() => setCancelTarget(o)}>
                            Cancel
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <OpenOrderItemsDialog
        order={detailOrder}
        isOpen={!!detailOrder}
        onClose={() => setDetailOrder(null)}
        onLoadToPos={(o) => {
          setDetailOrder(null);
          requestResume(o);
        }}
      />

      <AssignTableDialog
        open={!!assignTarget}
        onOpenChange={(open) => !open && setAssignTarget(null)}
        storeId={storeId}
        onAssigned={async (choice) => {
          if (!assignTarget) return;
          try {
            await updateOpenOrderAssignment(assignTarget.id, {
              tableId: choice.table?.id ?? null,
              tableLabel: choice.table?.label ?? null,
              serviceType: choice.serviceType,
            });
            toast({ title: "Table updated" });
          } catch (e) {
            toast({
              variant: "destructive",
              title: "Could not update",
              description: e instanceof Error ? e.message : "Try again.",
            });
          } finally {
            setAssignTarget(null);
          }
        }}
      />

      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this order?</AlertDialogTitle>
            <AlertDialogDescription>It will not appear in sales or inventory.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelHeld}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

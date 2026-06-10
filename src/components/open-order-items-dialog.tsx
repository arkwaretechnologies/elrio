"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { OpenOrder } from "@/lib/types";
import { format } from "date-fns";
import { openOrderServiceLabel } from "@/lib/order-service-label";
import { displayOrderNumber } from "@/lib/order-number";
import { tableChipDisplayText } from "@/lib/table-display";

type OpenOrderItemsDialogProps = {
  order: OpenOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onLoadToPos: (order: OpenOrder) => void;
};

export function OpenOrderItemsDialog({ order, isOpen, onClose, onLoadToPos }: OpenOrderItemsDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        {order ? (
          <>
        <DialogHeader>
          <DialogTitle>Unpaid order</DialogTitle>
          <DialogDescription className="space-y-1 text-left">
            <span className="block font-mono text-xs text-muted-foreground">
              Order #{displayOrderNumber(order.orderNumber, order.id)}
            </span>
            <span className="block text-foreground">
              {openOrderServiceLabel(order) === "dine-in" ? "Dine-in" : "Takeout"}
              {order.tableLabel?.trim() ? ` · ${tableChipDisplayText(order.tableLabel)}` : ""}
            </span>
            <span className="block text-sm text-muted-foreground">
              {format(order.createdAt, "MMM d, yyyy, h:mm a")} ·{" "}
              <span className="font-semibold text-foreground">₱{order.total.toFixed(2)}</span>
            </span>
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-96">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="text-right">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <React.Fragment key={item.id}>
                  <TableRow>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right">₱{item.price.toFixed(2)}</TableCell>
                  </TableRow>
                  {item.selectedConfiguration && item.selectedConfiguration.length > 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="pb-2 pl-8 pt-0">
                        <ul className="list-disc space-y-0.5 text-xs text-muted-foreground">
                          {item.selectedConfiguration.map((c) => (
                            <li key={`${item.id}-${c.menuItemId}`}>
                              {c.name} (×{c.quantity})
                            </li>
                          ))}
                        </ul>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="button" onClick={() => onLoadToPos(order)}>
            Load to POS
          </Button>
        </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

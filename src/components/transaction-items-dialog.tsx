
"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Sale } from '@/lib/types';
import { format } from 'date-fns';
import { Badge } from "./ui/badge";
import { displayOrderNumber } from '@/lib/order-number';
import { formatPickupNumber } from '@/lib/pickup-number';

interface TransactionItemsDialogProps {
  sale: Sale;
  isOpen: boolean;
  onClose: () => void;
}

export function TransactionItemsDialog({ sale, isOpen, onClose }: TransactionItemsDialogProps) {

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Transaction Details</DialogTitle>
          <DialogDescription className="space-y-1">
            <span className="block text-lg font-bold text-primary">
              Order #{formatPickupNumber(sale.pickupNumber)}
            </span>
            <span className="block font-mono text-xs text-muted-foreground">
              Ref {displayOrderNumber(sale.orderNumber, sale.id)}
            </span>
            <span className="block">
              Items for sale on {format(sale.timestamp, "MMM d, yyyy, h:mm a")}
            </span>
            {sale.tableId || sale.tableLabel ? (
              <span className="block text-foreground">
                Dine-in
                {sale.tableLabel?.trim() ? ` · Table ${sale.tableLabel.trim()}` : ''}
              </span>
            ) : (
              <span className="block text-foreground">Takeout</span>
            )}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-96">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-center">Quantity</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sale.items.map((item, index) => (
                        <React.Fragment key={`${item.id}-${index}`}>
                            <TableRow>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell className="text-center">{item.quantity}</TableCell>
                                <TableCell className="text-right">₱{item.price.toFixed(2)}</TableCell>
                            </TableRow>
                            {item.configuration && (
                                 <TableRow>
                                    <TableCell colSpan={3} className="pt-0 pb-2 pl-10">
                                        <div className="text-xs text-muted-foreground space-y-1">
                                            <p className="font-semibold">Included Items:</p>
                                            <ul className="list-disc pl-4">
                                                {item.configuration.map((config, idx) => (
                                                    <li key={`${config.menuItemId}-${idx}`}>{config.name} (x{config.quantity})</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </React.Fragment>
                    ))}
                </TableBody>
            </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}


"use client";

import React from 'react';
import type { Sale } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format, isToday } from 'date-fns';

export function PreOrdersReportClient({ initialPreOrders }: { initialPreOrders: Sale[] }) {
  
  // Filter pre-orders that were CREATED today.
  const todayPreOrders = initialPreOrders.filter(sale => sale.isPreOrder && isToday(new Date(sale.createdAt)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pre-orders Report</h1>
        <p className="text-muted-foreground">List of pre-orders created today.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Today's Pre-order Transactions</CardTitle>
          <CardDescription>
            These are the pre-orders that were entered into the system today.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order Time</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Pick-up Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todayPreOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No pre-orders were entered today.
                    </TableCell>
                  </TableRow>
                ) : (
                  todayPreOrders.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>{format(new Date(sale.createdAt), 'p')}</TableCell>
                      <TableCell className="font-medium">{sale.customerName || 'N/A'}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {sale.items.map(item => `${item.name} (x${item.quantity})`).join(', ')}
                      </TableCell>
                       <TableCell className="font-semibold">₱{sale.total.toFixed(2)}</TableCell>
                      <TableCell className="font-medium text-primary">
                        {sale.pickupDate ? format(sale.pickupDate, 'MMM d, yyyy') : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

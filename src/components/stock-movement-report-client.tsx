
"use client";

import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { Sale } from '@/lib/types';
import { DateRange } from 'react-day-picker';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';

interface ProductSaleInfo {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
}

export function StockMovementReportClient({ initialSales }: { initialSales: Sale[] }) {
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });

  const filteredSales = useMemo(() => {
    if (!date?.from || !date?.to) {
      return initialSales;
    }
    const from = date.from.setHours(0, 0, 0, 0);
    const to = date.to.setHours(23, 59, 59, 999);

    return initialSales.filter(sale => {
      const saleTimestamp = sale.timestamp.getTime();
      return saleTimestamp >= from && saleTimestamp <= to;
    });
  }, [initialSales, date]);

  const productPerformance = useMemo(() => {
    const productMap = new Map<string, ProductSaleInfo>();

    filteredSales.forEach(sale => {
      sale.items.forEach(item => {
        // Handle both simple and configured items
        if(item.configuration) {
            item.configuration.forEach(configItem => {
                const key = configItem.menuItemId;
                const existing = productMap.get(key);
                // We need to find the price of the sub-item, which isn't stored in the sale record.
                // This is a limitation. For now, we assume sub-items don't contribute to revenue in this report.
                 if (existing) {
                    existing.quantity += configItem.quantity * item.quantity; // Total pieces
                } else {
                    productMap.set(key, {
                        id: key,
                        name: configItem.name,
                        quantity: configItem.quantity * item.quantity,
                        revenue: 0, // Cannot calculate revenue accurately here
                    });
                }
            })
        } else {
            // This is a simple item, not an assorted box.
            // The item.id is a composite of `baseProductId_variantId`. We can use this as a key.
            const key = item.id;
            const existing = productMap.get(key);
            if (existing) {
                existing.quantity += item.quantity;
                existing.revenue += item.price * item.quantity;
            } else {
                productMap.set(key, {
                    id: key,
                    name: item.name,
                    quantity: item.quantity,
                    revenue: item.price * item.quantity,
                });
            }
        }
      });
    });

    const performanceArray = Array.from(productMap.values());
    performanceArray.sort((a, b) => b.quantity - a.quantity);
    
    const totalItemsSold = performanceArray.reduce((sum, item) => sum + item.quantity, 0);
    let cumulativeQuantity = 0;
    const eightyPercentCutoff = totalItemsSold * 0.8;

    const fastMoving: ProductSaleInfo[] = [];
    const slowMoving: ProductSaleInfo[] = [];

    performanceArray.forEach(item => {
        cumulativeQuantity += item.quantity;
        if (cumulativeQuantity <= eightyPercentCutoff && item.quantity > 0) {
            fastMoving.push(item);
        } else {
            slowMoving.push(item);
        }
    });
    
    slowMoving.sort((a, b) => a.quantity - b.quantity);
    
    return { fastMoving, slowMoving };

  }, [filteredSales]);
  
  const MovementTable = ({ title, data }: { title: string, data: ProductSaleInfo[] }) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
         <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Total Units Sold</TableHead>
                <TableHead className="text-right">Total Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length > 0 ? (
                data.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {item.revenue > 0 ? `₱${item.revenue.toFixed(2)}` : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                    No sales data for the selected period.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold">Stock Movement Report</h1>
            <p className="text-muted-foreground">Identify your best-selling and slowest-moving products.</p>
        </div>
        <div>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "w-[300px] justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                            date.to ? (
                                <>
                                    {format(date.from, "LLL dd, y")} -{" "}
                                    {format(date.to, "LLL dd, y")}
                                </>
                            ) : (
                                format(date.from, "LLL dd, y")
                            )
                        ) : (
                            <span>Pick a date</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 flex" align="end">
                  <div className="flex flex-col space-y-2 p-2 border-r">
                      <Button variant="ghost" className="justify-start" onClick={() => setDate({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })}>This Month</Button>
                      <Button variant="ghost" className="justify-start" onClick={() => setDate({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) })}>Last Month</Button>
                      <Button variant="ghost" className="justify-start" onClick={() => setDate({ from: subDays(new Date(), 90), to: new Date() })}>Last 90 Days</Button>
                  </div>
                   <Separator orientation="vertical" />
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={setDate}
                        numberOfMonths={2}
                    />
                </PopoverContent>
            </Popover>
        </div>
      </div>

       <Tabs defaultValue="fast-moving">
        <TabsList>
          <TabsTrigger value="fast-moving">
            Fast-Moving Items
            <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800">{productPerformance.fastMoving.length}</Badge>
            </TabsTrigger>
          <TabsTrigger value="slow-moving">
            Slow-Moving Items
            <Badge variant="secondary" className="ml-2 bg-yellow-100 text-yellow-800">{productPerformance.slowMoving.length}</Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="fast-moving">
            <MovementTable title="Fast-Moving Items (Top 80% of Sales by Volume)" data={productPerformance.fastMoving} />
        </TabsContent>
        <TabsContent value="slow-moving">
            <MovementTable title="Slow-Moving Items (Bottom 20% of Sales by Volume)" data={productPerformance.slowMoving} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

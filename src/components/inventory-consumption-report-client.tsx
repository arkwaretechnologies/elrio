
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
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { InventoryLog, InventoryItem, UnitOfMeasurement } from '@/lib/types';
import { DateRange } from 'react-day-picker';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';
import { useAuth } from '@/context/auth-context';

interface ConsumptionInfo {
  id: string;
  name: string;
  unit: UnitOfMeasurement;
  consumed: number;
  remaining: number;
}

export function InventoryConsumptionReportClient({ initialLogs, allInventoryItems }: { initialLogs: InventoryLog[], allInventoryItems: InventoryItem[] }) {
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  });
  
  const { inventory: storeInventory } = useAuth();
  
  const storeInventoryMap = useMemo(() => new Map(storeInventory.map(item => [item.inventoryItemId, item])), [storeInventory]);

  const filteredLogs = useMemo(() => {
    if (!date?.from) return [];
    const from = date.from.setHours(0, 0, 0, 0);
    const to = (date.to || date.from).setHours(23, 59, 59, 999);
    return initialLogs.filter(log => {
      const logTimestamp = log.timestamp.getTime();
      return logTimestamp >= from && logTimestamp <= to;
    });
  }, [initialLogs, date]);

  const consumptionData = useMemo(() => {
    const consumptionMap = new Map<string, number>();

    // We only care about logs that represent a deduction ('Sale').
    // Other log types like 'Restock' or 'Damaged' are not "consumption".
    filteredLogs.forEach(log => {
      if (log.type === 'Sale') {
        const current = consumptionMap.get(log.inventoryItemId) || 0;
        // Adjustments from sales are stored as negative numbers, so we subtract to make them positive for display.
        consumptionMap.set(log.inventoryItemId, current - log.adjustment);
      }
    });

    const finalData: ConsumptionInfo[] = allInventoryItems.map(invItem => {
        const consumed = consumptionMap.get(invItem.id) || 0;
        const storeInvItem = storeInventoryMap.get(invItem.id);
        const remaining = storeInvItem?.stock ?? 0;
        
        return {
            id: invItem.id,
            name: invItem.name,
            unit: storeInvItem?.unit || invItem.unit,
            consumed: consumed,
            remaining: remaining
        }
    });

    return finalData.sort((a,b) => a.name.localeCompare(b.name));

  }, [filteredLogs, allInventoryItems, storeInventoryMap]);
  
  const formatNumber = (num: number, unit: UnitOfMeasurement) => {
    if (unit === 'pcs' || unit === 'cups') {
      return num.toFixed(0);
    }
    return num.toFixed(2);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Inventory Consumption Report</h1>
          <p className="text-muted-foreground">Track inventory usage and remaining stock levels.</p>
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
                      <Button variant="ghost" className="justify-start" onClick={() => setDate({ from: new Date(), to: new Date() })}>Today</Button>
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

       <Card>
        <CardHeader>
            <CardTitle>Inventory Details</CardTitle>
            <CardDescription>Consumption is calculated based on sale logs within the selected date range.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Inventory Item</TableHead>
                    <TableHead className="text-right">Total Consumed</TableHead>
                    <TableHead className="text-right">Stock Remaining</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {consumptionData.map(item => (
                    <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.consumed, item.unit)} {item.unit}</TableCell>
                        <TableCell className={`text-right font-bold ${item.remaining < 0 ? 'text-destructive' : ''}`}>
                            {formatNumber(item.remaining, item.unit)} {item.unit}
                        </TableCell>
                        <TableCell className="text-center">
                            {item.remaining <= 0 && <Badge variant="destructive">Out of Stock</Badge>}
                            {item.remaining > 0 && item.remaining < 10 && <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Low Stock</Badge>}
                            {item.remaining >= 10 && <Badge variant="secondary" className="bg-green-100 text-green-800">In Stock</Badge>}
                        </TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
        </CardContent>
       </Card>
    </div>
  );
}

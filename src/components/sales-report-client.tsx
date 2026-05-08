
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { format, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths, isWithinInterval } from 'date-fns';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Sale } from '@/lib/types';
import { DollarSign, ShoppingBag, BarChart2, Clock, Calendar as CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from '@/lib/utils';
import { Calendar } from './ui/calendar';
import { Separator } from './ui/separator';
import { getSales } from '@/services/sales-service';
import { useAuth } from '@/context/auth-context';


function StatCard({ icon: Icon, title, value, color }: { icon?: React.ElementType, title: string, value: string | number, color: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {Icon && <Icon className={`h-5 w-5 ${color}`} />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border p-2 rounded-lg shadow-sm">
        <p className="font-bold">{`Date: ${label}`}</p>
        <p className="text-green-600">{`Revenue: ₱${payload[0].value.toFixed(2)}`}</p>
      </div>
    );
  }
  return null;
};

export function SalesReportClient({ initialSales }: { initialSales: Sale[] }) {
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });

  const [sales, setSales] = useState<Sale[]>(initialSales);
  const { currentStore } = useAuth(); // We might need this if we're not in admin view
  
  // This effect will refetch sales data when the date range changes.
  useEffect(() => {
    // initialSales is only for the first load. For date changes, we need to fetch.
    const storeId = (document.querySelector('[role="combobox"]')?.textContent !== 'Select a store...') 
        ? initialSales[0]?.storeId // Heuristic to get storeId in admin view
        : currentStore?.id; // For non-admin view
    
    async function fetchSalesForRange() {
      if (date?.from && storeId) {
         // A more robust solution might need a single getSalesForRange function.
         // For now, we'll re-use getSales and filter.
         const allSales = await getSales(storeId);
         const from = startOfDay(date.from);
         const to = date.to ? endOfDay(date.to) : endOfDay(date.from);
         const filtered = allSales.filter(sale => {
           const saleTimestamp = sale.timestamp;
           return saleTimestamp >= from && saleTimestamp <= to;
         });
         setSales(filtered);
      } else {
        // If no date is selected, we can show the initial data or clear it.
        setSales(initialSales);
      }
    }
    
    // Only refetch if the component is NOT using the initial prop data directly
    // This logic can be tricky. Let's simplify: the page will pass the initial data.
    // The date picker will then filter that data. No new fetching here.

  }, [date, initialSales, currentStore]);

  const filteredSales = useMemo(() => {
    if (!date?.from) {
      return sales.filter(s => s.status !== 'VOIDED');
    }
    const from = startOfDay(date.from);
    const to = date.to ? endOfDay(date.to) : endOfDay(date.from);

    return sales.filter(sale => {
      const saleTimestamp = sale.timestamp;
      return sale.status !== 'VOIDED' && saleTimestamp >= from && saleTimestamp <= to;
    });
  }, [sales, date]);


  const stats = useMemo(() => {
    const totalRevenue = filteredSales.reduce((acc, sale) => acc + sale.total, 0);
    const totalOrders = filteredSales.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalPreOrders = filteredSales.filter(s => s.isPreOrder).length;

    return {
      totalRevenue: `₱${totalRevenue.toFixed(2)}`,
      totalOrders,
      averageOrderValue: `₱${averageOrderValue.toFixed(2)}`,
      totalPreOrders,
    };
  }, [filteredSales]);

  const salesDataForChart = useMemo(() => {
    if (!date?.from) return [];
    
    const diffDays = date.to ? (date.to.getTime() - date.from.getTime()) / (1000 * 3600 * 24) : 0;

    if (diffDays <= 31) { // Group by day
      const dailyData = new Map<string, number>();
      let currentDate = new Date(date.from);
      while (currentDate <= (date.to || date.from)) {
        dailyData.set(format(currentDate, 'MMM d'), 0);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      filteredSales.forEach(sale => {
        const day = format(sale.timestamp, 'MMM d');
        dailyData.set(day, (dailyData.get(day) || 0) + sale.total);
      });
      return Array.from(dailyData, ([date, revenue]) => ({ date, revenue }));
    } else { // Group by month
      const monthlyData = new Map<string, number>();
      filteredSales.forEach(sale => {
        const month = format(sale.timestamp, 'MMM yyyy');
        monthlyData.set(month, (monthlyData.get(month) || 0) + sale.total);
      });
      return Array.from(monthlyData, ([date, revenue]) => ({ date, revenue })).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
  }, [filteredSales, date]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Sales Report</h1>
          <p className="text-muted-foreground">An overview of your sales performance.</p>
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={DollarSign} title="Total Revenue" value={stats.totalRevenue} color="text-green-500" />
        <StatCard icon={ShoppingBag} title="Total Orders" value={stats.totalOrders} color="text-blue-500" />
        <StatCard icon={Clock} title="Total Pre-Orders" value={stats.totalPreOrders} color="text-purple-500" />
        <StatCard icon={BarChart2} title="Average Order Value" value={stats.averageOrderValue} color="text-orange-500" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={salesDataForChart}>
              <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₱${value}`} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsla(var(--muted))' }} />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
             <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredSales.length === 0 ? (
                           <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    No sales found for the selected period.
                                </TableCell>
                            </TableRow>
                        ) : filteredSales.slice(0, 10).map((sale) => (
                        <TableRow key={sale.id}>
                            <TableCell className="font-medium text-muted-foreground whitespace-nowrap">
                                {format(new Date(sale.timestamp), "MMM d, h:mm a")}
                            </TableCell>
                            <TableCell>{sale.customerName || 'N/A'}</TableCell>
                            <TableCell>{sale.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}</TableCell>
                            <TableCell>
                                {sale.isPreOrder ? (
                                    <Badge className="bg-purple-100 text-purple-800">Pre-order</Badge>
                                ) : (
                                    <Badge variant="outline">{sale.paymentMethod}</Badge>
                                )}
                            </TableCell>
                            <TableCell className="text-right font-bold">₱{sale.total.toFixed(2)}</TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
      </Card>

    </div>
  );
}

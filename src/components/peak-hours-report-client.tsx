
"use client";

import React, { useMemo } from 'react';
import { format, getHours } from 'date-fns';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Sale } from '@/lib/types';
import { Clock } from 'lucide-react';

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
        <p className="font-bold">{`Time: ${label}`}</p>
        <p className="text-blue-600">{`Transactions: ${payload[0].value}`}</p>
        <p className="text-green-600">{`Revenue: ₱${payload[1].value.toFixed(2)}`}</p>
      </div>
    );
  }
  return null;
};

export function PeakHoursReportClient({ initialSales }: { initialSales: Sale[] }) {
  
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      transactions: 0,
      revenue: 0,
    }));

    initialSales.forEach(sale => {
      const saleHour = getHours(new Date(sale.timestamp));
      hours[saleHour].transactions += 1;
      hours[saleHour].revenue += sale.total;
    });

    return hours.map(h => ({
      ...h,
      name: `${format(new Date(0, 0, 0, h.hour), 'ha')}`, // e.g., 9AM
    }));
  }, [initialSales]);

  const busiestHour = useMemo(() => {
    if (hourlyData.length === 0) return 'N/A';
    
    // Find hour with most transactions, break ties with revenue
    const busiest = hourlyData.reduce((prev, current) => {
        if (current.transactions > prev.transactions) return current;
        if (current.transactions === prev.transactions && current.revenue > prev.revenue) return current;
        return prev;
    });

    return busiest.transactions > 0 ? busiest.name : 'N/A';
  }, [hourlyData]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Peak Hours Report</h1>
        <p className="text-muted-foreground">Analyze your busiest hours based on sales transactions.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={Clock} title="Busiest Hour" value={busiestHour} color="text-green-500" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sales by Hour</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" orientation="left" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₱${value}`} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsla(var(--muted))' }}/>
              <Legend />
              <Bar yAxisId="left" dataKey="transactions" fill="hsl(var(--primary))" name="Transactions" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="revenue" fill="hsl(var(--accent))" name="Revenue" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

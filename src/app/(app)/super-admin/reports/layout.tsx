
"use client";

import React, { useState, useEffect } from 'react';
import { getStores } from '@/services/store-service';
import type { Store } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CakeLoader } from '@/components/cake-loader';
import { usePathname } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from 'next/link';
import { AreaChart, BarChart3, BookMarked, Clock, ClipboardList, History, Package, TrendingUp, Receipt } from 'lucide-react';


const reportTabs = [
  { value: 'sales', label: 'Sales Report', icon: AreaChart, href: '/super-admin/reports/sales' },
  { value: 'order-history', label: 'Order History', icon: History, href: '/super-admin/reports/order-history' },
  { value: 'pre-orders', label: 'Pre-orders Report', icon: BookMarked, href: '/super-admin/reports/pre-orders' },
  { value: 'peak-hours', label: 'Peak Hours', icon: Clock, href: '/super-admin/reports/peak-hours' },
  { value: 'stock-movement', label: 'Stock Movement', icon: TrendingUp, href: '/super-admin/reports/stock-movement' },
  { value: 'products', label: 'Product List', icon: Package, href: '/super-admin/reports/products' },
  { value: 'inventory-logs', label: 'Inventory Logs', icon: ClipboardList, href: '/super-admin/reports/inventory-logs' },
  { value: 'expenses', label: 'Expenses', icon: Receipt, href: '/super-admin/reports/expenses'},
];


export default function AdminReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  const activeTab = reportTabs.find(tab => pathname.startsWith(tab.href))?.value;

  useEffect(() => {
    getStores().then(fetchedStores => {
      setStores(fetchedStores);
      setLoading(false);
    });
  }, []);

  const childrenWithProps = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      // @ts-ignore
      return React.cloneElement(child, { selectedStoreId });
    }
    return child;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Store Reports</h1>
          <p className="text-muted-foreground">Select a store to view its reports.</p>
        </div>
        <div className="w-72">
          {loading ? (
            <CakeLoader />
          ) : (
            <Select onValueChange={setSelectedStoreId} value={selectedStoreId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a store..." />
              </SelectTrigger>
              <SelectContent>
                {stores.map(store => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
      
       <Tabs value={activeTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-4 lg:grid-cols-8">
            {reportTabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} asChild>
                    <Link href={tab.href}>
                        <tab.icon className="mr-2 h-4 w-4" />
                        {tab.label}
                    </Link>
                </TabsTrigger>
            ))}
        </TabsList>
      </Tabs>

      {selectedStoreId ? (
        childrenWithProps
      ) : (
        <div className="flex flex-col items-center justify-center h-96 border rounded-lg bg-muted/20">
          <p className="text-lg text-muted-foreground">Please select a store to view its report.</p>
        </div>
      )}
    </div>
  );
}

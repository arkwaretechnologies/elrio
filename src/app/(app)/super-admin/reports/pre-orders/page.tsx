
"use client";

import { useEffect, useState } from 'react';
import { PreOrdersReportClient } from "@/components/pre-orders-report-client";
import { getSales } from "@/services/sales-service";
import { CakeLoader } from '@/components/cake-loader';
import type { Sale } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default function AdminPreOrdersPage({ selectedStoreId }: { selectedStoreId?: string }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedStoreId) {
      setSales([]);
      setLoading(false);
      return;
    };

    setLoading(true);
    getSales(selectedStoreId)
      .then(fetchedSales => {
        const preOrders = fetchedSales.filter(s => s.isPreOrder);
        setSales(preOrders);
        setLoading(false);
      })
      .catch(error => {
        console.error("Failed to load pre-orders data for admin report:", error);
        setLoading(false);
      });
  }, [selectedStoreId]);
  
  if (loading) {
     return (
        <div className="flex flex-col items-center justify-center h-96">
            <CakeLoader />
            <p className="mt-4 text-lg text-muted-foreground">Loading pre-orders...</p>
        </div>
    );
  }

  return (
    <PreOrdersReportClient initialPreOrders={sales} />
  );
}

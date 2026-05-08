
"use client";

import { useEffect, useState } from 'react';
import { PreOrdersReportClient } from "@/components/pre-orders-report-client";
import { getSales } from "@/services/sales-service";
import { useAuth } from '@/context/auth-context';
import { CakeLoader } from '@/components/cake-loader';
import type { Sale } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default function PreOrdersReportPage() {
  const { currentStore } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentStore) {
      setLoading(false);
      return;
    };

    setLoading(true);
    getSales(currentStore.id)
      .then(fetchedSales => {
        const preOrders = fetchedSales.filter(s => s.isPreOrder);
        setSales(preOrders);
        setLoading(false);
      })
      .catch(error => {
        console.error("Failed to load pre-orders data:", error);
        setLoading(false);
      });
  }, [currentStore]);
  
  if (loading) {
     return (
        <div className="flex flex-col items-center justify-center h-full">
            <CakeLoader />
            <p className="mt-4 text-lg text-muted-foreground">Loading pre-orders report...</p>
        </div>
    );
  }

  return (
    <div className="p-6">
      <PreOrdersReportClient initialPreOrders={sales} />
    </div>
  );
}

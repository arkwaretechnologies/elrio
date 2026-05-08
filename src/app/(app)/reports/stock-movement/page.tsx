
"use client";

import { useEffect, useState } from 'react';
import { StockMovementReportClient } from "@/components/stock-movement-report-client";
import { getSales } from "@/services/sales-service";
import { useAuth } from '@/context/auth-context';
import { CakeLoader } from '@/components/cake-loader';
import type { Sale } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default function StockMovementPage() {
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
        setSales(fetchedSales);
        setLoading(false);
      })
      .catch(error => {
        console.error("Failed to load sales data for stock movement:", error);
        setLoading(false);
      });
  }, [currentStore]);
  
  if (loading) {
     return (
        <div className="flex flex-col items-center justify-center h-full">
            <CakeLoader />
            <p className="mt-4 text-lg text-muted-foreground">Loading stock movement data...</p>
        </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto">
      <StockMovementReportClient initialSales={sales} />
    </div>
  );
}

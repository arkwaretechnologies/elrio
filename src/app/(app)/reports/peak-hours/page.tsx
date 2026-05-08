
"use client";

import { useEffect, useState } from 'react';
import { PeakHoursReportClient } from "@/components/peak-hours-report-client";
import { getSales } from "@/services/sales-service";
import { useAuth } from '@/context/auth-context';
import { CakeLoader } from '@/components/cake-loader';
import type { Sale } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default function PeakHoursReportPage() {
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
        console.error("Failed to load sales data for peak hours report:", error);
        setLoading(false);
      });
  }, [currentStore]);
  
  if (loading) {
     return (
        <div className="flex flex-col items-center justify-center h-full">
            <CakeLoader />
            <p className="mt-4 text-lg text-muted-foreground">Analyzing sales data...</p>
        </div>
    );
  }

  return (
    <div className="p-6">
      <PeakHoursReportClient initialSales={sales} />
    </div>
  );
}

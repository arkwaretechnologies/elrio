
"use client";

import { useEffect, useState } from 'react';
import { PeakHoursReportClient } from "@/components/peak-hours-report-client";
import { getSales } from "@/services/sales-service";
import { CakeLoader } from '@/components/cake-loader';
import type { Sale } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default function AdminPeakHoursReportPage({ selectedStoreId }: { selectedStoreId?: string }) {
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
        setSales(fetchedSales);
        setLoading(false);
      })
      .catch(error => {
        console.error("Failed to load sales data for peak hours report:", error);
        setLoading(false);
      });
  }, [selectedStoreId]);
  
  if (loading) {
     return (
        <div className="flex flex-col items-center justify-center h-96">
            <CakeLoader />
            <p className="mt-4 text-lg text-muted-foreground">Analyzing sales data...</p>
        </div>
    );
  }

  return (
    <PeakHoursReportClient initialSales={sales} />
  );
}

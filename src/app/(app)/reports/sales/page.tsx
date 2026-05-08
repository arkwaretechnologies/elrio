
"use client";

import { useEffect, useState } from 'react';
import { SalesReportClient } from "@/components/sales-report-client";
import { getSales } from "@/services/sales-service";
import { useAuth } from '@/context/auth-context';
import { CakeLoader } from '@/components/cake-loader';
import type { Sale } from '@/lib/types';
import { DateRange } from 'react-day-picker';
import { subDays } from 'date-fns';

export const dynamic = 'force-dynamic';

export default function SalesReportPage() {
  const { currentStore } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });

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
        console.error("Failed to load sales data:", error);
        setLoading(false);
      });
  }, [currentStore]);
  
  if (loading) {
     return (
        <div className="flex flex-col items-center justify-center h-full">
            <CakeLoader />
            <p className="mt-4 text-lg text-muted-foreground">Loading sales report...</p>
        </div>
    );
  }

  return (
    <div className="p-6">
      <SalesReportClient initialSales={sales} />
    </div>
  );
}


"use client";

import { useEffect, useState } from 'react';
import { OrderHistoryClient } from "@/components/order-history-client";
import { getSales } from "@/services/sales-service";
import { getPayments } from "@/services/payment-service";
import { CakeLoader } from '@/components/cake-loader';
import type { Sale, Payment } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default function AdminOrderHistoryPage({ selectedStoreId }: { selectedStoreId?: string }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedStoreId) {
      setSales([]);
      setPayments([]);
      setLoading(false);
      return;
    };

    setLoading(true);
    Promise.all([
      getSales(selectedStoreId),
      getPayments(selectedStoreId)
    ]).then(([fetchedSales, fetchedPayments]) => {
      setSales(fetchedSales);
      setPayments(fetchedPayments);
      setLoading(false);
    }).catch(error => {
      console.error("Failed to load transaction data for order history report:", error);
      setLoading(false);
    });
  }, [selectedStoreId]);
  
  if (loading) {
     return (
        <div className="flex flex-col items-center justify-center h-96">
            <CakeLoader />
            <p className="mt-4 text-lg text-muted-foreground">Loading order history...</p>
        </div>
    );
  }

  return (
    <OrderHistoryClient initialSales={sales} initialPayments={payments} />
  );
}


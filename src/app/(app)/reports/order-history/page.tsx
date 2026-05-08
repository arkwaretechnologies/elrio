
"use client";

import { useEffect, useState } from 'react';
import { OrderHistoryClient } from "@/components/order-history-client";
import { getSales } from "@/services/sales-service";
import { getPayments } from "@/services/payment-service";
import { useAuth } from '@/context/auth-context';
import { CakeLoader } from '@/components/cake-loader';
import type { Sale, Payment } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default function OrderHistoryPage() {
  const { currentStore } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentStore) {
      setLoading(false);
      return;
    };

    setLoading(true);
    Promise.all([
      getSales(currentStore.id),
      getPayments(currentStore.id)
    ]).then(([fetchedSales, fetchedPayments]) => {
      setSales(fetchedSales);
      setPayments(fetchedPayments);
      setLoading(false);
    }).catch(error => {
      console.error("Failed to load transaction data for order history:", error);
      setLoading(false);
    });
  }, [currentStore]);
  
  if (loading) {
     return (
        <div className="flex flex-col items-center justify-center h-full">
            <CakeLoader />
            <p className="mt-4 text-lg text-muted-foreground">Loading order history...</p>
        </div>
    );
  }

  return (
    <div className="p-6">
      <OrderHistoryClient initialSales={sales} initialPayments={payments} />
    </div>
  );
}



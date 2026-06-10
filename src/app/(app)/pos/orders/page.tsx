"use client";

import { useEffect, useMemo, useState } from "react";
import { endOfDay, startOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import { OrderHistoryClient } from "@/components/order-history-client";
import { getSales } from "@/services/sales-service";
import { getPayments } from "@/services/payment-service";
import { useAuth } from "@/context/auth-context";
import { CakeLoader } from "@/components/cake-loader";
import { PosOrdersQueueSidebar } from "@/components/pos-orders-queue-sidebar";
import { RecentCompletedOrders } from "@/components/recent-completed-orders";
import { filterPaidSalesInRange } from "@/lib/unified-orders-queue";
import type { Sale, Payment } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function PosOrdersPage() {
  const { loading: authLoading, currentStore } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadedStoreId, setLoadedStoreId] = useState<string | null>(null);
  const [liveSales, setLiveSales] = useState<Sale[]>([]);
  const [queueDate, setQueueDate] = useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });

  const storeId = currentStore?.id;
  const loadingOrders = !!storeId && loadedStoreId !== storeId;

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    Promise.all([getSales(storeId), getPayments(storeId)])
      .then(([fetchedSales, fetchedPayments]) => {
        if (!cancelled) {
          setSales(fetchedSales);
          setLiveSales(fetchedSales);
          setPayments(fetchedPayments);
          setLoadedStoreId(storeId);
        }
      })
      .catch((err) => {
        console.error("Failed to load orders:", err);
        if (!cancelled) {
          setSales([]);
          setLiveSales([]);
          setPayments([]);
          setLoadedStoreId(storeId);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const paidInRange = useMemo(
    () => filterPaidSalesInRange(liveSales, queueDate),
    [liveSales, queueDate],
  );

  if (authLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <CakeLoader />
        <p className="mt-4 text-lg text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!currentStore) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6">
        <p className="text-muted-foreground">Please select a store to view orders.</p>
      </div>
    );
  }

  if (loadingOrders) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <CakeLoader />
        <p className="mt-4 text-lg text-muted-foreground">Loading orders…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 sm:p-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 space-y-6 overflow-y-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        </div>
        <OrderHistoryClient
          key={currentStore.id}
          initialSales={sales}
          initialPayments={payments}
          variant="embedded"
          dateRange={queueDate}
          onDateRangeChange={setQueueDate}
          onSalesChange={setLiveSales}
        />
        <RecentCompletedOrders sales={liveSales} />
      </div>
      <div className="w-full shrink-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:w-80 lg:shrink-0 xl:w-96">
        <PosOrdersQueueSidebar
          storeId={currentStore.id}
          paidSalesInRange={paidInRange}
        />
      </div>
    </div>
  );
}

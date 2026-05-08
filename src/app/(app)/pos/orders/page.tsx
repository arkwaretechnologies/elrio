"use client";

import { useEffect, useState } from "react";
import { OrderHistoryClient } from "@/components/order-history-client";
import { getSales } from "@/services/sales-service";
import { getPayments } from "@/services/payment-service";
import { useAuth } from "@/context/auth-context";
import { CakeLoader } from "@/components/cake-loader";
import { PosOpenOrdersPanel } from "@/components/pos-open-orders-panel";
import type { Sale, Payment } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function PosOrdersPage() {
  const { loading: authLoading, currentStore } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadedStoreId, setLoadedStoreId] = useState<string | null>(null);

  const storeId = currentStore?.id;
  const loadingOrders = !!storeId && loadedStoreId !== storeId;

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    Promise.all([getSales(storeId), getPayments(storeId)])
      .then(([fetchedSales, fetchedPayments]) => {
        if (!cancelled) {
          setSales(fetchedSales);
          setPayments(fetchedPayments);
          setLoadedStoreId(storeId);
        }
      })
      .catch((err) => {
        console.error("Failed to load orders:", err);
        if (!cancelled) {
          setSales([]);
          setPayments([]);
          setLoadedStoreId(storeId);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

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
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        <p className="text-sm text-muted-foreground">
          Held orders (pay later) appear below. Paid history is dine-in and takeout; pick a date range to filter.
        </p>
      </div>
      <PosOpenOrdersPanel storeId={currentStore.id} />
      <OrderHistoryClient initialSales={sales} initialPayments={payments} variant="embedded" />
    </div>
  );
}

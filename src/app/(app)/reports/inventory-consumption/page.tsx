
"use client";

import { useEffect, useState } from 'react';
import { InventoryConsumptionReportClient } from "@/components/inventory-consumption-report-client";
import { getInventoryLogs } from "@/services/log-service";
import { getInventoryItems } from '@/services/inventory-service';
import { useAuth } from '@/context/auth-context';
import { CakeLoader } from '@/components/cake-loader';
import type { InventoryLog, InventoryItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default function InventoryConsumptionPage() {
  const { currentStore } = useAuth();
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentStore) {
      setLoading(false);
      return;
    };
    
    setLoading(true);
    Promise.all([
      getInventoryLogs(currentStore.id),
      getInventoryItems(),
    ]).then(([fetchedLogs, fetchedInventoryItems]) => {
      setLogs(fetchedLogs);
      setInventoryItems(fetchedInventoryItems);
      setLoading(false);
    }).catch(error => {
      console.error("Failed to load inventory consumption data:", error);
      setLoading(false);
    });
  }, [currentStore]);
  
  if (loading) {
     return (
        <div className="flex flex-col items-center justify-center h-full">
            <CakeLoader />
            <p className="mt-4 text-lg text-muted-foreground">Loading report data...</p>
        </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto">
      <InventoryConsumptionReportClient initialLogs={logs} allInventoryItems={inventoryItems} />
    </div>
  );
}

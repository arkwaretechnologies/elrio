
"use client";

import { useEffect, useState } from 'react';
import { InventoryConsumptionReportClient } from "@/components/inventory-consumption-report-client";
import { getInventoryLogs } from "@/services/log-service";
import { getInventoryItems } from '@/services/inventory-service';
import { CakeLoader } from '@/components/cake-loader';
import type { InventoryLog, InventoryItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default function AdminInventoryConsumptionPage({ selectedStoreId }: { selectedStoreId?: string }) {
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedStoreId) {
      setLogs([]);
      setInventoryItems([]);
      setLoading(false);
      return;
    };
    
    setLoading(true);
    Promise.all([
      getInventoryLogs(selectedStoreId),
      getInventoryItems(),
    ]).then(([fetchedLogs, fetchedInventoryItems]) => {
      setLogs(fetchedLogs);
      setInventoryItems(fetchedInventoryItems);
      setLoading(false);
    }).catch(error => {
      console.error("Failed to load inventory consumption data for admin:", error);
      setLoading(false);
    });
  }, [selectedStoreId]);
  
  if (loading) {
     return (
        <div className="flex flex-col items-center justify-center h-96">
            <CakeLoader />
            <p className="mt-4 text-lg text-muted-foreground">Loading report data...</p>
        </div>
    );
  }

  return (
    <InventoryConsumptionReportClient initialLogs={logs} allInventoryItems={inventoryItems} />
  );
}

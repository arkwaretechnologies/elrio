
"use client";

import { useEffect, useState } from 'react';
import { InventoryLogsClient } from "@/components/inventory-logs-client";
import { getInventoryItems } from "@/services/inventory-service";
import { getInventoryLogs } from "@/services/log-service";
import { CakeLoader } from '@/components/cake-loader';
import type { InventoryLog, InventoryItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default function AdminInventoryLogsPage({ selectedStoreId }: { selectedStoreId?: string }) {
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedStoreId) {
      setLogs([]);
      setItems([]);
      setLoading(false);
      return;
    };
    
    setLoading(true);
    Promise.all([
      getInventoryLogs(selectedStoreId),
      getInventoryItems()
    ]).then(([fetchedLogs, fetchedItems]) => {
      setLogs(fetchedLogs);
      setItems(fetchedItems);
      setLoading(false);
    }).catch(error => {
      console.error("Failed to load inventory logs for admin:", error);
      setLoading(false);
    });
  }, [selectedStoreId]);
  
  if (loading) {
     return (
        <div className="flex flex-col items-center justify-center h-96">
            <CakeLoader />
            <p className="mt-4 text-lg text-muted-foreground">Loading logs...</p>
        </div>
    );
  }

  return (
    <InventoryLogsClient initialLogs={logs} inventoryItems={items} />
  );
}

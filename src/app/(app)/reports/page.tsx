
"use client";

import { useEffect, useState } from 'react';
import { InventoryLogsClient } from "@/components/inventory-logs-client";
import { getInventoryItems } from "@/services/inventory-service";
import { getInventoryLogs } from "@/services/log-service";
import { useAuth } from '@/context/auth-context';
import { CakeLoader } from '@/components/cake-loader';
import type { InventoryLog, InventoryItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default function ReportsPage() {
  const { currentStore } = useAuth();
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentStore) {
      setLoading(false);
      return;
    };
    
    setLoading(true);
    Promise.all([
      getInventoryLogs(currentStore.id),
      getInventoryItems()
    ]).then(([fetchedLogs, fetchedItems]) => {
      setLogs(fetchedLogs);
      setItems(fetchedItems);
      setLoading(false);
    }).catch(error => {
      console.error("Failed to load report data:", error);
      setLoading(false);
    });
  }, [currentStore]);
  
  if (loading) {
     return (
        <div className="flex flex-col items-center justify-center h-full">
            <CakeLoader />
            <p className="mt-4 text-lg text-muted-foreground">Loading logs...</p>
        </div>
    );
  }

  return (
    <div className="p-6">
      <InventoryLogsClient initialLogs={logs} inventoryItems={items} />
    </div>
  );
}

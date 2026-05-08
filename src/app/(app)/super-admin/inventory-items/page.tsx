
"use client";

import { useEffect, useState } from 'react';
import { InventoryItemClient } from "@/components/inventory-item-client";
import { getInventoryItems } from "@/services/inventory-service";
import { useAuth } from '@/context/auth-context';
import { CakeLoader } from '@/components/cake-loader';
import type { InventoryItem } from '@/lib/types';

export default function SuperAdminInventoryItemsPage() {
  const { user } = useAuth();
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getInventoryItems()
      .then(fetchedItems => {
        setInventoryItems(fetchedItems);
        setLoading(false);
      })
      .catch(error => {
        console.error("Failed to load inventory items for admin:", error);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <CakeLoader />
        <p className="mt-4 text-lg text-muted-foreground">Loading all inventory items...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <InventoryItemClient
        initialInventoryItems={inventoryItems}
        initialStoreInventory={[]} // Admin view doesn't deal with store-specific stock
        isAdminView={true} // This view is ALWAYS for admin master list management
      />
    </div>
  );
}

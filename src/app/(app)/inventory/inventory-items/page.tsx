
"use client";

import { useEffect, useState } from 'react';
import { InventoryItemClient } from "@/components/inventory-item-client";
import { getInventoryItems, getStoreInventory } from "@/services/inventory-service";
import { CakeLoader } from '@/components/cake-loader';
import type { InventoryItem, StoreInventory } from '@/lib/types';
import { useAuth } from '@/context/auth-context';

export default function InventoryItemsPage() {
  const { user, currentStore } = useAuth();
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [storeInventory, setStoreInventory] = useState<StoreInventory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentStore) {
      setLoading(true);
      Promise.all([
        getInventoryItems(),
        getStoreInventory(currentStore.id)
      ]).then(([fetchedItems, fetchedStoreInventory]) => {
        setInventoryItems(fetchedItems);
        setStoreInventory(fetchedStoreInventory);
        setLoading(false);
      }).catch(error => {
        console.error("Failed to load inventory data:", error);
        setLoading(false);
      });
    } else if (!currentStore && user) {
      // If there's a user but no store selected yet, keep loading
      setLoading(true);
    } else {
      // No user, no store
      setLoading(false);
    }
  }, [currentStore, user]);

  if (loading || !currentStore) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <CakeLoader />
        <p className="mt-4 text-lg text-muted-foreground">Loading inventory...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <InventoryItemClient 
        initialInventoryItems={inventoryItems}
        initialStoreInventory={storeInventory}
        isAdminView={false} // This view is NEVER for admin master list management
      />
    </div>
  );
}

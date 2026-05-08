
"use client";

import { useEffect, useState } from 'react';
import { ProductReportClient } from "@/components/product-report-client";
import { getMenuItemsAsBaseProducts } from "@/services/menu-service";
import { getStoreInventory } from "@/services/inventory-service";
import { CakeLoader } from '@/components/cake-loader';
import type { BaseProduct, StoreInventory } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default function AdminProductReportPage({ selectedStoreId }: { selectedStoreId?: string }) {
  const [products, setProducts] = useState<BaseProduct[]>([]);
  const [inventoryItems, setInventoryItems] = useState<StoreInventory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedStoreId) {
      setProducts([]);
      setInventoryItems([]);
      setLoading(false);
      return;
    };
    
    setLoading(true);
    Promise.all([
      getMenuItemsAsBaseProducts(selectedStoreId),
      getStoreInventory(selectedStoreId),
    ]).then(([fetchedProducts, fetchedInventoryItems]) => {
      setProducts(fetchedProducts);
      setInventoryItems(fetchedInventoryItems);
      setLoading(false);
    }).catch(error => {
      console.error("Failed to load product report data for admin:", error);
      setLoading(false);
    });
    
  }, [selectedStoreId]);
  
  if (loading) {
     return (
        <div className="flex flex-col items-center justify-center h-96">
            <CakeLoader />
            <p className="mt-4 text-lg text-muted-foreground">Loading products report...</p>
        </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <ProductReportClient initialProducts={products} inventoryItems={inventoryItems} />
    </div>
  );
}

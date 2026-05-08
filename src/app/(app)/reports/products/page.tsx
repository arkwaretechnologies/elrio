
"use client";

import { useEffect, useState } from 'react';
import { ProductReportClient } from "@/components/product-report-client";
import { getMenuItemsAsBaseProducts } from "@/services/menu-service";
import { getInventoryItems } from "@/services/inventory-service";
import { useAuth } from '@/context/auth-context';
import { CakeLoader } from '@/components/cake-loader';
import type { BaseProduct, InventoryItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default function ProductReportPage() {
  const { currentStore } = useAuth();
  const [products, setProducts] = useState<BaseProduct[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentStore) {
      setLoading(false);
      return;
    };
    
    setLoading(true);
    Promise.all([
      getMenuItemsAsBaseProducts(currentStore.id),
      getInventoryItems(),
    ]).then(([fetchedProducts, fetchedInventoryItems]) => {
      setProducts(fetchedProducts);
      setInventoryItems(fetchedInventoryItems);
      setLoading(false);
    }).catch(error => {
      console.error("Failed to load product report data:", error);
      setLoading(false);
    });
    
  }, [currentStore]);
  
  if (loading || !currentStore) {
     return (
        <div className="flex flex-col items-center justify-center h-full">
            <CakeLoader />
            <p className="mt-4 text-lg text-muted-foreground">Loading products report...</p>
        </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto">
      <ProductReportClient initialProducts={products} inventoryItems={inventoryItems} />
    </div>
  );
}

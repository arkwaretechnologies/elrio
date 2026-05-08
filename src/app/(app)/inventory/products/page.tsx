
"use client";

import { useEffect, useState } from 'react';
import { ProductsClient } from "@/components/products-client";
import { getMenuItemsAsBaseProducts } from "@/services/menu-service";
import { getCategories } from "@/services/category-service";
import { getInventoryItems } from "@/services/inventory-service";
import { useAuth } from '@/context/auth-context';
import { CakeLoader } from '@/components/cake-loader';
import type { BaseProduct, Category, InventoryItem } from '@/lib/types';


export default function ProductsInventoryPage() {
  const { currentStore } = useAuth();
  const [baseProducts, setBaseProducts] = useState<BaseProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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
      getCategories(),
      getInventoryItems(),
    ]).then(([fetchedProducts, fetchedCategories, fetchedInventoryItems]) => {
      setBaseProducts(fetchedProducts);
      setCategories(fetchedCategories);
      setInventoryItems(fetchedInventoryItems);
      setLoading(false);
    }).catch(error => {
      console.error("Failed to load product data:", error);
      setLoading(false);
    });
    
  }, [currentStore]);
  
  if (loading || !currentStore) {
     return (
        <div className="flex flex-col items-center justify-center h-full">
            <CakeLoader />
            <p className="mt-4 text-lg text-muted-foreground">Loading products...</p>
        </div>
    );
  }

  return (
    <div className="p-6">
      <ProductsClient 
        baseProducts={baseProducts} 
        categories={categories}
        inventoryItems={inventoryItems}
      />
    </div>
  );
}

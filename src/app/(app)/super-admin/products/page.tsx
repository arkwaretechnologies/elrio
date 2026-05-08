
"use client";

import { useEffect, useState } from 'react';
import { ProductsClient } from "@/components/products-client";
import { getMenuItemsAsBaseProducts } from "@/services/menu-service";
import { getCategories } from "@/services/category-service";
import { getInventoryItems } from "@/services/inventory-service";
import { CakeLoader } from '@/components/cake-loader';
import type { BaseProduct, Category, InventoryItem } from '@/lib/types';


export default function SuperAdminProductsPage() {
  const [baseProducts, setBaseProducts] = useState<BaseProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      // Fetch all products, not specific to a store
      getMenuItemsAsBaseProducts(), 
      getCategories(),
      getInventoryItems(),
    ]).then(([fetchedProducts, fetchedCategories, fetchedInventoryItems]) => {
      setBaseProducts(fetchedProducts);
      setCategories(fetchedCategories);
      setInventoryItems(fetchedInventoryItems);
      setLoading(false);
    }).catch(error => {
      console.error("Failed to load product data for admin:", error);
      setLoading(false);
    });
  }, []);
  
  if (loading) {
     return (
        <div className="flex flex-col items-center justify-center h-full">
            <CakeLoader />
            <p className="mt-4 text-lg text-muted-foreground">Loading all products...</p>
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

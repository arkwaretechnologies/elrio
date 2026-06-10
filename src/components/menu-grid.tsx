
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { getMenuItems, getMenuItemsAsBaseProducts } from '@/services/menu-service';
import { getCategories } from '@/services/category-service';
import type { BaseProduct, Category, CartItem, ProductVariant, MenuItem, StoreInventory } from '@/lib/types';
import { consumptionDeductsStock } from '@/lib/types';
import { useCart } from '@/context/cart-context';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Loader, ShoppingBasket, Search, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Icon } from './icon';
import { VariantSelectionDialog } from './variant-selection-dialog';
import { AssortedProductDialog } from './assorted-product-dialog';
import { CustomPriceDialog } from './custom-price-dialog';
import { Input } from './ui/input';
import {
  readPosMenuSessionCache,
  writePosMenuSessionCache,
} from '@/lib/pos-menu-session-cache';

function pickInitialCategory(fetchedCategories: Category[]): string {
  const preferred = ['burgers', 'chicken', 'rice meals', 'cookies', 'bread rolls', 'sides', 'drinks'];
  let initialCategory = 'All';
  for (const p of preferred) {
    const c = fetchedCategories.find((x) => x.name.toLowerCase() === p);
    if (c) {
      initialCategory = c.name;
      break;
    }
  }
  return initialCategory;
}

export function MenuGrid() {
  const [baseProducts, setBaseProducts] = useState<BaseProduct[]>([]);
  const [allMenuItems, setAllMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<BaseProduct | null>(null);
  const [configurableProduct, setConfigurableProduct] = useState<BaseProduct | null>(null);
  const [customPriceProduct, setCustomPriceProduct] = useState<{product: BaseProduct, variant: ProductVariant} | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { addToCart } = useCart();
  const { currentStore, inventory } = useAuth();

  const inventoryMap = useMemo(() => {
    return new Map(inventory.map(item => [item.inventoryItemId, item]));
  }, [inventory]);

  useEffect(() => {
    if (!currentStore) return;

    let cancelled = false;

    const cached = readPosMenuSessionCache(currentStore.id);
    if (cached) {
      setBaseProducts(cached.baseProducts);
      setCategories(cached.categories);
      setAllMenuItems(cached.menuItems);
      setActiveCategory(pickInitialCategory(cached.categories));
      setLoading(false);
    } else {
      setLoading(true);
    }

    Promise.all([
      getMenuItemsAsBaseProducts(currentStore.id),
      getCategories(),
      getMenuItems(currentStore.id),
    ])
      .then(([products, fetchedCategories, menuItems]) => {
        if (cancelled) return;
        setBaseProducts(products);
        setCategories(fetchedCategories);
        setAllMenuItems(menuItems);
        setActiveCategory(pickInitialCategory(fetchedCategories));
        writePosMenuSessionCache(currentStore.id, {
          baseProducts: products,
          categories: fetchedCategories,
          menuItems,
        });
      })
      .catch((error) => {
        console.error('Failed to fetch menu items:', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentStore]);
  
  const displayCategories = useMemo(() => {
    const order = ['burgers', 'chicken', 'rice meals', 'cookies', 'bread rolls', 'sides', 'drinks', 'snacks', 'other'];
    const rank = (name: string) => {
      const i = order.indexOf(name.toLowerCase());
      return i === -1 ? order.length : i;
    };
    const sortedCategories = [...categories].sort(
      (a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name)
    );

    return [{id: 'All', name: 'All', description: '', icon: 'ShoppingBasket'}, ...sortedCategories];
  }, [categories]);

  const filteredItems = useMemo(() => {
    let items = baseProducts;

    if (activeCategory !== 'All') {
      items = items.filter(item => item.category === activeCategory);
    }

    if (searchQuery) {
      items = items.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return items;
  }, [baseProducts, activeCategory, searchQuery]);


  const getAvailableUnitsForVariant = (variant: ProductVariant) => {
    if (variant.isPreOrder) return Infinity;
    if (!variant.inventoryConsumption || variant.inventoryConsumption.length === 0) return 0;
    
    if (variant.inventoryConsumption.length === 0) return 0; // If it consumes nothing, it's not available unless pre-order

    const deductingLines = variant.inventoryConsumption.filter((c) =>
      consumptionDeductsStock(c, inventoryMap.get(c.inventoryItemId)),
    );
    if (deductingLines.length === 0) return Infinity;

    const possibleUnits = deductingLines.map(c => {
        const inventoryItem = inventoryMap.get(c.inventoryItemId);
        const stock = inventoryItem?.stock ?? 0;
        const quantityNeeded = c.quantity;
        
        if (quantityNeeded === 0) return Infinity; // Avoid division by zero
        
        return Math.floor(stock / quantityNeeded);
    });
    
    // The number of bundles we can make is limited by the ingredient we have the least of.
    return Math.min(...possibleUnits);
  };


  const handleProductClick = (product: BaseProduct) => {
    // If there's only one variant, handle it directly
    if (product.variants.length === 1) {
      const variant = product.variants[0];

      // If it's a custom price item, show the price dialog
      if (variant.isCustomPrice) {
        setCustomPriceProduct({ product, variant });
        return;
      }
      
      // If it's a configurable box, show the assorted item dialog
      if (variant.configurableOptions) {
        setConfigurableProduct(product);
        setSelectedVariant(variant);
        return;
      }
      
      // Otherwise, it's a standard item, add directly to cart
      const cartItem: CartItem = {
        id: `${product.id}_${variant.id}`,
        baseProductId: product.id,
        variantId: variant.id,
        name: product.name, // Use base product name for single variant items
        price: variant.price,
        quantity: 1,
        imageUrl: product.imageUrl,
        inventoryConsumption: variant.inventoryConsumption || [],
        isPreOrder: variant.isPreOrder,
        originalMenuItem: {
          ...variant,
          id: variant.id,
          name: product.name,
          category: product.category,
          imageUrl: product.imageUrl,
          aiHint: product.aiHint,
          baseProductId: product.id,
          variantName: variant.name,
          inventoryConsumption: variant.inventoryConsumption || [],
        }
      };
      addToCart(cartItem);
    } else {
      // If there are multiple variants, show the selection dialog
      setSelectedProduct(product);
    }
  };
  
  const getPriceRange = (product: BaseProduct) => {
    if (!product.variants || product.variants.length === 0) return 'N/A';
    if (product.variants.some(v => v.isCustomPrice)) return 'Custom Price';
    if (product.variants.length === 1) return `₱${product.variants[0].price.toFixed(2)}`;

    const prices = product.variants.map(v => v.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    if (minPrice === maxPrice) return `₱${minPrice.toFixed(2)}`;
    return `₱${minPrice.toFixed(2)} - ₱${maxPrice.toFixed(2)}`;
  };
  
  const getAvailableUnitsForProduct = (product: BaseProduct) => {
    if (isProductNonInventoried(product)) return Infinity;
    
    if (product.variants.some(v => v.configurableOptions || v.isCustomPrice)) {
        return Infinity;
    }

    const variantUnits = product.variants.map(variant => getAvailableUnitsForVariant(variant));

    return variantUnits.reduce((total, units) => total + units, 0);
  }

  const isProductNonInventoried = (product: BaseProduct) => {
    // A product is non-inventoried if ALL its variants have no inventory consumption.
    return product.variants.every(v => !v.inventoryConsumption || v.inventoryConsumption.length === 0);
  }

  const handleCustomPriceSubmit = (price: number) => {
    if (!customPriceProduct) return;
    const { product, variant } = customPriceProduct;

    const cartItem: CartItem = {
      id: `${product.id}_${variant.id}_${Date.now()}`, // Unique ID for custom priced items
      baseProductId: product.id,
      variantId: variant.id,
      name: product.variants.length > 1 ? `${product.name} - ${variant.name}` : product.name,
      price: price,
      quantity: 1,
      imageUrl: product.imageUrl,
      inventoryConsumption: variant.inventoryConsumption || [],
      isPreOrder: variant.isPreOrder,
      originalMenuItem: {
        ...variant,
        id: variant.id,
        name: product.name,
        category: product.category,
        imageUrl: product.imageUrl,
        aiHint: product.aiHint,
        baseProductId: product.id,
        variantName: variant.name,
        inventoryConsumption: variant.inventoryConsumption || [],
      }
    };
    addToCart(cartItem);
    setCustomPriceProduct(null);
  };
  
  const handleVariantSelected = (variant: ProductVariant, product: BaseProduct) => {
    if (variant.isCustomPrice) {
      setCustomPriceProduct({ product, variant });
      setSelectedProduct(null); // Close the variant dialog
      return;
    }

    if (variant.configurableOptions) {
      setConfigurableProduct(product);
      setSelectedVariant(variant);
      setSelectedProduct(null);
      return;
    }

    const cartItem: CartItem = {
      id: `${product.id}_${variant.id}`,
      baseProductId: product.id,
      variantId: variant.id,
      name: `${product.name} - ${variant.name}`,
      price: variant.price,
      quantity: 1,
      imageUrl: product.imageUrl,
      inventoryConsumption: variant.inventoryConsumption || [],
      isPreOrder: variant.isPreOrder,
      originalMenuItem: {
        ...variant,
        id: variant.id,
        name: `${product.name} - ${variant.name}`,
        category: product.category,
        imageUrl: product.imageUrl,
        aiHint: product.aiHint,
        baseProductId: product.id,
        variantName: variant.name,
        inventoryConsumption: variant.inventoryConsumption || [],
      },
    };
    addToCart(cartItem);
    setSelectedProduct(null);
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold font-headline tracking-tight text-foreground">Point of Sale</h2>
            <p className="text-muted-foreground text-sm sm:text-base">Select items to add to the current order</p>
          </div>
          <Badge variant="secondary" className="text-sm font-medium border border-border/60 shadow-sm">
              {filteredItems.length} {filteredItems.length === 1 ? 'product' : 'products'} available
          </Badge>
        </div>

        <div className="relative w-full max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
            <Input 
                placeholder="Search products..."
                className="pl-11 pr-10 h-11 rounded-full border-border/80 bg-card shadow-sm transition-shadow focus-visible:ring-2 focus-visible:ring-ring/80"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoComplete="off"
            />
            {searchQuery && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Clear search</span>
              </Button>
            )}
        </div>

        <div className="flex flex-wrap gap-2">
          {displayCategories.map(category => (
              <Button 
                  key={category.id} 
                  variant={activeCategory === category.name ? 'default' : 'outline'}
                  className={
                    activeCategory === category.name
                      ? 'rounded-full shadow-md shadow-primary/25 font-semibold'
                      : 'rounded-full border-border/70 bg-card hover:bg-accent hover:border-ring/30'
                  }
                  onClick={() => setActiveCategory(category.name)}
              >
                  <Icon name={category.icon as any} className="mr-2 h-4 w-4" />
                  {category.name}
              </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 pt-2">
          {loading ? (
            Array.from({ length: 8 }).map((_, index) => (
              <Card key={index}>
                <CardContent className="p-0">
                  <Skeleton className="w-full h-40" />
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </CardContent>
                <CardFooter className="p-4 pt-0 flex justify-between items-center">
                  <Skeleton className="h-6 w-1/4" />
                </CardFooter>
              </Card>
            ))
          ) : (
            filteredItems.map((product, index) => {
              const isConfigurable = product.variants.some(v => v.configurableOptions);
              const availableUnits = getAvailableUnitsForProduct(product);
              const isNonInventoried = isProductNonInventoried(product);

              return (
                <Card 
                  key={product.id} 
                  className="overflow-hidden flex flex-col group transition-all duration-200 ease-in-out rounded-xl border-border/70 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 cursor-pointer"
                  onClick={() => handleProductClick(product)}
                >
                  <CardContent className="p-0 relative flex-grow">
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      width={300}
                      height={200}
                      data-ai-hint={product.aiHint}
                      className="w-full h-40 object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      priority={index < 8}
                      sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
                      placeholder={product.blurDataURL ? 'blur' : 'empty'}
                      blurDataURL={product.blurDataURL}
                    />
                    {isConfigurable && (
                         <Badge className="absolute top-2 right-2 bg-sky-500 text-white border-0 shadow-sm hover:bg-sky-500">Assorted</Badge>
                    )}
                     <div className="p-4">
                      <h3 className="font-semibold text-lg">{product.name}</h3>
                      <p className="text-sm text-muted-foreground">
                         {isConfigurable
                            ? 'Customizable box'
                            : isNonInventoried
                                ? 'Available'
                                : Number.isFinite(availableUnits)
                                  ? `${availableUnits} units available`
                                  : 'Available'}
                      </p>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between items-center p-4 pt-0 border-t border-border/50 bg-muted/20">
                    <p className="text-lg font-bold text-primary tabular-nums">{getPriceRange(product)}</p>
                  </CardFooter>
                </Card>
              )
            })
          )}
        </div>
      </div>
      
      {selectedProduct && (
        <VariantSelectionDialog
          product={selectedProduct}
          open={!!selectedProduct}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setSelectedProduct(null);
            }
          }}
          onVariantSelected={handleVariantSelected}
        />
      )}

      {configurableProduct && selectedVariant && (
        <AssortedProductDialog
            product={configurableProduct}
            variant={selectedVariant}
            allMenuItems={allMenuItems}
            open={!!configurableProduct}
            onOpenChange={(isOpen) => {
                if (!isOpen) {
                    setConfigurableProduct(null);
                    setSelectedVariant(null);
                }
            }}
            onAddToCart={(configuredCartItem) => {
                addToCart(configuredCartItem);
                setConfigurableProduct(null);
                setSelectedVariant(null);
            }}
        />
      )}

      {customPriceProduct && (
        <CustomPriceDialog
          productName={customPriceProduct.product.name}
          variantName={customPriceProduct.variant.name}
          open={!!customPriceProduct}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setCustomPriceProduct(null);
            }
          }}
          onSubmit={handleCustomPriceSubmit}
        />
      )}
    </>
  );
}

    
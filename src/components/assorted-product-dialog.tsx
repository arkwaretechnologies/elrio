

"use client";

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Minus } from 'lucide-react';
import type { BaseProduct, MenuItem, CartItem, SelectedConfigurationItem, ProductVariant } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface AssortedProductDialogProps {
  product: BaseProduct;
  variant: ProductVariant;
  allMenuItems: MenuItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToCart: (configuredCartItem: CartItem) => void;
}

export function AssortedProductDialog({
  product,
  variant,
  allMenuItems,
  open,
  onOpenChange,
  onAddToCart,
}: AssortedProductDialogProps) {
  const [selection, setSelection] = useState<Record<string, number>>({});
  const { toast } = useToast();

  const options = variant.configurableOptions;

  const allowedItems = useMemo(() => {
    if (!options) return [];
    const allowedIds = new Set(options.allowedProductIds);
    return allMenuItems.filter(item => allowedIds.has(item.id));
  }, [options, allMenuItems]);

  const totalSelected = useMemo(() => {
    return Object.values(selection).reduce((sum, qty) => sum + qty, 0);
  }, [selection]);

  const isSelectionComplete = totalSelected === options?.selectionLimit;

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    const currentTotal = totalSelected - (selection[itemId] || 0);
    const limit = options?.selectionLimit || 0;

    if (newQuantity < 0) return;

    if (currentTotal + newQuantity > limit) {
        toast({
            variant: "destructive",
            title: "Selection Limit Reached",
            description: `You can only select up to ${limit} items for this box.`,
        });
        return;
    }

    setSelection(prev => {
        const updated = { ...prev, [itemId]: newQuantity };
        if (newQuantity === 0) {
            delete updated[itemId];
        }
        return updated;
    });
  };
  
  const handleAddToCartClick = () => {
    if (!isSelectionComplete || !options) return;
    
    const selectedConfiguration: SelectedConfigurationItem[] = Object.entries(selection).map(([menuItemId, quantity]) => {
        const itemDetails = allowedItems.find(i => i.id === menuItemId);
        return {
            menuItemId,
            name: itemDetails?.name || 'Unknown Item',
            quantity,
            inventoryConsumption: itemDetails?.inventoryConsumption || []
        }
    });

    const cartItem: CartItem = {
      id: `${product.id}_${variant.id}`,
      baseProductId: product.id,
      variantId: variant.id,
      name: `${product.name} - ${variant.name}`,
      price: variant.price,
      quantity: 1,
      imageUrl: product.imageUrl,
      inventoryConsumption: [], // Stock is handled by the selected items in the configuration
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
        inventoryConsumption: [],
        configurableOptions: options
      },
      selectedConfiguration,
    };
    
    onAddToCart(cartItem);
    setSelection({}); // Reset for next time
  }

  if (!options) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if(!isOpen) setSelection({}); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Customize Your {product.name} ({variant.name})</DialogTitle>
          <DialogDescription>
            Select {options.selectionLimit} items to include in your box.
          </DialogDescription>
        </DialogHeader>

        <div className="my-4">
            <Badge 
                variant={isSelectionComplete ? "default" : "secondary"}
                className={`text-lg p-2 w-full justify-center ${isSelectionComplete ? 'bg-green-100 text-green-800' : ''}`}
            >
                {totalSelected} / {options.selectionLimit} items selected
            </Badge>
        </div>

        <ScrollArea className="h-96">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-4">
                {allowedItems.map(item => (
                    <div key={item.id} className="flex items-center gap-4 p-2 border rounded-lg">
                        <div className="flex-grow">
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-muted-foreground">₱{item.price.toFixed(2)} / pc</p>
                        </div>
                        <div className="flex items-center gap-2">
                             <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-7 w-7" 
                                onClick={() => handleQuantityChange(item.id, (selection[item.id] || 0) - 1)}
                            >
                                <Minus className="h-4 w-4" />
                            </Button>
                            <span className="font-bold w-6 text-center">{selection[item.id] || 0}</span>
                             <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-7 w-7" 
                                onClick={() => handleQuantityChange(item.id, (selection[item.id] || 0) + 1)}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </ScrollArea>
        
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            type="button" 
            disabled={!isSelectionComplete}
            onClick={handleAddToCartClick}
          >
            Add to Cart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

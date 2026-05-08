
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useCart } from '@/context/cart-context';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from './ui/separator';
import { Minus, Plus } from 'lucide-react';

interface SeniorDiscountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SeniorDiscountDialog({ open, onOpenChange }: SeniorDiscountDialogProps) {
  const { cartItems, applySeniorDiscount, clearSeniorDiscount, seniorDiscountDetails } = useCart();
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});

  useEffect(() => {
    // When the dialog opens, initialize the selection based on what's already in the cart context
    if (open) {
      const initialSelection = seniorDiscountDetails.items.reduce((acc, item) => {
        acc[item.itemId] = item.quantity;
        return acc;
      }, {} as Record<string, number>);
      setSelectedItems(initialSelection);
    }
  }, [open, seniorDiscountDetails.items]);

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    const cartItem = cartItems.find(ci => ci.id === itemId);
    if (!cartItem || newQuantity < 0 || newQuantity > cartItem.quantity) {
      return;
    }
    setSelectedItems(prev => ({ ...prev, [itemId]: newQuantity }));
  };

  const calculation = useMemo(() => {
    // This is the total price of only the items selected for the senior citizen discount.
    const grossBill = Object.entries(selectedItems).reduce((sum, [itemId, qty]) => {
        const cartItem = cartItems.find(ci => ci.id === itemId);
        return sum + (cartItem ? cartItem.price * qty : 0);
    }, 0);

    // 1. Remove the 12% VAT from the gross bill to get the VAT-exempt sales amount.
    const vatExemptSales = grossBill / 1.12;
    
    // 2. The senior discount is 20% of the VAT-exempt amount.
    const seniorDiscount = vatExemptSales * 0.20;

    return { grossBill, vatExemptSales, seniorDiscount };
  }, [selectedItems, cartItems]);
  
  const handleApplyDiscount = () => {
    const itemsToDiscount = Object.entries(selectedItems)
        .filter(([, qty]) => qty > 0)
        .map(([itemId, qty]) => ({ itemId, qty }));
    
    applySeniorDiscount(itemsToDiscount);
    onOpenChange(false);
  }

  const handleClearDiscount = () => {
    clearSeniorDiscount();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Senior Citizen Discount</DialogTitle>
          <DialogDescription>
            Select the items and quantities consumed by the senior citizen.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6 my-4">
            {/* Item Selection */}
            <div className='flex flex-col'>
                <h4 className="font-semibold mb-2">Select Items</h4>
                <ScrollArea className="h-64 border rounded-md p-2">
                    <div className="space-y-3 pr-2">
                        {cartItems.map(item => (
                            <div key={item.id} className="flex items-center gap-2">
                                <div className="flex-grow">
                                    <p className="text-sm font-medium">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">{item.quantity} in cart</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button 
                                        variant="outline" size="icon" className="h-6 w-6"
                                        onClick={() => handleQuantityChange(item.id, (selectedItems[item.id] || 0) - 1)}
                                    > <Minus className="h-3 w-3" /> </Button>
                                    <span className="font-bold w-4 text-center text-sm">{selectedItems[item.id] || 0}</span>
                                     <Button 
                                        variant="outline" size="icon" className="h-6 w-6"
                                        onClick={() => handleQuantityChange(item.id, (selectedItems[item.id] || 0) + 1)}
                                    > <Plus className="h-3 w-3" /> </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </div>
            
            {/* Calculation */}
            <div className="space-y-3 rounded-md border p-4 bg-muted/30">
                <h4 className="font-semibold mb-2">Discount Calculation</h4>
                 <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Gross Bill (Selected):</span>
                    <span className="font-medium">₱{calculation.grossBill.toFixed(2)}</span>
                </div>
                 <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">VAT Exempt Sales:</span>
                    <span className="font-medium">₱{calculation.vatExemptSales.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-base">
                    <span className="text-muted-foreground">20% Discount:</span>
                    <span className="font-bold text-primary">-₱{calculation.seniorDiscount.toFixed(2)}</span>
                </div>
            </div>
        </div>
        
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleClearDiscount}>Remove Discount</Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            type="button" 
            disabled={calculation.seniorDiscount <= 0}
            onClick={handleApplyDiscount}
          >
            Apply Discount
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



"use client";

import type { CartItem, MenuItem, SeniorDiscountDetails } from '@/lib/types';
import { useToast } from "@/hooks/use-toast"
import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';

const initialSeniorDiscountDetails: SeniorDiscountDetails = {
    items: [],
    vatExemptSales: 0,
    totalDiscount: 0,
};

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (item: CartItem) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  /** Manual discount only (excludes senior discount). */
  manualDiscount: number;
  subtotal: number;
  discount: number;
  total: number;
  setDiscount: (amount: number) => void;
  seniorDiscountDetails: SeniorDiscountDetails;
  applySeniorDiscount: (items: { itemId: string; qty: number }[]) => void;
  clearSeniorDiscount: () => void;
  /** Restore cart from a held open order. */
  restoreCartFromSnapshot: (payload: {
    items: CartItem[];
    manualDiscount: number;
    seniorDiscountDetails: SeniorDiscountDetails | null;
  }) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [manualDiscount, setManualDiscount] = useState(0);
  const [seniorDiscountDetails, setSeniorDiscountDetails] = useState<SeniorDiscountDetails>(initialSeniorDiscountDetails);
  const { toast } = useToast();

  const addToCart = (itemToAdd: CartItem) => {
    // If the item is a configurable box, always add it as a new unique item.
    if (itemToAdd.selectedConfiguration) {
      const uniqueId = `${itemToAdd.id}_${Date.now()}`;
      setCartItems(prevItems => [...prevItems, { ...itemToAdd, id: uniqueId, quantity: 1 }]);
      return;
    }

    setCartItems(prevItems => {
        const existingItem = prevItems.find(cartItem => cartItem.id === itemToAdd.id);
        
        if (existingItem) {
            return prevItems.map(cartItem =>
                cartItem.id === itemToAdd.id
                    ? { ...cartItem, quantity: cartItem.quantity + 1 }
                    : cartItem
            );
        }
        return [...prevItems, { ...itemToAdd, quantity: 1 }];
    });
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    setCartItems(prevItems => {
      // No stock check here anymore.
      return prevItems.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      );
    });
  };

  const removeFromCart = (itemId: string) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== itemId));
  };
  
  const clearSeniorDiscount = () => {
      setSeniorDiscountDetails(initialSeniorDiscountDetails);
  };

  const clearCart = () => {
    setCartItems([]);
    setManualDiscount(0);
    clearSeniorDiscount();
  };

  const restoreCartFromSnapshot = useCallback(
    (payload: {
      items: CartItem[];
      manualDiscount: number;
      seniorDiscountDetails: SeniorDiscountDetails | null;
    }) => {
      setCartItems(payload.items);
      setManualDiscount(payload.manualDiscount);
      if (payload.seniorDiscountDetails && payload.seniorDiscountDetails.items.length > 0) {
        setSeniorDiscountDetails(payload.seniorDiscountDetails);
      } else {
        setSeniorDiscountDetails(initialSeniorDiscountDetails);
      }
    },
    [],
  );

  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cartItems]);
  
  const discount = useMemo(() => {
    // The total discount applied to the cart is the sum of any manual discount
    // and the calculated senior citizen discount.
    return manualDiscount + seniorDiscountDetails.totalDiscount;
  }, [manualDiscount, seniorDiscountDetails.totalDiscount]);

  const total = useMemo(() => {
    return subtotal - discount;
  }, [subtotal, discount]);

  const setDiscount = (amount: number) => {
    setManualDiscount(amount);
    if(seniorDiscountDetails.totalDiscount > 0) {
        clearSeniorDiscount();
        toast({ title: 'Senior discount removed', description: 'Manual discount has been applied instead.'})
    }
  }
  
  const applySeniorDiscount = (items: { itemId: string; qty: number }[]) => {
    let grossBill = 0;
    
    const discountedItems = items.map(discountedItem => {
        const cartItem = cartItems.find(ci => ci.id === discountedItem.itemId);
        if (!cartItem) return null;
        // Calculate the total price for the items consumed by the senior
        grossBill += cartItem.price * discountedItem.qty;
        return {
            itemId: cartItem.id,
            name: cartItem.name,
            quantity: discountedItem.qty
        }
    }).filter(Boolean) as { itemId: string; name: string, quantity: number }[];

    // This is the VAT-able amount (price without VAT)
    const vatExemptSales = grossBill / 1.12;
    // The discount is 20% of the VAT-exempt amount
    const totalSeniorDiscount = vatExemptSales * 0.20;
    
    setSeniorDiscountDetails({
        items: discountedItems,
        vatExemptSales: vatExemptSales, // Store this for record-keeping
        totalDiscount: totalSeniorDiscount // This is the amount to subtract from the cart total
    });
    setManualDiscount(0); // Remove manual discount if senior is applied.
  }

  useEffect(() => {
    // Recalculate senior discount if cart changes
    if (seniorDiscountDetails.items.length > 0) {
        // Filter out items that are no longer in the cart or have changed quantity
        const updatedDiscountedItems = seniorDiscountDetails.items.map(item => {
            const cartItem = cartItems.find(ci => ci.id === item.itemId);
            if (!cartItem) return null; // Item was removed from cart
            return {
                itemId: item.itemId,
                qty: Math.min(item.quantity, cartItem.quantity) // Adjust to new cart quantity if it's lower
            };
        }).filter(Boolean) as { itemId: string; qty: number }[];
        
        // Re-apply discount with the updated list
        if (updatedDiscountedItems.length > 0) {
            applySeniorDiscount(updatedDiscountedItems);
        } else {
            clearSeniorDiscount();
        }
    }
  }, [cartItems]);

  useEffect(() => {
    if(subtotal > 0 && subtotal < manualDiscount) {
      setManualDiscount(subtotal);
      toast({
        variant: 'destructive',
        title: 'Discount Adjusted',
        description: 'Discount was adjusted to match the new subtotal.'
      });
    }
    if (subtotal === 0) {
        setManualDiscount(0);
        clearSeniorDiscount();
    }
  }, [subtotal, manualDiscount, toast]);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        manualDiscount,
        subtotal,
        discount,
        total,
        setDiscount,
        seniorDiscountDetails,
        applySeniorDiscount,
        clearSeniorDiscount,
        restoreCartFromSnapshot,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

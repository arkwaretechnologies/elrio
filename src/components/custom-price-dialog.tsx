
"use client";

import React, { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const priceSchema = z.object({
  price: z.coerce.number().min(0.01, 'Price must be greater than 0'),
});

type PriceFormValues = z.infer<typeof priceSchema>;

interface CustomPriceDialogProps {
  productName: string;
  variantName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (price: number) => void;
}

export function CustomPriceDialog({
  productName,
  variantName,
  open,
  onOpenChange,
  onSubmit,
}: CustomPriceDialogProps) {
  const form = useForm<PriceFormValues>({
    resolver: zodResolver(priceSchema),
    defaultValues: {
      price: undefined,
    },
  });
  
  const handleFormSubmit: SubmitHandler<PriceFormValues> = (data) => {
    onSubmit(data.price);
    form.reset();
  };
  
  const fullProductName = variantName && variantName !== 'Default' ? `${productName} - ${variantName}` : productName;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enter Price for Custom Item</DialogTitle>
          <DialogDescription>Set the price for {fullProductName}.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price (₱)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01" 
                      placeholder="e.g., 1500.00" 
                      {...field} 
                      autoFocus
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit">Add to Cart</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

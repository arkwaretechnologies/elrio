
"use client";

import React from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { BaseProduct, ProductVariant } from "@/lib/types";

interface VariantSelectionDialogProps {
  product: BaseProduct;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVariantSelected: (variant: ProductVariant, product: BaseProduct) => void;
}

export function VariantSelectionDialog({
  product,
  open,
  onOpenChange,
  onVariantSelected,
}: VariantSelectionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md flex flex-col">
        <DialogHeader>
          <DialogTitle>Select a Variant</DialogTitle>
          <DialogDescription>Choose an option for {product.name}.</DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-hidden">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-2 py-4">
              {product.variants.map((variant) => {
                const isNonInventoried = !variant.inventoryConsumption || variant.inventoryConsumption.length === 0;
                return (
                  <button
                    key={variant.id}
                    onClick={() => onVariantSelected(variant, product)}
                    className="w-full flex items-center gap-4 p-3 rounded-lg text-left transition-colors hover:bg-accent"
                  >
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      width={64}
                      height={64}
                      className="rounded-md object-cover"
                    />
                    <div className="flex-grow">
                      <p className="font-semibold">{variant.name}</p>
                       <p className="text-sm text-primary font-bold">
                        {variant.isCustomPrice ? 'Custom Price' : `₱${variant.price.toFixed(2)}`}
                       </p>
                    </div>
                    <div>
                      {isNonInventoried ? (
                         <Badge variant="outline">Available</Badge>
                      ) : (
                        <Badge variant="secondary">
                          Available
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

    
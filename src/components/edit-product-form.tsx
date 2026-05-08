
"use client";

import { useState, useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MenuItem, Category, InventoryItem } from '@/lib/types';
import { getCategories } from '@/services/category-service';
import { getInventoryItems } from '@/services/inventory-service';
import { updateProduct } from '@/services/menu-service';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from './ui/skeleton';

const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  categoryId: z.string().min(1, 'Category is required'),
  price: z.coerce.number().min(0.01, 'Price must be greater than 0'),
  inventoryItemId: z.string().min(1, 'Inventory item is required'),
  quantityConsumed: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface EditProductFormProps {
  product: MenuItem;
  onProductUpdated: (updatedProduct: MenuItem) => void;
  onCancel: () => void;
}

export function EditProductForm({ product, onProductUpdated, onCancel }: EditProductFormProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const { toast } = useToast();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
  });
  
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [fetchedCategories, fetchedInventoryItems] = await Promise.all([
          getCategories(),
          getInventoryItems()
        ]);
        setCategories(fetchedCategories);
        setInventoryItems(fetchedInventoryItems);
        
        const productCategory = fetchedCategories.find(c => c.name === product.category);
        const consumption = product.inventoryConsumption?.[0];

        // Set all default values at once after data is fetched
        form.reset({
            name: product.name,
            categoryId: productCategory?.id || '',
            price: product.price,
            inventoryItemId: consumption?.inventoryItemId || '',
            quantityConsumed: consumption?.quantity || 1,
        });

      } catch (error) {
        console.error("Failed to fetch data for edit form", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not load data needed to edit the product.",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [product, form, toast]);


  const onSubmit: SubmitHandler<ProductFormValues> = async (data) => {
    try {
      const selectedCategory = categories.find(c => c.id === data.categoryId);
      if (!selectedCategory) {
        throw new Error("Selected category not found.");
      }
      
      const selectedInventoryItem = inventoryItems.find(i => i.id === data.inventoryItemId);
      if(!selectedInventoryItem) {
          throw new Error("Selected inventory item not found.");
      }
      
      // The updateProduct service expects AddProductData, which now uses inventoryConsumption.
      // This form is now only compatible with simple products.
      // A full implementation would require this form to be replaced by ProductForm.
      // For now, we adapt the data to the expected structure.
      const productDataForUpdate = {
        name: data.name,
        category: selectedCategory.name,
        variants: [{
            id: product.id,
            name: product.variantName || 'Default',
            price: data.price,
            inventoryConsumption: [{
              inventoryItemId: data.inventoryItemId,
              quantity: data.quantityConsumed,
            }],
            isPreOrder: product.isPreOrder ?? false,
        }]
      };

      await updateProduct(product.baseProductId || product.id, productDataForUpdate);
      
      toast({
        title: "Product Updated!",
        description: `${data.name} has been updated.`,
      });

      const updatedProductData: MenuItem = {
        ...product,
        name: data.name,
        category: selectedCategory.name,
        price: data.price,
        inventoryConsumption: [{ inventoryItemId: data.inventoryItemId, quantity: data.quantityConsumed }],
        inventoryItem: selectedInventoryItem,
      };

      onProductUpdated(updatedProductData);
      
    } catch (error) {
      console.error('Error updating product:', error);
      let errorMessage = 'An unexpected error occurred.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast({
        variant: "destructive",
        title: "Error Updating Product",
        description: errorMessage,
      });
    }
  };

  if (isLoading) {
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-10 w-full" />
            </div>
             <div className="space-y-2">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-10 w-full" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-10 w-full" />
                </div>
                 <div className="space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </div>
        </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Half Dozen Torta" {...field} autoComplete="off" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} autoComplete="off" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="inventoryItemId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Base Inventory Item</FormLabel>
                 <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select base item" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {inventoryItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="quantityConsumed"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pieces Consumed per Sale</FormLabel>
                <FormControl>
                  <Input type="number" {...field} autoComplete="off" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Form>
  );
}


"use client";

import { useState, useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addProduct } from '@/services/menu-service';
import type { MenuItem, Category, InventoryItem, AddProductData, AddProductImage, BaseProduct } from '@/lib/types';
import { getCategories } from '@/services/category-service';
import { getInventoryItems } from '@/services/inventory-service';
import { useToast } from '@/hooks/use-toast';
import { optimizeImage } from '@/lib/utils';

const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  categoryId: z.string().min(1, 'Category is required'),
  price: z.coerce.number().min(0.01, 'Price must be greater than 0'),
  inventoryItemId: z.string().min(1, 'Inventory item is required'),
  quantityConsumed: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  image: z.any()
    .optional()
    .refine(
      (files) => !files || files?.length === 0 || ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(files?.[0]?.type),
      ".jpg, .jpeg, .png and .webp files are accepted."
    ),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface AddProductFormProps {
  onProductAdded: (newProduct: BaseProduct) => void;
}

const fileToDataURI = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});


export function AddProductForm({ onProductAdded }: AddProductFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const { toast } = useToast();
  
  useEffect(() => {
    const fetchData = async () => {
      const [fetchedCategories, fetchedInventoryItems] = await Promise.all([
        getCategories(),
        getInventoryItems()
      ]);
      setCategories(fetchedCategories);
      setInventoryItems(fetchedInventoryItems);
    };
    fetchData();
  }, []);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      categoryId: '',
      price: 0,
      inventoryItemId: '',
      quantityConsumed: 1,
      image: undefined,
    },
  });

  const onSubmit: SubmitHandler<ProductFormValues> = async (data) => {
    setIsSubmitting(true);
    try {
      let imageFile = data.image?.[0] as File | undefined;
      let imageData: AddProductImage | undefined;

      if (imageFile) {
        imageFile = await optimizeImage(imageFile);
        const dataUri = await fileToDataURI(imageFile);
        imageData = {
            contentType: imageFile.type,
            dataUri: dataUri,
        }
      }
      
      const selectedCategory = categories.find(c => c.id === data.categoryId);
      if (!selectedCategory) {
        throw new Error("Selected category not found.");
      }

      const productData: AddProductData = {
        name: data.name,
        category: selectedCategory.name,
        hasMultipleVariants: false,
        variants: [{
            id: '',
            name: 'Default',
            price: data.price,
            inventoryConsumption: [{
                inventoryItemId: data.inventoryItemId,
                quantity: data.quantityConsumed,
            }],
            isPreOrder: false,
            isCustomPrice: false,
        }],
        image: imageData,
      };

      const newProduct = await addProduct(productData);
      
      onProductAdded(newProduct);
      
      toast({
        title: "Product Added!",
        description: `${data.name} has been added to the inventory.`,
      });
      form.reset();

    } catch (error) {
      console.error('Error adding product:', error);
      let errorMessage = 'An unexpected error occurred.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast({
        variant: "destructive",
        title: "Error Adding Product",
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const imageRef = form.register("image");

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
              <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                <FormLabel>Inventory Item</FormLabel>
                 <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                <FormLabel>Pieces Consumed</FormLabel>
                <FormControl>
                  <Input type="number" {...field} autoComplete="off" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
            control={form.control}
            name="image"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Product Image</FormLabel>
                <FormControl>
                  <Input 
                    type="file" 
                    accept="image/*"
                    {...imageRef}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Adding Product...' : 'Add Product'}
        </Button>
      </form>
    </Form>
  );
}

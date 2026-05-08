
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import type { BaseProduct, Category, InventoryItem, AddProductData, AddProductImage, MenuItem, Store } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Search, Pencil, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProductForm } from './product-form';
import { addProduct, updateProduct, deleteProduct, getMenuItems, getMenuItemsAsBaseProducts } from '@/services/menu-service';
import { useToast } from '@/hooks/use-toast';
import { getStores } from '@/services/store-service';

function StatCard({ icon: Icon, title, value, color }: { icon?: React.ElementType, title: string, value: string | number, color: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {Icon && <Icon className={`h-5 w-5 ${color}`} />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

const fileToDataURI = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});


export function ProductsClient({ 
  baseProducts: initialBaseProducts, 
  categories: initialCategories,
  inventoryItems: initialInventoryItems
}: { 
  baseProducts: BaseProduct[],
  categories: Category[],
  inventoryItems: InventoryItem[]
}) {
  const [baseProducts, setBaseProducts] = useState<BaseProduct[]>(initialBaseProducts);
  const [allMenuItems, setAllMenuItems] = useState<MenuItem[]>([]);
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogState, setDialogState] = useState<{ open: boolean, data: BaseProduct | null }>({ open: false, data: null });
  const [deleteState, setDeleteState] = useState<{ open: boolean, data: BaseProduct | null }>({ open: false, data: null });
  const { toast } = useToast();

  const refreshProducts = async () => {
    const [products, menuItems] = await Promise.all([
      getMenuItemsAsBaseProducts(),
      getMenuItems(),
    ]);
    setBaseProducts(products);
    setAllMenuItems(menuItems);
    return products;
  };

  useEffect(() => {
    // Fetch all menu items for the configurable product form & stores for availability
    Promise.all([
      getMenuItems(),
      getStores(),
    ]).then(([menuItems, stores]) => {
      setAllMenuItems(menuItems);
      setAllStores(stores);
    });
  }, []);

  useEffect(() => {
    setBaseProducts(initialBaseProducts);
  }, [initialBaseProducts]);

  const filteredProducts = useMemo(() => {
    return baseProducts.filter(product =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [baseProducts, searchQuery]);

  const handleSaveProduct = async (formData: any, productId?: string) => {
    try {
        const selectedCategory = initialCategories.find(c => c.id === formData.categoryId);
        if (!selectedCategory) {
            throw new Error("Category not found");
        }
        
        const imageFile = formData.image?.[0] as File | undefined;
        let imageData: AddProductImage | undefined;
        if (imageFile) {
            const dataUri = await fileToDataURI(imageFile);
            imageData = {
                contentType: imageFile.type,
                dataUri: dataUri,
            }
        }
        
        const productData: AddProductData = {
            name: formData.name,
            category: selectedCategory.name,
            variants: formData.variants,
            hasMultipleVariants: formData.hasMultipleVariants,
            availableInStoreIds: formData.availableInStoreIds,
            image: imageData
        };

        if (productId) {
            // Update
            const updated = await updateProduct(productId, productData);
            toast({ title: "Product Updated", description: `${updated.name} has been updated.` });
        } else {
            // Add
            const newProduct = await addProduct(productData);
            toast({ title: "Product Added", description: `${newProduct.name} has been added.` });
        }
        setDialogState({ open: false, data: null });
        await refreshProducts(); // Refresh data from server
    } catch (error) {
        console.error("Failed to save product", error);
        toast({ variant: 'destructive', title: "Save Failed", description: error instanceof Error ? error.message : "An unknown error occurred." });
    }
  };
  
  const handleDeleteProduct = async () => {
    if (!deleteState.data) return;
    try {
      await deleteProduct(deleteState.data.id);
      setBaseProducts(prev => prev.filter(p => p.id !== deleteState.data!.id));
      toast({ title: "Product Deleted", description: `${deleteState.data.name} has been deleted.`});
      setDeleteState({ open: false, data: null });
    } catch (error) {
       console.error("Failed to delete product", error);
       toast({ variant: 'destructive', title: "Delete Failed", description: error instanceof Error ? error.message : "An unknown error occurred." });
    }
  };

  const openDialog = (data: BaseProduct | null = null) => {
    const productToEdit = data ? baseProducts.find(p => p.id === data.id) || data : null;
    setDialogState({ open: true, data: productToEdit });
  };
  const openDeleteDialog = (data: BaseProduct) => setDeleteState({ open: true, data });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Product Management</h1>
          <p className="text-muted-foreground">Manage your base products and their variants.</p>
        </div>
        <Button onClick={() => openDialog()}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Product
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>All Products</CardTitle>
           <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by name or category..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoComplete="off"
              />
            </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Variants</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map(product => (
                <TableRow key={product.id}>
                  <TableCell>
                     <div className="flex items-center gap-4">
                        <Image
                          src={product.imageUrl}
                          alt={product.name}
                          width={64}
                          height={64}
                          className="rounded-md object-cover"
                          data-ai-hint={product.aiHint}
                        />
                        <span className="font-medium">{product.name}</span>
                      </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{product.category}</Badge></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {product.variants.map(variant => (
                        <Badge key={variant.id} variant="secondary">{variant.name}</Badge>
                      ))}
                    </div>
                  </TableCell>
                   <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openDialog(product)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => openDeleteDialog(product)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Dialog open={dialogState.open} onOpenChange={(open) => setDialogState(prev => ({...prev, open}))}>
        <DialogContent className="max-w-3xl">
           <DialogHeader>
            <DialogTitle>{dialogState.data ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          </DialogHeader>
          {dialogState.open && (
            <ProductForm 
              product={dialogState.data}
              categories={initialCategories}
              inventoryItems={initialInventoryItems}
              allMenuItems={allMenuItems}
              allStores={allStores}
              onSave={handleSaveProduct}
              onCancel={() => setDialogState({ open: false, data: null })}
            />
          )}
        </DialogContent>
      </Dialog>
      
       <AlertDialog open={deleteState.open} onOpenChange={(open) => setDeleteState(prev => ({...prev, open}))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the product "{deleteState.data?.name}" and all its variants.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProduct}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

"use client";

import React, { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Category } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { PlusCircle, Pencil, Trash2 } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { addCategory, updateCategory, deleteCategory } from '@/services/category-service';
import { useToast } from '@/hooks/use-toast';
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
import { IconPicker } from './icon-picker';
import { Icon } from './icon';

const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  description: z.string().optional(),
  icon: z.string().optional(),
});
type CategoryFormValues = z.infer<typeof categorySchema>;

interface DialogState<T> {
  open: boolean;
  data: T | null;
}

export function CategoryClient({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [addEditDialogState, setAddEditDialogState] = useState<DialogState<Category>>({ open: false, data: null });
  const [deleteDialogState, setDeleteDialogState] = useState<DialogState<Category>>({ open: false, data: null });
  const { toast } = useToast();

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', description: '', icon: 'ShoppingBasket' },
  });

  const handleSaveCategory: SubmitHandler<CategoryFormValues> = async (data) => {
    try {
      const categoryId = addEditDialogState.data?.id;
      const categoryData: Omit<Category, 'id'> = {
        name: data.name,
        description: data.description || '',
        icon: data.icon || 'ShoppingBasket',
      };

      if (categoryId) {
        // Update existing category
        await updateCategory(categoryId, categoryData);
        setCategories((prev) => prev.map((c) => (c.id === categoryId ? { id: categoryId, ...categoryData } : c)));
        toast({
          title: 'Category Updated',
          description: `Category "${data.name}" has been updated.`,
        });
      } else {
        // Add new category
        const newCategory = await addCategory(categoryData);
        setCategories((prev) => [...prev, newCategory]);
        toast({
          title: 'Category Added',
          description: `Category "${newCategory.name}" has been added.`,
        });
      }
      form.reset({ name: '', description: '', icon: 'ShoppingBasket' });
      setAddEditDialogState({ open: false, data: null });
    } catch (error) {
      console.error('Failed to save category:', error);
      let errorMessage = 'Failed to save category.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage,
      });
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteDialogState.data) return;
    try {
      await deleteCategory(deleteDialogState.data.id);
      setCategories((prev) => prev.filter((c) => c.id !== deleteDialogState.data!.id));
      toast({
        title: 'Category Deleted',
        description: `Category "${deleteDialogState.data.name}" has been deleted.`,
      });
      setDeleteDialogState({ open: false, data: null });
    } catch (error) {
      console.error('Failed to delete category:', error);
      let errorMessage = 'Failed to delete category.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage,
      });
      setDeleteDialogState({ open: false, data: null });
    }
  };

  const openAddDialog = () => {
    form.reset({ name: '', description: '', icon: 'ShoppingBasket' });
    setAddEditDialogState({ open: true, data: null });
  };

  const openEditDialog = (category: Category) => {
    form.reset({ name: category.name, description: category.description, icon: category.icon });
    setAddEditDialogState({ open: true, data: category });
  };
  
  const openDeleteDialog = (category: Category) => {
    setDeleteDialogState({ open: true, data: category });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Category Management</h1>
          <p className="text-muted-foreground">Add, edit, and manage your product categories.</p>
        </div>
        <Button onClick={openAddDialog}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Category
        </Button>
      </div>

      <Dialog
        open={addEditDialogState.open}
        onOpenChange={(isOpen) => setAddEditDialogState({ open: isOpen, data: isOpen ? addEditDialogState.data : null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{addEditDialogState.data ? 'Edit Category' : 'Add New Category'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSaveCategory)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Pastries" {...field} autoComplete="off" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Icon</FormLabel>
                    <FormControl>
                      <IconPicker 
                        value={field.value || 'ShoppingBasket'} 
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="A short description of the category." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-4">
                 <Button type="button" variant="outline" onClick={() => setAddEditDialogState({ open: false, data: null })}>Cancel</Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Saving...' : 'Save Category'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                       <Icon name={category.icon as any} className="h-5 w-5 text-muted-foreground" />
                      {category.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{category.description}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(category)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => openDeleteDialog(category)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={deleteDialogState.open}
        onOpenChange={(isOpen) => setDeleteDialogState({ open: isOpen, data: isOpen ? deleteDialogState.data : null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the category "{deleteDialogState.data?.name}". Make sure no products are using this category first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

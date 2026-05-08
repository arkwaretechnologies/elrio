
"use client";

import React, { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Store } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { PlusCircle, Pencil, Trash2 } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { addStore, updateStore, deleteStore } from '@/services/store-service';

const storeSchema = z.object({
  name: z.string().min(1, 'Store name is required'),
  location: z.string().optional(),
});
type StoreFormValues = z.infer<typeof storeSchema>;

interface DialogState<T> {
  open: boolean;
  data: T | null;
}

export function StoreManagementClient({ initialStores }: { initialStores: Store[] }) {
  const [stores, setStores] = useState<Store[]>(initialStores);
  const [addEditDialog, setAddEditDialog] = useState<DialogState<Store>>({ open: false, data: null });
  const [deleteDialog, setDeleteDialog] = useState<DialogState<Store>>({ open: false, data: null });
  const { toast } = useToast();

  const form = useForm<StoreFormValues>({
    resolver: zodResolver(storeSchema),
    defaultValues: { name: '', location: '' },
  });

  const handleSaveStore: SubmitHandler<StoreFormValues> = async (data) => {
    try {
      const storeId = addEditDialog.data?.id;
      const storeData: Omit<Store, 'id'> = { name: data.name, location: data.location || '' };

      if (storeId) {
        await updateStore(storeId, storeData);
        setStores((prev) => prev.map((s) => (s.id === storeId ? { id: storeId, ...storeData } : s)));
        toast({ title: 'Store Updated' });
      } else {
        const newStore = await addStore(storeData);
        setStores((prev) => [...prev, newStore]);
        toast({ title: 'Store Added' });
      }
      form.reset({ name: '', location: '' });
      setAddEditDialog({ open: false, data: null });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save store.' });
    }
  };

  const handleDeleteStore = async () => {
    if (!deleteDialog.data) return;
    try {
      await deleteStore(deleteDialog.data.id);
      setStores((prev) => prev.filter((s) => s.id !== deleteDialog.data!.id));
      toast({ title: 'Store Deleted' });
      setDeleteDialog({ open: false, data: null });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete store.' });
    }
  };

  const openAddDialog = () => {
    form.reset({ name: '', location: '' });
    setAddEditDialog({ open: true, data: null });
  };

  const openEditDialog = (store: Store) => {
    form.reset({ name: store.name, location: store.location });
    setAddEditDialog({ open: true, data: store });
  };
  
  const openDeleteDialog = (store: Store) => {
    setDeleteDialog({ open: true, data: store });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Store Management</h1>
          <p className="text-muted-foreground">Add, edit, and manage your branches.</p>
        </div>
        <Button onClick={openAddDialog}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Store
        </Button>
      </div>

      <Dialog
        open={addEditDialog.open}
        onOpenChange={(isOpen) => setAddEditDialog({ open: isOpen, data: isOpen ? addEditDialog.data : null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{addEditDialog.data ? 'Edit Store' : 'Add New Store'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSaveStore)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Store Name</FormLabel>
                    <FormControl><Input placeholder="e.g., Main Branch" {...field} autoComplete="off" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location (Optional)</FormLabel>
                    <FormControl><Input placeholder="e.g., Cebu City" {...field} autoComplete="off" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-4">
                 <Button type="button" variant="outline" onClick={() => setAddEditDialog({ open: false, data: null })}>Cancel</Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Saving...' : 'Save Store'}
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
                  <TableHead>Location</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.map((store) => (
                  <TableRow key={store.id}>
                    <TableCell className="font-medium">{store.name}</TableCell>
                    <TableCell className="text-muted-foreground">{store.location || 'N/A'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(store)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => openDeleteDialog(store)}>
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
        open={deleteDialog.open}
        onOpenChange={(isOpen) => setDeleteDialog({ open: isOpen, data: isOpen ? deleteDialog.data : null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the store "{deleteDialog.data?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStore}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

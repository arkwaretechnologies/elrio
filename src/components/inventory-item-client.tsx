

"use client";

import React, { useState, useMemo } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { InventoryItem, StoreInventory, UnitOfMeasurement } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Plus, Minus, Pencil, Trash2, Search } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { addInventoryItem, logAndAdjustInventory, updateInventoryItemMaster, deleteInventoryItem } from '@/services/inventory-service';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { inventoryAdjustmentTypes, type InventoryAdjustmentType, unitsOfMeasurement } from '@/lib/types';
import { useAuth } from '@/context/auth-context';


const inventoryItemSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  unit: z.string().min(1, 'Unit is required'),
});
type InventoryItemFormValues = z.infer<typeof inventoryItemSchema>;

const adjustmentSchema = z.object({
  quantity: z.coerce.number().positive('Quantity must be a positive number.'),
  type: z.string().min(1, 'Please select a reason.'),
  notes: z.string().optional(),
});
type AdjustmentFormValues = z.infer<typeof adjustmentSchema>;

interface DialogState<T> {
  open: boolean;
  data: T | null;
}

interface AdjustmentDialogState {
  open: boolean;
  item: (InventoryItem & { stock: number | 'N/A', unit: UnitOfMeasurement }) | null;
  mode: 'add' | 'remove' | null;
}

const addStockReasons: InventoryAdjustmentType[] = ['Restock', 'Count Correction'];
const removeStockReasons: InventoryAdjustmentType[] = ['Damaged', 'Expired', 'Count Correction'];

export function InventoryItemClient({ 
    initialInventoryItems, 
    initialStoreInventory, 
    isAdminView 
}: { 
    initialInventoryItems: InventoryItem[],
    initialStoreInventory: StoreInventory[],
    isAdminView: boolean,
}) {
  const { currentStore } = useAuth();
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(initialInventoryItems);
  const [storeInventory, setStoreInventory] = useState<StoreInventory[]>(initialStoreInventory);
  
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [adjustmentState, setAdjustmentState] = useState<AdjustmentDialogState>({ open: false, item: null, mode: null });
  const [editState, setEditState] = useState<DialogState<InventoryItem>>({ open: false, data: null });
  const [deleteState, setDeleteState] = useState<DialogState<InventoryItem>>({ open: false, data: null });
  const [searchQuery, setSearchQuery] = useState('');
  const [tracksStockToggleItemId, setTracksStockToggleItemId] = useState<string | null>(null);
  
  const { toast } = useToast();

  const storeInventoryMap = useMemo(() => new Map(storeInventory.map(si => [si.inventoryItemId, si])), [storeInventory]);

  const combinedInventory = useMemo(() => {
    return inventoryItems.map(item => ({
      ...item,
      stock: storeInventoryMap.get(item.id)?.stock ?? 'N/A',
      unit: item.unit || 'pcs',
    })).filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [inventoryItems, storeInventoryMap, searchQuery]);

  const addForm = useForm<InventoryItemFormValues>({
    resolver: zodResolver(inventoryItemSchema),
    defaultValues: { name: '', unit: 'pcs' },
  });

  const editForm = useForm<InventoryItemFormValues>({
    resolver: zodResolver(inventoryItemSchema),
  });

  const adjustmentForm = useForm<AdjustmentFormValues>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: { quantity: 1, type: '', notes: '' },
  });

  const handleAddItem: SubmitHandler<InventoryItemFormValues> = async (data) => {
    try {
      const newItem = await addInventoryItem({
        name: data.name,
        unit: data.unit as UnitOfMeasurement,
        tracksStock: true,
      });
      setInventoryItems((prev) => [...prev, newItem].sort((a,b) => a.name.localeCompare(b.name)));
      toast({
        title: 'Inventory Item Added',
        description: `"${newItem.name}" has been added.`,
      });
      addForm.reset({ name: '', unit: 'pcs' });
      setOpenAddDialog(false);
    } catch (error) {
      console.error('Failed to add inventory item:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to add inventory item.',
      });
    }
  };

  const openAdjustmentDialog = (item: InventoryItem & { stock: number | 'N/A', unit: UnitOfMeasurement }, mode: 'add' | 'remove') => {
    adjustmentForm.reset({ quantity: 1, type: '', notes: '' });
    setAdjustmentState({ open: true, item, mode });
  };
  
  const closeAdjustmentDialog = () => {
    setAdjustmentState({ open: false, item: null, mode: null });
  }

  const handleAdjustStock: SubmitHandler<AdjustmentFormValues> = async (data) => {
    if (!adjustmentState.item || !adjustmentState.mode || !currentStore) return;

    try {
      const adjustmentAmount = adjustmentState.mode === 'add' ? data.quantity : -data.quantity;
      
      await logAndAdjustInventory({
        storeId: currentStore.id,
        itemId: adjustmentState.item.id,
        itemName: adjustmentState.item.name,
        itemUnit: adjustmentState.item.unit,
        adjustment: adjustmentAmount,
        type: data.type as InventoryAdjustmentType,
        notes: data.notes || '',
      });
      
      // Optimistically update the UI
      const newStock = (typeof adjustmentState.item.stock === 'number' ? adjustmentState.item.stock : 0) + adjustmentAmount;
      const updatedItem = { ...adjustmentState.item, stock: newStock };
      
      setStoreInventory(prev => {
        const existing = prev.find(i => i.inventoryItemId === updatedItem.id);
        if (existing) {
            return prev.map(i => i.inventoryItemId === updatedItem.id ? {...i, stock: newStock } : i);
        }
        // This case shouldn't happen if inventory is loaded correctly, but as a fallback:
        return [...prev, {
            id: `${currentStore.id}_${updatedItem.id}`,
            storeId: currentStore.id,
            inventoryItemId: updatedItem.id,
            itemName: updatedItem.name,
            stock: newStock,
            unit: updatedItem.unit,
            tracksStock: updatedItem.tracksStock !== false,
        }];
      });

      toast({
        title: 'Stock Adjusted',
        description: `Stock for ${adjustmentState.item.name} is being updated.`,
      });

      closeAdjustmentDialog();

    } catch (error) {
      console.error('Failed to adjust stock:', error);
      let errorMessage = 'Failed to adjust stock.';
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

  const openEditDialog = (item: InventoryItem) => {
    editForm.reset({
      name: item.name,
      unit: item.unit,
    });
    setEditState({ open: true, data: item });
  };

  const handleTracksStockToggle = async (item: InventoryItem, tracksStock: boolean) => {
    const previous = item.tracksStock !== false;
    if (tracksStock === previous) return;

    setTracksStockToggleItemId(item.id);
    setInventoryItems((prev) =>
      prev.map((row) => (row.id === item.id ? { ...row, tracksStock } : row)),
    );
    setStoreInventory((prev) =>
      prev.map((row) => (row.inventoryItemId === item.id ? { ...row, tracksStock } : row)),
    );

    try {
      await updateInventoryItemMaster(item.id, item.name, item.unit, tracksStock);
      toast({
        title: tracksStock ? 'Stock tracking on' : 'Usage only',
        description: tracksStock
          ? `"${item.name}" will deduct store stock on sales.`
          : `"${item.name}" logs usage only; sales will not reduce stock.`,
      });
    } catch (error) {
      console.error('Failed to update track stock:', error);
      setInventoryItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, tracksStock: previous } : row)),
      );
      setStoreInventory((prev) =>
        prev.map((row) => (row.inventoryItemId === item.id ? { ...row, tracksStock: previous } : row)),
      );
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: 'Could not change stock tracking. Try again.',
      });
    } finally {
      setTracksStockToggleItemId(null);
    }
  };

  const handleEditItem: SubmitHandler<InventoryItemFormValues> = async (data) => {
    if (!editState.data) return;
    const keepTracksStock = editState.data.tracksStock !== false;
    try {
      await updateInventoryItemMaster(
        editState.data.id,
        data.name,
        data.unit as UnitOfMeasurement,
        keepTracksStock,
      );
      setInventoryItems((prev) =>
        prev.map((item) =>
          item.id === editState.data!.id
            ? { ...item, name: data.name, unit: data.unit as UnitOfMeasurement, tracksStock: keepTracksStock }
            : item,
        ),
      );
      setStoreInventory((prev) =>
        prev.map((row) =>
          row.inventoryItemId === editState.data!.id
            ? { ...row, itemName: data.name, unit: data.unit as UnitOfMeasurement, tracksStock: keepTracksStock }
            : row,
        ),
      );
      toast({
        title: 'Item Updated',
        description: `Item "${data.name}" has been updated.`,
      });
      setEditState({ open: false, data: null });
    } catch (error) {
      console.error('Failed to update item name:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Could not update the item name.',
      });
    }
  };
  
  const handleDeleteItem = async () => {
    if (!deleteState.data) return;
    try {
      await deleteInventoryItem(deleteState.data.id);
      setInventoryItems(prev => prev.filter(item => item.id !== deleteState.data!.id));
      toast({
        title: 'Item Deleted',
        description: `"${deleteState.data.name}" has been deleted.`,
      });
      setDeleteState({ open: false, data: null });
    } catch (error) {
      console.error('Failed to delete item:', error);
      let errorMessage = 'Could not delete item.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast({
        variant: 'destructive',
        title: 'Deletion Failed',
        description: errorMessage,
      });
       setDeleteState({ open: false, data: null });
    }
  };
  
  const adjustmentReasons = useMemo(() => {
    if (adjustmentState.mode === 'add') {
      return addStockReasons;
    }
    if (adjustmentState.mode === 'remove') {
      return removeStockReasons;
    }
    return inventoryAdjustmentTypes;
  }, [adjustmentState.mode]);
  
  const isDecimalAllowed = (unit: UnitOfMeasurement) => unit !== 'pcs' && unit !== 'cups';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">
            {isAdminView ? 'Inventory Item Master List' : 'Store Inventory'}
          </h1>
          <p className="text-muted-foreground">
            {isAdminView 
                ? 'Add or remove items from the global inventory list.' 
                : `Manage stock levels for ${currentStore?.name || '...'}.`
            }
          </p>
        </div>
        {isAdminView && (
          <Dialog open={openAddDialog} onOpenChange={setOpenAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Master Inventory Item</DialogTitle>
              </DialogHeader>
              <Form {...addForm}>
                <form onSubmit={addForm.handleSubmit(handleAddItem)} className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={addForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Item Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Coffee Beans" {...field} autoComplete="off" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addForm.control}
                      name="unit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unit</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Unit" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {unitsOfMeasurement.map(unit => (
                                <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    New items track stock by default. Turn tracking off from the row switch after adding, if needed.
                  </p>
                  <Button type="submit" disabled={addForm.formState.isSubmitting}>
                    {addForm.formState.isSubmitting ? 'Adding...' : 'Add Item'}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
           <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by name..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoComplete="off"
              />
            </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  {!isAdminView && <TableHead>Current Stock</TableHead>}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {combinedInventory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      <span className="inline-flex flex-wrap items-center gap-2">
                        {item.name}
                        {item.tracksStock === false && (
                          <Badge variant="secondary" className="font-normal">
                            Usage only
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    {!isAdminView && <TableCell>{item.stock} {item.unit}</TableCell>}
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
                        {isAdminView ? (
                          <>
                            <div
                              className="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2 py-1"
                              title="Track store stock: off = usage only in reports, sales do not reduce stock."
                            >
                              <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
                                Track stock
                              </span>
                              <Switch
                                checked={item.tracksStock !== false}
                                disabled={tracksStockToggleItemId === item.id}
                                aria-label={`Track store stock for ${item.name}`}
                                onCheckedChange={(checked) =>
                                  handleTracksStockToggle(item, checked === true)
                                }
                              />
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
                                <Pencil className="h-4 w-4"/>
                            </Button>
                             <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteState({ open: true, data: item })}>
                                <Trash2 className="h-4 w-4"/>
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 border-green-200 disabled:opacity-50 disabled:pointer-events-none"
                              disabled={item.tracksStock === false}
                              title={
                                item.tracksStock === false
                                  ? 'Usage-only items are not stock-tracked; use reports for usage.'
                                  : undefined
                              }
                              onClick={() => openAdjustmentDialog(item, 'add')}
                            >
                              <Plus className="h-4 w-4 mr-1" /> Add
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 border-red-200 disabled:opacity-50 disabled:pointer-events-none"
                              disabled={item.tracksStock === false}
                              title={
                                item.tracksStock === false
                                  ? 'Usage-only items are not stock-tracked; use reports for usage.'
                                  : undefined
                              }
                              onClick={() => openAdjustmentDialog(item, 'remove')}
                            >
                              <Minus className="h-4 w-4 mr-1" /> Deduct
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Adjustment Dialog */}
      <Dialog open={adjustmentState.open} onOpenChange={closeAdjustmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock for {adjustmentState.item?.name}</DialogTitle>
          </DialogHeader>
          <Form {...adjustmentForm}>
            <form onSubmit={adjustmentForm.handleSubmit(handleAdjustStock)} className="space-y-4">
              <FormField
                control={adjustmentForm.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Quantity to{' '}
                      {adjustmentState.mode === 'remove' ? 'deduct' : adjustmentState.mode} (
                      {adjustmentState.item?.unit})
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step={isDecimalAllowed(adjustmentState.item?.unit || 'pcs') ? '0.01' : '1'}
                        {...field}
                        autoComplete="off"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={adjustmentForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a reason for adjustment" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {adjustmentReasons.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={adjustmentForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g., From supplier XYZ, or spilled a batch." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={adjustmentForm.formState.isSubmitting}>
                  {adjustmentForm.formState.isSubmitting ? 'Saving...' : 'Save Adjustment'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog (Admin Only) */}
      {isAdminView && editState.open && (
         <Dialog open={editState.open} onOpenChange={(open) => setEditState({ open, data: open ? editState.data : null })}>
            <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Item: {editState.data?.name}</DialogTitle>
            </DialogHeader>
            <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(handleEditItem)} className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={editForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>New Item Name</FormLabel>
                          <FormControl>
                            <Input {...field} autoComplete="off" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="unit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unit</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Unit" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {unitsOfMeasurement.map(unit => (
                                <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Stock tracking is controlled with the switch in the table row.
                  </p>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                    <Button type="submit" disabled={editForm.formState.isSubmitting}>
                    {editForm.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogFooter>
                </form>
            </Form>
            </DialogContent>
        </Dialog>
      )}
      
      {/* Delete Confirmation Dialog (Admin Only) */}
      {isAdminView && deleteState.open && (
        <AlertDialog open={deleteState.open} onOpenChange={(open) => setDeleteState({ open, data: open ? deleteState.data : null })}>
            <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the item
                "{deleteState.data?.name}". Are you sure you want to continue?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteItem}>Delete</AlertDialogAction>
            </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}

    </div>
  );
}



"use client";

import React, { useState, useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getStoreInventory, resetAllInventoryStock } from '@/services/inventory-service';
import { resetAllTransactionalData, getSales } from '@/services/sales-service';
import { AlertCircle, Trash2, Download, Archive, Store as StoreIcon, PackagePlus, Mail } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { getMenuItemsAsBaseProducts, bulkAssignProductsToStore } from '@/services/menu-service';
import { getCategories } from '@/services/category-service';
import { getExpenses, getExpenseCategories } from '@/services/expense-service';
import { getUsers } from '@/services/user-service';
import { useAuth } from '@/context/auth-context';
import { getStores } from '@/services/store-service';
import { usePathname } from 'next/navigation';
import type { Store, SystemSettings } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getSystemSettings, updateSystemSettings } from '@/services/settings-service';

const settingsSchema = z.object({
  eodReportRecipient: z.string().email('Please enter a valid email address.'),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export function DataManagementClient() {
  const { currentStore } = useAuth();
  const pathname = usePathname();
  const isAdminView = pathname.startsWith('/super-admin');
  
  const [resetInventoryDialog, setResetInventoryDialog] = useState(false);
  const [resetTransactionsDialog, setResetTransactionsDialog] = useState(false);
  
  const [inventoryConfirmation, setInventoryConfirmation] = useState('');
  const [transactionsConfirmation, setTransactionsConfirmation] = useState('');
  const [assignProductsConfirmation, setAssignProductsConfirmation] = useState('');

  const [isResettingInventory, setIsResettingInventory] = useState(false);
  const [isResettingTransactions, setIsResettingTransactions] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('');
  
  const { toast } = useToast();

  const settingsForm = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { eodReportRecipient: '' },
  });

  useEffect(() => {
    if (isAdminView) {
      getStores().then(setAllStores);
      getSystemSettings().then(settings => {
        if (settings?.eodReportRecipient) {
          settingsForm.setValue('eodReportRecipient', settings.eodReportRecipient);
        }
      });
    }
  }, [isAdminView, settingsForm]);

  const handleSaveSettings: SubmitHandler<SettingsFormValues> = async (data) => {
    try {
      await updateSystemSettings(data);
      toast({
        title: 'Settings Saved',
        description: 'Your system settings have been updated.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      });
    }
  };

  const handleResetInventory = async () => {
    const storeIdToReset = isAdminView ? selectedStore : currentStore?.id;
    if (!storeIdToReset) return;

    setIsResettingInventory(true);
    try {
      await resetAllInventoryStock(storeIdToReset);
      const storeName = allStores.find(s => s.id === storeIdToReset)?.name || currentStore?.name;
      toast({
        title: 'Inventory Reset Successful',
        description: `All inventory stock for ${storeName} has been set to zero.`,
      });
      setResetInventoryDialog(false);
      setInventoryConfirmation('');
      setSelectedStore('');
    } catch (error) {
      console.error('Failed to reset inventory:', error);
      let errorMessage = 'An unexpected error occurred.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast({
        variant: 'destructive',
        title: 'Reset Failed',
        description: errorMessage,
      });
    } finally {
      setIsResettingInventory(false);
    }
  };
  
  const handleResetTransactions = async () => {
    const storeIdToReset = isAdminView ? selectedStore : currentStore?.id;
    if (!storeIdToReset) return;

    setIsResettingTransactions(true);
    try {
      await resetAllTransactionalData(storeIdToReset);
      const storeName = allStores.find(s => s.id === storeIdToReset)?.name || currentStore?.name;
      toast({
        title: 'Transactional Data Reset Successful',
        description: `All sales, expenses, and CRM data for ${storeName} have been permanently deleted.`,
      });
      setResetTransactionsDialog(false);
      setTransactionsConfirmation('');
      setSelectedStore('');
    } catch (error) {
      console.error('Failed to reset sales data:', error);
       let errorMessage = 'An unexpected error occurred.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast({
        variant: 'destructive',
        title: 'Reset Failed',
        description: errorMessage,
      });
    } finally {
      setIsResettingTransactions(false);
    }
  };
  
  const handleExportInventory = async () => {
    if (!currentStore) return;
    setIsExporting(true);
    try {
      const items = await getStoreInventory(currentStore.id);
      const dataToExport = items.map(item => ({
        'Item ID': item.inventoryItemId,
        'Item Name': item.itemName,
        'Current Stock': item.stock,
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `Inventory - ${currentStore.name}`);
      XLSX.writeFile(workbook, `ElRio_Inventory_${currentStore.name}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

      toast({
        title: 'Export Successful',
        description: 'Your inventory data has been exported.',
      });

    } catch (error) {
      console.error('Failed to export inventory:', error);
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: 'Could not export inventory data.',
      });
    } finally {
      setIsExporting(false);
    }
  }

  const handleBackupAllData = async () => {
    setIsBackingUp(true);
    toast({
        title: 'Starting Backup...',
        description: 'Gathering all system data. This may take a moment.',
    });
    try {
        const allStores = await getStores();
        const workbook = XLSX.utils.book_new();

        const [
            categories,
            expenseCategories,
            users,
            allProducts,
            masterInventory
        ] = await Promise.all([
            getCategories(),
            getExpenseCategories(),
            getUsers(),
            getMenuItemsAsBaseProducts(),
            getStoreInventory(""),
        ]);

        const productsData = allProducts.flatMap(p => p.variants.map(v => ({
            'Base Product ID': p.id, 'Base Product Name': p.name, 'Variant ID': v.id, 'Variant Name': v.name, 'Category': p.category, 'Price': v.price, 'Is Pre-Order': v.isPreOrder ? 'Yes' : 'No', 'Is Assorted Box': v.configurableOptions ? 'Yes' : 'No', 'Inventory Consumption': JSON.stringify(v.inventoryConsumption),
        })));
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(productsData), "Products");
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(masterInventory.map(i => ({'ID': i.inventoryItemId, 'Name': i.itemName, 'Unit': i.unit}))), "Master Inventory Items");
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(categories.map(c => ({'ID': c.id, 'Name': c.name, 'Description': c.description, 'Icon': c.icon}))), "Product Categories");
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(expenseCategories.map(c => ({'ID': c.id, 'Name': c.name}))), "Expense Categories");
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(users.map(u => ({'ID': u.id, 'Full Name': u.fullName, 'Username': u.username, 'Role': u.role, 'Is Active': u.isActive ? 'Yes' : 'No', 'Permissions': (u.permissions || []).join(', '),'Default Store ID': u.defaultStoreId, 'Accessible Store IDs': (u.accessibleStoreIds || []).join(', ')}))), "Users");
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(allStores.map(s => ({'ID': s.id, 'Name': s.name, 'Location': s.location}))), "Stores");

        const truncateSheetName = (name: string) => name.substring(0, 31);

        for (const store of allStores) {
            const [sales, expenses, inventory] = await Promise.all([
                getSales(store.id),
                getExpenses(store.id),
                getStoreInventory(store.id)
            ]);
            const salesData = sales.map(s => ({ 'Sale ID': s.id, 'Date': format(s.timestamp, 'yyyy-MM-dd HH:mm:ss'), 'Customer': s.customerName || 'N/A', 'Items': JSON.stringify(s.items), 'Subtotal': s.subtotal, 'Discount': s.discount, 'Total': s.total, 'Payment Method': s.paymentMethod, 'Is Pre-Order': s.isPreOrder ? 'Yes' : 'No' }));
            const expensesData = expenses.map(e => ({ 'Expense ID': e.id, 'Date': format(e.date, 'yyyy-MM-dd'), 'Description': e.description, 'Amount': e.amount, 'Category': e.categoryName, 'Notes': e.notes }));
            const inventoryData = inventory.map(item => ({ 'Item ID': item.inventoryItemId, 'Item Name': item.itemName, 'Current Stock': item.stock, 'Unit': item.unit }));
            
            XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(salesData), truncateSheetName(`Sales (${store.name})`));
            XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(expensesData), truncateSheetName(`Expenses (${store.name})`));
            XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(inventoryData), truncateSheetName(`Inventory (${store.name})`));
        }

        XLSX.writeFile(workbook, `ElRio_POS_Full_Backup_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

        toast({
            title: 'Backup Successful',
            description: 'All system data has been exported to an Excel file.',
        });

    } catch (error) {
        console.error('Failed to backup data:', error);
        toast({
            variant: 'destructive',
            title: 'Backup Failed',
            description: 'An error occurred while exporting system data.',
        });
    } finally {
        setIsBackingUp(false);
    }
  }

  const handleAssignProducts = async () => {
    if (!selectedStore) return;
    setIsAssigning(true);
    try {
        await bulkAssignProductsToStore(selectedStore);
        const storeName = allStores.find(s => s.id === selectedStore)?.name;
        toast({
            title: 'Products Assigned',
            description: `All products are now available in the "${storeName}" store.`
        });
        setAssignProductsConfirmation('');
        setSelectedStore('');
    } catch (error) {
        console.error('Failed to assign products:', error);
        toast({
            variant: 'destructive',
            title: 'Assignment Failed',
            description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        });
    } finally {
        setIsAssigning(false);
    }
  };
  
  const isInventoryConfirmationMatch = inventoryConfirmation === 'reset';
  const isTransactionsConfirmationMatch = transactionsConfirmation === 'reset all data';
  const isAssignConfirmationMatch = assignProductsConfirmation === 'assign all';
  
  const selectedStoreName = (isAdminView && selectedStore)
    ? allStores.find(s => s.id === selectedStore)?.name
    : currentStore?.name;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">System Settings</h1>
          <p className="text-muted-foreground">Perform system-wide data operations.</p>
        </div>
         {isAdminView && (
            <div className="w-full sm:w-72">
                <Label htmlFor="store-select" className="sr-only">Select Store to Manage</Label>
                <Select value={selectedStore} onValueChange={setSelectedStore}>
                    <SelectTrigger id="store-select" className="w-full">
                        <SelectValue placeholder="Select a store to manage..." />
                    </SelectTrigger>
                    <SelectContent>
                        {allStores.map(store => (
                            <SelectItem key={store.id} value={store.id}>
                                {store.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
          )}
      </div>

       {isAdminView && (
        <Card>
          <Form {...settingsForm}>
            <form onSubmit={settingsForm.handleSubmit(handleSaveSettings)}>
              <CardHeader>
                <CardTitle>Email Settings</CardTitle>
                <CardDescription>
                  EOD recipient is saved for later. Outbound email is off until you set{' '}
                  <code className="text-xs">NEXT_PUBLIC_EMAIL_OUTBOUND_ENABLED=true</code> and wire up delivery (e.g. Trigger Email).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={settingsForm.control}
                  name="eodReportRecipient"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>EOD Report Recipient</FormLabel>
                      <FormControl>
                        <div className="relative">
                           <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                           <Input placeholder="recipient@example.com" {...field} className="pl-10" autoComplete="off" />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Saved for when email is enabled. No messages are sent while outbound email is disabled.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter className="justify-end">
                <Button type="submit" disabled={settingsForm.formState.isSubmitting}>
                  {settingsForm.formState.isSubmitting ? 'Saving...' : 'Save Settings'}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Backup & Export</CardTitle>
          <CardDescription>Download your data for offline use or record-keeping.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           {!isAdminView && (
             <div className="flex items-center justify-between p-4 rounded-lg border">
                <div>
                  <p className="font-semibold">Export Inventory Data</p>
                  <p className="text-sm text-muted-foreground">Download inventory and stock levels for the current store.</p>
                </div>
                <Button onClick={handleExportInventory} disabled={isExporting || !currentStore}>
                  <Download className="mr-2 h-4 w-4" /> 
                  {isExporting ? 'Exporting...' : 'Export to Excel'}
                </Button>
              </div>
           )}
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div>
              <p className="font-semibold">Backup All System Data</p>
              <p className="text-sm text-muted-foreground">Download a complete backup of products, users, and data for all stores.</p>
            </div>
            <Button onClick={handleBackupAllData} disabled={isBackingUp}>
              <Archive className="mr-2 h-4 w-4" /> 
              {isBackingUp ? 'Backing up...' : 'Backup Everything'}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {isAdminView && (
        <Card>
            <CardHeader>
              <CardTitle>Bulk Operations</CardTitle>
              <CardDescription>Perform actions on multiple records at once.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                        <p className="font-semibold">Assign All Products to a Store</p>
                        <p className="text-sm text-muted-foreground">Make every product in the system available in a specific store.</p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button disabled={!selectedStore}>
                            <PackagePlus className="mr-2 h-4 w-4" /> Assign Products
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                         <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will make <span className="font-bold">all products</span> available in the <span className="font-bold">"{selectedStoreName}"</span> store. This won't remove them from other stores.
                            <br/><br/>
                            Please type <strong className="text-foreground">assign all</strong> to confirm.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <Input
                            value={assignProductsConfirmation}
                            onChange={(e) => setAssignProductsConfirmation(e.target.value)}
                            autoComplete="off"
                            autoCapitalize="off"
                        />
                        <AlertDialogFooter>
                           <AlertDialogCancel onClick={() => setAssignProductsConfirmation('')}>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleAssignProducts}
                            disabled={!isAssignConfirmationMatch || isAssigning}
                          >
                            {isAssigning ? 'Assigning...' : 'Yes, assign all products'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardContent>
        </Card>
      )}

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle>Dangerous Actions</CardTitle>
          <CardDescription>
            These actions are irreversible. Please proceed with caution.
             {!isAdminView && ` All actions here will affect the currently selected store: ${currentStore?.name}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          
          <div className="flex items-center justify-between p-4 rounded-lg bg-destructive/10">
            <div>
              <p className="font-semibold">Reset All Inventory Stock</p>
              <p className="text-sm text-muted-foreground">This will set the stock level of every inventory item to zero for the selected store.</p>
            </div>
            
            <AlertDialog open={resetInventoryDialog} onOpenChange={setResetInventoryDialog}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isAdminView ? !selectedStore : !currentStore}>
                  <Trash2 className="mr-2 h-4 w-4" /> Reset Inventory
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2"><AlertCircle className="text-destructive h-6 w-6" />Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This is a highly destructive action. You are about to set the stock level for <span className="font-bold">all inventory items</span> to <span className="font-bold">zero</span> for the <span className="font-bold">{selectedStoreName}</span> store. This cannot be undone.
                    <br/><br/>
                    Please type <strong className="text-foreground">reset</strong> to confirm.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-2">
                    <Label htmlFor="confirmation-inventory" className="sr-only">Confirm by typing 'reset'</Label>
                    <Input 
                        id="confirmation-inventory"
                        value={inventoryConfirmation}
                        onChange={(e) => setInventoryConfirmation(e.target.value)}
                        autoComplete="off"
                        autoCapitalize="off"
                    />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setInventoryConfirmation('')}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleResetInventory}
                    disabled={!isInventoryConfirmationMatch || isResettingInventory}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    {isResettingInventory ? 'Resetting...' : 'Yes, reset all stock'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          
          <div className="flex items-center justify-between p-4 rounded-lg bg-destructive/10">
            <div>
              <p className="font-semibold">Reset All Transactional Data</p>
              <p className="text-sm text-muted-foreground">Permanently delete all sales, expenses, and customer credit data for the selected store.</p>
            </div>
            
             <AlertDialog open={resetTransactionsDialog} onOpenChange={setResetTransactionsDialog}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isAdminView ? !selectedStore : !currentStore}>
                  <Trash2 className="mr-2 h-4 w-4" /> Reset Transactions
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2"><AlertCircle className="text-destructive h-6 w-6" />Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This is a highly destructive action. You are about to delete <span className="font-bold">all transactional data</span> (sales, expenses, inventory logs, CRM balances) from the <span className="font-bold">{selectedStoreName}</span> store. This cannot be undone.
                    <br/><br/>
                    Please type <strong className="text-foreground">reset all data</strong> to confirm.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-2">
                    <Label htmlFor="confirmation-transactions" className="sr-only">Confirm by typing 'reset all data'</Label>
                    <Input 
                        id="confirmation-transactions"
                        value={transactionsConfirmation}
                        onChange={(e) => setTransactionsConfirmation(e.target.value)}
                        autoComplete="off"
                        autoCapitalize="off"
                    />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setTransactionsConfirmation('')}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleResetTransactions}
                    disabled={!isTransactionsConfirmationMatch || isResettingTransactions}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    {isResettingTransactions ? 'Resetting...' : 'Yes, reset all transactions'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            Use these tools for end-of-day or periodic system maintenance.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

    
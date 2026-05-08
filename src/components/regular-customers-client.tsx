
"use client";

import React, { useState, useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { RegularCustomer } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { PlusCircle, Pencil, Trash2, Search, HandCoins, History } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { addRegularCustomer, updateRegularCustomer, deleteRegularCustomer } from '@/services/customer-service';
import { recordCustomerPayment } from '@/services/payment-service';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
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
import { CustomerTransactionHistoryDialog } from './customer-transaction-history-dialog';


const customerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
});
type CustomerFormValues = z.infer<typeof customerSchema>;

const paymentSchema = z.object({
    amount: z.coerce.number().positive('Amount must be positive'),
    notes: z.string().optional(),
});
type PaymentFormValues = z.infer<typeof paymentSchema>;

interface DialogState<T> {
  open: boolean;
  data: T | null;
}

interface RegularCustomersClientProps {
  customers: RegularCustomer[];
  setCustomers: React.Dispatch<React.SetStateAction<RegularCustomer[]>>;
  onNeedsRefresh: () => void;
}

export function RegularCustomersClient({ customers, setCustomers, onNeedsRefresh }: RegularCustomersClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  
  const [addEditDialog, setAddEditDialog] = useState<DialogState<RegularCustomer>>({ open: false, data: null });
  const [deleteDialog, setDeleteDialog] = useState<DialogState<RegularCustomer>>({ open: false, data: null });
  const [paymentDialog, setPaymentDialog] = useState<DialogState<RegularCustomer>>({ open: false, data: null });
  const [historyDialog, setHistoryDialog] = useState<DialogState<RegularCustomer>>({ open: false, data: null });


  const { toast } = useToast();
  const { currentStore } = useAuth();

  const customerForm = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { firstName: '', lastName: '' },
  });
  
  const paymentForm = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: 0, notes: '' },
  });

  const filteredCustomers = React.useMemo(() => {
    return customers.filter(c =>
      c.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lastName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [customers, searchQuery]);

  const handleSaveCustomer: SubmitHandler<CustomerFormValues> = async (data) => {
    try {
      if (addEditDialog.data?.id) {
        // Update
        const updatedData = { firstName: data.firstName, lastName: data.lastName };
        await updateRegularCustomer(addEditDialog.data.id, updatedData);
        onNeedsRefresh();
        toast({ title: 'Customer Updated' });
      } else {
        // Add
        await addRegularCustomer(data.firstName, data.lastName);
        onNeedsRefresh();
        toast({ title: 'Customer Added' });
      }
      setAddEditDialog({ open: false, data: null });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save customer.' });
    }
  };

  const handleDeleteCustomer = async () => {
    if (!deleteDialog.data) return;
    try {
      await deleteRegularCustomer(deleteDialog.data.id);
      onNeedsRefresh();
      toast({ title: 'Customer Deleted' });
      setDeleteDialog({ open: false, data: null });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete customer.' });
    }
  };
  
  const handleRecordPayment: SubmitHandler<PaymentFormValues> = async (data) => {
    if (!paymentDialog.data || !currentStore) return;

    try {
        await recordCustomerPayment(currentStore.id, paymentDialog.data.id, data.amount, data.notes);
        onNeedsRefresh(); // Refresh the entire customer list
        toast({ title: "Payment Recorded", description: `Payment of ₱${data.amount.toFixed(2)} recorded for ${paymentDialog.data.firstName}.` });
        setPaymentDialog({ open: false, data: null });
    } catch (error) {
        console.error("Failed to record payment:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to record payment.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Regular Customers</h1>
          <p className="text-muted-foreground">Manage your regular customers and their credit balances for {currentStore?.name}.</p>
        </div>
        <Button onClick={() => { customerForm.reset(); setAddEditDialog({ open: true, data: null }); }}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Customer
        </Button>
      </div>

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

      <Card>
        <CardContent className="p-4 pt-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Last Name</TableHead>
                  <TableHead>First Name</TableHead>
                  <TableHead>Credit Balance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map(customer => {
                  const creditBalance = currentStore ? customer.storeCredit?.[currentStore.id] || 0 : 0;
                  return (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.lastName}</TableCell>
                      <TableCell>{customer.firstName}</TableCell>
                      <TableCell className={creditBalance > 0 ? "font-bold text-destructive" : "text-muted-foreground"}>
                        ₱{creditBalance.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" title="View History" onClick={() => setHistoryDialog({ open: true, data: customer })}>
                                <History className="h-4 w-4" />
                            </Button>
                              {creditBalance > 0 && (
                                  <Button variant="ghost" size="icon" title="Settle Payment" className="text-green-600 hover:text-green-700" onClick={() => {paymentForm.reset({amount: creditBalance, notes: ''}); setPaymentDialog({ open: true, data: customer })}}>
                                      <HandCoins className="h-4 w-4" />
                                  </Button>
                              )}
                              <Button variant="ghost" size="icon" title="Edit Customer" onClick={() => { customerForm.reset(customer); setAddEditDialog({ open: true, data: customer }) }}>
                                  <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Delete Customer" className="text-destructive hover:text-destructive" onClick={() => setDeleteDialog({ open: true, data: customer })}>
                                  <Trash2 className="h-4 w-4" />
                              </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      {/* Add/Edit Customer Dialog */}
      <Dialog open={addEditDialog.open} onOpenChange={(open) => setAddEditDialog({ ...addEditDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{addEditDialog.data ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
          </DialogHeader>
          <Form {...customerForm}>
            <form onSubmit={customerForm.handleSubmit(handleSaveCustomer)} className="space-y-4">
              <FormField
                control={customerForm.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl><Input {...field} autoComplete="off" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={customerForm.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl><Input {...field} autoComplete="off" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit">Save Customer</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Record Payment Dialog */}
      <Dialog open={paymentDialog.open} onOpenChange={(open) => setPaymentDialog({ ...paymentDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment for {paymentDialog.data?.firstName}</DialogTitle>
          </DialogHeader>
          <Form {...paymentForm}>
            <form onSubmit={paymentForm.handleSubmit(handleRecordPayment)} className="space-y-4">
               <FormField
                control={paymentForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount Paid</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} autoComplete="off" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={paymentForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl><Input {...field} autoComplete="off" placeholder="e.g., GCash payment" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit">Record Payment</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the customer "{deleteDialog.data?.firstName} {deleteDialog.data?.lastName}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCustomer} disabled={Object.values(deleteDialog.data?.storeCredit || {}).some(balance => balance > 0)}>
                Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* History Dialog */}
      {historyDialog.open && historyDialog.data && currentStore && (
        <CustomerTransactionHistoryDialog
            open={historyDialog.open}
            onOpenChange={(open) => setHistoryDialog({ ...historyDialog, open })}
            customer={historyDialog.data}
            store={currentStore}
        />
      )}
    </div>
  );
}

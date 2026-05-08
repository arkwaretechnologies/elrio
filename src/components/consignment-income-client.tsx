
"use client";

import React, { useState, useMemo } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { Calendar as CalendarIcon, PlusCircle, Pencil, Trash2, DollarSign } from 'lucide-react';

import type { ConsignmentIncome } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  addConsignmentIncome, updateConsignmentIncome, deleteConsignmentIncome
} from '@/services/consignment-service';
import { useAuth } from '@/context/auth-context';
import { DateRange } from 'react-day-picker';
import { Separator } from './ui/separator';

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

const incomeSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  amount: z.coerce.number().positive('Amount must be a positive number'),
  date: z.date(),
  notes: z.string().optional(),
});
type IncomeFormValues = z.infer<typeof incomeSchema>;

interface DialogState<T> {
  open: boolean;
  data: T | null;
}

export function ConsignmentIncomeClient({ initialIncomes }: { initialIncomes: ConsignmentIncome[] }) {
  const [incomes, setIncomes] = useState<ConsignmentIncome[]>(initialIncomes);
  const [date, setDate] = useState<DateRange | undefined>({ from: startOfDay(new Date()), to: endOfDay(new Date()) });
  
  const [incomeDialog, setIncomeDialog] = useState<DialogState<ConsignmentIncome>>({ open: false, data: null });
  const [deleteDialog, setDeleteDialog] = useState<DialogState<ConsignmentIncome>>({ open: false, data: null });

  const { toast } = useToast();
  const { user, currentStore } = useAuth();

  const incomeForm = useForm<IncomeFormValues>({
    resolver: zodResolver(incomeSchema),
    defaultValues: { date: new Date(), description: '', amount: 0, notes: '' },
  });

  const openIncomeDialog = (income?: ConsignmentIncome) => {
    if (income) {
      incomeForm.reset({
        ...income,
        date: new Date(income.date),
      });
    } else {
      incomeForm.reset({ date: new Date(), description: '', amount: 0, notes: '' });
    }
    setIncomeDialog({ open: true, data: income || null });
  };

  const handleSaveIncome: SubmitHandler<IncomeFormValues> = async (data) => {
    if (!currentStore) {
        toast({ variant: 'destructive', title: 'Error', description: 'No store selected.' });
        return;
    }
    try {
      const incomeData = { ...data, storeId: currentStore.id };

      if (incomeDialog.data?.id) {
        // Update
        await updateConsignmentIncome(incomeDialog.data.id, incomeData);
        setIncomes(incomes.map(e => e.id === incomeDialog.data!.id ? { ...incomeDialog.data, ...incomeData } as ConsignmentIncome : e));
        toast({ title: 'Income Updated' });
      } else {
        // Add
        const newId = await addConsignmentIncome(incomeData);
        const newIncome = { id: newId, ...incomeData, date: new Date(incomeData.date) } as ConsignmentIncome;
        setIncomes(prevIncomes => [...prevIncomes, newIncome].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        toast({ title: 'Income Added' });
      }
      setIncomeDialog({ open: false, data: null });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save income.' });
    }
  };

  const handleDeleteIncome = async () => {
    if (!deleteDialog.data) return;
    try {
      await deleteConsignmentIncome(deleteDialog.data.id);
      setIncomes(incomes.filter(e => e.id !== deleteDialog.data!.id));
      toast({ title: 'Income Deleted' });
      setDeleteDialog({ open: false, data: null });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete income.' });
    }
  };
  
  const filteredIncomes = useMemo(() => {
    if (!date?.from) return incomes;

    const from = startOfDay(date.from);
    const to = date.to ? endOfDay(date.to) : endOfDay(date.from);

    return incomes.filter(e => isWithinInterval(new Date(e.date), { start: from, end: to }));

  }, [incomes, date]);

  const todayTotal = useMemo(() => {
    const today = new Date();
    const todayIncomes = incomes.filter(e => isWithinInterval(new Date(e.date), { start: startOfDay(today), end: endOfDay(today) }))
      .reduce((sum, e) => sum + e.amount, 0);
    return `₱${todayIncomes.toFixed(2)}`;
  }, [incomes]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Consignment Income</h1>
          <p className="text-muted-foreground">Record profits from consignment goods.</p>
        </div>
        <Button onClick={() => openIncomeDialog()}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Income
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-1">
        <StatCard icon={DollarSign} title="Today's Consignment Income" value={todayTotal} color="text-green-500" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-4 justify-between items-center">
            <CardTitle>Income List</CardTitle>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn("w-full sm:w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground")}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                            date.to ? `${format(date.from, "LLL dd, y")} - ${format(date.to, "LLL dd, y")}` : format(date.from, "LLL dd, y")
                        ) : (<span>Pick a date range</span>)}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 flex" align="end">
                    <div className="flex flex-col space-y-2 p-2 border-r">
                        <Button variant="ghost" className="justify-start" onClick={() => setDate({ from: new Date(), to: new Date() })}>Today</Button>
                        <Button variant="ghost" className="justify-start" onClick={() => { const yesterday = subDays(new Date(), 1); setDate({ from: yesterday, to: yesterday }); }}>Yesterday</Button>
                        <Button variant="ghost" className="justify-start" onClick={() => setDate({ from: startOfWeek(new Date()), to: endOfWeek(new Date()) })}>This Week</Button>
                        <Button variant="ghost" className="justify-start" onClick={() => setDate({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })}>This Month</Button>
                    </div>
                    <Separator orientation="vertical" />
                    <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2} />
                </PopoverContent>
            </Popover>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredIncomes.map((income) => (
                <TableRow key={income.id}>
                  <TableCell>{format(new Date(income.date), 'MMM d, yyyy')}</TableCell>
                  <TableCell className="font-medium">{income.description}</TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">{income.notes || 'N/A'}</TableCell>
                  <TableCell className="text-right font-bold text-green-600">₱{income.amount.toFixed(2)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => openIncomeDialog(income)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteDialog({ open: true, data: income })}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={incomeDialog.open} onOpenChange={(open) => setIncomeDialog({ ...incomeDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{incomeDialog.data ? 'Edit Income' : 'Add New Income'}</DialogTitle>
          </DialogHeader>
          <Form {...incomeForm}>
            <form onSubmit={incomeForm.handleSubmit(handleSaveIncome)} className="space-y-4">
              <FormField
                control={incomeForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g., Sold 10 cakes" autoComplete="off" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={incomeForm.control}
                name="amount"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
                )}
              />
              <FormField
                control={incomeForm.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date of Income</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                          >
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={incomeForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl><Textarea {...field} placeholder="Any additional details..." /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIncomeDialog({ open: false, data: null })}>Cancel</Button>
                <Button type="submit">Save Income</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the income entry for "{deleteDialog.data?.description}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteIncome}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { Calendar as CalendarIcon, PlusCircle, Pencil, Trash2, DollarSign, CalendarDays } from 'lucide-react';

import type { Expense, ExpenseCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  addExpense, updateExpense, deleteExpense, addExpenseCategory, getExpenseCategories
} from '@/services/expense-service';
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

const expenseSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  amount: z.coerce.number().positive('Amount must be a positive number'),
  categoryId: z.string().min(1, 'Category is required'),
  date: z.date(),
  notes: z.string().optional(),
});
type ExpenseFormValues = z.infer<typeof expenseSchema>;

const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
});
type CategoryFormValues = z.infer<typeof categorySchema>;

interface DialogState<T> {
  open: boolean;
  data: T | null;
}

export function ExpensesClient({ initialExpenses, initialCategories }: { initialExpenses: Expense[], initialCategories: ExpenseCategory[] }) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [categories, setCategories] = useState<ExpenseCategory[]>(initialCategories);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [date, setDate] = useState<DateRange | undefined>({ from: startOfDay(new Date()), to: endOfDay(new Date()) });
  
  const [expenseDialog, setExpenseDialog] = useState<DialogState<Expense>>({ open: false, data: null });
  const [deleteDialog, setDeleteDialog] = useState<DialogState<Expense>>({ open: false, data: null });
  const [categoryDialog, setCategoryDialog] = useState(false);

  const { toast } = useToast();
  const { user, currentStore } = useAuth();
  const canManageCategories = user?.role === 'Supervisor' || user?.role === 'Owner' || user?.role === 'Admin';

  const expenseForm = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { date: new Date(), description: '', amount: 0, categoryId: '', notes: '' },
  });

  const categoryForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '' },
  });

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      if (a.name.toLowerCase() === 'others') return 1;
      if (b.name.toLowerCase() === 'others') return -1;
      return a.name.localeCompare(b.name);
    });
  }, [categories]);

  const openExpenseDialog = (expense?: Expense) => {
    if (expense) {
      expenseForm.reset({
        ...expense,
        date: new Date(expense.date),
      });
    } else {
      expenseForm.reset({ date: new Date(), description: '', amount: 0, categoryId: '', notes: '' });
    }
    setExpenseDialog({ open: true, data: expense || null });
  };

  const handleSaveExpense: SubmitHandler<ExpenseFormValues> = async (data) => {
    if (!currentStore) {
        toast({ variant: 'destructive', title: 'Error', description: 'No store selected.' });
        return;
    }
    try {
      const category = categories.find(c => c.id === data.categoryId);
      if (!category) throw new Error("Category not found");

      const expenseData = { ...data, categoryName: category.name, storeId: currentStore.id };

      if (expenseDialog.data?.id) {
        // Update
        await updateExpense(expenseDialog.data.id, expenseData);
        setExpenses(expenses.map(e => e.id === expenseDialog.data!.id ? { ...expenseDialog.data, ...expenseData } as Expense : e));
        toast({ title: 'Expense Updated' });
      } else {
        // Add
        const newId = await addExpense(expenseData);
        const newExpense = { id: newId, ...expenseData, date: new Date(expenseData.date) } as Expense;
        setExpenses(prevExpenses => [...prevExpenses, newExpense].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        toast({ title: 'Expense Added' });
      }
      setExpenseDialog({ open: false, data: null });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save expense.' });
    }
  };

  const handleDeleteExpense = async () => {
    if (!deleteDialog.data) return;
    try {
      await deleteExpense(deleteDialog.data.id);
      setExpenses(expenses.filter(e => e.id !== deleteDialog.data!.id));
      toast({ title: 'Expense Deleted' });
      setDeleteDialog({ open: false, data: null });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete expense.' });
    }
  };

  const handleAddCategory: SubmitHandler<CategoryFormValues> = async (data) => {
    try {
      const newCategory = await addExpenseCategory(data.name);
      setCategories(prev => [...prev, newCategory]);
      categoryForm.reset();
      toast({ title: 'Category Added' });
    } catch (error) {
       toast({ variant: 'destructive', title: 'Error', description: 'Failed to add category.' });
    }
  };
  
  const filteredExpenses = useMemo(() => {
    const categoryFiltered = filterCategory === 'all'
      ? expenses
      : expenses.filter(e => e.categoryId === filterCategory);

    if (!date?.from) return categoryFiltered;

    const from = startOfDay(date.from);
    const to = date.to ? endOfDay(date.to) : endOfDay(date.from);

    return categoryFiltered.filter(e => isWithinInterval(new Date(e.date), { start: from, end: to }));

  }, [expenses, filterCategory, date]);

  const todayTotal = useMemo(() => {
    const today = new Date();
    const todayExpenses = expenses.filter(e => isWithinInterval(new Date(e.date), { start: startOfDay(today), end: endOfDay(today) }))
      .reduce((sum, e) => sum + e.amount, 0);
    return `₱${todayExpenses.toFixed(2)}`;
  }, [expenses]);


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Expense Tracking</h1>
          <p className="text-muted-foreground">Monitor and manage your business expenses.</p>
        </div>
        <Button onClick={() => openExpenseDialog()}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Expense
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-1">
        <StatCard icon={DollarSign} title="Today's Expenses" value={todayTotal} color="text-red-500" />
      </div>

      <Tabs defaultValue="expenses">
        <TabsList>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          {canManageCategories && <TabsTrigger value="categories">Manage Categories</TabsTrigger>}
        </TabsList>
        <TabsContent value="expenses" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap gap-4 justify-between items-center">
                <CardTitle>Expense List</CardTitle>
                <div className="flex gap-2">
                  <div className="w-full sm:w-56">
                    <Select onValueChange={setFilterCategory} defaultValue="all">
                      <SelectTrigger><SelectValue placeholder="Filter by category..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {sortedCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
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
                    <TableHead>Category</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>{format(new Date(expense.date), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="font-medium">{expense.description}</TableCell>
                      <TableCell>{expense.categoryName}</TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">{expense.notes || 'N/A'}</TableCell>
                      <TableCell className="text-right font-bold">₱{expense.amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => openExpenseDialog(expense)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteDialog({ open: true, data: expense })}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        {canManageCategories && (
          <TabsContent value="categories" className="space-y-4">
              <Card>
                  <CardHeader>
                      <CardTitle>Expense Categories</CardTitle>
                  </CardHeader>
                  <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                              <h3 className="font-semibold mb-2">Existing Categories</h3>
                              <div className="border rounded-md p-2 space-y-1 max-h-60 overflow-y-auto">
                                  {sortedCategories.map(c => <p key={c.id} className="text-sm p-1">{c.name}</p>)}
                              </div>
                          </div>
                          <div>
                              <h3 className="font-semibold mb-2">Add New Category</h3>
                              <Form {...categoryForm}>
                                  <form onSubmit={categoryForm.handleSubmit(handleAddCategory)} className="flex items-start gap-2">
                                      <FormField
                                      control={categoryForm.control}
                                      name="name"
                                      render={({ field }) => (
                                          <FormItem className="flex-grow">
                                              <FormControl>
                                                  <Input placeholder="e.g., Utilities" {...field} autoComplete='off'/>
                                              </FormControl>
                                              <FormMessage />
                                          </FormItem>
                                      )}
                                      />
                                      <Button type="submit">Add</Button>
                                  </form>
                              </Form>
                          </div>
                      </div>
                  </CardContent>
              </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Add/Edit Expense Dialog */}
      <Dialog open={expenseDialog.open} onOpenChange={(open) => setExpenseDialog({ ...expenseDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{expenseDialog.data ? 'Edit Expense' : 'Add New Expense'}</DialogTitle>
          </DialogHeader>
          <Form {...expenseForm}>
            <form onSubmit={expenseForm.handleSubmit(handleSaveExpense)} className="space-y-4">
              <FormField
                control={expenseForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g., Monthly electricity bill" autoComplete="off" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                 <FormField
                    control={expenseForm.control}
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
                    control={expenseForm.control}
                    name="categoryId"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {sortedCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              </div>
              <FormField
                control={expenseForm.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date of Expense</FormLabel>
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
                control={expenseForm.control}
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
                <Button type="button" variant="outline" onClick={() => setExpenseDialog({ open: false, data: null })}>Cancel</Button>
                <Button type="submit">Save Expense</Button>
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
              This action cannot be undone. This will permanently delete the expense entry for "{deleteDialog.data?.description}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExpense}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

    
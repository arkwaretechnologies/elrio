
"use client";

import { useEffect, useState } from 'react';
import { ExpensesClient } from "@/components/expenses-client";
import { getExpenses, getExpenseCategories } from "@/services/expense-service";
import { useAuth } from '@/context/auth-context';
import { CakeLoader } from '@/components/cake-loader';
import type { Expense, ExpenseCategory } from '@/lib/types';
import { usePathname } from 'next/navigation';

export default function ExpensesPage({ selectedStoreId }: { selectedStoreId?: string }) {
  const { user, currentStore } = useAuth();
  const pathname = usePathname();
  const isAdminView = pathname.startsWith('/super-admin');

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  
  const storeToFetch = isAdminView ? selectedStoreId : currentStore?.id;

  useEffect(() => {
    if (!storeToFetch) {
      setLoading(false);
      setExpenses([]);
      setCategories([]);
      return;
    };
    
    setLoading(true);
    Promise.all([
      getExpenses(storeToFetch),
      getExpenseCategories()
    ]).then(([fetchedExpenses, fetchedCategories]) => {
      setExpenses(fetchedExpenses);
      setCategories(fetchedCategories);
      setLoading(false);
    }).catch(error => {
      console.error("Failed to load expenses data:", error);
      setLoading(false);
    });
  }, [storeToFetch]);

  if (loading) {
     return (
        <div className="flex flex-col items-center justify-center h-full">
            <CakeLoader />
            <p className="mt-4 text-lg text-muted-foreground">Loading expenses...</p>
        </div>
    );
  }

  // In admin view, if no store is selected, don't show the client
  if (isAdminView && !selectedStoreId) {
     return (
        <div className="flex flex-col items-center justify-center h-96">
            <p className="mt-4 text-lg text-muted-foreground">Please select a store to view expenses.</p>
        </div>
    );
  }

  return (
    <div className="p-6">
      <ExpensesClient initialExpenses={expenses} initialCategories={categories} />
    </div>
  );
}

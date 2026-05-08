
"use client";

import { useEffect, useState } from 'react';
import { ConsignmentIncomeClient } from "@/components/consignment-income-client";
import { getConsignmentIncomes } from "@/services/consignment-service";
import { useAuth } from '@/context/auth-context';
import { CakeLoader } from '@/components/cake-loader';
import type { ConsignmentIncome } from '@/lib/types';

export default function ConsignmentIncomePage() {
  const { user, currentStore } = useAuth();
  const [incomes, setIncomes] = useState<ConsignmentIncome[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!currentStore) {
      setLoading(false);
      setIncomes([]);
      return;
    };
    
    setLoading(true);
    getConsignmentIncomes(currentStore.id)
    .then((fetchedIncomes) => {
      setIncomes(fetchedIncomes);
      setLoading(false);
    }).catch(error => {
      console.error("Failed to load consignment income data:", error);
      setLoading(false);
    });
  }, [currentStore]);

  if (loading) {
     return (
        <div className="flex flex-col items-center justify-center h-full">
            <CakeLoader />
            <p className="mt-4 text-lg text-muted-foreground">Loading consignment incomes...</p>
        </div>
    );
  }

  return (
    <div className="p-6">
      <ConsignmentIncomeClient initialIncomes={incomes} />
    </div>
  );
}

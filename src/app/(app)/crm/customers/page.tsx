
"use client";

import React, { useState, useEffect } from 'react';
import { RegularCustomersClient } from "@/components/regular-customers-client";
import { getRegularCustomers } from "@/services/customer-service";
import { CakeLoader } from '@/components/cake-loader';
import type { RegularCustomer } from '@/lib/types';
import { useAuth } from '@/context/auth-context';

export default function RegularCustomersPage() {
  const [customers, setCustomers] = useState<RegularCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentStore } = useAuth();


  const refreshCustomers = () => {
    if (currentStore) {
      setLoading(true);
      getRegularCustomers()
        .then(setCustomers)
        .finally(() => setLoading(false));
    }
  }

  useEffect(() => {
    refreshCustomers();
  }, [currentStore]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <CakeLoader />
        <p className="mt-4 text-lg text-muted-foreground">Loading customers...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <RegularCustomersClient 
        customers={customers} 
        setCustomers={setCustomers}
        onNeedsRefresh={refreshCustomers}
       />
    </div>
  );
}

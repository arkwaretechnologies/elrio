

"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { CakeLoader } from '@/components/cake-loader';
import { EndOfDayClient } from '@/components/end-of-day-client';
import { getSalesForDate, getEodReport } from '@/services/eod-service';
import { getExpenses } from '@/services/expense-service';
import { getConsignmentIncomes } from '@/services/consignment-service';
import { getPaymentsForDate } from '@/services/payment-service';
import type { Sale, EodReport, Expense, Payment, ConsignmentIncome } from '@/lib/types';
import { startOfDay, isSameDay } from 'date-fns';

export default function EndOfDayPage() {
  const { user, currentStore } = useAuth();
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [consignmentIncomes, setConsignmentIncomes] = useState<ConsignmentIncome[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [report, setReport] = useState<EodReport | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDataForDate = useCallback(async (date: Date) => {
    if (!currentStore) return;

    setLoading(true);
    try {
      const existingReport = await getEodReport(currentStore.id, date);
      if (existingReport) {
        setReport(existingReport);
        setSales([]); 
        setExpenses([]);
        setConsignmentIncomes([]);
        setPayments([]);
      } else {
        const [fetchedSales, allExpenses, fetchedPayments, allIncomes] = await Promise.all([
            getSalesForDate(currentStore.id, date),
            getExpenses(currentStore.id),
            getPaymentsForDate(currentStore.id, date),
            getConsignmentIncomes(currentStore.id),
        ]);
        
        const todaysExpenses = allExpenses.filter(e => isSameDay(new Date(e.date), date));
        const todaysIncomes = allIncomes.filter(i => isSameDay(new Date(i.date), date));

        setSales(fetchedSales);
        setExpenses(todaysExpenses);
        setConsignmentIncomes(todaysIncomes);
        setPayments(fetchedPayments);
        setReport(null);
      }
    } catch (error) {
      console.error("Failed to fetch EOD data:", error);
    } finally {
      setLoading(false);
    }
  }, [currentStore]);
  
  useEffect(() => {
    if (currentStore) {
      fetchDataForDate(selectedDate);
    } else {
      setLoading(false); 
    }
  }, [currentStore, selectedDate, fetchDataForDate]);

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
    }
  };
  
  const handleReportGenerated = (newReport: EodReport) => {
    setReport(newReport);
    setSales([]);
    setExpenses([]);
    setConsignmentIncomes([]);
    setPayments([]);
  };
  
  const handleReportDeleted = () => {
    setReport(null);
    fetchDataForDate(selectedDate);
  }

  if (!currentStore) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <CakeLoader />
        <p className="mt-4 text-lg text-muted-foreground">Please select a store to view reports.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <EndOfDayClient
        date={selectedDate}
        onDateChange={handleDateChange}
        sales={sales}
        expenses={expenses}
        consignmentIncomes={consignmentIncomes}
        settlementPayments={payments}
        report={report}
        loading={loading}
        user={user}
        store={currentStore}
        onReportGenerated={handleReportGenerated}
        onReportDeleted={handleReportDeleted}
      />
    </div>
  );
}

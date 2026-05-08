
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CakeLoader } from "./cake-loader";
import { Calendar as CalendarIcon, Package, HandCoins, ArrowDown, ArrowUp } from 'lucide-react';
import { getTransactionsForCustomer } from '@/services/customer-service';
import type { RegularCustomer, Store, Sale, Payment } from '@/lib/types';
import { DateRange } from 'react-day-picker';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';

interface CustomerTransactionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: RegularCustomer;
  store: Store;
}

type CombinedTransaction = (Sale | Payment) & { type: 'Sale' | 'Payment' };

export function CustomerTransactionHistoryDialog({ open, onOpenChange, customer, store }: CustomerTransactionHistoryDialogProps) {
  const [transactions, setTransactions] = useState<CombinedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  useEffect(() => {
    if (open) {
      setLoading(true);
      getTransactionsForCustomer(store.id, customer.id)
        .then(data => {
          const combined = data.map(t => ({
            ...t,
            type: 'amount' in t ? 'Payment' : 'Sale' as 'Sale' | 'Payment',
          })) as CombinedTransaction[];
          setTransactions(combined);
        })
        .finally(() => setLoading(false));
    }
  }, [open, store.id, customer.id]);
  
  const filteredAndProcessedTransactions = useMemo(() => {
    if (!date?.from) return { openingBalance: 0, displayTransactions: [] };

    const fromDate = startOfDay(date.from);
    const toDate = date.to ? endOfDay(date.to) : endOfDay(date.from);
      
    const initialBalance = transactions.reduce((balance, t) => {
        const tDate = 'createdAt' in t ? t.createdAt : t.paymentDate;
         if (tDate < fromDate) {
            if (t.type === 'Sale') {
                // Ignore voided sales when calculating initial balance
                if (t.status === 'VOIDED') return balance;
                return balance + (t.onCredit ? (t.total - (t.amountPaid || 0)) : 0);
            } else {
                return balance - t.amount;
            }
        }
        return balance;
    }, 0);


    let currentBalance = initialBalance;
    const finalTransactions = transactions
        .filter(t => {
            const tDate = 'createdAt' in t ? t.createdAt : t.paymentDate;
            return tDate >= fromDate && tDate <= toDate;
        })
        .map(t => {
             if (t.type === 'Sale') {
                if (t.onCredit && t.status !== 'VOIDED') {
                   currentBalance += (t.total - (t.amountPaid || 0));
                }
            } else {
                currentBalance -= t.amount;
            }
            return { ...t, runningBalance: currentBalance };
        });

    return { openingBalance: initialBalance, displayTransactions: finalTransactions };

  }, [transactions, date]);

  const { openingBalance, displayTransactions } = filteredAndProcessedTransactions;
  const currentBalance = displayTransactions.length > 0
    ? displayTransactions[displayTransactions.length - 1].runningBalance
    : openingBalance;
  
  const getTransactionDetails = (t: CombinedTransaction) => {
    if (t.type === 'Payment') {
      return { 
        description: t.notes || 'Payment Received', 
        badgeText: 'Payment',
        badgeVariant: 'default' as const,
        badgeClass: 'bg-green-100 text-green-800',
        amountText: `-₱${t.amount.toFixed(2)}`,
        amountClass: 'text-green-600',
        icon: <HandCoins className="h-4 w-4 text-green-600" />
      };
    }
    
    // If the sale is VOIDED, the credit change is always 0.
    const creditChange = t.status === 'VOIDED' ? 0 : (t.onCredit ? (t.total - (t.amountPaid || 0)) : 0);
    const amountText = creditChange > 0 ? `+₱${creditChange.toFixed(2)}` : (creditChange < 0 ? `-₱${Math.abs(creditChange).toFixed(2)}` : '₱0.00');
    
    if (t.isPreOrder) {
       return { 
        description: t.items.map(i => i.name).join(', '),
        badgeText: t.status === 'VOIDED' ? 'Voided' : 'Pre-order',
        badgeVariant: t.status === 'VOIDED' ? 'destructive' : 'secondary' as const,
        badgeClass: t.status !== 'VOIDED' ? 'bg-purple-100 text-purple-800' : '',
        amountText: amountText,
        amountClass: creditChange > 0 ? 'text-destructive' : 'text-muted-foreground',
        icon: creditChange > 0 ? <ArrowUp className="h-4 w-4 text-destructive" /> : <HandCoins className="h-4 w-4 text-green-600" />
      };
    }
    
    // Regular Sale
     return { 
        description: t.items.map(i => i.name).join(', '),
        badgeText: t.status === 'VOIDED' ? 'Voided' : (t.onCredit ? 'Credit' : 'Sale'),
        badgeVariant: t.status === 'VOIDED' ? 'destructive' : (t.onCredit ? 'destructive' : 'outline') as const,
        badgeClass: '',
        amountText: amountText,
        amountClass: creditChange > 0 ? 'text-destructive' : 'text-muted-foreground',
        icon: creditChange > 0 ? <ArrowUp className="h-4 w-4 text-destructive" /> : <HandCoins className="h-4 w-4 text-green-600" />
      };
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Transaction History for {customer.firstName} {customer.lastName}</DialogTitle>
          <DialogDescription>
            Showing transactions for {store.name}. Current Balance: <span className="font-bold text-destructive">₱{currentBalance.toFixed(2)}</span>
          </DialogDescription>
        </DialogHeader>
        
         <div className="py-4 flex justify-end">
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn("w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground")}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                            date.to ? `${format(date.from, "LLL dd, y")} - ${format(date.to, "LLL dd, y")}` : format(date.from, "LLL dd, y")
                        ) : (<span>Pick a date</span>)}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                    <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2} />
                </PopoverContent>
            </Popover>
        </div>

        <div className="flex-grow overflow-hidden border rounded-md">
            {loading ? (
                <div className="flex items-center justify-center h-full">
                    <CakeLoader />
                </div>
            ) : (
                <ScrollArea className="h-full">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Details</TableHead>
                                <TableHead className="text-right">Credit Change</TableHead>
                                <TableHead className="text-right">Balance After</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow className="bg-muted/50 font-semibold">
                                <TableCell colSpan={4}>Opening Balance</TableCell>
                                <TableCell className="text-right">₱{openingBalance.toFixed(2)}</TableCell>
                            </TableRow>
                            {displayTransactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">No transactions found for the selected period.</TableCell>
                                </TableRow>
                            ) : (
                                displayTransactions.map(t => {
                                  const details = getTransactionDetails(t);
                                  const transactionDate = 'createdAt' in t ? t.createdAt : t.paymentDate;
                                  return (
                                    <TableRow key={t.id} className={t.type === 'Sale' && t.status === 'VOIDED' ? 'bg-destructive/5' : ''}>
                                        <TableCell>{format(transactionDate, 'MMM d, yyyy')}</TableCell>
                                        <TableCell>
                                            <Badge variant={details.badgeVariant} className={details.badgeClass}>
                                                {details.badgeText}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="max-w-[250px] truncate">{details.description}</TableCell>
                                        <TableCell className={`text-right font-semibold ${details.amountClass}`}>
                                          <div className="flex items-center justify-end gap-1">
                                            {details.icon}
                                            {details.amountText}
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-right font-bold">₱{t.runningBalance.toFixed(2)}</TableCell>
                                    </TableRow>
                                  )
                                })
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}



"use client";

import React, { useState, useMemo } from 'react';
import { format, isToday, isSameDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Calendar as CalendarIcon, DollarSign, Receipt, TrendingUp, Tags, Sunset, Info, CheckCircle, Wallet, Mail, MinusCircle, FileDown, LockOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Sale, EodReport, User, Store, Expense, Payment, ConsignmentIncome } from '@/lib/types';
import { createEodReport, generateEodReportFile, deleteEodReport } from '@/services/eod-service';
import { CakeLoader } from './cake-loader';
import { getStoreInventory } from '@/services/inventory-service';
import { saveAs } from 'file-saver';
import { emailEodReport } from '@/ai/flows/email-eod-report-flow';
import { isEmailOutboundEnabled } from '@/lib/email-feature';
import { Badge } from '@/components/ui/badge';
import { Separator } from './ui/separator';
import { Input } from './ui/input';

interface StatCardProps {
  icon: React.ElementType;
  title: string;
  value: string | number;
  description?: string;
  colorClass?: string;
}

function StatCard({ icon: Icon, title, value, description, colorClass }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn("h-4 w-4 text-muted-foreground", colorClass)} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );
}

interface EndOfDayClientProps {
  date: Date;
  onDateChange: (date?: Date) => void;
  sales: Sale[];
  expenses: Expense[];
  consignmentIncomes: ConsignmentIncome[];
  settlementPayments: Payment[];
  report: EodReport | null;
  loading: boolean;
  user: User | null;
  store: Store;
  onReportGenerated: (report: EodReport) => void;
  onReportDeleted: () => void;
}

export function EndOfDayClient({ date, onDateChange, sales, expenses, consignmentIncomes, settlementPayments, report, loading, user, store, onReportGenerated, onReportDeleted }: EndOfDayClientProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockConfirmation, setUnlockConfirmation] = useState('');

  const summary = useMemo(() => {
    const salesSource = (report ? report.transactions : sales).filter(s => s.status !== 'VOIDED');
    const expensesSource = report ? report.expenses : expenses;
    const incomesSource = report ? report.consignmentIncomes : consignmentIncomes;
    const paymentsSource = report ? report.settlementPayments : settlementPayments;
    
    const totalValuePaidFromSales = salesSource
      .filter(s => s.paymentMethod !== 'On Credit')
      .reduce((sum, s) => sum + s.total, 0);

    const onCreditSettlements = (paymentsSource || []).filter(p => !p.saleId);
    const preOrderSettlements = (paymentsSource || []).filter(p => !!p.saleId);

    const sameDayPreOrderSettlements = preOrderSettlements.filter(p => {
        const correspondingSale = salesSource.find(s => s.id === p.saleId);
        return correspondingSale && isSameDay(new Date(correspondingSale.createdAt), new Date(p.paymentDate));
    }).reduce((sum, p) => sum + p.amount, 0);
    
    const sameDayCashPreOrderSettlements = preOrderSettlements.filter(p => {
        const correspondingSale = salesSource.find(s => s.id === p.saleId);
        return correspondingSale && isSameDay(new Date(correspondingSale.createdAt), new Date(p.paymentDate)) && (!p.notes || !p.notes.toLowerCase().includes('gcash'));
    }).reduce((sum, p) => sum + p.amount, 0);
    
    const sameDayGCashPreOrderSettlements = preOrderSettlements.filter(p => {
        const correspondingSale = salesSource.find(s => s.id === p.saleId);
        return correspondingSale && isSameDay(new Date(correspondingSale.createdAt), new Date(p.paymentDate)) && (p.notes && p.notes.toLowerCase().includes('gcash'));
    }).reduce((sum, p) => sum + p.amount, 0);

    const totalOnCreditSettlements = onCreditSettlements.reduce((sum, p) => sum + p.amount, 0);
    const totalPreOrderSettlements = preOrderSettlements.reduce((sum, p) => sum + p.amount, 0);
    const totalConsignmentIncome = (incomesSource || []).reduce((sum, i) => sum + i.amount, 0);

    const grossSales = totalValuePaidFromSales + totalConsignmentIncome + totalOnCreditSettlements + totalPreOrderSettlements - sameDayPreOrderSettlements;
    const totalDiscounts = salesSource.reduce((sum, sale) => sum + sale.discount + (sale.seniorDiscountDetails?.totalDiscount || 0), 0);
    const netSales = grossSales - totalDiscounts;
    
    const cashFromRegularSales = salesSource
      .filter(s => s.paymentMethod === 'Cash' && !s.onCredit && !s.isPreOrder)
      .reduce((sum, s) => sum + s.total, 0);

    const gcashFromRegularSales = salesSource
      .filter(s => s.paymentMethod === 'GCash' && !s.onCredit && !s.isPreOrder)
      .reduce((sum, s) => sum + s.total, 0);
      
    const gcashFromNewSales = gcashFromRegularSales;

    const cashFromConsignment = (incomesSource || []).reduce((sum, i) => sum + i.amount, 0);

    const cashFromSettlements = onCreditSettlements
        .filter(p => !p.notes || !p.notes.toLowerCase().includes('gcash'))
        .reduce((sum, p) => sum + p.amount, 0);
    
    const gcashFromOnCreditSettlements = onCreditSettlements
        .filter(p => p.notes && p.notes.toLowerCase().includes('gcash'))
        .reduce((sum,p) => sum + p.amount, 0);
    
    const cashFromPreOrderSettlements = preOrderSettlements
        .filter(p => !p.notes || !p.notes.toLowerCase().includes('gcash'))
        .reduce((sum, p) => sum + p.amount, 0) - sameDayCashPreOrderSettlements;

    const gcashFromPreOrderSettlements = preOrderSettlements
        .filter(p => p.notes && p.notes.toLowerCase().includes('gcash'))
        .reduce((sum, p) => sum + p.amount, 0) - sameDayGCashPreOrderSettlements;

    const cashFromPreOrderAdvances = salesSource
      .filter(s => s.isPreOrder && s.paymentMethod === 'Cash')
      .reduce((sum, s) => sum + s.amountPaid, 0);
      
    const gcashFromPreOrderAdvances = salesSource
      .filter(s => s.isPreOrder && s.paymentMethod === 'GCash')
      .reduce((sum, s) => sum + s.amountPaid, 0);
      
    const totalCashCollected = cashFromRegularSales + cashFromConsignment + cashFromSettlements + cashFromPreOrderSettlements + cashFromPreOrderAdvances;
    const totalGCashCollected = gcashFromRegularSales + gcashFromPreOrderAdvances + gcashFromOnCreditSettlements + gcashFromPreOrderSettlements;
    const totalExpenses = (expensesSource || []).reduce((sum, e) => sum + e.amount, 0);
    
    const newCreditSales = salesSource
        .filter(s => s.onCredit)
        .reduce((sum, s) => sum + (s.total - (s.amountPaid || 0)), 0);
    
    const onCreditTransactions = salesSource.filter(sale => sale.paymentMethod === 'On Credit');
    const onCreditGroupedByCustomer = onCreditTransactions.reduce((acc, sale) => {
        const customerName = sale.customerName || 'Walk-in';
        const creditAmount = sale.total - (sale.amountPaid || 0);
        acc[customerName] = (acc[customerName] || 0) + creditAmount;
        return acc;
    }, {} as Record<string, number>);
    
    const preOrderAdvances = salesSource
      .filter(s => s.isPreOrder)
      .reduce((sum, s) => sum + s.amountPaid, 0);

    return { 
        totalSales: grossSales, 
        totalDiscounts, 
        paymentMethods: {
            Cash: totalCashCollected,
            GCash: totalGCashCollected,
            'On Credit': newCreditSales,
            cashFromSales: cashFromRegularSales,
            cashFromPreOrderAdvances: cashFromPreOrderAdvances,
            gcashFromNewSales: gcashFromRegularSales,
            gcashFromPreOrderAdvances: gcashFromPreOrderAdvances,
            onCreditTransactions,
            onCreditGroupedByCustomer,
            cashFromSettlements: cashFromSettlements,
            gcashFromOnCreditSettlements: gcashFromOnCreditSettlements,
            cashFromPreOrderSettlements: cashFromPreOrderSettlements,
            gcashFromPreOrderSettlements: gcashFromPreOrderSettlements,
        }, 
        totalOrders: salesSource.length, 
        netSales, 
        totalExpenses, 
        totalConsignmentIncome,
        totalPreOrderSettlements, 
        totalOnCreditSettlements,
        preOrderAdvances
    };
  }, [sales, expenses, consignmentIncomes, settlementPayments, report]);
  
  const handleGenerateReport = async () => {
    if (!user || !store) return;
    setIsGenerating(true);

    try {
        const inventorySnapshot = await getStoreInventory(store.id);

        const reportData: Omit<EodReport, 'id' | 'generatedAt'> = {
            storeId: store.id,
            date: date,
            totalSales: summary.totalSales,
            totalDiscounts: summary.totalDiscounts,
            netSales: summary.netSales,
            paymentMethods: summary.paymentMethods,
            totalOrders: summary.totalOrders,
            transactions: sales.filter(s => s.status !== 'VOIDED'),
            settlementPayments: settlementPayments,
            expenses: expenses,
            totalExpenses: summary.totalExpenses,
            consignmentIncomes: consignmentIncomes,
            totalConsignmentIncome: summary.totalConsignmentIncome,
            generatedById: user.id,
            generatedByName: user.fullName,
        };
        const newReport = await createEodReport(store.id, reportData);
        
        toast({
            title: "End of Day Report Generated",
            description: `Report for ${format(date, 'PPP')} created. Downloading ODS file...`,
        });
        
        const { fileData, fileName } = await generateEodReportFile({
          report: newReport,
          inventory: inventorySnapshot,
          storeName: store.name,
        });

        saveAs(new Blob([fileData]), fileName);

        onReportGenerated(newReport);
        
    } catch(error) {
        console.error("Failed to generate EOD report:", error);
        toast({
            variant: "destructive",
            title: "Generation Failed",
            description: error instanceof Error ? error.message : "An unknown error occurred.",
        });
    } finally {
        setIsGenerating(false);
    }
  };
  
  const handleEmailReport = async () => {
    if (!report || !store) return;
    setIsEmailing(true);
    try {
      await emailEodReport(store.id, format(report.date, 'yyyy-MM-dd'));
      toast({
        title: "Report Emailed",
        description: `EOD report for ${format(report.date, 'PPP')} has been sent.`,
      });
    } catch (error) {
      console.error("Failed to email report:", error);
      toast({
        variant: "destructive",
        title: "Email Failed",
        description: error instanceof Error ? error.message : "Could not send the email.",
      });
    } finally {
      setIsEmailing(false);
    }
  };
  
  const handleDownloadReport = async () => {
    if (!report || !store) return;
    setIsDownloading(true);
    try {
        const inventorySnapshot = await getStoreInventory(store.id);
        const { fileData, fileName } = await generateEodReportFile({
          report: report,
          inventory: inventorySnapshot,
          storeName: store.name,
        });

        saveAs(new Blob([fileData]), fileName);
        
        toast({
            title: "Report Downloaded",
            description: `The EOD report for ${format(report.date, 'PPP')} has been downloaded.`,
        });

    } catch (error) {
       console.error("Failed to download report:", error);
        toast({
            variant: "destructive",
            title: "Download Failed",
            description: error instanceof Error ? error.message : "Could not download the report file.",
        });
    } finally {
      setIsDownloading(false);
    }
  };
  
  const handleUnlockReport = async () => {
    if (!report?.id) return;
    setIsUnlocking(true);
    try {
        await deleteEodReport(report.id);
        toast({ title: "Day Re-opened", description: `The EOD report for ${format(report.date, 'PPP')} has been deleted.`});
        onReportDeleted();
        setUnlockConfirmation('');
    } catch (error) {
        console.error("Failed to unlock report:", error);
        toast({ variant: 'destructive', title: 'Unlock Failed', description: error instanceof Error ? error.message : 'Could not delete the report.' });
    } finally {
        setIsUnlocking(false);
    }
  }

  const isEodActionable = isToday(date) && !report;
  const canPerformEod = user?.role === 'Supervisor' || user?.role === 'Owner' || user?.role === 'Admin';
  
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-64">
            <CakeLoader />
            <p className="mt-4 text-lg text-muted-foreground">Loading data for {format(date, 'PPP')}...</p>
        </div>
      );
    }
    
    const displaySummary = report 
      ? {
          totalSales: report.totalSales,
          totalDiscounts: report.totalDiscounts,
          netSales: report.netSales,
          totalExpenses: report.totalExpenses,
          totalConsignmentIncome: report.totalConsignmentIncome,
          paymentMethods: report.paymentMethods,
          totalPreOrderSettlements: (report.settlementPayments || []).filter(p => !!p.saleId).reduce((sum, p) => sum + p.amount, 0),
          totalOnCreditSettlements: (report.settlementPayments || []).filter(p => !p.saleId).reduce((sum, p) => sum + p.amount, 0),
          preOrderAdvances: (report.transactions || []).filter(s => s.isPreOrder && s.amountPaid > 0).reduce((sum, s) => sum + s.amountPaid, 0),
        }
      : summary;

    return (
      <>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={DollarSign} title="Gross Sales" value={`₱${displaySummary.totalSales.toFixed(2)}`} description="All sales" />
            <StatCard icon={Tags} title="Total Discounts" value={`- ₱${displaySummary.totalDiscounts.toFixed(2)}`} />
            <StatCard icon={TrendingUp} title="Net Sales" value={`₱${displaySummary.netSales.toFixed(2)}`} description="After discounts" />
            <StatCard icon={Receipt} title="Total Expenses" value={`-₱${displaySummary.totalExpenses.toFixed(2)}`} colorClass="text-red-500" />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle>Transactions</CardTitle>
                    <CardDescription>All sales and payments on {format(date, 'PPP')}.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto h-96">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Items / Notes</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead className="text-right">Amount Paid</TableHead>
                                    <TableHead className="text-right">Total Value</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(report ? [...report.transactions, ...report.settlementPayments, ...report.consignmentIncomes] : [...sales, ...settlementPayments, ...consignmentIncomes]).sort((a,b) => ('createdAt' in a ? a.createdAt : ('paymentDate' in a ? a.paymentDate : a.date)).getTime() - ('createdAt' in b ? b.createdAt : ('paymentDate' in b ? b.paymentDate : b.date)).getTime()).map(tx => {
                                    if ('paymentMethod' in tx) { // It's a Sale
                                        return (
                                            <TableRow key={`sale-${tx.id}`} className={tx.status === 'VOIDED' ? 'text-muted-foreground line-through' : ''}>
                                                <TableCell>{format(new Date(tx.createdAt), 'p')}</TableCell>
                                                <TableCell className="max-w-xs truncate">{tx.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}</TableCell>
                                                <TableCell>
                                                    {tx.isPreOrder && (tx.amountPaid || 0) === 0 ? (
                                                        <Badge className="bg-orange-100 text-orange-800">New Pre-order</Badge>
                                                    ) : tx.isPreOrder ? (
                                                        <Badge className="bg-purple-100 text-purple-800">Pre-order DP</Badge>
                                                    ) : (
                                                        <Badge variant={tx.status === 'VOIDED' ? 'destructive' : 'outline'}>
                                                            {tx.status === 'VOIDED' ? 'VOIDED' : tx.paymentMethod}
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-medium text-green-600">₱{(tx.amountPaid || 0).toFixed(2)}</TableCell>
                                                <TableCell className="text-right font-medium">
                                                   {(tx.isPreOrder && tx.amountPaid === 0) ? `(Balance: ₱${tx.total.toFixed(2)})` : `₱${tx.total.toFixed(2)}`}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    } else if ('paymentDate' in tx) { // It's a Payment
                                      return (
                                        <TableRow key={`payment-${tx.id}`}>
                                            <TableCell>{format(new Date(tx.paymentDate), 'p')}</TableCell>
                                            <TableCell className="max-w-xs truncate italic">{tx.notes || 'Settlement'}</TableCell>
                                            <TableCell><Badge variant="secondary">Payment</Badge></TableCell>
                                            <TableCell className="text-right font-medium text-green-600">₱{tx.amount.toFixed(2)}</TableCell>
                                            <TableCell className="text-right font-medium">₱{tx.amount.toFixed(2)}</TableCell>
                                        </TableRow>
                                      )
                                    } else { // It's a ConsignmentIncome
                                      return (
                                        <TableRow key={`income-${tx.id}`}>
                                            <TableCell>{format(new Date(tx.date), 'p')}</TableCell>
                                            <TableCell className="max-w-xs truncate">{tx.description}</TableCell>
                                            <TableCell><Badge variant="secondary" className="bg-blue-100 text-blue-800">Consignment</Badge></TableCell>
                                            <TableCell className="text-right font-medium text-green-600">₱{tx.amount.toFixed(2)}</TableCell>
                                            <TableCell className="text-right font-medium">₱{tx.amount.toFixed(2)}</TableCell>
                                        </TableRow>
                                      );
                                    }
                                })}
                                {(sales.length + settlementPayments.length) === 0 && !report && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">No transactions recorded for this day.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Payment Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex items-center justify-between gap-4 rounded-md bg-muted p-4 text-lg">
                            <span className="font-medium">Cash</span>
                            <span className="font-bold tabular-nums">
                                ₱{(displaySummary.paymentMethods.cashFromSales || 0).toFixed(2)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 rounded-md bg-muted p-4 text-lg">
                            <span className="font-medium">GCash</span>
                            <span className="font-bold tabular-nums">
                                ₱{(displaySummary.paymentMethods.gcashFromNewSales || 0).toFixed(2)}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                      <CardTitle>Daily Net Sales Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Net Sales</span>
                          <span className="font-semibold">₱{displaySummary.netSales.toFixed(2)}</span>
                      </div>
                       <div className="flex justify-between items-center text-sm text-destructive">
                          <div className="flex items-center gap-1">
                            <MinusCircle className="h-3 w-3"/>
                            <span>Total Expenses</span>
                          </div>
                          <span className="font-semibold">-₱{displaySummary.totalExpenses.toFixed(2)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between items-center font-bold text-lg">
                          <span>Net Sales of the Day</span>
                          <span className="text-primary">₱{(displaySummary.netSales - displaySummary.totalExpenses).toFixed(2)}</span>
                      </div>
                  </CardContent>
              </Card>

            </div>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">End of Day</h1>
          <p className="text-muted-foreground">Review daily sales and close the business day for {store.name}.</p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[280px] justify-start text-left font-normal")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(date, 'PPP')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={date}
              onSelect={onDateChange}
              disabled={(d) => d > new Date() || d < new Date("2024-01-01")}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      
      {report ? (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                    <div>
                        <CardTitle>This day has been closed.</CardTitle>
                        <CardDescription>This report was generated by {report.generatedByName} on {format(new Date(report.generatedAt), 'PPP p')}.</CardDescription>
                    </div>
                </div>
                 <div className="flex gap-2">
                    <Button onClick={handleDownloadReport} disabled={isDownloading} variant="outline">
                        <FileDown className="mr-2 h-4 w-4" />
                        {isDownloading ? "Downloading..." : "Download"}
                    </Button>
                    {isEmailOutboundEnabled() && (
                    <Button onClick={handleEmailReport} disabled={isEmailing} variant="outline">
                        <Mail className="mr-2 h-4 w-4" />
                        {isEmailing ? "Sending..." : "Email"}
                    </Button>
                    )}
                     {canPerformEod && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isUnlocking}>
                                    <LockOpen className="mr-2 h-4 w-4" />
                                    Re-open Day
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure you want to re-open this day?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action will delete the finalized End of Day report. You will be able to make changes and generate a new report. This action is irreversible.
                                        <br/><br/>
                                        Type <strong className="text-foreground">unlock</strong> to confirm.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <Input 
                                    value={unlockConfirmation} 
                                    onChange={(e) => setUnlockConfirmation(e.target.value)}
                                    autoComplete="off"
                                />
                                <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setUnlockConfirmation('')}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleUnlockReport} disabled={unlockConfirmation.toLowerCase() !== 'unlock' || isUnlocking}>
                                        {isUnlocking ? 'Unlocking...' : 'Unlock'}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                 </div>
            </CardHeader>
        </Card>
      ) : isToday(date) ? (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
            <Info className="h-5 w-5" />
            <p className="font-semibold">This is a live view of today's sales. The final report has not been generated yet.</p>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 text-yellow-800 border border-yellow-200">
            <Info className="h-5 w-5" />
            <p className="font-semibold">Viewing past sales data. A final report for this day was not generated.</p>
        </div>
      )}

      {renderContent()}

      {isEodActionable && (
         <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>Close Business Day</CardTitle>
                    <CardDescription>Generate the final report for today. This action cannot be undone.</CardDescription>
                </div>
                
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button size="lg" disabled={!canPerformEod || isGenerating}>
                            <Sunset className="mr-2 h-5 w-5"/>
                            {isGenerating ? "Generating..." : "Close Day & Generate Report"}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            You are about to close the business day for {format(date, 'PPP')}. Once a day is closed, its report is finalized and cannot be changed. No further sales will be recorded for this date.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleGenerateReport}>Yes, Close the Day</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

            </CardHeader>
            {!canPerformEod && (
                <CardContent>
                    <p className="text-sm text-destructive">You do not have permission to perform the End of Day action. Please contact a supervisor or owner.</p>
                </CardContent>
            )}
         </Card>
      )}

    </div>
  );
}



"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { format, startOfDay, endOfDay, isWithinInterval, startOfMonth, endOfMonth, subMonths, subDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Sale, Payment } from '@/lib/types';
import { Button } from './ui/button';
import { History, Eye, Ban, Calendar as CalendarIcon, HandCoins, UtensilsCrossed, ShoppingBag, Printer } from 'lucide-react';
import { TransactionItemsDialog } from './transaction-items-dialog';
import { useAuth } from '@/context/auth-context';
import { SupervisorPinDialog } from './supervisor-pin-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { voidSale } from '@/services/sales-service';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover';
import { Calendar } from './ui/calendar';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { Separator } from './ui/separator';
import { tableChipDisplayText } from '@/lib/table-display';
import { saleServiceLabel } from '@/lib/order-service-label';
import { AssignTableDialog } from '@/components/assign-table-dialog';
import { updateSaleTableAssignment } from '@/services/sales-service';
import { POS_FEATURE_TABLES } from '@/lib/pos-features';
import { getStorePrinterSettings } from '@/services/printer-settings-service';
import { printKitchenCopy } from '@/lib/printers/print-sale';

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

type CombinedTransaction = (Sale & { type: 'Sale' }) | (Payment & { type: 'Payment' });

function SaleServiceCell({ sale }: { sale: Sale }) {
  const label = saleServiceLabel(sale);
  if (label === 'takeout') {
    return (
      <Badge variant="secondary" className="font-normal">
        Takeout
      </Badge>
    );
  }
  const tbl = sale.tableLabel?.trim();
  return (
    <div className="flex flex-col items-start gap-0.5">
      <Badge className="w-fit border-amber-200 bg-amber-100 font-normal text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
        <UtensilsCrossed className="mr-1 h-3 w-3" />
        Dine-in
      </Badge>
      {tbl ? (
        <span className="max-w-[140px] truncate text-xs text-muted-foreground">{tableChipDisplayText(tbl)}</span>
      ) : null}
    </div>
  );
}

export function OrderHistoryClient({
  initialSales,
  initialPayments,
  variant = 'standalone',
  dateRange: dateRangeProp,
  onDateRangeChange,
  onSalesChange,
}: {
  initialSales: Sale[];
  initialPayments: Payment[];
  /** `embedded`: compact header for POS Orders (parent page supplies title). */
  variant?: 'standalone' | 'embedded';
  /** Controlled calendar range (POS Orders page). */
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange | undefined) => void;
  /** Mirror of internal sales state for parent. */
  onSalesChange?: (sales: Sale[]) => void;
}) {
  const [sales, setSales] = useState<Sale[]>(initialSales);
  const [payments, setPayments] = useState<Payment[]>(initialPayments);
  const [fallbackDate, setFallbackDate] = useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });
  const isDateControlled = dateRangeProp !== undefined && onDateRangeChange !== undefined;
  const date = isDateControlled ? dateRangeProp : fallbackDate;
  const setDate = isDateControlled ? onDateRangeChange! : setFallbackDate;
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleToVoid, setSaleToVoid] = useState<Sale | null>(null);
  const [saleAssignTarget, setSaleAssignTarget] = useState<Sale | null>(null);
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [isConfirmVoidOpen, setIsConfirmVoidOpen] = useState(false);
  const [printingKitchenSaleId, setPrintingKitchenSaleId] = useState<string | null>(null);
  const { user, currentStore } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    onSalesChange?.(sales);
  }, [sales, onSalesChange]);

  const transactions = useMemo(() => {
    const combined: CombinedTransaction[] = [
      ...sales.map(s => ({ ...s, type: 'Sale' as const })),
      ...payments.map(p => ({ ...p, type: 'Payment' as const })),
    ];

    const inRange = (() => {
      const sorted = [...combined].sort((a, b) => {
        const dateA = a.type === "Sale" ? a.createdAt : a.paymentDate;
        const dateB = b.type === "Sale" ? b.createdAt : b.paymentDate;
        return dateB.getTime() - dateA.getTime();
      });

      if (!date?.from) return sorted;

      const from = startOfDay(date.from);
      const to = date.to ? endOfDay(date.to) : endOfDay(date.from);

      return sorted.filter((t) => {
        const tDate = t.type === "Sale" ? t.createdAt : t.paymentDate;
        return isWithinInterval(new Date(tDate), { start: from, end: to });
      });
    })();

    if (variant === "embedded") {
      return [...inRange].sort((a, b) => {
        const dateA = a.type === "Sale" ? a.createdAt : a.paymentDate;
        const dateB = b.type === "Sale" ? b.createdAt : b.paymentDate;
        return dateA.getTime() - dateB.getTime();
      });
    }

    return inRange;
  }, [sales, payments, date, variant]);
  
  const completedSales = useMemo(
    () => transactions.filter((t): t is Sale & { type: 'Sale' } => t.type === 'Sale' && t.status !== 'VOIDED'),
    [transactions],
  );
  const totalOrders = completedSales.length;
  const dineInOrders = useMemo(
    () => completedSales.filter((s) => saleServiceLabel(s) === 'dine-in').length,
    [completedSales],
  );
  const takeoutOrders = useMemo(
    () => completedSales.filter((s) => saleServiceLabel(s) === 'takeout').length,
    [completedSales],
  );

  const handleVoidClick = (sale: Sale) => {
    setSaleToVoid(sale);
    const isAdminOrOwner = user?.role === 'Admin' || user?.role === 'Owner';
    if (isAdminOrOwner) {
      setIsConfirmVoidOpen(true);
    } else {
      setIsPinDialogOpen(true);
    }
  };

  const onPinVerified = () => {
    setIsPinDialogOpen(false);
    setIsConfirmVoidOpen(true);
  };

  const executeVoid = async () => {
    if (!saleToVoid || !user) return;
    try {
      await voidSale(saleToVoid.id, user.id);
      setSales(prev => prev.map(s => s.id === saleToVoid.id ? { ...s, status: 'VOIDED' } : s));
      toast({
        title: "Sale Voided",
        description: "The transaction has been successfully voided and inventory has been restored.",
      });
    } catch (error) {
       toast({
        variant: "destructive",
        title: "Void Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setIsConfirmVoidOpen(false);
      setSaleToVoid(null);
    }
  }

  const handleKitchenReprint = async (sale: Sale) => {
    if (!currentStore || sale.status === 'VOIDED') return;
    setPrintingKitchenSaleId(sale.id);
    try {
      const printerSettings = await getStorePrinterSettings(currentStore.id);
      await printKitchenCopy(sale, printerSettings);
      toast({
        title: 'Kitchen ticket sent',
        description: 'Sent to the kitchen printer.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Kitchen print failed',
        description: error instanceof Error ? error.message : 'Check printer settings.',
      });
    } finally {
      setPrintingKitchenSaleId(null);
    }
  };

  const renderEmbeddedRow = (transaction: CombinedTransaction) => {
    if (transaction.type === 'Payment') {
      return (
        <TableRow key={`payment-${transaction.id}`}>
          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
            {format(new Date(transaction.paymentDate), 'MMM d, h:mm a')}
          </TableCell>
          <TableCell>
            <span className="font-semibold tabular-nums">₱{transaction.amount.toFixed(2)}</span>
            <span className="mt-0.5 block max-w-[220px] truncate text-xs text-muted-foreground">
              {transaction.notes || 'Payment'}
            </span>
          </TableCell>
          <TableCell>
            <Badge className="bg-green-100 text-green-800">
              <HandCoins className="mr-1 h-3 w-3" /> Payment
            </Badge>
          </TableCell>
          <TableCell className="text-right" />
        </TableRow>
      );
    }

    const sale = transaction;
    return (
      <TableRow
        key={sale.id}
        className={`cursor-pointer hover:bg-muted/50 ${sale.status === 'VOIDED' ? 'bg-destructive/10' : ''}`}
        onClick={() => setSelectedSale(sale)}
      >
        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
          {format(new Date(sale.createdAt), 'MMM d, h:mm a')}
        </TableCell>
        <TableCell>
          <span
            className={`font-semibold tabular-nums ${sale.status === 'VOIDED' ? 'text-muted-foreground line-through' : 'text-primary'}`}
          >
            ₱{sale.total.toFixed(2)}
          </span>
          <span className="mt-0.5 block max-w-[220px] truncate text-xs text-muted-foreground">
            {sale.items.map((i) => `${i.name} (×${i.quantity})`).join(', ')}
          </span>
        </TableCell>
        <TableCell className="align-top">
          <SaleServiceCell sale={sale} />
        </TableCell>
        <TableCell className="text-right align-top">
          <div className="flex flex-wrap justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {POS_FEATURE_TABLES ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={sale.status === 'VOIDED'}
                onClick={() => setSaleAssignTarget(sale)}
              >
                Table
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1"
              disabled={sale.status === 'VOIDED' || printingKitchenSaleId === sale.id}
              onClick={() => void handleKitchenReprint(sale)}
            >
              <Printer className="h-3.5 w-3.5" />
              {printingKitchenSaleId === sale.id ? 'Printing…' : 'Kitchen'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={sale.status === 'VOIDED'}
              onClick={() => handleVoidClick(sale)}
            >
              Cancel
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const renderTransactionRow = (transaction: CombinedTransaction) => {
    if (transaction.type === 'Payment') {
      return (
        <TableRow key={`payment-${transaction.id}`}>
          <TableCell className="font-medium text-muted-foreground whitespace-nowrap">
            {format(new Date(transaction.paymentDate), "MMM d, yyyy, h:mm a")}
          </TableCell>
          <TableCell className="text-muted-foreground">—</TableCell>
          <TableCell>Payment</TableCell>
          <TableCell className="max-w-xs truncate">{transaction.notes || 'Settlement'}</TableCell>
          <TableCell><Badge className="bg-green-100 text-green-800"><HandCoins className="mr-1 h-3 w-3"/> Payment</Badge></TableCell>
          <TableCell className="text-right font-bold">₱{transaction.amount.toFixed(2)}</TableCell>
          <TableCell className="text-right"></TableCell>
        </TableRow>
      )
    }

    const sale = transaction;
    return (
        <TableRow key={sale.id} className={sale.status === 'VOIDED' ? 'bg-destructive/10' : ''}>
            <TableCell className="font-medium text-muted-foreground whitespace-nowrap">
                {format(new Date(sale.createdAt), "MMM d, yyyy, h:mm a")}
            </TableCell>
            <TableCell>{sale.customerName || 'N/A'}</TableCell>
            <TableCell className="align-top">
              <SaleServiceCell sale={sale} />
            </TableCell>
            <TableCell className="max-w-xs">
                <div className="flex items-center gap-2">
                    <span className="truncate">{sale.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}</span>
                </div>
            </TableCell>
            <TableCell>
                {sale.isPreOrder ? (
                  <Badge className="bg-purple-100 text-purple-800">Pre-order</Badge>
                ) : (
                  <Badge variant={sale.status === 'VOIDED' ? 'destructive' : 'outline'}>{sale.status === 'VOIDED' ? 'VOIDED' : sale.paymentMethod}</Badge>
                )}
            </TableCell>
            <TableCell className={`text-right font-bold ${sale.status === 'VOIDED' ? 'line-through text-muted-foreground' : ''}`}>₱{sale.total.toFixed(2)}</TableCell>
            <TableCell className="text-right">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedSale(sale)}>
                    <Eye className="h-4 w-4" />
                </Button>
                {sale.status !== 'VOIDED' && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleVoidClick(sale)}>
                      <Ban className="h-4 w-4" />
                  </Button>
                )}
            </TableCell>
        </TableRow>
    );
  }

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 justify-between items-center">
        {variant === 'standalone' ? (
          <div>
            <h1 className="text-3xl font-bold">Order History</h1>
            <p className="text-muted-foreground">
              All sales and payments — dine-in (table) and takeout — for the range below.
            </p>
          </div>
        ) : (
          <div className="min-w-0 flex-1" />
        )}
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                        "w-[300px] justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date?.from ? (
                        date.to ? (
                            <>
                                {format(date.from, "LLL dd, y")} -{" "}
                                {format(date.to, "LLL dd, y")}
                            </>
                        ) : (
                            format(date.from, "LLL dd, y")
                        )
                    ) : (
                        <span>Pick a date range</span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 flex" align="end">
                <div className="flex flex-col space-y-2 p-2 border-r">
                    <Button variant="ghost" className="justify-start" onClick={() => setDate({ from: new Date(), to: new Date() })}>Today</Button>
                    <Button variant="ghost" className="justify-start" onClick={() => { const yesterday = subDays(new Date(), 1); setDate({ from: yesterday, to: yesterday }); }}>Yesterday</Button>
                    <Button variant="ghost" className="justify-start" onClick={() => setDate({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })}>This Month</Button>
                    <Button variant="ghost" className="justify-start" onClick={() => setDate({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) })}>Last Month</Button>
                    <Button variant="ghost" className="justify-start" onClick={() => setDate({ from: subDays(new Date(), 90), to: new Date() })}>Last 90 Days</Button>
                </div>
                 <Separator orientation="vertical" />
                <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={setDate}
                    numberOfMonths={2}
                />
            </PopoverContent>
        </Popover>
      </div>

      {variant === 'standalone' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard icon={History} title="Total orders" value={totalOrders} color="text-blue-500" />
          <StatCard icon={UtensilsCrossed} title="Dine-in" value={dineInOrders} color="text-amber-600" />
          <StatCard icon={ShoppingBag} title="Takeout" value={takeoutOrders} color="text-muted-foreground" />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{variant === 'embedded' ? 'Paid' : 'Transactions'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            {variant === 'embedded' ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Time</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead className="w-[110px]">Type</TableHead>
                    <TableHead className="w-[260px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length > 0 ? (
                    transactions.map((t) => renderEmbeddedRow(t))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        Nothing in this range.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length > 0 ? (
                    transactions.map(renderTransactionRow)
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        No transactions found for the selected period.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>

    {selectedSale && (
        <TransactionItemsDialog
            sale={selectedSale}
            isOpen={!!selectedSale}
            onClose={() => setSelectedSale(null)}
        />
    )}

    <SupervisorPinDialog
        open={isPinDialogOpen}
        onOpenChange={setIsPinDialogOpen}
        onVerified={onPinVerified}
    />
    
    <AlertDialog open={isConfirmVoidOpen} onOpenChange={setIsConfirmVoidOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will void the transaction. Inventory will be restored, and any customer credit applied will be reversed. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setSaleToVoid(null)}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={executeVoid} className="bg-destructive hover:bg-destructive/90">Void Transaction</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {currentStore && POS_FEATURE_TABLES ? (
      <AssignTableDialog
        open={!!saleAssignTarget}
        onOpenChange={(open) => !open && setSaleAssignTarget(null)}
        storeId={currentStore.id}
        onAssigned={async (choice) => {
          if (!saleAssignTarget) return;
          try {
            await updateSaleTableAssignment(saleAssignTarget.id, {
              tableId: choice.table?.id ?? null,
              tableLabel: choice.table?.label ?? null,
              serviceType: choice.serviceType,
            });
            setSales((prev) =>
              prev.map((s) =>
                s.id === saleAssignTarget.id
                  ? {
                      ...s,
                      tableId: choice.table?.id ?? null,
                      tableLabel: choice.table?.label ?? null,
                      serviceType: choice.serviceType,
                    }
                  : s,
              ),
            );
            toast({ title: 'Table updated' });
          } catch (error) {
            toast({
              variant: 'destructive',
              title: 'Could not update',
              description: error instanceof Error ? error.message : 'Try again.',
            });
          } finally {
            setSaleAssignTarget(null);
          }
        }}
      />
    ) : null}

    </>
  );
}


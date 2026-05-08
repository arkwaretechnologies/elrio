

"use client";

import { useState } from 'react';
import { format, isSameDay } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar as CalendarComponent } from './ui/calendar';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Sale } from '@/lib/types';
import { User, Phone, Cake, DollarSign, Notebook, CheckCircle, Calendar, Edit, Save, Eye } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { settlePreOrderPayment, reschedulePreOrder, updatePreOrderNote } from '@/services/sales-service';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { TransactionItemsDialog } from './transaction-items-dialog';


interface PreOrderDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  orders: Sale[];
  onOrderUpdated: (updatedOrder: Sale) => void;
}

export function PreOrderDetailsDialog({ isOpen, onClose, date, orders, onOrderUpdated }: PreOrderDetailsDialogProps) {
  const [selectedOrderForSettle, setSelectedOrderForSettle] = useState<Sale | null>(null);
  const [settlementAmount, setSettlementAmount] = useState(0);
  const [selectedOrderForReschedule, setSelectedOrderForReschedule] = useState<Sale | null>(null);
  const [editingNote, setEditingNote] = useState<{ orderId: string, text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewingSale, setViewingSale] = useState<Sale | null>(null);
  const { toast } = useToast();

  const handleSettlePayment = async () => {
    if (!selectedOrderForSettle) return;
    setIsProcessing(true);
    try {
      await settlePreOrderPayment(selectedOrderForSettle, settlementAmount);
      toast({
        title: "Payment Settled",
        description: `₱${settlementAmount.toFixed(2)} recorded for ${selectedOrderForSettle.customerName}'s order.`,
      });
      // We need to refresh the order from the parent to get the new `amountPaid` and `isPaidInFull` status
      onOrderUpdated({ ...selectedOrderForSettle, isPaidInFull: true, amountPaid: selectedOrderForSettle.total });
      setSelectedOrderForSettle(null);
    } catch (error) {
      console.error("Failed to settle payment:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not settle payment for the order.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReschedule = async (newDate: Date | undefined) => {
    if (!selectedOrderForReschedule || !newDate) return;
    
    const pickupDate = selectedOrderForReschedule.pickupDate || selectedOrderForReschedule.timestamp;
    if (isSameDay(new Date(pickupDate), newDate)) {
      setSelectedOrderForReschedule(null);
      return;
    }

    setIsProcessing(true);
    try {
      await reschedulePreOrder(selectedOrderForReschedule.id, newDate);
      toast({
        title: "Order Rescheduled",
        description: `Order for ${selectedOrderForReschedule.customerName} has been moved to ${format(newDate, 'PPP')}.`,
      });
      onOrderUpdated({ ...selectedOrderForReschedule, pickupDate: newDate });
      setSelectedOrderForReschedule(null);
    } catch (error) {
      console.error("Failed to reschedule order:", error);
       toast({
        variant: "destructive",
        title: "Error",
        description: "Could not reschedule the order.",
      });
    } finally {
        setIsProcessing(false);
    }
  };
  
  const handleSaveNote = async () => {
    if (!editingNote) return;
    setIsProcessing(true);
    try {
        await updatePreOrderNote(editingNote.orderId, editingNote.text);
        toast({ title: 'Note Updated', description: "The pre-order note has been saved."});
        const updatedOrder = orders.find(o => o.id === editingNote.orderId);
        if (updatedOrder) {
            onOrderUpdated({ ...updatedOrder, specialInstructions: editingNote.text });
        }
        setEditingNote(null);
    } catch (error) {
        console.error("Failed to save note:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not save the note.' });
    } finally {
        setIsProcessing(false);
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Pick-ups for {format(date, 'MMMM d, yyyy')}</DialogTitle>
            <DialogDescription>
              {orders.length} pre-order(s) scheduled for this day.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-grow overflow-hidden">
            <ScrollArea className="h-full pr-6">
                <div className="space-y-6">
                {orders.length > 0 ? (
                    orders.map(order => {
                        const balance = order.total - (order.amountPaid || 0);
                        const isPaid = order.isPaidInFull || balance <= 0;
                        const totalQuantity = order.items.reduce((acc, item) => acc + item.quantity, 0);

                        return (
                        <div key={order.id} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start mb-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 flex-grow">
                                    <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Customer</p>
                                            <p className="font-semibold">{order.customerName || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Phone</p>
                                            <p className="font-semibold">{order.phoneNumber || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Cake className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Items</p>
                                            <p className="font-semibold">{totalQuantity}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Total</p>
                                            <p className="font-semibold text-primary">₱{order.total.toFixed(2)}</p>
                                        </div>
                                    </div>
                                    <div className="sm:col-span-2 flex items-start gap-2 text-sm text-muted-foreground">
                                        <Notebook className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                        <div className="flex-grow">
                                            {editingNote?.orderId === order.id ? (
                                                <div className="space-y-2">
                                                    <Textarea
                                                        value={editingNote.text}
                                                        onChange={(e) => setEditingNote({...editingNote, text: e.target.value})}
                                                        className="text-sm bg-background"
                                                    />
                                                    <div className="flex gap-2">
                                                        <Button size="xs" onClick={handleSaveNote} disabled={isProcessing}><Save className="h-3 w-3 mr-1" /> Save</Button>
                                                        <Button size="xs" variant="ghost" onClick={() => setEditingNote(null)}>Cancel</Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="italic flex-1">"{order.specialInstructions || 'No special instructions.'}"</p>
                                            )}
                                        </div>
                                        {editingNote?.orderId !== order.id && (
                                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setEditingNote({ orderId: order.id, text: order.specialInstructions || '' })}>
                                                <Edit className="h-3 w-3" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2 shrink-0 ml-4">
                                    {isPaid ? (
                                        <Badge className="bg-green-100 text-green-800"><CheckCircle className="mr-1 h-3 w-3"/> Paid in Full</Badge>
                                    ) : (
                                        <>
                                            <Badge variant="destructive">Balance: ₱{balance.toFixed(2)}</Badge>
                                            <Button size="sm" onClick={() => { setSelectedOrderForSettle(order); setSettlementAmount(balance); }}>Settle Payment</Button>
                                        </>
                                    )}
                                     <Popover open={selectedOrderForReschedule?.id === order.id} onOpenChange={(isOpen) => setSelectedOrderForReschedule(isOpen ? order : null)}>
                                        <PopoverTrigger asChild>
                                             <Button variant="outline" size="sm">
                                                <Calendar className="mr-2 h-4 w-4" /> Reschedule
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <CalendarComponent
                                                mode="single"
                                                selected={order.pickupDate ? new Date(order.pickupDate) : undefined}
                                                onSelect={handleReschedule}
                                                disabled={(day) => day < new Date() || isProcessing}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Item</TableHead>
                                        <TableHead className="text-center">Quantity</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {order.items.map((item, index) => (
                                        <TableRow key={`${item.id}-${index}`}>
                                            <TableCell className="flex items-center gap-2">
                                                <span>{item.name}</span>
                                                {item.isPreOrder && (
                                                    <Badge className="bg-purple-100 text-purple-800">Pre-order</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">{item.quantity}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => setViewingSale(order)}>
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        )
                    })
                ) : (
                    <div className="text-center text-muted-foreground py-16">
                        <p>No pre-orders scheduled for this day.</p>
                    </div>
                )}
                </div>
            </ScrollArea>
           </div>
        </DialogContent>
      </Dialog>
      
       <AlertDialog open={!!selectedOrderForSettle} onOpenChange={(open) => !open && setSelectedOrderForSettle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Settle Remaining Balance</AlertDialogTitle>
            <AlertDialogDescription>
              Record a payment for <strong>{selectedOrderForSettle?.customerName}</strong>. The current balance is <strong>₱{(selectedOrderForSettle ? selectedOrderForSettle.total - (selectedOrderForSettle.amountPaid || 0) : 0).toFixed(2)}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="settlement-amount">Payment Amount</Label>
            <Input
                id="settlement-amount"
                type="number"
                value={settlementAmount}
                onChange={(e) => setSettlementAmount(parseFloat(e.target.value) || 0)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedOrderForSettle(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSettlePayment} disabled={isProcessing || settlementAmount <= 0}>
              {isProcessing ? 'Processing...' : 'Confirm Payment'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {viewingSale && (
        <TransactionItemsDialog
          sale={viewingSale}
          isOpen={!!viewingSale}
          onClose={() => setViewingSale(null)}
        />
      )}
    </>
  );
}

    

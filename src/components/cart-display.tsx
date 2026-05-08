
"use client";

import { useState, lazy, Suspense } from "react";
import { useCart } from "@/context/cart-context";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Minus, Trash2, TicketPercent, ShoppingCart, Star, Armchair, ArrowRightLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createOpenOrder } from "@/services/open-order-service";
import type { FloorPlanTable, InventoryConsumption, SelectedConfigurationItem, UnitOfMeasurement } from "@/lib/types";
import { tableChipDisplayText } from "@/lib/table-display";
import { useAuth } from '@/context/auth-context';
import { SupervisorPinDialog } from "./supervisor-pin-dialog";
import { SeniorDiscountDialog } from "./senior-discount-dialog";
import { CakeLoader } from "./cake-loader";

const CheckoutDialog = lazy(() => import('./checkout-dialog').then((mod) => ({ default: mod.CheckoutDialog })));
const PaymentSuccessDialog = lazy(() => import('./payment-success-dialog').then(mod => ({ default: mod.PaymentSuccessDialog })));

interface TransactionDetails {
  total: number;
  amountPaid: number;
  change: number;
  paymentMethod: 'Cash' | 'GCash' | 'On Credit';
}

export function CartDisplay({
  selectedTable = null,
  onSelectedTableChange = () => {},
  tableTransferChoices,
}: {
  selectedTable?: FloorPlanTable | null;
  onSelectedTableChange?: (table: FloorPlanTable | null) => void;
  /** When set (e.g. Tables page), offer moving the current cart to another table without clearing lines. */
  tableTransferChoices?: FloorPlanTable[];
} = {}) {
  const {
    cartItems,
    updateQuantity,
    removeFromCart,
    clearCart,
    manualDiscount,
    subtotal,
    discount,
    total,
    setDiscount,
    seniorDiscountDetails,
    clearSeniorDiscount,
  } = useCart();
  const { user, currentStore, inventory, reloadUser } = useAuth();
  const { toast } = useToast();
  const [discountInput, setDiscountInput] = useState(discount > 0 ? discount.toString() : '');
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false);
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [isSeniorPinDialogOpen, setIsSeniorPinDialogOpen] = useState(false);
  const [isSeniorDialogOpen, setIsSeniorDialogOpen] = useState(false);
  const [isCharging, setIsCharging] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [transactionDetails, setTransactionDetails] = useState<TransactionDetails | null>(null);
  const [payLaterOpen, setPayLaterOpen] = useState(false);
  const [payLaterNote, setPayLaterNote] = useState("");
  const [savingHeldOrder, setSavingHeldOrder] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const transferTargets =
    selectedTable && tableTransferChoices?.length
      ? tableTransferChoices.filter((t) => t.id !== selectedTable.id)
      : [];


  const handleCharge = async () => {
    if (cartItems.length === 0 || isCharging || !currentStore) {
      if (cartItems.length === 0) {
        toast({
          variant: "destructive",
          title: "Cart is empty",
          description: "Please add items to the cart before charging.",
        });
      }
      return Promise.resolve();
    }

    setIsCharging(true);
    
    try {
      // Stock deduction is now handled within the recordSale transaction
      // This ensures atomicity.
      return Promise.resolve();
    } catch (error) {
        console.error("Failed to update stock:", error);
        if (error instanceof Error && (error as any).code === 'unavailable') {
            toast({
                title: "Offline Mode",
                description: "Order saved locally. It will sync automatically when you're back online.",
            });
            return Promise.resolve();
        }

        let errorMessage = 'Could not update inventory stock.';
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        toast({
            variant: "destructive",
            title: "Order Failed",
            description: errorMessage,
        });
        return Promise.reject(error);
    } finally {
      setIsCharging(false);
    }
  };

  const handleApplyDiscount = () => {
    const amount = parseFloat(discountInput);
    if (!isNaN(amount) && amount >= 0) {
      if (amount > subtotal) {
        toast({
          variant: "destructive",
          title: "Invalid Discount",
          description: "Discount cannot be greater than the subtotal.",
        });
        return;
      }
      setDiscount(amount);
      if (seniorDiscountDetails.totalDiscount > 0) {
          clearSeniorDiscount();
          toast({ title: "Senior discount removed", description: "Manual discount has been applied instead."})
      }
      toast({
        title: "Discount Applied",
        description: `A discount of ₱${amount.toFixed(2)} has been applied.`,
      });
      setIsDiscountDialogOpen(false);
    } else {
       toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: "Please enter a valid positive number for the discount.",
      });
    }
  };
  
  const handleDiscountClick = () => {
    const isAdminOrOwner = user?.role === 'Admin' || user?.role === 'Owner';
    if (isAdminOrOwner) {
      setIsDiscountDialogOpen(true);
    } else {
      setIsPinDialogOpen(true);
    }
  };

  const onPinVerified = () => {
    setIsPinDialogOpen(false);
    setIsDiscountDialogOpen(true);
  };
  
  const handleSeniorDiscountClick = () => {
    const isAdminOrOwner = user?.role === 'Admin' || user?.role === 'Owner';
    if (isAdminOrOwner) {
        setIsSeniorDialogOpen(true);
    } else {
        setIsSeniorPinDialogOpen(true);
    }
  }

  const onSeniorPinVerified = () => {
    setIsSeniorPinDialogOpen(false);
    setIsSeniorDialogOpen(true);
  }
  
  const handleTransactionComplete = (details: TransactionDetails) => {
    setIsCheckoutOpen(false);
    setTransactionDetails(details);
    setShowSuccessDialog(true);
  };
  
  const handleSuccessDialogClose = () => {
    // If the transaction was on credit, refresh user data to show updated balance.
    if (transactionDetails?.paymentMethod === 'On Credit') {
      reloadUser();
    }
    setShowSuccessDialog(false);
    setTransactionDetails(null);
    clearCart();
    setDiscountInput('');
    onSelectedTableChange(null);
  }

  return (
    <>
    <div className="flex flex-col h-full min-h-0">
      <CardHeader className="space-y-2 border-b border-border/60 pb-4 shrink-0 bg-card/50">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-2xl font-headline tracking-tight">Current order</CardTitle>
            <p className="text-sm text-muted-foreground">Review quantities and pay when ready</p>
          </div>
          {selectedTable ? (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-sm">
              <Armchair className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span className="font-medium text-foreground">{tableChipDisplayText(selectedTable.label)}</span>
              {transferTargets.length > 0 ? (
                <Popover open={transferOpen} onOpenChange={setTransferOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      title="Keep cart, assign to another table"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                      Transfer
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="end">
                    <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">
                      Move this order to another table (cart stays the same)
                    </p>
                    <div className="flex max-h-52 flex-col gap-0.5 overflow-y-auto">
                      {transferTargets.map((t) => (
                        <Button
                          key={t.id}
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 justify-start font-normal"
                          onClick={() => {
                            onSelectedTableChange(t);
                            setTransferOpen(false);
                            toast({
                              title: "Table updated",
                              description: `Order is now on ${tableChipDisplayText(t.label)}.`,
                            });
                          }}
                        >
                          {tableChipDisplayText(t.label)}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={() => onSelectedTableChange(null)}
              >
                Clear
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Takeout — optional table in Tables tab</p>
          )}
        </div>
      </CardHeader>
      
      <ScrollArea className="flex-grow">
        <CardContent>
          {cartItems.length === 0 ? (
            <div className="text-center text-muted-foreground py-16 px-4">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <ShoppingCart className="h-7 w-7" />
              </div>
              <p className="font-medium text-foreground/80">Your cart is empty</p>
              <p className="text-sm mt-1 max-w-[240px] mx-auto">Tap products on the left to add them here.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {cartItems.map((item) => {
                const lineTotal = item.price * item.quantity;
                return (
                  <div key={item.id} className="flex flex-col gap-1 py-3 first:pt-0">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 text-sm leading-snug">
                        <span className="font-medium text-foreground">{item.name}</span>
                        <span className="text-muted-foreground"> × {item.quantity}</span>
                      </p>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          disabled={isCharging}
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={isCharging}
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive/70 hover:text-destructive"
                          onClick={() => removeFromCart(item.id)}
                          disabled={isCharging}
                          aria-label="Remove line"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                        ₱{lineTotal.toFixed(2)}
                      </span>
                    </div>
                    {item.selectedConfiguration && item.selectedConfiguration.length > 0 && (
                      <ul className="list-disc pl-4 text-xs text-muted-foreground">
                        {item.selectedConfiguration.map((config) => (
                          <li key={config.menuItemId}>{config.name} (×{config.quantity})</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </ScrollArea>

      {cartItems.length > 0 && (
          <CardFooter className="flex-col !items-stretch p-4 sm:p-6 space-y-4 mt-auto border-t border-border/60 bg-card/90 backdrop-blur-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>₱{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                    <span>Discount</span>
                    <span>-₱{discount.toFixed(2)}</span>
                </div>
                {seniorDiscountDetails.totalDiscount > 0 && (
                     <div className="text-xs text-muted-foreground space-y-1 pl-2 border-l-2 ml-1">
                        <div className="flex justify-between">
                            <span>Senior Discountable Amount:</span>
                            <span>₱{seniorDiscountDetails.vatExemptSales.toFixed(2)}</span>
                        </div>
                         <div className="flex justify-between">
                            <span>(20% of Discountable):</span>
                            <span>-₱{seniorDiscountDetails.totalDiscount.toFixed(2)}</span>
                        </div>
                    </div>
                )}
              </div>
              <Separator />
              <div className="flex justify-between items-baseline rounded-lg bg-primary/10 px-3 py-2.5 text-lg font-bold text-foreground">
                  <span>Total</span>
                  <span className="tabular-nums text-primary">₱{total.toFixed(2)}</span>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="w-full" disabled={isCharging} onClick={handleDiscountClick}>
                        <TicketPercent className="mr-2 h-4 w-4" />
                        {discount > 0 ? "Edit" : "Discount"}
                    </Button>
                    <Button variant="outline" className="w-full" disabled={isCharging} onClick={handleSeniorDiscountClick}>
                        <Star className="mr-2 h-4 w-4 text-yellow-500" />
                        Senior
                    </Button>
                </div>
                  
                <SupervisorPinDialog
                    open={isPinDialogOpen}
                    onOpenChange={setIsPinDialogOpen}
                    onVerified={onPinVerified}
                />

                <SupervisorPinDialog
                    open={isSeniorPinDialogOpen}
                    onOpenChange={setIsSeniorPinDialogOpen}
                    onVerified={onSeniorPinVerified}
                />
                
                <SeniorDiscountDialog
                    open={isSeniorDialogOpen}
                    onOpenChange={setIsSeniorDialogOpen}
                />

                <Dialog
                  open={payLaterOpen}
                  onOpenChange={(o) => {
                    setPayLaterOpen(o);
                    if (!o) setPayLaterNote("");
                  }}
                >
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Hold order (pay later)</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                      Saves this cart as an open order. Nothing is charged yet and stock is not reduced. Collect payment from{" "}
                      <strong>Orders</strong> when the customer is ready.
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="pay-later-note">Note (optional)</Label>
                      <Textarea
                        id="pay-later-note"
                        placeholder="e.g. Guest name, table reminder…"
                        value={payLaterNote}
                        onChange={(e) => setPayLaterNote(e.target.value)}
                        rows={2}
                      />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setPayLaterOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        disabled={savingHeldOrder || !currentStore}
                        onClick={async () => {
                          if (!currentStore || cartItems.length === 0) return;
                          setSavingHeldOrder(true);
                          try {
                            await createOpenOrder({
                              storeId: currentStore.id,
                              items: cartItems,
                              manualDiscount,
                              seniorDiscountDetails:
                                seniorDiscountDetails.totalDiscount > 0 ? seniorDiscountDetails : null,
                              subtotal,
                              discount,
                              total,
                              tableId: selectedTable?.id ?? null,
                              tableLabel: selectedTable?.label ?? null,
                              note: payLaterNote.trim() || null,
                              createdByUserId: user?.id ?? null,
                              createdByName: user?.fullName ?? null,
                            });
                            clearCart();
                            onSelectedTableChange(null);
                            setPayLaterOpen(false);
                            setPayLaterNote("");
                            toast({
                              title: "Order held",
                              description: "Open Orders to resume and take payment when ready.",
                            });
                          } catch (e) {
                            toast({
                              variant: "destructive",
                              title: "Could not hold order",
                              description: e instanceof Error ? e.message : "Try again.",
                            });
                          } finally {
                            setSavingHeldOrder(false);
                          }
                        }}
                      >
                        {savingHeldOrder ? "Saving…" : "Save open order"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={isDiscountDialogOpen} onOpenChange={setIsDiscountDialogOpen}>
                    <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Apply Manual Discount</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="discount-amount">Discount Amount (₱)</Label>
                        <Input 
                        id="discount-amount"
                        type="number"
                        placeholder="e.g., 50.00"
                        value={discountInput}
                        onChange={(e) => setDiscountInput(e.target.value)}
                        autoComplete="off"
                        />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button onClick={handleApplyDiscount}>Apply Discount</Button>
                    </DialogFooter>
                    </DialogContent>
                </Dialog>
                
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    className="w-full"
                    disabled={isCharging || savingHeldOrder || total <= 0 || cartItems.length === 0}
                    onClick={() => setIsCheckoutOpen(true)}
                  >
                    {isCharging ? "Processing…" : "Pay"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    disabled={isCharging || savingHeldOrder || total <= 0 || cartItems.length === 0}
                    onClick={() => {
                      setPayLaterNote("");
                      setPayLaterOpen(true);
                    }}
                  >
                    Pay later
                  </Button>
                </div>
              </div>
          </CardFooter>
      )}
    </div>

    {isCheckoutOpen && (
      <Suspense fallback={<CakeLoader />}>
        <CheckoutDialog
          open={isCheckoutOpen}
          onOpenChange={setIsCheckoutOpen}
          total={total}
          subtotal={subtotal}
          onCharge={handleCharge}
          onTransactionComplete={handleTransactionComplete}
          isCharging={isCharging}
          selectedTable={selectedTable}
        />
      </Suspense>
    )}

    {transactionDetails && (
      <Suspense fallback={<CakeLoader />}>
        <PaymentSuccessDialog
          isOpen={showSuccessDialog}
          onClose={handleSuccessDialogClose}
          details={transactionDetails}
        />
      </Suspense>
    )}
  </>
  );
}

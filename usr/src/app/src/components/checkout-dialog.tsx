
"use client";

import { useState, useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from './ui/separator';
import { Wallet, CreditCard, Banknote } from 'lucide-react';
import { PaymentSuccessDialog } from './payment-success-dialog';
import { recordSale } from '@/services/sales-service';
import { useCart } from '@/context/cart-context';
import { useStore } from '@/context/store-context';


interface CheckoutDialogProps {
  total: number;
  subtotal: number;
  onCharge: () => Promise<void>;
  onSuccess: () => void;
  isCharging: boolean;
}

interface TransactionDetails {
  total: number;
  amountPaid: number;
  change: number;
}

export function CheckoutDialog({ total, subtotal, onCharge, onSuccess, isCharging }: CheckoutDialogProps) {
  const [open, setOpen] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [transactionDetails, setTransactionDetails] = useState<TransactionDetails | null>(null);
  const { cartItems, discount } = useCart();
  const { currentStore } = useStore();

  const checkoutSchema = z.object({
    paymentMethod: z.enum(['Cash', 'GCash', 'Card'], { required_error: 'Please select a payment method.' }),
    amountPaid: z.coerce.number().min(total, `Amount must be at least ₱${total.toFixed(2)}`),
    referenceNumber: z.string().optional(),
    customerName: z.string().optional(),
    specialInstructions: z.string().optional(),
  });

  type CheckoutFormValues = z.infer<typeof checkoutSchema>;

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      paymentMethod: 'Cash',
      amountPaid: undefined,
      referenceNumber: '',
      customerName: '',
      specialInstructions: '',
    },
  });
  
  const amountPaid = form.watch('amountPaid') || 0;
  const change = amountPaid - total;
  const paymentMethod = form.watch('paymentMethod');

  useEffect(() => {
    // Reset the form whenever the dialog opens or the total changes.
    // This ensures `amountPaid` is blank and the validation rule is current.
    if (open) {
      form.reset({
        paymentMethod: 'Cash',
        amountPaid: undefined,
        referenceNumber: '',
        customerName: '',
        specialInstructions: '',
      });
    }
  }, [open, total, form]);


  const handleSubmit: SubmitHandler<CheckoutFormValues> = async (data) => {
    if (!currentStore) return;

    try {
      // 1. Update inventory stock (already handles pre-order logic)
      await onCharge();
      
      // 2. Determine if the sale is a pre-order
      const isPreOrder = cartItems.some(item => item.isPreOrder);

      // 3. Record the sale
      await recordSale({
        storeId: currentStore.id,
        items: cartItems.map(item => ({ 
          id: item.id, 
          name: item.name, 
          price: item.price, 
          quantity: item.quantity,
          configuration: item.selectedConfiguration || null,
        })),
        subtotal,
        discount,
        total,
        paymentMethod: data.paymentMethod,
        referenceNumber: data.referenceNumber || null,
        customerName: data.customerName || null,
        specialInstructions: data.specialInstructions || null,
        isPreOrder,
      });

      // 4. Show success dialog
      setTransactionDetails({
        total: total,
        amountPaid: data.amountPaid,
        change: data.amountPaid - total
      });

      setOpen(false); // Close checkout dialog
      setShowSuccessDialog(true); // Open success dialog

    } catch (error) {
      console.error("Charging failed from dialog", error);
    }
  };

  const handleSuccessDialogClose = () => {
    setShowSuccessDialog(false);
    onSuccess(); // This clears the cart
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="w-full text-lg py-6" disabled={isCharging || total <= 0}>
            {isCharging ? 'Processing...' : `Charge ₱${total.toFixed(2)}`}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl text-center font-bold">Checkout</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              
              {/* Order Summary */}
              <div className="p-4 bg-secondary/50 rounded-lg space-y-2">
                  <h3 className="font-semibold text-lg">Order Summary</h3>
                  <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span>₱{subtotal.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-xl">
                      <span>Total:</span>
                      <span className="text-primary">₱{total.toFixed(2)}</span>
                  </div>
              </div>

              {/* Payment Method */}
              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="font-semibold text-lg">Payment Method</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-2"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-3 has-[:checked]:border-primary">
                          <FormControl><RadioGroupItem value="Cash" /></FormControl>
                          <Banknote className="h-5 w-5 text-green-600" />
                          <FormLabel className="font-normal flex-1 cursor-pointer">Cash</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-3 has-[:checked]:border-primary">
                          <FormControl><RadioGroupItem value="GCash" /></FormControl>
                          <Wallet className="h-5 w-5 text-blue-500" />
                          <FormLabel className="font-normal flex-1 cursor-pointer">GCash</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-3 has-[:checked]:border-primary">
                          <FormControl><RadioGroupItem value="Card" /></FormControl>
                          <CreditCard className="h-5 w-5 text-purple-500" />
                          <FormLabel className="font-normal flex-1 cursor-pointer">Card</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {paymentMethod === 'GCash' && (
                <FormField
                  control={form.control}
                  name="referenceNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-lg">GCash Reference No. (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Last 6 digits of reference number" 
                          {...field} 
                          autoComplete='off'
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Amount Paid */}
              <FormField
                control={form.control}
                name="amountPaid"
                render={({ field }) => (
                  <FormItem>
                     <div className="flex justify-between items-center">
                        <FormLabel className="font-semibold text-lg">Amount Paid</FormLabel>
                        <Button 
                            type="button" 
                            variant="link" 
                            className="p-0 h-auto text-primary"
                            onClick={() => form.setValue('amountPaid', total, { shouldValidate: true })}
                        >
                            Exact Amount
                        </Button>
                    </div>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        {...field} 
                        placeholder="0.00" 
                        value={field.value === undefined ? '' : field.value} 
                        autoComplete='off' 
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                      />
                    </FormControl>
                    {change > 0 && (
                      <FormDescription className="text-green-600 font-bold !mt-2">
                        Change: ₱{change.toFixed(2)}
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Customer Name */}
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-lg">Customer Name (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter customer name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Special Instructions */}
              <FormField
                control={form.control}
                name="specialInstructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-lg">Special Instructions (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Any special instructions..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter className="grid grid-cols-2 gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isCharging}>
                  {isCharging ? 'Processing...' : 'Complete Sale'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {transactionDetails && (
        <PaymentSuccessDialog
          isOpen={showSuccessDialog}
          onClose={handleSuccessDialogClose}
          details={transactionDetails}
        />
      )}
    </>
  );
}



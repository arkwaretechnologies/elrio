
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from './ui/separator';
import { Wallet, Banknote, Calendar as CalendarIcon, Package, BookMarked, UserPlus, Search } from 'lucide-react';
import { recordSale } from '@/services/sales-service';
import { useCart } from '@/context/cart-context';
import { useAuth } from '@/context/auth-context';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import type { RegularCustomer, Sale, SaleItem } from '@/lib/types';
import { searchRegularCustomers, getRegularCustomers } from '@/services/customer-service';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import debounce from 'lodash.debounce';
import { Checkbox } from './ui/checkbox';
import { useToast } from '@/hooks/use-toast';

/** Set to true to show the On Credit payment option again. */
const CHECKOUT_SHOW_ON_CREDIT = false;
/** Set to true to show the pre-order checkbox and fields again. */
const CHECKOUT_SHOW_PRE_ORDER = false;

export interface TransactionDetails {
  total: number;
  amountPaid: number;
  change: number;
  paymentMethod: 'Cash' | 'GCash' | 'On Credit';
  pickupNumber: number;
  orderNumber: number;
  saleId: string;
  sale: Sale;
}

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  subtotal: number;
  onCharge: () => Promise<void>;
  onTransactionComplete: (details: TransactionDetails) => void;
  isCharging: boolean;
  /** Set when opening Pay after cashier chose dine-in or takeout on the POS. */
  serviceType: 'dine-in' | 'takeout';
}

const createCheckoutSchema = (total: number, showOnCredit: boolean) =>
  z.object({
  paymentMethod: z.enum(
    showOnCredit ? (['Cash', 'GCash', 'On Credit'] as const) : (['Cash', 'GCash'] as const),
    { required_error: 'Please select a payment method.' },
  ),
  amountPaid: z.coerce.number().default(0),
  referenceNumber: z.string().optional(),
  customerName: z.string().optional(),
  phoneNumber: z.string().optional(),
  pickupDate: z.date().optional(),
  specialInstructions: z.string().optional(),
  isPreOrder: z.boolean().default(false),
  regularCustomerId: z.string().optional(),
}).refine(data => {
    if (data.isPreOrder) {
        return !!data.customerName && data.customerName.length > 0;
    }
    return true;
}, {
    message: "Customer name is required for pre-orders.",
    path: ["customerName"],
}).refine(data => {
    if (data.isPreOrder) {
        return !!data.phoneNumber && data.phoneNumber.length > 0;
    }
    return true;
}, {
    message: "Phone number is required for pre-orders.",
    path: ["phoneNumber"],
}).refine(data => {
    if (data.isPreOrder) {
        return !!data.pickupDate;
    }
    return true;
}, {
    message: "Pick-up date is required for pre-orders.",
    path: ["pickupDate"],
}).refine(data => {
    if (data.paymentMethod === 'On Credit' && !data.regularCustomerId) {
        return false;
    }
    return true;
}, {
    message: "A regular customer must be selected for credit sales.",
    path: ["paymentMethod"],
}).refine(data => {
    if (!data.isPreOrder && data.paymentMethod !== 'On Credit') {
      const roundedTotal = parseFloat(total.toFixed(2));
      return data.amountPaid >= roundedTotal;
    }
    return true;
}, {
    message: `Amount must be at least ₱${total.toFixed(2)}`,
    path: ["amountPaid"],
});

type CheckoutFormValues = z.infer<ReturnType<typeof createCheckoutSchema>>;

export function CheckoutDialog({
  open,
  onOpenChange,
  total,
  subtotal,
  onCharge,
  onTransactionComplete,
  isCharging,
  serviceType,
}: CheckoutDialogProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
  const [customerSearchResults, setCustomerSearchResults] = useState<RegularCustomer[]>([]);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<RegularCustomer | null>(null);
  const { cartItems, discount, seniorDiscountDetails } = useCart();
  const { currentStore } = useAuth();
  const { toast } = useToast();
  
  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(createCheckoutSchema(total, CHECKOUT_SHOW_ON_CREDIT)),
    defaultValues: {
      paymentMethod: 'Cash',
      amountPaid: 0,
      referenceNumber: '',
      customerName: '',
      phoneNumber: '',
      pickupDate: undefined,
      specialInstructions: '',
      isPreOrder: false,
      regularCustomerId: '',
    },
  });
  
  const isPreOrderInForm = form.watch('isPreOrder');

  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (query.length > 1) {
        setIsSearching(true);
        const results = await searchRegularCustomers(query);
        setCustomerSearchResults(results);
        setIsSearching(false);
      } else {
        setCustomerSearchResults([]);
      }
    }, 300),
    []
  );

  const handleSearchChange = (search: string) => {
    setCustomerSearchQuery(search);
    debouncedSearch(search);
  };
  
  const amountPaid = form.watch('amountPaid') || 0;
  const change = amountPaid > total ? amountPaid - total : 0;
  const paymentMethod = form.watch('paymentMethod');

  useEffect(() => {
    if (open) {
      form.reset({
        paymentMethod: 'Cash',
        amountPaid: 0,
        referenceNumber: '',
        customerName: '',
        phoneNumber: '',
        pickupDate: undefined,
        specialInstructions: '',
        isPreOrder: false,
        regularCustomerId: '',
      });
      setSelectedCustomer(null);
      setCustomerSearchResults([]);
    }
  }, [open, form]);

  useEffect(() => {
    form.resolver = zodResolver(createCheckoutSchema(total, CHECKOUT_SHOW_ON_CREDIT));
  }, [total, form]);

  const handleSubmit: SubmitHandler<CheckoutFormValues> = async (data) => {
    if (!currentStore) return;

    try {
      await onCharge();
      
      const result = await recordSale({
        storeId: currentStore.id,
        items: cartItems,
        subtotal,
        discount,
        total: total,
        paymentMethod: data.paymentMethod,
        referenceNumber: data.referenceNumber || null,
        customerName: data.customerName || null,
        phoneNumber: data.phoneNumber || null,
        pickupDate: data.pickupDate || null,
        specialInstructions: data.specialInstructions || null,
        isPreOrder: data.isPreOrder,
        seniorDiscountDetails: seniorDiscountDetails.totalDiscount > 0 ? seniorDiscountDetails : null,
        amountPaid: data.amountPaid,
        onCredit: data.paymentMethod === 'On Credit',
        regularCustomerId: data.regularCustomerId,
        tableId: null,
        tableLabel: null,
        serviceType,
      });

      const now = new Date();
      const saleItems: SaleItem[] = cartItems.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        configuration: item.selectedConfiguration || null,
        isPreOrder: data.isPreOrder,
      }));
      const saleForPrint: Sale = {
        id: result.saleId,
        storeId: currentStore.id,
        items: saleItems,
        subtotal,
        discount,
        total,
        paymentMethod: data.paymentMethod,
        referenceNumber: data.referenceNumber || null,
        customerName: data.customerName || null,
        specialInstructions: data.specialInstructions || null,
        timestamp: now,
        createdAt: now,
        isPreOrder: data.isPreOrder,
        seniorDiscountDetails: seniorDiscountDetails.totalDiscount > 0 ? seniorDiscountDetails : null,
        phoneNumber: data.phoneNumber || null,
        pickupDate: data.pickupDate || null,
        amountPaid: data.amountPaid,
        isPaidInFull: data.paymentMethod !== 'On Credit' && data.amountPaid >= total,
        onCredit: data.paymentMethod === 'On Credit',
        regularCustomerId: data.regularCustomerId ?? null,
        status: 'COMPLETED',
        tableId: null,
        tableLabel: null,
        serviceType,
        orderNumber: result.orderNumber,
        pickupNumber: result.pickupNumber,
      };

      if (data.paymentMethod === 'On Credit') {
        toast({
          title: "Sale on account",
          description: "The customer's balance has been updated.",
        });
      }

      onTransactionComplete({
        total: total,
        amountPaid: data.amountPaid,
        change: change,
        paymentMethod: data.paymentMethod,
        pickupNumber: result.pickupNumber,
        orderNumber: result.orderNumber,
        saleId: result.saleId,
        sale: saleForPrint,
      });

    } catch (error) {
      console.error("Charging failed from dialog", error);
      toast({
        variant: "destructive",
        title: "Order Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
      });
    }
  };

  const advancePayment = useMemo(() => {
    if (!isPreOrderInForm) return 0;
    return amountPaid;
  }, [isPreOrderInForm, amountPaid]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center font-bold">Checkout</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            
            <div className="p-4 bg-secondary/50 rounded-lg space-y-2">
              <h3 className="font-semibold text-lg">Order Summary</h3>
               <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span>₱{subtotal.toFixed(2)}</span>
                  </div>
              {discount > 0 && (
                   <div className="flex justify-between text-destructive text-sm">
                      <span >Discount:</span>
                      <span >- ₱{discount.toFixed(2)}</span>
                  </div>
              )}

              <Separator />
              <div className="flex justify-between font-bold text-xl">
                  <span>Total Due:</span>
                  <span className="text-primary">₱{total.toFixed(2)}</span>
              </div>
            </div>
            
            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="font-semibold text-lg">Payment method</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className={cn(
                        'grid gap-2',
                        CHECKOUT_SHOW_ON_CREDIT ? 'grid-cols-3' : 'grid-cols-2',
                      )}
                    >
                      <FormItem className="flex items-center space-x-2 space-y-0 rounded-md border p-3 has-[:checked]:border-primary">
                        <FormControl><RadioGroupItem value="Cash" /></FormControl>
                        <Banknote className="h-5 w-5 text-green-600" />
                        <FormLabel className="font-normal flex-1 cursor-pointer">Cash</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0 rounded-md border p-3 has-[:checked]:border-primary">
                        <FormControl><RadioGroupItem value="GCash" /></FormControl>
                        <Wallet className="h-5 w-5 text-blue-500" />
                        <FormLabel className="font-normal flex-1 cursor-pointer">GCash</FormLabel>
                      </FormItem>
                      {CHECKOUT_SHOW_ON_CREDIT && (
                        <FormItem className="flex items-center space-x-2 space-y-0 rounded-md border p-3 has-[:checked]:border-primary">
                          <FormControl><RadioGroupItem value="On Credit" /></FormControl>
                          <UserPlus className="h-5 w-5 text-orange-500" />
                          <FormLabel className="font-normal flex-1 cursor-pointer">On Credit</FormLabel>
                        </FormItem>
                      )}
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

            <FormField
              control={form.control}
              name="amountPaid"
              render={({ field }) => (
                <FormItem>
                  <div className="flex justify-between items-center">
                      <FormLabel className="font-semibold text-lg">Amount paid</FormLabel>
                      <Button 
                          type="button" 
                          variant="link" 
                          className="p-0 h-auto text-primary"
                          onClick={() => form.setValue('amountPaid', parseFloat(total.toFixed(2)), { shouldValidate: true })}
                      >
                          Exact amount
                      </Button>
                  </div>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01" 
                      {...field} 
                      placeholder="0.00" 
                      value={field.value === 0 ? '' : field.value}
                      onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                      autoComplete='off' 
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                    />
                  </FormControl>
                  <FormMessage />
                   {isPreOrderInForm && advancePayment > 0 && (
                      <FormDescription className="text-blue-600 font-bold !mt-2">
                         Advance payment: ₱{advancePayment.toFixed(2)}
                      </FormDescription>
                  )}
                  {change > 0 && paymentMethod !== 'On Credit' && (
                    <FormDescription className="text-green-600 font-bold !mt-2">
                      Change: ₱{change.toFixed(2)}
                    </FormDescription>
                  )}
                </FormItem>
              )}
            />
            
            <Separator />
            
            {CHECKOUT_SHOW_PRE_ORDER && (
              <FormField
                control={form.control}
                name="isPreOrder"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Mark as Pre-order
                      </FormLabel>
                      <FormDescription>
                        Check this for future pick-up orders.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            )}
            
            {(isPreOrderInForm || paymentMethod === 'On Credit') && (
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-lg flex items-center justify-between">
                      <span>Customer name {isPreOrderInForm || paymentMethod === 'On Credit' ? '' : '(optional)'}</span>
                      <Popover open={isCustomerSearchOpen} onOpenChange={setIsCustomerSearchOpen}>
                          <PopoverTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6"><Search className="h-4 w-4"/></Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0">
                              <Command shouldFilter={false}>
                                  <CommandInput 
                                    placeholder="Search customer..." 
                                    onValueChange={handleSearchChange}
                                    isLoading={isSearching}
                                  />
                                  <CommandList>
                                      <CommandEmpty>
                                          {isSearching ? 'Searching...' : 
                                           customerSearchQuery.length > 1 ? 'No customer found.' : 'Type to search for a customer.'}
                                      </CommandEmpty>
                                      <CommandGroup>
                                      {customerSearchResults.map((customer) => (
                                          <CommandItem
                                              key={customer.id}
                                              value={`${customer.firstName} ${customer.lastName}`}
                                              onSelect={() => {
                                                  setSelectedCustomer(customer);
                                                  form.setValue('customerName', `${customer.firstName} ${customer.lastName}`);
                                                  form.setValue('regularCustomerId', customer.id);
                                                  setIsCustomerSearchOpen(false);
                                              }}
                                          >
                                              {customer.firstName} {customer.lastName}
                                          </CommandItem>
                                      ))}
                                      </CommandGroup>
                                  </CommandList>
                              </Command>
                          </PopoverContent>
                      </Popover>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Enter customer name" {...field} autoComplete="off" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
             {isPreOrderInForm && (
              <div className="space-y-4 p-4 border-l-4 border-purple-500 bg-purple-50/50 rounded-r-lg">
                   <FormField
                      control={form.control}
                      name="phoneNumber"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>Phone Number</FormLabel>
                              <FormControl>
                                  <Input placeholder="Enter customer's phone number" {...field} className="bg-card" autoComplete="off" />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                      />
                  <FormField
                    control={form.control}
                    name="pickupDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Pick-up Date</FormLabel>
                        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn("w-full pl-3 text-left font-normal bg-card", !field.value && "text-muted-foreground")}
                              >
                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={(date) => {
                                field.onChange(date);
                                setIsCalendarOpen(false);
                              }}
                              disabled={(date) => date < startOfDay(new Date())}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </div>
             )}

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
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isCharging || form.formState.isSubmitting}>
                {isCharging || form.formState.isSubmitting ? 'Processing…' : 'Pay'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

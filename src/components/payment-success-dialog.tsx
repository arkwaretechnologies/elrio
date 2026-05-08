
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, UserCheck } from "lucide-react";

interface PaymentSuccessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  details: {
    total: number;
    amountPaid: number;
    change: number;
    paymentMethod: 'Cash' | 'GCash' | 'On Credit';
  };
}

export function PaymentSuccessDialog({ isOpen, onClose, details }: PaymentSuccessDialogProps) {
  if (!isOpen) return null;
  
  const isCreditSale = details.paymentMethod === 'On Credit';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {isCreditSale ? (
              <UserCheck className="h-16 w-16 text-blue-500" />
            ) : (
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            )}
            <DialogTitle className="text-2xl text-center font-bold">
              {isCreditSale ? 'Sale on account' : 'Payment successful'}
            </DialogTitle>
          </div>
        </DialogHeader>
        
        <div className="space-y-3 p-4 bg-secondary/50 rounded-lg my-4">
            <div className="flex justify-between items-center text-lg">
                <span className="text-muted-foreground">Total:</span>
                <span className="font-semibold">₱{details.total.toFixed(2)}</span>
            </div>
            {!isCreditSale && (
              <>
                 <div className="flex justify-between items-center text-lg">
                    <span className="text-muted-foreground">Amount Paid:</span>
                    <span className="font-semibold">₱{details.amountPaid.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center text-xl">
                    <span className="text-muted-foreground">Change:</span>
                    <span className="font-bold text-primary">₱{details.change.toFixed(2)}</span>
                </div>
              </>
            )}
            {isCreditSale && (
                 <div className="flex justify-between items-center text-lg">
                    <span className="text-muted-foreground">Amount Paid:</span>
                    <span className="font-semibold">₱{details.amountPaid.toFixed(2)}</span>
                </div>
            )}
        </div>
        
        <DialogFooter>
          <Button onClick={onClose} className="w-full text-lg py-6">
            Next Customer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

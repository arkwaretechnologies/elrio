
"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Delete, UserCheck } from "lucide-react";
import type { Sale } from "@/lib/types";
import { updateSalePickupNumber } from "@/services/sales-service";
import { getStorePrinterSettings } from "@/services/printer-settings-service";
import { printKitchenCopy, printCashierReceipt } from "@/lib/printers/print-sale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface PaymentSuccessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  details: {
    total: number;
    amountPaid: number;
    change: number;
    paymentMethod: "Cash" | "GCash" | "On Credit";
    pickupNumber: number;
    saleId: string;
    sale: Sale;
  };
}

function parsePickupInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n < 1 || n > 999) return null;
  return n;
}

function KeypadButton({
  children,
  onClick,
  disabled,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "muted";
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant={variant === "muted" ? "secondary" : "outline"}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-14 text-2xl font-semibold tabular-nums sm:h-16 sm:text-3xl",
        className,
      )}
    >
      {children}
    </Button>
  );
}

export function PaymentSuccessDialog({ isOpen, onClose, details }: PaymentSuccessDialogProps) {
  const { toast } = useToast();
  const [pickupInput, setPickupInput] = useState(String(details.pickupNumber));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPickupInput(String(details.pickupNumber));
    }
  }, [isOpen, details.pickupNumber]);

  if (!isOpen) return null;

  const isCreditSale = details.paymentMethod === "On Credit";
  const displayValue = pickupInput.trim() || "—";

  const appendDigit = (digit: string) => {
    if (saving) return;
    setPickupInput((prev) => {
      if (prev.length >= 3) return prev;
      if (!prev && digit === "0") return prev;
      const next = prev + digit;
      const n = parseInt(next, 10);
      if (!Number.isFinite(n) || n > 999) return prev;
      return next;
    });
  };

  const backspace = () => {
    if (saving) return;
    setPickupInput((prev) => prev.slice(0, -1));
  };

  const useSuggested = () => {
    if (saving) return;
    setPickupInput(String(details.pickupNumber));
  };

  const finish = async () => {
    const pickup = parsePickupInput(pickupInput);
    if (pickup == null) {
      toast({
        variant: "destructive",
        title: "Invalid number",
        description: "Enter a number from 1 to 999.",
      });
      return;
    }

    setSaving(true);
    try {
      await updateSalePickupNumber(details.saleId, pickup);
      const saleToPrint: Sale = { ...details.sale, pickupNumber: pickup };
      const printerSettings = await getStorePrinterSettings(details.sale.storeId);
      try {
        await printKitchenCopy(saleToPrint, printerSettings);
      } catch (e) {
        toast({
          variant: "destructive",
          title: "Kitchen print failed",
          description: e instanceof Error ? e.message : "Check printer settings.",
        });
      }
      try {
        await printCashierReceipt(saleToPrint, printerSettings);
      } catch (e) {
        toast({
          variant: "destructive",
          title: "Receipt print failed",
          description: e instanceof Error ? e.message : "Check printer settings.",
        });
      }
      onClose();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not save number",
        description: e instanceof Error ? e.message : "Try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !saving && void finish()}>
      <DialogContent
        className="gap-3 sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-2 pb-0">
          <div className="flex flex-col items-center gap-2">
            {isCreditSale ? (
              <UserCheck className="h-12 w-12 text-blue-500" />
            ) : (
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            )}
            <DialogTitle className="text-xl text-center font-bold">
              {isCreditSale ? "Sale on account" : "Payment successful"}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex flex-col items-center gap-1">
          <p className="text-center text-sm font-medium text-muted-foreground">
            Order number — tag for the customer
          </p>
          <div
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-primary/25 bg-primary/5 px-4 py-3"
            aria-live="polite"
          >
            <span className="text-6xl font-extrabold leading-none text-primary sm:text-7xl">
              #
            </span>
            <span
              className={cn(
                "min-w-[3ch] text-center text-7xl font-extrabold leading-none tabular-nums sm:text-8xl",
                pickupInput.trim() ? "text-primary" : "text-muted-foreground/40",
              )}
            >
              {displayValue}
            </span>
          </div>
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
            disabled={saving}
            onClick={useSuggested}
          >
            Use suggested #{details.pickupNumber}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {digits.map((d) => (
            <KeypadButton key={d} disabled={saving} onClick={() => appendDigit(d)}>
              {d}
            </KeypadButton>
          ))}
          <KeypadButton disabled={saving} variant="muted" onClick={backspace}>
            <Delete className="h-7 w-7" />
          </KeypadButton>
          <KeypadButton disabled={saving} onClick={() => appendDigit("0")}>
            0
          </KeypadButton>
          <KeypadButton disabled={saving} variant="muted" onClick={() => setPickupInput("")}>
            Clear
          </KeypadButton>
        </div>

        <div className="space-y-2 rounded-lg bg-secondary/50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold tabular-nums">₱{details.total.toFixed(2)}</span>
          </div>
          {!isCreditSale ? (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span className="font-semibold tabular-nums">₱{details.amountPaid.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-base">
                <span className="text-muted-foreground">Change</span>
                <span className="font-bold tabular-nums text-primary">
                  ₱{details.change.toFixed(2)}
                </span>
              </div>
            </>
          ) : (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid</span>
              <span className="font-semibold tabular-nums">₱{details.amountPaid.toFixed(2)}</span>
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-stretch">
          <Button
            onClick={() => void finish()}
            disabled={saving}
            className="w-full py-6 text-lg"
          >
            {saving ? "Printing…" : "Next Customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

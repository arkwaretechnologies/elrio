
"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { verifySupervisorPin } from '@/services/auth-service';
import { useAuth } from '@/context/auth-context';

interface SupervisorPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
}

export function SupervisorPinDialog({ open, onOpenChange, onVerified }: SupervisorPinDialogProps) {
  const [pin, setPin] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const { currentStore } = useAuth();
  const { toast } = useToast();

  const handleVerify = async () => {
    if (!currentStore) {
        toast({ variant: 'destructive', title: 'Error', description: 'No store selected.' });
        return;
    }
    if (pin.length !== 4) {
        toast({ variant: 'destructive', title: 'Invalid PIN', description: 'PIN must be 4 digits.' });
        return;
    }

    setIsVerifying(true);
    try {
        const isValid = await verifySupervisorPin(currentStore.id, pin);
        if (isValid) {
            onVerified();
        } else {
            toast({ variant: 'destructive', title: 'Invalid PIN', description: 'The entered PIN is incorrect or does not have supervisor permissions.' });
        }
    } catch (error) {
        console.error('PIN verification failed:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'An error occurred during PIN verification.' });
    } finally {
        setIsVerifying(false);
        setPin('');
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
        setPin(''); // Reset PIN when closing
    }
    onOpenChange(isOpen);
  };
  
  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Allow only digits
    if (value.length <= 4) {
      setPin(value);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Supervisor Authorization</DialogTitle>
          <DialogDescription>
            Please enter a supervisor's PIN to apply a discount.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="pin" className="text-right">
              PIN
            </Label>
            <Input
              id="pin"
              type="password"
              value={pin}
              onChange={handlePinChange}
              className="col-span-3"
              maxLength={4}
              autoComplete="off"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={handleVerify} disabled={isVerifying || pin.length < 4}>
            {isVerifying ? 'Verifying...' : 'Verify PIN'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

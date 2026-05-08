

"use client";

import { db } from '@/lib/firebase/client';
import { 
  collection, 
  addDoc, 
  doc, 
  runTransaction,
  Timestamp,
  serverTimestamp,
  increment,
  query,
  where,
  getDocs,
  orderBy
} from 'firebase/firestore';
import type { Payment, Sale } from '@/lib/types';
import { startOfDay, endOfDay } from 'date-fns';

export async function recordCustomerPayment(
    storeId: string, 
    customerId: string | null, 
    amount: number,
    notes?: string,
    saleId?: string // Optional saleId for pre-order settlements
): Promise<string> {
    
    const paymentRef = doc(collection(db, 'payments'));
    const paymentDate = new Date(); // Generate timestamp before the transaction
    
    try {
        await runTransaction(db, async (transaction) => {
            // 1. If a customerId is provided, update their credit balance
            if (customerId) {
                const customerRef = doc(db, 'regularCustomers', customerId);
                const customerDoc = await transaction.get(customerRef);
                if (!customerDoc.exists()) {
                    throw new Error("Customer not found.");
                }
                const creditField = `storeCredit.${storeId}`;
                transaction.update(customerRef, {
                    [creditField]: increment(-amount)
                });
            }
            
            // 2. Create a new payment record
            const newPayment: Omit<Payment, 'id'> = {
                customerId: customerId || '',
                storeId: storeId,
                amount: amount,
                paymentDate: paymentDate, // Use the pre-generated timestamp
                notes: notes || '',
                saleId: saleId || null, // Ensure saleId is null, not undefined
            };
            transaction.set(paymentRef, newPayment);

            // 3. If a saleId is provided (for pre-order settlement), update the sale document
            if (saleId) {
                const saleRef = doc(db, 'sales', saleId);
                transaction.update(saleRef, {
                    amountPaid: increment(amount),
                    isPaidInFull: true // Settling implies it's now paid in full
                });
            }
        });

        return paymentRef.id;

    } catch (e) {
        console.error("Payment transaction failed: ", e);
        if (e instanceof Error) {
            throw e;
        }
        throw new Error("Failed to record payment.");
    }
}


export async function getPaymentsForCustomer(storeId: string, customerId: string): Promise<Payment[]> {
   const paymentsQuery = query(
        collection(db, 'payments'),
        where('storeId', '==', storeId),
        where('customerId', '==', customerId)
    );
     const paymentsSnapshot = await getDocs(paymentsQuery);
     const payments = paymentsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            ...data,
            id: doc.id,
            paymentDate: (data.paymentDate as Timestamp).toDate()
        } as Payment;
    });
    return payments;
}


export async function getPaymentsForDate(storeId: string, date: Date): Promise<Payment[]> {
  if (!storeId) return [];
  const start = startOfDay(date);
  const end = endOfDay(date);

  const paymentsCollection = collection(db, 'payments');
  const q = query(
    paymentsCollection,
    where('paymentDate', '>=', start),
    where('paymentDate', '<=', end)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      paymentDate: (data.paymentDate as Timestamp).toDate(),
    } as Payment;
  }).filter(p => p.storeId === storeId);
}

export async function getPayments(storeId: string): Promise<Payment[]> {
    if (!storeId) return [];
    
    const paymentsCollection = collection(db, 'payments');
    const q = query(paymentsCollection, where('storeId', '==', storeId));
    const snapshot = await getDocs(q);
    const payments = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            paymentDate: (data.paymentDate as Timestamp).toDate(),
        } as Payment;
    });
    
    // Sort by date descending on the client side
    return payments.sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime());
}



"use client";

import { db } from '@/lib/firebase/client';
import { collection, addDoc, getDocs, query, orderBy, Timestamp, writeBatch, where, doc, updateDoc, getDoc, runTransaction, increment } from 'firebase/firestore';
import { consumptionDeductsStock, type RegularCustomer, type Sale, type SaleItem, type CartItem, type InventoryItem } from '@/lib/types';

/** Payload for creating a sale; omits fields computed inside the transaction. */
export type RecordSalePayload = Omit<
  Sale,
  'id' | 'timestamp' | 'createdAt' | 'status' | 'items' | 'isPaidInFull'
> & {
  items: CartItem[];
};
import { startOfDay, endOfDay } from 'date-fns';
import { recordCustomerPayment } from './payment-service';
import { deductStockForSale, getInventoryItems } from './inventory-service';
import { getMenuItems } from './menu-service';

export async function recordSale(saleData: RecordSalePayload): Promise<string> {
    const saleRef = doc(collection(db, 'sales'));
    const inventoryItemsList = await getInventoryItems();
    const inventoryItemById = new Map<string, InventoryItem>(inventoryItemsList.map((i) => [i.id, i]));

    try {
        await runTransaction(db, async (transaction) => {
            // --- READ PHASE ---
            let customerDoc: any = null;
            if (saleData.onCredit && saleData.regularCustomerId) {
                const customerRef = doc(db, 'regularCustomers', saleData.regularCustomerId);
                customerDoc = await transaction.get(customerRef);
                if (!customerDoc.exists()) {
                    throw new Error("Customer not found during transaction.");
                }
            }

            // --- WRITE PHASE ---
            
            // Stock deduction for non-pre-orders is now part of the transaction
            if (!saleData.isPreOrder) {
                await deductStockForSale(saleData.storeId, saleData.items, transaction, inventoryItemById);
            }
            
            // Update customer credit if it's an "On Credit" sale
            if (saleData.onCredit && saleData.regularCustomerId && customerDoc) {
                const customerRef = doc(db, 'regularCustomers', saleData.regularCustomerId);
                const amountToCredit = saleData.total - saleData.amountPaid;
                
                if (amountToCredit > 0) {
                    const creditField = `storeCredit.${saleData.storeId}`;
                    transaction.update(customerRef, { [creditField]: increment(amountToCredit) });
                }
            }
            
            // Format cart items for the sale record
            const saleItems: SaleItem[] = saleData.items.map(item => ({
                id: item.id, // This is the composite key `baseProductId_variantId`
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                configuration: item.selectedConfiguration || null,
                isPreOrder: saleData.isPreOrder, // Use the overarching sale status
            }));
            
            // Set timestamp based on whether it's a pre-order or immediate sale
            const now = new Date();
            const finalTimestamp = saleData.isPreOrder && saleData.pickupDate ? saleData.pickupDate : now;
            
            // Create the final sale document
            const finalSaleData: Omit<Sale, 'id'> = {
                storeId: saleData.storeId,
                items: saleItems,
                subtotal: saleData.subtotal,
                discount: saleData.discount,
                total: saleData.total,
                paymentMethod: saleData.paymentMethod,
                referenceNumber: saleData.referenceNumber || null,
                customerName: saleData.customerName || null,
                specialInstructions: saleData.specialInstructions || null,
                timestamp: finalTimestamp,
                createdAt: now, // Always record when the transaction actually happened
                isPreOrder: saleData.isPreOrder,
                seniorDiscountDetails: saleData.seniorDiscountDetails || null,
                phoneNumber: saleData.phoneNumber || null,
                pickupDate: saleData.pickupDate || null,
                amountPaid: saleData.amountPaid,
                isPaidInFull: !saleData.onCredit && saleData.amountPaid >= saleData.total,
                onCredit: saleData.onCredit,
                regularCustomerId: saleData.regularCustomerId,
                status: 'COMPLETED',
                tableId: saleData.tableId ?? null,
                tableLabel: saleData.tableLabel ?? null,
            };
            
            transaction.set(saleRef, finalSaleData);
        });

        return saleRef.id;

    } catch (error) {
        console.error("Error recording sale: ", error);
        if (error instanceof Error) {
            // Rethrow the specific error from the transaction
            throw error;
        }
        throw new Error("Could not record the sale transaction.");
    }
}

export async function getSales(storeId: string): Promise<Sale[]> {
    if (!storeId) return [];
    const salesCollection = collection(db, 'sales');
    const q = query(salesCollection, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    return snapshot.docs
        .map(doc => {
            const data = doc.data();
            const sale: Partial<Sale> = {
                id: doc.id,
                ...data,
                timestamp: (data.timestamp as Timestamp).toDate(),
                createdAt: (data.createdAt as Timestamp)?.toDate() || (data.timestamp as Timestamp).toDate(), // Fallback for old data
                isPreOrder: data.isPreOrder ?? false,
                status: data.status || 'COMPLETED',
            };

            if (data.pickupDate && data.pickupDate instanceof Timestamp) {
                sale.pickupDate = data.pickupDate.toDate();
            }

            return sale as Sale;
        })
        .filter(sale => sale.storeId === storeId); // Filter by storeId on the client
}

export async function getSalesForToday(storeId: string): Promise<Sale[]> {
    if (!storeId) return [];

    const today = new Date();
    const start = startOfDay(today);
    const end = endOfDay(today);
    
    const salesCollection = collection(db, 'sales');
    const q = query(salesCollection, 
        where("createdAt", ">=", start),
        where("createdAt", "<=", end)
    );
    const snapshot = await getDocs(q);

    const sales = snapshot.docs
        .map(doc => {
            const data = doc.data();
            const sale: Partial<Sale> = {
                id: doc.id,
                ...data,
                timestamp: (data.timestamp as Timestamp).toDate(),
                createdAt: (data.createdAt as Timestamp)?.toDate() || (data.timestamp as Timestamp).toDate(),
                status: data.status || 'COMPLETED',
            };
            if (data.pickupDate && data.pickupDate instanceof Timestamp) {
                sale.pickupDate = data.pickupDate.toDate();
            }
            return sale as Sale;
        })
        .filter(sale => sale.storeId === storeId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        
    return sales;
}

export async function resetAllTransactionalData(storeId: string): Promise<void> {
  const salesQuery = query(collection(db, 'sales'), where("storeId", "==", storeId));
  const eodReportsQuery = query(collection(db, 'eodReports'), where("storeId", "==", storeId));
  const inventoryLogsQuery = query(collection(db, 'inventoryLogs'), where("storeId", "==", storeId));
  const expensesQuery = query(collection(db, 'expenses'), where("storeId", "==", storeId));
  const paymentsQuery = query(collection(db, 'payments'), where("storeId", "==", storeId));
  const customersQuery = query(collection(db, 'regularCustomers'));
  
  const [
    salesSnapshot, 
    eodReportsSnapshot, 
    inventoryLogsSnapshot,
    expensesSnapshot,
    paymentsSnapshot,
    customersSnapshot
  ] = await Promise.all([
    getDocs(salesQuery),
    getDocs(eodReportsSnapshot),
    getDocs(inventoryLogsSnapshot),
    getDocs(expensesQuery),
    getDocs(paymentsSnapshot),
    getDocs(customersSnapshot)
  ]);
  
  const batch = writeBatch(db);
  
  salesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
  eodReportsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
  inventoryLogsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
  expensesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
  paymentsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
  
  // CRITICAL FIX: Only update the credit balance for the specific store being reset.
  customersSnapshot.docs.forEach(customerDoc => {
    const customerRef = doc(db, 'regularCustomers', customerDoc.id);
    const data = customerDoc.data() as RegularCustomer;
    if (data.storeCredit && data.storeCredit[storeId]) {
      const newStoreCredit = { ...data.storeCredit };
      delete newStoreCredit[storeId];
      batch.update(customerRef, { storeCredit: newStoreCredit });
    }
  });

  await batch.commit();
}


export async function settlePreOrderPayment(sale: Sale, amount: number): Promise<void> {
    // This function will now ALWAYS call recordCustomerPayment to ensure a payment
    // document is created. For walk-in customers, customerId will be null.
    await recordCustomerPayment(
        sale.storeId, 
        sale.regularCustomerId || null, // Pass null if it's a walk-in
        amount, 
        `Settlement for Pre-order ID: ${sale.id.substring(0, 5)}...`, 
        sale.id
    );
}

export async function reschedulePreOrder(saleId: string, newPickupDate: Date): Promise<void> {
    const saleRef = doc(db, 'sales', saleId);
    await updateDoc(saleRef, {
        pickupDate: Timestamp.fromDate(newPickupDate),
        timestamp: Timestamp.fromDate(newPickupDate),
    });
}

export async function updatePreOrderNote(saleId: string, newNote: string): Promise<void> {
    const saleRef = doc(db, 'sales', saleId);
    await updateDoc(saleRef, {
        specialInstructions: newNote
    });
}

export async function voidSale(saleId: string, voidedByUserId: string): Promise<void> {
    const saleRef = doc(db, 'sales', saleId);

    await runTransaction(db, async (transaction) => {
        // --- READ PHASE ---
        const saleDoc = await transaction.get(saleRef);
        
        if (!saleDoc.exists() || saleDoc.data().status === 'VOIDED') {
            throw new Error("Sale not found or has already been voided.");
        }
        
        const saleData = saleDoc.data() as Sale;

        // Fetch menu items and inventory definitions needed for logging
        const menuItems = await getMenuItems(saleData.storeId); // Fetch definitions
        const inventoryItems = await getInventoryItems(); // Fetch all master inventory items
        
        const inventoryItemMap = new Map(inventoryItems.map(i => [i.id, i]));
        
        // --- WRITE PHASE ---

        // 1. Restore inventory ONLY if it was not a pre-order
        if (!saleData.isPreOrder) {
            for (const saleItem of saleData.items) {
                const itemsToProcess = saleItem.configuration 
                    ? saleItem.configuration.map(c => ({
                        menuItemId: c.menuItemId,
                        quantity: c.quantity * saleItem.quantity,
                        name: c.name,
                      }))
                    : [{ 
                        // The saleItem.id is a composite key like `baseProductId_variantId`.
                        // We need the menu item definition to find its true consumption rules.
                        menuItemId: saleItem.id,
                        quantity: saleItem.quantity,
                        name: saleItem.name
                      }];

                for (const item of itemsToProcess) {
                    // Find the menu item definition to get its consumption rules
                    const menuItem = menuItems.find(mi => mi.id === item.menuItemId || `${mi.baseProductId}_${mi.id}` === item.menuItemId);
                    if (menuItem?.inventoryConsumption) {
                        for (const consumption of menuItem.inventoryConsumption) {
                            const totalQuantityToRestore = consumption.quantity * item.quantity;
                            if (totalQuantityToRestore === 0) continue;

                            const masterInvItem = inventoryItemMap.get(consumption.inventoryItemId);

                            if (consumptionDeductsStock(consumption, masterInvItem)) {
                                const invItemRef = doc(db, 'storeInventory', `${saleData.storeId}_${consumption.inventoryItemId}`);
                                transaction.update(invItemRef, { stock: increment(totalQuantityToRestore) });
                            }
                            
                            // Create log entry for the voided item
                            const logRef = doc(collection(db, 'inventoryLogs'));
                            transaction.set(logRef, {
                                storeId: saleData.storeId,
                                inventoryItemId: consumption.inventoryItemId,
                                inventoryItemName: masterInvItem?.name || 'Unknown Item',
                                adjustment: totalQuantityToRestore,
                                type: 'Void',
                                notes: `Voided Sale ID: ${saleId.substring(0,5)}... for item: ${saleItem.name}`,
                                timestamp: Timestamp.now(),
                                unit: masterInvItem?.unit || 'pcs'
                            });
                        }
                    }
                }
            }
        }

        // 2. Reverse customer credit if applicable
        if (saleData.onCredit && saleData.regularCustomerId) {
            const customerRef = doc(db, 'regularCustomers', saleData.regularCustomerId);
            const amountToReverse = saleData.total - saleData.amountPaid;
            if (amountToReverse > 0) {
              transaction.update(customerRef, {
                  [`storeCredit.${saleData.storeId}`]: increment(-amountToReverse)
              });
            }
        }
        
        // 3. Mark the sale as voided
        transaction.update(saleRef, {
            status: 'VOIDED',
            voidedAt: new Date(),
            voidedBy: voidedByUserId,
        });
    });
}



import { db } from '@/lib/firebase/client';
import { collection, getDocs, query, orderBy, addDoc, doc, updateDoc, increment, writeBatch, runTransaction, getDoc, deleteDoc, where, Timestamp, type Transaction } from 'firebase/firestore';
import { InventoryItem, InventoryAdjustmentType, StoreInventory, UnitOfMeasurement, CartItem, MenuItem, consumptionDeductsStock } from '@/lib/types';
import { getMenuItems } from './menu-service';


export async function getInventoryItems(): Promise<InventoryItem[]> {
  const inventoryCollection = collection(db, 'inventoryItems');
  const q = query(inventoryCollection, orderBy("name"));
  const snapshot = await getDocs(q);
  const items = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      unit: data.unit || 'pcs',
      tracksStock: data.tracksStock !== false,
    } as InventoryItem;
  });
  return items;
}

export async function getStoreInventory(storeId: string): Promise<StoreInventory[]> {
  const storeInventoryCollection = collection(db, 'storeInventory');
  const q = query(storeInventoryCollection, where("storeId", "==", storeId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
          ...data,
          unit: data.unit || 'pcs',
          tracksStock: data.tracksStock !== false,
      } as StoreInventory
    });
}

export async function addInventoryItem(item: Omit<InventoryItem, 'id'>): Promise<InventoryItem> {
    const batch = writeBatch(db);
    const newItemRef = doc(collection(db, 'inventoryItems'));
    const tracksStock = item.tracksStock !== false;

    batch.set(newItemRef, { name: item.name, unit: item.unit, tracksStock });

    // When a new item is created, we need to initialize its inventory in ALL existing stores.
    const storesSnapshot = await getDocs(collection(db, 'stores'));
    storesSnapshot.forEach(storeDoc => {
        const storeInventoryRef = doc(db, 'storeInventory', `${storeDoc.id}_${newItemRef.id}`);
        batch.set(storeInventoryRef, {
            storeId: storeDoc.id,
            inventoryItemId: newItemRef.id,
            itemName: item.name,
            stock: 0,
            unit: item.unit,
            tracksStock,
        });
    });

    await batch.commit();

    return {
        id: newItemRef.id,
        name: item.name,
        unit: item.unit,
        tracksStock,
    }
}

export async function updateInventoryItemMaster(
  itemId: string,
  name: string,
  unit: UnitOfMeasurement,
  tracksStock: boolean,
): Promise<void> {
    const batch = writeBatch(db);
    const itemRef = doc(db, 'inventoryItems', itemId);
    batch.update(itemRef, { name, unit, tracksStock });

    const storeInventoryQuery = query(collection(db, 'storeInventory'), where("inventoryItemId", "==", itemId));
    const storeInventorySnapshot = await getDocs(storeInventoryQuery);
    storeInventorySnapshot.forEach((d) => {
        batch.update(d.ref, { itemName: name, unit, tracksStock });
    });

    await batch.commit();
}

export async function deleteInventoryItem(itemId: string): Promise<void> {
    const menuItemsCollection = collection(db, 'menuItems');
    const allMenuSnapshot = await getDocs(menuItemsCollection);
    const consumingDocs = allMenuSnapshot.docs.filter((d) => {
      const rows = d.data().inventoryConsumption as { inventoryItemId?: string }[] | undefined;
      return rows?.some((r) => r.inventoryItemId === itemId);
    });

    if (consumingDocs.length > 0) {
        const productNames = consumingDocs.map((d) => d.data().name).join(', ');
        throw new Error(`Cannot delete item. It is used by the following product(s): ${productNames}. Please update these products first.`);
    }

    const itemRef = doc(db, 'inventoryItems', itemId);
    await deleteDoc(itemRef);

    // Also delete all associated store inventory records
    const batch = writeBatch(db);
    const storeInvQuery = query(collection(db, 'storeInventory'), where("inventoryItemId", "==", itemId));
    const storeInvSnapshot = await getDocs(storeInvQuery);
    storeInvSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
}


export async function updateInventoryStock(storeId: string, itemId: string, deduction: number): Promise<void> {
    const storeInventoryRef = doc(db, 'storeInventory', `${storeId}_${itemId}`);
    // This function is now deprecated in favor of transactional updates.
    // Kept for legacy reasons if needed, but should not be used for new sale logic.
    await updateDoc(storeInventoryRef, {
        stock: increment(-deduction)
    });
}

export async function deductStockForSale(
  storeId: string,
  cartItems: CartItem[],
  transaction: Transaction,
  inventoryItemById: Map<string, InventoryItem>,
): Promise<void> {
    if (cartItems.length === 0) {
        return;
    }

    for (const cartItem of cartItems) {
        // Assorted Box: Deduct stock based on the sub-items inside.
        if (cartItem.selectedConfiguration) {
            for (const configItem of cartItem.selectedConfiguration) {
                // The consumption logic for each sub-item is stored in the configItem itself.
                if (configItem.inventoryConsumption) {
                    for (const consumption of configItem.inventoryConsumption) {
                        const totalDeduction = consumption.quantity * configItem.quantity * cartItem.quantity;
                        if (totalDeduction === 0) continue;

                        const master = inventoryItemById.get(consumption.inventoryItemId);
                        if (consumptionDeductsStock(consumption, master)) {
                            const itemRef = doc(db, 'storeInventory', `${storeId}_${consumption.inventoryItemId}`);
                            transaction.update(itemRef, { stock: increment(-totalDeduction) });
                        }
                        
                        // Log this specific inventory deduction
                        const logRef = doc(collection(db, 'inventoryLogs'));
                        transaction.set(logRef, {
                            storeId: storeId,
                            inventoryItemId: consumption.inventoryItemId,
                            // We don't have the item name here, will be denormalized.
                            adjustment: -totalDeduction,
                            type: 'Sale',
                            notes: `Sold via assorted box: ${cartItem.name}`,
                            timestamp: Timestamp.now(),
                            // We don't have the unit here, will be denormalized.
                        });
                    }
                }
            }
        } else if (cartItem.inventoryConsumption) {
            // Simple Product: Deduct stock based on the main item's consumption rules.
            for (const consumption of cartItem.inventoryConsumption) {
                const totalDeduction = consumption.quantity * cartItem.quantity;
                if (totalDeduction === 0) continue;

                const master = inventoryItemById.get(consumption.inventoryItemId);
                if (consumptionDeductsStock(consumption, master)) {
                    const itemRef = doc(db, 'storeInventory', `${storeId}_${consumption.inventoryItemId}`);
                    transaction.update(itemRef, { stock: increment(-totalDeduction) });
                }

                // Log this specific inventory deduction
                const logRef = doc(collection(db, 'inventoryLogs'));
                transaction.set(logRef, {
                    storeId: storeId,
                    inventoryItemId: consumption.inventoryItemId,
                     // We don't have the item name here, will be denormalized.
                    adjustment: -totalDeduction,
                    type: 'Sale',
                    notes: `Sold: ${cartItem.name}`,
                    timestamp: Timestamp.now(),
                    // We don't have the unit here, will be denormalized.
                });
            }
        }
    }
}


interface LogAndAdjustInventoryParams {
    storeId: string;
    itemId: string;
    itemName: string;
    itemUnit: UnitOfMeasurement;
    adjustment: number;
    type: InventoryAdjustmentType;
    notes: string;
}

export async function logAndAdjustInventory({ storeId, itemId, itemName, itemUnit, adjustment, type, notes }: LogAndAdjustInventoryParams): Promise<void> {
  const itemRef = doc(db, 'storeInventory', `${storeId}_${itemId}`);
  const logRef = doc(collection(db, 'inventoryLogs'));
  
  const batch = writeBatch(db);

  // 1. Update the inventory item stock
  batch.update(itemRef, { stock: increment(adjustment) });

  // 2. Create the log entry
  batch.set(logRef, {
    storeId: storeId,
    inventoryItemId: itemId,
    inventoryItemName: itemName,
    adjustment: adjustment,
    type: type,
    notes: notes,
    timestamp: new Date(),
    unit: itemUnit,
  });

  // Commit the batch. This works offline.
  await batch.commit();
}

export async function resetAllInventoryStock(storeId: string): Promise<void> {
  const inventoryCollection = collection(db, 'storeInventory');
  const q = query(inventoryCollection, where("storeId", "==", storeId));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    // No items to reset, so we can just return.
    return;
  }
  
  const batch = writeBatch(db);
  
  snapshot.docs.forEach(doc => {
    batch.update(doc.ref, { stock: 0 });
  });
  
  await batch.commit();
}


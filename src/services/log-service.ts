

import { db } from '@/lib/firebase/client';
import { collection, getDocs, query, orderBy, Timestamp, where } from 'firebase/firestore';
import type { InventoryLog } from '@/lib/types';

export async function getInventoryLogs(storeId: string): Promise<InventoryLog[]> {
  if (!storeId) return [];
  const logsCollection = collection(db, 'inventoryLogs');
  // Removed the storeId filter from the query to avoid composite index requirement.
  // Filtering will be done on the client side after fetching.
  const q = query(logsCollection, orderBy("timestamp", "desc"));
  const logsSnapshot = await getDocs(q);
  
  const logs = logsSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      storeId: data.storeId,
      inventoryItemId: data.inventoryItemId,
      inventoryItemName: data.inventoryItemName,
      adjustment: data.adjustment,
      type: data.type,
      notes: data.notes,
      timestamp: (data.timestamp as Timestamp).toDate(),
      unit: data.unit || 'pcs'
    } as InventoryLog;
  }).filter(log => log.storeId === storeId); // Filter by storeId on the client.

  return logs;
}

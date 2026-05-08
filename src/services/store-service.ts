
import { db } from '@/lib/firebase/client';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  writeBatch,
  getDoc
} from 'firebase/firestore';
import type { Store } from '@/lib/types';

export async function getStores(): Promise<Store[]> {
  const storesCollection = collection(db, 'stores');
  const q = query(storesCollection, orderBy("name"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Store));
}

export async function getStore(storeId: string): Promise<Store | null> {
    const storeRef = doc(db, 'stores', storeId);
    const docSnap = await getDoc(storeRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Store;
    }
    return null;
}

export async function addStore(storeData: Omit<Store, 'id'>): Promise<Store> {
  const batch = writeBatch(db);
  const newStoreRef = doc(collection(db, 'stores'));
  
  batch.set(newStoreRef, storeData);

  // When a new store is created, we also need to initialize its inventory
  const inventoryItemsSnapshot = await getDocs(collection(db, 'inventoryItems'));
  inventoryItemsSnapshot.forEach(itemDoc => {
    const storeInventoryRef = doc(db, 'storeInventory', `${newStoreRef.id}_${itemDoc.id}`);
    batch.set(storeInventoryRef, {
      storeId: newStoreRef.id,
      inventoryItemId: itemDoc.id,
      itemName: itemDoc.data().name,
      stock: 0
    });
  });

  await batch.commit();
  return { id: newStoreRef.id, ...storeData };
}

export async function updateStore(storeId: string, storeData: Partial<Omit<Store, 'id'>>): Promise<void> {
  const storeRef = doc(db, 'stores', storeId);
  await updateDoc(storeRef, storeData);
}

export async function deleteStore(storeId: string): Promise<void> {
  // Add checks here to prevent deletion if there are associated sales, etc.
  // For now, we assume direct deletion is allowed.
  const storeRef = doc(db, 'stores', storeId);
  await deleteDoc(storeRef);
}

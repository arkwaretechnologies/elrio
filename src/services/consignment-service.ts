
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
  Timestamp,
  where,
  writeBatch
} from 'firebase/firestore';
import type { ConsignmentIncome } from '@/lib/types';

// --- Consignment Incomes ---

export async function getConsignmentIncomes(storeId: string): Promise<ConsignmentIncome[]> {
  if (!storeId) return [];
  const incomesCollection = collection(db, 'consignmentIncomes');
  const q = query(incomesCollection, where("storeId", "==", storeId));
  const snapshot = await getDocs(q);
  
  const incomes = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      date: (data.date as Timestamp).toDate(),
    } as ConsignmentIncome;
  });

  return incomes.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export async function addConsignmentIncome(incomeData: Omit<ConsignmentIncome, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'consignmentIncomes'), {
    ...incomeData,
    date: Timestamp.fromDate(new Date(incomeData.date)),
  });
  return docRef.id;
}

export async function updateConsignmentIncome(incomeId: string, incomeData: Partial<Omit<ConsignmentIncome, 'id'>>): Promise<void> {
  const incomeRef = doc(db, 'consignmentIncomes', incomeId);
  const dataToUpdate: any = { ...incomeData };
  if (incomeData.date) {
    dataToUpdate.date = Timestamp.fromDate(new Date(incomeData.date));
  }
  await updateDoc(incomeRef, dataToUpdate);
}

export async function deleteConsignmentIncome(incomeId: string): Promise<void> {
  const incomeRef = doc(db, 'consignmentIncomes', incomeId);
  await deleteDoc(incomeRef);
}
